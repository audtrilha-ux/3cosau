import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SyncAPI } from '../contracts/os-context';
import { db } from '../storage/dexie.db';
import { IdGeneratorService } from '../services/id-generator.service';
import { getTableForEntityType } from '../constants/entity-type-registry';
import { AppContextService } from '../services/app-context.service';

export interface OutboxMessage {
  id: string;
  idempotencyKey: string;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  operatorId?: string;
  timestamp: number;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'BLOCKED';
  retryCount: number;
  lastAttemptAt?: number;
  errorMessage?: string;
  payloadHash: string;
}

export interface CloudEndpointConfig {
  enabled: boolean;
  serverUrl: string;
  apiKey?: string;
  tenantId?: string;
  syncIntervalSeconds: number;
}

@Injectable({ providedIn: 'root' })
export class SyncOutboxService implements SyncAPI {
  private idGen = inject(IdGeneratorService);
  private platformId = inject(PLATFORM_ID);
  private context = inject(AppContextService);
  readonly isSyncing = signal<boolean>(false);
  readonly pendingCount = signal<number>(0);
  readonly lastSyncTimestamp = signal<number | null>(null);
  readonly lastSyncResult = signal<string>('Offline First - Seguro no armazenamento local');
  readonly cloudConfig = signal<CloudEndpointConfig>({
    enabled: false,
    serverUrl: '',
    syncIntervalSeconds: 60
  });

  private syncTimer: any = null;
  private consecutiveFailures = 0;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadConfig();
      this.refreshPendingCount();
      this.initBackgroundSync();
    }
  }

  private initBackgroundSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    const intervalMs = Math.max(10, this.cloudConfig().syncIntervalSeconds || 30) * 1000;
    this.syncTimer = setInterval(async () => {
      if (!isPlatformBrowser(this.platformId) || this.isSyncing()) return;
      const cfg = this.cloudConfig();
      if (!cfg.enabled || !cfg.serverUrl) return;

      // Backoff if failing repeatedly
      if (this.consecutiveFailures > 0) {
        const backoffMinutes = Math.min(5, Math.pow(2, this.consecutiveFailures - 1));
        const lastSync = this.lastSyncTimestamp() || 0;
        if (Date.now() - lastSync < backoffMinutes * 30000) {
          return;
        }
      }

      try {
        await this.syncNow();
        this.consecutiveFailures = 0;
      } catch (err) {
        this.consecutiveFailures++;
      }
    }, intervalMs);
  }

  loadConfig(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const saved = localStorage.getItem('3eatcru_cloud_config');
      if (saved) {
        this.cloudConfig.set(JSON.parse(saved));
      } else {
        const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const defaultConfig: CloudEndpointConfig = {
          enabled: true,
          serverUrl: originUrl,
          syncIntervalSeconds: 30
        };
        this.cloudConfig.set(defaultConfig);
        localStorage.setItem('3eatcru_cloud_config', JSON.stringify(defaultConfig));
      }
    } catch {
      // Ignore
    }
  }

  saveConfig(config: CloudEndpointConfig): void {
    this.cloudConfig.set(config);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('3eatcru_cloud_config', JSON.stringify(config));
    }
  }

  async enqueue(entityType: string, entityId: string, operation: 'CREATE' | 'UPDATE' | 'DELETE', payload: any, operatorId?: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const currentOpId = operatorId || this.context.currentOperator()?.id;
    const messageId = this.idGen.generatePrefixedId('outbox');
    const message: OutboxMessage = {
      id: messageId,
      idempotencyKey: messageId, // Serve como Idempotency Key para o servidor não duplicar registros
      entityType,
      entityId,
      operation,
      payload,
      operatorId: currentOpId,
      timestamp: Date.now(),
      status: 'PENDING',
      retryCount: 0,
      payloadHash: this.hashPayload(payload)
    };

    try {
      await db.outbox.put(message);
      await this.refreshPendingCount();
      console.log(`[SyncOutbox] Mutation [${entityType} ${operation}] saved to Outbox (PENDING):`, message.id);
    } catch (err) {
      console.error('[SyncOutbox] Error writing to outbox table:', err);
      throw err;
    }
  }

  /**
   * Executes real synchronization flow.
   * If no cloud endpoint is configured, respects offline-first state and keeps items in PENDING.
   */
  async syncNow(): Promise<{ processed: number; succeeded: number; failed: number; message: string }> {
    if (!isPlatformBrowser(this.platformId) || this.isSyncing()) {
      return { processed: 0, succeeded: 0, failed: 0, message: 'Sync ocupado ou indisponível.' };
    }

    this.isSyncing.set(true);

    try {
      const pending = await db.outbox
        .where('status').equals('PENDING').or('status').equals('FAILED').limit(50).toArray();

      const cfg = this.cloudConfig();

      if (pending.length === 0) {
        // Se não houver nada para enviar, ainda executa pull se o sincronismo estiver ativado
        if (cfg.enabled && cfg.serverUrl) {
          const pullRes = await this.pullNow();
          this.isSyncing.set(false);
          this.lastSyncTimestamp.set(Date.now());
          if (pullRes.pulled > 0) {
            this.lastSyncResult.set(`Atualizado: ${pullRes.pulled} alterações baixadas.`);
          } else {
            this.lastSyncResult.set('Todos os registros locais estão atualizados.');
          }
          await this.refreshPendingCount();
          return { processed: 0, succeeded: 0, failed: 0, message: `Nenhum registro para enviar. ${pullRes.message}` };
        }

        this.isSyncing.set(false);
        this.lastSyncTimestamp.set(Date.now());
        this.lastSyncResult.set('Todos os registros locais estão atualizados.');
        await this.refreshPendingCount();
        return { processed: 0, succeeded: 0, failed: 0, message: 'Nenhuma alteração pendente.' };
      }

      // If Cloud Sync is NOT configured or disabled:
      // DO NOT fake success. Explicitly inform the user.
      if (!cfg.enabled || !cfg.serverUrl) {
        this.isSyncing.set(false);
        this.lastSyncResult.set(`Modo Local-First: ${pending.length} mutações protegidas no Dexie. Nuvem desativada.`);
        await this.refreshPendingCount();
        return {
          processed: pending.length,
          succeeded: 0,
          failed: 0,
          message: `${pending.length} registros guardados com segurança no banco local. Configure uma URL de nuvem para sincronismo remoto.`
        };
      }

      // Mark items as SYNCING
      for (const msg of pending) {
        msg.status = 'SYNCING';
        msg.lastAttemptAt = Date.now();
        await db.outbox.put(msg);
      }

      const settings = await db.companySettings.toCollection().first();
      const tenantId = settings?.id || cfg.tenantId || 'default-tenant';
      const syncToken = settings?.syncToken || cfg.apiKey || '';

      try {
        // Real HTTP transmission to remote gateway
        const response = await fetch(`${cfg.serverUrl.replace(/\/$/, '')}/api/sync/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(syncToken ? { 'Authorization': `Bearer ${syncToken}` } : {}),
            'X-Tenant-ID': tenantId
          },
          body: JSON.stringify({
            sentAt: Date.now(),
            batchSize: pending.length,
            mutations: pending
          })
        });

        if (!response.ok) {
          throw new Error(`Servidor remoto retornou HTTP ${response.status}: ${response.statusText}`);
        }

        const ack = await response.json();
        const acknowledgedIds: string[] = ack.processedIds || pending.map(p => p.id);
        const blockedIds: string[] = ack.blockedIds || [];

        let succeeded = 0;
        let blocked = 0;
        
        for (const msg of pending) {
          if (blockedIds.includes(msg.id)) {
            msg.status = 'BLOCKED';
            msg.errorMessage = 'Conflito de versão: o servidor rejeitou a mutação.';
            blocked++;
          } else if (acknowledgedIds.includes(msg.id)) {
            msg.status = 'SYNCED';
            msg.errorMessage = undefined;
            succeeded++;
          } else {
            const nextRetry = msg.retryCount + 1;
            if (nextRetry >= 10) {
              msg.status = 'BLOCKED';
              msg.errorMessage = 'Transmissão bloqueada: Não confirmado pelo servidor após 10 tentativas.';
            } else {
              msg.status = 'FAILED';
              msg.retryCount = nextRetry;
              msg.errorMessage = 'Não confirmado pelo servidor';
            }
          }
          await db.outbox.put(msg);
        }

        // Executa o Pull Incremental após o envio bem-sucedido de dados
        const pullRes = await this.pullNow();

        this.lastSyncTimestamp.set(Date.now());
        if (succeeded === 0 && pending.length > 0) {
          this.lastSyncResult.set(`Falha parcial: Nenhum registro enviado (Rejeitados/Bloqueados). ${pullRes.pulled} recebidos.`);
        } else {
          this.lastSyncResult.set(`Sincronizado: ${succeeded} enviados, ${pullRes.pulled} recebidos.`);
        }
        await this.refreshPendingCount();

        return {
          processed: pending.length,
          succeeded,
          failed: pending.length - succeeded,
          message: `Sincronização bidirecional concluída. ${succeeded} enviados. ${pullRes.message}`
        };

      } catch (networkErr: any) {
        console.warn('[SyncOutbox] Network transmission failed:', networkErr.message);

        // Mark failed items as FAILED (or BLOCKED if max attempts reached) so they can be retried later
        for (const msg of pending) {
          const nextRetry = msg.retryCount + 1;
          if (nextRetry >= 10) {
            msg.status = 'BLOCKED';
            msg.errorMessage = `Bloqueado após 10 tentativas malsucedidas: ${networkErr.message || 'Erro de rede'}`;
          } else {
            msg.status = 'FAILED';
            msg.retryCount = nextRetry;
            msg.errorMessage = networkErr.message || 'Erro de conexão de rede';
          }
          await db.outbox.put(msg);
        }

        this.lastSyncResult.set(`Falha na transmissão: ${networkErr.message}. Dados preservados localmente.`);
        await this.refreshPendingCount();

        return {
          processed: pending.length,
          succeeded: 0,
          failed: pending.length,
          message: `Erro ao conectar ao servidor de nuvem: ${networkErr.message}. Todas as vendas continuam seguras no banco local.`
        };
      }

    } catch (err: any) {
      console.error('[SyncOutbox] Fatal error in sync loop:', err);
      this.lastSyncResult.set('Erro interno no processo de sincronização.');
      return { processed: 0, succeeded: 0, failed: 1, message: err.message };
    } finally {
      this.isSyncing.set(false);
    }
  }

  /**
   * Pulls remote mutations from the server and applies them locally to Dexie.
   */
  async pullNow(): Promise<{ pulled: number; message: string }> {
    if (!isPlatformBrowser(this.platformId)) return { pulled: 0, message: 'Não suportado fora do navegador' };

    const cfg = this.cloudConfig();
    if (!cfg.enabled || !cfg.serverUrl) {
      return { pulled: 0, message: 'Sincronização remota desativada.' };
    }

    try {
      const settings = await db.companySettings.toCollection().first();
      const tenantId = settings?.id || cfg.tenantId || 'default-tenant';
      const syncToken = settings?.syncToken || cfg.apiKey || '';

      const lastPullStr = localStorage.getItem('3eatcru_last_pull_timestamp') || '0';
      const lastPullTimestamp = Number(lastPullStr);
      const lastPullId = localStorage.getItem('3eatcru_last_pull_id') || '';

      const response = await fetch(`${cfg.serverUrl.replace(/\/$/, '')}/api/sync/pull?lastSyncedAt=${lastPullTimestamp}&lastId=${encodeURIComponent(lastPullId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(syncToken ? { 'Authorization': `Bearer ${syncToken}` } : {}),
          'X-Tenant-ID': tenantId
        }
      });

      if (!response.ok) {
        throw new Error(`Servidor de Pull retornou HTTP ${response.status}`);
      }

      const resData = await response.json();
      if (!resData.success || !resData.mutations) {
        throw new Error('Formato de resposta de pull inválido');
      }

      const mutations = resData.mutations;
      let appliedCount = 0;
      let lastSuccessfullyAppliedMutation: { syncedAt: number; id: string } | null = null;

      // Apply mutations directly to Dexie tables bypassing the Outbox enqueue to prevent infinite loops
      for (const m of mutations) {
        const dexieTableName = getTableForEntityType(m.entityType);
        if (!dexieTableName) {
          console.warn(`[Pull Sync] Tabela não mapeada para tipo de entidade: ${m.entityType}`);
          continue;
        }

        const table = (db as any)[dexieTableName];
        if (!table) {
          console.warn(`[Pull Sync] Tabela Dexie "${dexieTableName}" não encontrada no banco.`);
          continue;
        }

        try {
          if (m.operation === 'CREATE' || m.operation === 'UPDATE') {
            // Check if there are local un-synced pending mutations for this entity
            const pendingForEntity = await db.outbox
              .where('status')
              .anyOf(['PENDING', 'SYNCING', 'FAILED'])
              .and(o => o.entityId === m.entityId)
              .first();

            if (pendingForEntity) {
              // Entity has local pending edits: Protect local state to avoid clobbering uncommitted work
              const localRecord = await table.get(m.entityId);
              if (localRecord && (localRecord.updatedAt || localRecord.timestamp) > (m.timestamp || 0)) {
                // Keep local newer record until it gets pushed
                console.log(`[Pull Sync] Preservando alteração local pendente para ${m.entityType}:${m.entityId}`);
                lastSuccessfullyAppliedMutation = { syncedAt: m.syncedAt, id: m.id };
                continue;
              }
            }

            // P0 FIX: Prevent Double Counting of Stock. PRODUCT mutations should not overwrite local stock.
            if (m.entityType === 'PRODUCT') {
              const localProd = await db.products.get(m.entityId);
              if (localProd) {
                m.payload.stock = localProd.stock;
              }
            }
            // P1 FIX: CASH_SESSION should not overwrite local finalCashCalculated if there are local movements
            if (m.entityType === 'CASH_SESSION') {
              const localSession = await db.cashSessions.get(m.entityId);
              if (localSession) {
                 m.payload.finalCashCalculated = localSession.finalCashCalculated;
                 m.payload.movements = localSession.movements || [];
              }
            }

            await table.put(m.payload);
            appliedCount++;

            // Apply delta effects locally
            if (m.entityType === 'STOCK_MOVEMENT' && m.operation === 'CREATE') {
              const prod = await db.products.get(m.payload.productId);
              if (prod) {
                const qty = Number(m.payload.quantity) || 0;
                if (m.payload.type === 'ENTRADA' || m.payload.type === 'AJUSTE_POSITIVO') {
                  prod.stock = (Number(prod.stock) || 0) + qty;
                } else if (m.payload.type === 'SAIDA_VENDA' || m.payload.type === 'AJUSTE_NEGATIVO' || m.payload.type === 'PERDA') {
                  prod.stock = (Number(prod.stock) || 0) - qty;
                }
                await db.products.put(prod);
              }
            } else if (m.entityType === 'CASH_MOVEMENT' && m.operation === 'CREATE') {
              const session = await db.cashSessions.get(m.payload.sessionId);
              if (session) {
                if (!session.movements) session.movements = [];
                const exists = session.movements.some(x => x.id === m.payload.id);
                if (!exists) {
                  session.movements.push(m.payload);
                  const amount = Number(m.payload.amount) || 0;
                  if (m.payload.type === 'SUPRIMENTO') {
                    session.finalCashCalculated = (Number(session.finalCashCalculated) || Number(session.initialCash) || 0) + amount;
                  } else if (m.payload.type === 'SANGRIA') {
                    session.finalCashCalculated = (Number(session.finalCashCalculated) || Number(session.initialCash) || 0) - amount;
                  }
                  await db.cashSessions.put(session);
                }
              }
            }
          } else if (m.operation === 'DELETE') {
            const pendingForEntity = await db.outbox
              .where('status')
              .anyOf(['PENDING', 'SYNCING', 'FAILED'])
              .and(o => o.entityId === m.entityId)
              .first();

            if (!pendingForEntity) {
              await table.delete(m.entityId);
              appliedCount++;
            }
          }
          lastSuccessfullyAppliedMutation = { syncedAt: m.syncedAt, id: m.id };
        } catch (tableErr) {
          console.error(`[Pull Sync] Erro ao aplicar mutação na tabela local "${dexieTableName}":`, tableErr);
          // Stop advancing cursor past the point of error to guarantee no data skipping
          break;
        }
      }

      // Update cursor safely: only advance to the last mutation successfully processed
      if (lastSuccessfullyAppliedMutation) {
        localStorage.setItem('3eatcru_last_pull_timestamp', lastSuccessfullyAppliedMutation.syncedAt.toString());
        localStorage.setItem('3eatcru_last_pull_id', lastSuccessfullyAppliedMutation.id);
      } else if (mutations.length === 0) {
        localStorage.setItem('3eatcru_last_pull_timestamp', resData.currentTimestamp.toString());
      }
      
      console.log(`[Pull Sync] Sincronização incremental concluída. Aplicados ${appliedCount} registros remotos.`);
      
      return {
        pulled: appliedCount,
        message: `Sincronismo Pull: ${appliedCount} atualizações recebidas da Central.`
      };

    } catch (err: any) {
      console.error('[Pull Sync] Erro fatal durante recebimento incremental:', err);
      return { pulled: 0, message: `Falha no sincronismo Pull: ${err.message}` };
    }
  }

  private getDexieTableByEntityType(type: string): string | null {
    return getTableForEntityType(type);
  }

  async refreshPendingCount(): Promise<number> {
    if (!isPlatformBrowser(this.platformId)) return 0;
    try {
      const count = await db.outbox.where('status').equals('PENDING').or('status').equals('FAILED').count();
      this.pendingCount.set(count);
      return count;
    } catch {
      return 0;
    }
  }

  async getPendingCount(): Promise<number> {
    return await this.refreshPendingCount();
  }

  async getAllMessages(): Promise<OutboxMessage[]> {
    if (!isPlatformBrowser(this.platformId)) return [];
    try {
      return await db.outbox.reverse().limit(100).toArray();
    } catch {
      return [];
    }
  }

  async clearSynced(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      await db.outbox.where('status').equals('SYNCED').delete();
      await this.refreshPendingCount();
    } catch (err) {
      console.error('[SyncOutbox] Error clearing synced messages:', err);
    }
  }

  async unblockAll(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const blocked = await db.outbox.where('status').equals('BLOCKED').limit(50).toArray();
      for (const msg of blocked) {
        msg.status = 'PENDING';
        msg.retryCount = 0;
        msg.errorMessage = undefined;
        await db.outbox.put(msg);
      }
      await this.refreshPendingCount();
    } catch (err) {
      console.error('[SyncOutbox] Error unblocking messages:', err);
    }
  }

  async retryMessage(id: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const msg = await db.outbox.get(id);
      if (msg) {
        msg.status = 'PENDING';
        msg.retryCount = 0;
        msg.errorMessage = undefined;
        await db.outbox.put(msg);
        await this.refreshPendingCount();
      }
    } catch (err) {
      console.error('[SyncOutbox] Error retrying message:', err);
    }
  }

  async discardMessage(id: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      await db.outbox.delete(id);
      await this.refreshPendingCount();
    } catch (err) {
      console.error('[SyncOutbox] Error discarding message:', err);
    }
  }

  private hashPayload(payload: any): string {
    try {
      const str = JSON.stringify(payload);
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
      }
      return 'h_' + Math.abs(hash).toString(16);
    } catch {
      return 'h_raw';
    }
  }
}

import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { db } from '../storage/dexie.db';
import { CompanySettings, Location, TerminalDevice, Operator } from '../models';
import { IdGeneratorService } from './id-generator.service';

@Injectable({ providedIn: 'root' })
export class AppContextService {
  private idGen = inject(IdGeneratorService);
  private platformId = inject(PLATFORM_ID);
  readonly company = signal<CompanySettings | null>(null);
  readonly location = signal<Location | null>(null);
  readonly device = signal<TerminalDevice | null>(null);
  readonly currentOperator = signal<Operator | null>(null);

  readonly isConfigured = signal<boolean>(false);
  readonly isLocked = signal<boolean>(false);
  readonly activeOperators = signal<Operator[]>([]);

  readonly companyId = computed(() => this.company()?.id || '');
  readonly companyName = computed(() => this.company()?.tradingName || this.company()?.name || '3EATCRU');
  readonly locationId = computed(() => this.location()?.id || '');
  readonly deviceId = computed(() => this.device()?.id || '');
  readonly operatorName = computed(() => this.currentOperator()?.name || '');
  readonly operatorRole = computed(() => this.currentOperator()?.role || null);

  readonly isTrialExpired = computed(() => {
    const comp = this.company();
    if (!comp) return false;
    
    // Se o status local estiver marcado como expirado, bloqueado ou suspenso:
    if (
      comp.subscriptionStatus === 'TRIAL_EXPIRED' || 
      comp.subscriptionStatus === 'BLOCKED' || 
      comp.subscriptionStatus === 'UNPAID'
    ) {
      return true;
    }
    
    // Se o prazo offline de trial expirou
    if (comp.trialEndsAt && Date.now() > comp.trialEndsAt) {
      return true;
    }
    
    return false;
  });

  readonly daysRemaining = computed(() => {
    const comp = this.company();
    if (!comp || !comp.trialEndsAt) return 0;
    const diff = comp.trialEndsAt - Date.now();
    return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  });

  async checkLicenseOnline(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const comp = this.company();
    if (!comp || !comp.id) return;

    try {
      const response = await fetch('/api/sync/license-check', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': comp.id,
          ...(comp.syncToken ? { 'Authorization': `Bearer ${comp.syncToken}` } : {})
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const updated: CompanySettings = {
            ...comp,
            subscriptionStatus: data.subscriptionStatus,
            trialEndsAt: data.trialEndsAt,
            planCode: data.planCode || comp.planCode
          };
          await db.companySettings.clear();
          await db.companySettings.put(updated);
          this.company.set(updated);
        }
      }
    } catch (err) {
      console.warn('[License Check] Servidor de licença indisponível, usando cache local offline.', err);
    }
  }

  async activateLicenseSimulated(): Promise<{ success: boolean; message: string }> {
    if (!isPlatformBrowser(this.platformId)) return { success: false, message: 'SSR' };
    const comp = this.company();
    if (!comp) return { success: false, message: 'Terminal não configurado.' };

    try {
      await this.checkLicenseOnline();
      const current = this.company();
      if (current && current.subscriptionStatus === 'ACTIVE') {
        return { success: true, message: 'Assinatura validada e ativa junto à Central.' };
      }
      return { success: false, message: 'Status de licença verificado na Central. Aguardando confirmação de plano.' };
    } catch (err: any) {
      console.error('[License Renew] Falha ao comunicar com a Central:', err);
      return { success: false, message: 'Não foi possível conectar à Central de Licenciamento. Verifique sua conexão à internet.' };
    }
  }

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.initContext();
    }
  }

  async initContext(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      // 1. Check if company settings exist
      const settings = await db.companySettings.toCollection().first();
      const operatorCount = await db.operators.count();

      if (!settings || !settings.isInitialized || operatorCount === 0) {
        this.isConfigured.set(false);
        this.company.set(null);
        this.location.set(null);
        this.device.set(null);
        this.currentOperator.set(null);
        this.isLocked.set(false);
        return;
      }

      this.company.set(settings);
      this.isConfigured.set(true);
      
      // Verificação autoritativa assíncrona da licença na Central
      this.checkLicenseOnline();

      // 2. Load Location
      const locId = settings.activeLocationId;
      if (locId) {
        this.location.set({
          id: locId,
          companyId: settings.id,
          name: settings.tradingName + ' - Matriz',
          code: 'MATRIZ',
          address: settings.address,
          city: settings.city,
          state: settings.state,
          isMain: true
        });
      }

      // 3. Load or generate Terminal Device ID
      const storedDeviceId = localStorage.getItem('3eatcru_device_id');
      if (storedDeviceId) {
        this.device.set({
          id: storedDeviceId,
          companyId: settings.id,
          locationId: locId || '',
          name: settings.tradingName + ' - Terminal',
          type: 'PDV',
          fingerprint: storedDeviceId,
          registeredAt: Date.now()
        });
      }

      // 4. Load Operators
      const ops = await db.operators.where('active').equals(1 as any).toArray().catch(() => db.operators.toArray());
      const activeOps = ops.filter(o => o.active);
      this.activeOperators.set(activeOps);

      // Check last operator logged in
      const lastOpId = localStorage.getItem('3eatcru_last_operator_id');
      const foundOp = activeOps.find(o => o.id === lastOpId);

      if (foundOp) {
        // Lock screen for PIN entry by default on fresh reload
        this.currentOperator.set(foundOp);
        this.isLocked.set(true);
      } else if (activeOps.length > 0) {
        this.currentOperator.set(activeOps[0]);
        this.isLocked.set(true);
      }
    } catch (err) {
      console.error('[AppContextService] Error initializing context:', err);
    }
  }

  /**
   * Helper method to securely compute PBKDF2-HMAC-SHA256 hash of a PIN using standard Web Crypto API.
   * Derives key bits using 10,000 iterations to mitigate brute-force risks on short PINs.
   */
  async hashPin(pin: string, salt: string): Promise<string> {
    const cryptoObj = typeof crypto !== 'undefined' ? crypto : (typeof globalThis !== 'undefined' ? globalThis.crypto : null);
    if (!cryptoObj || !cryptoObj.subtle) {
      if (!isPlatformBrowser(this.platformId)) {
        return `ssr_hash_${pin}_${salt}`;
      }
      throw new Error('Ambiente seguro com Web Crypto API não disponível para geração de chave criptográfica.');
    }
    const encoder = new TextEncoder();
    const pinBytes = encoder.encode(pin);
    const saltBytes = encoder.encode(salt);

    // Import the PIN as a base key
    const baseKey = await cryptoObj.subtle.importKey(
      'raw',
      pinBytes,
      'PBKDF2',
      false,
      ['deriveBits']
    );

    // Derive key bits using PBKDF2 with 10000 iterations and HMAC-SHA256
    const derivedBits = await cryptoObj.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: 10000,
        hash: 'SHA-256'
      },
      baseKey,
      256 // 32 bytes (256 bits)
    );

    const hashArray = Array.from(new Uint8Array(derivedBits));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private failedPinAttempts = new Map<string, { count: number; lockedUntil: number }>();

  /**
   * Authenticates an operator using their unique PIN with brute-force lockout protection.
   */
  async authenticateOperator(operatorId: string, pin: string): Promise<{ success: boolean; message?: string }> {
    if (!isPlatformBrowser(this.platformId)) return { success: false, message: 'SSR' };

    const now = Date.now();
    const lockInfo = this.failedPinAttempts.get(operatorId);
    if (lockInfo && lockInfo.lockedUntil > now) {
      const waitSeconds = Math.ceil((lockInfo.lockedUntil - now) / 1000);
      return { 
        success: false, 
        message: `Muitas tentativas incorretas. Terminal temporariamente bloqueado. Aguarde ${waitSeconds}s.` 
      };
    }

    const op = await db.operators.get(operatorId);
    if (!op || !op.active) {
      return { success: false, message: 'Operador não encontrado ou inativo.' };
    }

    const salt = op.salt || op.id; // Fallback to operator ID if salt does not exist
    const computedHash = await this.hashPin(pin, salt);

    if (op.pin !== computedHash) {
      const currentAttempts = (lockInfo?.count || 0) + 1;
      let lockedUntil = 0;
      if (currentAttempts >= 5) {
        lockedUntil = now + 30 * 1000; // 30 seconds lockout
      }
      this.failedPinAttempts.set(operatorId, { count: currentAttempts, lockedUntil });

      // Audit failed attempt
      try {
        const comp = this.company();
        if (comp) {
          await db.auditLogs.put({
            id: this.idGen.generatePrefixedId('aud'),
            companyId: comp.id,
            actor: op.name,
            action: 'LOGIN_FALHOU',
            resource: 'Autenticação',
            resourceId: op.id,
            details: `Tentativa de PIN incorreta (${currentAttempts}/5).`,
            timestamp: now
          });
        }
      } catch (logErr) {
        console.warn('Failed to write audit log for failed login:', logErr);
      }

      if (currentAttempts >= 5) {
        return { success: false, message: 'Limite de tentativas excedido. Terminal bloqueado por 30 segundos.' };
      }
      return { success: false, message: `PIN incorreto. (${currentAttempts}/5 tentativas)` };
    }

    // Reset attempt counter on success
    this.failedPinAttempts.delete(operatorId);
    this.currentOperator.set(op);
    this.isLocked.set(false);
    localStorage.setItem('3eatcru_last_operator_id', op.id);
    return { success: true };
  }

  /**
   * Authenticates an operator using their email and strong password.
   */
  async authenticateOperatorWithEmailPassword(email: string, password: string): Promise<{ success: boolean; message?: string }> {
    if (!isPlatformBrowser(this.platformId)) return { success: false, message: 'SSR' };

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanEmail || !cleanPassword) {
      return { success: false, message: 'Informe o e-mail e a senha.' };
    }

    const compId = this.companyId();
    const ops = compId 
      ? await db.operators.where('companyId').equals(compId).toArray() 
      : await db.operators.toArray();

    const op = ops.find(o => o.email && o.email.toLowerCase() === cleanEmail && o.active);
    if (!op) {
      return { success: false, message: 'Nenhum operador encontrado com este e-mail.' };
    }

    if (!op.password) {
      return { success: false, message: 'Este operador ainda não possui senha cadastrada. Utilize o PIN de acesso.' };
    }

    const salt = op.salt || op.id;
    const computedHash = await this.hashPin(cleanPassword, salt);

    if (op.password !== computedHash) {
      return { success: false, message: 'Senha incorreta. Verifique suas credenciais.' };
    }

    this.currentOperator.set(op);
    this.isLocked.set(false);
    localStorage.setItem('3eatcru_last_operator_id', op.id);
    return { success: true };
  }

  /**
   * Locks the current desktop session and requires PIN unlock.
   */
  lockSession(): void {
    this.isLocked.set(true);
  }

  /**
   * Logs out and forces operator selection.
   */
  logout(): void {
    this.currentOperator.set(null);
    this.isLocked.set(true);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('3eatcru_last_operator_id');
    }
  }

  /**
   * Completes the initial onboarding / setup wizard for a new installation.
   */
  async setupInitialCompany(params: {
    companyName: string;
    tradingName: string;
    cnpj?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    locationName?: string;
    deviceName?: string;
    ownerName: string;
    ownerPin: string;
    ownerEmail?: string;
    ownerPassword?: string;
    seedDemoData?: boolean;
    // Licensing and Trial details from Central Pairing
    licenseKey?: string;
    planId?: string;
    planCode?: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
    trialStartedAt?: number;
    trialEndsAt?: number;
    subscriptionStatus?: 'TRIAL' | 'ACTIVE' | 'TRIAL_EXPIRED' | 'BLOCKED' | 'UNPAID';
    syncToken?: string;
  }): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const companyId = this.idGen.generatePrefixedId('emp');
    const locationId = this.idGen.generatePrefixedId('loc');
    const deviceId = this.idGen.generatePrefixedId('term');
    const ownerId = this.idGen.generatePrefixedId('op_owner');

    const now = Date.now();
    const defaultTrialDuration = 7 * 24 * 60 * 60 * 1000; // 7 dias

    const newSettings: CompanySettings = {
      id: companyId,
      name: params.companyName.trim(),
      tradingName: params.tradingName.trim() || params.companyName.trim(),
      cnpj: params.cnpj?.trim() || '',
      phone: params.phone?.trim() || '',
      address: params.address?.trim() || '',
      city: params.city?.trim() || 'São Paulo',
      state: params.state?.trim() || 'SP',
      taxRegime: 'SIMPLES_NACIONAL',
      receiptHeader: params.tradingName.trim().toUpperCase(),
      receiptFooter: 'Obrigado pela preferência! Volte sempre.',
      enableSound: true,
      blindCashClose: false,
      printerWidth: '80mm',
      activeLocationId: locationId,
      activeDeviceId: deviceId,
      isInitialized: true,
      
      // Licensing and Trial integration
      licenseKey: params.licenseKey || ('TRIAL-LOCAL-' + this.idGen.generateUUID().substring(0, 8).toUpperCase()),
      planId: params.planId || 'plan_pro',
      planCode: params.planCode || 'PROFESSIONAL',
      trialStartedAt: params.trialStartedAt || now,
      trialEndsAt: params.trialEndsAt || (now + defaultTrialDuration),
      subscriptionStatus: params.subscriptionStatus || 'TRIAL',
      syncToken: params.syncToken
    };

    const salt = 'salt_' + this.idGen.generateUUID().substring(0, 7);
    const hashedPin = await this.hashPin(params.ownerPin.trim(), salt);

    let hashedPassword: string | undefined = undefined;
    if (params.ownerPassword && params.ownerPassword.trim()) {
      hashedPassword = await this.hashPin(params.ownerPassword.trim(), salt);
    }

    const ownerOperator: Operator = {
      id: ownerId,
      companyId,
      name: params.ownerName.trim(),
      role: 'OWNER',
      pin: hashedPin,
      email: params.ownerEmail?.trim().toLowerCase() || undefined,
      password: hashedPassword,
      salt,
      active: true,
      createdAt: Date.now()
    };

    const mainLocation: Location = {
      id: locationId,
      companyId,
      name: params.locationName?.trim() || 'Matriz - Centro',
      code: 'MATRIZ',
      address: params.address,
      city: params.city,
      state: params.state,
      isMain: true
    };

    const mainDevice: TerminalDevice = {
      id: deviceId,
      companyId,
      locationId,
      name: params.deviceName?.trim() || 'Caixa Principal #01',
      type: 'PDV',
      fingerprint: deviceId,
      registeredAt: Date.now()
    };

    // Save to Dexie
    await db.companySettings.put(newSettings);
    await db.operators.put(ownerOperator);

    localStorage.setItem('3eatcru_device_id', deviceId);
    localStorage.setItem('3eatcru_last_operator_id', ownerId);

    this.company.set(newSettings);
    this.location.set(mainLocation);
    this.device.set(mainDevice);
    this.currentOperator.set(ownerOperator);
    this.activeOperators.set([ownerOperator]);
    this.isConfigured.set(true);
    this.isLocked.set(false);
  }

  /**
   * Refreshes operators list from Dexie isolated by tenant.
   */
  async reloadOperators(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const compId = this.companyId();
    const ops = compId 
      ? await db.operators.where('companyId').equals(compId).toArray()
      : await db.operators.toArray();
    this.activeOperators.set(ops.filter(o => o.active));
  }
}

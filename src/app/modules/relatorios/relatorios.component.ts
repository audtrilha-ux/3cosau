import { Component, OnInit, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { db } from '../../core/storage/dexie.db';
import { Sale, AuditLog } from '../../core/models';
import { OutboxMessage } from '../../core/sync/sync-outbox.service';
import { AppContextService } from '../../core/services/app-context.service';

@Component({
  selector: 'app-relatorios',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col bg-zinc-50 text-zinc-900 font-sans p-6 overflow-hidden">      
      <!-- Top Bar -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-zinc-200 text-zinc-800 flex items-center justify-center">
            <mat-icon class="scale-125">bar_chart</mat-icon>
          </div>
          <div>
            <h1 class="text-xl font-bold tracking-tight">Analytics & Relatórios</h1>
            <p class="text-xs text-zinc-500">Métricas operacionais, curva ABC e auditoria de sistema</p>
          </div>
        </div>
        
        <div class="flex bg-zinc-200/50 p-1 rounded-xl">
          <button (click)="activeTab.set('GERAL')" [class.bg-white]="activeTab() === 'GERAL'" [class.shadow-sm]="activeTab() === 'GERAL'" class="px-4 py-2 rounded-lg text-xs font-semibold transition-all">Visão Geral</button>
          <button (click)="activeTab.set('AUDITORIA')" [class.bg-white]="activeTab() === 'AUDITORIA'" [class.shadow-sm]="activeTab() === 'AUDITORIA'" class="px-4 py-2 rounded-lg text-xs font-semibold transition-all">Auditoria & Sincronização</button>
        </div>
      </div>
      
      <div class="flex-1 overflow-y-auto pt-6">
        @if (activeTab() === 'GERAL') {
          <!-- KPI Summary -->
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <div class="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col justify-between">
              <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total de Vendas</span>
              <div class="text-2xl font-bold text-zinc-900 mt-2">{{ totalVendas() }}</div>
              <span class="text-[11px] text-zinc-400 mt-1">Cupons emitidos</span>
            </div>
            <div class="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col justify-between">
              <span class="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Faturamento Total</span>
              <div class="text-2xl font-bold text-emerald-700 mt-2">R$ {{ faturamentoTotal().toFixed(2) }}</div>
              <span class="text-[11px] text-zinc-400 mt-1">Volume bruto comercializado</span>
            </div>
            <div class="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col justify-between">
              <span class="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Ticket Médio</span>
              <div class="text-2xl font-bold text-indigo-700 mt-2">R$ {{ ticketMedio().toFixed(2) }}</div>
              <span class="text-[11px] text-zinc-400 mt-1">Média por atendimento</span>
            </div>
            <div class="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col justify-between">
              <span class="text-xs font-semibold text-purple-600 uppercase tracking-wider">Itens Vendidos</span>
              <div class="text-2xl font-bold text-purple-700 mt-2">{{ totalItensVendidos() }}</div>
              <span class="text-[11px] text-zinc-400 mt-1">Unidades movimentadas</span>
            </div>
          </div>

          <!-- Breakdown Bento Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
            
            <!-- Top Products List -->
            <div class="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm flex flex-col">
              <h2 class="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
                <mat-icon class="text-purple-600 text-sm">stars</mat-icon>
                Top Produtos Mais Vendidos (Curva ABC)
              </h2>
              <div class="space-y-4 overflow-y-auto flex-1 max-h-80 pr-2">
                @for (item of topProdutos(); track item.name; let i = $index) {
                  <div class="relative">
                    <div class="flex items-center justify-between mb-1 z-10 relative">
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-zinc-700 w-4">{{ i + 1 }}.</span>
                        <div class="text-xs font-semibold text-zinc-800">{{ item.name }}</div>
                      </div>
                      <div class="text-xs font-bold text-zinc-900">R$ {{ item.total.toFixed(2) }}</div>
                    </div>
                    <!-- Bar -->
                    <div class="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div class="h-full bg-purple-500 rounded-full" [style.width]="(item.total / (topProdutos()[0]?.total || 1) * 100) + '%'"></div>
                    </div>
                    <div class="text-[10px] text-zinc-400 mt-1">{{ item.qty }} unidades</div>
                  </div>
                } @empty {
                  <div class="p-6 text-center text-xs text-zinc-400">Nenhuma venda registrada ainda.</div>
                }
              </div>
            </div>

            <!-- Payment Methods Breakdown -->
            <div class="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm flex flex-col">
              <h2 class="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
                <mat-icon class="text-indigo-600 text-sm">pie_chart</mat-icon>
                Faturamento por Meio de Pagamento
              </h2>
              <div class="space-y-4 overflow-y-auto flex-1 max-h-80 pr-2">
                @for (p of pagamentosBreakdown(); track p.method) {
                  <div class="relative">
                    <div class="flex items-center justify-between mb-1 z-10 relative">
                      <div class="flex items-center gap-2">
                        <mat-icon class="text-xs text-indigo-500">{{ p.icon }}</mat-icon>
                        <div class="text-xs font-bold uppercase text-zinc-800">{{ p.method }}</div>
                      </div>
                      <div class="text-xs font-bold text-emerald-700">R$ {{ p.total.toFixed(2) }}</div>
                    </div>
                    <!-- Bar -->
                    <div class="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div class="h-full bg-indigo-500 rounded-full" [style.width]="p.percentage + '%'"></div>
                    </div>
                    <div class="text-[10px] text-zinc-400 mt-1 flex justify-between">
                      <span>{{ p.count }} transações</span>
                      <span>{{ p.percentage.toFixed(1) }}%</span>
                    </div>
                  </div>
                } @empty {
                  <div class="p-6 text-center text-xs text-zinc-400">Nenhum pagamento registrado ainda.</div>
                }
              </div>
            </div>
          </div>
        }
        
        @if (activeTab() === 'AUDITORIA') {
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-6">
            
            <!-- Sync Status -->
            <div class="lg:col-span-1 flex flex-col gap-6">
              <div class="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                <h2 class="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
                  <mat-icon class="text-sky-600 text-sm">cloud_sync</mat-icon>
                  Status de Sincronização
                </h2>
                
                <div class="space-y-4">
                  <div class="p-4 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-between">
                    <div>
                      <div class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Mutações Pendentes</div>
                      <div class="text-xl font-bold" [class.text-amber-600]="outboxStats().pending > 0" [class.text-emerald-600]="outboxStats().pending === 0">
                        {{ outboxStats().pending }}
                      </div>
                    </div>
                    <mat-icon [class.text-amber-500]="outboxStats().pending > 0" [class.text-emerald-500]="outboxStats().pending === 0">
                      {{ outboxStats().pending > 0 ? 'schedule' : 'check_circle' }}
                    </mat-icon>
                  </div>
                  
                  <div class="p-4 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-between">
                    <div>
                      <div class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Bloqueados/Conflitos</div>
                      <div class="text-xl font-bold" [class.text-rose-600]="outboxStats().blocked > 0" [class.text-zinc-400]="outboxStats().blocked === 0">
                        {{ outboxStats().blocked }}
                      </div>
                    </div>
                    <mat-icon [class.text-rose-500]="outboxStats().blocked > 0" [class.text-zinc-300]="outboxStats().blocked === 0">
                      warning
                    </mat-icon>
                  </div>
                  
                  <div class="p-4 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-between">
                    <div>
                      <div class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Sincronizados com Sucesso</div>
                      <div class="text-xl font-bold text-zinc-700">
                        {{ outboxStats().synced }}
                      </div>
                    </div>
                    <mat-icon class="text-sky-500">cloud_done</mat-icon>
                  </div>
                </div>
              </div>
            </div>

            <!-- Audit Logs -->
            <div class="lg:col-span-2 bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm flex flex-col">
              <h2 class="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
                <mat-icon class="text-zinc-600 text-sm">history</mat-icon>
                Log de Auditoria (Transações Recentes)
              </h2>
              <div class="flex-1 overflow-y-auto max-h-[500px] pr-2">
                <div class="relative border-l-2 border-zinc-100 ml-3 pl-5 space-y-6">
                  @for (log of auditLogs(); track log.id) {
                    <div class="relative">
                      <div class="absolute -left-[27px] w-3 h-3 rounded-full bg-white border-2 border-zinc-300"></div>
                      <div class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        {{ log.timestamp | date:'dd/MM/yyyy HH:mm:ss' }} &bull; {{ log.actor }}
                      </div>
                      <div class="bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                        <div class="text-xs font-bold text-zinc-800 mb-1 flex items-center gap-2">
                          <span class="px-2 py-0.5 rounded-md bg-zinc-200 text-[10px] text-zinc-700">{{ log.action }}</span>
                          <span class="text-zinc-500 text-[10px]">Alvo: {{ log.resource }}</span>
                        </div>
                        <div class="text-xs text-zinc-600">{{ log.details }}</div>
                      </div>
                    </div>
                  } @empty {
                    <div class="text-xs text-zinc-400 py-4">Nenhum evento registrado.</div>
                  }
                </div>
              </div>
            </div>
            
          </div>
        }
      </div>
    </div>
  `
})
export class RelatoriosComponent implements OnInit {
  private context = inject(AppContextService);
  activeTab = signal<'GERAL' | 'AUDITORIA'>('GERAL');
  
  totalVendas = signal(0);
  faturamentoTotal = signal(0);
  ticketMedio = signal(0);
  totalItensVendidos = signal(0);
  topProdutos = signal<{ name: string; qty: number; total: number }[]>([]);
  pagamentosBreakdown = signal<{ method: string; icon: string; count: number; total: number; percentage: number }[]>([]);
  
  auditLogs = signal<AuditLog[]>([]);
  outboxStats = signal<{pending: number, blocked: number, synced: number}>({pending: 0, blocked: 0, synced: 0});
 
  async ngOnInit() {
    await this.loadData();
  }
 
  async loadData() {
    const currentCompanyId = this.context.companyId();
    const sales = await db.sales.where('companyId').equals(currentCompanyId).and(s => s.status === 'COMPLETED').toArray();
    this.totalVendas.set(sales.length);
    const faturamento = sales.reduce((acc, s) => acc + s.total, 0);
    this.faturamentoTotal.set(faturamento);
    this.ticketMedio.set(sales.length > 0 ? faturamento / sales.length : 0);

    // Products breakdown
    const prodMap = new Map<string, { name: string; qty: number; total: number }>();
    let totalQty = 0;

    // Payment breakdown
    const payMap = new Map<string, { count: number; total: number }>();

    for (const sale of sales) {
      for (const item of sale.items) {
        totalQty += item.quantity;
        const current = prodMap.get(item.productName) || { name: item.productName, qty: 0, total: 0 };
        current.qty += item.quantity;
        current.total += item.totalPrice;
        prodMap.set(item.productName, current);
      }

      for (const pay of sale.payments) {
        const current = payMap.get(pay.method) || { count: 0, total: 0 };
        current.count += 1;
        current.total += pay.amount;
        payMap.set(pay.method, current);
      }
    }

    this.totalItensVendidos.set(totalQty);
    this.topProdutos.set(Array.from(prodMap.values()).sort((a, b) => b.total - a.total).slice(0, 10)); // Top 10

    const methodIcons: Record<string, string> = {
      dinheiro: 'payments',
      pix: 'qr_code_2',
      debito: 'credit_card',
      credito: 'credit_card',
      fiado: 'menu_book'
    };

    const breakdown = Array.from(payMap.entries()).map(([method, data]) => ({
      method,
      icon: methodIcons[method] || 'payments',
      count: data.count,
      total: data.total,
      percentage: faturamento > 0 ? (data.total / faturamento) * 100 : 0
    })).sort((a, b) => b.total - a.total);

    this.pagamentosBreakdown.set(breakdown);
    
    // Load Audit and Outbox stats
    const logs = await db.auditLogs.where('companyId').equals(currentCompanyId).reverse().limit(100).toArray();
    this.auditLogs.set(logs);
    
    const outboxMessages = await db.outbox.reverse().limit(200).toArray();
    this.outboxStats.set({
      pending: outboxMessages.filter(m => m.status === 'PENDING' || m.status === 'FAILED').length,
      blocked: outboxMessages.filter(m => m.status === 'BLOCKED').length,
      synced: outboxMessages.filter(m => m.status === 'SYNCED').length
    });
  }
}

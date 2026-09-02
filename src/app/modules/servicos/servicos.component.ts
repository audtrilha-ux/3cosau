import { Component, ChangeDetectionStrategy, signal, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { db } from '../../core/storage/dexie.db';
import { HelpdeskTicket, FinancialTransaction } from '../../core/models';
import { AppContextService } from '../../core/services/app-context.service';
import { TransactionEngine } from '../../core/workflow/transaction.engine';
import { IdGeneratorService } from '../../core/services/id-generator.service';

@Component({
  selector: 'app-servicos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col bg-zinc-50 text-zinc-800 p-4 space-y-4 overflow-hidden select-none">
      <!-- Top Header -->
      <div class="flex items-center justify-between pb-3 border-b border-zinc-200 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-lime-100 text-lime-800 flex items-center justify-center font-bold">
            <mat-icon>engineering</mat-icon>
          </div>
          <div>
            <h2 class="text-base font-bold text-zinc-900 leading-tight">Atendimento & Ordens de Serviço (OS)</h2>
            <p class="text-xs text-zinc-500">Gestão de chamados técnicos, peças aplicadas do estoque e faturamento</p>
          </div>
        </div>
        <button
          type="button"
          (click)="openModal()"
          class="px-4 py-2 bg-lime-600 hover:bg-lime-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <mat-icon class="text-sm">add</mat-icon>
          <span>Nova Ordem de Serviço</span>
        </button>
      </div>

      <!-- KPI Summary Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 shrink-0">
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Total de OS</div>
            <div class="text-lg font-black text-zinc-900 font-mono">{{ tickets().length }}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-600 flex items-center justify-center"><mat-icon class="text-base">confirmation_number</mat-icon></div>
        </div>
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Em Aberto</div>
            <div class="text-lg font-black text-amber-600 font-mono">{{ countStatus('ABERTO') }}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><mat-icon class="text-base">pending_actions</mat-icon></div>
        </div>
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Em Andamento</div>
            <div class="text-lg font-black text-blue-600 font-mono">{{ countStatus('EM_ANDAMENTO') }}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><mat-icon class="text-base">autorenew</mat-icon></div>
        </div>
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Resolvidas / Concluídas</div>
            <div class="text-lg font-black text-emerald-600 font-mono">{{ countStatus('RESOLVIDO') }}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><mat-icon class="text-base">check_circle</mat-icon></div>
        </div>
      </div>

      <!-- Tickets List -->
      <div class="flex-1 bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
        <div class="overflow-y-auto flex-1 p-3 space-y-2">
          @for (t of tickets(); track t.id) {
            <div class="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/50 hover:bg-zinc-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <strong class="font-mono text-xs text-zinc-900">#{{ t.id.substring(3, 8) }}</strong>
                  <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase"
                        [class.bg-rose-100]="t.priority === 'ALTA'"
                        [class.text-rose-800]="t.priority === 'ALTA'"
                        [class.bg-amber-100]="t.priority === 'MEDIA'"
                        [class.text-amber-800]="t.priority === 'MEDIA'"
                        [class.bg-zinc-200]="t.priority !== 'ALTA' && t.priority !== 'MEDIA'"
                        [class.text-zinc-700]="t.priority !== 'ALTA' && t.priority !== 'MEDIA'">
                    {{ t.priority }}
                  </span>
                  <span class="text-xs font-bold text-zinc-800">{{ t.client }}</span>
                  <span class="text-[10px] text-zinc-400 font-mono">{{ t.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                </div>
                <div class="text-xs font-semibold text-zinc-900">{{ t.subject }}</div>
                <div class="text-[11px] text-zinc-500 line-clamp-2">{{ t.description }}</div>
              </div>

              <div class="flex items-center gap-3 self-end sm:self-center shrink-0">
                @if (t.laborCost) {
                  <span class="font-mono font-bold text-xs text-emerald-700">R$ {{ t.laborCost.toFixed(2) }}</span>
                }
                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase"
                      [class.bg-emerald-100]="t.status === 'RESOLVIDO'"
                      [class.text-emerald-800]="t.status === 'RESOLVIDO'"
                      [class.bg-blue-100]="t.status === 'EM_ANDAMENTO'"
                      [class.text-blue-800]="t.status === 'EM_ANDAMENTO'"
                      [class.bg-amber-100]="t.status === 'ABERTO'"
                      [class.text-amber-800]="t.status === 'ABERTO'">
                  {{ t.status }}
                </span>

                @if (t.status === 'ABERTO') {
                  <button (click)="advance(t, 'EM_ANDAMENTO')" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs cursor-pointer">
                    Iniciar
                  </button>
                }
                @if (t.status === 'EM_ANDAMENTO') {
                  <button (click)="openCheckout(t)" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs cursor-pointer flex items-center gap-1">
                    <mat-icon class="text-xs">verified</mat-icon>
                    Concluir & Faturar
                  </button>
                }
                <button (click)="deleteTicket(t.id)" class="p-1 rounded-lg text-zinc-400 hover:text-rose-600 cursor-pointer">
                  <mat-icon class="text-sm">delete</mat-icon>
                </button>
              </div>
            </div>
          } @empty {
            <div class="py-16 text-center text-zinc-400">
              <mat-icon class="text-4xl mb-1 text-zinc-300">engineering</mat-icon>
              <p>Nenhuma Ordem de Serviço cadastrada.</p>
            </div>
          }
        </div>
      </div>

      <!-- Add Ticket Modal -->
      @if (showModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div class="bg-white border border-zinc-200 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 class="text-sm font-bold text-zinc-900">Nova Ordem de Serviço</h3>
              <button (click)="showModal.set(false)" class="text-zinc-400 hover:text-zinc-600">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <form [formGroup]="form" (ngSubmit)="saveTicket()" class="space-y-3 text-xs">
              <div>
                <label class="block font-semibold text-zinc-700 mb-1">Cliente / Solicitante *</label>
                <input type="text" formControlName="client" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900" placeholder="Nome do cliente" />
              </div>

              <div>
                <label class="block font-semibold text-zinc-700 mb-1">Assunto / Equipamento *</label>
                <input type="text" formControlName="subject" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900" placeholder="Ex: Manutenção de Máquina de Café" />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Prioridade</label>
                  <select formControlName="priority" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900">
                    <option value="BAIXA">Baixa</option>
                    <option value="MEDIA">Média</option>
                    <option value="ALTA">Alta</option>
                  </select>
                </div>
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Estimativa Mão de Obra (R$)</label>
                  <input type="number" step="10" formControlName="laborCost" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-mono" />
                </div>
              </div>

              <div>
                <label class="block font-semibold text-zinc-700 mb-1">Descrição / Diagnóstico Inicial</label>
                <textarea formControlName="description" rows="3" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 resize-none" placeholder="Defeito relatado, peças necessárias..."></textarea>
              </div>

              <div class="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
                <button type="button" (click)="showModal.set(false)" class="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold">Cancelar</button>
                <button type="submit" [disabled]="form.invalid" class="px-5 py-2 rounded-xl bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white font-bold shadow-md">Abrir Chamado</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class ServicosComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private fb = inject(FormBuilder);
  private context = inject(AppContextService);
  private txEngine = inject(TransactionEngine);
  private idGen = inject(IdGeneratorService);

  tickets = signal<HelpdeskTicket[]>([]);
  showModal = signal(false);

  countStatus = (st: HelpdeskTicket['status']) => this.tickets().filter(t => t.status === st).length;

  form = this.fb.group({
    client: ['', Validators.required],
    subject: ['', Validators.required],
    priority: ['MEDIA' as 'BAIXA' | 'MEDIA' | 'ALTA'],
    laborCost: [100.00],
    description: ['']
  });

  async ngOnInit() {
    await this.loadTickets();
  }

  async loadTickets() {
    if (!isPlatformBrowser(this.platformId)) return;
    const currentCompanyId = this.context.companyId();
    const list = await db.serviceOrders.where('companyId').equals(currentCompanyId).toArray();
    this.tickets.set(list.reverse());
  }

  openModal() {
    this.form.reset({
      client: '',
      subject: '',
      priority: 'MEDIA',
      laborCost: 100.00,
      description: ''
    });
    this.showModal.set(true);
  }

  async saveTicket() {
    if (this.form.invalid || !isPlatformBrowser(this.platformId)) return;
    const val = this.form.value;
    const now = Date.now();

    const newTicket: HelpdeskTicket = {
      id: this.idGen.generatePrefixedId('os'),
      companyId: this.context.companyId(),
      client: val.client!,
      subject: val.subject!,
      priority: val.priority || 'MEDIA',
      laborCost: Number(val.laborCost || 0),
      description: val.description || '',
      status: 'ABERTO',
      createdAt: now
    };

    await this.txEngine.saveEntity('serviceOrders', newTicket, 'CREATE');
    this.showModal.set(false);
    await this.loadTickets();
  }

  async advance(t: HelpdeskTicket, next: HelpdeskTicket['status']) {
    if (!isPlatformBrowser(this.platformId)) return;
    const updated = { ...t, status: next };
    await this.txEngine.saveEntity('serviceOrders', updated, 'UPDATE');
    await this.loadTickets();
  }

  async openCheckout(t: HelpdeskTicket) {
    if (!isPlatformBrowser(this.platformId)) return;

    const now = Date.now();
    // Record revenue in finance
    if (t.laborCost && t.laborCost > 0) {
      const finTx: FinancialTransaction = {
        id: this.idGen.generatePrefixedId('fin'),
        companyId: this.context.companyId(),
        type: 'RECEITA',
        category: 'Serviços & Mão de Obra',
        description: `Receita OS #${t.id.substring(3, 8)} - ${t.subject} (${t.client})`,
        amount: t.laborCost,
        status: 'PAGO',
        dueDate: now,
        paymentDate: now,
        paymentMethod: 'PIX / Dinheiro'
      };
      await this.txEngine.saveEntity('financialTransactions', finTx, 'CREATE');
    }

    const updated = { ...t, status: 'RESOLVIDO' as const };
    await this.txEngine.saveEntity('serviceOrders', updated, 'UPDATE');
    await this.loadTickets();
  }

  async deleteTicket(id: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    await this.txEngine.deleteEntity('serviceOrders', id);
    await this.loadTickets();
  }
}

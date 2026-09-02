import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { db } from '../../core/storage/dexie.db';
import { ContractedService, Supplier, FinancialTransaction } from '../../core/models';
import { AppContextService } from '../../core/services/app-context.service';
import { TransactionEngine } from '../../core/workflow/transaction.engine';
import { IdGeneratorService } from '../../core/services/id-generator.service';

@Component({
  selector: 'app-servicos-contratados',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col bg-zinc-50 text-zinc-800 p-4 space-y-4 overflow-hidden select-none font-sans">
      <!-- Top Header -->
      <div class="flex items-center justify-between pb-3 border-b border-zinc-200 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
            <mat-icon>handshake</mat-icon>
          </div>
          <div>
            <h2 class="text-base font-bold text-zinc-900 leading-tight">Serviços Contratados & Despesas Fixas</h2>
            <p class="text-xs text-zinc-500">Gestão de assinaturas SaaS, aluguel, consultorias e contratos terceirizados</p>
          </div>
        </div>
        <button
          type="button"
          (click)="openModal()"
          class="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <mat-icon class="text-sm">add</mat-icon>
          <span>Contratar Novo Serviço</span>
        </button>
      </div>

      <!-- Feedback Banner -->
      @if (feedbackMsg()) {
        <div class="px-4 py-2.5 bg-orange-50 border border-orange-200 text-orange-900 rounded-xl text-xs font-bold flex items-center justify-between animate-fade-in shrink-0">
          <div class="flex items-center gap-2">
            <mat-icon class="text-orange-600 text-base">info</mat-icon>
            <span>{{ feedbackMsg() }}</span>
          </div>
          <button (click)="feedbackMsg.set('')" class="text-orange-700 hover:text-orange-900 cursor-pointer">
            <mat-icon class="text-xs">close</mat-icon>
          </button>
        </div>
      }

      <!-- KPI Summary Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Total de Contratos</div>
            <div class="text-lg font-black text-zinc-900 font-mono">{{ services().length }}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-600 flex items-center justify-center"><mat-icon class="text-base">handshake</mat-icon></div>
        </div>
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Contas Pendentes</div>
            <div class="text-lg font-black text-rose-600 font-mono">{{ pending().length }}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center"><mat-icon class="text-base">payments</mat-icon></div>
        </div>
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Comprometimento Mensal</div>
            <div class="text-lg font-black text-orange-600 font-mono">R$ {{ totalCost().toFixed(2) }}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center"><mat-icon class="text-base">account_balance_wallet</mat-icon></div>
        </div>
      </div>

      <!-- Services List -->
      <div class="flex-1 bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-0">
        <div class="overflow-y-auto flex-1 p-3 space-y-2">
          @for (s of services(); track s.id) {
            <div class="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/50 hover:bg-zinc-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded bg-orange-100 text-orange-800 text-[10px] font-bold">{{ s.category }}</span>
                  <span class="text-xs font-bold text-zinc-900">{{ s.supplierName }}</span>
                  <span class="text-[10px] text-zinc-400 font-mono">Periodicidade: {{ s.periodicity }}</span>
                </div>
                <div class="text-xs font-semibold text-zinc-800">{{ s.description }}</div>
                <div class="text-[10px] text-zinc-500">Vencimento: {{ s.dueDate | date:'dd/MM/yyyy' }}</div>
              </div>

              <div class="flex items-center gap-3 self-end sm:self-center shrink-0">
                <span class="font-mono font-black text-sm text-rose-700">R$ {{ s.cost.toFixed(2) }}</span>
                <span
                  class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase"
                  [class.bg-emerald-100]="s.status === 'PAGO'"
                  [class.text-emerald-800]="s.status === 'PAGO'"
                  [class.bg-rose-100]="s.status !== 'PAGO'"
                  [class.text-rose-800]="s.status !== 'PAGO'"
                >
                  {{ s.status }}
                </span>

                @if (s.status === 'PENDENTE') {
                  <button (click)="payService(s)" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs cursor-pointer flex items-center gap-1 shadow-xs">
                    <mat-icon class="text-xs">paid</mat-icon>
                    Quitar no Caixa
                  </button>
                }
                <button (click)="deleteService(s.id)" class="p-1 rounded-lg text-zinc-400 hover:text-rose-600 cursor-pointer">
                  <mat-icon class="text-sm">delete</mat-icon>
                </button>
              </div>
            </div>
          } @empty {
            <div class="py-16 text-center text-zinc-400">
              <mat-icon class="text-4xl mb-1 text-zinc-300">handshake</mat-icon>
              <p>Nenhum serviço contratado cadastrado.</p>
            </div>
          }
        </div>
      </div>

      <!-- Add Contracted Service Modal -->
      @if (showModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div class="bg-white border border-zinc-200 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 class="text-sm font-bold text-zinc-900">Novo Contrato de Serviço</h3>
              <button (click)="showModal.set(false)" class="text-zinc-400 hover:text-zinc-600">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <form [formGroup]="form" (ngSubmit)="save()" class="space-y-3 text-xs">
              <div>
                <label class="block font-semibold text-zinc-700 mb-1">Fornecedor / Prestador *</label>
                <select formControlName="supplierId" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900">
                  @for (sup of suppliers(); track sup.id) {
                    <option [value]="sup.id">{{ sup.name }}</option>
                  }
                </select>
              </div>

              <div>
                <label class="block font-semibold text-zinc-700 mb-1">Descrição do Serviço *</label>
                <input type="text" formControlName="description" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900" placeholder="Ex: Software ERP, Link de Internet, Aluguel" />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Valor (R$) *</label>
                  <input type="number" step="10" formControlName="cost" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-mono" />
                </div>
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Periodicidade</label>
                  <select formControlName="periodicity" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900">
                    <option value="Mensal">Mensal</option>
                    <option value="Único">Único</option>
                    <option value="Anual">Anual</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block font-semibold text-zinc-700 mb-1">Categoria Contábil</label>
                <select formControlName="category" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900">
                  <option value="Tecnologia & SaaS">Tecnologia & SaaS</option>
                  <option value="Contabilidade & Jurídico">Contabilidade & Jurídico</option>
                  <option value="Marketing & Tráfego">Marketing & Tráfego</option>
                  <option value="Infraestrutura & Aluguel">Infraestrutura & Aluguel</option>
                  <option value="Limpeza & Conservação">Limpeza & Conservação</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div class="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
                <button type="button" (click)="showModal.set(false)" class="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold cursor-pointer">Cancelar</button>
                <button type="submit" [disabled]="form.invalid" class="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold shadow-xs cursor-pointer">Salvar Contrato</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class ServicosContratadosComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private fb = inject(FormBuilder);
  private context = inject(AppContextService);
  private txEngine = inject(TransactionEngine);
  private idGen = inject(IdGeneratorService);

  services = signal<ContractedService[]>([]);
  suppliers = signal<Supplier[]>([]);
  showModal = signal(false);
  feedbackMsg = signal('');

  pending = computed(() => this.services().filter(s => s.status === 'PENDENTE'));
  totalCost = computed(() => this.services().reduce((acc, s) => acc + s.cost, 0));

  form = this.fb.group({
    supplierId: ['', Validators.required],
    description: ['', Validators.required],
    cost: [150.00, [Validators.required, Validators.min(1)]],
    periodicity: ['Mensal' as 'Mensal' | 'Único' | 'Anual'],
    category: ['Tecnologia & SaaS']
  });

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    if (!isPlatformBrowser(this.platformId)) return;
    const currentCompanyId = this.context.companyId();
    const [srvList, supList] = await Promise.all([
      db.contractedServices.where('companyId').equals(currentCompanyId).toArray(),
      db.suppliers.where('companyId').equals(currentCompanyId).toArray()
    ]);
    this.services.set(srvList.reverse());
    this.suppliers.set(supList);
    if (supList.length > 0) this.form.patchValue({ supplierId: supList[0].id });
  }

  openModal() {
    this.form.reset({
      supplierId: this.suppliers()[0]?.id || '',
      description: '',
      cost: 150.00,
      periodicity: 'Mensal',
      category: 'Tecnologia & SaaS'
    });
    this.showModal.set(true);
  }

  async save() {
    if (this.form.invalid || !isPlatformBrowser(this.platformId)) return;
    const val = this.form.value;
    const sup = this.suppliers().find(s => s.id === val.supplierId);
    const now = Date.now();

    const newCs: ContractedService = {
      id: this.idGen.generatePrefixedId('cs'),
      companyId: this.context.companyId(),
      supplierId: val.supplierId!,
      supplierName: sup ? sup.name : 'Fornecedor Geral',
      description: val.description!,
      cost: Number(val.cost || 0),
      dueDate: now + 86400000 * 15,
      periodicity: val.periodicity || 'Mensal',
      category: val.category || 'Tecnologia & SaaS',
      status: 'PENDENTE',
      createdAt: now
    };

    await this.txEngine.saveEntity('contractedServices', newCs, 'CREATE');
    this.showModal.set(false);
    this.feedbackMsg.set(`Contrato "${newCs.description}" registrado com sucesso!`);
    await this.loadData();
  }

  async payService(cs: ContractedService) {
    if (!isPlatformBrowser(this.platformId)) return;

    const now = Date.now();
    // Record expense in financial ledger
    const finTx: FinancialTransaction = {
      id: this.idGen.generatePrefixedId('fin'),
      companyId: this.context.companyId(),
      type: 'DESPESA',
      category: cs.category,
      description: `Pgto Serviço Contratado - ${cs.description} (${cs.supplierName})`,
      amount: cs.cost,
      status: 'PAGO',
      dueDate: cs.dueDate,
      paymentDate: now,
      paymentMethod: 'PIX / Transferência'
    };
    await this.txEngine.saveEntity('financialTransactions', finTx, 'CREATE');

    const updated = { ...cs, status: 'PAGO' as const, paidDate: now };
    await this.txEngine.saveEntity('contractedServices', updated, 'UPDATE');
    this.feedbackMsg.set(`Pagamento de R$ ${cs.cost.toFixed(2)} registrado com sucesso no Caixa!`);
    await this.loadData();
  }

  async deleteService(id: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    await this.txEngine.deleteEntity('contractedServices', id);
    this.feedbackMsg.set('Serviço contratado removido.');
    await this.loadData();
  }
}

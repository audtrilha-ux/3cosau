import { Component, OnInit, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { db } from '../../core/storage/dexie.db';
import { AppContextService } from '../../core/services/app-context.service';
import { IdGeneratorService } from '../../core/services/id-generator.service';
import { FinancialTransaction } from '../../core/models';
import { TransactionEngine } from '../../core/workflow/transaction.engine';

@Component({
  selector: 'app-financeiro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col bg-zinc-50 text-zinc-900 font-sans p-6 overflow-y-auto">
      
      <!-- Top Bar -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
            <mat-icon class="scale-125">account_balance</mat-icon>
          </div>
          <div>
            <h1 class="text-xl font-bold tracking-tight">Módulo Financeiro & DRE</h1>
            <p class="text-xs text-zinc-500">Fluxo de caixa, contas a pagar, contas a receber e conciliação</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button (click)="openNovoLancamentoModal()" class="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition shadow-sm cursor-pointer">
            <mat-icon class="text-sm">add</mat-icon>
            Lançar Conta / Despesa
          </button>
        </div>
      </div>

      <!-- Financial Metric Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 my-6">
        <div class="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col justify-between">
          <span class="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Receitas (Vendas PDV)</span>
          <div class="text-2xl font-bold text-emerald-700 mt-2">R$ {{ totalReceitas().toFixed(2) }}</div>
          <span class="text-[11px] text-zinc-400 mt-1">Faturamento bruto registrado</span>
        </div>

        <div class="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col justify-between">
          <span class="text-xs font-semibold text-rose-600 uppercase tracking-wider">Despesas / Contas Pagas</span>
          <div class="text-2xl font-bold text-rose-700 mt-2">R$ {{ totalDespesas().toFixed(2) }}</div>
          <span class="text-[11px] text-zinc-400 mt-1">Fornecedores, aluguel e custos</span>
        </div>

        <div class="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col justify-between">
          <span class="text-xs font-semibold text-amber-600 uppercase tracking-wider">Contas Pendentes (A Pagar)</span>
          <div class="text-2xl font-bold text-amber-700 mt-2">R$ {{ totalPendentes().toFixed(2) }}</div>
          <span class="text-[11px] text-zinc-400 mt-1">Previsão de saída</span>
        </div>

        <div class="p-5 rounded-2xl bg-indigo-50 border border-indigo-200 shadow-sm flex flex-col justify-between">
          <span class="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Resultado Líquido / Saldo</span>
          <div class="text-2xl font-bold text-indigo-900 mt-2">R$ {{ resultadoLiquido().toFixed(2) }}</div>
          <span class="text-[11px] text-indigo-500 mt-1">Receitas menos despesas pagas</span>
        </div>
      </div>

      <!-- Transactions List -->
      <div class="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm flex-1 mb-6">
        <div class="p-4 border-b border-zinc-200 flex items-center justify-between">
          <h2 class="text-sm font-bold text-zinc-800 flex items-center gap-2">
            <mat-icon class="text-zinc-500 text-sm">swap_horiz</mat-icon>
            Livro de Lançamentos Financeiros
          </h2>
        </div>

        <table class="w-full text-left text-sm">
          <thead class="bg-zinc-50 text-zinc-500 text-xs uppercase font-semibold border-b border-zinc-200">
            <tr>
              <th class="py-3 px-4">Vencimento</th>
              <th class="py-3 px-4">Tipo</th>
              <th class="py-3 px-4">Descrição</th>
              <th class="py-3 px-4">Categoria</th>
              <th class="py-3 px-4 text-center">Status</th>
              <th class="py-3 px-4 text-right">Valor</th>
              <th class="py-3 px-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-100">
            @for (t of transactions(); track t.id) {
              <tr class="hover:bg-zinc-50/80 transition">
                <td class="py-3 px-4 text-xs font-mono text-zinc-500">{{ formatDate(t.dueDate) }}</td>
                <td class="py-3 px-4">
                  <span class="px-2 py-0.5 rounded-full text-xs font-semibold"
                        [class.bg-emerald-100]="t.type === 'RECEITA'"
                        [class.text-emerald-800]="t.type === 'RECEITA'"
                        [class.bg-rose-100]="t.type !== 'RECEITA'"
                        [class.text-rose-800]="t.type !== 'RECEITA'">
                    {{ t.type }}
                  </span>
                </td>
                <td class="py-3 px-4 font-semibold text-zinc-900">{{ t.description }}</td>
                <td class="py-3 px-4 text-xs text-zinc-500">{{ t.category }}</td>
                <td class="py-3 px-4 text-center">
                  <span class="px-2 py-0.5 rounded-full text-xs font-bold"
                        [class.bg-emerald-100]="t.status === 'PAGO'"
                        [class.text-emerald-800]="t.status === 'PAGO'"
                        [class.bg-amber-100]="t.status !== 'PAGO'"
                        [class.text-amber-800]="t.status !== 'PAGO'">
                    {{ t.status }}
                  </span>
                </td>
                <td class="py-3 px-4 text-right font-bold"
                    [class.text-emerald-600]="t.type === 'RECEITA'"
                    [class.text-rose-600]="t.type !== 'RECEITA'">
                  {{ t.type === 'RECEITA' ? '+' : '-' }} R$ {{ t.amount.toFixed(2) }}
                </td>
                <td class="py-3 px-4 text-center">
                  @if (t.status === 'PENDENTE') {
                    <button (click)="baixarTitulo(t)" class="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition cursor-pointer">
                      Baixar
                    </button>
                  } @else {
                    <mat-icon class="text-emerald-500 text-sm">check</mat-icon>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Modal: Novo Lançamento Financeiro -->
      @if (novoModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div class="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 border border-zinc-200">
            <h3 class="text-lg font-bold text-zinc-900 mb-1">Lançamento Financeiro</h3>
            <p class="text-xs text-zinc-500 mb-4">Registre uma conta a pagar ou despesa operacional.</p>

            <form [formGroup]="formLancamento" (ngSubmit)="salvarLancamento()">
              <div class="space-y-3 mb-6">
                <div>
                  <label class="block text-xs font-semibold text-zinc-700 mb-1">Tipo</label>
                  <select formControlName="type" class="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm bg-white">
                    <option value="DESPESA">Despesa (Saída / A Pagar)</option>
                    <option value="RECEITA">Receita (Entrada / A Receber)</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-semibold text-zinc-700 mb-1">Descrição</label>
                  <input type="text" formControlName="description" placeholder="Ex: Fornecedor de Bebidas, Aluguel..." class="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-zinc-700 mb-1">Categoria</label>
                  <input type="text" formControlName="category" placeholder="Ex: Mercadorias, Custos Fixos..." class="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-zinc-700 mb-1">Valor (R$)</label>
                  <input type="number" step="0.01" formControlName="amount" class="w-full px-3 py-2 border border-zinc-300 rounded-xl text-base font-bold focus:ring-2 focus:ring-rose-500 outline-none" />
                </div>
              </div>

              <div class="flex items-center justify-end gap-2">
                <button type="button" (click)="novoModal.set(false)" class="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer">Cancelar</button>
                <button type="submit" [disabled]="formLancamento.invalid" class="px-5 py-2.5 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition cursor-pointer disabled:opacity-50 shadow-md">Salvar Lançamento</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class FinanceiroComponent implements OnInit {
  private fb = inject(FormBuilder);
  private context = inject(AppContextService);
  private txEngine = inject(TransactionEngine);
  private idGen = inject(IdGeneratorService);

  transactions = signal<FinancialTransaction[]>([]);
  totalReceitas = signal(0);
  totalDespesas = signal(0);
  totalPendentes = signal(0);
  resultadoLiquido = signal(0);

  novoModal = signal(false);

  formLancamento = this.fb.group({
    type: ['DESPESA', Validators.required],
    description: ['', Validators.required],
    category: ['Operacional', Validators.required],
    amount: [150.00, [Validators.required, Validators.min(0.01)]]
  });

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    const currentCompanyId = this.context.companyId();
    // 1. Sales revenue
    const sales = await db.sales.where('companyId').equals(currentCompanyId).toArray();
    const completedSales = sales.filter(s => s.status === 'COMPLETED');
    const salesRevenue = completedSales.reduce((acc, s) => acc + s.total, 0);

    // 2. Financial transactions
    const list = await db.financialTransactions.where('companyId').equals(currentCompanyId).toArray();
    this.transactions.set(list);

    const paidExpenses = list.filter(t => t.type === 'DESPESA' && t.status === 'PAGO').reduce((acc, t) => acc + t.amount, 0);
    const pendingExpenses = list.filter(t => t.type === 'DESPESA' && t.status === 'PENDENTE').reduce((acc, t) => acc + t.amount, 0);

    this.totalReceitas.set(salesRevenue);
    this.totalDespesas.set(paidExpenses);
    this.totalPendentes.set(pendingExpenses);
    this.resultadoLiquido.set(salesRevenue - paidExpenses);
  }

  openNovoLancamentoModal() {
    this.formLancamento.reset({
      type: 'DESPESA',
      description: '',
      category: 'Operacional',
      amount: 100.00
    });
    this.novoModal.set(true);
  }

  async salvarLancamento() {
    if (this.formLancamento.invalid) return;
    const v = this.formLancamento.value;
    const t: FinancialTransaction = {
      id: this.idGen.generatePrefixedId('fin'),
      companyId: this.context.companyId(),
      type: (v.type as any) || 'DESPESA',
      category: v.category || 'Geral',
      description: v.description || '',
      amount: Number(v.amount),
      status: 'PENDENTE',
      dueDate: Date.now() + 86400000 * 7
    };

    await this.txEngine.saveEntity('financialTransactions', t, 'CREATE');
    this.novoModal.set(false);
    await this.loadData();
  }

  async baixarTitulo(t: FinancialTransaction) {
    t.status = 'PAGO';
    t.paymentDate = Date.now();
    await this.txEngine.saveEntity('financialTransactions', t, 'UPDATE');
    await this.loadData();
  }

  formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString('pt-BR');
  }
}

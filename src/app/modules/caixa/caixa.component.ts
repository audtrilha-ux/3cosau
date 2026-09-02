import { Component, OnInit, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { db } from '../../core/storage/dexie.db';
import { TransactionEngine } from '../../core/workflow/transaction.engine';
import { EscPosService } from '../../core/services/escpos.service';
import { AppContextService } from '../../core/services/app-context.service';
import { CashSession } from '../../core/models';

@Component({
  selector: 'app-caixa',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col bg-zinc-50 text-zinc-900 font-sans p-6 overflow-y-auto">
      
      <!-- Top header bar -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <mat-icon class="scale-125">payments</mat-icon>
          </div>
          <div>
            <h1 class="text-xl font-bold tracking-tight">Controle e Fluxo de Caixa</h1>
            <p class="text-xs text-zinc-500">Gestão de turnos, suprimentos, sangrias e conciliação cega</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          @if (activeSession()) {
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              TURNO ABERTO
            </span>
            <button (click)="imprimirLeituraX()" class="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-300 rounded-xl hover:bg-zinc-100 transition shadow-sm cursor-pointer">
              <mat-icon class="text-sm">receipt_long</mat-icon>
              Leitura X
            </button>
            <button (click)="modalFechamento.set(true)" class="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition shadow-sm cursor-pointer">
              <mat-icon class="text-sm">lock</mat-icon>
              Fechar Caixa
            </button>
          } @else {
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-200 text-zinc-700">
              CAIXA FECHADO
            </span>
            <button (click)="modalAbertura.set(true)" class="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition shadow-sm cursor-pointer">
              <mat-icon class="text-sm">play_arrow</mat-icon>
              Abrir Novo Turno
            </button>
          }
        </div>
      </div>

      <!-- Main Overview Cards -->
      @if (activeSession(); as session) {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
          <div class="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col justify-between">
            <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Fundo de Abertura</span>
            <div class="text-2xl font-bold text-zinc-800 mt-2">R$ {{ session.initialCash.toFixed(2) }}</div>
            <span class="text-[11px] text-zinc-400 mt-1">Aberto às {{ formatTime(session.openedAt) }}</span>
          </div>

          <div class="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col justify-between">
            <span class="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Entradas / Vendas</span>
            <div class="text-2xl font-bold text-emerald-700 mt-2">+ R$ {{ totalEntradas().toFixed(2) }}</div>
            <span class="text-[11px] text-zinc-400 mt-1">Vendas e suprimentos</span>
          </div>

          <div class="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col justify-between">
            <span class="text-xs font-semibold text-rose-600 uppercase tracking-wider">Sangrias / Retiradas</span>
            <div class="text-2xl font-bold text-rose-700 mt-2">- R$ {{ totalSangrias().toFixed(2) }}</div>
            <span class="text-[11px] text-zinc-400 mt-1">Despesas e pagamentos</span>
          </div>

          <div class="p-5 rounded-2xl bg-indigo-50 border border-indigo-200 shadow-sm flex flex-col justify-between">
            <span class="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Saldo em Gaveta Atual</span>
            <div class="text-2xl font-bold text-indigo-900 mt-2">R$ {{ saldoCalculado().toFixed(2) }}</div>
            <span class="text-[11px] text-indigo-500 mt-1">Total em espécie calculado</span>
          </div>
        </div>

        <!-- Action buttons row -->
        <div class="flex items-center gap-3 mb-6">
          <button (click)="openMovModal('SUPRIMENTO')" class="flex items-center gap-2 px-4 py-2.5 bg-white border border-emerald-300 text-emerald-800 rounded-xl hover:bg-emerald-50 text-sm font-semibold transition cursor-pointer shadow-sm">
            <mat-icon class="text-emerald-600">add_circle</mat-icon>
            Lançar Suprimento (Entrada)
          </button>
          <button (click)="openMovModal('SANGRIA')" class="flex items-center gap-2 px-4 py-2.5 bg-white border border-rose-300 text-rose-800 rounded-xl hover:bg-rose-50 text-sm font-semibold transition cursor-pointer shadow-sm">
            <mat-icon class="text-rose-600">remove_circle</mat-icon>
            Lançar Sangria (Retirada)
          </button>
        </div>

        <!-- Movements Ledger -->
        <div class="flex-1 bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <h2 class="text-base font-bold text-zinc-800 mb-4 flex items-center gap-2">
            <mat-icon class="text-zinc-500">receipt</mat-icon>
            Extrato de Movimentações do Turno
          </h2>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-zinc-50 text-zinc-500 text-xs uppercase font-semibold border-b border-zinc-200">
                <tr>
                  <th class="py-3 px-4">Hora</th>
                  <th class="py-3 px-4">Tipo</th>
                  <th class="py-3 px-4">Descrição / Motivo</th>
                  <th class="py-3 px-4">Operador</th>
                  <th class="py-3 px-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-100">
                @for (mov of session.movements; track mov.id) {
                  <tr class="hover:bg-zinc-50/80 transition">
                    <td class="py-3 px-4 text-xs font-mono text-zinc-500">{{ formatTime(mov.timestamp) }}</td>
                    <td class="py-3 px-4">
                      @if (mov.type === 'ABERTURA') {
                        <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800">Abertura</span>
                      } @else if (mov.type === 'SUPRIMENTO') {
                        <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">+ Suprimento</span>
                      } @else if (mov.type === 'VENDA') {
                        <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Venda PDV</span>
                      } @else if (mov.type === 'PAGAMENTO_FIADO') {
                        <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">Rec. Fiado</span>
                      } @else {
                        <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">- Sangria</span>
                      }
                    </td>
                    <td class="py-3 px-4 font-medium text-zinc-700">{{ mov.reason }}</td>
                    <td class="py-3 px-4 text-xs text-zinc-500">{{ mov.operatorName }}</td>
                    <td class="py-3 px-4 text-right font-bold" [class.text-rose-600]="mov.type === 'SANGRIA'" [class.text-emerald-600]="mov.type !== 'SANGRIA'">
                      {{ mov.type === 'SANGRIA' ? '-' : '+' }} R$ {{ mov.amount.toFixed(2) }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else {
        <!-- No open session empty state -->
        <div class="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white border border-zinc-200 rounded-3xl my-6">
          <div class="w-16 h-16 rounded-3xl bg-zinc-100 flex items-center justify-center text-zinc-400 mb-4">
            <mat-icon class="scale-150">point_of_sale</mat-icon>
          </div>
          <h2 class="text-xl font-bold text-zinc-800 mb-2">O Caixa está fechado</h2>
          <p class="text-sm text-zinc-500 max-w-md mb-6">Para iniciar as vendas no PDV e registrar movimentações em dinheiro, faça a abertura do turno com o valor inicial da gaveta.</p>
          <button (click)="modalAbertura.set(true)" class="px-6 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-2xl hover:bg-indigo-700 transition shadow-md cursor-pointer flex items-center gap-2">
            <mat-icon>play_arrow</mat-icon>
            Iniciar Abertura de Caixa
          </button>
        </div>
      }

      <!-- Modal: Abertura de Caixa -->
      @if (modalAbertura()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div class="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 border border-zinc-200 animate-in fade-in zoom-in duration-150">
            <h3 class="text-lg font-bold text-zinc-900 mb-2">Abertura de Turno</h3>
            <p class="text-xs text-zinc-500 mb-4">Informe o valor inicial do fundo de troco presente na gaveta.</p>

            <form [formGroup]="formAbertura" (ngSubmit)="confirmarAbertura()">
              <div class="mb-4">
                <label class="block text-xs font-semibold text-zinc-700 mb-1">Fundo de Troco Inicial (R$)</label>
                <input type="number" step="0.01" formControlName="initialCash" class="w-full px-4 py-3 border border-zinc-300 rounded-xl text-lg font-bold focus:ring-2 focus:ring-indigo-500 outline-none" autofocus />
              </div>
              <div class="mb-6">
                <label class="block text-xs font-semibold text-zinc-700 mb-1">Nome do Operador</label>
                <input type="text" formControlName="operatorName" class="w-full px-4 py-2.5 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div class="flex items-center justify-end gap-2">
                <button type="button" (click)="modalAbertura.set(false)" class="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer">Cancelar</button>
                <button type="submit" [disabled]="formAbertura.invalid" class="px-5 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50">Confirmar Abertura</button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Modal: Movimento (Suprimento / Sangria) -->
      @if (modalMov()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div class="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 border border-zinc-200">
            <h3 class="text-lg font-bold text-zinc-900 mb-2">
              {{ movType() === 'SUPRIMENTO' ? 'Lançar Suprimento (Entrada)' : 'Lançar Sangria (Retirada)' }}
            </h3>
            <p class="text-xs text-zinc-500 mb-4">Registro auditado no livro de caixa.</p>

            <form [formGroup]="formMov" (ngSubmit)="confirmarMovimento()">
              <div class="mb-4">
                <label class="block text-xs font-semibold text-zinc-700 mb-1">Valor da Operação (R$)</label>
                <input type="number" step="0.01" formControlName="amount" class="w-full px-4 py-3 border border-zinc-300 rounded-xl text-lg font-bold focus:ring-2 focus:ring-indigo-500 outline-none" autofocus />
              </div>
              <div class="mb-6">
                <label class="block text-xs font-semibold text-zinc-700 mb-1">Motivo / Justificativa</label>
                <input type="text" formControlName="reason" placeholder="Ex: Pagamento fornecedor, troco extra..." class="w-full px-4 py-2.5 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div class="flex items-center justify-end gap-2">
                <button type="button" (click)="modalMov.set(false)" class="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer">Cancelar</button>
                <button type="submit" [disabled]="formMov.invalid" class="px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50">Lançar Movimento</button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Modal: Fechamento de Caixa Cego com Denominações -->
      @if (modalFechamento()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div class="bg-white rounded-3xl shadow-xl w-full max-w-lg p-6 border border-zinc-200 max-h-[90vh] overflow-y-auto">
            <h3 class="text-lg font-bold text-zinc-900 mb-1">Fechamento Cego de Caixa</h3>
            <p class="text-xs text-zinc-500 mb-4">Faça a contagem física das cédulas e moedas na gaveta.</p>

            <form [formGroup]="formFechamento" (ngSubmit)="confirmarFechamento()">
              <div class="grid grid-cols-2 gap-3 p-3 bg-zinc-50 rounded-2xl border border-zinc-200 mb-4">
                <div>
                  <label class="text-[11px] font-semibold text-zinc-500">Notas de R$ 100</label>
                  <input type="number" formControlName="n100" (input)="recalcFechamentoTotal()" class="w-full mt-1 p-2 bg-white border border-zinc-200 rounded-lg text-sm font-semibold" />
                </div>
                <div>
                  <label class="text-[11px] font-semibold text-zinc-500">Notas de R$ 50</label>
                  <input type="number" formControlName="n50" (input)="recalcFechamentoTotal()" class="w-full mt-1 p-2 bg-white border border-zinc-200 rounded-lg text-sm font-semibold" />
                </div>
                <div>
                  <label class="text-[11px] font-semibold text-zinc-500">Notas de R$ 20</label>
                  <input type="number" formControlName="n20" (input)="recalcFechamentoTotal()" class="w-full mt-1 p-2 bg-white border border-zinc-200 rounded-lg text-sm font-semibold" />
                </div>
                <div>
                  <label class="text-[11px] font-semibold text-zinc-500">Notas de R$ 10</label>
                  <input type="number" formControlName="n10" (input)="recalcFechamentoTotal()" class="w-full mt-1 p-2 bg-white border border-zinc-200 rounded-lg text-sm font-semibold" />
                </div>
                <div>
                  <label class="text-[11px] font-semibold text-zinc-500">Notas de R$ 5 / R$ 2</label>
                  <input type="number" formControlName="nOther" (input)="recalcFechamentoTotal()" class="w-full mt-1 p-2 bg-white border border-zinc-200 rounded-lg text-sm font-semibold" />
                </div>
                <div>
                  <label class="text-[11px] font-semibold text-zinc-500">Total em Moedas (R$)</label>
                  <input type="number" step="0.05" formControlName="coins" (input)="recalcFechamentoTotal()" class="w-full mt-1 p-2 bg-white border border-zinc-200 rounded-lg text-sm font-semibold" />
                </div>
              </div>

              <div class="mb-6 p-4 rounded-xl bg-zinc-900 text-white flex items-center justify-between">
                <span class="text-xs font-semibold text-zinc-400">Total Declarado:</span>
                <span class="text-xl font-bold text-emerald-400">R$ {{ valorDeclarado().toFixed(2) }}</span>
              </div>

              <div class="flex items-center justify-end gap-2">
                <button type="button" (click)="modalFechamento.set(false)" class="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer">Cancelar</button>
                <button type="submit" class="px-5 py-2.5 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition cursor-pointer shadow-md">Encerrar Turno e Imprimir Z</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class CaixaComponent implements OnInit {
  isSubmitting = signal(false);
  toastError = signal('');
  private engine = inject(TransactionEngine);
  private printer = inject(EscPosService);
  private fb = inject(FormBuilder);
  private context = inject(AppContextService);

  activeSession = signal<CashSession | null>(null);
  totalEntradas = signal(0);
  totalSangrias = signal(0);
  saldoCalculado = signal(0);

  modalAbertura = signal(false);
  modalMov = signal(false);
  modalFechamento = signal(false);
  movType = signal<'SUPRIMENTO' | 'SANGRIA'>('SUPRIMENTO');
  valorDeclarado = signal(0);

  formAbertura = this.fb.group({
    initialCash: [150.00, [Validators.required, Validators.min(0)]],
    operatorName: ['Operador Padrão', Validators.required]
  });

  formMov = this.fb.group({
    amount: [50.00, [Validators.required, Validators.min(0.01)]],
    reason: ['', Validators.required]
  });

  formFechamento = this.fb.group({
    n100: [0],
    n50: [0],
    n20: [0],
    n10: [0],
    nOther: [0],
    coins: [0]
  });

  async ngOnInit() {
    await this.loadSession();
  }

  async loadSession() {
    const compId = this.context.companyId();
    const locId = this.context.locationId();
    const session = await db.cashSessions
      .filter(s => s.status === 'OPEN' && s.companyId === compId && (!locId || s.locationId === locId))
      .first();
    this.activeSession.set(session || null);
    if (session) {
      this.recalculateBalances(session);
    }
  }

  recalculateBalances(session: CashSession) {
    let entradas = 0;
    let sangrias = 0;
    let saldo = session.initialCash;

    for (const m of session.movements) {
      if (m.type === 'SUPRIMENTO' || m.type === 'VENDA' || m.type === 'PAGAMENTO_FIADO') {
        entradas += m.amount;
        saldo += m.amount;
      } else if (m.type === 'SANGRIA') {
        sangrias += m.amount;
        saldo -= m.amount;
      }
    }

    this.totalEntradas.set(entradas);
    this.totalSangrias.set(sangrias);
    this.saldoCalculado.set(saldo);
  }

  openMovModal(type: 'SUPRIMENTO' | 'SANGRIA') {
    this.movType.set(type);
    this.formMov.reset({ amount: 50.00, reason: '' });
    this.modalMov.set(true);
  }

  async confirmarAbertura() {
    if (this.formAbertura.invalid) return;
    const { initialCash, operatorName } = this.formAbertura.value;
    await this.engine.openCashSession(Number(initialCash));
    this.modalAbertura.set(false);
    await this.loadSession();
  }

  async confirmarMovimento() {
    if (this.formMov.invalid) return;
    const { amount, reason } = this.formMov.value;
    await this.engine.addCashMovement(this.movType(), Number(amount), reason || '');
    this.modalMov.set(false);
    await this.loadSession();
  }

  recalcFechamentoTotal() {
    const v = this.formFechamento.value;
    const total = 
      (Number(v.n100) || 0) * 100 +
      (Number(v.n50) || 0) * 50 +
      (Number(v.n20) || 0) * 20 +
      (Number(v.n10) || 0) * 10 +
      (Number(v.nOther) || 0) * 5 +
      (Number(v.coins) || 0);
    this.valorDeclarado.set(total);
  }

  async confirmarFechamento() {
    this.isSubmitting.set(true);
    try {
      const declared = this.valorDeclarado();
      const session = await this.engine.closeActiveCashSession(declared);
      this.modalFechamento.set(false);
      this.activeSession.set(null);
      
      // Auto-generate Redução Z
      const receipt = this.printer.generateCashCloseReceipt(session);
      this.printer.printReceipt(receipt);
      this.toastError.set('');
    } catch (e: any) {
      this.toastError.set(e.message || 'Erro ao fechar caixa');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  imprimirLeituraX() {
    const session = this.activeSession();
    if (session) {
      const receipt = this.printer.generateCashCloseReceipt(session);
      this.printer.printReceipt(receipt);
    }
  }

  formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
}

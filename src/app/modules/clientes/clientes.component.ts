import { Component, OnInit, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { db } from '../../core/storage/dexie.db';
import { TransactionEngine } from '../../core/workflow/transaction.engine';
import { AppContextService } from '../../core/services/app-context.service';
import { IdGeneratorService } from '../../core/services/id-generator.service';
import { Customer } from '../../core/models';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col bg-zinc-50 text-zinc-900 font-sans p-6 overflow-y-auto">
      
      <!-- Top Bar -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <mat-icon class="scale-125">groups</mat-icon>
          </div>
          <div>
            <h1 class="text-xl font-bold tracking-tight">Clientes & Livro de Fiado</h1>
            <p class="text-xs text-zinc-500">Controle de limites de crédito, débitos em aberto e quitação</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button (click)="openNovoClienteModal()" class="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition shadow-sm cursor-pointer">
            <mat-icon class="text-sm">person_add</mat-icon>
            Cadastrar Cliente
          </button>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
        <div class="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm flex items-center justify-between">
          <div>
            <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total de Clientes</span>
            <div class="text-2xl font-bold text-zinc-800 mt-1">{{ customers().length }} clientes</div>
          </div>
          <mat-icon class="text-blue-500 scale-125">badge</mat-icon>
        </div>

        <div class="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm flex items-center justify-between">
          <div>
            <span class="text-xs font-semibold text-rose-500 uppercase tracking-wider">Total em Fiado a Receber</span>
            <div class="text-2xl font-bold text-rose-700 mt-1">R$ {{ totalFiadoReceber().toFixed(2) }}</div>
          </div>
          <mat-icon class="text-rose-500 scale-125">account_balance_wallet</mat-icon>
        </div>

        <div class="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm flex items-center justify-between">
          <div>
            <span class="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Clientes em Dia</span>
            <div class="text-2xl font-bold text-emerald-700 mt-1">{{ clientesEmDiaCount() }}</div>
          </div>
          <mat-icon class="text-emerald-500 scale-125">check_circle</mat-icon>
        </div>
      </div>

      <!-- Search bar -->
      <div class="mb-4 relative">
        <mat-icon class="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">search</mat-icon>
        <input type="text" [value]="searchTerm()" (input)="onSearchInput($event)" placeholder="Buscar cliente por nome, telefone ou CPF/CNPJ..." class="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-xs" />
      </div>

      <!-- Customers Table -->
      <div class="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm flex-1 mb-6">
        <table class="w-full text-left text-sm">
          <thead class="bg-zinc-50 text-zinc-500 text-xs uppercase font-semibold border-b border-zinc-200">
            <tr>
              <th class="py-3.5 px-4">Nome do Cliente</th>
              <th class="py-3.5 px-4">Documento / Telefone</th>
              <th class="py-3.5 px-4 text-right">Limite de Crédito</th>
              <th class="py-3.5 px-4 text-right">Saldo Devedor</th>
              <th class="py-3.5 px-4 text-center">Status</th>
              <th class="py-3.5 px-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-100">
            @for (c of filteredCustomers(); track c.id) {
              <tr class="hover:bg-zinc-50/80 transition">
                <td class="py-3 px-4">
                  <div class="font-semibold text-zinc-900">{{ c.name }}</div>
                  @if (c.notes) {
                    <div class="text-[11px] text-zinc-400 line-clamp-1">{{ c.notes }}</div>
                  }
                </td>
                <td class="py-3 px-4 text-xs text-zinc-500">
                  <div>{{ c.document || 'Sem CPF/CNPJ' }}</div>
                  <div>{{ c.phone || 'Sem telefone' }}</div>
                </td>
                <td class="py-3 px-4 text-right font-medium text-zinc-600">
                  R$ {{ c.creditLimit.toFixed(2) }}
                </td>
                <td class="py-3 px-4 text-right font-bold" [class.text-rose-600]="c.currentDebt > 0" [class.text-zinc-400]="c.currentDebt <= 0">
                  R$ {{ c.currentDebt.toFixed(2) }}
                </td>
                <td class="py-3 px-4 text-center">
                  @if (c.currentDebt > 0) {
                    <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">Com Débito</span>
                  } @else {
                    <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">Em Dia</span>
                  }
                </td>
                <td class="py-3 px-4 text-center">
                  <div class="flex items-center justify-center gap-1">
                    @if (c.currentDebt > 0) {
                      <button (click)="openReceberModal(c)" class="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition cursor-pointer flex items-center gap-1 shadow-xs">
                        <mat-icon class="text-xs">payments</mat-icon>
                        Quitar Fiado
                      </button>
                    }
                    <button (click)="openExtrato(c)" class="p-1.5 text-zinc-600 hover:bg-zinc-100 rounded-lg cursor-pointer" title="Ver Extrato">
                      <mat-icon class="text-sm">receipt_long</mat-icon>
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Modal: Recebimento / Quitação de Fiado -->
      @if (receberModal(); as client) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div class="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 border border-zinc-200">
            <h3 class="text-lg font-bold text-zinc-900 mb-1">Receber Pagamento de Fiado</h3>
            <p class="text-xs text-zinc-500 mb-4">{{ client.name }} | Débito Total: <strong class="text-rose-600">R$ {{ client.currentDebt.toFixed(2) }}</strong></p>

            <div class="space-y-4 mb-6">
              <div>
                <label class="block text-xs font-semibold text-zinc-700 mb-1">Valor a Quitar (R$)</label>
                <input type="number" step="0.01" [value]="valorQuitacao()" (input)="onValorQuitacaoInput($event)" class="w-full px-4 py-2.5 border border-zinc-300 rounded-xl text-lg font-bold focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>

              <div>
                <label class="block text-xs font-semibold text-zinc-700 mb-1">Forma de Pagamento</label>
                <select [value]="formaQuitacao()" (change)="onFormaQuitacaoChange($event)" class="w-full px-3 py-2.5 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                  <option value="dinheiro">Dinheiro (Entra no Caixa do Turno)</option>
                  <option value="pix">PIX</option>
                  <option value="debito">Cartão de Débito</option>
                  <option value="credito">Cartão de Crédito</option>
                </select>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2">
              <button (click)="receberModal.set(null)" class="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer">Cancelar</button>
              <button (click)="confirmarQuitacao()" class="px-5 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition cursor-pointer shadow-md">Confirmar Quitação</button>
            </div>
          </div>
        </div>
      }

      <!-- Modal: Extrato do Cliente -->
      @if (extratoModal(); as client) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div class="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 border border-zinc-200">
            <h3 class="text-lg font-bold text-zinc-900 mb-1">Extrato do Cliente</h3>
            <p class="text-xs text-zinc-500 mb-4">{{ client.name }}</p>

            <div class="space-y-3 p-4 bg-zinc-50 rounded-2xl border border-zinc-200 mb-6 text-sm">
              <div class="flex justify-between">
                <span class="text-zinc-500">Saldo Devedor Atual:</span>
                <span class="font-bold text-rose-600">R$ {{ client.currentDebt.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-zinc-500">Limite de Crédito:</span>
                <span class="font-bold text-zinc-800">R$ {{ client.creditLimit.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-zinc-500">Crédito Disponível:</span>
                <span class="font-bold text-emerald-600">R$ {{ (client.creditLimit - client.currentDebt).toFixed(2) }}</span>
              </div>
            </div>

            <div class="flex items-center justify-end">
              <button (click)="extratoModal.set(null)" class="px-5 py-2.5 bg-zinc-800 text-white text-xs font-bold rounded-xl hover:bg-zinc-900 transition cursor-pointer">Fechar</button>
            </div>
          </div>
        </div>
      }

      <!-- Modal: Novo Cliente -->
      @if (novoClienteModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div class="bg-white rounded-3xl shadow-xl w-full max-w-lg p-6 border border-zinc-200">
            <h3 class="text-lg font-bold text-zinc-900 mb-1">Novo Cliente</h3>
            <p class="text-xs text-zinc-500 mb-4">Cadastre um cliente com limite de crédito autorizado.</p>

            <form [formGroup]="formCliente" (ngSubmit)="salvarNovoCliente()">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div class="sm:col-span-2">
                  <label class="block text-xs font-semibold text-zinc-700 mb-1">Nome Completo</label>
                  <input type="text" formControlName="name" class="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-zinc-700 mb-1">CPF / CNPJ</label>
                  <input type="text" formControlName="document" class="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-zinc-700 mb-1">WhatsApp / Telefone</label>
                  <input type="text" formControlName="phone" class="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div class="sm:col-span-2">
                  <label class="block text-xs font-semibold text-zinc-700 mb-1">Endereço</label>
                  <input type="text" formControlName="address" class="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-zinc-700 mb-1">Limite de Crédito Fiado (R$)</label>
                  <input type="number" formControlName="creditLimit" class="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-zinc-700 mb-1">Observações</label>
                  <input type="text" formControlName="notes" placeholder="Ex: Paga todo dia 10..." class="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              <div class="flex items-center justify-end gap-2">
                <button type="button" (click)="novoClienteModal.set(false)" class="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer">Cancelar</button>
                <button type="submit" [disabled]="formCliente.invalid" class="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition cursor-pointer disabled:opacity-50 shadow-md">Salvar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class ClientesComponent implements OnInit {
  private engine = inject(TransactionEngine);
  private fb = inject(FormBuilder);
  private context = inject(AppContextService);
  private idGen = inject(IdGeneratorService);

  customers = signal<Customer[]>([]);
  filteredCustomers = signal<Customer[]>([]);
  totalFiadoReceber = signal(0);
  clientesEmDiaCount = signal(0);

  searchTerm = signal('');
  receberModal = signal<Customer | null>(null);
  extratoModal = signal<Customer | null>(null);
  novoClienteModal = signal(false);

  valorQuitacao = signal(0);
  formaQuitacao = signal('dinheiro');

  formCliente = this.fb.group({
    name: ['', Validators.required],
    document: [''],
    phone: [''],
    address: [''],
    creditLimit: [300.00, [Validators.required, Validators.min(0)]],
    notes: ['']
  });

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    const currentCompanyId = this.context.companyId();
    const list = await db.customers.where('companyId').equals(currentCompanyId).toArray();
    this.customers.set(list);
    this.filterCustomers();

    this.totalFiadoReceber.set(list.reduce((acc, c) => acc + (c.currentDebt || 0), 0));
    this.clientesEmDiaCount.set(list.filter(c => (c.currentDebt || 0) === 0).length);
  }

  onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
    this.filterCustomers();
  }

  onValorQuitacaoInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.valorQuitacao.set(Number(input.value) || 0);
  }

  onFormaQuitacaoChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.formaQuitacao.set(select.value);
  }

  filterCustomers() {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) {
      this.filteredCustomers.set(this.customers());
      return;
    }
    this.filteredCustomers.set(
      this.customers().filter(c => 
        c.name.toLowerCase().includes(term) || 
        (c.document && c.document.includes(term)) ||
        (c.phone && c.phone.includes(term))
      )
    );
  }

  openReceberModal(c: Customer) {
    this.receberModal.set(c);
    this.valorQuitacao.set(c.currentDebt);
    this.formaQuitacao.set('dinheiro');
  }

  async confirmarQuitacao() {
    const c = this.receberModal();
    if (!c) return;

    await this.engine.payCustomerDebt(c.id, Number(this.valorQuitacao()), this.formaQuitacao());
    this.receberModal.set(null);
    await this.loadData();
  }

  openExtrato(c: Customer) {
    this.extratoModal.set(c);
  }

  openNovoClienteModal() {
    this.formCliente.reset({
      name: '',
      document: '',
      phone: '',
      address: '',
      creditLimit: 300.00,
      notes: ''
    });
    this.novoClienteModal.set(true);
  }

  async salvarNovoCliente() {
    if (this.formCliente.invalid) return;
    const v = this.formCliente.value;
    const newCust: Customer = {
      id: this.idGen.generatePrefixedId('cust'),
      companyId: this.context.companyId(),
      name: v.name || '',
      document: v.document || '',
      phone: v.phone || '',
      address: v.address || '',
      creditLimit: Number(v.creditLimit),
      currentDebt: 0,
      blocked: false,
      notes: v.notes || '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await this.engine.saveCustomer(newCust, 'CREATE');
    this.novoClienteModal.set(false);
    await this.loadData();
  }
}

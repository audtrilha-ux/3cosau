import { Component, ChangeDetectionStrategy, signal, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { db } from '../../core/storage/dexie.db';
import { Supplier } from '../../core/models';
import { AppContextService } from '../../core/services/app-context.service';
import { TransactionEngine } from '../../core/workflow/transaction.engine';
import { IdGeneratorService } from '../../core/services/id-generator.service';

@Component({
  selector: 'app-fornecedores',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col bg-zinc-50 text-zinc-800 p-4 space-y-4 overflow-hidden select-none">
      <!-- Top Header -->
      <div class="flex items-center justify-between pb-3 border-b border-zinc-200 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <mat-icon>local_shipping</mat-icon>
          </div>
          <div>
            <h2 class="text-base font-bold text-zinc-900 leading-tight">Fornecedores & Distribuidores</h2>
            <p class="text-xs text-zinc-500">Cadastro de parceiros comerciais, representantes e prazos de entrega</p>
          </div>
        </div>
        <button
          type="button"
          (click)="openModal()"
          class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <mat-icon class="text-sm">add</mat-icon>
          <span>Novo Fornecedor</span>
        </button>
      </div>

      <!-- Search & Filters -->
      <div class="flex items-center gap-3 bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm shrink-0">
        <div class="relative flex-1">
          <mat-icon class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">search</mat-icon>
          <input
            type="text"
            [value]="searchTerm()"
            (input)="searchTerm.set($any($event.target).value)"
            placeholder="Buscar por nome, CNPJ, contato ou categoria..."
            class="w-full pl-9 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-amber-500"
          />
        </div>
        <span class="text-xs text-zinc-500 font-medium">Total: <strong>{{ suppliers().length }}</strong></span>
      </div>

      <!-- Suppliers Table -->
      <div class="flex-1 bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
        <div class="overflow-y-auto flex-1">
          <table class="w-full text-left text-xs text-zinc-700">
            <thead class="bg-zinc-50 text-zinc-500 uppercase tracking-wider text-[10px] border-b border-zinc-200 sticky top-0">
              <tr>
                <th class="p-3">Empresa / Fornecedor</th>
                <th class="p-3">CNPJ / CPF</th>
                <th class="p-3">Categoria</th>
                <th class="p-3">Contato & Telefone</th>
                <th class="p-3">Condições</th>
                <th class="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-100 font-sans">
              @for (s of filteredSuppliers(); track s.id) {
                <tr class="hover:bg-amber-50/40 transition-colors">
                  <td class="p-3 font-bold text-zinc-900">
                    <div>{{ s.name }}</div>
                    @if (s.notes) {
                      <div class="text-[10px] text-zinc-400 font-normal truncate max-w-xs">{{ s.notes }}</div>
                    }
                  </td>
                  <td class="p-3 font-mono text-zinc-600">{{ s.document || '-' }}</td>
                  <td class="p-3">
                    <span class="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 font-semibold text-[10px]">
                      {{ s.category }}
                    </span>
                  </td>
                  <td class="p-3">
                    <div class="font-medium text-zinc-800">{{ s.contactPerson || 'Geral' }}</div>
                    <div class="text-zinc-500 font-mono text-[11px]">{{ s.phone }}</div>
                  </td>
                  <td class="p-3">
                    <div class="text-zinc-800">{{ s.paymentTerms }}</div>
                    <div class="text-[10px] text-zinc-500">Prazo: {{ s.leadTimeDays }} dias</div>
                  </td>
                  <td class="p-3 text-right space-x-1">
                    <button
                      type="button"
                      (click)="edit(s)"
                      class="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 cursor-pointer"
                      title="Editar"
                    >
                      <mat-icon class="text-sm">edit</mat-icon>
                    </button>
                    <button
                      type="button"
                      (click)="delete(s.id)"
                      class="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                      title="Excluir"
                    >
                      <mat-icon class="text-sm">delete</mat-icon>
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="p-12 text-center text-zinc-400">
                    <mat-icon class="text-4xl mb-1 text-zinc-300">local_shipping</mat-icon>
                    <p>Nenhum fornecedor cadastrado.</p>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Add/Edit Modal -->
      @if (showModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div class="bg-white border border-zinc-200 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 class="text-sm font-bold text-zinc-900">
                {{ editingId() ? 'Editar Fornecedor' : 'Novo Fornecedor' }}
              </h3>
              <button (click)="showModal.set(false)" class="text-zinc-400 hover:text-zinc-600">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <form [formGroup]="form" (ngSubmit)="save()" class="space-y-3 text-xs">
              <div>
                <label class="block font-semibold text-zinc-700 mb-1">Razão Social / Nome Fantasia *</label>
                <input type="text" formControlName="name" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:outline-none focus:border-amber-500" placeholder="Ex: Distribuidora de Bebidas Ltda" />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">CNPJ / CPF</label>
                  <input type="text" formControlName="document" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-mono focus:outline-none focus:border-amber-500" placeholder="00.000.000/0001-00" />
                </div>
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Categoria</label>
                  <input type="text" formControlName="category" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:outline-none focus:border-amber-500" placeholder="Ex: Bebidas, Alimentos, Embalagens" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Representante / Contato</label>
                  <input type="text" formControlName="contactPerson" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:outline-none focus:border-amber-500" placeholder="Nome do vendedor" />
                </div>
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Telefone / WhatsApp *</label>
                  <input type="text" formControlName="phone" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-mono focus:outline-none focus:border-amber-500" placeholder="(11) 98888-7777" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Condição de Pagamento</label>
                  <select formControlName="paymentTerms" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:outline-none focus:border-amber-500">
                    <option value="À vista">À vista (PIX / Boleto à vista)</option>
                    <option value="Boleto 14 dias">Boleto 14 dias</option>
                    <option value="Boleto 30 dias">Boleto 30 dias</option>
                    <option value="Boleto 30/60 dias">Boleto 30/60 dias</option>
                    <option value="Faturamento Quinzenal">Faturamento Quinzenal</option>
                  </select>
                </div>
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Prazo de Entrega (Dias)</label>
                  <input type="number" formControlName="leadTimeDays" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-mono focus:outline-none focus:border-amber-500" />
                </div>
              </div>

              <div>
                <label class="block font-semibold text-zinc-700 mb-1">Observações Comerciais</label>
                <textarea formControlName="notes" rows="2" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:outline-none focus:border-amber-500 resize-none" placeholder="Pedido mínimo, dias de visita, etc."></textarea>
              </div>

              <div class="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
                <button type="button" (click)="showModal.set(false)" class="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold">Cancelar</button>
                <button type="submit" [disabled]="form.invalid" class="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold shadow-md">Salvar Fornecedor</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class FornecedoresComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private fb = inject(FormBuilder);
  private context = inject(AppContextService);
  private txEngine = inject(TransactionEngine);
  private idGen = inject(IdGeneratorService);

  suppliers = signal<Supplier[]>([]);
  searchTerm = signal('');
  showModal = signal(false);
  editingId = signal<string | null>(null);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    document: [''],
    category: ['Geral'],
    contactPerson: [''],
    phone: ['', Validators.required],
    email: [''],
    paymentTerms: ['Boleto 30 dias'],
    leadTimeDays: [2, [Validators.min(0)]],
    notes: ['']
  });

  filteredSuppliers = () => {
    const q = this.searchTerm().toLowerCase().trim();
    if (!q) return this.suppliers();
    return this.suppliers().filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.document.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      s.contactPerson.toLowerCase().includes(q)
    );
  };

  async ngOnInit() {
    await this.loadSuppliers();
  }

  async loadSuppliers() {
    if (!isPlatformBrowser(this.platformId)) return;
    const currentCompanyId = this.context.companyId();
    const list = await db.suppliers.where('companyId').equals(currentCompanyId).toArray();
    this.suppliers.set(list);
  }

  openModal() {
    this.editingId.set(null);
    this.form.reset({
      name: '',
      document: '',
      category: 'Geral',
      contactPerson: '',
      phone: '',
      email: '',
      paymentTerms: 'Boleto 30 dias',
      leadTimeDays: 2,
      notes: ''
    });
    this.showModal.set(true);
  }

  edit(s: Supplier) {
    this.editingId.set(s.id);
    this.form.patchValue(s);
    this.showModal.set(true);
  }

  async save() {
    if (this.form.invalid || !isPlatformBrowser(this.platformId)) return;
    const val = this.form.value;
    const now = Date.now();

    if (this.editingId()) {
      const id = this.editingId()!;
      const existing = await db.suppliers.get(id);
      if (existing) {
        const updated: Supplier = {
          ...existing,
          name: val.name!,
          document: val.document || '',
          category: val.category || 'Geral',
          contactPerson: val.contactPerson || '',
          phone: val.phone || '',
          email: val.email || '',
          paymentTerms: val.paymentTerms || 'Boleto 30 dias',
          leadTimeDays: Number(val.leadTimeDays || 2),
          notes: val.notes || ''
        };
        await this.txEngine.saveEntity('suppliers', updated, 'UPDATE');
      }
    } else {
      const newSup: Supplier = {
        id: this.idGen.generatePrefixedId('sup'),
        companyId: this.context.companyId(),
        name: val.name!,
        document: val.document || '',
        category: val.category || 'Geral',
        contactPerson: val.contactPerson || '',
        phone: val.phone || '',
        email: val.email || '',
        paymentTerms: val.paymentTerms || 'Boleto 30 dias',
        leadTimeDays: Number(val.leadTimeDays || 2),
        notes: val.notes || '',
        createdAt: now
      };
      await this.txEngine.saveEntity('suppliers', newSup, 'CREATE');
    }

    this.showModal.set(false);
    await this.loadSuppliers();
  }

  async delete(id: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    await this.txEngine.deleteEntity('suppliers', id);
    await this.loadSuppliers();
  }
}

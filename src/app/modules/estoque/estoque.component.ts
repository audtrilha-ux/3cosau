import { Component, OnInit, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { db } from '../../core/storage/dexie.db';
import { AppContextService } from '../../core/services/app-context.service';
import { Product } from '../../core/models';
import { TransactionEngine } from '../../core/workflow/transaction.engine';
import { IdGeneratorService } from '../../core/services/id-generator.service';

@Component({
  selector: 'app-estoque',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col bg-zinc-50 text-zinc-900 font-sans p-6 overflow-y-auto">
      
      <!-- Top Bar -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
            <mat-icon class="scale-125">inventory_2</mat-icon>
          </div>
          <div>
            <h1 class="text-xl font-bold tracking-tight">Kardex & Controle de Estoque</h1>
            <p class="text-xs text-zinc-500">Saldo de produtos, histórico de movimentações e livro-razão</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button (click)="openNovoProdutoModal()" class="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition shadow-sm cursor-pointer">
            <mat-icon class="text-sm">add</mat-icon>
            Cadastrar Produto
          </button>
        </div>
      </div>

      <!-- Error Toast -->
      @if (toastError()) {
        <div class="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between">
          <span>{{ toastError() }}</span>
          <button (click)="toastError.set('')" class="text-rose-500 hover:text-rose-700 cursor-pointer">
            <mat-icon class="text-sm">close</mat-icon>
          </button>
        </div>
      }

      <!-- Overview Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
        <div class="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm flex items-center justify-between">
          <div>
            <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total de Itens</span>
            <div class="text-2xl font-bold text-zinc-800 mt-1">{{ totalProdutos() }} itens</div>
          </div>
          <mat-icon class="text-purple-500 scale-125">category</mat-icon>
        </div>

        <div class="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm flex items-center justify-between">
          <div>
            <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Valor do Estoque (Custo)</span>
            <div class="text-2xl font-bold text-emerald-700 mt-1">R$ {{ valorTotalEstoque().toFixed(2) }}</div>
          </div>
          <mat-icon class="text-emerald-500 scale-125">savings</mat-icon>
        </div>

        <div class="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm flex items-center justify-between">
          <div>
            <span class="text-xs font-semibold text-rose-500 uppercase tracking-wider">Estoque Crítico / Baixo</span>
            <div class="text-2xl font-bold text-rose-700 mt-1">{{ produtosCriticos().length }} produtos</div>
          </div>
          <mat-icon class="text-rose-500 scale-125">warning</mat-icon>
        </div>
      </div>

      <!-- Search & Filter Bar -->
      <div class="flex flex-col sm:flex-row items-center gap-3 mb-4">
        <div class="flex-1 w-full relative">
          <mat-icon class="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">search</mat-icon>
          <input type="text" [value]="searchTerm()" (input)="onSearchInput($event)" placeholder="Buscar por nome, código de barras ou categoria..." class="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none shadow-xs" />
        </div>
      </div>

      <!-- Products Table -->
      <div class="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm flex-1 mb-6">
        <table class="w-full text-left text-sm">
          <thead class="bg-zinc-50 text-zinc-500 text-xs uppercase font-semibold border-b border-zinc-200">
            <tr>
              <th class="py-3.5 px-4">Produto</th>
              <th class="py-3.5 px-4">Categoria</th>
              <th class="py-3.5 px-4">Cód. Barras</th>
              <th class="py-3.5 px-4 text-right">Custo</th>
              <th class="py-3.5 px-4 text-right">Preço Venda</th>
              <th class="py-3.5 px-4 text-center">Saldo</th>
              <th class="py-3.5 px-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-100">
            @for (p of filteredProducts(); track p.id) {
              <tr class="hover:bg-zinc-50/80 transition">
                <td class="py-3 px-4">
                  <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-600">
                      <mat-icon class="text-sm">{{ p.icon || 'inventory_2' }}</mat-icon>
                    </div>
                    <div>
                      <div class="font-semibold text-zinc-900">{{ p.name }}</div>
                      <div class="text-[11px] text-zinc-400 font-mono">NCM: {{ p.fiscal?.ncm || 'N/A' }} | CFOP: {{ p.fiscal?.cfop || '5102' }}</div>
                    </div>
                  </div>
                </td>
                <td class="py-3 px-4">
                  <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700">{{ p.category }}</span>
                </td>
                <td class="py-3 px-4 font-mono text-xs text-zinc-500">{{ p.barcode }}</td>
                <td class="py-3 px-4 text-right text-zinc-500">R$ {{ p.costPrice.toFixed(2) }}</td>
                <td class="py-3 px-4 text-right font-bold text-zinc-900">R$ {{ p.price.toFixed(2) }}</td>
                <td class="py-3 px-4 text-center">
                  <span class="px-2.5 py-1 rounded-full text-xs font-bold"
                        [class.bg-rose-100]="p.stock <= p.minStock"
                        [class.text-rose-800]="p.stock <= p.minStock"
                        [class.bg-emerald-100]="p.stock > p.minStock"
                        [class.text-emerald-800]="p.stock > p.minStock">
                    {{ p.stock }} {{ p.unit }}
                  </span>
                </td>
                <td class="py-3 px-4 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <button (click)="openAjusteModal(p)" title="Ajustar Saldo" class="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg cursor-pointer">
                      <mat-icon class="text-sm">tune</mat-icon>
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Modal: Ajuste Rápido de Estoque -->
      @if (ajusteModal(); as prod) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div class="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 border border-zinc-200">
            <h3 class="text-lg font-bold text-zinc-900 mb-1">Ajuste de Estoque</h3>
            <p class="text-xs text-zinc-500 mb-4">{{ prod.name }} (Saldo Atual: {{ prod.stock }} {{ prod.unit }})</p>

            <div class="space-y-4 mb-6">
              <div>
                <label class="block text-xs font-semibold text-zinc-700 mb-1">Tipo de Ajuste</label>
                <div class="grid grid-cols-2 gap-2">
                  <button (click)="ajusteTipo.set('ENTRADA')" [class.bg-emerald-600]="ajusteTipo() === 'ENTRADA'" [class.text-white]="ajusteTipo() === 'ENTRADA'" [class.bg-zinc-100]="ajusteTipo() !== 'ENTRADA'" [class.text-zinc-700]="ajusteTipo() !== 'ENTRADA'" class="py-2 text-xs font-bold rounded-xl transition cursor-pointer">
                    + Entrada / Compra
                  </button>
                  <button (click)="ajusteTipo.set('PERDA')" [class.bg-rose-600]="ajusteTipo() === 'PERDA'" [class.text-white]="ajusteTipo() === 'PERDA'" [class.bg-zinc-100]="ajusteTipo() !== 'PERDA'" [class.text-zinc-700]="ajusteTipo() !== 'PERDA'" class="py-2 text-xs font-bold rounded-xl transition cursor-pointer">
                    - Perda / Quebra
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-zinc-700 mb-1">Quantidade</label>
                <input type="number" [value]="ajusteQtd()" (input)="onAjusteQtdInput($event)" class="w-full px-4 py-2.5 border border-zinc-300 rounded-xl text-base font-bold focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>

              <div>
                <label class="block text-xs font-semibold text-zinc-700 mb-1">Motivo do Ajuste</label>
                <input type="text" [value]="ajusteMotivo()" (input)="onAjusteMotivoInput($event)" placeholder="Ex: Inventário, avaria, doação..." class="w-full px-4 py-2 border border-zinc-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>
            </div>

            <div class="flex items-center justify-end gap-2">
              <button (click)="ajusteModal.set(null)" class="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer">Cancelar</button>
              <button (click)="confirmarAjuste()" class="px-5 py-2.5 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700 transition cursor-pointer shadow-md">Confirmar Ajuste</button>
            </div>
          </div>
        </div>
      }

      <!-- Modal: Novo Produto -->
      @if (novoProdutoModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div class="bg-white rounded-3xl shadow-xl w-full max-w-lg p-6 border border-zinc-200">
            <h3 class="text-lg font-bold text-zinc-900 mb-1">Novo Produto</h3>
            <p class="text-xs text-zinc-500 mb-4">Cadastre um novo item no catálogo do PDV e controle de estoque.</p>

            <form [formGroup]="formProduto" (ngSubmit)="salvarNovoProduto()">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div class="sm:col-span-2">
                  <label class="block text-xs font-semibold text-zinc-700 mb-1">Nome do Produto</label>
                  <input type="text" formControlName="name" class="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-zinc-700 mb-1">Categoria</label>
                  <input type="text" formControlName="category" class="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-zinc-700 mb-1">Código de Barras (EAN)</label>
                  <input type="text" formControlName="barcode" class="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-zinc-700 mb-1">Preço de Custo (R$)</label>
                  <input type="number" step="0.01" formControlName="costPrice" class="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-zinc-700 mb-1">Preço de Venda (R$)</label>
                  <input type="number" step="0.01" formControlName="price" class="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-zinc-700 mb-1">Estoque Inicial</label>
                  <input type="number" formControlName="stock" class="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-zinc-700 mb-1">Estoque Mínimo</label>
                  <input type="number" formControlName="minStock" class="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
              </div>

              <div class="flex items-center justify-end gap-2">
                <button type="button" (click)="novoProdutoModal.set(false)" class="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer">Cancelar</button>
                <button type="submit" [disabled]="formProduto.invalid" class="px-5 py-2.5 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700 transition cursor-pointer disabled:opacity-50 shadow-md">Salvar Produto</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class EstoqueComponent implements OnInit {
  private fb = inject(FormBuilder);
  private context = inject(AppContextService);
  private engine = inject(TransactionEngine);
  private idGen = inject(IdGeneratorService);

  products = signal<Product[]>([]);
  filteredProducts = signal<Product[]>([]);
  produtosCriticos = signal<Product[]>([]);
  totalProdutos = signal(0);
  valorTotalEstoque = signal(0);
  toastError = signal('');

  searchTerm = signal('');
  ajusteModal = signal<Product | null>(null);
  novoProdutoModal = signal(false);

  ajusteTipo = signal<'ENTRADA' | 'PERDA'>('ENTRADA');
  ajusteQtd = signal(10);
  ajusteMotivo = signal('');

  formProduto = this.fb.group({
    name: ['', Validators.required],
    category: ['Geral', Validators.required],
    barcode: ['', Validators.required],
    costPrice: [0.00, [Validators.required, Validators.min(0)]],
    price: [0.00, [Validators.required, Validators.min(0.01)]],
    stock: [10, [Validators.required, Validators.min(0)]],
    minStock: [5, [Validators.required, Validators.min(0)]]
  });

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    const currentCompanyId = this.context.companyId();
    const list = await db.products.where('companyId').equals(currentCompanyId).toArray();
    const activeList = list.filter(p => p.active);
    this.products.set(activeList);
    this.filterProducts();

    this.totalProdutos.set(activeList.length);
    this.valorTotalEstoque.set(activeList.reduce((acc, p) => acc + (p.costPrice * p.stock), 0));
    this.produtosCriticos.set(activeList.filter(p => p.stock <= p.minStock));
  }

  onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
    this.filterProducts();
  }

  onAjusteQtdInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.ajusteQtd.set(Number(input.value) || 0);
  }

  onAjusteMotivoInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.ajusteMotivo.set(input.value);
  }

  filterProducts() {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) {
      this.filteredProducts.set(this.products());
      return;
    }
    this.filteredProducts.set(
      this.products().filter(p => 
        p.name.toLowerCase().includes(term) || 
        p.barcode.includes(term) || 
        p.category.toLowerCase().includes(term)
      )
    );
  }

  openAjusteModal(p: Product) {
    this.ajusteModal.set(p);
    this.ajusteQtd.set(5);
    this.ajusteMotivo.set('Ajuste de inventário');
  }

  async confirmarAjuste() {
    const p = this.ajusteModal();
    if (!p) return;

    try {
      await this.engine.adjustStock(
        p.id,
        this.ajusteTipo() as 'ENTRADA' | 'SAIDA',
        Number(this.ajusteQtd()),
        this.ajusteMotivo()
      );
      this.ajusteModal.set(null);
      await this.loadData();
      this.toastError.set('');
    } catch (err: any) {
      this.toastError.set(err.message || 'Erro ao ajustar estoque');
    }
  }

  openNovoProdutoModal() {
    const arr = new Uint32Array(1);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(arr);
    } else {
      arr[0] = Date.now() % 100000000;
    }
    const randNum = arr[0] % 99999999;
    const generatedBarcode = '789' + String(randNum).padStart(9, '0');

    this.formProduto.reset({
      name: '',
      category: 'Geral',
      barcode: generatedBarcode,
      costPrice: 5.00,
      price: 12.00,
      stock: 20,
      minStock: 5
    });
    this.novoProdutoModal.set(true);
  }

  async salvarNovoProduto() {
    if (this.formProduto.invalid) return;
    const v = this.formProduto.value;
    const newProd: Product = {
      id: this.idGen.generatePrefixedId('prod'),
      companyId: this.context.companyId(),
      name: v.name || '',
      category: v.category || 'Geral',
      barcode: v.barcode || '',
      price: Number(v.price),
      costPrice: Number(v.costPrice),
      stock: Number(v.stock),
      minStock: Number(v.minStock),
      unit: 'UN',
      icon: 'inventory_2',
      fiscal: { ncm: '2106.90.90', cfop: '5102', csosnCst: '102' },
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    try {
      await this.engine.saveProduct(newProd, 'CREATE');
      this.novoProdutoModal.set(false);
      await this.loadData();
      this.toastError.set('');
    } catch (err: any) {
      this.toastError.set('Erro ao salvar produto: ' + err.message);
    }
  }
}

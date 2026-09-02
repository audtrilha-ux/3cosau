import { Component, OnInit, signal, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { db } from '../../core/storage/dexie.db';
import { TransactionEngine } from '../../core/workflow/transaction.engine';
import { EscPosService } from '../../core/services/escpos.service';
import { Product, Customer, PaymentEntry } from '../../core/models';
import { AppContextService } from '../../core/services/app-context.service';

@Component({
  selector: 'app-pdv',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-full w-full bg-zinc-50 text-zinc-900 select-none font-sans p-4 lg:p-6 gap-4 lg:gap-6 overflow-hidden">
      
      <!-- Left: Catalog & Barcode Scanner -->
      <div class="flex-1 flex flex-col h-full bg-white border border-zinc-200 rounded-3xl p-4 lg:p-6 shadow-sm overflow-hidden">
        
        <!-- Search & Barcode Bar -->
        <div class="flex items-center gap-3 mb-4 shrink-0">
          <div class="relative flex-1">
            <mat-icon class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">search</mat-icon>
            <input type="text" [value]="searchTerm()" (input)="onSearchInput($event)" (keyup.enter)="handleEnterBarcode()"
                   placeholder="Buscar por código de barras, nome ou referência..." 
                   class="w-full pl-12 pr-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium" />
          </div>
          <button (click)="handleEnterBarcode()" class="p-3 bg-indigo-600 text-white rounded-2xl shadow-md hover:bg-indigo-700 transition-colors cursor-pointer flex items-center justify-center">
            <mat-icon>qr_code_scanner</mat-icon>
          </button>
        </div>

        <!-- Categories Filters -->
        <div class="flex items-center gap-2 overflow-x-auto pb-3 mb-3 shrink-0 no-scrollbar">
          @for (cat of categories(); track cat) {
            <button (click)="selectCategory(cat)"
                    class="px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer"
                    [class.bg-indigo-600]="selectedCategory() === cat"
                    [class.text-white]="selectedCategory() === cat"
                    [class.shadow-xs]="selectedCategory() === cat"
                    [class.bg-zinc-100]="selectedCategory() !== cat"
                    [class.text-zinc-600]="selectedCategory() !== cat"
                    [class.hover:bg-zinc-200]="selectedCategory() !== cat">
              {{ cat }}
            </button>
          }
        </div>
        
        <!-- Products Bento Grid -->
        <div class="flex-1 overflow-y-auto pr-1 pb-4">
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5">
            @for (product of filteredProducts(); track product.id) {
              <button (click)="addToCart(product)" 
                      class="flex flex-col items-center p-4 bg-zinc-50 rounded-2xl border border-zinc-200/80 hover:border-indigo-400 hover:bg-indigo-50/30 hover:shadow-sm transition-all active:scale-95 text-left h-full group cursor-pointer">
                <div class="w-12 h-12 rounded-xl bg-white border border-zinc-200 flex items-center justify-center mb-3 shadow-xs text-indigo-600 group-hover:scale-105 transition">
                  <mat-icon class="scale-110">{{ product.icon || 'inventory_2' }}</mat-icon>
                </div>
                <span class="font-semibold text-xs text-center w-full text-zinc-800 line-clamp-2">{{ product.name }}</span>
                <div class="mt-auto pt-2 flex items-center justify-between w-full">
                  <span class="text-[10px] text-zinc-400 font-mono">{{ product.stock }} un</span>
                  <span class="text-indigo-600 font-black text-xs">R$ {{ product.price.toFixed(2) }}</span>
                </div>
              </button>
            } @empty {
              <div class="col-span-full py-12 text-center text-zinc-400 text-xs">
                Nenhum produto encontrado com esse filtro.
              </div>
            }
          </div>
        </div>
      </div>
      
      <!-- Right: Active Cart & Checkout Dock -->
      <div class="w-80 lg:w-96 flex flex-col bg-zinc-900 rounded-3xl shadow-xl text-white z-10 shrink-0 overflow-hidden">
        
        <!-- Cart Header -->
        <div class="p-5 flex items-center justify-between shrink-0 border-b border-zinc-800">
          <div class="flex items-center gap-3">
            <div class="bg-indigo-600 p-2 rounded-xl text-white">
              <mat-icon class="text-sm">shopping_cart</mat-icon>
            </div>
            <div>
              <h2 class="font-bold text-sm">Frente de Caixa</h2>
              <p class="text-[11px] text-zinc-400">{{ cart().length }} itens no pedido</p>
            </div>
          </div>
          @if (cart().length > 0) {
            <button (click)="clearCart()" class="text-xs text-rose-400 hover:text-rose-300 font-medium cursor-pointer">
              Limpar
            </button>
          }
        </div>

        <!-- Customer selection pill (Fiado or identified client) -->
        <div class="px-5 py-2.5 bg-zinc-800/80 border-b border-zinc-800 flex items-center justify-between text-xs">
          <div class="flex items-center gap-2 text-zinc-300">
            <mat-icon class="text-sm text-zinc-400">person</mat-icon>
            <span class="truncate max-w-[150px] font-medium">{{ selectedCustomer() ? selectedCustomer()!.name : 'Consumidor Geral' }}</span>
          </div>
          <button (click)="modalCliente.set(true)" class="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer">
            {{ selectedCustomer() ? 'Alterar' : '+ Cliente' }}
          </button>
        </div>
        
        <!-- Cart Items List -->
        <div class="flex-1 overflow-y-auto p-4 space-y-2">
          @if (cart().length === 0) {
            <div class="flex flex-col items-center justify-center h-full text-zinc-500 py-12">
              <mat-icon class="text-5xl mb-3 opacity-20">receipt_long</mat-icon>
              <p class="font-medium text-sm">Carrinho Vazio</p>
              <p class="text-xs mt-1 text-zinc-500">Clique ou bipe um item para adicionar</p>
            </div>
          } @else {
            @for (item of cart(); track item.productId; let i = $index) {
              <div class="flex items-center justify-between p-3 bg-zinc-800/90 rounded-2xl border border-zinc-700/60">
                <div class="flex-1 min-w-0 mr-2">
                  <div class="font-semibold text-xs truncate">{{ item.productName }}</div>
                  <div class="text-[11px] text-zinc-400 mt-0.5 font-mono">R$ {{ item.unitPrice.toFixed(2) }} un</div>
                </div>

                <div class="flex items-center gap-2">
                  <div class="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-700">
                    <button (click)="decreaseQty(i)" class="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-white rounded cursor-pointer">-</button>
                    <span class="w-6 text-center text-xs font-bold">{{ item.quantity }}</span>
                    <button (click)="increaseQty(i)" class="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-white rounded cursor-pointer">+</button>
                  </div>
                  <span class="font-bold text-xs text-indigo-300 w-16 text-right">R$ {{ item.totalPrice.toFixed(2) }}</span>
                  <button (click)="removeItem(i)" class="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer">
                    <mat-icon class="text-xs">close</mat-icon>
                  </button>
                </div>
              </div>
            }
          }
        </div>
        
        <!-- Cart Totals & Checkout Trigger -->
        <div class="p-5 bg-zinc-950 mt-auto border-t border-zinc-800">
          <div class="flex justify-between items-center mb-1 text-zinc-400 text-xs">
            <span>Subtotal</span>
            <span class="font-mono">R$ {{ subtotal().toFixed(2) }}</span>
          </div>

          <div class="flex justify-between items-center mb-4 text-white font-black text-2xl">
            <span>Total</span>
            <span class="text-emerald-400 font-mono">R$ {{ total().toFixed(2) }}</span>
          </div>

          <button (click)="openPaymentModal()" [disabled]="cart().length === 0"
                  class="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-2xl font-bold shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-sm">
            <mat-icon class="text-sm">payment</mat-icon>
            Receber Pagamento
          </button>
        </div>
      </div>

      <!-- Modal: Seleção de Cliente (Fiado / CPF) -->
      @if (modalCliente()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div class="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 border border-zinc-200 text-zinc-900">
            <h3 class="text-base font-bold mb-1">Identificar Cliente</h3>
            <p class="text-xs text-zinc-500 mb-4">Selecione para vincular ao cupom ou habilitar venda em Fiado.</p>

            <div class="space-y-2 max-h-60 overflow-y-auto mb-4">
              <button (click)="selectClient(null)" class="w-full p-3 text-left border border-zinc-200 rounded-xl hover:bg-zinc-50 flex items-center justify-between text-xs cursor-pointer">
                <span class="font-bold text-zinc-700">Consumidor Geral (Sem Cadastro)</span>
                <mat-icon class="text-xs text-zinc-400">arrow_forward</mat-icon>
              </button>
              @for (c of customers(); track c.id) {
                <button (click)="selectClient(c)" class="w-full p-3 text-left border border-zinc-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50/40 flex items-center justify-between text-xs cursor-pointer">
                  <div>
                    <div class="font-bold text-zinc-800">{{ c.name }}</div>
                    <div class="text-[11px] text-zinc-500">Limite: R$ {{ c.creditLimit.toFixed(2) }} | Dívida: R$ {{ c.currentDebt.toFixed(2) }}</div>
                  </div>
                  <mat-icon class="text-xs text-indigo-600">check</mat-icon>
                </button>
              }
            </div>

            <div class="flex justify-end">
              <button (click)="modalCliente.set(false)" class="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer">Fechar</button>
            </div>
          </div>
        </div>
      }

      <!-- Modal: Pagamento & Finalização -->
      @if (modalPagamento()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div class="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 border border-zinc-200 text-zinc-900">
            
            <div class="flex items-center justify-between pb-4 border-b border-zinc-200">
              <div>
                <h3 class="text-lg font-black text-zinc-900">Finalizar Venda</h3>
                <p class="text-xs text-zinc-500">Total a Pagar: <strong class="text-emerald-700 font-mono text-sm">R$ {{ total().toFixed(2) }}</strong></p>
              </div>
              <button (click)="modalPagamento.set(false)" class="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            @if (toastError()) {
              <div class="my-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2">
                <mat-icon class="text-rose-600 text-sm">error</mat-icon>
                <span>{{ toastError() }}</span>
              </div>
            }

            <div class="py-4 space-y-4">
              <!-- Method selector buttons -->
              <div class="grid grid-cols-3 sm:grid-cols-5 gap-2">
                <button (click)="paymentMethod.set('dinheiro')" 
                        [class.bg-emerald-600]="paymentMethod() === 'dinheiro'" 
                        [class.text-white]="paymentMethod() === 'dinheiro'" 
                        [class.bg-zinc-100]="paymentMethod() !== 'dinheiro'" 
                        [class.text-zinc-700]="paymentMethod() !== 'dinheiro'" 
                        class="p-2.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition">
                  <mat-icon class="text-sm">payments</mat-icon> Dinheiro
                </button>
                <button (click)="paymentMethod.set('pix')" 
                        [class.bg-indigo-600]="paymentMethod() === 'pix'" 
                        [class.text-white]="paymentMethod() === 'pix'" 
                        [class.bg-zinc-100]="paymentMethod() !== 'pix'" 
                        [class.text-zinc-700]="paymentMethod() !== 'pix'" 
                        class="p-2.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition">
                  <mat-icon class="text-sm">qr_code_2</mat-icon> PIX
                </button>
                <button (click)="paymentMethod.set('debito')" 
                        [class.bg-blue-600]="paymentMethod() === 'debito'" 
                        [class.text-white]="paymentMethod() === 'debito'" 
                        [class.bg-zinc-100]="paymentMethod() !== 'debito'" 
                        [class.text-zinc-700]="paymentMethod() !== 'debito'" 
                        class="p-2.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition">
                  <mat-icon class="text-sm">credit_card</mat-icon> Débito
                </button>
                <button (click)="paymentMethod.set('credito')" 
                        [class.bg-purple-600]="paymentMethod() === 'credito'" 
                        [class.text-white]="paymentMethod() === 'credito'" 
                        [class.bg-zinc-100]="paymentMethod() !== 'credito'" 
                        [class.text-zinc-700]="paymentMethod() !== 'credito'" 
                        class="p-2.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition">
                  <mat-icon class="text-sm">credit_card</mat-icon> Crédito
                </button>
                <button (click)="paymentMethod.set('fiado')" 
                        [class.bg-amber-600]="paymentMethod() === 'fiado'" 
                        [class.text-white]="paymentMethod() === 'fiado'" 
                        [class.bg-zinc-100]="paymentMethod() !== 'fiado'" 
                        [class.text-zinc-700]="paymentMethod() !== 'fiado'" 
                        class="p-2.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition">
                  <mat-icon class="text-sm">menu_book</mat-icon> Fiado
                </button>
              </div>

              <!-- Dinheiro cash change calculation -->
              @if (paymentMethod() === 'dinheiro') {
                <div class="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3">
                  <div>
                    <label class="block text-xs font-semibold text-zinc-700 mb-1">Valor Recebido do Cliente (R$)</label>
                    <input type="number" step="0.50" [value]="cashReceived()" (input)="onCashReceivedInput($event)" class="w-full px-4 py-2.5 bg-white border border-zinc-300 rounded-xl text-lg font-black focus:ring-2 focus:ring-emerald-500 outline-none font-mono" />
                  </div>
                  <div class="flex items-center justify-between pt-2 border-t border-zinc-200 text-xs">
                    <span class="font-semibold text-zinc-600">Troco a Devolver:</span>
                    <span class="text-lg font-black font-mono text-emerald-700">R$ {{ calculatedChange().toFixed(2) }}</span>
                  </div>
                </div>
              }

              <!-- PIX Mock QR Code display -->
              @if (paymentMethod() === 'pix') {
                <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex flex-col items-center text-center space-y-2">
                  <div class="w-28 h-28 bg-white border border-indigo-200 rounded-xl p-2 flex items-center justify-center shadow-xs">
                    <mat-icon style="font-size: 80px; width: 80px; height: 80px;" class="text-indigo-900">qr_code_2</mat-icon>
                  </div>
                  <span class="text-xs font-bold text-indigo-950">Chave Dinâmica Gerada</span>
                  <span class="text-[10px] text-indigo-600 font-mono">00020126580014br.gov.bcb.pix...</span>
                </div>
              }

              <!-- Fiado Validation alert -->
              @if (paymentMethod() === 'fiado') {
                <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-2">
                  @if (selectedCustomer()) {
                    <div class="font-bold text-amber-900">Cliente: {{ selectedCustomer()!.name }}</div>
                    <div class="text-amber-800">Limite Total: R$ {{ selectedCustomer()!.creditLimit.toFixed(2) }}</div>
                    <div class="text-amber-800">Saldo Devedor Atual: R$ {{ selectedCustomer()!.currentDebt.toFixed(2) }}</div>
                    <div class="font-semibold text-amber-950">Disponível após esta venda: R$ {{ (selectedCustomer()!.creditLimit - selectedCustomer()!.currentDebt - total()).toFixed(2) }}</div>
                  } @else {
                    <div class="text-rose-600 font-bold">Atenção: Selecione um cliente para autorizar a venda no Fiado!</div>
                    <button (click)="modalCliente.set(true)" class="mt-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg font-bold">Selecionar Cliente</button>
                  }
                </div>
              }
            </div>

            <!-- Action buttons -->
            <div class="flex items-center justify-end gap-2 pt-4 border-t border-zinc-200">
              <button (click)="modalPagamento.set(false)" class="px-4 py-2.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer">Cancelar</button>
              <button (click)="confirmarVenda()" [disabled]="isInvalidPayment() || isSubmitting()" class="px-6 py-3 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition cursor-pointer disabled:opacity-40 shadow-md flex items-center gap-1.5">
                <mat-icon class="text-sm">receipt</mat-icon>
                {{ isSubmitting() ? 'Processando...' : 'Confirmar e Emitir Cupom (F4)' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class PdvComponent implements OnInit {
  isSubmitting = signal(false);
  toastError = signal('');
  private engine = inject(TransactionEngine);
  private printer = inject(EscPosService);
  private context = inject(AppContextService);

  products = signal<Product[]>([]);
  filteredProducts = signal<Product[]>([]);
  categories = signal<string[]>(['Todas']);
  selectedCategory = signal('Todas');
  searchTerm = signal('');

  customers = signal<Customer[]>([]);
  selectedCustomer = signal<Customer | null>(null);

  cart = signal<{ productId: string; productName: string; quantity: number; unitPrice: number; totalPrice: number }[]>([]);
  subtotal = computed(() => this.cart().reduce((acc, item) => acc + item.totalPrice, 0));
  total = computed(() => this.subtotal());

  modalCliente = signal(false);
  modalPagamento = signal(false);
  paymentMethod = signal<'dinheiro' | 'pix' | 'debito' | 'credito' | 'fiado'>('dinheiro');
  cashReceived = signal(0);

  calculatedChange = computed(() => {
    if (this.paymentMethod() !== 'dinheiro') return 0;
    return Math.max(0, this.cashReceived() - this.total());
  });

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    const currentCompanyId = this.context.companyId();
    const prods = await db.products.where('companyId').equals(currentCompanyId).toArray();
    const activeProds = prods.filter(p => p.active);
    this.products.set(activeProds);

    const cats = ['Todas', ...Array.from(new Set(activeProds.map(p => p.category)))];
    this.categories.set(cats);

    const custs = await db.customers.where('companyId').equals(currentCompanyId).toArray();
    this.customers.set(custs);

    this.filterProducts();
  }

  onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
    this.filterProducts();
  }

  onCashReceivedInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.cashReceived.set(parseFloat(input.value) || 0);
  }

  filterProducts() {
    let list = this.products();
    if (this.selectedCategory() !== 'Todas') {
      list = list.filter(p => p.category === this.selectedCategory());
    }
    const term = this.searchTerm().toLowerCase().trim();
    if (term) {
      list = list.filter(p => p.name.toLowerCase().includes(term) || p.barcode.includes(term));
    }
    this.filteredProducts.set(list);
  }

  selectCategory(cat: string) {
    this.selectedCategory.set(cat);
    this.filterProducts();
  }

  handleEnterBarcode() {
    const term = this.searchTerm().trim();
    if (!term) return;
    const match = this.products().find(p => p.barcode === term || p.name.toLowerCase().includes(term.toLowerCase()));
    if (match) {
      this.addToCart(match);
      this.searchTerm.set('');
      this.filterProducts();
    }
  }

  addToCart(product: Product) {
    this.cart.update(items => {
      const existing = items.find(i => i.productId === product.id);
      if (existing) {
        return items.map(i => i.productId === product.id ? { 
          ...i, 
          quantity: i.quantity + 1,
          totalPrice: (i.quantity + 1) * i.unitPrice
        } : i);
      }
      return [...items, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.price,
        totalPrice: product.price
      }];
    });
  }

  increaseQty(index: number) {
    this.cart.update(items => items.map((item, i) => i === index ? {
      ...item,
      quantity: item.quantity + 1,
      totalPrice: (item.quantity + 1) * item.unitPrice
    } : item));
  }

  decreaseQty(index: number) {
    this.cart.update(items => {
      const current = items[index];
      if (current.quantity > 1) {
        return items.map((item, i) => i === index ? {
          ...item,
          quantity: item.quantity - 1,
          totalPrice: (item.quantity - 1) * item.unitPrice
        } : item);
      }
      return items.filter((_, i) => i !== index);
    });
  }

  removeItem(index: number) {
    this.cart.update(items => items.filter((_, i) => i !== index));
  }

  clearCart() {
    this.cart.set([]);
  }

  selectClient(c: Customer | null) {
    this.selectedCustomer.set(c);
    this.modalCliente.set(false);
  }

  openPaymentModal() {
    this.cashReceived.set(Math.ceil(this.total() / 10) * 10);
    this.toastError.set('');
    this.modalPagamento.set(true);
  }

  isInvalidPayment(): boolean {
    if (this.paymentMethod() === 'fiado' && !this.selectedCustomer()) return true;
    if (this.paymentMethod() === 'dinheiro' && this.cashReceived() < this.total()) return true;
    return false;
  }

  async confirmarVenda() {
    if (this.isInvalidPayment()) return;

    this.isSubmitting.set(true);
    try {
      const payments: PaymentEntry[] = [{
        method: this.paymentMethod(),
        amount: this.total(),
        receivedAmount: this.paymentMethod() === 'dinheiro' ? this.cashReceived() : this.total(),
        changeAmount: this.calculatedChange()
      }];

      const sale = await this.engine.processSale({
        items: this.cart(),
        payments,
        customerId: this.selectedCustomer()?.id,
        customerName: this.selectedCustomer()?.name,
        operatorName: 'Operador Padrão'
      });

      this.modalPagamento.set(false);
      this.cart.set([]);
      this.selectedCustomer.set(null);

      // Auto-generate & print receipt
      const receipt = this.printer.generateSaleReceipt(sale);
      this.printer.printReceipt(receipt);
      this.toastError.set('');
    } catch (e: any) {
      this.toastError.set(e.message || 'Erro ao processar venda');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}

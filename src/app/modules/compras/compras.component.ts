import { Component, ChangeDetectionStrategy, signal, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { db } from '../../core/storage/dexie.db';
import { PurchaseOrder, Supplier, Product } from '../../core/models';
import { AppContextService } from '../../core/services/app-context.service';
import { TransactionEngine } from '../../core/workflow/transaction.engine';
import { IdGeneratorService } from '../../core/services/id-generator.service';

@Component({
  selector: 'app-compras',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col bg-zinc-50 text-zinc-800 p-4 space-y-4 overflow-hidden select-none">
      <!-- Top Header -->
      <div class="flex items-center justify-between pb-3 border-b border-zinc-200 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            <mat-icon>shopping_bag</mat-icon>
          </div>
          <div>
            <h2 class="text-base font-bold text-zinc-900 leading-tight">Compras & Pedidos de Fornecedores</h2>
            <p class="text-xs text-zinc-500">Emissão de pedidos com conferência e entrada automática no estoque (Kardex)</p>
          </div>
        </div>
        <button
          type="button"
          (click)="openModal()"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <mat-icon class="text-sm">add</mat-icon>
          <span>Novo Pedido de Compra</span>
        </button>
      </div>

      <!-- Feedback Toast -->
      @if (toastMsg()) {
        <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center justify-between animate-fade">
          <div class="flex items-center gap-2">
            <mat-icon class="text-sm text-emerald-600">check_circle</mat-icon>
            <span>{{ toastMsg() }}</span>
          </div>
          <button (click)="toastMsg.set('')" class="text-emerald-500 hover:text-emerald-700 cursor-pointer">
            <mat-icon class="text-xs">close</mat-icon>
          </button>
        </div>
      }

      @if (toastError()) {
        <div class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center justify-between animate-fade">
          <div class="flex items-center gap-2">
            <mat-icon class="text-sm text-rose-600">error</mat-icon>
            <span>{{ toastError() }}</span>
          </div>
          <button (click)="toastError.set('')" class="text-rose-500 hover:text-rose-700 cursor-pointer">
            <mat-icon class="text-xs">close</mat-icon>
          </button>
        </div>
      }

      <!-- KPI Summary Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Total em Pedidos</div>
            <div class="text-lg font-black text-blue-600 font-mono">R$ {{ totalOrdersValue().toFixed(2) }}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><mat-icon class="text-base">receipt_long</mat-icon></div>
        </div>
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Aguardando Entrega</div>
            <div class="text-lg font-black text-amber-600 font-mono">{{ pendingOrdersCount() }} pedidos</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><mat-icon class="text-base">schedule</mat-icon></div>
        </div>
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Recebidos com Sucesso</div>
            <div class="text-lg font-black text-emerald-600 font-mono">{{ receivedOrdersCount() }} pedidos</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><mat-icon class="text-base">check_circle</mat-icon></div>
        </div>
      </div>

      <!-- Orders List -->
      <div class="flex-1 bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
        <div class="overflow-y-auto flex-1">
          <table class="w-full text-left text-xs text-zinc-700">
            <thead class="bg-zinc-50 text-zinc-500 uppercase tracking-wider text-[10px] border-b border-zinc-200 sticky top-0">
              <tr>
                <th class="p-3">Pedido / Data</th>
                <th class="p-3">Fornecedor</th>
                <th class="p-3">Itens do Pedido</th>
                <th class="p-3">Total</th>
                <th class="p-3">Status</th>
                <th class="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-100 font-sans">
              @for (po of orders(); track po.id) {
                <tr class="hover:bg-blue-50/40 transition-colors">
                  <td class="p-3">
                    <div class="font-bold text-zinc-900 font-mono">#{{ po.id.substring(3, 9) }}</div>
                    <div class="text-[10px] text-zinc-400">{{ po.createdAt | date:'dd/MM/yyyy HH:mm' }}</div>
                  </td>
                  <td class="p-3 font-semibold text-zinc-800">{{ po.supplierName }}</td>
                  <td class="p-3">
                    <div class="space-y-0.5">
                      @for (item of po.items; track item.productId) {
                        <div class="text-[11px] text-zinc-600">
                          <span class="font-bold text-zinc-900">{{ item.quantity }}x</span> {{ item.productName }}
                        </div>
                      }
                    </div>
                  </td>
                  <td class="p-3 font-black text-emerald-700 font-mono">R$ {{ po.total.toFixed(2) }}</td>
                  <td class="p-3">
                    <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase"
                          [class.bg-emerald-100]="po.status === 'RECEBIDO'"
                          [class.text-emerald-800]="po.status === 'RECEBIDO'"
                          [class.bg-blue-100]="po.status === 'RECEBIDO_PARCIAL'"
                          [class.text-blue-800]="po.status === 'RECEBIDO_PARCIAL'"
                          [class.bg-amber-100]="po.status !== 'RECEBIDO' && po.status !== 'RECEBIDO_PARCIAL'"
                          [class.text-amber-800]="po.status !== 'RECEBIDO' && po.status !== 'RECEBIDO_PARCIAL'">
                      {{ po.status === 'RECEBIDO' ? 'Recebido Total' : (po.status === 'RECEBIDO_PARCIAL' ? 'Recebido Parcial' : 'Enviado / Pendente') }}
                    </span>
                  </td>
                  <td class="p-3 text-right space-x-1.5">
                    @if (po.status !== 'RECEBIDO') {
                      <button
                        type="button"
                        (click)="receiveOrder(po)"
                        class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] cursor-pointer inline-flex items-center gap-1 shadow-sm"
                      >
                        <mat-icon class="text-xs">inventory</mat-icon>
                        Receber no Estoque
                      </button>
                    }
                    <button
                      type="button"
                      (click)="deleteOrder(po.id)"
                      class="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                      title="Excluir"
                    >
                      <mat-icon class="text-sm">delete</mat-icon>
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="p-12 text-center text-zinc-400">
                    <mat-icon class="text-4xl mb-1 text-zinc-300">shopping_bag</mat-icon>
                    <p>Nenhum pedido de compra emitido.</p>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Add Order Modal -->
      @if (showModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div class="bg-white border border-zinc-200 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div class="flex items-center justify-between pb-3 border-b border-zinc-100 shrink-0">
              <h3 class="text-sm font-bold text-zinc-900">Novo Pedido de Compra</h3>
              <button (click)="showModal.set(false)" class="text-zinc-400 hover:text-zinc-600">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <div class="space-y-3 text-xs overflow-y-auto flex-1 pr-1">
              <div>
                <label class="block font-semibold text-zinc-700 mb-1">Fornecedor *</label>
                <select [value]="selectedSupplierId()" (change)="selectedSupplierId.set($any($event.target).value)" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900">
                  @for (s of suppliers(); track s.id) {
                    <option [value]="s.id">{{ s.name }} ({{ s.paymentTerms }})</option>
                  }
                </select>
              </div>

              <!-- Add Product Line Item -->
              <div class="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                <div class="font-bold text-zinc-700 text-[11px] uppercase">Inserir Item no Pedido</div>
                <div class="grid grid-cols-12 gap-2">
                  <div class="col-span-6">
                    <label class="text-[10px] text-zinc-500">Produto</label>
                    <select [value]="selectedProdId()" (change)="onProductChange($any($event.target).value)" class="w-full bg-white border border-zinc-200 rounded-lg p-1.5 text-xs">
                      @for (p of products(); track p.id) {
                        <option [value]="p.id">{{ p.name }} (Estoque: {{ p.stock }})</option>
                      }
                    </select>
                  </div>
                  <div class="col-span-3">
                    <label class="text-[10px] text-zinc-500">Qtd.</label>
                    <input type="number" [value]="itemQty()" (input)="itemQty.set(+$any($event.target).value)" min="1" class="w-full bg-white border border-zinc-200 rounded-lg p-1.5 text-xs font-mono text-center" />
                  </div>
                  <div class="col-span-3 flex items-end">
                    <button type="button" (click)="addItem()" class="w-full py-1.5 bg-blue-600 text-white rounded-lg font-bold text-xs">
                      + Adicionar
                    </button>
                  </div>
                </div>
              </div>

              <!-- Items in cart -->
              <div class="space-y-1.5">
                <div class="font-semibold text-zinc-700">Itens Inclusos ({{ cartItems().length }}):</div>
                @for (item of cartItems(); track $index) {
                  <div class="flex items-center justify-between p-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs">
                    <div>
                      <span class="font-bold text-zinc-900">{{ item.quantity }}x</span> {{ item.productName }}
                      <span class="text-zinc-500 text-[10px] font-mono"> (R$ {{ item.unitCost.toFixed(2) }} un)</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <strong class="font-mono text-emerald-700">R$ {{ (item.quantity * item.unitCost).toFixed(2) }}</strong>
                      <button (click)="removeItem($index)" class="text-rose-500 hover:text-rose-700">
                        <mat-icon class="text-sm">close</mat-icon>
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>

            <div class="pt-3 border-t border-zinc-100 flex items-center justify-between shrink-0">
              <div>
                <span class="text-xs text-zinc-500">Total do Pedido:</span>
                <strong class="text-base font-black text-emerald-700 font-mono ml-2">R$ {{ orderTotal().toFixed(2) }}</strong>
              </div>
              <div class="flex gap-2">
                <button type="button" (click)="showModal.set(false)" class="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold">Cancelar</button>
                <button type="button" (click)="saveOrder()" [disabled]="cartItems().length === 0" class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold shadow-md">Confirmar Pedido</button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class ComprasComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private context = inject(AppContextService);
  private txEngine = inject(TransactionEngine);
  private idGen = inject(IdGeneratorService);

  orders = signal<PurchaseOrder[]>([]);
  suppliers = signal<Supplier[]>([]);
  products = signal<Product[]>([]);

  showModal = signal(false);
  selectedSupplierId = signal('');
  selectedProdId = signal('');
  itemQty = signal(10);
  cartItems = signal<{ productId: string; productName: string; quantity: number; unitCost: number; receivedQuantity: number }[]>([]);

  toastMsg = signal('');
  toastError = signal('');

  totalOrdersValue = () => this.orders().reduce((acc, o) => acc + o.total, 0);
  pendingOrdersCount = () => this.orders().filter(o => o.status !== 'RECEBIDO').length;
  receivedOrdersCount = () => this.orders().filter(o => o.status === 'RECEBIDO').length;

  orderTotal = () => this.cartItems().reduce((acc, i) => acc + (i.quantity * i.unitCost), 0);

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    if (!isPlatformBrowser(this.platformId)) return;
    const currentCompanyId = this.context.companyId();
    const [ordList, supList, prodList] = await Promise.all([
      db.purchaseOrders.where('companyId').equals(currentCompanyId).toArray(),
      db.suppliers.where('companyId').equals(currentCompanyId).toArray(),
      db.products.where('companyId').equals(currentCompanyId).toArray()
    ]);
    this.orders.set(ordList.reverse());
    this.suppliers.set(supList);
    this.products.set(prodList);
    if (supList.length > 0) this.selectedSupplierId.set(supList[0].id);
    if (prodList.length > 0) this.selectedProdId.set(prodList[0].id);
  }

  onProductChange(id: string) {
    this.selectedProdId.set(id);
  }

  openModal() {
    this.cartItems.set([]);
    this.showModal.set(true);
  }

  addItem() {
    const prod = this.products().find(p => p.id === this.selectedProdId());
    if (!prod) return;
    const qty = Math.max(1, this.itemQty());
    this.cartItems.update(items => [
      ...items,
      {
        productId: prod.id,
        productName: prod.name,
        quantity: qty,
        unitCost: prod.costPrice || (prod.price * 0.6),
        receivedQuantity: 0
      }
    ]);
  }

  removeItem(index: number) {
    this.cartItems.update(items => items.filter((_, i) => i !== index));
  }

  async saveOrder() {
    if (this.cartItems().length === 0 || !isPlatformBrowser(this.platformId)) return;
    const sup = this.suppliers().find(s => s.id === this.selectedSupplierId());
    if (!sup) return;

    const now = Date.now();
    const newPo: PurchaseOrder = {
      id: this.idGen.generatePrefixedId('po'),
      companyId: this.context.companyId(),
      supplierId: sup.id,
      supplierName: sup.name,
      items: this.cartItems(),
      total: this.orderTotal(),
      status: 'ENVIADO',
      paymentTerms: sup.paymentTerms || 'Boleto 30 dias',
      createdAt: now
    };

    await this.txEngine.saveEntity('purchaseOrders', newPo, 'CREATE');
    this.showModal.set(false);
    this.toastMsg.set('Pedido de compra criado com sucesso!');
    setTimeout(() => this.toastMsg.set(''), 4000);
    await this.loadData();
  }

  async receiveOrder(po: PurchaseOrder) {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      await this.txEngine.processPurchaseReceipt(po.id);
      this.toastMsg.set(`Pedido #${po.id.substring(3, 9)} recebido e estoque atualizado.`);
      setTimeout(() => this.toastMsg.set(''), 4000);
      await this.loadData();
    } catch (err: any) {
      console.error('[Compras] Error receiving order:', err);
      this.toastError.set('Erro ao dar entrada no pedido: ' + err.message);
      setTimeout(() => this.toastError.set(''), 5000);
    }
  }

  async deleteOrder(id: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    await this.txEngine.deleteEntity('purchaseOrders', id);
    this.toastMsg.set('Pedido excluído.');
    setTimeout(() => this.toastMsg.set(''), 3000);
    await this.loadData();
  }
}

import { Component, OnInit, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { db } from '../../core/storage/dexie.db';
import { WindowManagerService } from '../../core/window-manager.service';
import { PdvComponent } from '../vendas/pdv.component';
import { TableOrder, Product } from '../../core/models';
import { TransactionEngine } from '../../core/workflow/transaction.engine';
import { AppContextService } from '../../core/services/app-context.service';

@Component({
  selector: 'app-mesas',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col bg-zinc-50 text-zinc-900 font-sans p-6 overflow-y-auto">
      
      <!-- Header -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center">
            <mat-icon class="scale-125">restaurant</mat-icon>
          </div>
          <div>
            <h1 class="text-xl font-bold tracking-tight">Mesas & Comandas Eletrônicas</h1>
            <p class="text-xs text-zinc-500">Gestão de salão em tempo real, pedidos e fechamento no PDV</p>
          </div>
        </div>

        <div class="flex items-center gap-3 text-xs font-semibold">
          <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-emerald-500"></span> Livre ({{ livresCount() }})</div>
          <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-rose-500 animate-pulse"></span> Ocupada ({{ ocupadasCount() }})</div>
          <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-amber-500"></span> Conta Pedida ({{ contaCount() }})</div>
        </div>
      </div>

      <!-- Tables Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 my-6">
        @for (table of tables(); track table.id) {
          <div (click)="selectTable(table)"
               class="p-4 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between h-44 shadow-sm hover:shadow-md relative overflow-hidden group"
               [class.bg-white]="table.status === 'FREE'"
               [class.border-zinc-200]="table.status === 'FREE'"
               [class.hover:border-emerald-400]="table.status === 'FREE'"
               [class.bg-rose-50/50]="table.status === 'OCCUPIED'"
               [class.border-rose-200]="table.status === 'OCCUPIED'"
               [class.hover:border-rose-400]="table.status === 'OCCUPIED'"
               [class.bg-amber-50/50]="table.status === 'BILL_REQUESTED'"
               [class.border-amber-200]="table.status === 'BILL_REQUESTED'"
               [class.hover:border-amber-400]="table.status === 'BILL_REQUESTED'">
            
            <div class="flex items-center justify-between">
              <span class="text-lg font-black" [class.text-zinc-700]="table.status === 'FREE'" [class.text-zinc-900]="table.status !== 'FREE'">
                MESA {{ table.tableNumber }}
              </span>
              <span class="w-3 h-3 rounded-full" 
                    [class.bg-emerald-500]="table.status === 'FREE'"
                    [class.bg-rose-500]="table.status === 'OCCUPIED'"
                    [class.bg-amber-500]="table.status === 'BILL_REQUESTED'"></span>
            </div>

            <div>
              @if (table.status === 'FREE') {
                <span class="text-xs text-zinc-400 font-medium">Disponível</span>
              } @else {
                <div class="text-xs font-semibold text-zinc-800 line-clamp-1">{{ table.customerName || 'Cliente sem nome' }}</div>
                <div class="text-[11px] text-zinc-500 mt-0.5">{{ table.items.length }} itens lançados</div>
                <div class="text-base font-bold text-rose-700 mt-1">R$ {{ getTableTotal(table).toFixed(2) }}</div>
              }
            </div>

            <div class="pt-2 border-t border-zinc-200/60 flex items-center justify-between text-[11px] text-zinc-400">
              <span>{{ table.status === 'FREE' ? 'Clique p/ abrir' : 'Gerenciar' }}</span>
              <mat-icon class="text-sm">arrow_forward</mat-icon>
            </div>
          </div>
        }
      </div>

      <!-- Table Detail Modal / Drawer -->
      @if (selectedTable(); as table) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div class="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-6 border border-zinc-200 flex flex-col max-h-[90vh]">
            
            <!-- Modal Header -->
            <div class="flex items-center justify-between pb-4 border-b border-zinc-200">
              <div>
                <h3 class="text-xl font-black text-zinc-900">Mesa {{ table.tableNumber }}</h3>
                <p class="text-xs text-zinc-500">{{ table.status === 'FREE' ? 'Mesa livre - Abrir comanda' : (table.customerName || 'Comanda Aberta') }}</p>
              </div>
              <button (click)="selectedTable.set(null)" class="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 cursor-pointer">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <!-- Modal Body -->
            <div class="flex-1 overflow-y-auto py-4 space-y-4">
              @if (table.status === 'FREE') {
                <div class="space-y-3">
                  <label class="block text-xs font-semibold text-zinc-700">Identificação do Cliente / Responsável</label>
                  <input type="text" [value]="newClientName()" (input)="onClientNameInput($event)" placeholder="Ex: João Silva, Mesa dos amigos..." class="w-full px-4 py-2.5 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                  
                  <button (click)="abrirComanda(table)" class="w-full py-3 bg-orange-600 text-white rounded-xl text-sm font-bold hover:bg-orange-700 transition shadow-md cursor-pointer flex items-center justify-center gap-2">
                    <mat-icon>restaurant_menu</mat-icon>
                    Abrir Comanda da Mesa
                  </button>
                </div>
              } @else {
                <!-- Active Table Items -->
                <div class="space-y-2">
                  <span class="text-xs font-bold text-zinc-500 uppercase tracking-wider">Itens Consumidos</span>
                  <div class="border border-zinc-200 rounded-2xl divide-y divide-zinc-100 max-h-48 overflow-y-auto bg-zinc-50">
                    @for (item of table.items; track item.productId; let i = $index) {
                      <div class="p-3 flex items-center justify-between text-xs">
                        <div>
                          <div class="font-semibold text-zinc-800">{{ item.productName }}</div>
                          <div class="text-zinc-500">{{ item.quantity }}x R$ {{ item.unitPrice.toFixed(2) }}</div>
                        </div>
                        <div class="flex items-center gap-3">
                          <span class="font-bold text-zinc-900">R$ {{ item.totalPrice.toFixed(2) }}</span>
                          <button (click)="removerItem(table, i)" class="text-rose-500 hover:text-rose-700 p-1 cursor-pointer">
                            <mat-icon class="text-sm">delete</mat-icon>
                          </button>
                        </div>
                      </div>
                    } @empty {
                      <div class="p-4 text-center text-xs text-zinc-400">Nenhum item lançado ainda.</div>
                    }
                  </div>
                </div>

                <!-- Add item fast selector -->
                <div class="pt-2 border-t border-zinc-200">
                  <span class="text-xs font-bold text-zinc-700 mb-2 block">Lançar Item Rápido</span>
                  <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto">
                    @for (p of fastProducts(); track p.id) {
                      <button (click)="adicionarItem(table, p)" class="p-2 text-left border border-zinc-200 rounded-xl hover:border-orange-500 hover:bg-orange-50/50 transition cursor-pointer text-xs flex flex-col justify-between">
                        <span class="font-semibold text-zinc-800 line-clamp-1">{{ p.name }}</span>
                        <span class="font-bold text-orange-600 mt-1">R$ {{ p.price.toFixed(2) }}</span>
                      </button>
                    }
                  </div>
                </div>

                <!-- Table Subtotal -->
                <div class="p-4 bg-zinc-900 text-white rounded-2xl flex items-center justify-between">
                  <span class="text-xs text-zinc-400 font-medium">Subtotal da Mesa:</span>
                  <span class="text-xl font-bold text-emerald-400">R$ {{ getTableTotal(table).toFixed(2) }}</span>
                </div>
              }
            </div>

            <!-- Modal Footer Actions -->
            @if (table.status !== 'FREE') {
              <div class="pt-4 border-t border-zinc-200 flex items-center justify-between gap-3">
                <button (click)="solicitarConta(table)" class="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5">
                  <mat-icon class="text-sm">receipt</mat-icon>
                  Solicitar Conta
                </button>
                <button (click)="fecharNoPDV(table)" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md flex items-center gap-1.5">
                  <mat-icon class="text-sm">point_of_sale</mat-icon>
                  Pagar e Fechar no PDV
                </button>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class MesasComponent implements OnInit {
  private wm = inject(WindowManagerService);
  private txEngine = inject(TransactionEngine);
  private context = inject(AppContextService);

  tables = signal<TableOrder[]>([]);
  fastProducts = signal<Product[]>([]);
  selectedTable = signal<TableOrder | null>(null);
  newClientName = signal('');

  livresCount = signal(0);
  ocupadasCount = signal(0);
  contaCount = signal(0);

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    const currentCompanyId = this.context.companyId();
    const list = await db.tableOrders.where('companyId').equals(currentCompanyId).toArray();
    this.tables.set(list);
    this.updateCounts(list);

    const prods = await db.products.where('companyId').equals(currentCompanyId).and(p => p.active === true).limit(10).toArray();
    this.fastProducts.set(prods);
  }

  onClientNameInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.newClientName.set(input.value);
  }

  updateCounts(list: TableOrder[]) {
    this.livresCount.set(list.filter(t => t.status === 'FREE').length);
    this.ocupadasCount.set(list.filter(t => t.status === 'OCCUPIED').length);
    this.contaCount.set(list.filter(t => t.status === 'BILL_REQUESTED').length);
  }

  selectTable(t: TableOrder) {
    this.selectedTable.set({ ...t });
    this.newClientName.set('');
  }

  getTableTotal(t: TableOrder): number {
    return t.items.reduce((acc, item) => acc + item.totalPrice, 0);
  }

  async abrirComanda(t: TableOrder) {
    t.status = 'OCCUPIED';
    t.customerName = this.newClientName().trim() || 'Cliente Mesa ' + t.tableNumber;
    t.openedAt = Date.now();
    t.items = [];

    await this.txEngine.saveEntity('tableOrders', t, 'UPDATE');
    this.selectedTable.set({ ...t });
    await this.loadData();
  }

  async adicionarItem(t: TableOrder, p: Product) {
    const existing = t.items.find(i => i.productId === p.id);
    if (existing) {
      existing.quantity += 1;
      existing.totalPrice = existing.quantity * existing.unitPrice;
    } else {
      t.items.push({
        productId: p.id,
        productName: p.name,
        quantity: 1,
        unitPrice: p.price,
        totalPrice: p.price
      });
    }

    await this.txEngine.saveEntity('tableOrders', t, 'UPDATE');
    this.selectedTable.set({ ...t });
    await this.loadData();
  }

  async removerItem(t: TableOrder, index: number) {
    t.items.splice(index, 1);
    await this.txEngine.saveEntity('tableOrders', t, 'UPDATE');
    this.selectedTable.set({ ...t });
    await this.loadData();
  }

  async solicitarConta(t: TableOrder) {
    t.status = 'BILL_REQUESTED';
    await this.txEngine.saveEntity('tableOrders', t, 'UPDATE');
    this.selectedTable.set({ ...t });
    await this.loadData();
  }

  async fecharNoPDV(t: TableOrder) {
    // Open PDV window
    this.wm.openApp('pdv', 'PDV (Frente de Caixa)', 'point_of_sale', PdvComponent);
    this.selectedTable.set(null);
  }
}

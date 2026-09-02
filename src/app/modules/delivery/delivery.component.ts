import { Component, ChangeDetectionStrategy, signal, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { db } from '../../core/storage/dexie.db';
import { DeliveryOrder } from '../../core/models';
import { AppContextService } from '../../core/services/app-context.service';
import { TransactionEngine } from '../../core/workflow/transaction.engine';
import { IdGeneratorService } from '../../core/services/id-generator.service';

@Component({
  selector: 'app-delivery',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col bg-zinc-50 text-zinc-800 p-4 space-y-4 overflow-hidden select-none">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-zinc-200 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
            <mat-icon>two_wheeler</mat-icon>
          </div>
          <div>
            <h2 class="text-base font-bold text-zinc-900 leading-tight">Painel de Entregas & Delivery</h2>
            <p class="text-xs text-zinc-500">Despacho para motoboys, rastreio de status e notificação via WhatsApp</p>
          </div>
        </div>
        <button
          type="button"
          (click)="openModal()"
          class="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <mat-icon class="text-sm">add</mat-icon>
          <span>Nova Entrega</span>
        </button>
      </div>

      <!-- Kanban Grid -->
      <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-h-0 overflow-hidden">
        <!-- 1. Pendentes -->
        <div class="bg-white rounded-2xl border border-zinc-200 p-3 flex flex-col shadow-sm">
          <div class="flex items-center justify-between pb-2 border-b border-zinc-100 mb-2">
            <span class="text-xs font-bold text-zinc-700 uppercase flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-amber-500"></span> Pendentes
            </span>
            <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono text-[10px] font-bold">
              {{ pending().length }}
            </span>
          </div>
          <div class="flex-1 overflow-y-auto space-y-2 pr-1">
            @for (d of pending(); track d.id) {
              <div class="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2 shadow-xs">
                <div class="flex justify-between items-center">
                  <strong class="font-mono text-xs text-zinc-900">{{ d.orderNumber }}</strong>
                  <span class="font-mono font-bold text-emerald-700 text-xs">R$ {{ (d.orderAmount + d.deliveryFee).toFixed(2) }}</span>
                </div>
                <div>
                  <div class="font-bold text-zinc-800 text-xs">{{ d.customerName }}</div>
                  <div class="text-[10px] text-zinc-500 line-clamp-2 mt-0.5">{{ d.address }}</div>
                </div>
                <div class="flex justify-between items-center text-[10px] text-zinc-400 pt-1 border-t border-zinc-200">
                  <span>{{ d.courier || 'Sem motoboy' }}</span>
                  <a [href]="getWhatsAppUrl(d)" target="_blank" class="text-emerald-600 font-bold flex items-center gap-0.5">
                    <mat-icon class="text-[12px]">chat</mat-icon> WPP
                  </a>
                </div>
                <button (click)="advanceStatus(d, 'PRONTO')" class="w-full py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg text-xs cursor-pointer">
                  Marcar Pronto
                </button>
              </div>
            }
          </div>
        </div>

        <!-- 2. Prontos / Aguardando Saída -->
        <div class="bg-white rounded-2xl border border-zinc-200 p-3 flex flex-col shadow-sm">
          <div class="flex items-center justify-between pb-2 border-b border-zinc-100 mb-2">
            <span class="text-xs font-bold text-zinc-700 uppercase flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-cyan-500"></span> Prontos p/ Saída
            </span>
            <span class="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 font-mono text-[10px] font-bold">
              {{ ready().length }}
            </span>
          </div>
          <div class="flex-1 overflow-y-auto space-y-2 pr-1">
            @for (d of ready(); track d.id) {
              <div class="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2 shadow-xs">
                <div class="flex justify-between items-center">
                  <strong class="font-mono text-xs text-zinc-900">{{ d.orderNumber }}</strong>
                  <span class="font-mono font-bold text-cyan-700 text-xs">R$ {{ (d.orderAmount + d.deliveryFee).toFixed(2) }}</span>
                </div>
                <div>
                  <div class="font-bold text-zinc-800 text-xs">{{ d.customerName }}</div>
                  <div class="text-[10px] text-zinc-500 line-clamp-2 mt-0.5">{{ d.address }}</div>
                </div>
                <div class="flex justify-between items-center text-[10px] text-zinc-400 pt-1 border-t border-zinc-200">
                  <span>{{ d.courier }}</span>
                  <a [href]="getWhatsAppUrl(d)" target="_blank" class="text-emerald-600 font-bold flex items-center gap-0.5">
                    <mat-icon class="text-[12px]">chat</mat-icon> WPP
                  </a>
                </div>
                <button (click)="advanceStatus(d, 'EM_ROTA')" class="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs cursor-pointer">
                  Despachar Motoboy
                </button>
              </div>
            }
          </div>
        </div>

        <!-- 3. Em Rota -->
        <div class="bg-white rounded-2xl border border-zinc-200 p-3 flex flex-col shadow-sm">
          <div class="flex items-center justify-between pb-2 border-b border-zinc-100 mb-2">
            <span class="text-xs font-bold text-zinc-700 uppercase flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> Em Rota
            </span>
            <span class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono text-[10px] font-bold">
              {{ inRoute().length }}
            </span>
          </div>
          <div class="flex-1 overflow-y-auto space-y-2 pr-1">
            @for (d of inRoute(); track d.id) {
              <div class="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2 shadow-xs">
                <div class="flex justify-between items-center">
                  <strong class="font-mono text-xs text-zinc-900">{{ d.orderNumber }}</strong>
                  <span class="font-mono font-bold text-blue-700 text-xs">R$ {{ (d.orderAmount + d.deliveryFee).toFixed(2) }}</span>
                </div>
                <div>
                  <div class="font-bold text-zinc-800 text-xs">{{ d.customerName }}</div>
                  <div class="text-[10px] text-zinc-500 line-clamp-2 mt-0.5">{{ d.address }}</div>
                </div>
                <div class="flex justify-between items-center text-[10px] text-zinc-400 pt-1 border-t border-zinc-200">
                  <span>Motoboy: {{ d.courier }}</span>
                  <a [href]="getWhatsAppUrl(d)" target="_blank" class="text-emerald-600 font-bold flex items-center gap-0.5">
                    <mat-icon class="text-[12px]">chat</mat-icon> WPP
                  </a>
                </div>
                <button (click)="advanceStatus(d, 'ENTREGUE')" class="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer">
                  Confirmar Entrega
                </button>
              </div>
            }
          </div>
        </div>

        <!-- 4. Entregues -->
        <div class="bg-white rounded-2xl border border-zinc-200 p-3 flex flex-col shadow-sm">
          <div class="flex items-center justify-between pb-2 border-b border-zinc-100 mb-2">
            <span class="text-xs font-bold text-zinc-700 uppercase flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Entregues
            </span>
            <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
              {{ delivered().length }}
            </span>
          </div>
          <div class="flex-1 overflow-y-auto space-y-2 pr-1">
            @for (d of delivered(); track d.id) {
              <div class="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-1 opacity-75 shadow-xs">
                <div class="flex justify-between items-center">
                  <strong class="font-mono text-xs text-zinc-800">{{ d.orderNumber }}</strong>
                  <span class="text-[10px] text-emerald-700 font-bold">Concluído</span>
                </div>
                <div class="font-semibold text-zinc-800 text-xs">{{ d.customerName }}</div>
                <div class="text-[10px] text-zinc-500">Total: R$ {{ (d.orderAmount + d.deliveryFee).toFixed(2) }} ({{ d.paymentMethod }})</div>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Add Delivery Modal -->
      @if (showModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div class="bg-white border border-zinc-200 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 class="text-sm font-bold text-zinc-900">Novo Pedido de Entrega</h3>
              <button (click)="showModal.set(false)" class="text-zinc-400 hover:text-zinc-600">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <form [formGroup]="form" (ngSubmit)="save()" class="space-y-3 text-xs">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Nº do Pedido</label>
                  <input type="text" formControlName="orderNumber" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-mono" />
                </div>
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Cliente *</label>
                  <input type="text" formControlName="customerName" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900" placeholder="Nome completo" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Telefone / WhatsApp *</label>
                  <input type="text" formControlName="phone" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-mono" placeholder="(11) 98888-7777" />
                </div>
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Entregador / Motoboy</label>
                  <input type="text" formControlName="courier" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900" placeholder="Ex: Marcos Motoboy" />
                </div>
              </div>

              <div>
                <label class="block font-semibold text-zinc-700 mb-1">Endereço de Entrega *</label>
                <input type="text" formControlName="address" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900" placeholder="Rua, número, apto, bairro" />
              </div>

              <div class="grid grid-cols-3 gap-2">
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Valor Itens (R$)</label>
                  <input type="number" step="0.50" formControlName="orderAmount" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-mono" />
                </div>
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Taxa Entrega (R$)</label>
                  <input type="number" step="0.50" formControlName="deliveryFee" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-mono" />
                </div>
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Pagamento</label>
                  <select formControlName="paymentMethod" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2 py-2 text-zinc-900">
                    <option value="PIX">PIX</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cartão">Cartão</option>
                  </select>
                </div>
              </div>

              <div class="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
                <button type="button" (click)="showModal.set(false)" class="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold">Cancelar</button>
                <button type="submit" [disabled]="form.invalid" class="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold shadow-md">Salvar Pedido</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class DeliveryComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private fb = inject(FormBuilder);
  private context = inject(AppContextService);
  private txEngine = inject(TransactionEngine);
  private idGen = inject(IdGeneratorService);

  deliveries = signal<DeliveryOrder[]>([]);
  showModal = signal(false);

  pending = () => this.deliveries().filter(d => d.status === 'PENDENTE');
  ready = () => this.deliveries().filter(d => d.status === 'PRONTO');
  inRoute = () => this.deliveries().filter(d => d.status === 'EM_ROTA');
  delivered = () => this.deliveries().filter(d => d.status === 'ENTREGUE');

  form = this.fb.group({
    orderNumber: ['', Validators.required],
    customerName: ['', Validators.required],
    phone: ['', Validators.required],
    address: ['', Validators.required],
    courier: ['Marcos Motoboy'],
    orderAmount: [45.00, [Validators.required, Validators.min(0)]],
    deliveryFee: [7.00, [Validators.required, Validators.min(0)]],
    paymentMethod: ['PIX']
  });

  async ngOnInit() {
    await this.loadDeliveries();
  }

  async loadDeliveries() {
    if (!isPlatformBrowser(this.platformId)) return;
    const currentCompanyId = this.context.companyId();
    const list = await db.deliveryOrders.where('companyId').equals(currentCompanyId).toArray();
    this.deliveries.set(list.reverse());
  }

  openModal() {
    this.form.reset({
      orderNumber: this.idGen.generateTransactionCode('DEL'),
      customerName: '',
      phone: '',
      address: '',
      courier: 'Marcos Motoboy',
      orderAmount: 45.00,
      deliveryFee: 7.00,
      paymentMethod: 'PIX'
    });
    this.showModal.set(true);
  }

  async save() {
    if (this.form.invalid || !isPlatformBrowser(this.platformId)) return;
    const val = this.form.value;
    const now = Date.now();

    const newDel: DeliveryOrder = {
      id: this.idGen.generatePrefixedId('del'),
      companyId: this.context.companyId(),
      orderNumber: val.orderNumber || this.idGen.generateTransactionCode('DEL'),
      customerName: val.customerName!,
      phone: val.phone!,
      address: val.address!,
      courier: val.courier || 'Sem entregador',
      orderAmount: Number(val.orderAmount || 0),
      deliveryFee: Number(val.deliveryFee || 0),
      paymentMethod: val.paymentMethod || 'PIX',
      status: 'PENDENTE',
      createdAt: now
    };

    await this.txEngine.saveEntity('deliveryOrders', newDel, 'CREATE');
    this.showModal.set(false);
    await this.loadDeliveries();
  }

  async advanceStatus(d: DeliveryOrder, next: DeliveryOrder['status']) {
    if (!isPlatformBrowser(this.platformId)) return;
    const updated = { ...d, status: next };
    await this.txEngine.saveEntity('deliveryOrders', updated, 'UPDATE');
    await this.loadDeliveries();
  }

  getWhatsAppUrl(d: DeliveryOrder): string {
    const clean = d.phone.replace(/\D/g, '');
    const total = (d.orderAmount + d.deliveryFee).toFixed(2);
    const msg = encodeURIComponent(`Olá ${d.customerName}! Seu pedido ${d.orderNumber} está com status: *${d.status}*.\nTotal: R$ ${total}. Obrigado pela preferência!`);
    return `https://api.whatsapp.com/send?phone=55${clean}&text=${msg}`;
  }
}

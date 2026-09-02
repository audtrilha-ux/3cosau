import { Component, ChangeDetectionStrategy, signal, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { db } from '../../core/storage/dexie.db';
import { Product } from '../../core/models';
import { AppContextService } from '../../core/services/app-context.service';
import QRCode from 'qrcode';

@Component({
  selector: 'app-cardapio',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col bg-zinc-50 text-zinc-800 p-4 space-y-4 overflow-hidden select-none">
      <!-- Top Header -->
      <div class="flex items-center justify-between pb-3 border-b border-zinc-200 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
            <mat-icon>restaurant_menu</mat-icon>
          </div>
          <div>
            <h2 class="text-base font-bold text-zinc-900 leading-tight">Cardápio Digital & QR Hub</h2>
            <p class="text-xs text-zinc-500">Gestão de pratos, bebidas, estações KDS e gerador de displays de mesa</p>
          </div>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            (click)="activeTab.set('qr_hub')"
            [class.bg-purple-600]="activeTab() === 'qr_hub'"
            [class.text-white]="activeTab() === 'qr_hub'"
            [class.bg-white]="activeTab() !== 'qr_hub'"
            [class.text-zinc-700]="activeTab() !== 'qr_hub'"
            class="px-3.5 py-1.5 rounded-xl border border-zinc-200 text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
          >
            <mat-icon class="text-sm">qr_code_2</mat-icon>
            <span>Displays de Mesa QR</span>
          </button>
          <button
            type="button"
            (click)="activeTab.set('menu')"
            [class.bg-orange-600]="activeTab() === 'menu'"
            [class.text-white]="activeTab() === 'menu'"
            [class.bg-white]="activeTab() !== 'menu'"
            [class.text-zinc-700]="activeTab() !== 'menu'"
            class="px-3.5 py-1.5 rounded-xl border border-zinc-200 text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
          >
            <mat-icon class="text-sm">lunch_dining</mat-icon>
            <span>Itens do Cardápio</span>
          </button>
        </div>
      </div>

      <!-- MAIN TAB 1: MENU ITEMS -->
      @if (activeTab() === 'menu') {
        <div class="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pr-1">
          @for (prod of menuProducts(); track prod.id) {
            <div class="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm space-y-3 group hover:border-orange-300 transition-all">
              <div class="space-y-2">
                <div class="flex items-start justify-between gap-2">
                  <div class="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
                    <mat-icon class="text-xl">{{ prod.icon || 'fastfood' }}</mat-icon>
                  </div>
                  <div class="text-right">
                    <strong class="font-mono text-emerald-700 text-base font-black">R$ {{ prod.price.toFixed(2) }}</strong>
                    <div class="text-[10px] text-zinc-400 font-mono">Custo: R$ {{ prod.costPrice.toFixed(2) }}</div>
                  </div>
                </div>

                <div>
                  <h4 class="font-bold text-xs text-zinc-900 leading-snug group-hover:text-orange-700 transition-colors">{{ prod.name }}</h4>
                  <span class="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 font-medium inline-block mt-1">
                    {{ prod.category }}
                  </span>
                </div>
              </div>

              <div class="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs">
                <span
                  class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                  [class.bg-blue-100]="prod.kitchenStation === 'bar'"
                  [class.text-blue-800]="prod.kitchenStation === 'bar'"
                  [class.bg-rose-100]="prod.kitchenStation === 'chapa'"
                  [class.text-rose-800]="prod.kitchenStation === 'chapa'"
                  [class.bg-amber-100]="prod.kitchenStation !== 'bar' && prod.kitchenStation !== 'chapa'"
                  [class.text-amber-800]="prod.kitchenStation !== 'bar' && prod.kitchenStation !== 'chapa'"
                >
                  {{ prod.kitchenStation || 'Cozinha' }}
                </span>
                <span
                  class="text-[11px] font-bold"
                  [class.text-rose-600]="prod.stock <= prod.minStock"
                  [class.text-zinc-500]="prod.stock > prod.minStock"
                >
                  {{ prod.stock }} {{ prod.unit }}
                </span>
              </div>
            </div>
          } @empty {
            <div class="col-span-full py-16 text-center text-zinc-400">
              <mat-icon class="text-4xl mb-1 text-zinc-300">restaurant_menu</mat-icon>
              <p>Nenhum item marcado para o cardápio.</p>
            </div>
          }
        </div>
      }

      <!-- MAIN TAB 2: QR HUB -->
      @if (activeTab() === 'qr_hub') {
        <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto p-4 max-w-4xl mx-auto">
          <!-- Stand Preview 1: Mesa 1 -->
          <div class="bg-gradient-to-b from-zinc-900 to-black text-white p-6 rounded-3xl border-2 border-amber-500/40 shadow-xl flex flex-col items-center text-center space-y-4">
            <div class="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <mat-icon class="text-2xl">restaurant</mat-icon>
            </div>
            <div>
              <h3 class="text-base font-black">3eatcru Restaurante & Bar</h3>
              <span class="px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold font-mono">MESA 01</span>
            </div>

            <!-- Crisp QR simulation -->
            <div class="bg-white p-4 rounded-2xl inline-block shadow-lg">
              @if (qrMesa1()) {
                <img [src]="qrMesa1()" alt="QR Code Mesa 1" class="w-36 h-36" referrerpolicy="no-referrer" />
              } @else {
                <div class="w-36 h-36 flex items-center justify-center bg-zinc-100 text-zinc-400">
                  <mat-icon class="animate-spin">sync</mat-icon>
                </div>
              }
            </div>

            <div class="space-y-1">
              <p class="text-xs font-bold text-amber-400 uppercase">Aponte a câmera e veja o cardápio</p>
              <p class="text-[10px] text-zinc-400">Faça seu pedido diretamente e acompanhe o preparo em tempo real.</p>
            </div>

            <button type="button" (click)="printStand()" class="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md">
              <mat-icon class="text-sm">print</mat-icon>
              <span>Imprimir Placa de Mesa</span>
            </button>
          </div>

          <!-- Stand Preview 2: Balcão / Takeaway -->
          <div class="bg-gradient-to-b from-zinc-900 to-black text-white p-6 rounded-3xl border-2 border-cyan-500/40 shadow-xl flex flex-col items-center text-center space-y-4">
            <div class="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <mat-icon class="text-2xl">point_of_sale</mat-icon>
            </div>
            <div>
              <h3 class="text-base font-black">3eatcru Express</h3>
              <span class="px-3 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold font-mono">AUTOATENDIMENTO</span>
            </div>

            <!-- Crisp QR simulation -->
            <div class="bg-white p-4 rounded-2xl inline-block shadow-lg">
              @if (qrBalcao()) {
                <img [src]="qrBalcao()" alt="QR Code Balcao" class="w-36 h-36" referrerpolicy="no-referrer" />
              } @else {
                <div class="w-36 h-36 flex items-center justify-center bg-zinc-100 text-zinc-400">
                  <mat-icon class="animate-spin">sync</mat-icon>
                </div>
              }
            </div>

            <div class="space-y-1">
              <p class="text-xs font-bold text-cyan-400 uppercase">Peça & Pague pelo Smartphone</p>
              <p class="text-[10px] text-zinc-400">Retire seu pedido no balcão quando seu número for chamado no display.</p>
            </div>

            <button type="button" (click)="printStand()" class="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md">
              <mat-icon class="text-sm">print</mat-icon>
              <span>Imprimir Placa de Balcão</span>
            </button>
          </div>
        </div>
      }
    </div>
  `
})
export class CardapioComponent implements OnInit {
  private context = inject(AppContextService);
  private platformId = inject(PLATFORM_ID);

  products = signal<Product[]>([]);
  activeTab = signal<'menu' | 'qr_hub'>('menu');
  qrMesa1 = signal<string>('');
  qrBalcao = signal<string>('');

  menuProducts = () => this.products().filter(p => p.isMenuItem !== false);

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      await this.loadProducts();
      await this.generateQRs();
    }
  }

  async loadProducts() {
    if (!isPlatformBrowser(this.platformId)) return;
    const currentCompanyId = this.context.companyId();
    const list = await db.products.where('companyId').equals(currentCompanyId).toArray();
    this.products.set(list);
  }

  async generateQRs() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const mesa1Url = await QRCode.toDataURL('https://3eatcru.os/cardapio/mesa-1', { width: 160, margin: 1 });
      const balcaoUrl = await QRCode.toDataURL('https://3eatcru.os/cardapio/balcao', { width: 160, margin: 1 });
      this.qrMesa1.set(mesa1Url);
      this.qrBalcao.set(balcaoUrl);
    } catch (err) {
      console.error('[CardapioComponent] Error generating local QR Codes:', err);
    }
  }

  printStand() {
    if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined') {
      window.print();
    }
  }
}

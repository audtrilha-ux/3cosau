import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { db } from '../../core/storage/dexie.db';
import { ManufacturingOrder } from '../../core/models';
import { AppContextService } from '../../core/services/app-context.service';
import { TransactionEngine } from '../../core/workflow/transaction.engine';
import { IdGeneratorService } from '../../core/services/id-generator.service';

@Component({
  selector: 'app-fabricacao',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col bg-zinc-50 text-zinc-800 p-4 space-y-4 overflow-hidden select-none font-sans">
      <!-- Top Header -->
      <div class="flex items-center justify-between pb-3 border-b border-zinc-200 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
            <mat-icon>factory</mat-icon>
          </div>
          <div>
            <h2 class="text-base font-bold text-zinc-900 leading-tight">Produção & Engenharia de Produtos (MRP)</h2>
            <p class="text-xs text-zinc-500">Ordens de Fabricação (OF), fichas técnicas/receitas e baixa automática de insumos</p>
          </div>
        </div>
        <button
          type="button"
          (click)="openModal()"
          class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <mat-icon class="text-sm">add_circle</mat-icon>
          <span>Nova Ordem de Fabricação</span>
        </button>
      </div>

      <!-- Feedback Banner -->
      @if (feedbackMsg()) {
        <div class="px-4 py-2.5 bg-purple-50 border border-purple-200 text-purple-900 rounded-xl text-xs font-bold flex items-center justify-between animate-fade-in shrink-0">
          <div class="flex items-center gap-2">
            <mat-icon class="text-purple-600 text-base">check_circle</mat-icon>
            <span>{{ feedbackMsg() }}</span>
          </div>
          <button (click)="feedbackMsg.set('')" class="text-purple-700 hover:text-purple-900 cursor-pointer">
            <mat-icon class="text-xs">close</mat-icon>
          </button>
        </div>
      }

      <!-- KPI Summary Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Rascunhos</div>
            <div class="text-lg font-black text-amber-600 font-mono">{{ draftOrders().length }}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><mat-icon class="text-base">sticky_note_2</mat-icon></div>
        </div>
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Em Andamento na Fila</div>
            <div class="text-lg font-black text-blue-600 font-mono">{{ activeOrders().length }}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><mat-icon class="text-base">autorenew</mat-icon></div>
        </div>
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Lotes Concluídos</div>
            <div class="text-lg font-black text-emerald-600 font-mono">{{ completedOrders().length }}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><mat-icon class="text-base">check_circle</mat-icon></div>
        </div>
      </div>

      <!-- Orders List -->
      <div class="flex-1 bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-0">
        <div class="overflow-y-auto flex-1">
          <table class="w-full text-left text-xs text-zinc-700">
            <thead class="bg-zinc-50 text-zinc-500 uppercase tracking-wider text-[10px] border-b border-zinc-200 sticky top-0">
              <tr>
                <th class="p-3">OF / Data</th>
                <th class="p-3">Produto Final</th>
                <th class="p-3">Lote (Quantidade)</th>
                <th class="p-3">Insumos e Matérias-Primas</th>
                <th class="p-3">Status</th>
                <th class="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-100 font-sans">
              @for (of of orders(); track of.id) {
                <tr class="hover:bg-purple-50/40 transition-colors">
                  <td class="p-3">
                    <div class="font-bold text-zinc-900 font-mono">OF-{{ of.id.substring(3, 8).toUpperCase() }}</div>
                    <div class="text-[10px] text-zinc-400">{{ of.createdAt | date:'dd/MM/yyyy HH:mm' }}</div>
                  </td>
                  <td class="p-3 font-bold text-purple-900">{{ of.productName }}</td>
                  <td class="p-3 font-mono font-bold text-zinc-800">{{ of.quantity }} unidades</td>
                  <td class="p-3">
                    <div class="flex flex-wrap gap-1">
                      @for (comp of of.components; track comp.name) {
                        <span class="px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 text-[10px] text-zinc-600">
                          {{ comp.name }} ({{ (comp.qtyRequired * of.quantity) | number:'1.2-2' }})
                        </span>
                      }
                    </div>
                  </td>
                  <td class="p-3">
                    <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase"
                          [class.bg-emerald-100]="of.status === 'CONCLUIDO'"
                          [class.text-emerald-800]="of.status === 'CONCLUIDO'"
                          [class.bg-blue-100]="of.status === 'EM_ANDAMENTO'"
                          [class.text-blue-800]="of.status === 'EM_ANDAMENTO'"
                          [class.bg-amber-100]="of.status === 'RASCUNHO'"
                          [class.text-amber-800]="of.status === 'RASCUNHO'">
                      {{ of.status }}
                    </span>
                  </td>
                  <td class="p-3 text-right space-x-1.5">
                    @if (of.status === 'RASCUNHO') {
                      <button (click)="advance(of, 'EM_ANDAMENTO')" class="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs cursor-pointer">
                        Iniciar
                      </button>
                    }
                    @if (of.status === 'EM_ANDAMENTO') {
                      <button (click)="finalize(of)" [disabled]="isSubmitting() === of.id" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs cursor-pointer flex items-center gap-1 inline-flex">
                        <mat-icon class="text-xs">check</mat-icon> Concluir
                      </button>
                    }
                    <button (click)="deleteOrder(of.id)" class="p-1 text-zinc-400 hover:text-rose-600 cursor-pointer">
                      <mat-icon class="text-sm">delete</mat-icon>
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="p-12 text-center text-zinc-400">
                    <mat-icon class="text-4xl mb-1 text-zinc-300">factory</mat-icon>
                    <p>Nenhuma ordem de fabricação ativa.</p>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Add OF Modal -->
      @if (showModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div class="bg-white border border-zinc-200 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 class="text-sm font-bold text-zinc-900">Nova Ordem de Fabricação (OF)</h3>
              <button (click)="showModal.set(false)" class="text-zinc-400 hover:text-zinc-600"><mat-icon>close</mat-icon></button>
            </div>

            <form [formGroup]="form" (ngSubmit)="save()" class="space-y-3 text-xs">
              <div>
                <label class="block font-semibold text-zinc-700 mb-1">Produto a Produzir *</label>
                <input type="text" formControlName="productName" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900" placeholder="Ex: Hambúrguer Artesanal Blend 150g" />
              </div>

              <div>
                <label class="block font-semibold text-zinc-700 mb-1">Quantidade de Lote *</label>
                <input type="number" formControlName="quantity" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-mono" />
              </div>

              <div class="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
                <button type="button" (click)="showModal.set(false)" class="px-4 py-2 rounded-xl bg-zinc-100 text-zinc-700 font-bold">Cancelar</button>
                <button type="submit" [disabled]="form.invalid" class="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold shadow-xs">Criar Ordem</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class FabricacaoComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private fb = inject(FormBuilder);
  private context = inject(AppContextService);
  private txEngine = inject(TransactionEngine);
  private idGen = inject(IdGeneratorService);

  orders = signal<ManufacturingOrder[]>([]);
  showModal = signal(false);
  feedbackMsg = signal('');
  isSubmitting = signal<string | null>(null);

  draftOrders = computed(() => this.orders().filter(o => o.status === 'RASCUNHO'));
  activeOrders = computed(() => this.orders().filter(o => o.status === 'EM_ANDAMENTO'));
  completedOrders = computed(() => this.orders().filter(o => o.status === 'CONCLUIDO'));

  form = this.fb.group({
    productName: ['', Validators.required],
    quantity: [50, [Validators.required, Validators.min(1)]]
  });

  async ngOnInit() {
    await this.loadOrders();
  }

  async loadOrders() {
    if (!isPlatformBrowser(this.platformId)) return;
    const currentCompanyId = this.context.companyId();
    const list = await db.manufacturingOrders.where('companyId').equals(currentCompanyId).toArray();
    this.orders.set(list.reverse());
  }

  openModal() {
    this.form.reset({
      productName: 'Hambúrguer Artesanal Blend 150g',
      quantity: 50
    });
    this.showModal.set(true);
  }

  async save() {
    if (this.form.invalid || !isPlatformBrowser(this.platformId)) return;
    const val = this.form.value;
    const now = Date.now();

    const newOf: ManufacturingOrder = {
      id: this.idGen.generatePrefixedId('of'),
      companyId: this.context.companyId(),
      productName: val.productName!,
      quantity: Number(val.quantity || 50),
      components: [
        { productId: 'prod-blend-mock', name: 'Blend Bovino 150g', qtyRequired: 0.150 },
        { productId: 'prod-pao-mock', name: 'Pão Brioche', qtyRequired: 1 }
      ],
      status: 'RASCUNHO',
      createdAt: now
    };

    await this.txEngine.saveEntity('manufacturingOrders', newOf, 'CREATE');
    this.showModal.set(false);
    this.feedbackMsg.set(`Ordem de Fabricação criada com sucesso!`);
    await this.loadOrders();
  }

  async advance(of: ManufacturingOrder, next: ManufacturingOrder['status']) {
    if (!isPlatformBrowser(this.platformId)) return;
    const updated = { ...of, status: next };
    await this.txEngine.saveEntity('manufacturingOrders', updated, 'UPDATE');
    await this.loadOrders();
  }

  async finalize(of: ManufacturingOrder) {
    if (this.isSubmitting() === of.id) return;
    if (!isPlatformBrowser(this.platformId)) return;

    this.isSubmitting.set(of.id);

    try {
      await this.txEngine.finalizeManufacturingOrder(of.id);
      this.feedbackMsg.set(`OF #${of.id.substring(3, 8).toUpperCase()} concluída com baixa nos insumos!`);
      await this.loadOrders();
    } catch (err: any) {
      console.error('[Fabricacao] Error finalizing OF:', err);
      this.feedbackMsg.set('Erro ao concluir ordem de fabricação: ' + err.message);
    } finally {
      this.isSubmitting.set(null);
    }
  }

  async deleteOrder(id: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    await this.txEngine.deleteEntity('manufacturingOrders', id);
    await this.loadOrders();
  }
}

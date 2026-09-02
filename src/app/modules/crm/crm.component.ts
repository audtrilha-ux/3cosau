import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { db } from '../../core/storage/dexie.db';
import { CrmLead, Customer } from '../../core/models';
import { AppContextService } from '../../core/services/app-context.service';
import { TransactionEngine } from '../../core/workflow/transaction.engine';
import { IdGeneratorService } from '../../core/services/id-generator.service';

@Component({
  selector: 'app-crm',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col bg-zinc-50 text-zinc-800 p-4 space-y-4 overflow-hidden select-none font-sans">
      <!-- Top Header -->
      <div class="flex items-center justify-between pb-3 border-b border-zinc-200 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
            <mat-icon>trending_up</mat-icon>
          </div>
          <div>
            <h2 class="text-base font-bold text-zinc-900 leading-tight">CRM & Pipeline de Oportunidades</h2>
            <p class="text-xs text-zinc-500">Funil de vendas B2B, propostas e conversão automática para a base de clientes</p>
          </div>
        </div>
        <button
          type="button"
          (click)="openModal()"
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <mat-icon class="text-sm">add</mat-icon>
          <span>Nova Oportunidade</span>
        </button>
      </div>

      <!-- Toast Feedback Message -->
      @if (feedbackMsg()) {
        <div class="px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between animate-fade-in shrink-0">
          <div class="flex items-center gap-2">
            <mat-icon class="text-emerald-600 text-base">check_circle</mat-icon>
            <span>{{ feedbackMsg() }}</span>
          </div>
          <button (click)="feedbackMsg.set('')" class="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <mat-icon class="text-xs">close</mat-icon>
          </button>
        </div>
      }

      <!-- KPI Summary Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 shrink-0">
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Total no Pipeline</div>
            <div class="text-lg font-black text-indigo-700 font-mono">R$ {{ totalPipelineValue().toFixed(2) }}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><mat-icon class="text-base">account_balance_wallet</mat-icon></div>
        </div>
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Propostas Enviadas</div>
            <div class="text-lg font-black text-amber-600 font-mono">R$ {{ stageValue('proposta').toFixed(2) }}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><mat-icon class="text-base">description</mat-icon></div>
        </div>
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Ganhos / Fechados</div>
            <div class="text-lg font-black text-emerald-600 font-mono">R$ {{ stageValue('ganho').toFixed(2) }}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><mat-icon class="text-base">verified</mat-icon></div>
        </div>
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Taxa de Conversão</div>
            <div class="text-lg font-black text-blue-600 font-mono">{{ conversionRate() }}%</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><mat-icon class="text-base">pie_chart</mat-icon></div>
        </div>
      </div>

      <!-- Kanban Columns -->
      <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-h-0 overflow-hidden">
        <!-- 1. Leads Novos -->
        <div class="bg-white rounded-2xl border border-zinc-200 p-3 flex flex-col shadow-xs">
          <div class="flex items-center justify-between pb-2 border-b border-zinc-100 mb-2">
            <span class="text-xs font-bold text-zinc-700 uppercase flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-zinc-400"></span> Leads Novos
            </span>
            <span class="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 font-mono text-[10px] font-bold">
              {{ getByStage('lead').length }}
            </span>
          </div>
          <div class="flex-1 overflow-y-auto space-y-2 pr-1">
            @for (l of getByStage('lead'); track l.id) {
              <div class="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2 shadow-xs">
                <div class="flex justify-between items-start">
                  <div class="font-bold text-xs text-zinc-900">{{ l.clientName }}</div>
                  <span class="text-[10px] font-mono font-bold text-zinc-400">{{ l.probability }}%</span>
                </div>
                <div class="text-[11px] text-indigo-700 font-medium flex items-center gap-1">
                  <mat-icon class="text-[12px]">business</mat-icon> {{ l.company }}
                </div>
                <div class="flex justify-between items-center pt-2 border-t border-zinc-200 text-xs">
                  <strong class="font-mono text-zinc-900">R$ {{ l.value.toFixed(2) }}</strong>
                  <button (click)="move(l.id, 'qualificado')" class="px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded font-bold text-[10px] cursor-pointer">
                    Qualificar →
                  </button>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- 2. Qualificados -->
        <div class="bg-white rounded-2xl border border-zinc-200 p-3 flex flex-col shadow-xs">
          <div class="flex items-center justify-between pb-2 border-b border-zinc-100 mb-2">
            <span class="text-xs font-bold text-zinc-700 uppercase flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-blue-500"></span> Qualificados
            </span>
            <span class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono text-[10px] font-bold">
              {{ getByStage('qualificado').length }}
            </span>
          </div>
          <div class="flex-1 overflow-y-auto space-y-2 pr-1">
            @for (l of getByStage('qualificado'); track l.id) {
              <div class="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2 shadow-xs">
                <div class="flex justify-between items-start">
                  <div class="font-bold text-xs text-zinc-900">{{ l.clientName }}</div>
                  <span class="text-[10px] font-mono font-bold text-blue-500">{{ l.probability }}%</span>
                </div>
                <div class="text-[11px] text-blue-700 font-medium flex items-center gap-1">
                  <mat-icon class="text-[12px]">business</mat-icon> {{ l.company }}
                </div>
                <div class="flex justify-between items-center pt-2 border-t border-zinc-200 text-xs">
                  <strong class="font-mono text-zinc-900">R$ {{ l.value.toFixed(2) }}</strong>
                  <button (click)="move(l.id, 'proposta')" class="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded font-bold text-[10px] cursor-pointer">
                    Proposta →
                  </button>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- 3. Proposta Enviada -->
        <div class="bg-white rounded-2xl border border-zinc-200 p-3 flex flex-col shadow-xs">
          <div class="flex items-center justify-between pb-2 border-b border-zinc-100 mb-2">
            <span class="text-xs font-bold text-zinc-700 uppercase flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-amber-500"></span> Propostas
            </span>
            <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono text-[10px] font-bold">
              {{ getByStage('proposta').length }}
            </span>
          </div>
          <div class="flex-1 overflow-y-auto space-y-2 pr-1">
            @for (l of getByStage('proposta'); track l.id) {
              <div class="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2 shadow-xs">
                <div class="flex justify-between items-start">
                  <div class="font-bold text-xs text-zinc-900">{{ l.clientName }}</div>
                  <span class="text-[10px] font-mono font-bold text-amber-600">{{ l.probability }}%</span>
                </div>
                <div class="text-[11px] text-amber-800 font-medium flex items-center gap-1">
                  <mat-icon class="text-[12px]">business</mat-icon> {{ l.company }}
                </div>
                <div class="flex justify-between items-center pt-2 border-t border-zinc-200 text-xs">
                  <strong class="font-mono text-zinc-900">R$ {{ l.value.toFixed(2) }}</strong>
                  <button (click)="move(l.id, 'ganho')" class="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-bold text-[10px] cursor-pointer">
                    Ganho ✓
                  </button>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- 4. Contratos Ganhos -->
        <div class="bg-white rounded-2xl border border-zinc-200 p-3 flex flex-col shadow-xs">
          <div class="flex items-center justify-between pb-2 border-b border-zinc-100 mb-2">
            <span class="text-xs font-bold text-zinc-700 uppercase flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Fechados / Ganhos
            </span>
            <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
              {{ getByStage('ganho').length }}
            </span>
          </div>
          <div class="flex-1 overflow-y-auto space-y-2 pr-1">
            @for (l of getByStage('ganho'); track l.id) {
              <div class="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3 space-y-2 shadow-xs">
                <div class="flex justify-between items-start">
                  <div class="font-bold text-xs text-zinc-900">{{ l.clientName }}</div>
                  <span class="px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-800 text-[9px] font-bold">FECHADO</span>
                </div>
                <div class="text-[11px] text-zinc-600 flex items-center gap-1">
                  <mat-icon class="text-[12px]">business</mat-icon> {{ l.company }}
                </div>
                <div class="flex justify-between items-center pt-2 border-t border-emerald-100 text-xs">
                  <strong class="font-mono text-emerald-800">R$ {{ l.value.toFixed(2) }}</strong>
                  @if (!l.customerId) {
                    <button (click)="convertToCustomer(l)" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px] cursor-pointer flex items-center gap-0.5">
                      <mat-icon class="text-[11px]">person_add</mat-icon> Criar Cliente
                    </button>
                  } @else {
                    <span class="text-[10px] text-emerald-700 font-bold">Cliente Ativo</span>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Add Lead Modal -->
      @if (showModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div class="bg-white border border-zinc-200 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 class="text-sm font-bold text-zinc-900">Nova Oportunidade Comercial</h3>
              <button (click)="showModal.set(false)" class="text-zinc-400 hover:text-zinc-600">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <form [formGroup]="form" (ngSubmit)="saveLead()" class="space-y-3 text-xs">
              <div>
                <label class="block font-semibold text-zinc-700 mb-1">Nome do Contato / Decisor *</label>
                <input type="text" formControlName="clientName" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900" placeholder="Ex: Leonardo Mendes" />
              </div>

              <div>
                <label class="block font-semibold text-zinc-700 mb-1">Empresa / Razão Social *</label>
                <input type="text" formControlName="company" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900" placeholder="Ex: Supermercados Alvorada" />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Telefone / WhatsApp</label>
                  <input type="text" formControlName="phone" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-mono" placeholder="(11) 99999-8888" />
                </div>
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">E-mail</label>
                  <input type="email" formControlName="email" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900" placeholder="contato@empresa.com" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Valor Estimado (R$)</label>
                  <input type="number" step="100" formControlName="value" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-mono" />
                </div>
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Estágio Inicial</label>
                  <select formControlName="stage" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900">
                    <option value="lead">Lead Novo</option>
                    <option value="qualificado">Qualificado</option>
                    <option value="proposta">Proposta</option>
                    <option value="ganho">Ganho</option>
                  </select>
                </div>
              </div>

              <div class="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
                <button type="button" (click)="showModal.set(false)" class="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold">Cancelar</button>
                <button type="submit" [disabled]="form.invalid" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold shadow-xs">Salvar Oportunidade</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class CrmComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private fb = inject(FormBuilder);
  private context = inject(AppContextService);
  private txEngine = inject(TransactionEngine);
  private idGen = inject(IdGeneratorService);

  leads = signal<CrmLead[]>([]);
  showModal = signal(false);
  feedbackMsg = signal('');

  totalPipelineValue = computed(() => this.leads().reduce((acc, l) => acc + l.value, 0));
  getByStage = (st: CrmLead['stage']) => this.leads().filter(l => l.stage === st);
  stageValue = (st: CrmLead['stage']) => this.getByStage(st).reduce((acc, l) => acc + l.value, 0);
  conversionRate = computed(() => {
    const total = this.leads().length;
    if (total === 0) return 0;
    return Math.round((this.getByStage('ganho').length / total) * 100);
  });

  form = this.fb.group({
    clientName: ['', Validators.required],
    company: ['', Validators.required],
    phone: [''],
    email: [''],
    value: [5000.00, [Validators.required, Validators.min(0)]],
    stage: ['lead' as CrmLead['stage']]
  });

  async ngOnInit() {
    await this.loadLeads();
  }

  async loadLeads() {
    if (!isPlatformBrowser(this.platformId)) return;
    const currentCompanyId = this.context.companyId();
    const list = await db.crmLeads.where('companyId').equals(currentCompanyId).toArray();
    this.leads.set(list.reverse());
  }

  openModal() {
    this.form.reset({
      clientName: '',
      company: '',
      phone: '',
      email: '',
      value: 5000.00,
      stage: 'lead'
    });
    this.showModal.set(true);
  }

  async saveLead() {
    if (this.form.invalid || !isPlatformBrowser(this.platformId)) return;
    const val = this.form.value;
    const now = Date.now();
    const probMap: Record<CrmLead['stage'], number> = { lead: 30, qualificado: 60, proposta: 80, ganho: 100 };

    const newLead: CrmLead = {
      id: this.idGen.generatePrefixedId('lead'),
      companyId: this.context.companyId(),
      clientName: val.clientName!,
      company: val.company!,
      phone: val.phone || '',
      email: val.email || '',
      value: Number(val.value || 0),
      stage: val.stage || 'lead',
      probability: probMap[val.stage || 'lead'],
      createdAt: now
    };

    await this.txEngine.saveEntity('crmLeads', newLead, 'CREATE');
    this.showModal.set(false);
    this.feedbackMsg.set(`Oportunidade para "${newLead.clientName}" salva com sucesso!`);
    await this.loadLeads();
  }

  async move(id: string, next: CrmLead['stage']) {
    if (!isPlatformBrowser(this.platformId)) return;
    const probMap: Record<CrmLead['stage'], number> = { lead: 30, qualificado: 60, proposta: 80, ganho: 100 };
    const lead = await db.crmLeads.get(id);
    if (lead) {
      const updated = { ...lead, stage: next, probability: probMap[next] };
      await this.txEngine.saveEntity('crmLeads', updated, 'UPDATE');
    }
    await this.loadLeads();
  }

  async convertToCustomer(l: CrmLead) {
    if (!isPlatformBrowser(this.platformId)) return;
    const now = Date.now();
    const newCust: Customer = {
      id: this.idGen.generatePrefixedId('cust'),
      companyId: this.context.companyId(),
      name: l.clientName,
      phone: l.phone,
      email: l.email,
      creditLimit: 1000.00,
      currentDebt: 0.00,
      blocked: false,
      notes: `Convertido do CRM (Empresa: ${l.company})`,
      createdAt: now,
      updatedAt: now
    };

    await this.txEngine.saveEntity('customers', newCust, 'CREATE');
    const updatedLead = { ...l, customerId: newCust.id };
    await this.txEngine.saveEntity('crmLeads', updatedLead, 'UPDATE');
    await this.loadLeads();
    this.feedbackMsg.set(`Cliente "${newCust.name}" cadastrado com sucesso na base!`);
  }
}

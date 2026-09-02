import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { db } from '../../core/storage/dexie.db';
import { LoyaltyMember, LoyaltyReward, LoyaltyVoucher, LoyaltyTier } from '../../core/models';
import { AppContextService } from '../../core/services/app-context.service';
import { TransactionEngine } from '../../core/workflow/transaction.engine';
import { IdGeneratorService } from '../../core/services/id-generator.service';

@Component({
  selector: 'app-fidelidade',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col bg-zinc-50 text-zinc-800 p-4 space-y-4 overflow-hidden select-none font-sans">
      <!-- Top Header -->
      <div class="flex items-center justify-between pb-3 border-b border-zinc-200 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <mat-icon>loyalty</mat-icon>
          </div>
          <div>
            <h2 class="text-base font-bold text-zinc-900 leading-tight">Clube de Fidelidade & Vouchers VIP</h2>
            <p class="text-xs text-zinc-500">Gestão de pontos, cashback progressivo por níveis (Bronze/Prata/Ouro/Diamante) e resgates</p>
          </div>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            (click)="showValidatorModal.set(true)"
            class="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <mat-icon class="text-sm">qr_code_scanner</mat-icon>
            <span>Validar Voucher</span>
          </button>
          <button
            type="button"
            (click)="openMemberModal()"
            class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <mat-icon class="text-sm">person_add</mat-icon>
            <span>Novo Membro</span>
          </button>
        </div>
      </div>

      <!-- Feedback Banner -->
      @if (feedbackMsg()) {
        <div class="px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold flex items-center justify-between animate-fade-in shrink-0">
          <div class="flex items-center gap-2">
            <mat-icon class="text-amber-600 text-base">info</mat-icon>
            <span>{{ feedbackMsg() }}</span>
          </div>
          <button (click)="feedbackMsg.set('')" class="text-amber-700 hover:text-amber-900 cursor-pointer">
            <mat-icon class="text-xs">close</mat-icon>
          </button>
        </div>
      }

      <!-- KPI Summary Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 shrink-0">
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Membros Fidelizados</div>
            <div class="text-lg font-black text-zinc-900 font-mono">{{ members().length }}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-600 flex items-center justify-center"><mat-icon class="text-base">groups</mat-icon></div>
        </div>
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Pontos em Circulação</div>
            <div class="text-lg font-black text-amber-600 font-mono">{{ totalPoints() }} pts</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><mat-icon class="text-base">stars</mat-icon></div>
        </div>
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Cashback Total Gerado</div>
            <div class="text-lg font-black text-emerald-600 font-mono">R$ {{ totalCashback().toFixed(2) }}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><mat-icon class="text-base">savings</mat-icon></div>
        </div>
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Vouchers Ativos</div>
            <div class="text-lg font-black text-cyan-600 font-mono">{{ activeVouchers().length }}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center"><mat-icon class="text-base">confirmation_number</mat-icon></div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex items-center gap-2 border-b border-zinc-200 pb-2">
        <button
          type="button"
          (click)="activeTab.set('members')"
          [class.bg-amber-500/20]="activeTab() === 'members'"
          [class.text-amber-800]="activeTab() === 'members'"
          [class.border-amber-500/40]="activeTab() === 'members'"
          [class.font-bold]="activeTab() === 'members'"
          [class.border]="activeTab() === 'members'"
          [class.text-zinc-500]="activeTab() !== 'members'"
          class="px-4 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <mat-icon class="text-sm">people</mat-icon>
          <span>Membros do Clube</span>
        </button>
        <button
          type="button"
          (click)="activeTab.set('rewards')"
          [class.bg-amber-500/20]="activeTab() === 'rewards'"
          [class.text-amber-800]="activeTab() === 'rewards'"
          [class.border-amber-500/40]="activeTab() === 'rewards'"
          [class.font-bold]="activeTab() === 'rewards'"
          [class.border]="activeTab() === 'rewards'"
          [class.text-zinc-500]="activeTab() !== 'rewards'"
          class="px-4 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <mat-icon class="text-sm">card_giftcard</mat-icon>
          <span>Catálogo de Prêmios ({{ rewards().length }})</span>
        </button>
        <button
          type="button"
          (click)="activeTab.set('vouchers')"
          [class.bg-amber-500/20]="activeTab() === 'vouchers'"
          [class.text-amber-800]="activeTab() === 'vouchers'"
          [class.border-amber-500/40]="activeTab() === 'vouchers'"
          [class.font-bold]="activeTab() === 'vouchers'"
          [class.border]="activeTab() === 'vouchers'"
          [class.text-zinc-500]="activeTab() !== 'vouchers'"
          class="px-4 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <mat-icon class="text-sm">confirmation_number</mat-icon>
          <span>Vouchers Emitidos ({{ vouchers().length }})</span>
        </button>
      </div>

      <!-- TAB 1: MEMBERS -->
      @if (activeTab() === 'members') {
        <div class="flex-1 bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-0">
          <div class="overflow-y-auto flex-1">
            <table class="w-full text-left text-xs text-zinc-700">
              <thead class="bg-zinc-50 text-zinc-500 uppercase tracking-wider text-[10px] border-b border-zinc-200 sticky top-0">
                <tr>
                  <th class="p-3">Membro VIP</th>
                  <th class="p-3">Telefone / CPF</th>
                  <th class="p-3">Nível (Tier)</th>
                  <th class="p-3 text-right">Saldo Pontos</th>
                  <th class="p-3 text-right">Cashback</th>
                  <th class="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-100 font-sans">
                @for (m of members(); track m.id) {
                  <tr class="hover:bg-amber-50/40 transition-colors">
                    <td class="p-3 font-bold text-zinc-900">{{ m.name }}</td>
                    <td class="p-3 font-mono text-zinc-600">{{ m.phone }} {{ m.cpf ? '• ' + m.cpf : '' }}</td>
                    <td class="p-3">
                      <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase {{ getTierBadge(m.tier) }}">
                        {{ m.tier }}
                      </span>
                    </td>
                    <td class="p-3 text-right font-black text-amber-600 font-mono text-sm">{{ m.pointsBalance }} pts</td>
                    <td class="p-3 text-right font-mono text-emerald-700 font-bold">R$ {{ m.totalCashbackEarned.toFixed(2) }}</td>
                    <td class="p-3 text-right space-x-1.5">
                      <button (click)="openIssueVoucher(m)" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] cursor-pointer inline-flex items-center gap-1">
                        <mat-icon class="text-xs">card_giftcard</mat-icon> Resgatar
                      </button>
                      <button (click)="addPoints(m, 50)" class="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg font-bold text-[11px] cursor-pointer">
                        +50 pts
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- TAB 2: REWARDS -->
      @if (activeTab() === 'rewards') {
        <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-y-auto pr-1">
          @for (r of rewards(); track r.id) {
            <div class="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col justify-between shadow-xs space-y-3">
              <div>
                <span class="text-[9px] uppercase font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{{ r.category }}</span>
                <h4 class="font-bold text-sm text-zinc-900 mt-2">{{ r.title }}</h4>
                <p class="text-xs text-zinc-500 mt-1 leading-relaxed">{{ r.description }}</p>
              </div>
              <div class="pt-3 border-t border-zinc-100 flex items-center justify-between">
                <div>
                  <span class="text-[10px] text-zinc-400 uppercase font-bold">Custo</span>
                  <div class="font-black text-amber-600 font-mono text-base">{{ r.pointsRequired }} pts</div>
                </div>
                <div class="text-right">
                  <span class="text-[10px] text-zinc-400 uppercase font-bold">Validade</span>
                  <div class="text-xs font-semibold text-zinc-700">{{ r.validityDays }} dias</div>
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- TAB 3: VOUCHERS -->
      @if (activeTab() === 'vouchers') {
        <div class="flex-1 bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-0">
          <div class="overflow-y-auto flex-1">
            <table class="w-full text-left text-xs text-zinc-700">
              <thead class="bg-zinc-50 text-zinc-500 uppercase tracking-wider text-[10px] border-b border-zinc-200 sticky top-0">
                <tr>
                  <th class="p-3">Código</th>
                  <th class="p-3">Membro</th>
                  <th class="p-3">Benefício</th>
                  <th class="p-3 text-right">Pontos</th>
                  <th class="p-3">Status</th>
                  <th class="p-3 text-right">Validade</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-100 font-sans">
                @for (v of vouchers(); track v.id) {
                  <tr class="hover:bg-zinc-50">
                    <td class="p-3 font-mono font-bold text-zinc-900">{{ v.code }}</td>
                    <td class="p-3 font-semibold text-zinc-800">{{ v.memberName }}</td>
                    <td class="p-3 font-bold text-amber-700">{{ v.rewardTitle }}</td>
                    <td class="p-3 text-right font-mono text-amber-600 font-bold">{{ v.pointsSpent }} pts</td>
                    <td class="p-3">
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase {{ v.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : (v.status === 'REDEEMED' ? 'bg-zinc-200 text-zinc-600' : 'bg-rose-100 text-rose-800') }}">
                        {{ v.status === 'ACTIVE' ? 'Ativo' : (v.status === 'REDEEMED' ? 'Utilizado' : 'Expirado') }}
                      </span>
                    </td>
                    <td class="p-3 text-right text-zinc-500 font-mono">{{ v.expiresAt | date:'dd/MM/yyyy' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- Modal Add Member -->
      @if (showMemberModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div class="bg-white border border-zinc-200 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 class="text-sm font-bold text-zinc-900">Novo Membro VIP</h3>
              <button (click)="showMemberModal.set(false)" class="text-zinc-400 hover:text-zinc-600"><mat-icon>close</mat-icon></button>
            </div>

            <form [formGroup]="memberForm" (ngSubmit)="saveMember()" class="space-y-3 text-xs">
              <div>
                <label class="block font-semibold text-zinc-700 mb-1">Nome Completo *</label>
                <input type="text" formControlName="name" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900" placeholder="Nome do cliente" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Telefone *</label>
                  <input type="text" formControlName="phone" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-mono" placeholder="(11) 99999-9999" />
                </div>
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">CPF</label>
                  <input type="text" formControlName="cpf" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-mono" placeholder="000.000.000-00" />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Nível Inicial</label>
                  <select formControlName="tier" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900">
                    <option value="BRONZE">Bronze</option>
                    <option value="PRATA">Prata</option>
                    <option value="OURO">Ouro</option>
                    <option value="DIAMANTE">Diamante</option>
                  </select>
                </div>
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Pontos Iniciais</label>
                  <input type="number" formControlName="initialPoints" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-mono" />
                </div>
              </div>

              <div class="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
                <button type="button" (click)="showMemberModal.set(false)" class="px-4 py-2 rounded-xl bg-zinc-100 text-zinc-700 font-bold">Cancelar</button>
                <button type="submit" [disabled]="memberForm.invalid" class="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-zinc-950 font-bold shadow-xs">Salvar Membro</button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Modal Validator Voucher -->
      @if (showValidatorModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div class="bg-white border border-zinc-200 rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 class="text-sm font-bold text-zinc-900">Validar & Resgatar Voucher</h3>
              <button (click)="showValidatorModal.set(false)" class="text-zinc-400 hover:text-zinc-600"><mat-icon>close</mat-icon></button>
            </div>

            <div class="space-y-3 text-xs">
              <div>
                <label class="block font-semibold text-zinc-700 mb-1">Código do Cupom</label>
                <input type="text" [value]="voucherInputCode()" (input)="voucherInputCode.set($any($event.target).value)" (keyup.enter)="validateVoucher()" placeholder="Ex: VIP-7821-KLA" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-zinc-900 font-mono text-base font-bold uppercase" />
              </div>
              <button type="button" (click)="validateVoucher()" class="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-xl shadow-xs cursor-pointer">
                Confirmar no Caixa
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class FidelidadeComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private fb = inject(FormBuilder);
  private context = inject(AppContextService);
  private txEngine = inject(TransactionEngine);
  private idGen = inject(IdGeneratorService);

  members = signal<LoyaltyMember[]>([]);
  rewards = signal<LoyaltyReward[]>([]);
  vouchers = signal<LoyaltyVoucher[]>([]);

  activeTab = signal<'members' | 'rewards' | 'vouchers'>('members');
  showMemberModal = signal(false);
  showValidatorModal = signal(false);
  voucherInputCode = signal('');
  feedbackMsg = signal('');

  totalPoints = computed(() => this.members().reduce((acc, m) => acc + m.pointsBalance, 0));
  totalCashback = computed(() => this.members().reduce((acc, m) => acc + m.totalCashbackEarned, 0));
  activeVouchers = computed(() => this.vouchers().filter(v => v.status === 'ACTIVE'));

  memberForm = this.fb.group({
    name: ['', Validators.required],
    phone: ['', Validators.required],
    cpf: [''],
    tier: ['BRONZE' as LoyaltyTier],
    initialPoints: [50]
  });

  async ngOnInit() {
    await this.loadAll();
  }

  async loadAll() {
    if (!isPlatformBrowser(this.platformId)) return;
    const currentCompanyId = this.context.companyId();
    const [mList, rList, vList] = await Promise.all([
      db.loyaltyMembers.where('companyId').equals(currentCompanyId).toArray(),
      db.loyaltyRewards.where('companyId').equals(currentCompanyId).toArray(),
      db.loyaltyVouchers.where('companyId').equals(currentCompanyId).toArray()
    ]);
    this.members.set(mList);
    this.rewards.set(rList);
    this.vouchers.set(vList.reverse());
  }

  openMemberModal() {
    this.memberForm.reset({
      name: '',
      phone: '',
      cpf: '',
      tier: 'BRONZE',
      initialPoints: 50
    });
    this.showMemberModal.set(true);
  }

  async saveMember() {
    if (this.memberForm.invalid || !isPlatformBrowser(this.platformId)) return;
    const val = this.memberForm.value;
    const now = Date.now();

    const newMem: LoyaltyMember = {
      id: this.idGen.generatePrefixedId('lmem'),
      companyId: this.context.companyId(),
      name: val.name!,
      phone: val.phone!,
      cpf: val.cpf || '',
      pointsBalance: Number(val.initialPoints || 50),
      totalPointsEarned: Number(val.initialPoints || 50),
      totalCashbackEarned: (Number(val.initialPoints || 50) * 0.05),
      tier: val.tier || 'BRONZE',
      status: 'ACTIVE',
      joinedAt: now
    };

    await this.txEngine.saveEntity('loyaltyMembers', newMem, 'CREATE');
    this.showMemberModal.set(false);
    this.feedbackMsg.set(`Membro VIP "${newMem.name}" cadastrado com sucesso!`);
    await this.loadAll();
  }

  async addPoints(m: LoyaltyMember, pts: number) {
    if (!isPlatformBrowser(this.platformId)) return;
    const nextBalance = m.pointsBalance + pts;
    const nextEarned = m.totalPointsEarned + pts;
    const updatedMember = {
      ...m,
      pointsBalance: nextBalance,
      totalPointsEarned: nextEarned
    };
    await this.txEngine.saveEntity('loyaltyMembers', updatedMember, 'UPDATE');
    this.feedbackMsg.set(`+${pts} pontos adicionados a ${m.name}!`);
    await this.loadAll();
  }

  async openIssueVoucher(m: LoyaltyMember) {
    const rew = this.rewards()[0];
    if (!rew) {
      this.feedbackMsg.set('Nenhuma recompensa disponível no catálogo.');
      return;
    }
    if (m.pointsBalance < rew.pointsRequired) {
      this.feedbackMsg.set(`Pontos insuficientes! Necessário: ${rew.pointsRequired} pts (Saldo: ${m.pointsBalance} pts)`);
      return;
    }

    const now = Date.now();
    const code = this.idGen.generateTransactionCode('VIP');
    const voucher: LoyaltyVoucher = {
      id: this.idGen.generatePrefixedId('vouch'),
      companyId: this.context.companyId(),
      code,
      memberId: m.id,
      memberName: m.name,
      memberPhone: m.phone,
      rewardTitle: rew.title,
      pointsSpent: rew.pointsRequired,
      discountValue: rew.discountValue,
      status: 'ACTIVE',
      issuedAt: now,
      expiresAt: now + 86400000 * rew.validityDays
    };

    const updatedMember = {
      ...m,
      pointsBalance: m.pointsBalance - rew.pointsRequired
    };

    await this.txEngine.saveEntity('loyaltyMembers', updatedMember, 'UPDATE');
    await this.txEngine.saveEntity('loyaltyVouchers', voucher, 'CREATE');
    await this.loadAll();
    this.feedbackMsg.set(`Voucher ${voucher.code} emitido com sucesso para ${m.name}!`);
  }

  async validateVoucher() {
    if (!this.voucherInputCode().trim() || !isPlatformBrowser(this.platformId)) return;
    const code = this.voucherInputCode().trim().toUpperCase();
    const found = this.vouchers().find(v => v.code.toUpperCase() === code);

    if (!found) {
      this.feedbackMsg.set('Voucher não encontrado com esse código.');
      return;
    }
    if (found.status === 'REDEEMED') {
      this.feedbackMsg.set('Este voucher já foi utilizado!');
      return;
    }

    const updatedVoucher = {
      ...found,
      status: 'REDEEMED' as const
    };

    await this.txEngine.saveEntity('loyaltyVouchers', updatedVoucher, 'UPDATE');
    this.showValidatorModal.set(false);
    this.voucherInputCode.set('');
    await this.loadAll();
    this.feedbackMsg.set(`Voucher ${found.code} validado com sucesso! Benefício: ${found.rewardTitle}`);
  }

  getTierBadge(tier: LoyaltyTier): string {
    switch (tier) {
      case 'DIAMANTE': return 'bg-cyan-100 text-cyan-800 border border-cyan-300';
      case 'OURO': return 'bg-amber-100 text-amber-800 border border-amber-300';
      case 'PRATA': return 'bg-zinc-200 text-zinc-800';
      default: return 'bg-orange-100 text-orange-800';
    }
  }
}

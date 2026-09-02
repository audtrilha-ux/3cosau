import { Component, ChangeDetectionStrategy, signal, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { db } from '../../core/storage/dexie.db';
import { Operator } from '../../core/models';
import { AppContextService } from '../../core/services/app-context.service';
import { TransactionEngine } from '../../core/workflow/transaction.engine';
import { IdGeneratorService } from '../../core/services/id-generator.service';

@Component({
  selector: 'app-funcionarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col bg-zinc-50 text-zinc-800 p-4 space-y-4 overflow-hidden select-none">
      <!-- Top Header -->
      <div class="flex items-center justify-between pb-3 border-b border-zinc-200 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
            <mat-icon>badge</mat-icon>
          </div>
          <div>
            <h2 class="text-base font-bold text-zinc-900 leading-tight">Funcionários & Controle de Acesso (RBAC)</h2>
            <p class="text-xs text-zinc-500">Gestão de operadores de caixa, gerentes, atendentes e PINs de segurança</p>
          </div>
        </div>
        <button
          type="button"
          (click)="openModal()"
          class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <mat-icon class="text-sm">person_add</mat-icon>
          <span>Novo Operador</span>
        </button>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Total de Operadores</div>
            <div class="text-lg font-black text-zinc-900 font-mono">{{ operators().length }}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-600 flex items-center justify-center"><mat-icon class="text-base">groups</mat-icon></div>
        </div>
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Operadores Ativos</div>
            <div class="text-lg font-black text-emerald-600 font-mono">{{ activeCount() }}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><mat-icon class="text-base">check_circle</mat-icon></div>
        </div>
        <div class="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between">
          <div>
            <div class="text-[10px] uppercase font-bold text-zinc-400">Gerência / Supervisão</div>
            <div class="text-lg font-black text-purple-600 font-mono">{{ managerCount() }}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center"><mat-icon class="text-base">admin_panel_settings</mat-icon></div>
        </div>
      </div>

      <!-- Operators List -->
      <div class="flex-1 bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
        <div class="overflow-y-auto flex-1">
          <table class="w-full text-left text-xs text-zinc-700">
            <thead class="bg-zinc-50 text-zinc-500 uppercase tracking-wider text-[10px] border-b border-zinc-200 sticky top-0">
              <tr>
                <th class="p-3">Operador / Nome</th>
                <th class="p-3">Papel / Função</th>
                <th class="p-3">PIN de Acesso</th>
                <th class="p-3">Status</th>
                <th class="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-100 font-sans">
              @for (op of operators(); track op.id) {
                <tr class="hover:bg-purple-50/40 transition-colors">
                  <td class="p-3">
                    <div class="flex items-center gap-2.5">
                      <div class="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 font-bold flex items-center justify-center uppercase text-xs">
                        {{ op.name.substring(0, 2) }}
                      </div>
                      <div>
                        <div class="font-bold text-zinc-900">{{ op.name }}</div>
                        <div class="text-[10px] text-zinc-400 font-mono">ID: {{ op.id }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="p-3">
                    <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase"
                          [class.bg-purple-100]="op.role === 'OWNER'"
                          [class.text-purple-800]="op.role === 'OWNER'"
                          [class.bg-indigo-100]="op.role === 'MANAGER'"
                          [class.text-indigo-800]="op.role === 'MANAGER'"
                          [class.bg-emerald-100]="op.role === 'CASHIER'"
                          [class.text-emerald-800]="op.role === 'CASHIER'"
                          [class.bg-orange-100]="op.role === 'WAITER'"
                          [class.text-orange-800]="op.role === 'WAITER'"
                          [class.bg-blue-100]="op.role === 'STOCK'"
                          [class.text-blue-800]="op.role === 'STOCK'">
                      {{ op.role }}
                    </span>
                  </td>
                  <td class="p-3 font-mono text-zinc-400 tracking-widest">●●●●</td>
                  <td class="p-3">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                          [class.bg-emerald-100]="op.active"
                          [class.text-emerald-800]="op.active"
                          [class.bg-zinc-200]="!op.active"
                          [class.text-zinc-600]="!op.active">
                      {{ op.active ? 'Ativo' : 'Inativo' }}
                    </span>
                  </td>
                  <td class="p-3 text-right space-x-1">
                    <button
                      type="button"
                      (click)="toggleActive(op)"
                      class="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 cursor-pointer text-[10px] font-bold"
                    >
                      {{ op.active ? 'Inativar' : 'Ativar' }}
                    </button>
                    @if (op.role !== 'OWNER') {
                      <button
                        type="button"
                        (click)="deleteOperator(op.id)"
                        class="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                        title="Excluir"
                      >
                        <mat-icon class="text-sm">delete</mat-icon>
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Add Operator Modal -->
      @if (showModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div class="bg-white border border-zinc-200 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 class="text-sm font-bold text-zinc-900">Novo Operador / Colaborador</h3>
              <button (click)="showModal.set(false)" class="text-zinc-400 hover:text-zinc-600">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <form [formGroup]="form" (ngSubmit)="saveOperator()" class="space-y-3 text-xs">
              <div>
                <label class="block font-semibold text-zinc-700 mb-1">Nome Completo *</label>
                <input type="text" formControlName="name" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900" placeholder="Nome do funcionário" />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Função / Perfil *</label>
                  <select formControlName="role" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900">
                    <option value="CASHIER">Operador de Caixa</option>
                    <option value="MANAGER">Gerente</option>
                    <option value="WAITER">Atendente / Garçom</option>
                    <option value="STOCK">Estoquista</option>
                  </select>
                </div>
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">PIN de Acesso (4-8 dígitos) *</label>
                  <input type="password" maxlength="8" formControlName="pin" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-mono text-center tracking-widest" placeholder="Mínimo 4 dígitos" />
                </div>
              </div>

              <div class="pt-2 border-t border-zinc-100 space-y-2">
                <span class="font-bold text-[11px] text-zinc-500 uppercase tracking-wider block">Credenciais Corporativas (Opcional)</span>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block font-semibold text-zinc-700 mb-1">E-mail de Login</label>
                    <input type="email" formControlName="email" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900" placeholder="colaborador@empresa.com" />
                  </div>
                  <div>
                    <label class="block font-semibold text-zinc-700 mb-1">Senha de Acesso</label>
                    <input type="password" formControlName="password" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900" placeholder="Senha segura (mín. 8 chars)" />
                  </div>
                </div>
              </div>

              <div class="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
                <button type="button" (click)="showModal.set(false)" class="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold">Cancelar</button>
                <button type="submit" [disabled]="form.invalid" class="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold shadow-md">Salvar Operador</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class FuncionariosComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private fb = inject(FormBuilder);
  private context = inject(AppContextService);
  private engine = inject(TransactionEngine);
  private idGen = inject(IdGeneratorService);

  operators = signal<Operator[]>([]);
  showModal = signal(false);

  activeCount = () => this.operators().filter(o => o.active).length;
  managerCount = () => this.operators().filter(o => o.role === 'OWNER' || o.role === 'MANAGER').length;

  form = this.fb.group({
    name: ['', Validators.required],
    role: ['CASHIER' as Operator['role'], Validators.required],
    pin: ['', [Validators.required, Validators.minLength(4)]],
    email: [''],
    password: ['']
  });

  async ngOnInit() {
    await this.loadOperators();
  }

  async loadOperators() {
    if (!isPlatformBrowser(this.platformId)) return;
    const currentCompanyId = this.context.companyId();
    const list = await db.operators.where('companyId').equals(currentCompanyId).toArray();
    this.operators.set(list);
  }

  openModal() {
    this.form.reset({
      name: '',
      role: 'CASHIER',
      pin: '',
      email: '',
      password: ''
    });
    this.showModal.set(true);
  }

  async saveOperator() {
    if (this.form.invalid || !isPlatformBrowser(this.platformId)) return;
    const val = this.form.value;
    const now = Date.now();
    const currentCompanyId = this.context.companyId() || '';

    const salt = this.idGen.generatePrefixedId('salt');
    const hashedPin = await this.context.hashPin(val.pin!, salt);

    let hashedPassword: string | undefined = undefined;
    if (val.password && val.password.trim()) {
      hashedPassword = await this.context.hashPin(val.password.trim(), salt);
    }

    const newOp: Operator = {
      id: this.idGen.generatePrefixedId('op'),
      companyId: currentCompanyId,
      name: val.name!,
      role: val.role || 'CASHIER',
      pin: hashedPin,
      email: val.email?.trim().toLowerCase() || undefined,
      password: hashedPassword,
      salt,
      active: true,
      createdAt: now
    };

    await this.engine.saveOperator(newOp, 'CREATE');
    this.showModal.set(false);
    await this.loadOperators();
  }

  async toggleActive(op: Operator) {
    if (!isPlatformBrowser(this.platformId)) return;
    const next = !op.active;
    const updatedOp = { ...op, active: next };
    await this.engine.saveOperator(updatedOp, 'UPDATE');
    await this.loadOperators();
  }

  async deleteOperator(id: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    await this.engine.deleteOperator(id);
    await this.loadOperators();
  }
}

import { Component, ChangeDetectionStrategy, inject, signal, OnInit, HostListener, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AppContextService } from '../../../core/services/app-context.service';
import { Operator } from '../../../core/models';

@Component({
  selector: 'app-lock-screen',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 select-none font-sans">
      
      <!-- Top Branding -->
      <div class="text-center space-y-2 mb-5">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-400 text-xs font-mono">
          <mat-icon class="text-sm">lock</mat-icon>
          <span>AUTENTICAÇÃO & CONTROLE DE ACESSO</span>
        </div>
        <h1 class="text-2xl lg:text-3xl font-black text-white tracking-tight">{{ context.company()?.tradingName || '3eatcru OS' }}</h1>
        <p class="text-xs text-zinc-400">Terminal: {{ context.device()?.name || 'Checkout' }} • Filial: {{ context.location()?.name || 'Matriz' }}</p>
      </div>

      <!-- Main Login Bento Card -->
      <div class="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
        
        <!-- Auth Mode Toggle (PIN Rápido vs E-mail & Senha Forte) -->
        <div class="grid grid-cols-2 p-1 bg-zinc-950 border border-zinc-800 rounded-2xl">
          <button
            type="button"
            (click)="setAuthMode('PIN')"
            [class.bg-indigo-600]="authMode() === 'PIN'"
            [class.text-white]="authMode() === 'PIN'"
            [class.shadow-xs]="authMode() === 'PIN'"
            [class.text-zinc-400]="authMode() !== 'PIN'"
            class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <mat-icon class="text-sm">dialpad</mat-icon>
            <span>PIN Rápido</span>
          </button>

          <button
            type="button"
            (click)="setAuthMode('EMAIL')"
            [class.bg-indigo-600]="authMode() === 'EMAIL'"
            [class.text-white]="authMode() === 'EMAIL'"
            [class.shadow-xs]="authMode() === 'EMAIL'"
            [class.text-zinc-400]="authMode() !== 'EMAIL'"
            class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <mat-icon class="text-sm">badge</mat-icon>
            <span>E-mail & Senha</span>
          </button>
        </div>

        <!-- MODE 1: Fast Numeric PIN (Cashier / Waiter / Fast Flow) -->
        @if (authMode() === 'PIN') {
          <!-- Operator Selection -->
          <div class="space-y-2.5">
            <label class="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Selecione o Operador</label>
            
            <div class="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
              @for (op of context.activeOperators(); track op.id) {
                <button
                  type="button"
                  (click)="selectOperator(op)"
                  [class.bg-indigo-600]="selectedOperator()?.id === op.id"
                  [class.border-indigo-500]="selectedOperator()?.id === op.id"
                  [class.text-white]="selectedOperator()?.id === op.id"
                  [class.shadow-xs]="selectedOperator()?.id === op.id"
                  [class.bg-zinc-800/80]="selectedOperator()?.id !== op.id"
                  [class.border-zinc-700]="selectedOperator()?.id !== op.id"
                  [class.text-zinc-300]="selectedOperator()?.id !== op.id"
                  class="flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer text-left hover:bg-zinc-700/80"
                >
                  <div class="flex items-center gap-2.5">
                    <div
                      class="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs"
                      [class.bg-white/20]="selectedOperator()?.id === op.id"
                      [class.text-white]="selectedOperator()?.id === op.id"
                      [class.bg-zinc-700]="selectedOperator()?.id !== op.id"
                      [class.text-zinc-300]="selectedOperator()?.id !== op.id"
                    >
                      <mat-icon class="text-base">{{ getRoleIcon(op.role) }}</mat-icon>
                    </div>
                    <div>
                      <div class="font-bold text-xs leading-tight">{{ op.name }}</div>
                      <div class="text-[10px] opacity-80 uppercase tracking-wider mt-0.5">{{ getRoleLabel(op.role) }}</div>
                    </div>
                  </div>
                  @if (selectedOperator()?.id === op.id) {
                    <mat-icon class="text-white text-base">check_circle</mat-icon>
                  }
                </button>
              }
            </div>
          </div>

          <!-- PIN Input & Display -->
          <div class="space-y-2.5">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">PIN de Acesso</label>
              <span class="text-[10px] text-zinc-500 font-mono">Digite 4 a 6 dígitos</span>
            </div>

            <!-- PIN Dots Display -->
            <div class="flex items-center justify-center gap-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-2xl">
              @for (dot of pinDots(); track $index) {
                <div
                  class="w-3.5 h-3.5 rounded-full transition-all duration-200"
                  [class.bg-indigo-500]="dot"
                  [class.scale-110]="dot"
                  [class.shadow-xs]="dot"
                  [class.shadow-indigo-500/50]="dot"
                  [class.bg-zinc-800]="!dot"
                ></div>
              }
            </div>

            @if (errorMessage()) {
              <div class="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-400 flex items-center gap-2">
                <mat-icon class="text-sm">error</mat-icon>
                <span>{{ errorMessage() }}</span>
              </div>
            }
          </div>

          <!-- Virtual Numeric Keypad -->
          <div class="grid grid-cols-3 gap-2">
            @for (n of [1, 2, 3, 4, 5, 6, 7, 8, 9]; track n) {
              <button
                type="button"
                (click)="appendDigit(n.toString())"
                class="h-11 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white font-mono font-bold text-lg border border-zinc-700 transition-all cursor-pointer flex items-center justify-center"
              >
                {{ n }}
              </button>
            }
            <button
              type="button"
              (click)="clearPin()"
              class="h-11 rounded-xl bg-zinc-800/50 hover:bg-zinc-700/50 active:scale-95 text-zinc-400 font-bold text-xs border border-zinc-800 transition-all cursor-pointer flex items-center justify-center"
            >
              LIMPAR
            </button>
            <button
              type="button"
              (click)="appendDigit('0')"
              class="h-11 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white font-mono font-bold text-lg border border-zinc-700 transition-all cursor-pointer flex items-center justify-center"
            >
              0
            </button>
            <button
              type="button"
              (click)="backspace()"
              class="h-11 rounded-xl bg-zinc-800/50 hover:bg-zinc-700/50 active:scale-95 text-zinc-400 border border-zinc-800 transition-all cursor-pointer flex items-center justify-center"
            >
              <mat-icon class="text-sm">backspace</mat-icon>
            </button>
          </div>

          <!-- Unlock Action Button -->
          <button
            type="button"
            (click)="submitUnlock()"
            [disabled]="pin().length < 4 || isAuthenticating()"
            class="w-full h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
          >
            <mat-icon class="text-base">lock_open</mat-icon>
            <span>{{ isAuthenticating() ? 'Autenticando...' : 'Desbloquear Terminal' }}</span>
          </button>
        }

        <!-- MODE 2: Corporate Email & Strong Password -->
        @if (authMode() === 'EMAIL') {
          <form (ngSubmit)="submitEmailPasswordUnlock()" class="space-y-4">
            <div class="space-y-1">
              <label class="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">E-mail Corporativo</label>
              <div class="relative">
                <input
                  type="email"
                  [value]="emailInput()"
                  (input)="emailInput.set($any($event.target).value)"
                  placeholder="gestor@empresa.com.br"
                  required
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Senha Forte de Acesso</label>
              </div>
              <div class="relative">
                <input
                  [type]="showPassword() ? 'text' : 'password'"
                  [value]="passwordInput()"
                  (input)="passwordInput.set($any($event.target).value)"
                  placeholder="Sua senha de segurança"
                  required
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-3 pr-10 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 outline-none"
                />
                <button
                  type="button"
                  (click)="showPassword.set(!showPassword())"
                  class="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-200 p-0.5 cursor-pointer"
                >
                  <mat-icon class="text-sm">{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </div>
            </div>

            @if (errorMessage()) {
              <div class="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-400 flex items-center gap-2">
                <mat-icon class="text-sm">error</mat-icon>
                <span>{{ errorMessage() }}</span>
              </div>
            }

            <div class="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl text-[11px] text-zinc-400 space-y-1">
              <div class="flex items-center gap-1.5 font-bold text-zinc-300">
                <mat-icon class="text-xs text-indigo-400">shield</mat-icon>
                <span>Acesso Administrativo & Master</span>
              </div>
              <p>Permite login direto por e-mail e senha cadastrada sem necessidade de selecionar o operador previamente.</p>
            </div>

            <button
              type="submit"
              [disabled]="!emailInput() || !passwordInput() || isAuthenticating()"
              class="w-full h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              <mat-icon class="text-base">login</mat-icon>
              <span>{{ isAuthenticating() ? 'Autenticando...' : 'Acessar Terminal' }}</span>
            </button>
          </form>
        }

      </div>

      <div class="text-center mt-4 text-zinc-500 text-[11px]">
        3eatcru OS • Arquitetura Local-First & Zero Hardcodes
      </div>
    </div>
  `
})
export class LockScreenComponent implements OnInit {
  context = inject(AppContextService);
  private platformId = inject(PLATFORM_ID);

  authMode = signal<'PIN' | 'EMAIL'>('PIN');
  selectedOperator = signal<Operator | null>(null);
  pin = signal<string>('');
  emailInput = signal<string>('');
  passwordInput = signal<string>('');
  showPassword = signal<boolean>(false);
  errorMessage = signal<string>('');
  isAuthenticating = signal<boolean>(false);

  pinDots = signal<boolean[]>([false, false, false, false]);

  ngOnInit(): void {
    const ops = this.context.activeOperators();
    const current = this.context.currentOperator();

    if (current) {
      this.selectedOperator.set(current);
      if (current.email) {
        this.emailInput.set(current.email);
      }
    } else if (ops.length > 0) {
      this.selectedOperator.set(ops[0]);
      if (ops[0].email) {
        this.emailInput.set(ops[0].email);
      }
    }
  }

  setAuthMode(mode: 'PIN' | 'EMAIL'): void {
    this.authMode.set(mode);
    this.errorMessage.set('');
  }

  selectOperator(op: Operator): void {
    this.selectedOperator.set(op);
    if (op.email) {
      this.emailInput.set(op.email);
    }
    this.clearPin();
    this.errorMessage.set('');
  }

  appendDigit(digit: string): void {
    if (this.pin().length >= 6) return;
    const nextPin = this.pin() + digit;
    this.pin.set(nextPin);
    this.updateDots(nextPin.length);
    this.errorMessage.set('');

    // Auto submit if 6 digits or matching operator PIN length
    if (nextPin.length >= 4 && this.selectedOperator()?.pin?.length === nextPin.length) {
      this.submitUnlock();
    }
  }

  backspace(): void {
    if (this.pin().length === 0) return;
    const nextPin = this.pin().slice(0, -1);
    this.pin.set(nextPin);
    this.updateDots(nextPin.length);
    this.errorMessage.set('');
  }

  clearPin(): void {
    this.pin.set('');
    this.updateDots(0);
  }

  private updateDots(len: number): void {
    const totalSlots = Math.max(4, Math.min(6, len || 4));
    const dots: boolean[] = [];
    for (let i = 0; i < totalSlots; i++) {
      dots.push(i < len);
    }
    this.pinDots.set(dots);
  }

  async submitUnlock(): Promise<void> {
    const op = this.selectedOperator();
    const pin = this.pin();

    if (!op) {
      this.errorMessage.set('Selecione um operador.');
      return;
    }

    if (pin.length < 4) {
      this.errorMessage.set('Digite o PIN de 4 a 6 números.');
      return;
    }

    this.isAuthenticating.set(true);

    try {
      const result = await this.context.authenticateOperator(op.id, pin);
      if (!result.success) {
        this.errorMessage.set(result.message || 'PIN incorreto. Tente novamente.');
        this.clearPin();
      }
    } finally {
      this.isAuthenticating.set(false);
    }
  }

  async submitEmailPasswordUnlock(): Promise<void> {
    const email = this.emailInput();
    const password = this.passwordInput();
    if (!email || !password) {
      this.errorMessage.set('Preencha o e-mail e a senha.');
      return;
    }

    this.isAuthenticating.set(true);
    this.errorMessage.set('');

    try {
      const result = await this.context.authenticateOperatorWithEmailPassword(email, password);
      if (!result.success) {
        this.errorMessage.set(result.message || 'Credenciais inválidas.');
      }
    } finally {
      this.isAuthenticating.set(false);
    }
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'OWNER': return 'Proprietário (Master)';
      case 'MANAGER': return 'Gerente Geral';
      case 'CASHIER': return 'Operador de Caixa';
      case 'WAITER': return 'Garçom / Atendente';
      case 'STOCK': return 'Estoquista';
      default: return role;
    }
  }

  getRoleIcon(role: string): string {
    switch (role) {
      case 'OWNER': return 'verified_user';
      case 'MANAGER': return 'manage_accounts';
      case 'CASHIER': return 'point_of_sale';
      case 'WAITER': return 'room_service';
      default: return 'person';
    }
  }

  @HostListener('window:keydown', ['$event'])
  handlePhysicalKeyboard(event: KeyboardEvent): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.context.isLocked() || this.authMode() !== 'PIN') return;

    if (event.key >= '0' && event.key <= '9') {
      event.preventDefault();
      this.appendDigit(event.key);
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      this.backspace();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.submitUnlock();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.clearPin();
    }
  }
}


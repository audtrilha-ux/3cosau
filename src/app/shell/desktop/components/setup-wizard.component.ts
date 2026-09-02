import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AppContextService } from '../../../core/services/app-context.service';
import { CentralPlatformService } from '../../../core/services/central-platform.service';
import { IdGeneratorService } from '../../../core/services/id-generator.service';
import { seedDemoData } from '../../../core/storage/dexie.db';
import { CentralLicense, CentralDevice } from '../../../core/models';
import { evaluatePasswordStrength, PasswordStrengthResult } from '../../../core/utils/password-strength';

@Component({
  selector: 'app-setup-wizard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 bg-zinc-950 flex items-center justify-center p-4 font-sans">
      <div class="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col">
        
        <!-- Header Banner -->
        <div class="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 p-6 text-white flex items-center justify-between">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-[10px] font-mono uppercase tracking-wider text-indigo-200">
                Setup Inicial • Sistema Local-First
              </span>
            </div>
            <h1 class="text-xl lg:text-2xl font-black tracking-tight">Bem-vindo ao 3eatcru OS</h1>
            <p class="text-xs text-indigo-200">Ative o terminal com um código da Central ou configure seu estabelecimento.</p>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-indigo-600/50 border border-indigo-400/30 flex items-center justify-center">
            <mat-icon class="text-white text-2xl">storefront</mat-icon>
          </div>
        </div>

        <!-- Step Indicator -->
        <div class="flex items-center justify-between px-8 py-3 bg-zinc-50 border-b border-zinc-100 text-xs font-semibold text-zinc-500">
          <div class="flex items-center gap-2" [class.text-indigo-600]="step() === 1">
            <span
              class="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
              [class.bg-indigo-600]="step() === 1"
              [class.text-white]="step() === 1"
              [class.font-bold]="step() === 1"
              [class.bg-zinc-200]="step() !== 1"
              [class.text-zinc-600]="step() !== 1"
            >1</span>
            <span>Empresa & Local</span>
          </div>
          <div class="h-px w-12 bg-zinc-200"></div>
          <div class="flex items-center gap-2" [class.text-indigo-600]="step() === 2">
            <span
              class="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
              [class.bg-indigo-600]="step() === 2"
              [class.text-white]="step() === 2"
              [class.font-bold]="step() === 2"
              [class.bg-zinc-200]="step() !== 2"
              [class.text-zinc-600]="step() !== 2"
            >2</span>
            <span>Usuário Master & PIN</span>
          </div>
          <div class="h-px w-12 bg-zinc-200"></div>
          <div class="flex items-center gap-2" [class.text-indigo-600]="step() === 3">
            <span
              class="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
              [class.bg-indigo-600]="step() === 3"
              [class.text-white]="step() === 3"
              [class.font-bold]="step() === 3"
              [class.bg-zinc-200]="step() !== 3"
              [class.text-zinc-600]="step() !== 3"
            >3</span>
            <span>Modo do Banco</span>
          </div>
        </div>

        <!-- Step Global Error Banner -->
        @if (validationError()) {
          <div class="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-bold text-rose-700">
            <mat-icon class="text-sm">error</mat-icon>
            <span>{{ validationError() }}</span>
          </div>
        }

        <!-- Form Body -->
        <form [formGroup]="form" (ngSubmit)="finishSetup()" class="p-6 sm:p-8 space-y-6 flex-1 overflow-y-auto">
          
          <!-- STEP 1: Company & Terminal -->
          @if (step() === 1) {
            @if (setupMode() === 'CENTRAL_CODE') {
              <div class="space-y-4 py-2">
                <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 text-emerald-900 text-xs">
                  <div class="flex items-center gap-2 font-bold text-emerald-800">
                    <mat-icon class="text-sm">verified</mat-icon>
                    <span>Pareamento Instantâneo via Central 3eatcru</span>
                  </div>
                  <p>
                    Se você já gerou um código de 6 dígitos na <strong>Central 3eatcru</strong>, digite-o abaixo para puxar a empresa e autorizar este terminal.
                  </p>
                </div>

                <div class="space-y-2 max-w-xs mx-auto text-center">
                  <label class="text-xs font-bold text-zinc-700 uppercase tracking-wider">Código de Pareamento (6 dígitos)</label>
                  <input
                    type="text"
                    [value]="pairingCodeInput()"
                    (input)="pairingCodeInput.set($any($event.target).value)"
                    maxlength="6"
                    placeholder="Ex: 849201"
                    class="w-full text-center font-mono text-2xl font-black tracking-widest bg-zinc-50 border-2 border-emerald-500 rounded-2xl py-3 text-zinc-900 outline-none focus:bg-white"
                  />
                  <button
                    type="button"
                    (click)="applyCentralPairing()"
                    class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer"
                  >
                    Validar na Central & Preencher Dados
                  </button>
                  @if (pairingError()) {
                    <p class="text-xs font-bold text-rose-600">{{ pairingError() }}</p>
                  }
                </div>
              </div>
            } @else {
              <div class="space-y-4">
                <h2 class="text-sm font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-2">
                  <mat-icon class="text-indigo-600 text-base">business</mat-icon>
                  Identificação do Estabelecimento
                </h2>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="space-y-1">
                    <label class="text-xs font-semibold text-zinc-700">Nome Fantasia *</label>
                    <input
                      type="text"
                      formControlName="tradingName"
                      placeholder="Ex: Bar & Restaurante Central"
                      class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:border-indigo-600 outline-none"
                    />
                  </div>

                  <div class="space-y-1">
                    <label class="text-xs font-semibold text-zinc-700">Razão Social *</label>
                    <input
                      type="text"
                      formControlName="companyName"
                      placeholder="Ex: Restaurante Central Ltda"
                      class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:border-indigo-600 outline-none"
                    />
                  </div>

                  <div class="space-y-1">
                    <label class="text-xs font-semibold text-zinc-700">CNPJ / CPF (Opcional)</label>
                    <input
                      type="text"
                      formControlName="cnpj"
                      placeholder="00.000.000/0001-00"
                      class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:border-indigo-600 outline-none"
                    />
                  </div>

                  <div class="space-y-1">
                    <label class="text-xs font-semibold text-zinc-700">Telefone / WhatsApp</label>
                    <input
                      type="text"
                      formControlName="phone"
                      placeholder="(11) 98765-4321"
                      class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:border-indigo-600 outline-none"
                    />
                  </div>

                  <div class="space-y-1">
                    <label class="text-xs font-semibold text-zinc-700">Cidade / UF</label>
                    <div class="flex gap-2">
                      <input
                        type="text"
                        formControlName="city"
                        placeholder="São Paulo"
                        class="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:border-indigo-600 outline-none"
                      />
                      <input
                        type="text"
                        formControlName="state"
                        placeholder="SP"
                        maxlength="2"
                        class="w-16 text-center bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:border-indigo-600 outline-none uppercase"
                      />
                    </div>
                  </div>

                  <div class="space-y-1">
                    <label class="text-xs font-semibold text-zinc-700">Identificação deste Terminal PDV</label>
                    <input
                      type="text"
                      formControlName="deviceName"
                      placeholder="Ex: Caixa 01 - Balcão"
                      class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:border-indigo-600 outline-none"
                    />
                  </div>
                </div>
              </div>
            }
          }

          <!-- STEP 2: Owner, Email, Strong Password & Master PIN -->
          @if (step() === 2) {
            <div class="space-y-5">
              <h2 class="text-sm font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-2">
                <mat-icon class="text-indigo-600 text-base">admin_panel_settings</mat-icon>
                Criação do Usuário Master (Proprietário)
              </h2>

              <div class="p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-start gap-3 text-xs text-indigo-950">
                <mat-icon class="text-indigo-600 text-sm mt-0.5">security</mat-icon>
                <div>
                  <strong>Segurança em Camadas:</strong> Defina seu <strong>e-mail e senha forte</strong> para acesso administrativo e configure um <strong>PIN numérico de 4 a 6 dígitos</strong> para desbloqueio rápido no PDV diário.
                </div>
              </div>

              <div class="space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="space-y-1">
                    <label class="text-xs font-semibold text-zinc-700">Nome Completo do Gestor *</label>
                    <input
                      type="text"
                      formControlName="ownerName"
                      placeholder="Ex: Carlos Eduardo Silva"
                      class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:border-indigo-600 outline-none"
                    />
                  </div>

                  <div class="space-y-1">
                    <label class="text-xs font-semibold text-zinc-700">E-mail Principal do Gestor *</label>
                    <input
                      type="email"
                      formControlName="ownerEmail"
                      placeholder="carlos@empresa.com.br"
                      class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:border-indigo-600 outline-none"
                    />
                  </div>
                </div>

                <!-- Strong Password with Strength Evaluation -->
                <div class="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3">
                  <div class="flex items-center justify-between">
                    <label class="text-xs font-bold text-zinc-700 uppercase tracking-wider">Senha Forte do Usuário Master *</label>
                    <div class="flex items-center gap-1.5 text-xs font-semibold">
                      <span class="text-zinc-500">Força:</span>
                      <span [class]="passwordStrength().textColorClass" class="font-bold">{{ passwordStrength().label }}</span>
                    </div>
                  </div>

                  <div class="relative">
                    <input
                      [type]="showPassword() ? 'text' : 'password'"
                      formControlName="ownerPassword"
                      (input)="onPasswordInput()"
                      placeholder="Crie uma senha segura (mínimo 8 caracteres)"
                      class="w-full bg-white border border-zinc-300 rounded-xl pl-3 pr-10 py-2 text-sm text-zinc-900 focus:border-indigo-600 outline-none"
                    />
                    <button
                      type="button"
                      (click)="showPassword.set(!showPassword())"
                      class="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-600 p-0.5 cursor-pointer"
                    >
                      <mat-icon class="text-base">{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                  </div>

                  <!-- Strength Bar Meter -->
                  <div class="grid grid-cols-4 gap-1.5 pt-1">
                    <div class="h-1.5 rounded-full transition-all duration-300" [class]="passwordStrength().score >= 1 ? passwordStrength().colorClass : 'bg-zinc-200'"></div>
                    <div class="h-1.5 rounded-full transition-all duration-300" [class]="passwordStrength().score >= 2 ? passwordStrength().colorClass : 'bg-zinc-200'"></div>
                    <div class="h-1.5 rounded-full transition-all duration-300" [class]="passwordStrength().score >= 3 ? passwordStrength().colorClass : 'bg-zinc-200'"></div>
                    <div class="h-1.5 rounded-full transition-all duration-300" [class]="passwordStrength().score >= 4 ? passwordStrength().colorClass : 'bg-zinc-200'"></div>
                  </div>

                  <!-- Checklist -->
                  <div class="grid grid-cols-2 gap-2 text-[11px] pt-1 text-zinc-600">
                    <div class="flex items-center gap-1" [class.text-emerald-700]="passwordStrength().hasMinLength" [class.font-bold]="passwordStrength().hasMinLength">
                      <mat-icon class="text-[13px] w-[13px] h-[13px]">{{ passwordStrength().hasMinLength ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                      <span>Mínimo 8 caracteres</span>
                    </div>
                    <div class="flex items-center gap-1" [class.text-emerald-700]="passwordStrength().hasUpper && passwordStrength().hasLower" [class.font-bold]="passwordStrength().hasUpper && passwordStrength().hasLower">
                      <mat-icon class="text-[13px] w-[13px] h-[13px]">{{ passwordStrength().hasUpper && passwordStrength().hasLower ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                      <span>Letras maiúsculas e minúsculas</span>
                    </div>
                    <div class="flex items-center gap-1" [class.text-emerald-700]="passwordStrength().hasNumber" [class.font-bold]="passwordStrength().hasNumber">
                      <mat-icon class="text-[13px] w-[13px] h-[13px]">{{ passwordStrength().hasNumber ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                      <span>Pelo menos 1 número</span>
                    </div>
                    <div class="flex items-center gap-1" [class.text-emerald-700]="passwordStrength().hasSpecial" [class.font-bold]="passwordStrength().hasSpecial">
                      <mat-icon class="text-[13px] w-[13px] h-[13px]">{{ passwordStrength().hasSpecial ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                      <span>Símbolo especial (!@#$%)</span>
                    </div>
                  </div>
                </div>

                <!-- Fast Terminal PIN (4-6 digits) -->
                <div class="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3">
                  <div class="flex items-center justify-between">
                    <label class="text-xs font-bold text-zinc-700 uppercase tracking-wider">PIN Rápido do Terminal (4 a 6 números) *</label>
                    <span class="text-[11px] text-zinc-500">Usado no dia a dia do caixa</span>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="space-y-1">
                      <label class="text-xs font-semibold text-zinc-700">Defina o PIN *</label>
                      <input
                        type="password"
                        formControlName="ownerPin"
                        maxlength="6"
                        placeholder="••••"
                        class="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-sm font-mono text-zinc-900 text-center tracking-widest focus:border-indigo-600 outline-none"
                      />
                    </div>

                    <div class="space-y-1">
                      <label class="text-xs font-semibold text-zinc-700">Confirme o PIN *</label>
                      <input
                        type="password"
                        formControlName="confirmPin"
                        maxlength="6"
                        placeholder="••••"
                        class="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-sm font-mono text-zinc-900 text-center tracking-widest focus:border-indigo-600 outline-none"
                      />
                    </div>
                  </div>

                  @if (pinMismatch()) {
                    <p class="text-xs font-bold text-rose-600 flex items-center gap-1">
                      <mat-icon class="text-sm">error</mat-icon>
                      Os dois PINs digitados não são idênticos.
                    </p>
                  }
                </div>
              </div>
            </div>
          }

          <!-- STEP 3: Database mode selection -->
          @if (step() === 3) {
            <div class="space-y-5">
              <h2 class="text-sm font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-2">
                <mat-icon class="text-indigo-600 text-base">storage</mat-icon>
                Modo de Inicialização dos Dados
              </h2>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <!-- Option 1: Clean Production Database -->
                <div
                  (click)="loadDemo.set(false)"
                  [class.border-indigo-600]="!loadDemo()"
                  [class.bg-indigo-50/40]="!loadDemo()"
                  [class.ring-2]="!loadDemo()"
                  [class.ring-indigo-600/20]="!loadDemo()"
                  [class.border-zinc-200]="loadDemo()"
                  [class.bg-white]="loadDemo()"
                  class="p-5 rounded-2xl border cursor-pointer transition-all space-y-2 flex flex-col justify-between"
                >
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <div class="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        <mat-icon class="text-sm">check_circle</mat-icon>
                      </div>
                      <span class="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">Produção Real</span>
                    </div>
                    <h3 class="font-bold text-sm text-zinc-900">Banco Limpo & Vazio</h3>
                    <p class="text-xs text-zinc-500 mt-1">
                      Inicia sem produtos ou clientes fictícios. Ideal para cadastrar seu próprio estoque real imediatamente.
                    </p>
                  </div>
                  <div class="text-[11px] font-semibold text-emerald-700 pt-2">✓ Recomendado para operação real</div>
                </div>

                <!-- Option 2: Demo Data -->
                <div
                  (click)="loadDemo.set(true)"
                  [class.border-indigo-600]="loadDemo()"
                  [class.bg-indigo-50/40]="loadDemo()"
                  [class.ring-2]="loadDemo()"
                  [class.ring-indigo-600/20]="loadDemo()"
                  [class.border-zinc-200]="!loadDemo()"
                  [class.bg-white]="!loadDemo()"
                  class="p-5 rounded-2xl border cursor-pointer transition-all space-y-2 flex flex-col justify-between"
                >
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <div class="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                        <mat-icon class="text-sm">local_mall</mat-icon>
                      </div>
                      <span class="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold uppercase">Amostra Demo</span>
                    </div>
                    <h3 class="font-bold text-sm text-zinc-900">Carregar Dados de Demonstração</h3>
                    <p class="text-xs text-zinc-500 mt-1">
                      Popula 10 produtos de exemplo (bebidas, lanches), mesas, fornecedores e caderneta de fiado para teste e validação.
                    </p>
                  </div>
                  <div class="text-[11px] font-semibold text-indigo-700 pt-2">⚡ Ideal para testar todos os módulos</div>
                </div>

              </div>

              <div class="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs text-zinc-600 space-y-1">
                <div class="font-bold text-zinc-800">Arquitetura Local-First 100% Offline:</div>
                <p>Todos os dados serão salvos no IndexedDB Dexie do seu navegador/dispositivo. Nenhuma informação sai do terminal sem sua autorização explícita.</p>
              </div>
            </div>
          }

          <!-- Footer Buttons -->
          <div class="flex items-center justify-between pt-4 border-t border-zinc-100">
            @if (step() > 1) {
              <button
                type="button"
                (click)="step.set(step() - 1); validationError.set('')"
                class="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <mat-icon class="text-sm">arrow_back</mat-icon>
                Voltar
              </button>
            } @else {
              <div></div>
            }

            @if (step() > 1 && step() < 3) {
              <button
                type="button"
                (click)="nextStep()"
                class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
              >
                Próximo
                <mat-icon class="text-sm">arrow_forward</mat-icon>
              </button>
            } @else if (step() === 3) {
              <button
                type="submit"
                [disabled]="isSubmitting()"
                class="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <mat-icon class="text-sm">rocket_launch</mat-icon>
                {{ isSubmitting() ? 'Iniciando Sistema...' : 'Concluir & Abrir 3eatcru OS' }}
              </button>
            }
          </div>
        </form>

      </div>
    </div>
  `
})
export class SetupWizardComponent {
  private fb = inject(FormBuilder);
  private context = inject(AppContextService);
  private central = inject(CentralPlatformService);
  private idGen = inject(IdGeneratorService);

  step = signal<number>(1);
  setupMode = signal<'DIRECT' | 'CENTRAL_CODE'>('CENTRAL_CODE');
  pairingCodeInput = signal('');
  pairingError = signal<string>('');
  validationError = signal<string>('');
  loadDemo = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  pinMismatch = signal<boolean>(false);
  showPassword = signal<boolean>(false);
  passwordStrength = signal<PasswordStrengthResult>(evaluatePasswordStrength(''));

  // Armazena licença e terminal pareados na Central
  pairedLicense = signal<CentralLicense | null>(null);
  pairedDevice = signal<CentralDevice | null>(null);
  pairedSyncToken = signal<string>('');

  form = this.fb.group({
    tradingName: ['', Validators.required],
    companyName: ['', Validators.required],
    cnpj: [''],
    phone: [''],
    city: [''],
    state: [''],
    locationName: [''],
    deviceName: [''],
    ownerName: ['', Validators.required],
    ownerEmail: ['', [Validators.required, Validators.email]],
    ownerPassword: ['', [Validators.required, Validators.minLength(8)]],
    ownerPin: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(6)]],
    confirmPin: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(6)]]
  });

  onPasswordInput(): void {
    const pwd = this.form.get('ownerPassword')?.value || '';
    this.passwordStrength.set(evaluatePasswordStrength(pwd));
  }

  applyCentralPairing() {
    this.pairingError.set('');
    this.validationError.set('');
    const code = this.pairingCodeInput().trim();
    if (!code || code.length !== 6) {
      this.pairingError.set('O código de pareamento deve ter 6 dígitos numéricos.');
      return;
    }

    this.central.pairDeviceWithCode(code, this.idGen.generatePrefixedId('hw')).then(res => {
      if (!res.success || !res.device) {
        this.pairingError.set(res.message || 'Código inválido ou expirado na Central.');
        return;
      }

      // Salva a licença associada ao dispositivo
      if (res.license) {
        this.pairedLicense.set(res.license);
      }
      this.pairedDevice.set(res.device);
      this.pairedSyncToken.set(res.syncToken || '');

      const company = this.central.companies().find(c => c.id === res.device!.companyId);
      if (company) {
        this.form.patchValue({
          tradingName: company.tradingName,
          companyName: company.name,
          cnpj: company.cnpj || '',
          phone: company.phone || '',
          city: company.city || 'São Paulo',
          state: company.state || 'SP',
          deviceName: res.device.deviceName,
          ownerName: company.ownerName
        });
      }

      this.setupMode.set('DIRECT');
      this.step.set(2);
    }).catch(err => {
      this.pairingError.set(err.message || 'Erro ao realizar pareamento');
    });
  }

  nextStep(): void {
    this.validationError.set('');
    if (this.step() === 1) {
      if (!this.form.get('tradingName')?.value || !this.form.get('companyName')?.value) {
        this.validationError.set('Por favor, informe o Nome Fantasia e a Razão Social da empresa.');
        return;
      }
      this.step.set(2);
    } else if (this.step() === 2) {
      const ownerName = this.form.get('ownerName')?.value;
      const ownerEmail = this.form.get('ownerEmail')?.value;
      const ownerPassword = this.form.get('ownerPassword')?.value;
      const pin = this.form.get('ownerPin')?.value;
      const confirm = this.form.get('confirmPin')?.value;

      if (!ownerName || !ownerName.trim()) {
        this.validationError.set('Por favor, informe o nome do gestor / proprietário.');
        return;
      }

      if (!ownerEmail || !ownerEmail.includes('@')) {
        this.validationError.set('Por favor, informe um endereço de e-mail corporativo válido.');
        return;
      }

      if (!ownerPassword || ownerPassword.length < 8) {
        this.validationError.set('A senha forte deve conter no mínimo 8 caracteres.');
        return;
      }

      if (!pin || pin.length < 4) {
        this.validationError.set('O PIN numérico deve conter no mínimo 4 dígitos.');
        return;
      }

      if (pin !== confirm) {
        this.pinMismatch.set(true);
        return;
      }

      this.pinMismatch.set(false);
      this.step.set(3);
    }
  }

  async finishSetup(): Promise<void> {
    if (this.isSubmitting()) return;
    this.isSubmitting.set(true);
    this.validationError.set('');

    try {
      const val = this.form.value;
      const license = this.pairedLicense();
      
      await this.context.setupInitialCompany({
        companyName: val.companyName!,
        tradingName: val.tradingName!,
        cnpj: val.cnpj || undefined,
        phone: val.phone || undefined,
        city: val.city || 'São Paulo',
        state: val.state || 'SP',
        locationName: val.locationName || 'Matriz - Centro',
        deviceName: val.deviceName || 'Caixa Balcão #01',
        ownerName: val.ownerName!,
        ownerEmail: val.ownerEmail!,
        ownerPassword: val.ownerPassword!,
        ownerPin: val.ownerPin!,
        seedDemoData: this.loadDemo(),
        
        // Passa as propriedades de licenciamento herdadas da Central
        licenseKey: license?.licenseKey,
        planId: license?.planId,
        planCode: license?.planCode,
        trialStartedAt: license?.trialStartedAt,
        trialEndsAt: license?.expiresAt,
        subscriptionStatus: license?.subscriptionStatus || 'TRIAL',
        syncToken: this.pairedSyncToken()
      });

      if (this.loadDemo()) {
        const companyId = this.context.companyId();
        await seedDemoData(companyId, this.context.locationId(), val.ownerName!);
      }
    } catch (err: any) {
      console.error('[SetupWizard] Error finishing setup:', err);
      this.validationError.set('Erro ao inicializar: ' + err.message);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}


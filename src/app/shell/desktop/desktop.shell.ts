import { Component, ChangeDetectionStrategy, inject, HostListener, OnInit, signal, computed, output, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { WindowManagerService } from '../../core/window-manager.service';
import { TaskbarComponent } from './components/taskbar.component';
import { WindowContainerComponent } from './components/window-container.component';
import { SetupWizardComponent } from './components/setup-wizard.component';
import { LockScreenComponent } from './components/lock-screen.component';

import { db, initializeDatabase } from '../../core/storage/dexie.db';
import { SyncOutboxService } from '../../core/sync/sync-outbox.service';
import { AppContextService } from '../../core/services/app-context.service';
import { PwaService } from '../../core/services/pwa.service';
import { AppRegistry, AppManifest } from '../../core/services/app-registry';

@Component({
  selector: 'app-desktop-shell',
  standalone: true,
  imports: [
    CommonModule, 
    MatIconModule, 
    TaskbarComponent, 
    WindowContainerComponent,
    SetupWizardComponent,
    LockScreenComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-screen w-screen overflow-hidden flex flex-col bg-zinc-100 text-zinc-900 select-none font-sans">
      
      @if (isInitializing()) {
        <div class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-zinc-100">
          <mat-icon class="text-indigo-500 animate-spin text-4xl" style="width:40px;height:40px;">refresh</mat-icon>
          <p class="mt-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">Carregando Terminal...</p>
        </div>
      } @else {
        <!-- 1. Initial Setup Wizard if no company/owner exists -->
      @if (!context.isConfigured()) {
        <app-setup-wizard></app-setup-wizard>
      }

      <!-- 2. Screen Lock / PIN Authenticator -->
      @if (context.isConfigured() && context.isLocked()) {
        <app-lock-screen></app-lock-screen>
      }

      <!-- 3. Trial Expirado Overlay -->
      @if (context.isConfigured() && context.isTrialExpired()) {
        <div class="fixed inset-0 z-40 bg-zinc-950/75 backdrop-blur-md flex items-center justify-center p-4">
          <div class="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-zinc-200 p-6 text-center space-y-4">
            <div class="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 flex items-center justify-center mx-auto">
              <mat-icon style="font-size: 32px; width: 32px; height: 32px;">timer_off</mat-icon>
            </div>
            
            <div class="space-y-2">
              <span class="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-mono font-bold text-amber-800 uppercase tracking-wider inline-block">
                TRIAL EXPIRADO
              </span>
              <h2 class="text-xl font-black tracking-tight text-zinc-900">Período de Testes Concluído</h2>
              <p class="text-xs text-zinc-500 leading-relaxed">
                Seus 7 dias de avaliação gratuita do <strong>3eatcru OS</strong> chegaram ao fim. 
                <br><br>
                <span class="text-zinc-700 font-medium">Fique tranquilo, nenhum dado ou histórico local de vendas foi apagado.</span> 
                Sua infraestrutura local de alta resiliência e banco de dados offline estão seguros e preservados.
              </p>
            </div>

            <div class="p-3.5 bg-zinc-50 border border-zinc-100 rounded-2xl text-left space-y-1.5 text-[11px] text-zinc-600">
              <div class="flex items-center gap-1.5 font-bold text-zinc-700 text-xs">
                <mat-icon class="text-indigo-600 text-[14px] w-[14px] h-[14px]">info</mat-icon>
                <span>Acesso Operacional Preservado</span>
              </div>
              <p class="leading-normal">
                Para reestabelecer o funcionamento operacional total, reabrir o caixa e continuar emitindo pedidos, ative o seu plano comercial correspondente na Central 3eatcru ou realize a ativação imediata abaixo.
              </p>
            </div>

            <div class="grid grid-cols-1 gap-2 pt-2">
              <button
                type="button"
                (click)="activatePlan()"
                class="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md cursor-pointer transition-all active:scale-[0.98]"
              >
                <mat-icon class="text-white text-sm">workspace_premium</mat-icon>
                <span>Ativar Plano de Assinatura</span>
              </button>
              
              <button
                type="button"
                (click)="openCentral.emit()"
                class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs cursor-pointer transition-all"
              >
                <mat-icon class="text-zinc-600 text-sm">admin_panel_settings</mat-icon>
                <span>Ir para a Central Administrativa</span>
              </button>
            </div>
          </div>
        </div>
      }

      @if (context.isConfigured()) {
        <!-- Top OS Navigation & Central Switcher -->
      <header class="h-12 px-4 lg:px-6 bg-white border-b border-zinc-200 flex items-center justify-between shrink-0 shadow-xs z-20">
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span class="text-xs font-black tracking-tight text-zinc-900">3eatcru OS</span>
            <span class="px-2 py-0.5 rounded-md bg-zinc-100 text-[10px] font-mono text-zinc-600 font-bold">Terminal Operacional</span>
          </div>
          <span class="text-zinc-300">|</span>
          <div class="hidden sm:flex items-center gap-1.5 text-xs text-zinc-600 font-medium">
            <mat-icon class="text-indigo-600 text-sm">storefront</mat-icon>
            <span class="font-bold text-zinc-900">{{ context.company()?.tradingName || 'Meu Estabelecimento' }}</span>
            <span class="text-zinc-400">({{ context.location()?.name || 'Matriz' }})</span>
          </div>
          
          <!-- Trial Status Indicator inside Header -->
          @if (context.isConfigured() && !context.isTrialExpired() && context.company()?.subscriptionStatus === 'TRIAL') {
            <span class="text-zinc-300 hidden sm:inline">|</span>
            <div class="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-800">
              <mat-icon class="text-amber-600 text-xs" style="font-size: 14px; width: 14px; height: 14px;">hourglass_empty</mat-icon>
              <span>Período de Testes: {{ context.daysRemaining() }} {{ context.daysRemaining() === 1 ? 'dia restante' : 'dias restantes' }}</span>
            </div>
          }
        </div>

        <div class="flex items-center gap-2">
          
          <!-- Install PWA Button -->
          @if (!pwa.isInstalled()) {
            <button
              type="button"
              (click)="pwa.install()"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
              title="Instalar Aplicativo (PWA)"
            >
              <mat-icon class="text-white text-sm">install_desktop</mat-icon>
              <span>Instalar OS</span>
            </button>
          }
          
          <!-- Button to open Central 3eatcru Platform Master -->

          <button
            type="button"
            (click)="openCentral.emit()"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Acessar a Central 3eatcru (Painel Administrativo Mestre da Plataforma)"
          >
            <mat-icon class="text-amber-600 text-sm">admin_panel_settings</mat-icon>
            <span>Central 3eatcru</span>
          </button>
        </div>
      </header>

      
      <!-- Desktop Workspace Area -->
      @if (!isOnline()) {
        <div class="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg animate-in slide-in-from-bottom-2">
          <span class="h-2 w-2 rounded-full bg-white animate-pulse"></span>
          Modo Offline — O sistema opera normalmente, os dados estão protegidos localmente.
        </div>
      }
      <div class="flex-1 relative p-4 lg:p-6 overflow-y-auto" (click)="desktopClick()">

        
        <!-- Holographic Background Motif -->
        <div class="fixed inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none">
          <mat-icon style="font-size: 500px; width: 500px; height: 500px;">desktop_windows</mat-icon>
        </div>

        <div class="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 relative z-10">
          
          <!-- Main Apps Workspace (Left/Center) -->
          <div class="flex-1 space-y-6">
            
            <!-- Category Filter Pills & Search -->
            <div class="flex flex-wrap items-center justify-between gap-3 bg-white/80 backdrop-blur-md p-3 rounded-2xl border border-zinc-200 shadow-xs">
              <div class="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  type="button"
                  (click)="selectedCategory.set('ALL')"
                  [class]="selectedCategory() === 'ALL' ? 'bg-indigo-600 text-white font-bold' : 'text-zinc-600 hover:bg-zinc-100 font-medium'"
                  class="px-3 py-1.5 rounded-xl cursor-pointer transition-all"
                >
                  Todos ({{ apps().length }})
                </button>
                @for (cat of categories; track cat.id) {
                  <button
                    type="button"
                    (click)="selectedCategory.set(cat.id)"
                    [class]="selectedCategory() === cat.id ? 'bg-indigo-600 text-white font-bold' : 'text-zinc-600 hover:bg-zinc-100 font-medium'"
                    class="px-3 py-1.5 rounded-xl cursor-pointer transition-all"
                  >
                    {{ cat.name }}
                  </button>
                }
              </div>

              <!-- Search filter input -->
              <div class="relative w-full sm:w-56">
                <mat-icon class="absolute left-2.5 top-2 text-zinc-400 text-sm">search</mat-icon>
                <input
                  type="text"
                  [value]="searchQuery()"
                  (input)="searchQuery.set($any($event.target).value)"
                  placeholder="Filtrar aplicativo..."
                  class="w-full pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 placeholder-zinc-400 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <!-- Bento Grid of Apps -->
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 lg:gap-4">
              @for (app of filteredApps(); track app.id) {
                <button
                  (click)="openApp(app); $event.stopPropagation()"
                  class="group flex flex-col items-center text-center p-3.5 rounded-2xl bg-white border border-zinc-200 hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all outline-none cursor-pointer relative"
                >
                  <div class="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center shadow-xs group-hover:scale-105 group-hover:bg-indigo-50/50 transition-all relative">
                    <mat-icon class="{{app.iconColor}} text-2xl lg:text-3xl">{{ app.icon }}</mat-icon>
                    @if (app.badge) {
                      <div class="absolute -top-1 -right-1 px-1.5 py-0.2 bg-indigo-600 border border-white rounded-full text-[9px] font-bold text-white shadow-xs">
                        {{ app.badge }}
                      </div>
                    }
                  </div>
                  <span class="text-xs font-bold text-zinc-800 group-hover:text-indigo-900 mt-2.5 line-clamp-2 leading-tight">
                    {{ app.name }}
                  </span>
                  <span class="text-[9px] font-medium text-zinc-400 mt-0.5 uppercase tracking-wider">
                    {{ app.category }}
                  </span>
                  @if (app.shortcut) {
                    <span class="mt-1 px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-500 font-mono text-[9px] font-bold">
                      {{ app.shortcut }}
                    </span>
                  }
                </button>
              }
            </div>

          </div>
          
          <!-- Live Telemetry & Quick System Status (Right Side) -->
          <div class="w-full lg:w-80 flex flex-col gap-4 shrink-0">
            
            <!-- Company & Operator Badge Card -->
            <div class="bg-white border border-zinc-200 rounded-3xl p-4 shadow-xs flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <mat-icon class="text-xl">storefront</mat-icon>
                </div>
                <div class="overflow-hidden">
                  <h4 class="text-xs font-bold text-zinc-900 truncate">{{ context.company()?.tradingName || 'Minha Empresa' }}</h4>
                  <p class="text-[10px] text-zinc-500 flex items-center gap-1">
                    <mat-icon class="text-[12px] text-emerald-600">person</mat-icon>
                    <span class="truncate">{{ context.operatorName() }} ({{ context.operatorRole() }})</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                (click)="context.lockSession()"
                title="Bloquear Sessão / Trocar Usuário"
                class="p-2 rounded-xl text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <mat-icon class="text-base">lock</mat-icon>
              </button>
            </div>

            <!-- Main stat card -->
            <div class="bg-gradient-to-br from-indigo-700 via-indigo-800 to-indigo-950 rounded-3xl p-5 text-white shadow-lg relative overflow-hidden">
              <div class="relative z-10 space-y-1">
                <p class="text-indigo-200 text-[10px] font-bold uppercase tracking-widest">Faturamento Hoje (PDV)</p>
                <h2 class="text-2xl lg:text-3xl font-black font-mono">R$ {{ faturamentoHoje().toFixed(2) }}</h2>
                <div class="flex items-center gap-2 pt-2 text-xs text-indigo-100">
                  <span class="w-2 h-2 rounded-full" [class.bg-emerald-400]="isCashOpen()" [class.animate-pulse]="isCashOpen()" [class.bg-amber-400]="!isCashOpen()"></span>
                  <span>{{ isCashOpen() ? 'Caixa do Turno Aberto' : 'Caixa Fechado' }}</span>
                </div>
              </div>
              <div class="absolute -right-4 -bottom-4 opacity-15">
                <mat-icon style="font-size: 110px; width: 110px; height: 110px;">stacked_line_chart</mat-icon>
              </div>
            </div>
            
            <!-- Secondary Telemetry Bento -->
            <div class="bg-white border border-zinc-200 rounded-3xl p-5 shadow-xs space-y-3.5">
              <h3 class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Telemetria & Arquitetura Local-First</h3>
              
              <div class="space-y-3 text-xs">
                <div class="flex items-center justify-between">
                  <span class="text-zinc-600">Vendas Finalizadas</span>
                  <span class="font-bold text-zinc-900 font-mono">{{ totalVendasHoje() }} cupons</span>
                </div>

                <div class="flex items-center justify-between">
                  <span class="text-zinc-600">Sync Outbox Queue</span>
                  <div class="flex items-center gap-1.5 font-bold" [class.text-amber-600]="sync.pendingCount() > 0" [class.text-emerald-600]="sync.pendingCount() === 0">
                    <span class="w-2 h-2 rounded-full" [class.bg-amber-500]="sync.pendingCount() > 0" [class.animate-ping]="sync.pendingCount() > 0" [class.bg-emerald-500]="sync.pendingCount() === 0"></span>
                    <span class="font-mono">{{ sync.pendingCount() > 0 ? sync.pendingCount() + ' pendentes' : '100% Offline/Synced' }}</span>
                  </div>
                </div>

                <div class="flex items-center justify-between">
                  <span class="text-zinc-600">Motor de Persistência</span>
                  <span class="font-bold text-indigo-700 font-mono">Dexie IndexedDB v2</span>
                </div>

                <div class="flex items-center justify-between pt-2 border-t border-zinc-100">
                  <span class="text-zinc-600">Filial Ativa</span>
                  <span class="font-bold text-zinc-800">{{ context.location()?.name || 'Matriz' }}</span>
                </div>
              </div>
            </div>

            <!-- Quick Shortcuts Guide -->
            <div class="bg-white border border-zinc-200 rounded-3xl p-4 shadow-xs text-xs space-y-2">
              <span class="text-[10px] uppercase font-bold text-zinc-400">Atalhos Globais do Sistema</span>
              <div class="grid grid-cols-2 gap-2 text-[11px]">
                <div class="p-2 bg-zinc-50 rounded-xl border border-zinc-200 flex justify-between items-center">
                  <span class="text-zinc-600 font-semibold">PDV Rápido</span>
                  <kbd class="px-1.5 py-0.5 bg-white border border-zinc-300 rounded font-mono font-bold text-zinc-800">F2</kbd>
                </div>
                <div class="p-2 bg-zinc-50 rounded-xl border border-zinc-200 flex justify-between items-center">
                  <span class="text-zinc-600 font-semibold">Abrir Caixa</span>
                  <kbd class="px-1.5 py-0.5 bg-white border border-zinc-300 rounded font-mono font-bold text-zinc-800">F4</kbd>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Floating Windows Container -->
        <app-window-container></app-window-container>
      </div>

      <!-- Taskbar / Dock -->
        <app-taskbar></app-taskbar>
      }
      }
  `
})
export class DesktopShellComponent implements OnInit {
  isInitializing = signal(true);
  private platformId = inject(PLATFORM_ID);
  pwa = inject(PwaService);
  isOnline = signal(true);
  wm = inject(WindowManagerService);
  sync = inject(SyncOutboxService);
  context = inject(AppContextService);

  openCentral = output<void>();

  faturamentoHoje = signal(0);
  totalVendasHoje = signal(0);
  isCashOpen = signal(false);

  selectedCategory = signal<string>('ALL');
  searchQuery = signal('');

  categories = [
    { id: 'OPERACAO', name: 'Operação & Caixa' },
    { id: 'SUPRIMENTOS', name: 'Estoque & Compras' },
    { id: 'CLIENTES', name: 'Clientes & Vendas' },
    { id: 'PRODUCAO', name: 'Serviços & Produção' },
    { id: 'GESTAO', name: 'Gestão & ERP' }
  ];

  private appsRegistry = inject(AppRegistry);
  apps = computed(() => this.appsRegistry.apps());

  filteredApps = () => {
    let list = this.apps();
    const cat = this.selectedCategory();
    if (cat !== 'ALL') {
      list = list.filter(a => a.category === cat);
    }
    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(a => a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q));
    }
    return list;
  };

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.isOnline.set(typeof navigator !== 'undefined' ? navigator.onLine : true);
      window.addEventListener('online', () => this.isOnline.set(true));
      window.addEventListener('offline', () => this.isOnline.set(false));

      await initializeDatabase(this.platformId);
      await this.context.initContext();
      await this.refreshTelemetry();
      this.isInitializing.set(false);
    }
  }

  async refreshTelemetry() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const compId = this.context.companyId();
      const locId = this.context.locationId();

      const sales = await db.sales
        .filter(s => s.status === 'COMPLETED' && s.companyId === compId && (!locId || s.locationId === locId))
        .toArray();
      const total = sales.reduce((acc, s) => acc + s.total, 0);
      this.faturamentoHoje.set(total);
      this.totalVendasHoje.set(sales.length);

      const openCash = await db.cashSessions
        .filter(s => s.status === 'OPEN' && s.companyId === compId && (!locId || s.locationId === locId))
        .first();
      this.isCashOpen.set(!!openCash);

      await this.sync.refreshPendingCount();
    } catch {
      // Ignored
    }
  }

  async activatePlan() {
    await this.context.activateLicenseSimulated();
    await this.refreshTelemetry();
  }

  async openApp(app: AppManifest) {
    if (this.context.isTrialExpired()) {
      alert('Seu período de avaliação gratuita de 7 dias do 3eatcru OS expirou. Por favor, ative seu plano comercial para liberar a operação.');
      return;
    }
    let componentClass = app.component;
    if (app.loadComponent) {
      try {
        componentClass = await app.loadComponent();
      } catch (err) {
        console.error(`[DesktopShell] Error loading app component dynamically for ${app.id}:`, err);
      }
    }
    this.wm.openApp(app.id, app.name, app.icon, componentClass);
    this.refreshTelemetry();
  }

  desktopClick() {
    this.wm.activeWindowId.set(null);
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (this.context.isLocked() || !this.context.isConfigured()) return;

    if (event.key === 'F2') {
      event.preventDefault();
      const targetApp = this.apps().find(a => a.shortcut === 'F2' || a.id === 'pdv');
      if (targetApp) this.openApp(targetApp);
    } else if (event.key === 'F4') {
      event.preventDefault();
      const targetApp = this.apps().find(a => a.shortcut === 'F4' || a.id === 'caixa');
      if (targetApp) this.openApp(targetApp);
    }
  }
}


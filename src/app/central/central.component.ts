import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CentralPlatformService } from '../core/services/central-platform.service';
import { CentralAccount, CentralCompany, CentralPlan, CentralLicense, CentralDevice } from '../core/models';

@Component({
  selector: 'app-central',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-screen w-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans select-none overflow-hidden">
      
      @if (!isAuthorized()) {
        <!-- ADMIN LOGIN GATE -->
        <div class="flex-1 flex flex-col items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black">
          
          <div class="w-full max-w-md bg-zinc-900/80 backdrop-blur-md border border-zinc-800/85 p-8 rounded-3xl shadow-2xl space-y-6">
            
            <div class="text-center space-y-2">
              <div class="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-indigo-400 p-0.5 shadow-lg flex items-center justify-center">
                <div class="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                  <mat-icon class="text-amber-400 text-2xl">admin_panel_settings</mat-icon>
                </div>
              </div>
              <h2 class="text-xl font-black tracking-tight text-white">Acesso Restrito à Central</h2>
              <p class="text-xs text-zinc-400">Esta área requer credenciais de Superadministrador da Plataforma 3eatcru.</p>
            </div>

            <form (submit)="tryLogin(); $event.preventDefault()" class="space-y-4">
              <div class="space-y-1.5">
                <label class="text-[11px] uppercase font-bold tracking-wider text-zinc-400">Usuário Operador</label>
                <div class="relative">
                  <mat-icon class="absolute left-3 top-2.5 text-zinc-500 text-sm">person</mat-icon>
                  <input
                    type="text"
                    name="username"
                    [value]="adminUsername()"
                    (input)="adminUsername.set($any($event.target).value)"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500 transition-colors"
                    placeholder="Ex: admin"
                    required
                  />
                </div>
              </div>

              <div class="space-y-1.5">
                <label class="text-[11px] uppercase font-bold tracking-wider text-zinc-400">Chave Mestra da Central</label>
                <div class="relative">
                  <mat-icon class="absolute left-3 top-2.5 text-zinc-500 text-sm">lock</mat-icon>
                  <input
                    type="password"
                    name="password"
                    [value]="adminPassword()"
                    (input)="adminPassword.set($any($event.target).value)"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500 transition-colors font-mono"
                    placeholder="••••••••••••••"
                    required
                  />
                </div>
              </div>

              @if (loginError()) {
                <div class="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                  <mat-icon class="text-sm">error_outline</mat-icon>
                  <span>{{ loginError() }}</span>
                </div>
              }

              <div class="flex flex-col gap-2 pt-2">
                <button
                  type="submit"
                  class="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-indigo-500/10"
                >
                  Autenticar e Entrar
                </button>
                <button
                  type="button"
                  (click)="openTerminal.emit()"
                  class="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all cursor-pointer border border-zinc-700/50"
                >
                  Voltar ao Terminal OS
                </button>
              </div>
            </form>

            <div class="pt-4 border-t border-zinc-800/60 text-center text-[10px] text-zinc-600 font-mono">
              3eatcru Central Control Plane v2.4 • Produção Protegida
            </div>
          </div>
        </div>
      } @else {
        <!-- TOP NAV / MASTHEAD -->
        <header class="h-16 px-6 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between shrink-0 backdrop-blur-md z-20">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-indigo-400 p-0.5 shadow-md flex items-center justify-center">
            <div class="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
              <mat-icon class="text-amber-400 text-xl">admin_panel_settings</mat-icon>
            </div>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-base font-black tracking-tight text-white flex items-center gap-1.5">
                3eatcru <span class="text-amber-400 font-mono text-xs uppercase px-1.5 py-0.5 bg-amber-400/10 rounded-md border border-amber-400/20">Central</span>
              </h1>
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="text-[10px] text-zinc-400 font-mono font-medium">Control Plane v2.4</span>
            </div>
            <p class="text-[11px] text-zinc-400">Autoridade Central de Contas, Licenças e Dispositivos</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Quick Status Pills -->
          <div class="hidden md:flex items-center gap-2 text-xs font-mono bg-zinc-950/80 px-3 py-1.5 rounded-xl border border-zinc-800">
            <span class="text-zinc-400">Terminais Online:</span>
            <span class="text-emerald-400 font-bold">{{ central.onlineDevices() }}/{{ central.totalDevices() }}</span>
            <span class="text-zinc-700">|</span>
            <span class="text-zinc-400">Empresas Ativas:</span>
            <span class="text-indigo-400 font-bold">{{ central.activeCompanies() }}</span>
          </div>

          <!-- Switch to OS Terminal Button -->
          <button
            type="button"
            (click)="openTerminal.emit()"
            class="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md hover:shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <mat-icon class="text-sm">desktop_windows</mat-icon>
            <span>Ir para 3eatcru OS</span>
          </button>
        </div>
      </header>

      <!-- MAIN CONTAINER: SIDEBAR + CONTENT -->
      <div class="flex-1 flex overflow-hidden">
        
        <!-- SIDEBAR NAVIGATION -->
        <aside class="w-64 bg-zinc-900/50 border-r border-zinc-800/80 p-4 flex flex-col justify-between shrink-0 overflow-y-auto">
          <div class="space-y-6">
            
            <div class="space-y-1">
              <span class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-3">Plataforma Master</span>
              
              <nav class="space-y-1 pt-1">
                <button
                  type="button"
                  (click)="activeTab.set('dashboard')"
                  [class]="activeTab() === 'dashboard' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-bold' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 font-medium'"
                  class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer text-left"
                >
                  <mat-icon class="text-base" [class.text-indigo-400]="activeTab() === 'dashboard'">dashboard</mat-icon>
                  <span>Dashboard & Telemetria</span>
                </button>

                <button
                  type="button"
                  (click)="activeTab.set('contas')"
                  [class]="activeTab() === 'contas' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-bold' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 font-medium'"
                  class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer text-left"
                >
                  <div class="flex items-center gap-3">
                    <mat-icon class="text-base" [class.text-indigo-400]="activeTab() === 'contas'">manage_accounts</mat-icon>
                    <span>Contas (Proprietários)</span>
                  </div>
                  <span class="px-1.5 py-0.2 bg-zinc-800 text-[10px] font-mono rounded text-zinc-400">{{ central.accounts().length }}</span>
                </button>

                <button
                  type="button"
                  (click)="activeTab.set('empresas')"
                  [class]="activeTab() === 'empresas' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-bold' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 font-medium'"
                  class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer text-left"
                >
                  <div class="flex items-center gap-3">
                    <mat-icon class="text-base" [class.text-indigo-400]="activeTab() === 'empresas'">domain</mat-icon>
                    <span>Empresas (Tenants)</span>
                  </div>
                  <span class="px-1.5 py-0.2 bg-zinc-800 text-[10px] font-mono rounded text-zinc-400">{{ central.companies().length }}</span>
                </button>
              </nav>
            </div>

            <div class="space-y-1">
              <span class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-3">Governança & Acesso</span>
              
              <nav class="space-y-1 pt-1">
                <button
                  type="button"
                  (click)="activeTab.set('licencas')"
                  [class]="activeTab() === 'licencas' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-bold' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 font-medium'"
                  class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer text-left"
                >
                  <div class="flex items-center gap-3">
                    <mat-icon class="text-base" [class.text-amber-400]="activeTab() === 'licencas'">vpn_key</mat-icon>
                    <span>Licenças de Software</span>
                  </div>
                  <span class="px-1.5 py-0.2 bg-zinc-800 text-[10px] font-mono rounded text-amber-400">{{ central.licenses().length }}</span>
                </button>

                <button
                  type="button"
                  (click)="activeTab.set('dispositivos')"
                  [class]="activeTab() === 'dispositivos' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-bold' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 font-medium'"
                  class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer text-left"
                >
                  <div class="flex items-center gap-3">
                    <mat-icon class="text-base" [class.text-emerald-400]="activeTab() === 'dispositivos'">devices</mat-icon>
                    <span>Dispositivos & Pareamento</span>
                  </div>
                  <span class="px-1.5 py-0.2 bg-zinc-800 text-[10px] font-mono rounded text-emerald-400">{{ central.devices().length }}</span>
                </button>

                <button
                  type="button"
                  (click)="activeTab.set('planos')"
                  [class]="activeTab() === 'planos' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-bold' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 font-medium'"
                  class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer text-left"
                >
                  <mat-icon class="text-base" [class.text-indigo-400]="activeTab() === 'planos'">workspace_premium</mat-icon>
                  <span>Planos & Assinaturas</span>
                </button>
              </nav>
            </div>

            <div class="space-y-1">
              <span class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-3">Segurança & Versões</span>
              
              <nav class="space-y-1 pt-1">
                <button
                  type="button"
                  (click)="activeTab.set('auditoria')"
                  [class]="activeTab() === 'auditoria' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-bold' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 font-medium'"
                  class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer text-left"
                >
                  <mat-icon class="text-base" [class.text-indigo-400]="activeTab() === 'auditoria'">receipt_long</mat-icon>
                  <span>Auditoria Central</span>
                </button>

                <button
                  type="button"
                  (click)="activeTab.set('versoes')"
                  [class]="activeTab() === 'versoes' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-bold' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 font-medium'"
                  class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer text-left"
                >
                  <mat-icon class="text-base" [class.text-indigo-400]="activeTab() === 'versoes'">system_update</mat-icon>
                  <span>Versões & Releases OS</span>
                </button>
              </nav>
            </div>

          </div>

          <!-- Bottom Authority Box -->
          <div class="p-3 bg-zinc-950 rounded-2xl border border-zinc-800/80 text-[11px] space-y-1">
            <div class="flex items-center gap-2 text-zinc-300 font-bold">
              <mat-icon class="text-amber-400 text-sm">shield</mat-icon>
              <span>Central Authority Mode</span>
            </div>
            <p class="text-[10px] text-zinc-500 leading-tight">
              A Central decide quem pode operar o 3eatcru OS. Não depende do banco local dos terminais.
            </p>
          </div>
        </aside>

        <!-- CONTENT AREA -->
        <main class="flex-1 overflow-y-auto p-6 lg:p-8 bg-zinc-950">
          
          <!-- TAB 1: DASHBOARD -->
          @if (activeTab() === 'dashboard') {
            <div class="max-w-6xl mx-auto space-y-6">
              
              <!-- Welcome Banner -->
              <div class="bg-gradient-to-r from-zinc-900 via-indigo-950 to-zinc-900 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
                <div class="relative z-10 space-y-2">
                  <span class="px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20 text-[10px] font-mono font-bold uppercase tracking-wider">
                    Plataforma Master • 3eatcru Central
                  </span>
                  <h2 class="text-2xl font-black text-white">Painel de Controle Central da Plataforma</h2>
                  <p class="text-xs text-zinc-400 max-w-xl">
                    Monitore contas de proprietários, empresas ativas, emissão de chaves de licença, pareamento de hardware e auditoria global de eventos.
                  </p>
                </div>
              </div>

              <!-- Key Metrics Grid -->
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-1">
                  <div class="flex items-center justify-between text-zinc-400 text-xs">
                    <span>Empresas Registradas</span>
                    <mat-icon class="text-indigo-400 text-base">domain</mat-icon>
                  </div>
                  <h3 class="text-2xl font-black font-mono text-white">{{ central.totalCompanies() }}</h3>
                  <p class="text-[11px] text-emerald-400 font-medium">{{ central.activeCompanies() }} com licença ativa</p>
                </div>

                <div class="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-1">
                  <div class="flex items-center justify-between text-zinc-400 text-xs">
                    <span>Licenças Emitidas</span>
                    <mat-icon class="text-amber-400 text-base">vpn_key</mat-icon>
                  </div>
                  <h3 class="text-2xl font-black font-mono text-amber-400">{{ central.licenses().length }}</h3>
                  <p class="text-[11px] text-zinc-400 font-medium">{{ central.activeLicenses() }} vigentes</p>
                </div>

                <div class="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-1">
                  <div class="flex items-center justify-between text-zinc-400 text-xs">
                    <span>Dispositivos Pareados</span>
                    <mat-icon class="text-emerald-400 text-base">devices</mat-icon>
                  </div>
                  <h3 class="text-2xl font-black font-mono text-emerald-400">{{ central.devices().length }}</h3>
                  <p class="text-[11px] text-emerald-400 font-medium">{{ central.onlineDevices() }} online agora</p>
                </div>

                <div class="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-1">
                  <div class="flex items-center justify-between text-zinc-400 text-xs">
                    <span>Proprietários / Contas</span>
                    <mat-icon class="text-indigo-400 text-base">groups</mat-icon>
                  </div>
                  <h3 class="text-2xl font-black font-mono text-white">{{ central.accounts().length }}</h3>
                  <p class="text-[11px] text-indigo-300 font-medium">Controle de acesso por PIN próprio</p>
                </div>
              </div>

              <!-- Two Column Sections: Quick Actions & Live Telemetry -->
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                <!-- Quick Actions Panel -->
                <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
                  <h3 class="text-sm font-bold text-white flex items-center gap-2">
                    <mat-icon class="text-indigo-400 text-base">flash_on</mat-icon>
                    Ações Administrativas Rápidas
                  </h3>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      (click)="openAccountModal()"
                      class="p-4 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-indigo-500/50 rounded-2xl text-left transition-all cursor-pointer group"
                    >
                      <div class="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                        <mat-icon class="text-base">person_add</mat-icon>
                      </div>
                      <h4 class="text-xs font-bold text-white">Criar Conta</h4>
                      <p class="text-[11px] text-zinc-500">Cadastrar novo proprietário</p>
                    </button>

                    <button
                      type="button"
                      (click)="openCompanyModal()"
                      class="p-4 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/50 rounded-2xl text-left transition-all cursor-pointer group"
                    >
                      <div class="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                        <mat-icon class="text-base">add_business</mat-icon>
                      </div>
                      <h4 class="text-xs font-bold text-white">Nova Empresa</h4>
                      <p class="text-[11px] text-zinc-500">Emitir licença e vincular plano</p>
                    </button>

                    <button
                      type="button"
                      (click)="openDeviceModal()"
                      class="p-4 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-500/50 rounded-2xl text-left transition-all cursor-pointer group"
                    >
                      <div class="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                        <mat-icon class="text-base">qr_code_2</mat-icon>
                      </div>
                      <h4 class="text-xs font-bold text-white">Parear Terminal</h4>
                      <p class="text-[11px] text-zinc-500">Gerar código de 6 dígitos</p>
                    </button>

                    <button
                      type="button"
                      (click)="activeTab.set('licencas')"
                      class="p-4 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-indigo-500/50 rounded-2xl text-left transition-all cursor-pointer group"
                    >
                      <div class="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                        <mat-icon class="text-base">vpn_key</mat-icon>
                      </div>
                      <h4 class="text-xs font-bold text-white">Ver Licenças</h4>
                      <p class="text-[11px] text-zinc-500">Bloquear ou renovar prazos</p>
                    </button>
                  </div>
                </div>

                <!-- Recent Central Audit Trail -->
                <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
                  <div class="flex items-center justify-between">
                    <h3 class="text-sm font-bold text-white flex items-center gap-2">
                      <mat-icon class="text-amber-400 text-base">history</mat-icon>
                      Trilha Recente de Auditoria
                    </h3>
                    <button
                      type="button"
                      (click)="activeTab.set('auditoria')"
                      class="text-xs text-indigo-400 hover:underline cursor-pointer"
                    >
                      Ver tudo
                    </button>
                  </div>

                  <div class="space-y-2.5">
                    @for (log of central.auditLogs().slice(0, 5); track log.id) {
                      <div class="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-start justify-between text-xs">
                        <div class="space-y-0.5">
                          <p class="font-medium text-zinc-200">{{ log.action }}</p>
                          <span class="text-[10px] text-zinc-500 font-mono">{{ log.resource }} • {{ log.actor }}</span>
                        </div>
                        <span class="text-[10px] font-mono text-zinc-500 whitespace-nowrap">{{ formatTime(log.timestamp) }}</span>
                      </div>
                    } @empty {
                      <div class="text-center py-6 text-zinc-600 text-xs">
                        Nenhum evento registrado ainda.
                      </div>
                    }
                  </div>
                </div>

              </div>

            </div>
          }

          <!-- TAB 2: CONTAS (PROPRIETÁRIOS) -->
          @if (activeTab() === 'contas') {
            <div class="max-w-6xl mx-auto space-y-6">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-xl font-bold text-white">Contas de Proprietários & Assinantes</h2>
                  <p class="text-xs text-zinc-400">Identidade central do dono da conta (Firebase Auth / E-mail). Cada proprietário define seu próprio PIN para os terminais.</p>
                </div>
                <button
                  type="button"
                  (click)="openAccountModal()"
                  class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  <mat-icon class="text-sm">person_add</mat-icon>
                  <span>Nova Conta</span>
                </button>
              </div>

              <div class="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-xs text-zinc-300">
                    <thead class="bg-zinc-950 text-zinc-400 uppercase font-mono text-[10px] border-b border-zinc-800">
                      <tr>
                        <th class="p-4">Proprietário</th>
                        <th class="p-4">E-mail / Auth ID</th>
                        <th class="p-4">Telefone</th>
                        <th class="p-4 text-center">Empresas</th>
                        <th class="p-4 text-center">Status</th>
                        <th class="p-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-zinc-800">
                      @for (acc of central.accounts(); track acc.id) {
                        <tr class="hover:bg-zinc-800/40 transition-colors">
                          <td class="p-4 font-bold text-white flex items-center gap-2">
                            <div class="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                              {{ acc.name.charAt(0).toUpperCase() }}
                            </div>
                            <span>{{ acc.name }}</span>
                          </td>
                          <td class="p-4 font-mono text-zinc-400">{{ acc.email }}</td>
                          <td class="p-4 font-mono text-zinc-400">{{ acc.phone || '—' }}</td>
                          <td class="p-4 text-center font-mono font-bold text-indigo-400">{{ acc.companiesCount }}</td>
                          <td class="p-4 text-center">
                            <span
                              class="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono"
                              [class]="acc.status === 'ACTIVE' ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20' : 'bg-rose-400/10 text-rose-400 border border-rose-400/20'"
                            >
                              {{ acc.status === 'ACTIVE' ? 'ATIVA' : 'BLOQUEADA' }}
                            </span>
                          </td>
                          <td class="p-4 text-right">
                            <button
                              type="button"
                              (click)="central.toggleAccountStatus(acc.id)"
                              [title]="acc.status === 'ACTIVE' ? 'Bloquear Acesso' : 'Desbloquear Acesso'"
                              class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                              [class]="acc.status === 'ACTIVE' ? 'bg-rose-950/60 text-rose-300 hover:bg-rose-900 border border-rose-800' : 'bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900 border border-emerald-800'"
                            >
                              {{ acc.status === 'ACTIVE' ? 'Bloquear' : 'Ativar' }}
                            </button>
                          </td>
                        </tr>
                      } @empty {
                        <tr>
                          <td colspan="6" class="p-8 text-center text-zinc-500 text-xs">
                            Nenhuma conta cadastrada. Clique em "Nova Conta" para iniciar.
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          }

          <!-- TAB 3: EMPRESAS (TENANTS) -->
          @if (activeTab() === 'empresas') {
            <div class="max-w-6xl mx-auto space-y-6">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-xl font-bold text-white">Empresas & Estabelecimentos (Tenants)</h2>
                  <p class="text-xs text-zinc-400">Cada empresa é vinculada a um proprietário, possui um plano e recebe uma Chave de Licença Central.</p>
                </div>
                <button
                  type="button"
                  (click)="openCompanyModal()"
                  class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  <mat-icon class="text-sm">add_business</mat-icon>
                  <span>Nova Empresa</span>
                </button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                @for (comp of central.companies(); track comp.id) {
                  <div class="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4 hover:border-zinc-700 transition-all flex flex-col justify-between">
                    <div class="space-y-2">
                      <div class="flex items-start justify-between">
                        <div>
                          <h3 class="text-sm font-bold text-white">{{ comp.tradingName }}</h3>
                          <p class="text-[11px] text-zinc-400">{{ comp.name }}</p>
                        </div>
                        <div class="flex flex-col items-end gap-1 shrink-0">
                          <span
                            class="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase block"
                            [class]="comp.licenseStatus === 'ATIVA' ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20' : 'bg-rose-400/10 text-rose-400 border border-rose-400/20'"
                          >
                            {{ comp.licenseStatus }}
                          </span>
                          @if (comp.subscriptionStatus) {
                            <span
                              class="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase block"
                              [class]="comp.subscriptionStatus === 'TRIAL' ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' : comp.subscriptionStatus === 'ACTIVE' ? 'bg-indigo-400/10 text-indigo-400 border border-indigo-400/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'"
                            >
                              {{ comp.subscriptionStatus }}
                            </span>
                          }
                        </div>
                      </div>

                      <div class="pt-2 border-t border-zinc-800 space-y-1.5 text-xs">
                        <div class="flex items-center justify-between">
                          <span class="text-zinc-500">Proprietário:</span>
                          <span class="text-zinc-300 font-medium">{{ comp.ownerName }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                          <span class="text-zinc-500">CNPJ / Doc:</span>
                          <span class="font-mono text-zinc-400">{{ comp.cnpj || 'Não informado' }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                          <span class="text-zinc-500">Plano:</span>
                          <span class="text-amber-400 font-bold font-mono">{{ comp.planName }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                          <span class="text-zinc-500">Terminais:</span>
                          <span class="font-mono text-indigo-300 font-bold">{{ comp.terminalsCount }} / {{ comp.maxTerminals }}</span>
                        </div>
                        
                        @if (comp.subscriptionStatus === 'TRIAL' && comp.trialEndsAt) {
                          <div class="flex items-center justify-between bg-amber-500/5 p-2 rounded-xl border border-amber-500/10 text-[10px] text-amber-400">
                            <span class="flex items-center gap-1">
                              <mat-icon class="text-[12px] w-[12px] h-[12px]">hourglass_empty</mat-icon>
                              <span>Trial expira em:</span>
                            </span>
                            <span class="font-bold">{{ formatDate(comp.trialEndsAt) }}</span>
                          </div>
                        }
                      </div>

                      <div class="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                        <span class="text-[9px] uppercase font-mono text-zinc-500 font-bold">Chave de Licença Central:</span>
                        <p class="font-mono text-xs font-bold text-amber-300 select-all">{{ comp.licenseKey }}</p>
                      </div>
                    </div>

                    <div class="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                      <span class="text-[10px] text-zinc-500">{{ comp.city }}/{{ comp.state }}</span>
                      <button
                        type="button"
                        (click)="generatePairingForCompany(comp.id)"
                        class="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <mat-icon class="text-sm">qr_code</mat-icon>
                        <span>Parear PDV</span>
                      </button>
                    </div>
                  </div>
                } @empty {
                  <div class="col-span-full p-12 text-center text-zinc-500 text-xs bg-zinc-900 border border-zinc-800 rounded-3xl">
                    Nenhuma empresa cadastrada na Central. Clique em "Nova Empresa" para criar.
                  </div>
                }
              </div>
            </div>
          }

          <!-- TAB 4: LICENÇAS -->
          @if (activeTab() === 'licencas') {
            <div class="max-w-6xl mx-auto space-y-6">
              <div>
                <h2 class="text-xl font-bold text-white">Central de Licenças de Software</h2>
                <p class="text-xs text-zinc-400">Emissão, vigência e bloqueio instantâneo de licenças do 3eatcru OS.</p>
              </div>

               <div class="space-y-3">
                @for (lic of central.licenses(); track lic.id) {
                  <div class="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div class="space-y-1.5">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-mono text-base font-black text-amber-400 select-all tracking-wider mr-2">{{ lic.licenseKey }}</span>
                        <span
                          class="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono"
                          [class]="lic.status === 'ATIVA' ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20' : 'bg-rose-400/10 text-rose-400 border border-rose-400/20'"
                        >
                          {{ lic.status }}
                        </span>
                        @if (lic.subscriptionStatus) {
                          <span
                            class="px-2 py-0.5 rounded bg-indigo-900/40 text-indigo-200 border border-indigo-800 text-[10px] font-mono font-bold"
                          >
                            {{ lic.subscriptionStatus }}
                          </span>
                        }
                        <span class="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px] font-bold">
                          Plano {{ lic.planCode }}
                        </span>
                      </div>
                      <p class="text-xs text-zinc-300">Empresa: <strong class="text-white">{{ lic.companyName }}</strong></p>
                      <div class="flex flex-wrap items-center gap-4 text-[11px] text-zinc-400 font-mono">
                        <span>Emitida em: {{ formatDate(lic.issuedAt) }}</span>
                        <span>•</span>
                        <span>Expira em: <strong class="text-zinc-200">{{ formatDate(lic.expiresAt) }}</strong></span>
                        <span>•</span>
                        <span>Terminais ativos: <strong class="text-indigo-400">{{ lic.activeDevicesCount }}/{{ lic.maxDevices }}</strong></span>
                      </div>
                    </div>

                    <div class="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        (click)="central.renewLicense(lic.id, 365)"
                        class="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold cursor-pointer transition-colors"
                      >
                        +1 Ano
                      </button>
                      <button
                        type="button"
                        (click)="central.setLicenseStatus(lic.id, lic.status === 'ATIVA' ? 'BLOQUEADA' : 'ATIVA')"
                        class="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                        [class]="lic.status === 'ATIVA' ? 'bg-rose-950 text-rose-300 hover:bg-rose-900 border border-rose-800' : 'bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-800'"
                      >
                        {{ lic.status === 'ATIVA' ? 'Bloquear Licença' : 'Desbloquear' }}
                      </button>
                    </div>
                  </div>
                } @empty {
                  <div class="p-8 text-center text-zinc-500 text-xs bg-zinc-900 border border-zinc-800 rounded-3xl">
                    Nenhuma licença emitida ainda.
                  </div>
                }
              </div>
            </div>
          }

          <!-- TAB 5: DISPOSITIVOS & PAREAMENTO -->
          @if (activeTab() === 'dispositivos') {
            <div class="max-w-6xl mx-auto space-y-6">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-xl font-bold text-white">Dispositivos & Terminais Autorizados</h2>
                  <p class="text-xs text-zinc-400">Nenhum terminal roda o 3eatcru OS sem estar pareado e autorizado pela Central.</p>
                </div>
                <button
                  type="button"
                  (click)="openDeviceModal()"
                  class="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  <mat-icon class="text-sm">add_to_queue</mat-icon>
                  <span>Gerar Código de Pareamento</span>
                </button>
              </div>

              <!-- Devices Table -->
              <div class="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-xs text-zinc-300">
                    <thead class="bg-zinc-950 text-zinc-400 uppercase font-mono text-[10px] border-b border-zinc-800">
                      <tr>
                        <th class="p-4">Terminal / Máquina</th>
                        <th class="p-4">Empresa</th>
                        <th class="p-4">Tipo</th>
                        <th class="p-4">Hardware / Pairing</th>
                        <th class="p-4 text-center">Status</th>
                        <th class="p-4 text-right">Ação Remota</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-zinc-800">
                      @for (dev of central.devices(); track dev.id) {
                        <tr class="hover:bg-zinc-800/40 transition-colors">
                          <td class="p-4 font-bold text-white flex items-center gap-2">
                            <mat-icon class="text-base" [class]="dev.isOnline ? 'text-emerald-400' : 'text-zinc-500'">
                              {{ dev.deviceType === 'PDV' ? 'point_of_sale' : dev.deviceType === 'GARCOM_MOBILE' ? 'smartphone' : 'desktop_windows' }}
                            </mat-icon>
                            <span>{{ dev.deviceName }}</span>
                          </td>
                          <td class="p-4 text-zinc-300">{{ dev.companyName }}</td>
                          <td class="p-4 font-mono text-[11px] text-zinc-400">{{ dev.deviceType }}</td>
                          <td class="p-4 font-mono text-zinc-400">
                            @if (dev.pairingStatus === 'PENDENTE') {
                              <span class="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                                Código: {{ dev.pairingCode }}
                              </span>
                            } @else {
                              <span class="text-[10px] text-zinc-500">{{ dev.hardwareFingerprint }}</span>
                            }
                          </td>
                          <td class="p-4 text-center">
                            <span
                              class="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono"
                              [class]="dev.pairingStatus === 'PAREADO' ? (dev.isOnline ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20' : 'bg-zinc-800 text-zinc-400') : dev.pairingStatus === 'PENDENTE' ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' : 'bg-rose-400/10 text-rose-400 border border-rose-400/20'"
                            >
                              {{ dev.pairingStatus === 'PAREADO' ? (dev.isOnline ? 'ONLINE' : 'OFFLINE') : dev.pairingStatus }}
                            </span>
                          </td>
                          <td class="p-4 text-right">
                            @if (dev.pairingStatus === 'PAREADO') {
                              <button
                                type="button"
                                (click)="central.revokeDevice(dev.id)"
                                class="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-semibold cursor-pointer"
                              >
                                Revogar Acesso
                              </button>
                            } @else if (dev.pairingStatus === 'PENDENTE') {
                              <span class="text-[10px] text-amber-400 font-mono">Aguardando OS...</span>
                            } @else {
                              <span class="text-[10px] text-rose-400 font-mono">Revogado</span>
                            }
                          </td>
                        </tr>
                      } @empty {
                        <tr>
                          <td colspan="6" class="p-8 text-center text-zinc-500 text-xs">
                            Nenhum dispositivo cadastrado. Clique em "Gerar Código de Pareamento".
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          }

          <!-- TAB 6: PLANOS -->
          @if (activeTab() === 'planos') {
            <div class="max-w-6xl mx-auto space-y-6">
              <div>
                <h2 class="text-xl font-bold text-white">Planos da Plataforma 3eatcru</h2>
                <p class="text-xs text-zinc-400">Definição dos tiers de assinatura, limites de terminais e módulos habilitados no 3eatcru OS.</p>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                @for (p of central.plans(); track p.id) {
                  <div
                    class="p-6 rounded-3xl bg-zinc-900 border space-y-4 relative flex flex-col justify-between"
                    [class]="p.code === 'ENTERPRISE' ? 'border-amber-500/50 shadow-lg shadow-amber-500/5' : 'border-zinc-800'"
                  >
                    @if (p.code === 'ENTERPRISE') {
                      <div class="absolute -top-3 right-6 px-2.5 py-0.5 bg-amber-400 text-zinc-950 font-bold text-[10px] rounded-full uppercase tracking-wider font-mono">
                        Mais Completo
                      </div>
                    }

                    <div class="space-y-2">
                      <div class="flex items-center justify-between">
                        <h3 class="text-lg font-black text-white">{{ p.name }}</h3>
                        <span class="font-mono text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold">{{ p.code }}</span>
                      </div>
                      <div class="pt-2">
                        <span class="text-2xl font-black font-mono text-white">R$ {{ p.priceMonthly.toFixed(2) }}</span>
                        <span class="text-xs text-zinc-500"> /mês</span>
                      </div>

                      <div class="pt-3 border-t border-zinc-800 space-y-2 text-xs">
                        <div class="flex items-center gap-2 text-zinc-300">
                          <mat-icon class="text-emerald-400 text-base">check_circle</mat-icon>
                          <span>Até <strong>{{ p.maxTerminals }}</strong> Terminais PDV simultâneos</span>
                        </div>
                        <div class="flex items-center gap-2 text-zinc-300">
                          <mat-icon class="text-emerald-400 text-base">check_circle</mat-icon>
                          <span>Até <strong>{{ p.maxUsers }}</strong> Operadores cadastrados</span>
                        </div>
                        @for (feat of p.features; track feat) {
                          <div class="flex items-center gap-2 text-zinc-400 text-[11px]">
                            <mat-icon class="text-indigo-400 text-base">done</mat-icon>
                            <span>{{ feat }}</span>
                          </div>
                        }
                      </div>
                    </div>

                    <div class="pt-4 border-t border-zinc-800 text-[10px] font-mono text-zinc-500">
                      {{ p.allowedModules.length }} módulos liberados no OS
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <!-- TAB 7: AUDITORIA -->
          @if (activeTab() === 'auditoria') {
            <div class="max-w-6xl mx-auto space-y-6">
              <div>
                <h2 class="text-xl font-bold text-white">Trilha de Auditoria Central da Plataforma</h2>
                <p class="text-xs text-zinc-400">Registro cronológico imutável de emissão de licenças, ativação de máquinas e governança.</p>
              </div>

              <div class="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-xs text-zinc-300">
                    <thead class="bg-zinc-950 text-zinc-400 uppercase font-mono text-[10px] border-b border-zinc-800">
                      <tr>
                        <th class="p-4">Data/Hora</th>
                        <th class="p-4">Ação</th>
                        <th class="p-4">Recurso</th>
                        <th class="p-4">Ator / Papel</th>
                        <th class="p-4">IP / Origem</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-zinc-800">
                      @for (log of central.auditLogs(); track log.id) {
                        <tr class="hover:bg-zinc-800/40 transition-colors">
                          <td class="p-4 font-mono text-zinc-400 text-[11px] whitespace-nowrap">{{ formatFullDate(log.timestamp) }}</td>
                          <td class="p-4 font-medium text-white">{{ log.action }}</td>
                          <td class="p-4 font-mono text-zinc-400">{{ log.resource }}</td>
                          <td class="p-4 text-zinc-300">{{ log.actor }}</td>
                          <td class="p-4 font-mono text-zinc-500 text-[10px]">{{ log.ip }}</td>
                        </tr>
                      } @empty {
                        <tr>
                          <td colspan="5" class="p-8 text-center text-zinc-500 text-xs">
                            Nenhum log registrado.
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          }

          <!-- TAB 8: VERSÕES & RELEASES -->
          @if (activeTab() === 'versoes') {
            <div class="max-w-6xl mx-auto space-y-6">
              <div>
                <h2 class="text-xl font-bold text-white">Controle de Versões & Releases do 3eatcru OS</h2>
                <p class="text-xs text-zinc-400">Gerenciamento de versões suportadas pelo motor de compatibilidade.</p>
              </div>

              <div class="space-y-4">
                @for (v of central.versions(); track v.version) {
                  <div class="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-3">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <span class="text-lg font-black font-mono text-white">{{ v.version }}</span>
                        <span class="px-2 py-0.5 rounded bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 text-[10px] font-bold uppercase font-mono">
                          Canal {{ v.channel }}
                        </span>
                      </div>
                      <span class="text-xs font-mono text-zinc-500">{{ formatDate(v.releaseDate) }}</span>
                    </div>

                    <div class="space-y-1 text-xs text-zinc-300">
                      <p class="font-bold text-zinc-400 text-[10px] uppercase font-mono">Notas de Atualização (Changelog):</p>
                      <ul class="list-disc list-inside space-y-1 text-zinc-400 pl-2">
                        @for (item of v.changelog; track item) {
                          <li>{{ item }}</li>
                        }
                      </ul>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

        </main>
      </div>

      <!-- MODAL 1: CRIAR CONTA PROPRIETÁRIO -->
      @if (showAccountModal()) {
        <div class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div class="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4 text-white">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold flex items-center gap-2">
                <mat-icon class="text-indigo-400">person_add</mat-icon>
                Nova Conta de Proprietário
              </h3>
              <button (click)="showAccountModal.set(false)" class="text-zinc-500 hover:text-white cursor-pointer">✕</button>
            </div>

            <div class="space-y-3 text-xs">
              <div class="space-y-1">
                <label class="font-semibold text-zinc-300">Nome Completo *</label>
                <input
                  type="text"
                  [value]="newAccountName()"
                  (input)="newAccountName.set($any($event.target).value)"
                  placeholder="Ex: Marcelo Silva"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div class="space-y-1">
                <label class="font-semibold text-zinc-300">E-mail Principal (Firebase Auth) *</label>
                <input
                  type="email"
                  [value]="newAccountEmail()"
                  (input)="newAccountEmail.set($any($event.target).value)"
                  placeholder="marcelo@exemplo.com"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div class="space-y-1">
                <label class="font-semibold text-zinc-300">Telefone / WhatsApp</label>
                <input
                  type="text"
                  [value]="newAccountPhone()"
                  (input)="newAccountPhone.set($any($event.target).value)"
                  placeholder="(11) 98765-4321"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                (click)="showAccountModal.set(false)"
                class="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="saveAccount()"
                class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
              >
                Salvar Conta
              </button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL 2: CRIAR EMPRESA -->
      @if (showCompanyModal()) {
        <div class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div class="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4 text-white">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold flex items-center gap-2">
                <mat-icon class="text-amber-400">add_business</mat-icon>
                Nova Empresa & Emissão de Licença
              </h3>
              <button (click)="showCompanyModal.set(false)" class="text-zinc-500 hover:text-white cursor-pointer">✕</button>
            </div>

            <div class="space-y-3 text-xs">
              <div class="space-y-1">
                <label class="font-semibold text-zinc-300">Vincular a Qual Conta de Proprietário? *</label>
                <select
                  [value]="selectedAccountId()"
                  (change)="selectedAccountId.set($any($event.target).value)"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                >
                  @for (acc of central.accounts(); track acc.id) {
                    <option [value]="acc.id">{{ acc.name }} ({{ acc.email }})</option>
                  }
                </select>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1">
                  <label class="font-semibold text-zinc-300">Nome Fantasia *</label>
                  <input
                    type="text"
                    [value]="newCompanyTrading()"
                    (input)="newCompanyTrading.set($any($event.target).value)"
                    placeholder="Ex: Bar do Marcelo"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div class="space-y-1">
                  <label class="font-semibold text-zinc-300">Razão Social *</label>
                  <input
                    type="text"
                    [value]="newCompanyName()"
                    (input)="newCompanyName.set($any($event.target).value)"
                    placeholder="Ex: Marcelo Comércio Ltda"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1">
                  <label class="font-semibold text-zinc-300">CNPJ</label>
                  <input
                    type="text"
                    [value]="newCompanyCnpj()"
                    (input)="newCompanyCnpj.set($any($event.target).value)"
                    placeholder="00.000.000/0001-00"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div class="space-y-1">
                  <label class="font-semibold text-zinc-300">Plano Escolhido *</label>
                  <select
                    [value]="selectedPlanId()"
                    (change)="selectedPlanId.set($any($event.target).value)"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                  >
                    @for (p of central.plans(); track p.id) {
                      <option [value]="p.id">{{ p.name }} (R$ {{ p.priceMonthly.toFixed(2) }}/mês - {{ p.maxTerminals }} PDVs)</option>
                    }
                  </select>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                (click)="showCompanyModal.set(false)"
                class="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="saveCompany()"
                class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold cursor-pointer"
              >
                Criar Empresa & Gerar Licença
              </button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL 3: GERAR CÓDIGO DE PAREAMENTO (DEVICE) -->
      @if (showDeviceModal()) {
        <div class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div class="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4 text-white">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold flex items-center gap-2">
                <mat-icon class="text-emerald-400">devices</mat-icon>
                Pareamento de Terminal PDV
              </h3>
              <button (click)="showDeviceModal.set(false)" class="text-zinc-500 hover:text-white cursor-pointer">✕</button>
            </div>

            @if (deviceError()) {
              <div class="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                <mat-icon class="text-sm">error_outline</mat-icon>
                <span>{{ deviceError() }}</span>
              </div>
            }

            @if (generatedPairingCode()) {
              <div class="p-6 bg-zinc-950 rounded-2xl border border-emerald-500/30 text-center space-y-3">
                <span class="text-xs text-zinc-400">Digite este código de 6 dígitos no 3eatcru OS:</span>
                <div class="text-3xl font-black font-mono tracking-widest text-emerald-400 select-all">
                  {{ generatedPairingCode() }}
                </div>
                <p class="text-[11px] text-zinc-500">O terminal receberá a licença e será autorizado imediatamente.</p>
              </div>

              <div class="flex justify-center">
                <button
                  type="button"
                  (click)="showDeviceModal.set(false); generatedPairingCode.set('')"
                  class="px-6 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold cursor-pointer"
                >
                  Concluir
                </button>
              </div>
            } @else {
              <div class="space-y-3 text-xs">
                <div class="space-y-1">
                  <label class="font-semibold text-zinc-300">Selecione a Empresa *</label>
                  <select
                    [value]="deviceCompanyId()"
                    (change)="deviceCompanyId.set($any($event.target).value)"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                  >
                    @for (comp of central.companies(); track comp.id) {
                      <option [value]="comp.id">{{ comp.tradingName }} ({{ comp.planName }})</option>
                    }
                  </select>
                </div>

                <div class="space-y-1">
                  <label class="font-semibold text-zinc-300">Identificação do Terminal *</label>
                  <input
                    type="text"
                    [value]="newDeviceName()"
                    (input)="newDeviceName.set($any($event.target).value)"
                    placeholder="Ex: Caixa Balcão #01"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div class="space-y-1">
                  <label class="font-semibold text-zinc-300">Tipo de Dispositivo</label>
                  <select
                    [value]="newDeviceType()"
                    (change)="newDeviceType.set($any($event.target).value)"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                  >
                    <option value="PDV">PDV (Frente de Caixa)</option>
                    <option value="CAIXA">Caixa Administrativo</option>
                    <option value="GERENCIA">Gerência / Backoffice</option>
                    <option value="GARCOM_MOBILE">Garçom Mobile (Comanda)</option>
                    <option value="KDS_COZINHA">KDS (Monitor de Cozinha)</option>
                  </select>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  (click)="showDeviceModal.set(false)"
                  class="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  (click)="saveDevicePairing()"
                  class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  Gerar Código
                </button>
              </div>
            }
          </div>
        </div>
      }

      }

    </div>
  `
})
export class CentralComponent implements OnInit {
  central = inject(CentralPlatformService);

  isAuthorized = computed(() => this.central.isAuthenticated());
  adminUsername = signal('');
  adminPassword = signal('');
  loginError = signal('');

  async tryLogin() {
    this.loginError.set('');
    const success = await this.central.login(this.adminUsername(), this.adminPassword());
    if (success) {
      this.central.logCentralAudit('Superadmin authenticated and opened Central platform', 'CentralAccess', 'system');
    } else {
      this.loginError.set('Credenciais de Administrador da Central incorretas.');
    }
  }

  activeTab = signal<'dashboard' | 'contas' | 'empresas' | 'licencas' | 'dispositivos' | 'planos' | 'auditoria' | 'versoes'>('dashboard');

  // Outputs / Events
  openTerminal = output<void>();

  // Modals state
  showAccountModal = signal(false);
  newAccountName = signal('');
  newAccountEmail = signal('');
  newAccountPhone = signal('');

  showCompanyModal = signal(false);
  selectedAccountId = signal('');
  newCompanyName = signal('');
  newCompanyTrading = signal('');
  newCompanyCnpj = signal('');
  selectedPlanId = signal('plan_pro');

  showDeviceModal = signal(false);
  deviceCompanyId = signal('');
  newDeviceName = signal('Terminal PDV #01');
  newDeviceType = signal<'PDV' | 'CAIXA' | 'GERENCIA' | 'GARCOM_MOBILE' | 'KDS_COZINHA'>('PDV');
  generatedPairingCode = signal<string>('');
  deviceError = signal('');

  ngOnInit() {
    // If no account exists yet, let's keep it ready or pre-select if any
    if (this.central.accounts().length > 0) {
      this.selectedAccountId.set(this.central.accounts()[0].id);
    }
    if (this.central.companies().length > 0) {
      this.deviceCompanyId.set(this.central.companies()[0].id);
    }
  }

  openAccountModal() {
    this.newAccountName.set('');
    this.newAccountEmail.set('');
    this.newAccountPhone.set('');
    this.showAccountModal.set(true);
  }

  saveAccount() {
    const name = this.newAccountName();
    const email = this.newAccountEmail();
    const phone = this.newAccountPhone();
    if (!name || !email) return;
    this.central.createAccount(name, email, phone).then(acc => {
      this.selectedAccountId.set(acc.id);
      this.showAccountModal.set(false);
    });
  }

  openCompanyModal() {
    if (this.central.accounts().length === 0) {
      // Auto open account modal first if none
      this.openAccountModal();
      return;
    }
    this.newCompanyName.set('');
    this.newCompanyTrading.set('');
    this.newCompanyCnpj.set('');
    this.showCompanyModal.set(true);
  }

  saveCompany() {
    const trading = this.newCompanyTrading();
    const accountId = this.selectedAccountId();
    if (!trading || !accountId) return;
    const account = this.central.accounts().find(a => a.id === accountId);
    if (!account) return;

    this.central.createCompany({
      accountId: account.id,
      ownerName: account.name,
      name: this.newCompanyName() || trading,
      tradingName: trading,
      cnpj: this.newCompanyCnpj(),
      phone: account.phone,
      city: 'São Paulo',
      state: 'SP',
      planId: this.selectedPlanId()
    }).then(res => {
      this.deviceCompanyId.set(res.company.id);
      this.showCompanyModal.set(false);
    });
  }

  openDeviceModal() {
    if (this.central.companies().length === 0) {
      this.openCompanyModal();
      return;
    }
    this.generatedPairingCode.set('');
    this.deviceError.set('');
    this.showDeviceModal.set(true);
  }

  generatePairingForCompany(companyId: string) {
    this.deviceCompanyId.set(companyId);
    this.openDeviceModal();
  }

  saveDevicePairing() {
    const compId = this.deviceCompanyId();
    if (!compId) return;
    this.deviceError.set('');
    this.central.generateDevicePairingCode(
      compId,
      this.newDeviceName(),
      this.newDeviceType()
    ).then(dev => {
      this.generatedPairingCode.set(dev.pairingCode || '');
    }).catch((err: any) => {
      this.deviceError.set(err.message || 'Erro ao gerar código de pareamento');
    });
  }

  formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString('pt-BR');
  }

  formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  formatFullDate(ts: number): string {
    return new Date(ts).toLocaleString('pt-BR');
  }
}

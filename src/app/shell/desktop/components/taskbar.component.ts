import { Component, ChangeDetectionStrategy, inject, signal, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { WindowManagerService } from '../../../core/window-manager.service';
import { AppContextService } from '../../../core/services/app-context.service';
import { SyncOutboxService } from '../../../core/sync/sync-outbox.service';

@Component({
  selector: 'app-taskbar',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-16 bg-white border-t border-zinc-200 flex items-center px-4 z-50 shadow-sm select-none">
      <!-- Start / Brand Button -->
      <button class="w-12 h-10 mx-1 rounded-xl bg-indigo-600 flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all shadow-sm cursor-pointer">
        <mat-icon class="text-white">apps</mat-icon>
      </button>

      <!-- Active Company / Location Indicator -->
      <div class="hidden md:flex flex-col justify-center px-3 py-1 bg-zinc-50 border border-zinc-200 rounded-xl mx-2">
        <span class="text-[11px] font-bold text-zinc-900 leading-none truncate max-w-[140px]">{{ context.company()?.tradingName || '3eatcru OS' }}</span>
        <span class="text-[9px] text-zinc-500 font-medium leading-none mt-0.5">{{ context.location()?.name || 'Matriz' }}</span>
      </div>

      <div class="hidden sm:block w-px h-6 bg-zinc-200 mx-2"></div>

      <!-- Open Apps Dock -->
      <div class="flex-1 flex items-center gap-2 overflow-x-auto overflow-y-hidden px-2 hide-scrollbar">
        @for (win of wm.windows(); track win.id) {
          <button (click)="wm.focus(win.id); wm.toggleMinimize(win.id)"
                  class="flex items-center gap-2 px-3 h-10 rounded-xl transition-all border max-w-[160px] cursor-pointer"
                  [class.bg-zinc-100]="wm.activeWindowId() === win.id && !win.minimized"
                  [class.border-zinc-200]="wm.activeWindowId() === win.id && !win.minimized"
                  [class.bg-white]="wm.activeWindowId() !== win.id || win.minimized"
                  [class.border-transparent]="wm.activeWindowId() !== win.id || win.minimized"
                  [class.hover:bg-zinc-50]="true">
            <mat-icon class="text-indigo-600 scale-75 shrink-0">{{ win.icon }}</mat-icon>
            <span class="text-xs font-semibold truncate text-zinc-700">{{ win.title }}</span>
            @if (wm.activeWindowId() === win.id && !win.minimized) {
              <div class="w-1.5 h-1.5 rounded-full bg-indigo-500 ml-auto flex-shrink-0"></div>
            }
          </button>
        }
      </div>

      <!-- System Tray / Telemetry -->
      <div class="flex items-center gap-1.5 px-2 text-zinc-500">
        
        <!-- Outbox Sync Status Badge -->
        <button
          type="button"
          (click)="sync.syncNow()"
          [title]="sync.lastSyncResult()"
          class="h-10 px-2.5 rounded-xl hover:bg-zinc-100 hidden sm:flex items-center gap-1.5 transition-colors border border-transparent hover:border-zinc-200 cursor-pointer"
        >
          <mat-icon class="scale-75" [class.text-emerald-500]="sync.pendingCount() === 0" [class.text-amber-500]="sync.pendingCount() > 0">
            {{ sync.pendingCount() > 0 ? 'cloud_upload' : 'cloud_done' }}
          </mat-icon>
          <span class="text-[10px] font-mono font-bold" [class.text-amber-600]="sync.pendingCount() > 0" [class.text-zinc-600]="sync.pendingCount() === 0">
            {{ sync.pendingCount() > 0 ? sync.pendingCount() + ' pend.' : '100% Local' }}
          </span>
        </button>

        <!-- Current Operator & Lock Button -->
        <button
          type="button"
          (click)="context.lockSession()"
          title="Bloquear / Trocar de Usuário"
          class="h-10 px-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 flex items-center gap-2 transition-colors cursor-pointer text-zinc-700"
        >
          <div class="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
            {{ getInitials(context.operatorName()) }}
          </div>
          <span class="text-xs font-semibold max-w-[90px] truncate hidden md:inline">{{ context.operatorName() }}</span>
          <mat-icon class="text-zinc-400 text-sm">lock</mat-icon>
        </button>

        <!-- Date / Time -->
        <div class="h-10 px-2.5 rounded-xl flex flex-col items-center justify-center">
          <span class="text-[11px] font-bold text-zinc-900 leading-none mb-0.5">{{ time() }}</span>
          <span class="text-[9px] text-zinc-500 leading-none">{{ date() }}</span>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .hide-scrollbar::-webkit-scrollbar { display: none; }
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `]
})
export class TaskbarComponent implements OnInit, OnDestroy {
  wm = inject(WindowManagerService);
  context = inject(AppContextService);
  sync = inject(SyncOutboxService);
  
  time = signal('');
  date = signal('');
  private interval: any;

  ngOnInit() {
    this.updateTime();
    this.interval = setInterval(() => this.updateTime(), 1000);
  }

  ngOnDestroy() {
    clearInterval(this.interval);
  }

  getInitials(name: string): string {
    if (!name) return 'OP';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  private updateTime() {
    const now = new Date();
    this.time.set(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    this.date.set(now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }));
  }
}

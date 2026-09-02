import { Component, ChangeDetectionStrategy, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { WindowManagerService } from '../../../core/window-manager.service';

@Component({
  selector: 'app-window-container',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (win of wm.windows(); track win.id) {
      <div 
        class="absolute rounded-3xl overflow-hidden flex flex-col border border-zinc-200 transition-all duration-200 bg-white"
        [class.opacity-0]="win.minimized"
        [class.scale-95]="win.minimized"
        [class.pointer-events-none]="win.minimized"
        [class.shadow-xl]="wm.activeWindowId() === win.id"
        [class.shadow-sm]="wm.activeWindowId() !== win.id"
        [style.z-index]="win.zIndex"
        [style.left.px]="win.maximized ? 0 : win.x"
        [style.top.px]="win.maximized ? 0 : win.y"
        [style.width]="win.maximized ? '100%' : win.width + 'px'"
        [style.height]="win.maximized ? '100%' : win.height + 'px'"
        (mousedown)="wm.focus(win.id); $event.stopPropagation()">
        
        <!-- Window Title Bar -->
        <div 
          class="h-14 bg-zinc-50 border-b border-zinc-100 flex items-center px-4 cursor-move select-none"
          (mousedown)="startDrag($event, win.id)"
          (dblclick)="wm.toggleMaximize(win.id)">
          <mat-icon class="text-indigo-600 scale-75 mr-2">{{ win.icon }}</mat-icon>
          <span class="font-bold text-sm flex-1 truncate text-zinc-800">{{ win.title }}</span>
          
          <div class="flex items-center gap-2" (mousedown)="$event.stopPropagation()">
            <button (click)="wm.toggleMinimize(win.id)" class="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-500 transition-colors shadow-sm">
              <mat-icon class="scale-75">remove</mat-icon>
            </button>
            <button (click)="wm.toggleMaximize(win.id)" class="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-500 transition-colors shadow-sm">
              <mat-icon class="scale-75">{{ win.maximized ? 'fullscreen_exit' : 'crop_square' }}</mat-icon>
            </button>
            <button (click)="wm.closeApp(win.id)" class="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-600 transition-colors shadow-sm">
              <mat-icon class="scale-75">close</mat-icon>
            </button>
          </div>
        </div>
        
        <!-- Window Content -->
        <div class="flex-1 overflow-hidden relative">
          @if (win.component) {
            <ng-container *ngComponentOutlet="win.component"></ng-container>
          } @else {
            <div class="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 bg-white">
              <mat-icon class="text-6xl mb-4 opacity-50">{{ win.icon }}</mat-icon>
              <p class="text-lg font-bold">Módulo {{ win.title }}</p>
              <p class="text-sm mt-2 text-zinc-500">Nenhuma interface foi conectada a este módulo.</p>
            </div>
          }
        </div>
      </div>
    }
  `
})
export class WindowContainerComponent {
  wm = inject(WindowManagerService);
  
  draggingId: string | null = null;
  dragStartX = 0;
  dragStartY = 0;
  initialX = 0;
  initialY = 0;

  startDrag(event: MouseEvent, id: string) {
    const win = this.wm.windows().find(w => w.id === id);
    if (!win || win.maximized) return;
    
    this.draggingId = id;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.initialX = win.x;
    this.initialY = win.y;
  }

  @HostListener('document:mousemove', ['$event'])
  onDrag(event: MouseEvent) {
    if (!this.draggingId) return;
    
    const dx = event.clientX - this.dragStartX;
    const dy = event.clientY - this.dragStartY;
    
    this.wm.windows.update(ws => ws.map(w => {
      if (w.id === this.draggingId) {
        // Prevent dragging outside top boundary
        const newY = Math.max(0, this.initialY + dy);
        return { ...w, x: this.initialX + dx, y: newY };
      }
      return w;
    }));
  }

  @HostListener('document:mouseup')
  stopDrag() {
    this.draggingId = null;
  }
}

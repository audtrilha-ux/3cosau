import { Injectable, signal, Type, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { IdGeneratorService } from './services/id-generator.service';

export interface WindowInstance {
  id: string;
  appId: string;
  title: string;
  icon: string;
  component: Type<any> | null;
  minimized: boolean;
  maximized: boolean;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

@Injectable({ providedIn: 'root' })
export class WindowManagerService {
  private idGen = inject(IdGeneratorService);
  private platformId = inject(PLATFORM_ID);
  windows = signal<WindowInstance[]>([]);
  activeWindowId = signal<string | null>(null);
  private nextZIndex = 10;

  openApp(appId: string, title: string, icon: string, component: Type<any> | null = null) {
    const existing = this.windows().find(w => w.appId === appId);
    if (existing) {
      this.focus(existing.id);
      if (existing.minimized) this.toggleMinimize(existing.id);
      return;
    }

    const isBrowser = isPlatformBrowser(this.platformId);
    const winWidth = isBrowser && typeof window !== 'undefined' ? Math.min(1080, Math.max(380, window.innerWidth - 80)) : 880;
    const winHeight = isBrowser && typeof window !== 'undefined' ? Math.min(780, Math.max(480, window.innerHeight - 140)) : 640;

    const newWindow: WindowInstance = {
      id: this.idGen.generatePrefixedId('win'),
      appId,
      title,
      icon,
      component,
      minimized: false,
      maximized: false,
      zIndex: this.nextZIndex++,
      x: 40 + (this.windows().length * 24),
      y: 40 + (this.windows().length * 24),
      width: winWidth,
      height: winHeight,
    };

    this.windows.update(ws => [...ws, newWindow]);
    this.activeWindowId.set(newWindow.id);
  }

  closeApp(id: string) {
    this.windows.update(ws => ws.filter(w => w.id !== id));
    if (this.activeWindowId() === id) {
      const remaining = this.windows();
      this.activeWindowId.set(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
    }
  }

  focus(id: string) {
    this.windows.update(ws => ws.map(w => w.id === id ? { ...w, zIndex: this.nextZIndex++ } : w));
    this.activeWindowId.set(id);
  }

  toggleMinimize(id: string) {
    this.windows.update(ws => ws.map(w => {
      if (w.id === id) {
        const minimized = !w.minimized;
        if (!minimized) {
          this.activeWindowId.set(id);
          return { ...w, minimized, zIndex: this.nextZIndex++ };
        }
        return { ...w, minimized };
      }
      return w;
    }));
    
    // Update active window if we minimized the current one
    const active = this.activeWindowId();
    const win = this.windows().find(w => w.id === id);
    if (win?.minimized && active === id) {
      const visible = this.windows().filter(w => !w.minimized).sort((a, b) => b.zIndex - a.zIndex);
      this.activeWindowId.set(visible.length > 0 ? visible[0].id : null);
    }
  }

  toggleMaximize(id: string) {
    this.windows.update(ws => ws.map(w => w.id === id ? { ...w, maximized: !w.maximized } : w));
    this.focus(id);
  }
}

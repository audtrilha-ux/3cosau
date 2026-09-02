import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class PwaService {
  private platformId = inject(PLATFORM_ID);
  deferredPrompt = signal<any>(null);
  isInstalled = signal<boolean>(false);
  isIOS = signal<boolean>(false);

  init() {
    if (!isPlatformBrowser(this.platformId)) return;

    // Detect standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    this.isInstalled.set(isStandalone);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    this.isIOS.set(isIOSDevice);

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt.set(e);
    });

    window.addEventListener('appinstalled', () => {
      this.isInstalled.set(true);
      this.deferredPrompt.set(null);
    });
  }

  async install() {
    const prompt = this.deferredPrompt();
    if (!prompt) return false;
    
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    
    if (outcome === 'accepted') {
      this.isInstalled.set(true);
      this.deferredPrompt.set(null);
      return true;
    }
    return false;
  }
}

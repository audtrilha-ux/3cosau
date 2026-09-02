import { Injectable, Type, signal } from '@angular/core';

export interface AppManifest {
  id: string;
  name: string;
  category: string;
  icon: string;
  iconColor: string;
  loadComponent?: () => Promise<Type<any>>;
  component?: Type<any>;
  badge?: string;
  shortcut?: string;
  permissions?: string[];
  version?: string;
}

/**
 * 3eatcru OS AppRegistry
 * Gerenciador desacoplado de registro de aplicativos (Core Platform).
 * Não conhece módulos de negócio; aplicações registram seus manifestos dinamicamente.
 */
@Injectable({ providedIn: 'root' })
export class AppRegistry {
  private readonly _apps = signal<AppManifest[]>([]);
  readonly apps = this._apps.asReadonly();

  registerApp(manifest: AppManifest): void {
    const current = this._apps();
    const index = current.findIndex(a => a.id === manifest.id);
    if (index >= 0) {
      const updated = [...current];
      updated[index] = manifest;
      this._apps.set(updated);
    } else {
      this._apps.set([...current, manifest]);
    }
  }

  registerApps(manifests: AppManifest[]): void {
    manifests.forEach(m => this.registerApp(m));
  }

  unregisterApp(id: string): void {
    this._apps.set(this._apps().filter(a => a.id !== id));
  }

  getApps(): AppManifest[] {
    return this._apps();
  }

  getApp(id: string): AppManifest | undefined {
    return this._apps().find(a => a.id === id);
  }
}


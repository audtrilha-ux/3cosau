import { Injectable, inject, Type } from '@angular/core';
import { OSContext, DatabaseAPI, SyncAPI, WindowAPI, EventAPI, PermissionAPI, Repository, DomainEvent } from '../contracts/os-context';
import { DexieDatabaseAdapter } from '../storage/dexie.adapter';
import { SyncOutboxService } from '../sync/sync-outbox.service';
import { WindowManagerService } from '../window-manager.service';
import { AppContextService } from './app-context.service';
import { AppRegistry } from './app-registry';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OSContextImpl implements OSContext {
  readonly database = inject(DexieDatabaseAdapter);
  readonly sync = inject(SyncOutboxService);
  private readonly wm = inject(WindowManagerService);
  private readonly ctx = inject(AppContextService);
  private readonly registry = inject(AppRegistry);

  // Event bus storage using RxJS Subjects per topic
  private readonly channels = new Map<string, Subject<any>>();

  getRepository<T>(store: string): Repository<T> {
    return this.database.getRepository<T>(store);
  }

  readonly windows: WindowAPI = {
    open: (appId: string, title: string, icon: string) => {
      const app = this.registry.getApp(appId);
      if (app) {
        if (app.loadComponent) {
          app.loadComponent().then((compClass: Type<any>) => {
            this.wm.openApp(appId, title, icon, compClass);
          }).catch(err => {
            console.error(`[OSContext] Error loading component dynamically for app ${appId}:`, err);
            this.wm.openApp(appId, title, icon, null);
          });
        } else {
          this.wm.openApp(appId, title, icon, app.component || null);
        }
      } else {
        this.wm.openApp(appId, title, icon, null);
      }
    },
    close: (appId: string) => {
      const win = this.wm.windows().find(w => w.appId === appId);
      if (win) {
        this.wm.closeApp(win.id);
      }
    },
    focus: (appId: string) => {
      const win = this.wm.windows().find(w => w.appId === appId);
      if (win) {
        this.wm.focus(win.id);
      }
    }
  };

  readonly events: EventAPI = {
    publish: <T = any>(topic: string, payload: T) => {
      let channel = this.channels.get(topic);
      if (!channel) {
        channel = new Subject<any>();
        this.channels.set(topic, channel);
      }
      channel.next(payload);
    },
    publishDomainEvent: <T = any>(event: DomainEvent<T>) => {
      this.events.publish(event.topic, event);
      this.events.publish(`domain.${event.aggregate.toLowerCase()}.${event.eventType.toLowerCase()}`, event);
    },
    subscribe: <T = any>(topic: string, callback: (payload: T) => void) => {
      let channel = this.channels.get(topic);
      if (!channel) {
        channel = new Subject<any>();
        this.channels.set(topic, channel);
      }
      const subscription = channel.subscribe(callback);
      return () => subscription.unsubscribe();
    }
  };

  readonly permissions: PermissionAPI = {
    hasCapability: (capability: string) => {
      const role = this.ctx.operatorRole();
      if (!role) return false;
      // High-privilege server-side capabilities require at least MANAGER or OWNER role
      if (capability === 'MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API') {
        return role === 'OWNER' || role === 'MANAGER';
      }
      return false;
    },
    canExecute: (action: string, resource: string) => {
      const role = this.ctx.operatorRole();
      if (!role) return false;
      if (role === 'OWNER' || role === 'MANAGER') return true;
      if (role === 'CASHIER') {
        const allowed = ['vendas', 'caixa', 'mesas', 'delivery', 'clientes'];
        const allowedActions = [
          'READ', 'CREATE', 'UPDATE', 'PROCESS_SALE', 
          'OPEN_CASH', 'CLOSE_CASH', 'CASH_OPEN', 'CASH_CLOSE', 
          'SUPRIMENTO', 'SANGRIA', 'CASH_MOVEMENT', 'CASH_WITHDRAW', 
          'RECEIVE_DEBT', 'RECEBIMENTO_FIADO'
        ];
        return allowed.includes(resource) && allowedActions.includes(action);
      }
      if (role === 'WAITER') {
        const allowed = ['vendas', 'mesas', 'cardapio', 'delivery'];
        return allowed.includes(resource) && ['READ', 'CREATE', 'UPDATE', 'ADD_ITEM'].includes(action);
      }
      if (role === 'STOCK') {
        const allowed = ['estoque', 'compras', 'fornecedores', 'fabricacao'];
        return allowed.includes(resource);
      }
      return false;
    },
    assertPermission: (action: string, resource: string) => {
      if (!this.permissions.canExecute(action, resource)) {
        throw new Error(`Acesso negado: O operador atual não possui permissão para [${action}] no recurso [${resource}].`);
      }
    }
  };
}


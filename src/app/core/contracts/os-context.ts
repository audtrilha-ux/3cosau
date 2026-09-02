import { InjectionToken } from '@angular/core';

export interface Repository<T> {
  findById(id: string | number): Promise<T | null>;
  findAll(): Promise<T[]>;
  findByIndex(index: string, value: any): Promise<T[]>;
  save(entity: T): Promise<void>;
  delete(id: string | number): Promise<void>;
  forTenant(companyId: string): Repository<T>;
}

export interface DomainEvent<T = any> {
  id: string;
  topic: string;
  aggregate: string;
  aggregateId: string;
  eventType: string;
  payload: T;
  actor: string;
  timestamp: number;
}

export interface DatabaseAPI {
  get<T>(store: string, id: string | number): Promise<T | null>;
  getAll<T>(store: string): Promise<T[]>;
  query<T>(store: string, index: string, value: any): Promise<T[]>;
  save<T>(store: string, data: T): Promise<void>;
  delete(store: string, id: string | number): Promise<void>;
  getRepository<T>(store: string): Repository<T>;
  
  /**
   * Generic transaction wrapper.
   * On Web: Maps to IndexedDB/Dexie transaction.
   * On Windows (Tauri/Electron): Maps to SQLite BEGIN/COMMIT/ROLLBACK.
   */
  transaction<T>(stores: string[], mode: 'readonly' | 'readwrite', callback: () => Promise<T>): Promise<T>;
}

export interface SyncAPI {
  /**
   * Queues a local mutation to the outbox for background cloud synchronization.
   */
  enqueue(entityType: string, entityId: string, operation: 'CREATE' | 'UPDATE' | 'DELETE', payload: any): Promise<void>;
  
  /**
   * Forces an immediate sync attempt.
   */
  syncNow(): Promise<any>;
}

export interface WindowAPI {
  open(appId: string, title: string, icon: string): void;
  close(appId: string): void;
  focus(appId: string): void;
}

export interface EventAPI {
  publish<T = any>(topic: string, payload: T): void;
  publishDomainEvent<T = any>(event: DomainEvent<T>): void;
  subscribe<T = any>(topic: string, callback: (payload: T) => void): () => void;
}

export interface PermissionAPI {
  hasCapability(capability: string): boolean;
  canExecute(action: string, resource: string): boolean;
  assertPermission(action: string, resource: string): void;
}

export interface OSContext {
  database: DatabaseAPI;
  sync: SyncAPI;
  windows: WindowAPI;
  events: EventAPI;
  permissions: PermissionAPI;
  getRepository<T>(store: string): Repository<T>;
}

export const OS_CONTEXT = new InjectionToken<OSContext>('OS_CONTEXT');


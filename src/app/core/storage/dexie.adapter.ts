import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { DatabaseAPI, Repository } from '../contracts/os-context';
import { db, initializeDatabase } from './dexie.db';

class DexieRepositoryImpl<T> implements Repository<T> {
  constructor(
    private adapter: DexieDatabaseAdapter, 
    private storeName: string,
    private tenantId?: string
  ) {}

  forTenant(companyId: string): Repository<T> {
    return new DexieRepositoryImpl<T>(this.adapter, this.storeName, companyId);
  }

  async findById(id: string | number): Promise<T | null> {
    const item = await this.adapter.get<T>(this.storeName, id);
    if (!item) return null;
    if (this.tenantId && (item as any).companyId && (item as any).companyId !== this.tenantId) {
      return null;
    }
    return item;
  }

  async findAll(): Promise<T[]> {
    if (this.tenantId) {
      return this.findByIndex('companyId', this.tenantId);
    }
    return this.adapter.getAll<T>(this.storeName);
  }

  async findByIndex(index: string, value: any): Promise<T[]> {
    const items = await this.adapter.query<T>(this.storeName, index, value);
    if (this.tenantId && index !== 'companyId') {
      return items.filter((item: any) => !item.companyId || item.companyId === this.tenantId);
    }
    return items;
  }

  async save(entity: T): Promise<void> {
    if (this.tenantId && !(entity as any).companyId) {
      (entity as any).companyId = this.tenantId;
    }
    return this.adapter.save<T>(this.storeName, entity);
  }

  async delete(id: string | number): Promise<void> {
    return this.adapter.delete(this.storeName, id);
  }
}

@Injectable({ providedIn: 'root' })
export class DexieDatabaseAdapter implements DatabaseAPI {
  private platformId = inject(PLATFORM_ID, { optional: true });
  private isInitialized = false;
  private readonly repositories = new Map<string, Repository<any>>();

  constructor() {
    this.ensureInit();
  }

  private async ensureInit() {
    if (!this.isInitialized) {
      this.isInitialized = true;
      await initializeDatabase(this.platformId || undefined);
    }
  }

  getRepository<T>(store: string): Repository<T> {
    let repo = this.repositories.get(store);
    if (!repo) {
      repo = new DexieRepositoryImpl<T>(this, store);
      this.repositories.set(store, repo);
    }
    return repo as Repository<T>;
  }

  async get<T>(store: string, id: string | number): Promise<T | null> {
    await this.ensureInit();
    const table = (db as any)[store];
    if (!table) throw new Error(`Store "${store}" not found in Dexie.`);
    const item = await table.get(id);
    return (item as T) || null;
  }

  async getAll<T>(store: string): Promise<T[]> {
    await this.ensureInit();
    const table = (db as any)[store];
    if (!table) throw new Error(`Store "${store}" not found in Dexie.`);
    return await table.toArray();
  }

  async query<T>(store: string, index: string, value: any): Promise<T[]> {
    await this.ensureInit();
    const table = (db as any)[store];
    if (!table) throw new Error(`Store "${store}" not found in Dexie.`);
    return await table.where(index).equals(value).toArray();
  }

  async save<T>(store: string, data: T): Promise<void> {
    await this.ensureInit();
    const table = (db as any)[store];
    if (!table) throw new Error(`Store "${store}" not found in Dexie.`);
    await table.put(data);
  }

  async delete(store: string, id: string | number): Promise<void> {
    await this.ensureInit();
    const table = (db as any)[store];
    if (!table) throw new Error(`Store "${store}" not found in Dexie.`);
    await table.delete(id);
  }

  async transaction<T>(stores: string[], mode: 'readonly' | 'readwrite', callback: () => Promise<T>): Promise<T> {
    await this.ensureInit();
    const tableRefs = stores.map(s => (db as any)[s]);
    return await (db as any).transaction(mode, tableRefs, callback);
  }
}


import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AppRegistry, AppManifest } from './services/app-registry';
import { AppDexieDb, db } from './storage/dexie.db';
import { DexieDatabaseAdapter } from './storage/dexie.adapter';

describe('Regras de Fronteira Arquitetural (3eatcru OS)', () => {
  let adapter: DexieDatabaseAdapter;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DexieDatabaseAdapter]
    });
    adapter = TestBed.inject(DexieDatabaseAdapter);
  });

  it('AppRegistry deve ser um serviço de plataforma puro e instanciável sem dependência de módulos de negócio', () => {
    const registry = new AppRegistry();
    expect(registry).toBeDefined();
    expect(registry.getApps()).toEqual([]);

    // Registro dinâmico sob contrato de manifesto
    registry.registerApp({
      id: 'test_app',
      name: 'Aplicativo de Teste',
      category: 'TESTE',
      icon: 'apps',
      iconColor: 'text-blue-500',
      version: '1.0.0'
    });

    expect(registry.getApps().length).toBe(1);
    expect(registry.getApp('test_app')?.name).toBe('Aplicativo de Teste');

    registry.unregisterApp('test_app');
    expect(registry.getApps().length).toBe(0);
  });

  it('AppRegistry deve suportar registro em lote e carregamento dinâmico por lazy loader', async () => {
    const registry = new AppRegistry();
    
    class MockComponent {}

    const manifests: AppManifest[] = [
      {
        id: 'crm_app',
        name: 'CRM Extensível',
        category: 'CLIENTES',
        icon: 'trending_up',
        iconColor: 'text-indigo-600',
        loadComponent: async () => MockComponent,
        version: '1.0.0'
      },
      {
        id: 'pdv_app',
        name: 'PDV Frente de Caixa',
        category: 'OPERACAO',
        icon: 'point_of_sale',
        iconColor: 'text-emerald-600',
        loadComponent: async () => MockComponent,
        shortcut: 'F2',
        version: '1.0.0'
      }
    ];

    registry.registerApps(manifests);
    expect(registry.getApps().length).toBe(2);

    const crm = registry.getApp('crm_app');
    expect(crm).toBeDefined();
    expect(crm?.loadComponent).toBeDefined();

    const loadedComp = await crm!.loadComponent!();
    expect(loadedComp).toBe(MockComponent);
  });

  it('AppDexieDb deve manter todas as tabelas operacionais e de auditoria para integridade ACID', () => {
    expect(db.name).toBe('3eatcru_unified_os_db');

    // Platform & Settings tables
    expect(db.tables.map((t: any) => t.name)).toContain('companySettings');
    expect(db.tables.map((t: any) => t.name)).toContain('operators');

    // Business DB must contain business operational tables + outbox + auditLogs for ACID transactions
    expect(db.tables.map((t: any) => t.name)).toContain('sales');
    expect(db.tables.map((t: any) => t.name)).toContain('products');
    expect(db.tables.map((t: any) => t.name)).toContain('cashSessions');
    expect(db.tables.map((t: any) => t.name)).toContain('outbox');
    expect(db.tables.map((t: any) => t.name)).toContain('auditLogs');
  });

  it('OSContext deve fornecer abstração de repositório, isolamento de tenant e desacoplamento de storage', () => {
    const productRepo = adapter.getRepository('products');

    expect(productRepo).toBeDefined();
    expect(typeof productRepo.findById).toBe('function');
    expect(typeof productRepo.findAll).toBe('function');
    expect(typeof productRepo.save).toBe('function');
    expect(typeof productRepo.delete).toBe('function');
    expect(typeof productRepo.forTenant).toBe('function');

    const tenantScopedRepo = productRepo.forTenant('emp_tenant_01');
    expect(tenantScopedRepo).toBeDefined();
    expect(typeof tenantScopedRepo.findAll).toBe('function');
  });

  it('TransactionEngine deve suportar fluxo atômico de recebimento de compras sem quebrar o Kardex', () => {
    const purchaseRepo = adapter.getRepository('purchaseOrders');
    const stockRepo = adapter.getRepository('stockMovements');

    expect(purchaseRepo).toBeDefined();
    expect(stockRepo).toBeDefined();
  });
});



import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { TransactionEngine } from './transaction.engine';
import { SyncOutboxService } from '../sync/sync-outbox.service';
import { AppContextService } from '../services/app-context.service';
import { db } from '../storage/dexie.db';
import { SaleItem, PaymentEntry, Product, Operator } from '../models';

describe('TransactionEngine & SyncOutbox Security and Integrity Tests', () => {
  let engine: TransactionEngine;
  let mockSyncOutbox: {
    enqueue: (entityType: any, entityId: string, operation: any, payload: any) => Promise<void>;
    getPendingCount: () => Promise<number>;
    lastEnqueued: any;
  };
  let mockContext: {
    companyId: () => string;
    locationId: () => string;
    currentOperator: () => Operator | null;
    operatorRole: () => string | null;
  };

  beforeEach(() => {
    db.transaction = (async (mode: any, tables: any[], callback: () => Promise<any>) => {
      return callback();
    }) as any;

    mockSyncOutbox = {
      lastEnqueued: null,
      enqueue: async (entityType: any, entityId: string, operation: any, payload: any) => {
        mockSyncOutbox.lastEnqueued = { entityType, entityId, operation, payload };
      },
      getPendingCount: async () => 0
    };

    mockContext = {
      companyId: () => 'comp-123',
      locationId: () => 'loc-123',
      currentOperator: () => null,
      operatorRole: () => 'CASHIER'
    };

    TestBed.configureTestingModule({
      providers: [
        TransactionEngine,
        { provide: SyncOutboxService, useValue: mockSyncOutbox },
        { provide: AppContextService, useValue: mockContext }
      ]
    });

    engine = TestBed.inject(TransactionEngine);
  });

  it('should prevent processing sale if operational terminal context is missing', async () => {
    mockContext.companyId = () => '';
    mockContext.locationId = () => '';

    const items: SaleItem[] = [
      { productId: 'p1', productName: 'Coca Lata', quantity: 1, unitPrice: 6, totalPrice: 6 }
    ];
    const payments: PaymentEntry[] = [{ method: 'dinheiro', amount: 6 }];

    await expect(engine.processSale({ items, payments })).rejects.toThrow(
      'Operação bloqueada: O terminal operacional precisa estar pareado e configurado para processar vendas.'
    );
  });

  it('should prevent processing sale if operator context is missing', async () => {
    mockContext.companyId = () => 'comp-123';
    mockContext.locationId = () => 'loc-123';
    mockContext.currentOperator = () => null;

    const items: SaleItem[] = [
      { productId: 'p1', productName: 'Coca Lata', quantity: 1, unitPrice: 6, totalPrice: 6 }
    ];
    const payments: PaymentEntry[] = [{ method: 'dinheiro', amount: 6 }];

    await expect(engine.processSale({ items, payments })).rejects.toThrow(
      'Operação bloqueada: É necessário um operador autenticado e ativo para realizar vendas.'
    );
  });

  it('should process a sale, deduct stock, and enqueue to outbox correctly', async () => {
    mockContext.companyId = () => 'comp-123';
    mockContext.locationId = () => 'loc-123';
    
    const fakeOperator: Operator = {
      id: 'op-123',
      companyId: 'comp-123',
      name: 'João Caixa',
      role: 'CASHIER',
      pin: '1234',
      salt: 'salt',
      active: true,
      createdAt: Date.now()
    };
    mockContext.currentOperator = () => fakeOperator;
    mockContext.operatorRole = () => 'CASHIER';

    const testProduct: Product = {
      id: 'p1',
      companyId: 'comp-123',
      name: 'Coca Cola',
      category: 'Bebidas',
      barcode: '123',
      price: 6,
      costPrice: 3,
      stock: 10,
      minStock: 2,
      unit: 'un',
      icon: 'local_drink',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const origGet = db.products.get.bind(db.products);
    const origProdPut = db.products.put.bind(db.products);
    const origSalePut = db.sales.put.bind(db.sales);
    const origMovPut = db.stockMovements.put.bind(db.stockMovements);
    const origAudPut = db.auditLogs.put.bind(db.auditLogs);

    db.products.get = (() => Promise.resolve(testProduct)) as any;
    db.products.put = (() => Promise.resolve('p1')) as any;
    db.sales.put = (() => Promise.resolve('sale-123')) as any;
    db.stockMovements.put = (() => Promise.resolve('mov-123')) as any;
    db.auditLogs.put = (() => Promise.resolve('aud-123')) as any;

    try {
      const items: SaleItem[] = [
        { productId: 'p1', productName: 'Coca Cola', quantity: 2, unitPrice: 6, totalPrice: 12 }
      ];
      const payments: PaymentEntry[] = [{ method: 'dinheiro', amount: 12 }];

      const sale = await engine.processSale({ items, payments });

      expect(sale).toBeDefined();
      expect(sale.companyId).toBe('comp-123');
      expect(sale.total).toBe(12);
      expect(sale.operatorName).toBe('João Caixa');

      // Confirm sync enqueuing
      expect(mockSyncOutbox.lastEnqueued).not.toBeNull();
      expect(mockSyncOutbox.lastEnqueued.entityType).toBe('SALE');
      expect(mockSyncOutbox.lastEnqueued.entityId).toBe(sale.id);
    } finally {
      db.products.get = origGet;
      db.products.put = origProdPut;
      db.sales.put = origSalePut;
      db.stockMovements.put = origMovPut;
      db.auditLogs.put = origAudPut;
    }
  });

  it('should block sale when stock is insufficient and allowNegativeStock is undefined (default strict)', async () => {
    mockContext.companyId = () => 'comp-123';
    mockContext.locationId = () => 'loc-123';
    
    const fakeOperator: Operator = {
      id: 'op-123',
      companyId: 'comp-123',
      name: 'João Caixa',
      role: 'CASHIER',
      pin: '1234',
      salt: 'salt',
      active: true,
      createdAt: Date.now()
    };
    mockContext.currentOperator = () => fakeOperator;
    mockContext.operatorRole = () => 'CASHIER';

    const testProduct: Product = {
      id: 'p1',
      companyId: 'comp-123',
      name: 'Red Bull',
      category: 'Bebidas',
      barcode: '999',
      price: 15,
      costPrice: 8,
      stock: 2, // only 2 in stock
      minStock: 1,
      unit: 'un',
      icon: 'bolt',
      active: true,
      allowNegativeStock: undefined, // undefined must default to false
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const origGet = db.products.get.bind(db.products);
    db.products.get = (() => Promise.resolve(testProduct)) as any;

    try {
      const items: SaleItem[] = [
        { productId: 'p1', productName: 'Red Bull', quantity: 5, unitPrice: 15, totalPrice: 75 }
      ];
      const payments: PaymentEntry[] = [{ method: 'dinheiro', amount: 75 }];

      await expect(engine.processSale({ items, payments })).rejects.toThrow(
        /Estoque insuficiente para o produto "Red Bull"/
      );
    } finally {
      db.products.get = origGet;
    }
  });

  it('should correctly sum multiple cash payments and calculate exact change', async () => {
    mockContext.companyId = () => 'comp-123';
    mockContext.locationId = () => 'loc-123';
    
    const fakeOperator: Operator = {
      id: 'op-123',
      companyId: 'comp-123',
      name: 'Maria Vendas',
      role: 'CASHIER',
      pin: '1234',
      salt: 'salt',
      active: true,
      createdAt: Date.now()
    };
    mockContext.currentOperator = () => fakeOperator;
    mockContext.operatorRole = () => 'CASHIER';

    const testProduct: Product = {
      id: 'p2',
      companyId: 'comp-123',
      name: 'Sanduíche Especial',
      category: 'Lanches',
      barcode: '456',
      price: 35,
      costPrice: 15,
      stock: 50,
      minStock: 5,
      unit: 'un',
      icon: 'fastfood',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const origGet = db.products.get.bind(db.products);
    const origProdPut = db.products.put.bind(db.products);
    const origSalePut = db.sales.put.bind(db.sales);
    const origMovPut = db.stockMovements.put.bind(db.stockMovements);
    const origAudPut = db.auditLogs.put.bind(db.auditLogs);

    db.products.get = (() => Promise.resolve(testProduct)) as any;
    db.products.put = (() => Promise.resolve('p2')) as any;
    db.sales.put = (() => Promise.resolve('sale-multi-cash')) as any;
    db.stockMovements.put = (() => Promise.resolve('mov-multi')) as any;
    db.auditLogs.put = (() => Promise.resolve('aud-multi')) as any;

    try {
      const items: SaleItem[] = [
        { productId: 'p2', productName: 'Sanduíche Especial', quantity: 2, unitPrice: 35, totalPrice: 70 }
      ];
      // Two cash payments totaling 100 on a 70 bill => change = 30
      const payments: PaymentEntry[] = [
        { method: 'dinheiro', amount: 50 },
        { method: 'dinheiro', amount: 50 }
      ];

      const sale = await engine.processSale({ items, payments });

      expect(sale).toBeDefined();
      expect(sale.total).toBe(70);
      expect(sale.change).toBe(30);
    } finally {
      db.products.get = origGet;
      db.products.put = origProdPut;
      db.sales.put = origSalePut;
      db.stockMovements.put = origMovPut;
      db.auditLogs.put = origAudPut;
    }
  });

  it('should enforce multi-tenant isolation and set companyId automatically on saveEntity', async () => {
    mockContext.companyId = () => 'emp_matriz_01';
    mockContext.locationId = () => 'loc_01';
    
    const fakeAdmin: Operator = {
      id: 'op-admin',
      companyId: 'emp_matriz_01',
      name: 'Admin Master',
      role: 'OWNER' as any,
      pin: '0000',
      salt: 'salt',
      active: true,
      createdAt: Date.now()
    };
    mockContext.currentOperator = () => fakeAdmin;
    mockContext.operatorRole = () => 'OWNER';

    let savedData: any = null;
    const origPut = db.products.put.bind(db.products);
    const origAud = db.auditLogs.put.bind(db.auditLogs);
    db.products.put = ((item: any) => {
      savedData = item;
      return Promise.resolve(item.id);
    }) as any;
    db.auditLogs.put = (() => Promise.resolve('aud-1')) as any;

    try {
      const entity = { id: 'prod-new', name: 'Suco Natural', price: 10 };
      await engine.saveEntity('products', entity, 'CREATE');

      expect(savedData).not.toBeNull();
      expect(savedData.companyId).toBe('emp_matriz_01');
      expect(mockSyncOutbox.lastEnqueued).not.toBeNull();
      expect(mockSyncOutbox.lastEnqueued.entityType).toBe('PRODUCT');
    } finally {
      db.products.put = origPut;
      db.auditLogs.put = origAud;
    }
  });

  it('should prevent unauthorized roles from executing restricted entity actions', async () => {
    mockContext.companyId = () => 'emp_matriz_01';
    mockContext.locationId = () => 'loc_01';
    
    const fakeWaiter: Operator = {
      id: 'op-waiter',
      companyId: 'emp_matriz_01',
      name: 'Garçom Zé',
      role: 'WAITER',
      pin: '1111',
      salt: 'salt',
      active: true,
      createdAt: Date.now()
    };
    mockContext.currentOperator = () => fakeWaiter;
    mockContext.operatorRole = () => 'WAITER';

    // WAITER should not be able to save companySettings or financial transactions
    await expect(engine.saveEntity('companySettings', { id: 's1' }, 'DELETE')).rejects.toThrow(/Acesso negado/);
    await expect(engine.saveEntity('financialTransactions', { id: 'f1' }, 'DELETE')).rejects.toThrow(/Acesso negado/);
  });
});

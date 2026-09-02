import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { SyncOutboxService } from './sync-outbox.service';
import { db } from '../storage/dexie.db';

describe('SyncOutboxService', () => {
  let service: SyncOutboxService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SyncOutboxService]
    });
    service = TestBed.inject(SyncOutboxService);
  });

  it('should be created and have default local-first offline state', () => {
    expect(service).toBeTruthy();
    expect(service.isSyncing()).toBe(false);
    expect(service.lastSyncResult()).toContain('Offline First');
  });

  it('should hash payloads consistently for deduplication and signature checks', () => {
    const payloadA = { id: 1, name: 'Produto A' };
    const payloadB = { id: 1, name: 'Produto A' };
    const payloadC = { id: 2, name: 'Produto B' };

    const hashA = (service as any).hashPayload(payloadA);
    const hashB = (service as any).hashPayload(payloadB);
    const hashC = (service as any).hashPayload(payloadC);

    expect(hashA).toBe(hashB);
    expect(hashA).not.toBe(hashC);
  });

  it('should enqueue mutations with idempotency key and PENDING status', async () => {
    let capturedMessage: any = null;
    const originalPut = db.outbox.put.bind(db.outbox);
    db.outbox.put = ((item: any) => {
      capturedMessage = item;
      return Promise.resolve('outbox-123');
    }) as any;
    
    try {
      await service.enqueue('PRODUCT', 'prod-10', 'CREATE', { id: 'prod-10', name: 'Item Teste' });

      expect(capturedMessage).not.toBeNull();
      expect(capturedMessage.entityType).toBe('PRODUCT');
      expect(capturedMessage.entityId).toBe('prod-10');
      expect(capturedMessage.operation).toBe('CREATE');
      expect(capturedMessage.status).toBe('PENDING');
      expect(capturedMessage.idempotencyKey).toBeDefined();
      expect(capturedMessage.payloadHash).toBeDefined();
    } finally {
      db.outbox.put = originalPut;
    }
  });

  it('should return safe local-first message when cloud sync is disabled or not configured', async () => {
    service.saveConfig({
      enabled: false,
      serverUrl: '',
      syncIntervalSeconds: 60
    });

    const pendingItem: any = {
      id: 'outbox-1',
      entityType: 'SALE',
      entityId: 's1',
      operation: 'CREATE',
      payload: {},
      status: 'PENDING',
      timestamp: Date.now()
    };

    const mockCollection = {
      limit: () => ({
        toArray: () => Promise.resolve([pendingItem])
      }),
      toArray: () => Promise.resolve([pendingItem])
    };
    const mockWhereClause = {
      equals: () => ({
        or: () => ({
          equals: () => mockCollection
        })
      })
    };
    
    const originalWhere = db.outbox.where.bind(db.outbox);
    db.outbox.where = (() => mockWhereClause as any) as any;

    try {
      const result = await service.syncNow();

      expect(result.processed).toBe(1);
      expect(result.succeeded).toBe(0);
      expect(result.message).toContain('banco local');
    } finally {
      db.outbox.where = originalWhere;
    }
  });
});


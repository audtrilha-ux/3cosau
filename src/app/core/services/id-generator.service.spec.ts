import { TestBed } from '@angular/core/testing';
import { IdGeneratorService } from './id-generator.service';

describe('IdGeneratorService', () => {
  let service: IdGeneratorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [IdGeneratorService]
    });
    service = TestBed.inject(IdGeneratorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should generate valid UUID v4 format', () => {
    const uuid = service.generateUUID();
    expect(uuid).toBeDefined();
    // Regex for standard UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test(uuid)).toBe(true);
  });

  it('should generate distinct prefixed identifiers', () => {
    const id1 = service.generatePrefixedId('sale');
    const id2 = service.generatePrefixedId('sale');

    expect(id1.startsWith('sale-')).toBe(true);
    expect(id2.startsWith('sale-')).toBe(true);
    expect(id1).not.toBe(id2);
  });

  it('should generate cryptographically distinct transaction codes', () => {
    const code1 = service.generateTransactionCode('VENDA');
    const code2 = service.generateTransactionCode('VENDA');

    expect(code1.startsWith('VENDA-')).toBe(true);
    expect(code2.startsWith('VENDA-')).toBe(true);
    expect(code1).not.toBe(code2);
  });
});

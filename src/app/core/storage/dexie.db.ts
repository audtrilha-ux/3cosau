import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import 'fake-indexeddb/auto';
import Dexie, { Table } from 'dexie';
import { 
  Product, 
  Sale, 
  CashSession, 
  TableOrder, 
  StockMovement, 
  Customer, 
  FinancialTransaction, 
  AuditLog, 
  CompanySettings,
  Supplier,
  PurchaseOrder,
  DeliveryOrder,
  HelpdeskTicket,
  ContractedService,
  CrmLead,
  Operator,
  LoyaltyMember,
  LoyaltyReward,
  LoyaltyVoucher,
  ManufacturingOrder,
  ProjectTask,
  WhatsappTemplate,
  HardwareDevice
} from '../models';
import { OutboxMessage } from '../sync/sync-outbox.service';

/**
 * Unified AppDexieDb (Platform + Business combined for ACID compliance - P0 FIX)
 */
export class AppDexieDb extends Dexie {
  companySettings!: Table<CompanySettings, string>;
  operators!: Table<Operator, string>;
  hardwareDevices!: Table<HardwareDevice, string>;
  products!: Table<Product, string>;
  sales!: Table<Sale, string>;
  cashSessions!: Table<CashSession, string>;
  tableOrders!: Table<TableOrder, string>;
  stockMovements!: Table<StockMovement, string>;
  customers!: Table<Customer, string>;
  financialTransactions!: Table<FinancialTransaction, string>;
  suppliers!: Table<Supplier, string>;
  purchaseOrders!: Table<PurchaseOrder, string>;
  deliveryOrders!: Table<DeliveryOrder, string>;
  serviceOrders!: Table<HelpdeskTicket, string>;
  contractedServices!: Table<ContractedService, string>;
  crmLeads!: Table<CrmLead, string>;
  loyaltyMembers!: Table<LoyaltyMember, string>;
  loyaltyRewards!: Table<LoyaltyReward, string>;
  loyaltyVouchers!: Table<LoyaltyVoucher, string>;
  manufacturingOrders!: Table<ManufacturingOrder, string>;
  projectTasks!: Table<ProjectTask, string>;
  whatsappTemplates!: Table<WhatsappTemplate, string>;
  auditLogs!: Table<AuditLog, string>;
  outbox!: Table<OutboxMessage, string>;

  constructor() {
    super('3eatcru_unified_os_db');
    this.version(3).stores({
      companySettings: 'id',
      operators: 'id, companyId, role, active',
      hardwareDevices: 'id, companyId, category, isDefault',
      products: 'id, companyId, category, barcode, active',
      sales: 'id, companyId, locationId, code, status, createdAt',
      cashSessions: 'id, companyId, status, openedAt',
      tableOrders: 'id, companyId, tableNumber, status',
      stockMovements: 'id, companyId, productId, type, timestamp',
      customers: 'id, companyId, name, document, blocked',
      financialTransactions: 'id, companyId, type, status, dueDate',
      suppliers: 'id, companyId, name, document, category',
      purchaseOrders: 'id, companyId, supplierId, status, createdAt',
      deliveryOrders: 'id, companyId, orderNumber, status, createdAt',
      serviceOrders: 'id, companyId, status, priority, createdAt',
      contractedServices: 'id, companyId, supplierId, status, dueDate',
      crmLeads: 'id, companyId, stage, createdAt',
      loyaltyMembers: 'id, companyId, phone, tier, status',
      loyaltyRewards: 'id, companyId, category, active',
      loyaltyVouchers: 'id, companyId, code, status',
      manufacturingOrders: 'id, companyId, status, createdAt',
      projectTasks: 'id, companyId, stage, priority, dueDate',
      whatsappTemplates: 'id, companyId, triggerEvent, active',
      auditLogs: 'id, companyId, actor, action, timestamp',
      outbox: 'id, status, timestamp, entityType'
    });
  }

  createAppDatabase(dbName: string, storesSchema: Record<string, string>): Dexie {
    const customDb = new Dexie(dbName);
    customDb.version(1).stores(storesSchema);
    return customDb;
  }
}

export const db = new AppDexieDb();



export async function initializeDatabase(platformId?: object): Promise<void> {
  if (platformId && !isPlatformBrowser(platformId)) return;
  
  await db.open();
}

export async function resetDatabase(platformId?: object): Promise<void> {
  if (platformId && !isPlatformBrowser(platformId)) return;
  
  await Promise.all([
    db.products.clear(),
    db.sales.clear(),
    db.cashSessions.clear(),
    db.tableOrders.clear(),
    db.stockMovements.clear(),
    db.customers.clear(),
    db.financialTransactions.clear(),
    db.auditLogs.clear(),
    db.companySettings.clear(),
    db.outbox.clear(),
    db.suppliers.clear(),
    db.purchaseOrders.clear(),
    db.deliveryOrders.clear(),
    db.serviceOrders.clear(),
    db.contractedServices.clear(),
    db.crmLeads.clear(),
    db.operators.clear(),
    db.loyaltyMembers.clear(),
    db.loyaltyRewards.clear(),
    db.loyaltyVouchers.clear(),
    db.manufacturingOrders.clear(),
    db.projectTasks.clear(),
    db.whatsappTemplates.clear(),
    db.hardwareDevices.clear()
  ]);
  localStorage.removeItem('3eatcru_last_operator_id');
}

/**
 * On-demand demo catalog population.
 */
export async function seedDemoData(companyId: string, locationId = 'loc_matriz', operatorName = 'Administrador', platformId?: object): Promise<void> {
  if (platformId && !isPlatformBrowser(platformId)) return;
  

  try {
    console.log(`[3eatcru OS] Populating demo business catalog for company ${companyId}...`);

    // 1. Initial Products
    const initialProducts: Product[] = [
      {
        id: 'prod-' + crypto.randomUUID().split('-')[0],
        companyId,
        name: 'Coca-Cola Lata 350ml',
        category: 'Bebidas',
        barcode: '7894900010015',
        price: 6.00,
        costPrice: 2.80,
        stock: 48,
        minStock: 12,
        unit: 'un',
        icon: 'local_drink',
        isMenuItem: true,
        kitchenStation: 'bar',
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'prod-' + crypto.randomUUID().split('-')[0],
        companyId,
        name: 'Água Mineral Crystal 500ml',
        category: 'Bebidas',
        barcode: '7894900530001',
        price: 4.00,
        costPrice: 1.20,
        stock: 60,
        minStock: 20,
        unit: 'un',
        icon: 'water_drop',
        isMenuItem: true,
        kitchenStation: 'bar',
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'prod-' + crypto.randomUUID().split('-')[0],
        companyId,
        name: 'X-Burger Artesanal Bacon Duplo',
        category: 'Lanches',
        barcode: '789000000001',
        price: 32.90,
        costPrice: 13.50,
        stock: 35,
        minStock: 10,
        unit: 'un',
        icon: 'lunch_dining',
        isMenuItem: true,
        kitchenStation: 'chapa',
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'prod-' + crypto.randomUUID().split('-')[0],
        companyId,
        name: 'Porção Batata Rústica Trufada',
        category: 'Porções',
        barcode: '789000000002',
        price: 24.50,
        costPrice: 8.00,
        stock: 25,
        minStock: 8,
        unit: 'un',
        icon: 'fastfood',
        isMenuItem: true,
        kitchenStation: 'cozinha',
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'prod-' + crypto.randomUUID().split('-')[0],
        companyId,
        name: 'Cerveja Heineken Long Neck 330ml',
        category: 'Bebidas',
        barcode: '7891991000833',
        price: 11.50,
        costPrice: 5.20,
        stock: 72,
        minStock: 24,
        unit: 'un',
        icon: 'sports_bar',
        isMenuItem: true,
        kitchenStation: 'bar',
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'prod-' + crypto.randomUUID().split('-')[0],
        companyId,
        name: 'Café Espresso Gourmet 50ml',
        category: 'Cafeteria',
        barcode: '789000000003',
        price: 6.50,
        costPrice: 1.10,
        stock: 150,
        minStock: 30,
        unit: 'un',
        icon: 'coffee',
        isMenuItem: true,
        kitchenStation: 'bar',
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'prod-' + crypto.randomUUID().split('-')[0],
        companyId,
        name: 'Açaí na Tigela Completo 500ml',
        category: 'Sobremesas',
        barcode: '789000000004',
        price: 22.00,
        costPrice: 7.50,
        stock: 20,
        minStock: 5,
        unit: 'un',
        icon: 'icecream',
        isMenuItem: true,
        kitchenStation: 'cozinha',
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'prod-' + crypto.randomUUID().split('-')[0],
        companyId,
        name: 'Suco Natural Laranja 400ml',
        category: 'Bebidas',
        barcode: '789000000005',
        price: 9.00,
        costPrice: 2.50,
        stock: 40,
        minStock: 15,
        unit: 'un',
        icon: 'local_bar',
        isMenuItem: true,
        kitchenStation: 'bar',
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'prod-' + crypto.randomUUID().split('-')[0],
        companyId,
        name: 'Pão Francês Tradicional (KG)',
        category: 'Padaria',
        barcode: '789000000006',
        price: 18.90,
        costPrice: 6.80,
        stock: 30,
        minStock: 10,
        unit: 'kg',
        icon: 'bakery_dining',
        isMenuItem: false,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'prod-' + crypto.randomUUID().split('-')[0],
        companyId,
        name: 'Queijo Mussarela Fatiado (KG)',
        category: 'Frios & Laticínios',
        barcode: '789000000007',
        price: 46.90,
        costPrice: 28.50,
        stock: 18,
        minStock: 5,
        unit: 'kg',
        icon: 'egg',
        isMenuItem: false,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];
    await db.products.bulkAdd(initialProducts);

    // 2. Customers
    const initialCustomers: Customer[] = [
      {
        id: 'cust-' + crypto.randomUUID().split('-')[0],
        companyId,
        name: 'Mariana Silva Costa',
        document: '123.456.789-00',
        phone: '(11) 98765-4321',
        email: 'mariana.costa@email.com',
        creditLimit: 500.00,
        currentDebt: 64.50,
        blocked: false,
        notes: 'Cliente frequente. Caderneta de fiado activa.',
        createdAt: Date.now() - 86400000 * 30,
        updatedAt: Date.now()
      },
      {
        id: 'cust-' + crypto.randomUUID().split('-')[0],
        companyId,
        name: 'Rodrigo Alcantara',
        document: '234.567.890-11',
        phone: '(11) 97123-8899',
        email: 'rodrigo.alcantara@empresa.com',
        creditLimit: 800.00,
        currentDebt: 0.00,
        blocked: false,
        notes: 'Faturamento corporativo quinzenal.',
        createdAt: Date.now() - 86400000 * 60,
        updatedAt: Date.now()
      }
    ];
    await db.customers.bulkAdd(initialCustomers);

    // 3. Tables
    const initialTables: TableOrder[] = [
      { id: 'mesa-1', companyId, tableNumber: 1, status: 'FREE', items: [], openedAt: 0 },
      { id: 'mesa-2', companyId, tableNumber: 2, status: 'OCCUPIED', customerName: 'Mesa Família Santos', items: [
        { productId: initialProducts[2].id, productName: initialProducts[2].name, quantity: 2, unitPrice: 32.90, totalPrice: 65.80 },
        { productId: initialProducts[0].id, productName: initialProducts[0].name, quantity: 2, unitPrice: 6.00, totalPrice: 12.00 }
      ], openedAt: Date.now() - 3600000 * 1.5 },
      { id: 'mesa-3', companyId, tableNumber: 3, status: 'FREE', items: [], openedAt: 0 },
      { id: 'mesa-4', companyId, tableNumber: 4, status: 'FREE', items: [], openedAt: 0 }
    ];
    await db.tableOrders.bulkAdd(initialTables);

    // 4. Initial Suppliers
    const initialSuppliers: Supplier[] = [
      {
        id: 'sup-1',
        companyId,
        name: 'Distribuidora de Bebidas Brasil Ltda',
        document: '01.234.567/0001-89',
        contactPerson: 'Roberto Carlos (Vendas)',
        phone: '(11) 98765-1122',
        email: 'pedidos@bebidasbrasil.com.br',
        city: 'São Paulo',
        paymentTerms: '28 Dias Boleto',
        leadTimeDays: 2,
        category: 'Bebidas & Destilados',
        createdAt: Date.now()
      },
      {
        id: 'sup-2',
        companyId,
        name: 'Hortifruti & Carnes Santa Rita',
        document: '98.765.432/0001-10',
        contactPerson: 'Dona Rita',
        phone: '(11) 97654-3344',
        email: 'contato@santaritahorti.com.br',
        city: 'Campinas',
        paymentTerms: '14 Dias PIX',
        leadTimeDays: 1,
        category: 'Alimentos Frescos & Carnes',
        createdAt: Date.now()
      }
    ];
    await db.suppliers.bulkAdd(initialSuppliers);

    // 5. Hardware Devices
    const initialHardware: HardwareDevice[] = [
      { id: 'hw-1', companyId, name: 'Impressora Térmica Virtual (ESC/POS 80mm)', category: 'printer', connectionType: 'virtual_mock', status: 'connected', isDefault: true },
      { id: 'hw-2', companyId, name: 'Balança Checkout Virtual (Toledo Prix)', category: 'scale', connectionType: 'virtual_mock', baudRate: 9600, status: 'connected', isDefault: true },
      { id: 'hw-3', companyId, name: 'Gaveta de Dinheiro RJ-11 (Pulso Elétrico)', category: 'cash_drawer', connectionType: 'virtual_mock', status: 'connected', isDefault: true },
      { id: 'hw-4', companyId, name: 'Terminal TEF Pinpad Virtual', category: 'tef', connectionType: 'virtual_mock', status: 'connected', isDefault: true }
    ];
    await db.hardwareDevices.bulkAdd(initialHardware);

    // 6. Initial WhatsApp Templates
    const initialTemplates: WhatsappTemplate[] = [
      { id: 'wa-1', companyId, title: 'Comprovante de Venda PDV', triggerEvent: 'venda_concluida', content: 'Olá, {{cliente}}! Seu cupom no valor de {{valor}} foi emitido com sucesso no 3eatcru OS. Agradecemos a preferência!', active: true },
      { id: 'wa-2', companyId, title: 'Aviso de Despacho Delivery', triggerEvent: 'pedido_em_rota', content: 'Olá, {{cliente}}! Seu cupom {{pedido}} saiu para entrega com o motoboy {{motoboy}}. Endereço: {{endereco}}.', active: true },
      { id: 'wa-3', companyId, title: 'Lembrete de Fechamento de Fiado', triggerEvent: 'cobranca_fiado', content: 'Prezado(a) {{cliente}}, informamos que o saldo atual da sua caderneta é de {{valor}}. Estamos à disposição para quitação no balcão ou via PIX!', active: true }
    ];
    await db.whatsappTemplates.bulkAdd(initialTemplates);

    console.log('[3eatcru OS] Demo dataset loaded successfully.');
  } catch (err) {
    console.error('[3eatcru OS] Error seeding demo data:', err);
  }
}

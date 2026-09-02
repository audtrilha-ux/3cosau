/**
 * 3eatcru OS - Entity Type Registry
 * Centralized, authoritative bidirectional mapping between Dexie table names and Standard Entity Types.
 * Ensures consistent serialization across Outbox, Pull Sync, Central Server, Cloudflare Worker and Audit Logs.
 */

export const TABLE_TO_ENTITY_TYPE: Record<string, string> = {
  products: 'PRODUCT',
  sales: 'SALE',
  cashSessions: 'CASH_SESSION',
  tableOrders: 'TABLE_ORDER',
  stockMovements: 'STOCK_MOVEMENT',
  customers: 'CUSTOMER',
  financialTransactions: 'FINANCIAL_TRANSACTION',
  auditLogs: 'AUDIT_LOG',
  companySettings: 'COMPANY_SETTINGS',
  suppliers: 'SUPPLIER',
  purchaseOrders: 'PURCHASE_ORDER',
  deliveryOrders: 'DELIVERY',
  serviceOrders: 'SERVICE_ORDER',
  contractedServices: 'CONTRACTED_SERVICE',
  crmLeads: 'CRM_LEAD',
  loyaltyMembers: 'LOYALTY_MEMBER',
  loyaltyRewards: 'LOYALTY_REWARD',
  loyaltyVouchers: 'LOYALTY_VOUCHER',
  manufacturingOrders: 'MANUFACTURING_ORDER',
  projectTasks: 'PROJECT_TASK',
  whatsappTemplates: 'WHATSAPP_TEMPLATE',
  hardwareDevices: 'HARDWARE_DEVICE',
  operators: 'OPERATOR'
};

export const ENTITY_TYPE_TO_TABLE: Record<string, string> = {
  PRODUCT: 'products',
  SALE: 'sales',
  CASH_SESSION: 'cashSessions',
  TABLE_ORDER: 'tableOrders',
  STOCK_MOVEMENT: 'stockMovements',
  CUSTOMER: 'customers',
  FINANCIAL_TRANSACTION: 'financialTransactions',
  AUDIT_LOG: 'auditLogs',
  COMPANY_SETTINGS: 'companySettings',
  SUPPLIER: 'suppliers',
  PURCHASE_ORDER: 'purchaseOrders',
  DELIVERY: 'deliveryOrders',
  SERVICE_ORDER: 'serviceOrders',
  CONTRACTED_SERVICE: 'contractedServices',
  CRM_LEAD: 'crmLeads',
  LOYALTY_MEMBER: 'loyaltyMembers',
  LOYALTY_REWARD: 'loyaltyRewards',
  LOYALTY_VOUCHER: 'loyaltyVouchers',
  MANUFACTURING_ORDER: 'manufacturingOrders',
  PROJECT_TASK: 'projectTasks',
  WHATSAPP_TEMPLATE: 'whatsappTemplates',
  HARDWARE_DEVICE: 'hardwareDevices',
  OPERATOR: 'operators'
};

export const TABLE_TO_PERMISSION: Record<string, { action: string; resource: string }> = {
  products: { action: 'PRODUCT_SAVE', resource: 'estoque' },
  sales: { action: 'PROCESS_SALE', resource: 'vendas' },
  cashSessions: { action: 'CASH_MANAGE', resource: 'caixa' },
  tableOrders: { action: 'TABLE_MANAGE', resource: 'mesas' },
  stockMovements: { action: 'STOCK_MANAGE', resource: 'estoque' },
  customers: { action: 'CUSTOMER_SAVE', resource: 'clientes' },
  financialTransactions: { action: 'FINANCE_MANAGE', resource: 'financeiro' },
  suppliers: { action: 'SUPPLIER_MANAGE', resource: 'fornecedores' },
  purchaseOrders: { action: 'PURCHASE_MANAGE', resource: 'compras' },
  deliveryOrders: { action: 'DELIVERY_MANAGE', resource: 'delivery' },
  serviceOrders: { action: 'SERVICE_MANAGE', resource: 'servicos' },
  contractedServices: { action: 'CONTRACTS_MANAGE', resource: 'servicos_contratados' },
  crmLeads: { action: 'CRM_MANAGE', resource: 'crm' },
  loyaltyMembers: { action: 'LOYALTY_MANAGE', resource: 'fidelidade' },
  loyaltyRewards: { action: 'LOYALTY_MANAGE', resource: 'fidelidade' },
  loyaltyVouchers: { action: 'LOYALTY_MANAGE', resource: 'fidelidade' },
  manufacturingOrders: { action: 'MFG_MANAGE', resource: 'fabricacao' },
  projectTasks: { action: 'PROJECT_MANAGE', resource: 'projetos' },
  whatsappTemplates: { action: 'WHATSAPP_MANAGE', resource: 'whatsapp' },
  hardwareDevices: { action: 'HARDWARE_MANAGE', resource: 'hardware' },
  operators: { action: 'OPERATOR_SAVE', resource: 'funcionarios' },
  companySettings: { action: 'SETTINGS_MANAGE', resource: 'configuracoes' }
};

export function getEntityTypeForTable(tableName: string): string {
  return TABLE_TO_ENTITY_TYPE[tableName] || tableName.toUpperCase();
}

export function getTableForEntityType(entityType: string): string | null {
  const norm = entityType.toUpperCase().trim();
  return ENTITY_TYPE_TO_TABLE[norm] || null;
}

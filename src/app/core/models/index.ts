export interface FiscalData {
  ncm?: string;
  cest?: string;
  cfop?: string;
  origin?: string; // 0 - Nacional, 1 - Importada
  csosnCst?: string; // 102, 500
  icmsPercent?: number;
}

export interface Product {
  id: string;
  companyId: string;
  name: string;
  category: string;
  barcode: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  icon: string;
  color?: string;
  fiscal?: FiscalData;
  isMenuItem?: boolean;
  kitchenStation?: string; // 'cozinha' | 'bar' | 'chapa'
  allowNegativeStock?: boolean;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export interface PaymentEntry {
  method: 'dinheiro' | 'pix' | 'debito' | 'credito' | 'fiado';
  amount: number;
  receivedAmount?: number;
  changeAmount?: number;
  installments?: number;
}

export interface Sale {
  id: string;
  companyId: string;
  locationId: string;
  code: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  change?: number;
  payments: PaymentEntry[];
  customerId?: string;
  customerName?: string;
  operatorId: string;
  operatorName: string;
  tableNumber?: number;
  status: 'COMPLETED' | 'CANCELLED';
  createdAt: number;
}

export interface CashDenominationCount {
  n200: number;
  n100: number;
  n50: number;
  n20: number;
  n10: number;
  n5: number;
  n2: number;
  m1: number;
  m050: number;
  m025: number;
  m010: number;
  m005: number;
}

export interface CashMovement {
  id: string;
  sessionId: string;
  type: 'ABERTURA' | 'SUPRIMENTO' | 'SANGRIA' | 'VENDA' | 'PAGAMENTO_FIADO';
  amount: number;
  reason: string;
  operatorName: string;
  timestamp: number;
}

export interface CashSession {
  id: string;
  companyId: string;
  locationId: string;
  operatorId: string;
  operatorName: string;
  initialCash: number;
  status: 'OPEN' | 'CLOSED';
  openedAt: number;
  closedAt?: number;
  finalCashCalculated?: number;
  finalCashDeclared?: number;
  cashDifference?: number;
  denominationCounts?: CashDenominationCount;
  movements: CashMovement[];
}

export interface TableOrder {
  id: string;
  companyId: string;
  tableNumber: number;
  status: 'FREE' | 'OCCUPIED' | 'BILL_REQUESTED';
  customerName?: string;
  items: SaleItem[];
  openedAt: number;
}

export interface StockMovement {
  id: string;
  companyId: string;
  productId: string;
  productName: string;
  type: 'ENTRADA' | 'SAIDA_VENDA' | 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO' | 'PERDA';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  operatorName: string;
  timestamp: number;
}

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  document?: string; // CPF/CNPJ
  phone?: string;
  email?: string;
  address?: string;
  creditLimit: number;
  currentDebt: number;
  blocked: boolean;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface FinancialTransaction {
  id: string;
  companyId: string;
  type: 'RECEITA' | 'DESPESA';
  category: string;
  description: string;
  amount: number;
  status: 'PAGO' | 'PENDENTE';
  dueDate: number;
  paymentDate?: number;
  paymentMethod?: string;
}

export interface AuditLog {
  id: string;
  companyId: string;
  actor: string;
  action: string;
  resource: string;
  resourceId: string;
  details: string;
  timestamp: number;
}

export interface Location {
  id: string;
  companyId: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  isMain: boolean;
}

// ==========================================
// 🏢 3EATCRU CENTRAL (Plataforma Master Models)
// ==========================================

export interface CentralAccount {
  id: string;
  email: string;
  name: string;
  phone: string;
  status: 'ACTIVE' | 'BLOCKED' | 'PENDING_VERIFICATION';
  role: 'SUPERADMIN' | 'ACCOUNT_OWNER';
  createdAt: number;
  companiesCount: number;
}

export interface CentralCompany {
  id: string;
  accountId: string;
  ownerName: string;
  name: string;
  tradingName: string;
  cnpj: string;
  phone: string;
  city: string;
  state: string;
  planId: string;
  planName: string;
  licenseKey: string;
  licenseStatus: 'ATIVA' | 'SUSPENSA' | 'BLOQUEADA' | 'EXPIRADA' | 'TRIAL_EXPIRADA';
  terminalsCount: number;
  maxTerminals: number;
  createdAt: number;
  
  // Trial/Subscription Integration
  trialStartedAt?: number;
  trialEndsAt?: number;
  subscriptionStatus?: 'TRIAL' | 'ACTIVE' | 'TRIAL_EXPIRED' | 'BLOCKED' | 'UNPAID';
  planCode?: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
}

export interface CentralPlan {
  id: string;
  name: string;
  code: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  priceMonthly: number;
  maxTerminals: number;
  maxUsers: number;
  allowedModules: string[];
  features: string[];
  active: boolean;
}

export interface CentralLicense {
  id: string;
  licenseKey: string; // Ex: 3EC-9842-8712-4401
  companyId: string;
  companyName: string;
  planId: string;
  planCode: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  status: 'ATIVA' | 'SUSPENSA' | 'BLOQUEADA' | 'EXPIRADA' | 'TRIAL_EXPIRADA';
  issuedAt: number;
  expiresAt: number;
  maxDevices: number;
  activeDevicesCount: number;
  allowedModules: string[];
  signatureHash: string;
  
  // Trial/Subscription Integration
  trialStartedAt?: number;
  trialEndsAt?: number;
  subscriptionStatus?: 'TRIAL' | 'ACTIVE' | 'TRIAL_EXPIRED' | 'BLOCKED' | 'UNPAID';
  entitlements?: string[];
}

export interface CentralDevice {
  id: string;
  companyId: string;
  companyName: string;
  licenseKey: string;
  deviceName: string;
  deviceType: 'PDV' | 'CAIXA' | 'GERENCIA' | 'GARCOM_MOBILE' | 'KDS_COZINHA';
  hardwareFingerprint: string;
  pairingCode?: string; // 6 dígitos temporários
  pairingStatus: 'PENDENTE' | 'PAREADO' | 'REVOGADO' | 'BLOQUEADO';
  lastHeartbeat: number;
  isOnline: boolean;
  appVersion: string;
  osPlatform: string; // Web, Windows, Android
  ipAddress?: string;
  registeredAt: number;
}

export interface CentralAuditLog {
  id: string;
  actor: string;
  role: string;
  action: string;
  resource: string;
  resourceId: string;
  companyId?: string;
  companyName?: string;
  ip: string;
  timestamp: number;
  details: string;
}

export interface CentralVersion {
  version: string;
  releaseDate: number;
  channel: 'stable' | 'beta';
  minCompatibleVersion: string;
  changelog: string[];
  mandatoryUpdate: boolean;
  downloadUrl?: string;
}

export interface TerminalDevice {
  id: string;
  companyId: string;
  locationId: string;
  name: string;
  type: 'PDV' | 'CAIXA' | 'GERENCIA' | 'GARCOM_MOBILE' | 'KDS_COZINHA';
  fingerprint: string;
  registeredAt: number;
}

export interface CompanySettings {
  id: string;
  name: string;
  tradingName: string;
  cnpj: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  taxRegime?: 'MEI' | 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL';
  receiptHeader: string;
  receiptFooter: string;
  enableSound: boolean;
  blindCashClose: boolean;
  printerWidth: '80mm' | '58mm';
  activeLocationId?: string;
  activeDeviceId?: string;
  isInitialized: boolean;
  
  // Licensing and Trial details for local copy
  licenseKey?: string;
  planId?: string;
  planCode?: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  trialStartedAt?: number;
  trialEndsAt?: number;
  subscriptionStatus?: 'TRIAL' | 'ACTIVE' | 'TRIAL_EXPIRED' | 'BLOCKED' | 'UNPAID';
  syncToken?: string;
}

// Additional Ecosystem Domain Models

export interface Supplier {
  id: string;
  companyId: string;
  name: string;
  document: string;
  contactPerson: string;
  phone: string;
  email: string;
  address?: string;
  city?: string;
  paymentTerms: string;
  leadTimeDays: number;
  category: string;
  notes?: string;
  createdAt: number;
}

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  receivedQuantity: number;
}

export interface PurchaseOrder {
  id: string;
  companyId: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseOrderItem[];
  total: number;
  status: 'ENVIADO' | 'RECEBIDO_PARCIAL' | 'RECEBIDO';
  paymentTerms: string;
  createdAt: number;
}

export type DeliveryStatus = 'PENDENTE' | 'PRONTO' | 'EM_ROTA' | 'ENTREGUE' | 'CANCELADO';

export interface DeliveryOrder {
  id: string;
  companyId: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  address: string;
  referencePoint?: string;
  courier: string;
  orderAmount: number;
  deliveryFee: number;
  paymentMethod: string;
  changeFor?: number;
  status: DeliveryStatus;
  notes?: string;
  createdAt: number;
}

export interface HelpdeskTicket {
  id: string;
  companyId: string;
  client: string;
  customerId?: string;
  subject: string;
  description: string;
  priority: 'BAIXA' | 'MEDIA' | 'ALTA';
  status: 'ABERTO' | 'EM_ANDAMENTO' | 'RESOLVIDO';
  laborCost?: number;
  consumedParts?: { productId: string; name: string; quantity: number; unitPrice: number }[];
  createdAt: number;
}

export interface ContractedService {
  id: string;
  companyId: string;
  supplierId: string;
  supplierName: string;
  description: string;
  cost: number;
  dueDate: number;
  paidDate?: number;
  periodicity: 'Mensal' | 'Único' | 'Anual';
  category: string;
  status: 'PENDENTE' | 'PAGO' | 'CANCELADO';
  createdAt: number;
}

export interface CrmLead {
  id: string;
  companyId: string;
  clientName: string;
  company: string;
  value: number;
  stage: 'lead' | 'qualificado' | 'proposta' | 'ganho';
  probability: number;
  phone?: string;
  email?: string;
  customerId?: string;
  createdAt: number;
}

export interface Operator {
  id: string;
  companyId: string;
  name: string;
  role: 'OWNER' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'STOCK';
  pin: string;
  email?: string;
  password?: string;
  salt?: string;
  active: boolean;
  createdAt: number;
}

export type LoyaltyTier = 'BRONZE' | 'PRATA' | 'OURO' | 'DIAMANTE';

export interface LoyaltyMember {
  id: string;
  companyId: string;
  name: string;
  phone: string;
  cpf?: string;
  pointsBalance: number;
  totalPointsEarned: number;
  totalCashbackEarned: number;
  tier: LoyaltyTier;
  status: 'ACTIVE' | 'BLOCKED';
  joinedAt: number;
}

export interface LoyaltyReward {
  id: string;
  companyId: string;
  title: string;
  description: string;
  pointsRequired: number;
  category: 'ITEM_GRATIS' | 'DESCONTO' | 'BRINDE' | 'EXPERIENCIA';
  discountValue: number;
  validityDays: number;
  active: boolean;
}

export interface LoyaltyVoucher {
  id: string;
  companyId: string;
  code: string;
  memberId: string;
  memberName: string;
  memberPhone: string;
  rewardTitle: string;
  pointsSpent: number;
  discountValue: number;
  status: 'ACTIVE' | 'REDEEMED' | 'EXPIRED';
  issuedAt: number;
  expiresAt: number;
}

export interface ManufacturingOrder {
  id: string;
  companyId: string;
  productName: string;
  quantity: number;
  components: { productId: string; name: string; qtyRequired: number }[];
  status: 'RASCUNHO' | 'EM_ANDAMENTO' | 'CONCLUIDO';
  createdAt: number;
}

export interface ProjectTask {
  id: string;
  companyId: string;
  title: string;
  project: string;
  assignee: string;
  stage: 'novo' | 'em_progresso' | 'revisao' | 'concluido';
  priority: 'baixa' | 'media' | 'alta';
  dueDate: number;
  createdAt: number;
}

export interface WhatsappTemplate {
  id: string;
  companyId: string;
  title: string;
  triggerEvent: string;
  content: string;
  active: boolean;
}

export interface HardwareDevice {
  id: string;
  companyId: string;
  name: string;
  category: 'printer' | 'scale' | 'cash_drawer' | 'barcode_scanner' | 'customer_display' | 'tef';
  connectionType: 'virtual_mock' | 'web_serial' | 'web_usb';
  baudRate?: number;
  status: 'connected' | 'disconnected';
  isDefault: boolean;
}

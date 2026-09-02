import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Enable JSON bodies with higher limits for big outbox payloads
app.use(express.json({ limit: '50mb' }));

import fs from 'node:fs';
import { randomUUID, randomBytes, createHash } from 'node:crypto';

const DB_PATH = join(process.cwd(), 'central_db.json');

function readCentralDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = {
      accounts: [],
      companies: [],
      licenses: [],
      devices: [],
      auditLogs: [],
      versions: [
        {
          version: 'v1.0.2-stable',
          releaseDate: Date.now() - 86400000 * 2,
          channel: 'stable',
          minCompatibleVersion: 'v1.0.0',
          changelog: [
            'Padronização integral do ecossistema Remix 3eatcru OS 1.0.2',
            'Isolamento transacional completo por Tenant e Location',
            'Suporte a Pareamento de Hardware por Código criptográfico',
            'Controle de Licenças com revogação remota de terminais',
            'Sincronização com Outbox e idempotência rigorosa'
          ],
          mandatoryUpdate: false
        }
      ],
      plans: [
        {
          id: 'plan_starter',
          name: 'Starter',
          code: 'STARTER',
          priceMonthly: 89.90,
          maxTerminals: 1,
          maxUsers: 2,
          allowedModules: ['pdv', 'caixa', 'estoque', 'clientes', 'hardware'],
          features: ['1 Terminal PDV', 'Emissão Fiscal Básica', 'Controle de Caixa', 'Kardex Offline'],
          active: true
        },
        {
          id: 'plan_pro',
          name: 'Professional',
          code: 'PROFESSIONAL',
          priceMonthly: 189.90,
          maxTerminals: 3,
          maxUsers: 10,
          allowedModules: ['pdv', 'caixa', 'mesas', 'delivery', 'cardapio', 'estoque', 'compras', 'fornecedores', 'clientes', 'crm', 'fidelidade', 'whatsapp', 'financeiro', 'servicos_contratados', 'funcionarios', 'relatorios', 'hardware'],
          features: ['Até 3 Terminais PDV', 'Mesas & Comandas', 'Delivery & Despacho', 'Fidelidade & Cashback', 'Kardex & Relatórios'],
          active: true
        },
        {
          id: 'plan_enterprise',
          name: 'Enterprise Ultra',
          code: 'ENTERPRISE',
          priceMonthly: 349.90,
          maxTerminals: 10,
          maxUsers: 50,
          allowedModules: ['pdv', 'caixa', 'mesas', 'delivery', 'cardapio', 'estoque', 'compras', 'fornecedores', 'clientes', 'crm', 'fidelidade', 'whatsapp', 'servicos', 'fabricacao', 'projetos', 'financeiro', 'servicos_contratados', 'funcionarios', 'relatorios', 'hardware'],
          features: ['Até 10 Terminais', 'Todos os Módulos Habilitados', 'PCP & Fabricação MRP', 'Ordens de Serviço (OS)', 'Projetos & Tarefas', 'Auditoria Completa'],
          active: true
        }
      ],
      mutations: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const db = JSON.parse(raw);
    checkAndExpireLicenses(db);
    return db;
  } catch (err) {
    console.error('Error reading central_db.json, returning empty', err);
    return {
      accounts: [],
      companies: [],
      licenses: [],
      devices: [],
      auditLogs: [],
      versions: [],
      plans: [],
      mutations: []
    };
  }
}

function checkAndExpireLicenses(db: any) {
  const now = Date.now();
  let modified = false;

  if (!db.licenses) db.licenses = [];
  if (!db.companies) db.companies = [];

  for (const lic of db.licenses) {
    if (now > lic.expiresAt && lic.status === 'ATIVA') {
      lic.status = 'EXPIRADA';
      if (lic.subscriptionStatus === 'TRIAL') {
        lic.subscriptionStatus = 'TRIAL_EXPIRED';
        lic.status = 'TRIAL_EXPIRADA';
      }
      modified = true;

      // Encontra e atualiza a empresa correspondente
      const comp = db.companies.find((c: any) => c.id === lic.companyId);
      if (comp) {
        comp.licenseStatus = 'EXPIRADA';
        if (comp.subscriptionStatus === 'TRIAL') {
          comp.subscriptionStatus = 'TRIAL_EXPIRED';
          comp.licenseStatus = 'TRIAL_EXPIRADA';
        }
      }
    }
  }

  if (modified) {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error writing to central_db.json in expiry check', err);
    }
  }
}

function writeCentralDB(data: any) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing to central_db.json', err);
  }
}

// ----------------------------------------------------
// CENTRAL AUTHORITY ENDPOINTS (Real persistent backend)
// ----------------------------------------------------

interface CentralSession {
  username: string;
  role: string;
  expiresAt: number;
}
const ACTIVE_SESSIONS = new Map<string, CentralSession>();

function authenticateCentralRequest(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Acesso negado. Token de autenticação ausente.' });
    return;
  }
  const token = authHeader.substring(7);
  const session = ACTIVE_SESSIONS.get(token);
  if (!session || session.expiresAt < Date.now()) {
    res.status(401).json({ error: 'Acesso negado. Sessão inválida ou expirada.' });
    return;
  }
  session.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // Extend session
  req.centralUser = session;
  next();
}

function logCentralEvent(db: any, req: any, action: string, resource: string, resourceId: string, companyId?: string) {
  const session = req.centralUser;
  const actor = session ? `${session.username} (Autenticado)` : 'Admin Central (Master)';
  const role = session ? session.role : 'SUPERADMIN';
  
  db.auditLogs.unshift({
    id: 'aud_' + randomUUID().substring(0, 8),
    actor,
    role,
    action,
    resource,
    resourceId,
    companyId,
    ip: req.ip || '127.0.0.1',
    timestamp: Date.now(),
    details: action
  });
}

app.post('/api/central/login', (req, res) => {
  const { username, password } = req.body;
  const expectedUser = process.env['CENTRAL_ADMIN_USER'] || 'admin';
  
  let expectedPass = process.env['CENTRAL_ADMIN_PASS'];
  if (!expectedPass) {
    if (process.env['NODE_ENV'] === 'production') {
      // In production, generate a secure random string and print it to logs if missing, to prevent hardcoded credential exploit
      expectedPass = randomBytes(16).toString('hex');
      console.warn(`[SECURITY WARNING] CENTRAL_ADMIN_PASS environment variable was not configured in production. For security, a random single-session password has been generated: ${expectedPass}`);
    } else {
      expectedPass = '3eatcru-master';
    }
  }

  if (username === expectedUser && password === expectedPass) {
    const token = 'token_' + randomBytes(24).toString('hex');
    ACTIVE_SESSIONS.set(token, {
      username,
      role: 'SUPERADMIN',
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });
    res.json({ success: true, token, user: { username, role: 'SUPERADMIN' } });
  } else {
    res.status(401).json({ success: false, error: 'Credenciais de Administrador inválidas.' });
  }
});

// Guard all central endpoints except login and devices/pair
app.use('/api/central', (req, res, next) => {
  if (req.path === '/login' || req.path === '/devices/pair') {
    next();
    return;
  }
  authenticateCentralRequest(req, res, next);
});

app.get('/api/central/data', (req, res) => {
  res.json(readCentralDB());
});

app.post('/api/central/accounts', (req, res) => {
  const { name, email, phone, role } = req.body;
  const db = readCentralDB();
  const account = {
    id: 'acc_' + randomUUID().substring(0, 8),
    name: (name || '').trim(),
    email: (email || '').trim().toLowerCase(),
    phone: (phone || '').trim(),
    status: 'ACTIVE',
    role: role || 'ACCOUNT_OWNER',
    createdAt: Date.now(),
    companiesCount: 0
  };
  db.accounts.unshift(account);
  
  logCentralEvent(db, req, 'Criou conta de proprietário ' + account.email, 'CentralAccount', account.id);
  
  writeCentralDB(db);
  res.json(account);
});

app.post('/api/central/accounts/toggle', (req, res) => {
  const { accountId } = req.body;
  const db = readCentralDB();
  const acc = db.accounts.find((a: any) => a.id === accountId);
  if (acc) {
    acc.status = acc.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    logCentralEvent(db, req, `Alterou status da conta ${accountId} para ${acc.status}`, 'CentralAccount', accountId);
    writeCentralDB(db);
    res.json({ success: true, account: acc });
  } else {
    res.status(404).json({ error: 'Conta não encontrada' });
  }
});

app.post('/api/central/companies', (req, res) => {
  const { accountId, ownerName, name, tradingName, cnpj, phone, city, state, planId } = req.body;
  const db = readCentralDB();
  const plan = db.plans.find((p: any) => p.id === planId) || db.plans[1];
  
  const companyId = 'comp_' + randomUUID().substring(0, 8);
  const part1 = randomBytes(2).toString('hex').toUpperCase();
  const part2 = randomBytes(2).toString('hex').toUpperCase();
  const part3 = randomBytes(2).toString('hex').toUpperCase();
  const licenseKey = `3EC-${part1}-${part2}-${part3}`;
  
  const now = Date.now();
  const trialDuration = 7 * 24 * 60 * 60 * 1000; // 7 dias de trial
  const trialEnds = now + trialDuration;

  const license = {
    id: 'lic_' + randomUUID().substring(0, 8),
    licenseKey,
    companyId,
    companyName: tradingName || name,
    planId: plan.id,
    planCode: plan.code,
    status: 'ATIVA',
    issuedAt: now,
    expiresAt: trialEnds, // Prazo do Trial
    maxDevices: plan.maxTerminals,
    activeDevicesCount: 0,
    allowedModules: [...plan.allowedModules],
    signatureHash: 'sig_' + randomBytes(6).toString('hex'),
    
    // Propriedades oficiais exigidas
    trialStartedAt: now,
    trialEndsAt: trialEnds,
    subscriptionStatus: 'TRIAL',
    entitlements: [...plan.allowedModules]
  };

  const company = {
    id: companyId,
    accountId,
    ownerName,
    name,
    tradingName: tradingName || name,
    cnpj,
    phone,
    city: city || 'São Paulo',
    state: state || 'SP',
    planId: plan.id,
    planName: plan.name,
    licenseKey,
    licenseStatus: 'ATIVA',
    terminalsCount: 0,
    maxTerminals: plan.maxTerminals,
    createdAt: now,
    
    // Propriedades oficiais exigidas
    trialStartedAt: now,
    trialEndsAt: trialEnds,
    subscriptionStatus: 'TRIAL',
    planCode: plan.code
  };

  const acc = db.accounts.find((a: any) => a.id === accountId);
  if (acc) {
    acc.companiesCount = (acc.companiesCount || 0) + 1;
  }

  db.companies.unshift(company);
  db.licenses.unshift(license);
  
  logCentralEvent(db, req, `Criou TRIAL de 7 dias para empresa ${company.tradingName} (Chave: ${licenseKey}, Entitlements liberados para plano ${plan.code})`, 'CentralCompany', companyId);
 
  writeCentralDB(db);
  res.json({ company, license });
});

app.post('/api/central/licenses/renew', (req, res) => {
  const { licenseId, additionalDays } = req.body;
  const db = readCentralDB();
  const lic = db.licenses.find((l: any) => l.id === licenseId);
  if (lic) {
    const base = lic.expiresAt > Date.now() ? lic.expiresAt : Date.now();
    lic.status = 'ATIVA';
    lic.subscriptionStatus = 'ACTIVE';
    lic.expiresAt = base + ((additionalDays || 365) * 24 * 60 * 60 * 1000);
    
    // Atualiza empresa correspondente
    const comp = db.companies.find((c: any) => c.id === lic.companyId);
    if (comp) {
      comp.licenseStatus = 'ATIVA';
      comp.subscriptionStatus = 'ACTIVE';
    }
    
    logCentralEvent(db, req, `Ativou plano de assinatura / Renovou licença ${lic.licenseKey} por +${additionalDays || 365} dias. Status: ACTIVE`, 'CentralLicense', licenseId, lic.companyId);
    
    writeCentralDB(db);
    res.json({ success: true, license: lic });
  } else {
    res.status(404).json({ error: 'Licença não encontrada' });
  }
});

app.post('/api/central/licenses/status', (req, res) => {
  const { licenseId, status } = req.body;
  const db = readCentralDB();
  const lic = db.licenses.find((l: any) => l.id === licenseId);
  if (lic) {
    lic.status = status;
    
    // Mapeia o status comercial correspondente
    if (status === 'ATIVA') {
      lic.subscriptionStatus = 'ACTIVE';
    } else if (status === 'SUSPENSA') {
      lic.subscriptionStatus = 'UNPAID';
    } else if (status === 'BLOQUEADA') {
      lic.subscriptionStatus = 'BLOCKED';
    } else if (status === 'EXPIRADA' || status === 'TRIAL_EXPIRADA') {
      lic.subscriptionStatus = 'TRIAL_EXPIRED';
    }

    const comp = db.companies.find((c: any) => c.id === lic.companyId);
    if (comp) {
      comp.licenseStatus = status;
      if (lic.subscriptionStatus) {
        comp.subscriptionStatus = lic.subscriptionStatus;
      }
    }
    
    logCentralEvent(db, req, `Alterou status da licença ${licenseId} para ${status}. Status comercial: ${lic.subscriptionStatus || 'N/A'}`, 'CentralLicense', licenseId, lic.companyId);
    
    writeCentralDB(db);
    res.json({ success: true, license: lic });
  } else {
    res.status(404).json({ error: 'Licença não encontrada' });
  }
});

app.post('/api/central/devices/pairing-code', (req, res) => {
  const { companyId, deviceName, deviceType } = req.body;
  const db = readCentralDB();
  const company = db.companies.find((c: any) => c.id === companyId);
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada na Central.' });
    return;
  }

  const license = db.licenses.find((l: any) => l.companyId === companyId && l.status === 'ATIVA');
  if (!license) {
    res.status(400).json({ error: 'A empresa não possui licença ativa para adicionar novos dispositivos.' });
    return;
  }

  const activeDevCount = db.devices.filter((d: any) => d.companyId === companyId && d.pairingStatus === 'PAREADO').length;
  if (activeDevCount >= license.maxDevices) {
    res.status(400).json({ error: `Limite de terminais (${license.maxDevices}) atingido para o plano ${license.planCode}.` });
    return;
  }

  const pairingCode = (100000 + (randomBytes(4).readUInt32BE(0) % 900000)).toString();
  const now = Date.now();

  const device = {
    id: 'dev_' + randomUUID().substring(0, 8),
    companyId,
    companyName: company.tradingName,
    licenseKey: license.licenseKey,
    deviceName: (deviceName || '').trim() || 'Terminal Checkout',
    deviceType,
    hardwareFingerprint: 'hw_pending_' + randomUUID().substring(0, 8),
    pairingCode,
    pairingStatus: 'PENDENTE',
    lastHeartbeat: now,
    isOnline: false,
    appVersion: 'v2.4.0-stable',
    osPlatform: 'Web / Desktop',
    registeredAt: now
  };

  db.devices.unshift(device);
  
  logCentralEvent(db, req, `Gerou código de pareamento [${pairingCode}] para ${device.deviceName} (${company.tradingName})`, 'CentralDevice', device.id, companyId);
 
  writeCentralDB(db);
  res.json(device);
});

app.post('/api/central/devices/pair', (req, res) => {
  const { pairingCode, hardwareFingerprint, osPlatform } = req.body;
  const db = readCentralDB();
  const device = db.devices.find((d: any) => d.pairingCode === (pairingCode || '').trim() && d.pairingStatus === 'PENDENTE');
  if (!device) {
    res.json({ success: false, message: 'Código de pareamento inválido ou expirado.' });
    return;
  }

  const license = db.licenses.find((l: any) => l.licenseKey === device.licenseKey && l.status === 'ATIVA');
  if (!license) {
    res.json({ success: false, message: 'A licença vinculada a este dispositivo não está ativa.' });
    return;
  }

  const now = Date.now();
  const syncToken = randomBytes(24).toString('hex');
  const syncTokenHash = createHash('sha256').update(syncToken).digest('hex');
  device.hardwareFingerprint = hardwareFingerprint || device.hardwareFingerprint;
  device.pairingStatus = 'PAREADO';
  delete device.pairingCode;
  device.lastHeartbeat = now;
  device.isOnline = true;
  device.osPlatform = osPlatform || 'Web';
  device.syncTokenHash = syncTokenHash;

  const companyDevicesCount = db.devices.filter((d: any) => d.companyId === device.companyId && d.pairingStatus === 'PAREADO').length;
  
  const comp = db.companies.find((c: any) => c.id === device.companyId);
  if (comp) {
    comp.terminalsCount = companyDevicesCount;
  }

  const lic = db.licenses.find((l: any) => l.id === license.id);
  if (lic) {
    lic.activeDevicesCount = companyDevicesCount;
  }

  logCentralEvent(db, req, `Dispositivo ${device.deviceName} pareado com sucesso (Hardware: ${hardwareFingerprint})`, 'CentralDevice', device.id, device.companyId);

  writeCentralDB(db);
  res.json({ success: true, device, license, syncToken });
});

app.post('/api/central/devices/revoke', (req, res) => {
  const { deviceId } = req.body;
  const db = readCentralDB();
  const dev = db.devices.find((d: any) => d.id === deviceId);
  if (dev) {
    dev.pairingStatus = 'REVOGADO';
    dev.isOnline = false;
    
    logCentralEvent(db, req, `Revogou autorização do terminal ${deviceId}`, 'CentralDevice', deviceId, dev.companyId);
    
    writeCentralDB(db);
    res.json({ success: true, device: dev });
  } else {
    res.status(404).json({ error: 'Dispositivo não encontrado' });
  }
});

app.post('/api/central/audit', (req, res) => {
  const { action, resource, resourceId, companyId } = req.body;
  const db = readCentralDB();
  logCentralEvent(db, req, action, resource, resourceId, companyId);
  const log = db.auditLogs[0];
  if (db.auditLogs.length > 100) {
    db.auditLogs = db.auditLogs.slice(0, 100);
  }
  writeCentralDB(db);
  res.json(log);
});

// ----------------------------------------------------
// BATCH OUTBOX SYNCHRONIZATION ENDPOINT
// ----------------------------------------------------

// Mock in-memory central cloud database for tenants (Phase 3: Conflict Resolution)
const tenantDatabases = new Map<string, Record<string, Map<string, any>>>();

function getTenantDB(tenantId: string) {
  if (!tenantDatabases.has(tenantId)) {
    tenantDatabases.set(tenantId, {});
  }
  return tenantDatabases.get(tenantId)!;
}

function getTable(tenantDb: any, tableName: string) {
  if (!tenantDb[tableName]) {
    tenantDb[tableName] = new Map<string, any>();
  }
  return tenantDb[tableName];
}
app.post('/api/sync/batch', (req, res) => {
  const { sentAt, batchSize, mutations } = req.body;
  const clientTenantId = req.headers['x-tenant-id'] as string;
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Não autorizado: Token de dispositivo obrigatório para sincronização.' });
    return;
  }

  const db = readCentralDB();
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const matchedDevice = db.devices.find((d: any) => d.pairingStatus === 'PAREADO' && d.syncTokenHash === tokenHash);

  const allowInsecureDev = process.env['ALLOW_INSECURE_DEV_SYNC'] === 'true';
  let tenantId = matchedDevice ? matchedDevice.companyId : null;

  if (!tenantId) {
    if (allowInsecureDev && clientTenantId) {
      tenantId = clientTenantId;
    } else {
      res.status(401).json({ error: 'Não autorizado: Token de sincronização de terminal inválido ou revogado.' });
      return;
    }
  }

  if (clientTenantId && clientTenantId !== tenantId && !allowInsecureDev) {
    res.status(403).json({ error: 'Não autorizado: Incompatibilidade entre tenant do token e header X-Tenant-Id.' });
    return;
  }
  
  if (!mutations || !Array.isArray(mutations)) {
    res.status(400).json({ error: 'Mutações inválidas' });
    return;
  }

  if (mutations.length > 200) {
    res.status(400).json({ error: 'Lote de mutações excede o limite máximo permitido de 200 itens por requisição.' });
    return;
  }

  const processedIds: string[] = [];
  const blockedIds: string[] = []; // For conflicts
  
  const tenantDb = getTenantDB(tenantId);

  const ALLOWED_ENTITY_TYPES = new Set([
    'PRODUCT', 'SALE', 'CASH_SESSION', 'TABLE_ORDER', 'STOCK_MOVEMENT',
    'CUSTOMER', 'FINANCIAL_TRANSACTION', 'AUDIT_LOG', 'COMPANY_SETTINGS',
    'SUPPLIER', 'PURCHASE_ORDER', 'DELIVERY', 'SERVICE_ORDER',
    'CONTRACTED_SERVICE', 'CRM_LEAD', 'LOYALTY_MEMBER', 'LOYALTY_REWARD',
    'LOYALTY_VOUCHER', 'MANUFACTURING_ORDER', 'PROJECT_TASK',
    'WHATSAPP_TEMPLATE', 'HARDWARE_DEVICE', 'OPERATOR'
  ]);

  for (const m of mutations) {
    if (!m.entityType || !ALLOWED_ENTITY_TYPES.has(m.entityType.toUpperCase())) {
      console.warn(`[Sync Server] Mutação rejeitada: tipo de entidade '${m.entityType}' fora da whitelist.`);
      continue;
    }
    // 1. Idempotency Check
    const alreadyProcessed = db.mutations.some((x: any) => x.id === m.id);
    if (alreadyProcessed) {
      processedIds.push(m.id);
      continue;
    }
    
    // 2. Conflict Resolution & Delta Reconciliation
    const tableName = m.entityType;
    const table = getTable(tenantDb, tableName);
    const existingRecord = table.get(m.entityId);
    
    let payloadToApply = { ...m.payload };

    // Prevent double-counting of inventory: if PRODUCT mutation arrives, preserve the server authoritative stock calculated from STOCK_MOVEMENT events
    if (tableName === 'PRODUCT' && existingRecord) {
      payloadToApply.stock = typeof existingRecord.stock === 'number' ? existingRecord.stock : (Number(existingRecord.stock) || 0);
    }

    if (existingRecord && existingRecord._serverUpdatedAt > m.timestamp) {
      // Conflict detected! Server has a newer record.
      console.log(`[Sync Server] Conflito em ${tableName} ${m.entityId}. Iniciando reconciliação inteligente...`);
      
      if (tableName === 'PRODUCT') {
        // Smart Merge para Produto: preserva o estoque atual do servidor, mas aceita atualizações de cadastro (nome, preço, etc)
        payloadToApply = {
          ...payloadToApply,
          _serverUpdatedAt: existingRecord._serverUpdatedAt
        };
      } else if (tableName === 'CUSTOMER') {
        // Smart Merge para Cliente: preserva dados novos do servidor, mas concilia o limite de crédito e debito
        payloadToApply = {
          ...m.payload,
          currentDebt: existingRecord.currentDebt, // Preserva débito do servidor
          _serverUpdatedAt: existingRecord._serverUpdatedAt
        };
      } else {
        // Para outras entidades, mantém o registro do servidor (Last-Write-Wins), bloqueando a mutação cliente
        console.warn(`[Sync Server] LWW mantido para ${tableName} ${m.entityId}. Servidor é mais recente.`);
        blockedIds.push(m.id);
        continue;
      }
    }
    
    // 3. Apply mutation
    if (m.operation === 'CREATE' || m.operation === 'UPDATE') {
      table.set(m.entityId, {
        ...payloadToApply,
        _serverUpdatedAt: Date.now() // Mark server version timestamp
      });

      // --- Delta-Based Side Effects for Inventory & Cash Session ---
      if (tableName === 'STOCK_MOVEMENT') {
        const productId = m.payload.productId;
        const productTable = getTable(tenantDb, 'PRODUCT');
        const serverProduct = productTable.get(productId);
        if (serverProduct) {
          const qty = Number(m.payload.quantity) || 0;
          const type = m.payload.type;
          if (type === 'ENTRADA' || type === 'AJUSTE_POSITIVO') {
            serverProduct.stock = (Number(serverProduct.stock) || 0) + qty;
          } else if (type === 'SAIDA_VENDA' || type === 'AJUSTE_NEGATIVO' || type === 'PERDA') {
            serverProduct.stock = (Number(serverProduct.stock) || 0) - qty;
          }
          serverProduct._serverUpdatedAt = Date.now();
          productTable.set(productId, serverProduct);
          console.log(`[Sync Delta] Estoque reconciliado para produto ${productId}. Novo estoque: ${serverProduct.stock}`);
        }
      } else if (tableName === 'CASH_MOVEMENT') {
        const sessionId = m.payload.sessionId;
        const sessionTable = getTable(tenantDb, 'CASH_SESSION');
        const serverSession = sessionTable.get(sessionId);
        if (serverSession) {
          if (!serverSession.movements) serverSession.movements = [];
          const exists = serverSession.movements.some((x: any) => x.id === m.payload.id);
          if (!exists) {
            serverSession.movements.push(m.payload);
            const amount = Number(m.payload.amount) || 0;
            if (m.payload.type === 'SUPRIMENTO') {
              serverSession.finalCashCalculated = (Number(serverSession.finalCashCalculated) || Number(serverSession.initialCash) || 0) + amount;
            } else if (m.payload.type === 'SANGRIA') {
              serverSession.finalCashCalculated = (Number(serverSession.finalCashCalculated) || Number(serverSession.initialCash) || 0) - amount;
            }
            serverSession._serverUpdatedAt = Date.now();
            sessionTable.set(sessionId, serverSession);
            console.log(`[Sync Delta] Movimento de caixa reconciliado na sessão ${sessionId}.`);
          }
        }
      }
    } else if (m.operation === 'DELETE') {
      table.delete(m.entityId);
    }
    
    // Log mutation globally for auditing (including tenantId for pull sync)
    db.mutations.unshift({
      id: m.id,
      tenantId, // Store tenantId for filtering in GET /api/sync/pull
      entityType: m.entityType,
      entityId: m.entityId,
      operation: m.operation,
      payload: payloadToApply,
      timestamp: m.timestamp,
      syncedAt: Date.now()
    });
    
    processedIds.push(m.id);
  }

  writeCentralDB(db);

  // Return processed successfully and those blocked by conflicts
  res.json({ success: true, processedIds, blockedIds });
});

app.get('/api/sync/pull', (req, res) => {
  const clientTenantId = req.headers['x-tenant-id'] as string;
  const lastSyncedAt = Number(req.query['lastSyncedAt']) || 0;
  const lastId = req.query['lastId'] as string || '';
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Não autorizado: Token de dispositivo obrigatório para sincronização.' });
    return;
  }

  const db = readCentralDB();
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const matchedDevice = db.devices.find((d: any) => d.pairingStatus === 'PAREADO' && d.syncTokenHash === tokenHash);

  const allowInsecureDev = process.env['ALLOW_INSECURE_DEV_SYNC'] === 'true';
  let tenantId = matchedDevice ? matchedDevice.companyId : null;

  if (!tenantId) {
    if (allowInsecureDev && clientTenantId) {
      tenantId = clientTenantId;
    } else {
      res.status(401).json({ error: 'Não autorizado: Token de sincronização inválido ou revogado.' });
      return;
    }
  }

  if (clientTenantId && clientTenantId !== tenantId && !allowInsecureDev) {
    res.status(403).json({ error: 'Não autorizado: Incompatibilidade entre tenant do token e header X-Tenant-Id.' });
    return;
  }

  // Busca mutações da central que ocorreram após a última sincronização do cliente para este tenant
  const filteredMutations = db.mutations.filter((m: any) => {
    if (m.tenantId !== tenantId) return false;
    if (m.syncedAt > lastSyncedAt) return true;
    if (m.syncedAt === lastSyncedAt && m.id > lastId) return true;
    return false;
  });

  console.log(`[Pull Sync] Tenant ${tenantId} requisitou atualizações desde ${lastSyncedAt}. Enviando ${filteredMutations.length} mutações.`);

  res.json({
    success: true,
    mutations: filteredMutations,
    currentTimestamp: Date.now()
  });
});

app.get('/api/sync/license-check', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const clientTenantId = req.headers['x-tenant-id'] as string;

  if (!token) {
    res.status(401).json({ error: 'Não autorizado: Token de dispositivo obrigatório.' });
    return;
  }

  const db = readCentralDB();
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const device = db.devices.find((d: any) => d.pairingStatus === 'PAREADO' && d.syncTokenHash === tokenHash);

  if (!device) {
    res.status(401).json({ error: 'Não autorizado: Dispositivo não encontrado ou não pareado na Central.' });
    return;
  }

  const license = db.licenses.find((l: any) => l.licenseKey === device.licenseKey);
  if (!license) {
    res.status(404).json({ error: 'Licença vinculada ao dispositivo não encontrada.' });
    return;
  }

  res.json({
    success: true,
    subscriptionStatus: license.subscriptionStatus,
    trialEndsAt: license.expiresAt,
    planCode: license.planCode,
    status: license.status
  });
});
/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
    if (process.env['NODE_ENV'] === 'production') {
      console.warn(`[WARNING] O backend atual baseado em JSON (server.ts) está rodando em modo produção.`);
      console.warn(`[WARNING] Para produção oficial e escalável, é fortemente recomendado utilizar a arquitetura Cloudflare Worker + D1.`);
      console.warn(`[WARNING] Consulte a documentação em cloudflare-worker/README.md para provisionar o Control Plane definitivo.`);
    }
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

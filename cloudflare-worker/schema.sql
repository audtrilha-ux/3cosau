-- Cloudflare D1 Relational Schema for 3eatcru Central Control Plane (Phase 5)
-- Non-destructive production-safe DDL

CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    status TEXT DEFAULT 'ACTIVE',
    role TEXT DEFAULT 'ACCOUNT_OWNER',
    created_at INTEGER NOT NULL,
    companies_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    owner_name TEXT,
    name TEXT NOT NULL,
    trading_name TEXT,
    cnpj TEXT,
    phone TEXT,
    city TEXT,
    state TEXT,
    plan_id TEXT,
    plan_name TEXT,
    license_key TEXT UNIQUE,
    license_status TEXT DEFAULT 'ATIVA',
    terminals_count INTEGER DEFAULT 0,
    max_terminals INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    trial_started_at INTEGER,
    trial_ends_at INTEGER,
    subscription_status TEXT DEFAULT 'TRIAL',
    plan_code TEXT
);

CREATE TABLE IF NOT EXISTS licenses (
    id TEXT PRIMARY KEY,
    license_key TEXT UNIQUE NOT NULL,
    company_id TEXT NOT NULL,
    company_name TEXT,
    plan_id TEXT,
    plan_code TEXT,
    status TEXT DEFAULT 'ATIVA',
    issued_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    max_devices INTEGER DEFAULT 1,
    active_devices_count INTEGER DEFAULT 0,
    allowed_modules TEXT, -- JSON Array representation
    signature_hash TEXT,
    trial_started_at INTEGER,
    trial_ends_at INTEGER,
    subscription_status TEXT DEFAULT 'TRIAL',
    entitlements TEXT -- JSON Array representation
);

CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    company_name TEXT,
    license_key TEXT,
    device_name TEXT,
    device_type TEXT,
    hardware_fingerprint TEXT,
    pairing_code TEXT,
    pairing_status TEXT DEFAULT 'PENDENTE',
    last_heartbeat INTEGER,
    is_online INTEGER DEFAULT 0,
    app_version TEXT,
    os_platform TEXT,
    registered_at INTEGER NOT NULL,
    sync_token TEXT,
    sync_token_hash TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor TEXT NOT NULL,
    role TEXT,
    action TEXT NOT NULL,
    resource TEXT,
    resource_id TEXT,
    company_id TEXT,
    ip TEXT,
    timestamp INTEGER NOT NULL,
    details TEXT
);

CREATE TABLE IF NOT EXISTS mutations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload TEXT NOT NULL, -- JSON String representation
    timestamp INTEGER NOT NULL,
    synced_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    price_monthly REAL,
    max_terminals INTEGER,
    max_users INTEGER,
    allowed_modules TEXT, -- JSON Array representation
    features TEXT, -- JSON Array representation
    active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS versions (
    version TEXT PRIMARY KEY,
    release_date INTEGER,
    channel TEXT,
    min_compatible_version TEXT,
    changelog TEXT, -- JSON Array representation
    mandatory_update INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tenant_records (
    id TEXT PRIMARY KEY, -- "tenantId:tableName:entityId"
    tenant_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    payload TEXT NOT NULL, -- JSON String representation
    server_updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
    ip TEXT PRIMARY KEY,
    attempts INTEGER DEFAULT 0,
    locked_until INTEGER DEFAULT 0
);

-- Performance & High-Throughput Indexes
CREATE INDEX IF NOT EXISTS idx_devices_company_pairing ON devices (company_id, pairing_status);
CREATE INDEX IF NOT EXISTS idx_devices_sync_token_hash ON devices (sync_token_hash);
CREATE INDEX IF NOT EXISTS idx_mutations_tenant_synced ON mutations (tenant_id, synced_at);
CREATE INDEX IF NOT EXISTS idx_mutations_entity ON mutations (tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_tenant_records_lookup ON tenant_records (tenant_id, table_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_company_timestamp ON audit_logs (company_id, timestamp);

-- Seed pre-defined records safely
INSERT OR REPLACE INTO plans (id, name, code, price_monthly, max_terminals, max_users, allowed_modules, features, active) VALUES
('plan_starter', 'Starter', 'STARTER', 89.90, 1, 2, '["pdv", "caixa", "estoque", "clientes", "hardware"]', '["1 Terminal PDV", "Emissão Fiscal Básica", "Controle de Caixa", "Kardex Offline"]', 1),
('plan_pro', 'Professional', 'PROFESSIONAL', 189.90, 3, 10, '["pdv", "caixa", "mesas", "delivery", "cardapio", "estoque", "compras", "fornecedores", "clientes", "crm", "fidelidade", "whatsapp", "financeiro", "servicos_contratados", "funcionarios", "relatorios", "hardware"]', '["Até 3 Terminais PDV", "Mesas & Comandas", "Delivery & Despacho", "Fidelidade & Cashback", "Kardex & Relatórios"]', 1),
('plan_enterprise', 'Enterprise Ultra', 'ENTERPRISE', 349.90, 10, 50, '["pdv", "caixa", "mesas", "delivery", "cardapio", "estoque", "compras", "fornecedores", "clientes", "crm", "fidelidade", "whatsapp", "servicos", "fabricacao", "projetos", "financeiro", "servicos_contratados", "funcionarios", "relatorios", "hardware"]', '["Até 10 Terminais", "Todos os Módulos Habilitados", "PCP & Fabricação MRP", "Ordens de Serviço (OS)", "Projetos & Tarefas", "Auditoria Completa"]', 1);

INSERT OR REPLACE INTO versions (version, release_date, channel, min_compatible_version, changelog, mandatory_update) VALUES
('v1.0.2-stable', 1788220800000, 'stable', 'v1.0.0', '["Padronização integral do ecossistema Remix 3eatcru OS 1.0.2", "Isolamento transacional completo por Tenant e Location", "Suporte a Pareamento de Hardware por Código criptográfico", "Controle de Licenças com revogação remota de terminais", "Sincronização com Outbox e idempotência rigorosa"]', 0);

/**
 * 3eatcru Central Control Plane - Cloudflare Worker Codebase (Phase 5)
 * Highly production-ready, relational-mapping to Cloudflare D1 serverless database.
 */

// Define Core DTOs for Strong Typing
export interface SyncMutation {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  timestamp: number;
}

export interface PairingRequest {
  pairingCode: string;
  hardwareFingerprint?: string;
  osPlatform?: string;
}

export interface CreateCompanyRequest {
  accountId: string;
  ownerName: string;
  name: string;
  tradingName?: string;
  cnpj?: string;
  phone?: string;
  city?: string;
  state?: string;
  planId?: string;
}

// --- SCHEMA VALIDATION ---

export class Validator {
  static assertString(val: any, fieldName: string, minLen = 1): string {
    if (typeof val !== 'string' || val.trim().length < minLen) {
      throw new Error(`Validação falhou: '${fieldName}' deve ser uma string válida.`);
    }
    return val.trim();
  }
  
  static assertOptionalString(val: any): string | undefined {
    if (val === undefined || val === null) return undefined;
    if (typeof val !== 'string') throw new Error(`Validação falhou: valor deve ser string.`);
    return val.trim();
  }

  static assertArray(val: any, fieldName: string): any[] {
    if (!Array.isArray(val)) {
      throw new Error(`Validação falhou: '${fieldName}' deve ser um array.`);
    }
    return val;
  }
}

export interface Env {
  DB: D1Database;
  CENTRAL_ADMIN_USER?: string;
  CENTRAL_ADMIN_PASS?: string;
}

// Active session storage simulated in Cloudflare Workers using a secure JWT-like token or KV/memory
// Since Workers can be multi-instanced, we can use a basic cryptographically signed token or verify simple token patterns.
// For simplicity and high security, we generate token strings and verify them against DB sessions or check signed signatures.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE, PUT",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-Id",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Routing logic
      if (path === "/api/central/login" && request.method === "POST") {
        return await handleLogin(request, env);
      }

      if (path === "/api/central/devices/pair" && request.method === "POST") {
        return await handleDevicePair(request, env);
      }

      // Guard all other /api/central endpoints
      if (path.startsWith("/api/central")) {
        const authError = await authenticateRequest(request, env);
        if (authError) return authError;

        if (path === "/api/central/data" && request.method === "GET") {
          return await handleGetData(env);
        }
        if (path === "/api/central/accounts" && request.method === "POST") {
          return await handleCreateAccount(request, env);
        }
        if (path === "/api/central/accounts/toggle" && request.method === "POST") {
          return await handleToggleAccount(request, env);
        }
        if (path === "/api/central/companies" && request.method === "POST") {
          return await handleCreateCompany(request, env);
        }
        if (path === "/api/central/licenses/renew" && request.method === "POST") {
          return await handleRenewLicense(request, env);
        }
        if (path === "/api/central/licenses/status" && request.method === "POST") {
          return await handleLicenseStatus(request, env);
        }
        if (path === "/api/central/devices/pairing-code" && request.method === "POST") {
          return await handleCreatePairingCode(request, env);
        }
        if (path === "/api/central/devices/revoke" && request.method === "POST") {
          return await handleRevokeDevice(request, env);
        }
        if (path === "/api/central/audit" && request.method === "POST") {
          return await handleAuditLog(request, env);
        }
      }

      // Sync Endpoints
      if (path === "/api/sync/batch" && request.method === "POST") {
        return await handleSyncBatch(request, env);
      }
      if (path === "/api/sync/pull" && request.method === "GET") {
        return await handleSyncPull(request, env);
      }

      return new Response(JSON.stringify({ error: "Endpoint não encontrado" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    } catch (err: any) {
      console.error("[Worker Error]", err);
      return new Response(JSON.stringify({ error: "Erro interno do servidor", details: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
  }
};

// --- AUTHENTICATION HELPERS ---

async function signToken(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  const b64Payload = btoa(payload);
  return `${b64Payload}.${sigHex}`;
}

async function verifyToken(token: string, secret: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [b64Payload, sigHex] = parts;
  try {
    const payload = atob(b64Payload);
    const expectedSig = await signToken(payload, secret);
    if (token !== expectedSig) return false;
    const parsed = JSON.parse(payload);
    if (parsed.exp && Date.now() > parsed.exp) return false;
    return true;
  } catch {
    return false;
  }
}

async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function authenticateRequest(request: Request, env: Env): Promise<Response | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Acesso negado. Token de autenticação ausente." }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
  const token = authHeader.substring(7);
  const masterPass = env.CENTRAL_ADMIN_PASS;
  if (!masterPass) {
    return new Response(JSON.stringify({ error: "Erro de configuração: CENTRAL_ADMIN_PASS não configurado no ambiente." }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
  
  const isValid = await verifyToken(token, masterPass);
  if (isValid) {
    return null; // Authorized
  }

  return new Response(JSON.stringify({ error: "Acesso negado. Sessão inválida ou expirada." }), {
    status: 401,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// --- CONTROLLER HANDLERS ---

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const { username, password } = await request.json() as any;
  const expectedUser = env.CENTRAL_ADMIN_USER || "admin";
  const expectedPass = env.CENTRAL_ADMIN_PASS;

  if (!expectedPass) {
    return new Response(JSON.stringify({ success: false, error: "Segurança: CENTRAL_ADMIN_PASS deve ser configurado como Secret no Cloudflare." }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  if (username === expectedUser && password === expectedPass) {
    const payload = JSON.stringify({
      user: username,
      role: "SUPERADMIN",
      iat: Date.now(),
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });
    const token = await signToken(payload, expectedPass);
    return new Response(JSON.stringify({ 
      success: true, 
      token, 
      user: { username, role: "SUPERADMIN" } 
    }), {
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  return new Response(JSON.stringify({ success: false, error: "Credenciais de Administrador inválidas." }), {
    status: 401,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function handleGetData(env: Env): Promise<Response> {
  // Pull all records from D1 relational database
  const accounts = await env.DB.prepare("SELECT * FROM accounts ORDER BY created_at DESC").all();
  const companies = await env.DB.prepare("SELECT * FROM companies ORDER BY created_at DESC").all();
  const licenses = await env.DB.prepare("SELECT * FROM licenses ORDER BY issued_at DESC").all();
  const devices = await env.DB.prepare("SELECT * FROM devices ORDER BY registered_at DESC").all();
  const auditLogs = await env.DB.prepare("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100").all();
  const versions = await env.DB.prepare("SELECT * FROM versions").all();
  const plans = await env.DB.prepare("SELECT * FROM plans").all();
  const mutations = await env.DB.prepare("SELECT * FROM mutations ORDER BY synced_at DESC LIMIT 100").all();

  // Convert JSON-stored fields back to real arrays/objects
  const parsedLicenses = licenses.results.map((l: any) => ({
    ...l,
    allowedModules: JSON.parse(l.allowed_modules || l.allowedModules || "[]"),
    entitlements: JSON.parse(l.entitlements || "[]"),
  }));

  const parsedPlans = plans.results.map((p: any) => ({
    ...p,
    allowedModules: JSON.parse(p.allowed_modules || p.allowedModules || "[]"),
    features: JSON.parse(p.features || "[]"),
  }));

  const parsedVersions = versions.results.map((v: any) => ({
    ...v,
    changelog: JSON.parse(v.changelog || "[]"),
  }));

  const parsedMutations = mutations.results.map((m: any) => ({
    ...m,
    payload: JSON.parse(m.payload || "{}"),
  }));

  return new Response(JSON.stringify({
    accounts: accounts.results,
    companies: companies.results,
    licenses: parsedLicenses,
    devices: devices.results,
    auditLogs: auditLogs.results,
    versions: parsedVersions,
    plans: parsedPlans,
    mutations: parsedMutations,
  }), {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function handleCreateAccount(request: Request, env: Env): Promise<Response> {
  const reqData = await request.json() as any;
  const name = Validator.assertString(reqData.name, 'name');
  const email = Validator.assertString(reqData.email, 'email');
  const phone = Validator.assertOptionalString(reqData.phone);
  const role = Validator.assertOptionalString(reqData.role);

  const id = "acc_" + crypto.randomUUID().substring(0, 8);
  const now = Date.now();

  await env.DB.prepare(
    "INSERT INTO accounts (id, name, email, phone, role, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, name, email.toLowerCase(), phone || null, role || "ACCOUNT_OWNER", now).run();

  // Audit event
  const auditId = "aud_" + crypto.randomUUID().substring(0, 8);
  await env.DB.prepare(
    "INSERT INTO audit_logs (id, actor, role, action, resource, resource_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(auditId, "Admin Central (Master)", "SUPERADMIN", "Criou conta de proprietário " + email, "CentralAccount", id, now).run();

  return new Response(JSON.stringify({ id, name, email, phone, status: "ACTIVE", role: role || "ACCOUNT_OWNER", created_at: now, companies_count: 0 }), {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function handleToggleAccount(request: Request, env: Env): Promise<Response> {
  const reqData = await request.json() as any;
  const accountId = Validator.assertString(reqData.accountId, 'accountId');
  const acc = await env.DB.prepare("SELECT * FROM accounts WHERE id = ?").bind(accountId).first<any>();
  if (!acc) {
    return new Response(JSON.stringify({ error: "Conta não encontrada" }), { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }

  const nextStatus = acc.status === "ACTIVE" ? "BLOCKED" : "ACTIVE";
  await env.DB.prepare("UPDATE accounts SET status = ? WHERE id = ?").bind(nextStatus, accountId).run();

  const auditId = "aud_" + crypto.randomUUID().substring(0, 8);
  await env.DB.prepare(
    "INSERT INTO audit_logs (id, actor, role, action, resource, resource_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(auditId, "Admin Central (Master)", "SUPERADMIN", `Alterou status da conta ${accountId} para ${nextStatus}`, "CentralAccount", accountId, Date.now()).run();

  return new Response(JSON.stringify({ success: true, account: { ...acc, status: nextStatus } }), {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function handleCreateCompany(request: Request, env: Env): Promise<Response> {
  const reqData = await request.json() as CreateCompanyRequest;
  const accountId = Validator.assertString(reqData.accountId, 'accountId');
  const ownerName = Validator.assertString(reqData.ownerName, 'ownerName');
  const name = Validator.assertString(reqData.name, 'name');
  const tradingName = Validator.assertOptionalString(reqData.tradingName);
  const cnpj = Validator.assertOptionalString(reqData.cnpj);
  const phone = Validator.assertOptionalString(reqData.phone);
  const city = Validator.assertOptionalString(reqData.city);
  const state = Validator.assertOptionalString(reqData.state);
  const planId = Validator.assertOptionalString(reqData.planId);

  // Validate account exists and is ACTIVE
  const acc = await env.DB.prepare("SELECT * FROM accounts WHERE id = ?").bind(accountId).first<any>();
  if (!acc || acc.status !== 'ACTIVE') {
    return new Response(JSON.stringify({ error: "Conta proprietária inválida ou inativa." }), { 
      status: 400, 
      headers: { "Content-Type": "application/json", ...CORS_HEADERS } 
    });
  }

  // Retrieve plan details
  const plan = (planId ? await env.DB.prepare("SELECT * FROM plans WHERE id = ?").bind(planId).first<any>() : null) || 
               await env.DB.prepare("SELECT * FROM plans WHERE id = 'plan_pro'").first<any>();

  const companyId = "comp_" + crypto.randomUUID().substring(0, 8);
  const licenseKey = `3EC-${crypto.randomUUID().substring(0, 4).toUpperCase()}-${crypto.randomUUID().substring(9, 13).toUpperCase()}-${crypto.randomUUID().substring(14, 18).toUpperCase()}`;
  
  const now = Date.now();
  const trialDuration = 7 * 24 * 60 * 60 * 1000;
  const trialEnds = now + trialDuration;
  const licenseId = "lic_" + crypto.randomUUID().substring(0, 8);
  const auditId = "aud_" + crypto.randomUUID().substring(0, 8);

  // Atomic D1 batch execution for company creation
  const stmtCompany = env.DB.prepare(
    `INSERT INTO companies (id, account_id, owner_name, name, trading_name, cnpj, phone, city, state, plan_id, plan_name, license_key, license_status, terminals_count, max_terminals, created_at, trial_started_at, trial_ends_at, subscription_status, plan_code) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ATIVA', 0, ?, ?, ?, ?, 'TRIAL', ?)`
  ).bind(
    companyId, accountId, ownerName, name, tradingName || name, cnpj || null, phone || null, city || "São Paulo", state || "SP", 
    plan.id, plan.name, licenseKey, plan.max_terminals, now, now, trialEnds, plan.code
  );

  const stmtLicense = env.DB.prepare(
    `INSERT INTO licenses (id, license_key, company_id, company_name, plan_id, plan_code, status, issued_at, expires_at, max_devices, active_devices_count, allowed_modules, signature_hash, trial_started_at, trial_ends_at, subscription_status, entitlements) 
     VALUES (?, ?, ?, ?, ?, ?, 'ATIVA', ?, ?, ?, 0, ?, ?, ?, ?, 'TRIAL', ?)`
  ).bind(
    licenseId, licenseKey, companyId, tradingName || name, plan.id, plan.code,
    now, trialEnds, plan.max_terminals, plan.allowed_modules, "sig_" + crypto.randomUUID().substring(0, 12),
    now, trialEnds, plan.allowed_modules
  );

  const stmtAccount = env.DB.prepare("UPDATE accounts SET companies_count = companies_count + 1 WHERE id = ?").bind(accountId);

  const stmtAudit = env.DB.prepare(
    "INSERT INTO audit_logs (id, actor, role, action, resource, resource_id, company_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(auditId, "Admin Central (Master)", "SUPERADMIN", `Criou TRIAL de 7 dias para empresa ${tradingName || name} (Chave: ${licenseKey})`, "CentralCompany", companyId, companyId, now);

  await env.DB.batch([stmtCompany, stmtLicense, stmtAccount, stmtAudit]);

  return new Response(JSON.stringify({ success: true, companyId, licenseKey }), {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function handleRenewLicense(request: Request, env: Env): Promise<Response> {
  const reqData = await request.json() as any;
  const licenseId = Validator.assertString(reqData.licenseId, 'licenseId');
  const additionalDays = typeof reqData.additionalDays === 'number' ? Math.min(Math.max(reqData.additionalDays, 1), 365) : 365;

  const lic = await env.DB.prepare("SELECT * FROM licenses WHERE id = ?").bind(licenseId).first<any>();
  if (!lic) {
    return new Response(JSON.stringify({ error: "Licença não encontrada" }), { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }

  const base = lic.expires_at > Date.now() ? lic.expires_at : Date.now();
  const nextExpires = base + (additionalDays * 24 * 60 * 60 * 1000);
  const now = Date.now();
  const auditId = "aud_" + crypto.randomUUID().substring(0, 8);

  const stmtLicense = env.DB.prepare("UPDATE licenses SET status = 'ATIVA', subscription_status = 'ACTIVE', expires_at = ? WHERE id = ?").bind(nextExpires, licenseId);
  const stmtCompany = env.DB.prepare("UPDATE companies SET license_status = 'ATIVA', subscription_status = 'ACTIVE' WHERE id = ?").bind(lic.company_id);
  const stmtAudit = env.DB.prepare(
    "INSERT INTO audit_logs (id, actor, role, action, resource, resource_id, company_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(auditId, "Admin Central (Master)", "SUPERADMIN", `Renovou licença ${lic.license_key} por +${additionalDays} dias`, "CentralLicense", licenseId, lic.company_id, now);

  await env.DB.batch([stmtLicense, stmtCompany, stmtAudit]);

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function handleLicenseStatus(request: Request, env: Env): Promise<Response> {
  const reqData = await request.json() as any;
  const licenseId = Validator.assertString(reqData.licenseId, 'licenseId');
  const status = Validator.assertString(reqData.status, 'status');
  
  const VALID_STATUSES = new Set(['ATIVA', 'SUSPENSA', 'BLOQUEADA', 'EXPIRADA', 'TRIAL_EXPIRADA']);
  if (!VALID_STATUSES.has(status)) {
    return new Response(JSON.stringify({ error: `Status '${status}' inválido.` }), { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }

  const lic = await env.DB.prepare("SELECT * FROM licenses WHERE id = ?").bind(licenseId).first<any>();
  if (!lic) {
    return new Response(JSON.stringify({ error: "Licença não encontrada" }), { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }

  let subStatus = "ACTIVE";
  if (status === "SUSPENSA") subStatus = "UNPAID";
  else if (status === "BLOQUEADA") subStatus = "BLOCKED";
  else if (status === "EXPIRADA" || status === "TRIAL_EXPIRADA") subStatus = "TRIAL_EXPIRED";

  const now = Date.now();
  const auditId = "aud_" + crypto.randomUUID().substring(0, 8);

  const stmtLicense = env.DB.prepare("UPDATE licenses SET status = ?, subscription_status = ? WHERE id = ?").bind(status, subStatus, licenseId);
  const stmtCompany = env.DB.prepare("UPDATE companies SET license_status = ?, subscription_status = ? WHERE id = ?").bind(status, subStatus, lic.company_id);
  const stmtAudit = env.DB.prepare(
    "INSERT INTO audit_logs (id, actor, role, action, resource, resource_id, company_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(auditId, "Admin Central (Master)", "SUPERADMIN", `Alterou status da licença para ${status}`, "CentralLicense", licenseId, lic.company_id, now);

  await env.DB.batch([stmtLicense, stmtCompany, stmtAudit]);

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function handleCreatePairingCode(request: Request, env: Env): Promise<Response> {
  const reqData = await request.json() as any;
  const companyId = Validator.assertString(reqData.companyId, 'companyId');
  const deviceName = Validator.assertOptionalString(reqData.deviceName);
  const deviceType = Validator.assertOptionalString(reqData.deviceType);
  
  const company = await env.DB.prepare("SELECT * FROM companies WHERE id = ?").bind(companyId).first<any>();
  if (!company) {
    return new Response(JSON.stringify({ error: "Empresa não encontrada" }), { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }

  const license = await env.DB.prepare("SELECT * FROM licenses WHERE company_id = ? AND status = 'ATIVA'").bind(companyId).first<any>();
  if (!license) {
    return new Response(JSON.stringify({ error: "Empresa não possui licença ativa" }), { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }

  const activeDevs = await env.DB.prepare("SELECT COUNT(*) as count FROM devices WHERE company_id = ? AND pairing_status = 'PAREADO'").bind(companyId).first<any>();
  if (activeDevs.count >= license.max_devices) {
    return new Response(JSON.stringify({ error: `Limite de terminais (${license.max_devices}) atingido.` }), { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }

  // Generate cryptographically secure 6-digit pairing code
  const randomUint = new Uint32Array(1);
  crypto.getRandomValues(randomUint);
  const pairingCode = (100000 + (randomUint[0] % 900000)).toString();
  const id = "dev_" + crypto.randomUUID().substring(0, 8);
  const now = Date.now();
  const expiresAt = now + 15 * 60 * 1000; // 15 minutes pairing window

  await env.DB.prepare(
    `INSERT INTO devices (id, company_id, company_name, license_key, device_name, device_type, pairing_code, pairing_status, last_heartbeat, registered_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDENTE', ?, ?)`
  ).bind(id, companyId, company.trading_name, license.license_key, deviceName || "Terminal Checkout", deviceType || "POS", pairingCode, expiresAt, now).run();

  const auditId = "aud_" + crypto.randomUUID().substring(0, 8);
  await env.DB.prepare(
    "INSERT INTO audit_logs (id, actor, role, action, resource, resource_id, company_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(auditId, "Admin Central (Master)", "SUPERADMIN", `Gerou código de pareamento [${pairingCode}] para ${deviceName} (Expira em 15m)`, "CentralDevice", id, companyId, now).run();

  return new Response(JSON.stringify({ id, pairingCode, deviceName, deviceType, expiresAt }), {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// In-memory rate limiting map for pairing attempts per IP/code
function getClientIP(request: Request): string {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "127.0.0.1";
}

async function handleDevicePair(request: Request, env: Env): Promise<Response> {
  const ip = getClientIP(request);
  const now = Date.now();
  
  // Fetch attempt record from D1
  const attemptRecord = await env.DB.prepare("SELECT * FROM rate_limits WHERE ip = ?").bind(ip).first<{ attempts: number, locked_until: number }>();
  
  if (attemptRecord && attemptRecord.locked_until > now) {
    const waitSeconds = Math.ceil((attemptRecord.locked_until - now) / 1000);
    return new Response(JSON.stringify({ 
      success: false, 
      message: `Muitas tentativas incorretas. Terminal temporariamente bloqueado. Tente novamente em ${waitSeconds}s.` 
    }), { status: 429, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }

  const reqData = await request.json() as PairingRequest;
  const { pairingCode, hardwareFingerprint, osPlatform } = reqData;
  const dev = await env.DB.prepare("SELECT * FROM devices WHERE pairing_code = ? AND pairing_status = 'PENDENTE'").bind((pairingCode || "").trim()).first<any>();
  if (!dev) {
    // Record failed attempt
    const current = attemptRecord && attemptRecord.locked_until <= now ? attemptRecord.attempts + 1 : (attemptRecord?.attempts || 0) + 1;
    if (current >= 5) {
      const lockUntil = now + 5 * 60 * 1000; // 5 minute lock
      await env.DB.prepare("INSERT INTO rate_limits (ip, attempts, locked_until) VALUES (?, ?, ?) ON CONFLICT(ip) DO UPDATE SET attempts = excluded.attempts, locked_until = excluded.locked_until").bind(ip, 0, lockUntil).run();
    } else {
      await env.DB.prepare("INSERT INTO rate_limits (ip, attempts, locked_until) VALUES (?, ?, ?) ON CONFLICT(ip) DO UPDATE SET attempts = excluded.attempts, locked_until = excluded.locked_until").bind(ip, current, 0).run();
    }
    return new Response(JSON.stringify({ success: false, message: "Código de pareamento inválido ou expirado." }), { headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }

  // Check 15-minute expiration
  if (dev.last_heartbeat && dev.last_heartbeat < now) {
    await env.DB.prepare("UPDATE devices SET pairing_status = 'EXPIRADO', pairing_code = NULL WHERE id = ?").bind(dev.id).run();
    return new Response(JSON.stringify({ success: false, message: "Código de pareamento expirou. Solicite um novo código na Central." }), { headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }

  // Clear failed attempts on success
  await env.DB.prepare("DELETE FROM rate_limits WHERE ip = ?").bind(ip).run();

  const license = await env.DB.prepare("SELECT * FROM licenses WHERE license_key = ? AND status = 'ATIVA'").bind(dev.license_key).first<any>();
  if (!license) {
    return new Response(JSON.stringify({ success: false, message: "A licença vinculada a este dispositivo não está ativa." }), { headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }

  const syncToken = "stok_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const syncTokenHash = await sha256Hex(syncToken);

  // Atomic D1 batch execution for device pairing confirmation
  const stmtDevice = env.DB.prepare(
    `UPDATE devices SET hardware_fingerprint = ?, pairing_status = 'PAREADO', pairing_code = NULL, last_heartbeat = ?, is_online = 1, os_platform = ?, sync_token = NULL, sync_token_hash = ? WHERE id = ?`
  ).bind(hardwareFingerprint || "hw_" + crypto.randomUUID().substring(0, 8), now, osPlatform || "Web", syncTokenHash, dev.id);

  // Recalculate terminal counts
  const companyId = dev.company_id;
  const activeDevs = await env.DB.prepare("SELECT COUNT(*) as count FROM devices WHERE company_id = ? AND pairing_status = 'PAREADO' AND id != ?").bind(companyId, dev.id).first<any>();
  const totalCount = (activeDevs?.count || 0) + 1;

  const stmtCompany = env.DB.prepare("UPDATE companies SET terminals_count = ? WHERE id = ?").bind(totalCount, companyId);
  const stmtLicense = env.DB.prepare("UPDATE licenses SET active_devices_count = ? WHERE id = ?").bind(totalCount, license.id);

  const auditId = "aud_" + crypto.randomUUID().substring(0, 8);
  const stmtAudit = env.DB.prepare(
    "INSERT INTO audit_logs (id, actor, role, action, resource, resource_id, company_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(auditId, "Admin Central (Master)", "SUPERADMIN", `Dispositivo ${dev.device_name} pareado com sucesso`, "CentralDevice", dev.id, companyId, now);

  await env.DB.batch([stmtDevice, stmtCompany, stmtLicense, stmtAudit]);

  // Load allowed modules from license
  const allowedModules = JSON.parse(license.allowed_modules || "[]");

  return new Response(JSON.stringify({ 
    success: true, 
    device: { ...dev, pairing_status: "PAREADO", sync_token: syncToken }, 
    license: { ...license, allowedModules }, 
    syncToken 
  }), {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function handleRevokeDevice(request: Request, env: Env): Promise<Response> {
  const reqData = await request.json() as any;
  const deviceId = Validator.assertString(reqData.deviceId, 'deviceId');
  const dev = await env.DB.prepare("SELECT * FROM devices WHERE id = ?").bind(deviceId).first<any>();
  if (!dev) {
    return new Response(JSON.stringify({ error: "Dispositivo não encontrado" }), { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }

  const activeDevs = await env.DB.prepare("SELECT COUNT(*) as count FROM devices WHERE company_id = ? AND pairing_status = 'PAREADO' AND id != ?").bind(dev.company_id, deviceId).first<any>();
  const newCount = Math.max(0, activeDevs?.count || 0);

  const now = Date.now();
  const auditId = "aud_" + crypto.randomUUID().substring(0, 8);

  const stmtDevice = env.DB.prepare("UPDATE devices SET pairing_status = 'REVOGADO', is_online = 0 WHERE id = ?").bind(deviceId);
  const stmtCompany = env.DB.prepare("UPDATE companies SET terminals_count = ? WHERE id = ?").bind(newCount, dev.company_id);
  const stmtLicense = env.DB.prepare("UPDATE licenses SET active_devices_count = ? WHERE company_id = ?").bind(newCount, dev.company_id);
  const stmtAudit = env.DB.prepare(
    "INSERT INTO audit_logs (id, actor, role, action, resource, resource_id, company_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(auditId, "Admin Central (Master)", "SUPERADMIN", `Revogou autorização do terminal ${deviceId}`, "CentralDevice", deviceId, dev.company_id, now);

  await env.DB.batch([stmtDevice, stmtCompany, stmtLicense, stmtAudit]);

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function handleAuditLog(request: Request, env: Env): Promise<Response> {
  const reqData = await request.json() as any;
  const action = Validator.assertString(reqData.action, 'action');
  const resource = Validator.assertString(reqData.resource, 'resource');
  const resourceId = Validator.assertString(reqData.resourceId, 'resourceId');
  const companyId = Validator.assertOptionalString(reqData.companyId);
  const id = "aud_" + crypto.randomUUID().substring(0, 8);
  const now = Date.now();

  await env.DB.prepare(
    "INSERT INTO audit_logs (id, actor, role, action, resource, resource_id, company_id, timestamp) VALUES (?, 'Dispositivo', 'TERMINAL', ?, ?, ?, ?, ?)"
  ).bind(id, action, resource, resourceId, companyId || null, now).run();

  return new Response(JSON.stringify({ success: true, id }), {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// --- SYNC BATCH & PULL ENDPOINTS ---

async function handleSyncBatch(request: Request, env: Env): Promise<Response> {
  const clientTenantId = request.headers.get("X-Tenant-Id");
  const authHeader = request.headers.get("Authorization");
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;

  if (!token) {
    return new Response(JSON.stringify({ error: "Não autorizado: Authorization Bearer token do terminal é obrigatório para sincronização." }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  // Zero-Trust: Resolve device and authoritative tenant from cryptographic token hash
  const tokenHash = await sha256Hex(token);
  const matchedDevice = await env.DB.prepare(
    "SELECT id, company_id FROM devices WHERE pairing_status = 'PAREADO' AND sync_token_hash = ?"
  ).bind(tokenHash).first<any>();

  if (!matchedDevice) {
    return new Response(JSON.stringify({ error: "Não autorizado: Credencial de dispositivo inválida ou revogada pela Central." }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const tenantId = matchedDevice.company_id;
  if (clientTenantId && clientTenantId !== tenantId) {
    return new Response(JSON.stringify({ error: "Não autorizado: Incompatibilidade entre tenant do token e header X-Tenant-Id." }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const { mutations } = await request.json() as { mutations: SyncMutation[] };
  if (!mutations || !Array.isArray(mutations)) {
    return new Response(JSON.stringify({ error: "Mutações inválidas" }), { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }

  if (mutations.length > 200) {
    return new Response(JSON.stringify({ error: "Lote de mutações excede o limite máximo permitido de 200 itens por requisição." }), { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }

  const ALLOWED_ENTITY_TYPES = new Set([
    'PRODUCT', 'SALE', 'CASH_SESSION', 'TABLE_ORDER', 'STOCK_MOVEMENT',
    'CUSTOMER', 'FINANCIAL_TRANSACTION', 'AUDIT_LOG', 'COMPANY_SETTINGS',
    'SUPPLIER', 'PURCHASE_ORDER', 'DELIVERY', 'SERVICE_ORDER',
    'CONTRACTED_SERVICE', 'CRM_LEAD', 'LOYALTY_MEMBER', 'LOYALTY_REWARD',
    'LOYALTY_VOUCHER', 'MANUFACTURING_ORDER', 'PROJECT_TASK',
    'WHATSAPP_TEMPLATE', 'HARDWARE_DEVICE', 'OPERATOR'
  ]);

  const processedIds: string[] = [];
  const blockedIds: string[] = [];

  for (const m of mutations) {
    if (!m.entityType || !ALLOWED_ENTITY_TYPES.has(m.entityType.toUpperCase())) {
      console.warn(`[Worker Sync] Mutação rejeitada: tipo '${m.entityType}' fora da whitelist permitida.`);
      continue;
    }

    // 1. Idempotency Check
    const exists = await env.DB.prepare("SELECT id FROM mutations WHERE id = ?").bind(m.id).first<any>();
    if (exists) {
      processedIds.push(m.id);
      continue;
    }

    const tableName = m.entityType;
    const entityId = m.entityId;
    const key = `${tenantId}:${tableName}:${entityId}`;

    // P0 FIX: RBAC Check (Server-Side Trust)
    const operatorId = (m as any).operatorId;
    if (m.operation === 'DELETE' && ['PRODUCT', 'COMPANY_SETTINGS', 'OPERATOR'].includes(tableName)) {
      if (operatorId) {
        const opKey = `${tenantId}:OPERATOR:${operatorId}`;
        const opRecord = await env.DB.prepare("SELECT payload FROM tenant_records WHERE id = ?").bind(opKey).first<any>();
        if (opRecord) {
          const opPayload = JSON.parse(opRecord.payload);
          if (opPayload.role === 'CASHIER' || opPayload.role === 'WAITER') {
            console.warn(`[Worker Sync] Blocked DELETE ${tableName} for operator ${operatorId} (${opPayload.role})`);
            blockedIds.push(m.id);
            continue;
          }
        }
      } else {
        // No operator identified: deny delete for critical tables
        console.warn(`[Worker Sync] Blocked DELETE ${tableName} because operatorId is missing`);
        blockedIds.push(m.id);
        continue;
      }
    }

    // 2. Conflict Resolution & Delta Reconciliation
    const existing = await env.DB.prepare("SELECT payload, server_updated_at FROM tenant_records WHERE id = ?").bind(key).first<any>();
    let payloadToApply = { ...m.payload };

    // Prevent double-counting of inventory: if PRODUCT mutation arrives, preserve the server authoritative stock calculated from STOCK_MOVEMENT events
    if (tableName === "PRODUCT" && existing) {
      const serverPayload = JSON.parse(existing.payload);
      payloadToApply.stock = typeof serverPayload.stock === "number" ? serverPayload.stock : (Number(serverPayload.stock) || 0);
    }

    if (existing && existing.server_updated_at > m.timestamp) {
      const serverPayload = JSON.parse(existing.payload);
      if (tableName === "PRODUCT") {
        payloadToApply = {
          ...m.payload,
          stock: typeof serverPayload.stock === "number" ? serverPayload.stock : (Number(serverPayload.stock) || 0), // Preserve server stock level
        };
      } else if (tableName === "CUSTOMER") {
        payloadToApply = {
          ...m.payload,
          currentDebt: serverPayload.currentDebt, // Preserve server debt level
        };
      } else {
        // Last-Write-Wins blocks client mutation
        blockedIds.push(m.id);
        continue;
      }
    }

    // 3. Apply changes to tenant_records (Simulated Cloud Replica)
    const now = Date.now();
    if (m.operation === "CREATE" || m.operation === "UPDATE") {
      // Delta Business Effects for Inventory / Stocks
      if (tableName === "STOCK_MOVEMENT") {
        const prodKey = `${tenantId}:PRODUCT:${m.payload.productId}`;
        const prodRecord = await env.DB.prepare("SELECT payload FROM tenant_records WHERE id = ?").bind(prodKey).first<any>();
        if (prodRecord) {
          const prodPayload = JSON.parse(prodRecord.payload);
          const qty = Number(m.payload.quantity) || 0;
          const type = m.payload.type;
          if (type === "ENTRADA" || type === "AJUSTE_POSITIVO") {
            prodPayload.stock = (Number(prodPayload.stock) || 0) + qty;
          } else if (type === "SAIDA_VENDA" || type === "AJUSTE_NEGATIVO" || type === "PERDA") {
            prodPayload.stock = (Number(prodPayload.stock) || 0) - qty;
          }
          await env.DB.prepare("UPDATE tenant_records SET payload = ?, server_updated_at = ? WHERE id = ?")
            .bind(JSON.stringify(prodPayload), now, prodKey).run();
        }
      }

      // P1 FIX: Cash Session aggregation on Server
      if (tableName === "CASH_MOVEMENT") {
        const sessionKey = `${tenantId}:CASH_SESSION:${m.payload.sessionId}`;
        const sessionRecord = await env.DB.prepare("SELECT payload FROM tenant_records WHERE id = ?").bind(sessionKey).first<any>();
        if (sessionRecord) {
          const sessionPayload = JSON.parse(sessionRecord.payload);
          const amount = Number(m.payload.amount) || 0;
          const type = m.payload.type;
          
          if (!sessionPayload.movements) sessionPayload.movements = [];
          const exists = sessionPayload.movements.some((x: any) => x.id === m.payload.id);
          if (!exists) {
            sessionPayload.movements.push(m.payload);
            if (type === 'SUPRIMENTO' || type === 'ABERTURA' || type === 'VENDA' || type === 'PAGAMENTO_FIADO') {
              sessionPayload.finalCashCalculated = (Number(sessionPayload.finalCashCalculated) || Number(sessionPayload.initialCash) || 0) + amount;
            } else if (type === 'SANGRIA') {
              sessionPayload.finalCashCalculated = (Number(sessionPayload.finalCashCalculated) || Number(sessionPayload.initialCash) || 0) - amount;
            }
            await env.DB.prepare("UPDATE tenant_records SET payload = ?, server_updated_at = ? WHERE id = ?")
              .bind(JSON.stringify(sessionPayload), now, sessionKey).run();
          }
        }
      }

      await env.DB.prepare(
        "INSERT OR REPLACE INTO tenant_records (id, tenant_id, table_name, entity_id, payload, server_updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(key, tenantId, tableName, entityId, JSON.stringify(payloadToApply), now).run();
    } else if (m.operation === "DELETE") {
      await env.DB.prepare("DELETE FROM tenant_records WHERE id = ?").bind(key).run();
    }

    // 4. Log sync mutation
    await env.DB.prepare(
      "INSERT INTO mutations (id, tenant_id, entity_type, entity_id, operation, payload, timestamp, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(m.id, tenantId, tableName, entityId, m.operation, JSON.stringify(payloadToApply), m.timestamp, now).run();

    processedIds.push(m.id);
  }

  return new Response(JSON.stringify({ success: true, processedIds, blockedIds }), {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function handleSyncPull(request: Request, env: Env): Promise<Response> {
  const clientTenantId = request.headers.get("X-Tenant-Id");
  const url = new URL(request.url);
  const lastSyncedAt = Number(url.searchParams.get("lastSyncedAt")) || 0;
  const lastId = url.searchParams.get("lastId") || "";

  const authHeader = request.headers.get("Authorization");
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;

  if (!token) {
    return new Response(JSON.stringify({ error: "Não autorizado: Authorization Bearer token de dispositivo é obrigatório para pull de sincronização." }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  // Zero-Trust: Resolve device and authoritative tenant from cryptographic token hash
  const tokenHash = await sha256Hex(token);
  const matchedDevice = await env.DB.prepare(
    "SELECT id, company_id FROM devices WHERE pairing_status = 'PAREADO' AND sync_token_hash = ?"
  ).bind(tokenHash).first<any>();

  if (!matchedDevice) {
    return new Response(JSON.stringify({ error: "Não autorizado: Token de sincronização inválido ou revogado pela Central." }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const tenantId = matchedDevice.company_id;
  if (clientTenantId && clientTenantId !== tenantId) {
    return new Response(JSON.stringify({ error: "Não autorizado: Incompatibilidade entre tenant do token e header X-Tenant-Id." }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const results = await env.DB.prepare("SELECT * FROM mutations WHERE tenant_id = ? AND (synced_at > ? OR (synced_at = ? AND id > ?)) ORDER BY synced_at ASC, id ASC")
    .bind(tenantId, lastSyncedAt, lastSyncedAt, lastId).all<any>();

  const mutations = results.results.map((m: any) => ({
    id: m.id,
    entityType: m.entity_type,
    entityId: m.entity_id,
    operation: m.operation,
    payload: JSON.parse(m.payload),
    timestamp: m.timestamp,
    syncedAt: m.synced_at
  }));

  return new Response(JSON.stringify({
    success: true,
    mutations,
    currentTimestamp: Date.now()
  }), {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

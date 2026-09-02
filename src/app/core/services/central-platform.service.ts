import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { IdGeneratorService } from './id-generator.service';
import { 
  CentralAccount, 
  CentralCompany, 
  CentralPlan, 
  CentralLicense, 
  CentralDevice, 
  CentralAuditLog, 
  CentralVersion 
} from '../models';

@Injectable({ providedIn: 'root' })
export class CentralPlatformService {
  private idGen = inject(IdGeneratorService);
  private platformId = inject(PLATFORM_ID);
  // Central Authority State
  readonly accounts = signal<CentralAccount[]>([]);
  readonly companies = signal<CentralCompany[]>([]);
  readonly plans = signal<CentralPlan[]>([]);
  readonly licenses = signal<CentralLicense[]>([]);
  readonly devices = signal<CentralDevice[]>([]);
  readonly auditLogs = signal<CentralAuditLog[]>([]);
  readonly versions = signal<CentralVersion[]>([]);
  readonly activeAdminAccount = signal<CentralAccount | null>(null);

  // Authentication State
  readonly isAuthenticated = signal<boolean>(false);
  readonly adminUser = signal<{ username: string; role: string } | null>(null);
  private token: string | null = null;

  // Computed Telemetry
  readonly totalCompanies = computed(() => this.companies().length);
  readonly activeCompanies = computed(() => this.companies().filter(c => c.licenseStatus === 'ATIVA').length);
  readonly activeLicenses = computed(() => this.licenses().filter(l => l.status === 'ATIVA').length);
  readonly onlineDevices = computed(() => this.devices().filter(d => d.isOnline && d.pairingStatus === 'PAREADO').length);
  readonly totalDevices = computed(() => this.devices().length);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadSession();
      this.initCentralStore();
    }
  }

  private loadSession() {
    if (isPlatformBrowser(this.platformId)) {
      this.token = sessionStorage.getItem('3eatcru_central_token');
      const savedUser = sessionStorage.getItem('3eatcru_central_user');
      if (this.token && savedUser) {
        this.isAuthenticated.set(true);
        this.adminUser.set(JSON.parse(savedUser));
      }
    }
  }

  async login(username: string, password: string): Promise<boolean> {
    try {
      const res = await fetch('/api/central/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const data = await res.json();
        this.token = data.token;
        this.isAuthenticated.set(true);
        this.adminUser.set(data.user);
        if (isPlatformBrowser(this.platformId)) {
          sessionStorage.setItem('3eatcru_central_token', data.token);
          sessionStorage.setItem('3eatcru_central_user', JSON.stringify(data.user));
        }
        await this.refreshData();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Erro ao efetuar login na Central:', err);
      return false;
    }
  }

  logout(): void {
    this.token = null;
    this.isAuthenticated.set(false);
    this.adminUser.set(null);
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.removeItem('3eatcru_central_token');
      sessionStorage.removeItem('3eatcru_central_user');
    }
    // Clear lists on logout
    this.accounts.set([]);
    this.companies.set([]);
    this.licenses.set([]);
    this.devices.set([]);
    this.auditLogs.set([]);
  }

  private getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...extraHeaders };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async initCentralStore(): Promise<void> {
    if (this.isAuthenticated()) {
      await this.refreshData();
    }
  }

  async refreshData(): Promise<void> {
    if (!this.isAuthenticated()) return;
    try {
      const res = await fetch('/api/central/data', {
        headers: this.getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        this.accounts.set(data.accounts || []);
        this.companies.set(data.companies || []);
        this.plans.set(data.plans || []);
        this.licenses.set(data.licenses || []);
        this.devices.set(data.devices || []);
        this.auditLogs.set(data.auditLogs || []);
        this.versions.set(data.versions || []);
      }
    } catch (err) {
      console.warn('Falha ao sincronizar com servidor Central remoto:', err);
    }
  }

  // ========================================================
  // 1. GESTÃO DE CONTAS (PROPRIETÁRIOS / ASSINANTES)
  // ========================================================

  async createAccount(name: string, email: string, phone: string, role: 'SUPERADMIN' | 'ACCOUNT_OWNER' = 'ACCOUNT_OWNER'): Promise<CentralAccount> {
    const res = await fetch('/api/central/accounts', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name, email, phone, role })
    });
    const acc = await res.json();
    await this.refreshData();
    return acc;
  }

  async toggleAccountStatus(accountId: string): Promise<void> {
    await fetch('/api/central/accounts/toggle', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ accountId })
    });
    await this.refreshData();
  }

  // ========================================================
  // 2. GESTÃO DE EMPRESAS (TENANTS)
  // ========================================================

  async createCompany(params: {
    accountId: string;
    ownerName: string;
    name: string;
    tradingName: string;
    cnpj: string;
    phone: string;
    city: string;
    state: string;
    planId: string;
  }): Promise<{ company: CentralCompany; license: CentralLicense }> {
    const res = await fetch('/api/central/companies', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(params)
    });
    const data = await res.json();
    await this.refreshData();
    return data;
  }

  // ========================================================
  // 3. GESTÃO DE LICENÇAS
  // ========================================================

  generateLicenseKey(): string {
    const part1 = this.idGen.generateUUID().substring(0, 4).toUpperCase();
    const part2 = this.idGen.generateUUID().substring(9, 13).toUpperCase();
    const part3 = this.idGen.generateUUID().substring(14, 18).toUpperCase();
    return `3EC-${part1}-${part2}-${part3}`;
  }

  async renewLicense(licenseId: string, additionalDays = 365): Promise<void> {
    await fetch('/api/central/licenses/renew', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ licenseId, additionalDays })
    });
    await this.refreshData();
  }

  async setLicenseStatus(licenseId: string, status: 'ATIVA' | 'SUSPENSA' | 'BLOQUEADA'): Promise<void> {
    await fetch('/api/central/licenses/status', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ licenseId, status })
    });
    await this.refreshData();
  }

  // ========================================================
  // 4. GESTÃO DE DISPOSITIVOS & PAREAMENTO (DEVICE ACTIVATION)
  // ========================================================

  /**
   * Generates a 6-digit pairing code in Central for a company so an OS terminal can pair.
   */
  async generateDevicePairingCode(companyId: string, deviceName: string, deviceType: 'PDV' | 'CAIXA' | 'GERENCIA' | 'GARCOM_MOBILE' | 'KDS_COZINHA'): Promise<CentralDevice> {
    const res = await fetch('/api/central/devices/pairing-code', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ companyId, deviceName, deviceType })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao gerar pareamento');
    }
    const dev = await res.json();
    await this.refreshData();
    return dev;
  }

  /**
   * Called by an OS terminal to activate using a 6-digit pairing code or direct License Key.
   */
  async pairDeviceWithCode(pairingCode: string, hardwareFingerprint: string, osPlatform = 'Web'): Promise<{ success: boolean; device?: CentralDevice; license?: CentralLicense; syncToken?: string; message?: string }> {
    const res = await fetch('/api/central/devices/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairingCode, hardwareFingerprint, osPlatform })
    });
    const data = await res.json();
    await this.refreshData();
    return data;
  }

  /**
   * Revoke or Block a Device remotely from Central.
   */
  async revokeDevice(deviceId: string): Promise<void> {
    await fetch('/api/central/devices/revoke', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ deviceId })
    });
    await this.refreshData();
  }

  // ========================================================
  // 5. AUDITORIA CENTRAL
  // ========================================================

  async logCentralAudit(action: string, resource: string, resourceId: string, companyId?: string): Promise<void> {
    await fetch('/api/central/audit', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ action, resource, resourceId, companyId })
    });
    await this.refreshData();
  }
}

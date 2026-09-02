# 3eatcru OS — Sistema Operacional Comercial & ERP Offline-First

Plataforma operacional comercial completa desenvolvida em **Angular 21 (Zoneless)**, **Tailwind CSS 4**, arquitetura **Offline-First com Dexie / IndexedDB**, motor transacional ACID, sincronização bidirecional idempotente, interface multijanelas Desktop e microsserviço serverless em **Cloudflare Workers com D1 SQL**.

---

## 🏛️ Visão Geral da Arquitetura

O ecossistema **3eatcru OS** é estruturado em camadas desacopladas com isolamento estrito de responsabilidades:

1. **Kernel & Core (`/src/app/core/`)**:
   - `AppRegistry`: Catálogo reativo de manifestos e módulos de negócio carregados dinamicamente via `loadComponent()`, sem acoplamento estático no Core.
   - `WindowManagerService`: Gerenciador de janelas com stacking Z-index, minimização, redimensionamento, foco e contenção de limites.
   - `OSContext`: Barramento canônico de banco de dados, repositórios tipados (`Repository<T>`), eventos de domínio (`DomainEvent<T>`) e controle de acesso RBAC (`PermissionAPI`).
   - `DexieDatabaseAdapter` / `AppDexieDb`: Segregação física entre banco da plataforma (`3eatcru_os_db`) e banco de negócios (`3eatcru_business_db`), com isolamento SSR seguro via `isPlatformBrowser(this.platformId)`.
   - `TransactionEngine`: Coordenação transacional atômica com garantia ACID e rollback em operações de vendas, estoque, caixa, compras, recebimento, fabricação e fiado (crédito). Atribuição multi-tenant mandatória (`companyId = currentCompanyId`).
   - `SyncOutboxService`: Motor de sincronização offline-first com fila Outbox sequencial, retries exponenciais e pull incremental com proteção de deltas locais pendentes.
   - `CentralPlatformService`: Gestão autoritativa de contas, empresas, planos, licenças e geração de códigos de pareamento de dispositivos de 6 dígitos.

2. **Shell Desktop (`/src/app/shell/`)**:
   - Interface desktop multijanelas com barra de tarefas, menu de aplicativos com busca em tempo real, central de notificações, bloqueio/troca de operador por PIN (PBKDF2-HMAC-SHA256) e Setup Wizard integrado à Central.

3. **Módulos de Negócio (`/src/app/modules/`)**:
   - 20 módulos de domínio independentes: PDV, Caixa, Estoque, Compras, Clientes (CRM), Fidelidade, Delivery, Cardápio Digital, Mesas (Restaurante), Fornecedores, Funcionários, Fabricação/Produção, Serviços, Fiscal/NFC-e, Relatórios/BI, Configurações, etc.
   - Todas as operações de escrita delegadas à `TransactionEngine` com validação de regras de negócio e integridade de dados.

4. **Central & Cloud Edge (`/cloudflare-worker/` e `server.ts`)**:
   - Microsserviço serverless em Cloudflare Workers com banco relacional Cloudflare D1 SQL.
   - Rate limiting persistido em tabela D1 (`rate_limits`), tokens de sessão assinados via HMAC-SHA256, whitelist de entidades sincronizáveis e pareamento criptográfico seguro.
   - Fallback de desenvolvimento local com Express Server-Side Rendering integrado em `server.ts`.

---

## 🛡️ Garantias de Segurança & Integridade

- **Segurança Criptográfica**: Derivação de PIN com PBKDF2-HMAC-SHA256 (10.000 iterações) + Salt dinâmico por dispositivo, bloqueio temporário de 30s após 5 falhas e log de auditoria append-only.
- **Transações ACID**: Operações de negócio (Venda + Estoque + Caixa + Fiado + Auditoria + Outbox) unificadas no `BusinessDb` com rollback atômico.
- **Sincronização Idempotente**: Algoritmo `pullNow()` protegido contra sobrescrita de mutações locais pendentes e cursor temporal determinístico.
- **Multi-Tenant Inviolável**: Injeção forçada de `companyId` no nível de engine transacional e validação de token de dispositivo no Edge.
- **Formulários Reativos & Zoneless**: 100% dos módulos utilizam `ReactiveFormsModule` ou ligações de signals (`[value]` / `(input)`), sem dependência de `FormsModule` / `ngModel`.

---

## 🚀 Execução, Build e Testes

```bash
# Instalação de dependências
npm install

# Executar em modo de desenvolvimento (Porta 3000)
npm run dev

# Análise de lint e integridade de código
npm run lint

# Execução de testes unitários automatizados (Vitest)
npx vitest run

# Compilação de produção (AOT / SSR)
npm run build
```

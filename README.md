# 3eatcru OS — Sistema Operacional Comercial & ERP Offline-First

Plataforma operacional completa e moderna desenvolvida com **Angular 21 (Zoneless)**, **Tailwind CSS 4**, arquitetura **Offline-First com Dexie/IndexedDB**, motor transacional ACID, sincronização bidirecional idempotente e suporte a **Cloudflare Workers com D1 SQL**.

---

## 🏛️ Visão Geral da Arquitetura

O ecossistema **3eatcru OS** é estruturado em camadas rigorosamente desacopladas:

1. **Kernel & Core (`/src/app/core/`)**:
   - `AppRegistry`: Catálogo reativo de manifestos e módulos de negócio dinamicamente carregáveis.
   - `WindowManagerService`: Gerenciador de janelas com stacking Z-index, minimização, redimensionamento e foco.
   - `OSContext`: Barramento canônico de banco, repositórios tipados, eventos de domínio e permissões RBAC.
   - `DexieDatabaseAdapter`: Isolamento entre armazenamento da plataforma (`3eatcru_os_db`) e de negócio (`3eatcru_business_db`).
   - `TransactionEngine`: Coordenação transacional atômica com garantia ACID e rollback em operações de vendas, estoque e caixa.
   - `SyncOutboxService`: Motor de sincronização offline-first com fila Outbox sequencial, retries exponenciais e pull incremental com proteção de deltas locais.

2. **Shell Desktop (`/src/app/shell/`)**:
   - Interface desktop multijanelas com barra de tarefas, menu de aplicativos, central de notificações e controle de sessão por operador.

3. **Módulos de Negócio (`/src/app/modules/`)**:
   - 20 módulos de domínio (PDV, Caixa, Estoque, Compras, Clientes, CRM, Fidelidade, Delivery, Cardápio, Mesas, Fornecedores, etc.).

4. **Central & Cloud Edge (`/cloudflare-worker/` e `server.ts`)**:
   - Microsserviço serverless em Cloudflare Workers com banco relacional Cloudflare D1.
   - Autenticação por HMAC-SHA256, expiração de tokens e pareamento criptográfico seguro.

---

## 🛡️ Fases de Hardening Concluídas

- **Segurança**: Eliminação de fallbacks inseguros, rate limiting com bloqueio temporário (lockout de 30s após 5 falhas no PIN), tokens de sessão HMAC-SHA256 e Web Crypto para códigos de ativação.
- **Transações ACID**: Unificação das tabelas operacionais no `BusinessDb`, permitindo rollback transacional no Dexie/IndexedDB.
- **Sincronização Segura**: Algoritmo `pullNow()` protegido contra sobrescrita de mutações locais pendentes.
- **RBAC**: Governança granular de permissões com `PermissionAPI` e validações em nível de domínio.

---

## 🚀 Execução e Desenvolvimento

```bash
# Instalar dependências
npm install

# Executar em modo de desenvolvimento (Porta 3000)
npm run dev

# Validação de código e integridade arquitetural
npm run lint

# Compilação de produção
npm run build
```

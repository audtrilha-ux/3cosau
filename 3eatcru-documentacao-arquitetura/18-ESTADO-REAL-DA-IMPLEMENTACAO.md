# Estado Real da Implementação — Relatório de Auditoria Técnica

Este documento registra o diagnóstico detalhado e factual do código-fonte atual do projeto **3eatcru OS**, mapeando acoplamentos físicos, estruturas de dados monolíticas, organização de serviços e débitos técnicos críticos encontrados durante a auditoria sênior sênior.

---

## 🏛️ 1. Estrutura Física do Projeto
A implementação atual reside em uma aplicação monolítica estruturada no framework **Angular 21 (Zoneless)**, contendo um servidor Express integrado em `server.ts` que atua concorrentemente como mecanismo de Server-Side Rendering (SSR) e backend de APIs locais de simulação.

---

## 🚧 2. Diagnóstico de Acoplamento e Resolução de Dívidas Técnicas

### A. Desacoplamento Físico Total no `AppRegistry` e `DesktopShell` (Fronteira OS vs. Apps) — RESOLVIDO
A segregação entre o OS e as aplicações de negócio foi finalizada em conformidade com o padrão de Registry e Manifesto de Plugins:
*   `src/app/core/services/app-registry.ts`: É um serviço reativo puro da plataforma Core (`@Injectable({ providedIn: 'root' })`). Ele expõe métodos `registerApp()`, `registerApps()`, `unregisterApp()` e o sinal reativo `apps = signal<AppManifest[]>([])`. **Não possui nenhuma importação de módulos de negócio**.
*   `src/app/modules/manifests.ts`: Reside exclusivamente no domínio de módulos/aplicações (`/modules/`) e declara os manifestos dos aplicativos de negócio com seus carregadores dinâmicos (`loadComponent: () => import('./...')`).
*   `src/app/app.config.ts`: Atua como Composition Root da aplicação, injetando `AppRegistry` através de `ENVIRONMENT_INITIALIZER` para registrar os manifestos de negócio na inicialização, preservando a pureza de compilação do Core e do Shell.
*   `WindowContainerComponent` (`ngComponentOutlet`): Renderiza os componentes dinamicamente a partir dos manifestos registrados.
*   Regra ESLint `no-restricted-imports`: Garante em tempo de build que nenhum arquivo sob `/core/` ou `/shell/` importe arquivos de `/modules/`.

### B. Segregação Física de Armazenamento no `DexieDB` (Platform DB vs. Business DB) — IMPLEMENTADO
O arquivo `src/app/core/storage/dexie.db.ts` implementa uma arquitetura de banco particionado:
*   O banco da plataforma (`3eatcru_os_db`) contém estritamente as 5 tabelas do sistema: `companySettings`, `operators`, `outbox`, `auditLogs` e `hardwareDevices`.
*   O banco unificado de negócios (`3eatcru_business_db`) agrupa as tabelas operacionais do ERP (`sales`, `products`, `stockMovements`, `customers`, `cashSessions`, `financialTransactions`, etc.).
*   **Atomicidade ACID**: O `TransactionEngine` opera exclusivamente dentro dos limites transacionais do `3eatcru_business_db` para garantir rollback completo de vendas, estoque, caixa e outbox operacional sem conflitos cross-database no IndexedDB.
*   A função `createAppDatabase()` está pronta para a migração futura de apps com bancos inteiramente independentes (fase de plugins distribuídos).

---

## 🛠️ 3. Mapeamento de Serviços e Infraestrutura

### A. Serviços Nativos do OS (Core)
*   `WindowManagerService` (`src/app/core/window-manager.service.ts`): Gerenciador de janelas robusto e performático. Controla foco, tamanho, empilhamento (Z-index), abertura, minimização e fechamento de janelas na área de trabalho.
*   `AppRegistry` (`src/app/core/services/app-registry.ts`): Catálogo dinâmico de manifesto e componentes de aplicações com suporte a carregamento desacoplado.
*   `SyncOutboxService` (`src/app/core/sync/sync-outbox.service.ts`): Motor de sincronização que controla a fila sequencial outbox, transmissão sequencial em lotes, idempotência, pull incremental com cursor em localStorage e resolução de conflitos por deltas matemáticos.
*   `AppContextService` (`src/app/core/services/app-context.service.ts`): Controla o ciclo de vida do terminal operacional (se configurado, se bloqueado por PIN, tempo restante do Trial e dados cadastrais da empresa).

### B. Edge Cloudflare Workers & D1 Relacional
*   `/cloudflare-worker/`: Base de código serverless completa em TypeScript com `wrangler.toml`, `schema.sql` e `src/index.ts`, implementando controle de licenças, pareamento por código de 6 dígitos e engine de sincronismo bidirecional em D1.

---

## 🧪 4. Cobertura de Testes e Validação Arquitetural
*   `sync-outbox.service.spec.ts`: Valida o empacotamento de mensagens, tratamento de status de rede, retransmissões automáticas de falhas temporárias de rede e consolidação de mutações.
*   `transaction.engine.spec.ts`: Garante a atomicidade transacional local. Valida que as reduções de estoque, fluxo financeiro de caixa, faturamento de vendas e fila de sincronização outbox ocorram de forma conjunta ou sofram rollback íntegro em caso de falhas de gravação.
*   **Regras ESLint Automatizadas**: Bloqueio de importações proibidas entre camadas do sistema.

---

## 🧹 5. Limpeza de Scripts de Patches Legados — CONCLUÍDO
Todos os arquivos legados temporários (`patch_*.py`, `fix_*.py`, `update_*.py`) foram auditados, consolidados e permanentemente removidos da raiz do repositório, deixando o projeto 100% limpo e pronto para produção.

### C. Segurança Transacional e Criptográfica (Hardening P0/P1) — RESOLVIDO
A última auditoria (Auditoria Senior Pro) apontou vulnerabilidades que foram plenamente mitigadas:
*   **Cursor Determinístico de Pull Sync**: Resolvido o risco de perda de mutações no mesmo timestamp. O motor agora utiliza cursores duplos (`synced_at` + `mutation_id`).
*   **Type-Safety Absoluto no Transaction Engine**: Parâmetros vulneráveis de autoria (`customOperatorName`) foram removidos. As funções transacionais (`saveProduct`, `saveOperator`, etc.) exigem DTOs estritos e validam a identidade via OS Context.
*   **Tenant Isolation em IndexedDB**: Consultas em tabelas compartilhadas no `3eatcru_business_db` agora aplicam filtros obrigatórios por `companyId` e `locationId`.
*   **Segurança de Pareamento (Sync Token Hash)**: O `syncToken` do Cloudflare Worker não é mais armazenado em texto puro. O banco D1 armazena e verifica apenas o Hash `SHA-256`.
*   **Token no HQ Web**: Movido do `localStorage` para `sessionStorage` mitigando a superfície de ataques XSS na área de gestão central.

# Roadmap de Evolução Técnica e Arquitetural

Este documento detalha o histórico de progresso técnico do ecossistema e estabelece o cronograma de sprints planejadas para a modularização estrita e mitigação de débitos arquiteturais identificados.

---

## 🗺️ Progresso das Sprints

### 🟢 Sprint 1 (Concluída - Segurança, Licenciamento & PIN)
*   **Segurança Criptográfica Física:** Implementação do PBKDF2-HMAC-SHA256 para derivação local de senhas de operadores no navegador.
*   **Autoridade de Licenciamento na Central:** Integração das chamadas de validação e ativação contra os endpoints reais de banco de licenças em nuvem.
*   **Proteção de Tenant:** Bloqueio de forjamento de IDs com a exigência obrigatória do `syncToken` pareado e assinado de forma única por dispositivo.

### 🟢 Sprint 2 (Concluída - Idempotência & Sincronismo Bidirecional)
*   **Sincronismo Bidirecional Incremental:** Implementação da lógica de recebimento e cursor de tempo local (Pull Sync `/api/sync/pull`).
*   **Idempotência no Servidor:** Deduplicação e bloqueio de retransmissões redundantes na API.
*   **Reconciliação por Deltas Cumulativos:** Resolução inteligente de concorrência baseada em acréscimos/decréscimos para controle de estoque e turnos de caixa.

---

## 🚧 Sprints Planejadas: Desacoplamento e Refatoração

```text
               Sprint 3                     Sprint 4                     Sprint 5
       ┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
       │   Desacoplamento     │     │   Modularização      │     │  Cloudflare Edge     │
       │   Desktop Shell      ├────►│    Banco Dexie       ├────►│     Workers / D1     │
       │   (App Runtime)      │     │  (OS vs App Storage) │     │  (Firebase Prod)     │
       └──────────────────────┘     └──────────────────────┘     └──────────────────────┘
```

### 🟢 Sprint 3 (Concluída - Desacoplamento de Apps e Shell Dinâmico)
*   **Desacoplamento Total:** Eliminação definitiva de importações estáticas de componentes de negócio em `desktop.shell.ts`.
*   **Contrato de Manifestos:** Criação do modelo `AppManifest` e registro reativo de componentes via `AppRegistry` e `manifests.ts` com `loadComponent: () => import(...)`.
*   **Carregamento Dinâmico:** Implementação de contêineres de janelas genéricos via `ngComponentOutlet` sem acoplamento reverso.
*   **Regras ESLint Automatizadas:** Regra `no-restricted-imports` bloqueia importações cruzadas entre Core/Shell e Módulos de Negócio.

### 🟢 Sprint 4 (Concluída - Modularização do Storage & Motor Transacional ACID)
*   **Segregação Física no Dexie:** Separação do banco em `PlatformDb` (`3eatcru_os_db`) e `BusinessDb` (`3eatcru_business_db`).
*   **TransactionEngine ACID:** Orquestração atômica de vendas, estoque, caixa, compras, fabricação e auditoria no `BusinessDb` com garantia de rollback completo.
*   **Compatibilidade Híbrida SSR:** Isolamento total de chamadas ao navegador com `isPlatformBrowser(this.platformId)`.

### 🟢 Sprint 5 (Concluída - Microsserviço Serverless Cloudflare Worker & D1 SQL)
*   **Cloudflare Workers:** APIs de sincronismo em lote, pareamento e gestão de licenças em `/cloudflare-worker/src/index.ts`.
*   **Persistência Relacional D1:** Rate limiting persistido em tabela D1 (`rate_limits`), `sync_token_hash` indexado com hash SHA-256 e whitelist rigorosa de entidades.
*   **Zoneless & Reatividade:** Transição total para `ReactiveFormsModule` e signals no Angular 21, sem uso de `FormsModule`/`ngModel`.

### 🟢 Hardening Adicional de Produção (P0/P1 Resolvidos)
*   **Validação Estrita de Schemas:** Integração de validação estática/runtime de DTOs nas operações críticas.
*   **Eliminação de Any:** Tipagem dos payloads para reduzir vulnerabilidades.
*   **Filtros de Multitenancy Rigorosos:** Injeção mandatória de `companyId` no `TransactionEngine` e isolamento estrito no D1.
*   **Segurança Criptográfica no Pareamento:** Pareamento com código de 6 dígitos gerado via `crypto.getRandomValues()` e `sync_token_hash` SHA-256.
*   **Cursores de Sincronização Seguros:** Sincronização (Pull) baseada em cursor dual (`synced_at` + `mutation_id`), eliminando perda de mutações concomitantes.

---
## 🏁 Status Final do Projeto: PRODUCTION READY (Versão 1.0.2)
Todas as fases arquiteturais, hardening de segurança, desacoplamento e isolamento transacional foram executadas, testadas e validadas no código real com 100% de conformidade.

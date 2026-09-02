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

### 🟠 Sprint 3: Desacoplamento de Apps e Shell (Foco: Core OS)
*   **Objetivo:** Isolar o **3eatcru OS** das importações físicas de módulos de negócios.
*   **Meta de Código:**
    *   Eliminar de forma definitiva todas as importações estáticas de componentes de negócio (como `PdvComponent`, `EstoqueComponent`) do arquivo `desktop.shell.ts`.
    *   Criar o contrato de manifesto de aplicativos (`AppManifest`) e o gerenciador de registro local (`AppRegistryService`).
    *   Implementar o **App Runtime** dinâmico, onde os aplicativos se registram no OS em tempo de execução e a área de trabalho injeta seus pontos de entrada em contêineres de janelas genéricos de forma dinâmica.

### 🟠 Sprint 4: Modularização do Banco de Dados e Storage Engine
*   **Objetivo:** Dissociar os esquemas de negócios específicos das tabelas nativas de plataforma do OS.
*   **Meta de Código:**
    *   Dividir `dexie.db.ts` em esquemas e bancos de dados lógicos isolados por domínios.
    *   O motor do OS passa a controlar apenas as tabelas essenciais (`outbox`, `operators`, `companySettings`, `auditLogs` e `hardwareDevices`).
    *   Fornecer um SDK de banco de dados para os aplicativos, permitindo que cada App declare seu próprio esquema Dexie local de forma desacoplada do Kernel.

### 🟠 Sprint 5: Migração para Infraestrutura Serverless Cloudflare e Firebase Real
*   **Objetivo:** Eliminar o servidor Express de desenvolvimento de funções de produção.
*   **Meta de Código:**
    *   Reescrever a lógica de APIs da Central em Cloudflare Workers (TypeScript Serverless).
    *   Migrar os bancos em memória e de arquivos do Express para tabelas relacionais reais de alta performance no Cloudflare D1 SQL.
    *   Integrar o SDK do Firebase Auth de forma real para controle absoluto de identidade do Proprietário, substituindo mocks de login administrativos no console **HQ**.

### 🟢 Sprints Adicionais Concluídas (Hardening P0/P1)
*   **Validação Estrita de Schemas (P1):** Integração de validação estática/runtime de DTOs nas operações críticas (`handleCreateCompany`, `handleSyncBatch`, `handleRevokeDevice`, etc).
*   **Eliminação de Any (P1):** Tipagem dos payloads para reduzir furos de segurança.
*   **Filtros de Multitenancy Rigorosos (P0):** Consultas de banco IndexedDB reescritas para filtrar obrigatoriamente por `companyId` e `locationId`.
*   **Segurança Criptográfica no Pareamento (P0):** O token de pareamento agora trafega validado e só é armazenado no servidor como Hash SHA-256 (`sync_token_hash`), impedindo roubo e vazamentos pelo banco.
*   **Cursores de Sincronização Seguros:** Sincronização (Pull) baseada em cursor dual (`synced_at` + `mutation_id`), impedindo a perda matemática de mutações concomitantes.

---
## 🏁 Status Final do Projeto
A auditoria Senior Pro foi respondida e as refatorações arquiteturais concluídas. A aplicação consolidou a mudança de "Protótipo" para **"Pré-Produção/RC (Release Candidate)"**.

# 3eatcru OS — Offline First, Núcleo Local e Motor de Armazenamento

Este documento descreve a arquitetura interna do núcleo local (**3eatcru OS**), detalhando os princípios de confiabilidade offline, o funcionamento do motor transacional e as regras de isolamento do banco de dados operacional.

---

## 🏛️ Filosofia Offline-First

O **3eatcru OS** foi concebido para que o estabelecimento comercial nunca pare. A internet é tratada como um canal de conveniência de dados, e não como uma dependência operacional.

*   **Autonomia Absoluta:** O lançamento de pedidos, a abertura de turnos de caixas, o controle de comandas e a emissão de impressões locais funcionam sem nenhuma oscilação ou latência, mesmo que o terminal esteja fisicamente desconectado da rede por dias.
*   **Armazenamento de Borda:** Todo dado gerado ou consultado é mantido localmente na base de dados do terminal antes de ser enfileirado para sincronização em segundo plano.

---

## 💾 Motor de Banco de Dados e Transações

### 1. Dexie / IndexedDB (Web Storage Engine)
O motor de banco de dados padrão do **3eatcru OS** no navegador utiliza o IndexedDB encapsulado pela biblioteca Dexie, garantindo uma API de persistência performática e com suporte nativo a transações do navegador.

### 2. Transaction Engine (`TransactionEngine`)
Para evitar corrupção de dados e garantir a consistência ACID local das operações comerciais, criamos um motor unificado de transações locais. 
*   **Atomicidade Estrita:** Uma venda no PDV só é concluída se todas as etapas passarem com sucesso em um bloco transacional exclusivo (`db.transaction`).
*   **Passos Operacionais:**
```text
                       [ INÍCIO DA TRANSAÇÃO ]
                                  │
                                  ▼
                    Reduzir Estoque do Produto
                                  │
                                  ▼
                   Inserir Movimentação de Caixa
                                  │
                                  ▼
                      Persistir Registro Venda
                                  │
                                  ▼
                 Enfileirar Mutação na Fila Outbox
                                  │
                                  ▼
                       [ FIM DA TRANSAÇÃO ]
               (Gravação e Envio Assíncrono ao Sync)
```
Se qualquer etapa falhar (ex: produto sem estoque), o `TransactionEngine` aborta a transação e realiza o rollback de todas as tabelas locais automaticamente, eliminando inconsistências físicas.

---

## 🚦 Arquitetura Modular Recomendada de Armazenamento (OS vs. Apps)

Atualmente, o banco de dados Dexie centralizado em `dexie.db.ts` declara todas as tabelas de todos os domínios em um único esquema. Sob as diretrizes de desacoplamento do **3eatcru OS**, a persistência deve ser modularizada:

### A. Banco de Dados do OS (`os_storage`)
Contém tabelas de controle operacional da plataforma, as quais o Kernel necessita para rodar independentemente dos aplicativos de negócios instalados.
*   **Tabelas:** `companySettings` (Dados da empresa/dispositivo), `operators` (PINs e permissões), `outbox` (Fila de mutações de sincronismo), `auditLogs` (Registro de conformidade) e `hardwareDevices` (Periféricos).

### B. Bancos de Dados dos Aplicativos (`app_storage` isolados)
Cada aplicativo de negócio (Varejo, CRM, Serviços) gerencia sua própria base de dados isolada no cliente, utilizando o Storage Engine fornecido pelo OS.
*   **Tabelas de Varejo/Restaurante:** `products`, `sales`, `cashSessions`, `tableOrders`, `stockMovements` e `customers`.
*   **Tabelas de CRM:** `crmLeads` e `whatsappTemplates`.
*   **Tabelas de Serviços:** `serviceOrders` e `contractedServices`.

---

## 📊 Status de Implementação

### 🟢 IMPLEMENTADO
*   **Banco de Dados Operacional Local:** Dexie com esquemas locais estáveis declarados e isolados.
*   **Transaction Engine Confiável:** Processamento transacional atômico de vendas com gravação na outbox dentro do mesmo bloco de transação.
*   **Wizard e Seed Explicito:** Configuração opcional de catálogo fictício (Demo) sem poluir o IndexedDB operacional do lojista real.

### 🟡 PARCIALMENTE IMPLEMENTADO
*   **Esquema Desacoplado:** O arquivo `dexie.db.ts` ainda é monolítico, misturando tabelas do OS com tabelas específicas dos aplicativos. A modularização das bases locais está listada no roadmap técnico de refatoração de código.

### 🔵 PLANEJADO (Portabilidade SQLite Nativa)
*   **Adaptador de Storage SQLite:** Mecanismo abstrato de persistência no Core para chavear automaticamente de IndexedDB (Web) para SQLite Nativo quando o **3eatcru OS** for empacotado e compilado como executável desktop autônomo de alta performance no Windows (utilizando Tauri/Electron).

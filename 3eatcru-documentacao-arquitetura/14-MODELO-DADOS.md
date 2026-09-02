# Modelo de Dados e Persistência do Ecossistema

Este documento especifica a estrutura lógica do banco de dados local (**3eatcru OS**) e a divisão de esquemas entre as tabelas nativas da plataforma e as tabelas operacionais pertencentes a aplicativos de negócio.

---

## 🏛️ Divisão de Esquemas: OS Storage vs. App Storage

Para evitar o acúmulo infinito de tabelas específicas de domínios verticais no Core e garantir extensibilidade total, a persistência de dados local é modularizada:

```text
               OS DATABASE SCHEMA (dexie.db.ts)
               ├── companySettings                (Dispositivo/Tenant)
               ├── operators                      (PINs e Permissões)
               ├── outbox                         (Fila de Sincronismo)
               ├── auditLogs                      (Pista de Auditoria)
               └── hardwareDevices                (Gavetas/Impressoras)
               
               APP DATABASE SCHEMAS (Isolados)
               ├── [ APP VAREJO / RESTAURANTE ]
               │   ├── products                   (Cardápio / Itens)
               │   ├── sales                      (Vendas / Pedidos)
               │   ├── cashSessions               (Caixas / Turnos)
               │   ├── stockMovements             (Estoques / Ajustes)
               │   └── tableOrders                (Mesas / Comandas)
               │
               ├── [ APP CRM / COMUNICADOR ]
               │   ├── crmLeads                   (Funil de Vendas)
               │   └── whatsappTemplates          (Templates)
               │
               └── [ APP SERVIÇOS ]
                   └── serviceOrders              (Ordens de Serviço)
```

---

## 📋 Definição de Tabelas Nativas da Plataforma (3eatcru OS Core)

Estas tabelas são essenciais para o funcionamento do Kernel e do Shell, independente dos Apps instalados:

### 1. `companySettings` (Configurações Gerais do Dispositivo)
Guarda metadados de configuração e credenciais de sincronismo obtidas após o pareamento.
*   **Campos principais:**
    *   `id` (`string`, Primary Key) - ID unificado do tenant/empresa.
    *   `tradingName` (`string`) - Nome de fantasia do estabelecimento.
    *   `subscriptionStatus` (`string`) - Status da assinatura (`TRIAL`, `ACTIVE`, `EXPIRED`).
    *   `syncToken` (`string`) - Token criptográfico seguro para autorização de APIs de sincronização.
    *   `syncTokenExpiresAt` (`number`) - Timestamp de validade do token.
    *   `syncTokenHash` (`string`) - Hash de verificação de integridade de segurança.

### 2. `operators` (Operadores Locais e PINs Criptografados)
Garante o login rápido e autenticação física no terminal.
*   **Campos principais:**
    *   `id` (`string`, Primary Key) - Identificador do funcionário.
    *   `name` (`string`) - Nome visível no PDV.
    *   `role` (`string`) - Cargo e escopo de permissão (`MANAGER`, `OPERATOR`).
    *   `pinHash` (`string`) - Senha de acesso derivada localmente por meio do algoritmo **PBKDF2-HMAC-SHA256**.
    *   `pinSalt` (`string`) - Salt criptográfico exclusivo gerado por dispositivo.
    *   `active` (`boolean`) - Status ativo para operação.

### 3. `outbox` (Fila Sequencial de Sincronização)
Estrutura persistente que armazena as mutações locais geradas offline para processamento assíncrono na nuvem.
*   **Campos principais:**
    *   `id` (`string`, Primary Key) - ID unificado da mutação (`UUID v4`).
    *   `idempotencyKey` (`string`, Index) - Chave composta para deduplicação no servidor.
    *   `payloadHash` (`string`) - Hash MD5/SHA do payload para auditoria de mutabilidade.
    *   `entityType` (`string`) - Domínio da alteração (`PRODUCT`, `SALE`, `CASH_SESSION`, etc.).
    *   `entityId` (`string`) - Identificador físico do registro de negócio associado.
    *   `operation` (`string`) - Tipo de mutação (`CREATE`, `UPDATE`, `DELETE`).
    *   `payload` (`object`) - Dados reais em formato JSON serializado.
    *   `timestamp` (`number`) - Instante físico da transação.
    *   `status` (`string`, Index) - Ciclo de vida local (`PENDING`, `SYNCING`, `SYNCED`, `FAILED`, `BLOCKED`).

---

## 📊 Status de Implementação e Ajustes Arquiteturais

### 🟢 IMPLEMENTADO
*   **Modelos de Dados unificados:** Todas as interfaces TypeScript correspondentes estão especificadas de forma robusta e limpa em `/src/app/core/models/index.ts`.
*   **Tabela de Outbox Confiável:** A estrutura e transição de estados de sincronização (`PENDING` -> `SYNCED`) funcionam de forma transacional exemplar na base Dexie.

### 🟡 PARCIALMENTE IMPLEMENTADO
*   **Isolamento Físico de Bancos de Dados:** No código atual, todas as tabelas (incluindo as de negócios) estão declaradas no mesmo inicializador `AppDexieDb` em `dexie.db.ts`. O plano de migração prevê a extração física e criação de bancos locais dinâmicos por Apps de negócios.

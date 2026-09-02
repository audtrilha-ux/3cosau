# Fluxos de Integração e Diagramas de Sequência

Este documento especifica os principais fluxos lógicos e protocolos de comunicação de rede do ecossistema, mapeando o funcionamento sequencial das transações e sincronizações.

---

## 🏛️ Fluxos Operacionais

### 🔄 1. Inicialização do OS e Validação de Licença
Toda vez que o terminal do cliente é iniciado, o **3eatcru OS** executa um protocolo de verificação de integridade e validade comercial de forma integrada com a Central.

```text
3EATCRU OS (Terminal)                         CENTRAL (Nuvem API)
       │                                              │
       ├──► 1. Carrega configurações locais            │
       │                                              │
       ├──► 2. Valida timestamps locais no banco      │
       │                                              │
       ├──► 3. Envia Requisição de Check              │
       │    GET /api/sync/license-check               │
       │    Authorization: Bearer <syncToken> ───────►│
       │                                              │──┐ 4. Valida Token e
       │                                              │  │    calcula expiração
       │                                              │◄─┘    do trial/plano
       │◄─────────────────────────────────────────────┤
       │    Status comercial e dias restantes         │
       │                                              │
       ├──► 5. Caso expirado:                         │
       │    Bloqueia novas vendas com overlay visual  │
       ▼                                              ▼
```

---

### 🔄 2. Fluxo Transacional Atômico e Sincronização Push
Garante a integridade do banco de dados local do cliente e o envio confiável das transações operacionais de forma idempotente para a Central.

```text
USUÁRIO       TRANSACTION ENGINE       DEXIE DB (Local)       CENTRAL API (Nuvem)
   │                  │                       │                        │
   ├──► Vender ──────►│                       │                        │
   │    Produto       ├──► 1. Abre Transação  │                        │
   │                  │    (db.transaction)   │                        │
   │                  │                       │                        │
   │                  ├──► 2. Deduz Estoque ─►│                        │
   │                  │                       │                        │
   │                  ├──► 3. Registra Caixa ─►│                        │
   │                  │                       │                        │
   │                  ├──► 4. Grava Venda ───►│                        │
   │                  │                       │                        │
   │                  ├──► 5. Insere Outbox ─►│                        │
   │                  │                       │                        │
   │                  ├──► 6. Fecha Transação │                        │
   │                  │    (Commit / Success) │                        │
   │                  │                       │                        │
   │                  ├──► 7. Dispara Lote    │                        │
   │                  │    POST /api/sync/batch                        │
   │                  │    Authorization: Bearer <syncToken> ─────────►│
   │                  │                                                │──┐ 8. Valida Token,
   │                  │                                                │  │    deduplica Hash
   │                  │                                                │  │    e reconcilia
   │                  │                                                │◄─┘    estoques
   │                  │◄───────────────────────────────────────────────┤
   │                  │    Retorna ACK com sucesso do lote             │
   │                  │                                                │
   │                  ├──► 9. Atualiza Outbox                          │
   │                  │    como SYNCED no banco                       │
   ▼                  ▼                       ▼                        ▼
```

---

### 🔄 3. Sincronização Incremental Pull
Busca na nuvem todas as atualizações de cadastros e configurações efetuadas no console administrativo do **HQ** ou por outros terminais pareados do respectivo lojista.

```text
3EATCRU OS (Terminal)                         CENTRAL API (Nuvem)
       │                                              │
       ├──► 1. Recupera cursor local                  │
       │    last_pull_timestamp (localStorage)        │
       │                                              │
       ├──► 2. Envia Requisição de Pull               │
       │    GET /api/sync/pull?lastSyncedAt=TS        │
       │    Authorization: Bearer <syncToken> ───────►│
       │                                              │──┐ 3. Filtra mutações do
       │                                              │  │    tenant posteriores
       │                                              │◄─┘    ao timestamp recebido
       │◄─────────────────────────────────────────────┤
       │    Lista de mutações de entrada + novo TS    │
       │                                              │
       ├──► 4. Aplica mutações diretamente no Dexie   │
       │    (Bypassa fila local do Outbox)            │
       │                                              │
       ├──► 5. Salva novo timestamp de cursor         │
       │    localStorage.setItem(last_pull_ts)        │
       ▼                                              ▼
```

---

## 📊 Status de Implementação dos Fluxos

### 🟢 IMPLEMENTADO
*   **Fluxo de Boot com Check de Licença:** O **3eatcru OS** valida online o licenciamento no boot e bloqueia visualmente se expirado.
*   **Transação Atômica com Outbox:** O `TransactionEngine` garante que o lançamento local de vendas e a inserção na outbox ocorram no mesmo bloco de transação segura.
*   **Pull Incremental Concluído:** O sincronismo de entrada recupera alterações através de cursores temporais e grava diretamente nas tabelas operacionais do terminal do lojista de forma não duplicada.

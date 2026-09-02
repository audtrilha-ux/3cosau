# Sincronização — Outbox, Idempotência e Resolução de Conflitos

Este documento descreve a arquitetura de sincronização bidirecional entre o **3eatcru OS** (terminais locais) e a **Central** (nuvem), detalhando as garantias de idempotência, o ciclo de vida das mensagens e o motor de reconciliação de conflitos.

---

## 🏛️ Funcionamento do Sincronismo Bidirecional

O sincronismo de dados do ecossistema opera em duas vias concorrentes e automatizadas:

```text
               3EATCRU OS (Cliente)               CENTRAL (Nuvem)
              ┌─────────────────────┐          ┌────────────────────┐
              │                     │          │                    │
              │  Outbox (Pending)   ├─────────►│ API /sync/batch    │ [Push]
              │                     │ (Lote)   │ (Deduplicação)     │
              │                     │◄─────────┤ (Aplica deltas)    │
              │                     │  ACK     │                    │
              ├─────────────────────┤          ├────────────────────┤
              │                     │          │                    │
              │  Local Cursor       │◄─────────┤ API /sync/pull     │ [Pull]
              │  (last_pull_ts)     │ (Deltas) │ (Query timestamps) │
              │                     │          │                    │
              └─────────────────────┘          └────────────────────┘
```

1.  **Via de Saída (Push Sincronizado):** As mutações locais são enfileiradas na outbox e enviadas em lotes sequenciais para o endpoint `/api/sync/batch` da Central.
2.  **Via de Entrada (Pull Sincronizado):** O terminal solicita incrementalmente modificações externas (como novos produtos cadastrados no HQ, alterações de preços ou ordens remotas de serviços) chamando o endpoint `/api/sync/pull?lastSyncedAt=TIMESTAMP` com o cursor de tempo local.

---

## 🔒 Garantias de Integridade

### 1. Idempotência Absoluta
Cada mensagem de mutação enviada gera no cliente um ID unificado (`UUID v4`), uma chave de idempotência (`idempotencyKey`) baseada no conteúdo do registro e um `payloadHash`.
*   O servidor possui um verificador de idempotência no banco de dados. Caso o terminal retransmita o mesmo lote devido a instabilidades na rede, o servidor descarta duplicidades de forma segura, retornando apenas o ACK (sucesso) original correspondente, o que elimina vendas ou lançamentos financeiros duplicados.

### 2. Resolução de Conflitos por Deltas Acumulativos
Eliminamos totalmente o modelo genérico de Last-Write-Wins (LWW) cego para dados transacionais críticos de negócios, substituindo-o por reconciliações inteligentes:
*   **Controle de Estoque (`STOCK_MOVEMENT`):** O servidor processa movimentos de estoque por deltas cumulativos (`+ quantity` ou `- quantity`). Se o estoque central divergir do local devido a vendas concorrentes offline, o saldo real do produto na Central é recalculado agregando a soma aritmética das movimentações de forma auditável e não destrutiva.
*   **Movimentos de Caixa (`CASH_MOVEMENT`):** Lançamentos financeiros alimentam incrementalmente as sessões de caixa (`CASH_SESSION`) na nuvem sem substituir as tabelas cegas de saldos totais, permitindo total consistência em auditorias de tesouraria.
*   **Smart Merge (Mesclagem de Cadastros):** Para dados cadastrais como `PRODUCT` e `CUSTOMER`, o servidor analisa propriedades individuais do payload. Ele prioriza a versão mais atual de campos modificados localmente no terminal (ex: descrição alterada no PDV) enquanto preserva outras informações consolidadas em nuvem.

---

## 📊 Status de Implementação

### 🟢 IMPLEMENTADO (Sincronismo Completo e Reconciliado)
*   **Outbox no Cliente (`SyncOutboxService`):** Fila sequencial no IndexedDB com suporte a estados lógicos: `PENDING` (Aguardando envio), `SYNCING` (Em trânsito), `SYNCED` (Confirmado por ACK) e `FAILED` (Erros transitórios de rede).
*   **Pull Incremental por Cursor de Tempo:** Implementado o fluxo bidirecional completo de entrada. O terminal gerencia o cursor local em milissegundos (`last_pull_timestamp`), recuperando apenas mutações reais publicadas após este marco de tempo.
*   **Resolução de Conflitos Delta-Based:** O backend Express (`server.ts`) realiza atualizações e reconciliações numéricas incrementais de estoque e movimentações financeiras.
*   **Idempotência no Servidor:** Filtro que processa e rejeita mensagens repetidas com chaves e hashes idênticos.

### 🟡 PARCIALMENTE IMPLEMENTADO
*   **Armazenamento de Chaves de Idempotência:** A tabela de mensagens já processadas (`processedMutations`) e chaves de idempotência na Central atual opera em mapas de memória Express. A migração das tabelas de deduplicação para persistência robusta na nuvem (D1) está planejada para a próxima sprint.

### 🔵 PLANEJADO (Arquitetura de Destino)
*   **Sincronização Ativa em Tempo Real (WebSockets / Live API):** Uso de conexões bidirecionais WebSocket integradas na Central para notificar instantaneamente os terminais de alterações de dados em nuvem, eliminando a necessidade de polling de pull.

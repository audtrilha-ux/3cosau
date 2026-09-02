# 1. EXECUTIVE SUMMARY

Status:
Production Ready?
NO

Nota:
3.5 / 10

P0:
5

P1:
3

P2:
2

P3:
2

---

# 2. MATRIZ DE CONFORMIDADE

| Área          | Status                | Nota | Evidência |
| ------------- | --------------------- | ---: | --------- |
| Arquitetura   | FAIL                  |    5 | dexie.db.ts (isBrowser quebra SSR) |
| Segurança     | FAIL                  |    2 | worker/index.ts (Não valida operador/payload) |
| RBAC          | FAIL                  |    3 | worker/index.ts (Servidor confia cegamente no terminal) |
| Multi-tenant  | FAIL                  |    4 | transaction.engine.ts (Injeção no payload) |
| Offline       | PASS                  |    8 | AppDexieDb, SyncOutbox e TransactionEngine operacionais |
| Sync          | FAIL                  |    4 | sync-outbox.service.ts (Double counting de estoque no Pull) |
| Transações    | FAIL                  |    4 | dexie.db.ts (AppDexieDb.transaction ignora cross-db) |
| Estoque       | FAIL                  |    2 | worker/index.ts (Race condition de PRODUCT e STOCK_MOVEMENT) |
| PDV           | FAIL                  |    5 | pdv.component.ts (Erros silenciosos na UI) |
| Financeiro    | FAIL                  |    5 | worker/index.ts (CASH_SESSION não atualiza na nuvem) |
| Central/HQ    | PASS                  |    8 | central.component.ts implementado com autoridade local e via Worker |
| Licenciamento | FAIL                  |    2 | setup-wizard.component.ts (Bypass por TRIAL-LOCAL) |
| Testes        | NOT VERIFIED          |    0 | Ausência de suites verificadas |
| Build         | VERIFIED              |    9 | Angular e Vite configurados |

---

# 3. P0 — BLOQUEADORES

ID: P0-01
Severidade: CRÍTICO
Arquivo: cloudflare-worker/src/index.ts
Linha: 166 (handleSyncBatch)
Problema: Falta de Validação RBAC no Servidor (Server-Side Trust)
Evidência: O endpoint `/api/sync/batch` confia integralmente nas mutações recebidas se o dispositivo estiver pareado. Não há validação baseada no operador que assinou a mutação.
Como reproduzir: Um terminal modificado envia uma mutação deletando itens da tabela `COMPANY_SETTINGS` ou alterando preços livremente.
Impacto: Falha total de autoridade. Um atacante (ex: caixa malicioso) pode escalar privilégios e destruir dados da empresa, pois o Cloudflare D1 gravará as mutações sem resistências de negócio.
Correção recomendada: Enviar a assinatura de quem autorizou a mutação. O Worker deve consultar os papéis do operador e vetar comandos como `DELETE PRODUCT` por um `CASHIER`.

ID: P0-02
Severidade: CRÍTICO
Arquivo: src/app/core/storage/dexie.db.ts
Linha: 277 (AppDexieDb.transaction)
Problema: Falha de Isolamento em Transações Multi-Banco (Cross-DB ACID Break)
Evidência: No orquestrador, quando uma transação engloba tabelas da `platformDb` e `businessDb` juntas, a lógica direciona o callback APENAS para a `businessDb`. Consequentemente, operações na `platformDb` (ex: `operators.put()`) ignoram a transação e rodam imediatamente em auto-commit.
Como reproduzir: Gerar erro intencional logo após salvar um Operador (ex: lançar erro no salvamento do Outbox).
Impacto: Perda de atomicidade (ACID). Dados críticos salvos parcialmente; dados ficarão órfãos na `platformDb` se a transação do `businessDb` reverter.
Correção recomendada: Dexie não suporta transações abrangendo múltiplas instâncias de banco. É necessário unificar as bases se a atomicidade de ponta-a-ponta for exigência, ou implementar padrão Saga/2PC no Frontend.

ID: P0-03
Severidade: CRÍTICO
Arquivo: src/app/shell/desktop/components/setup-wizard.component.ts
Linha: 84 e 588 (setupInitialCompany)
Problema: Bypass de Licenciamento via Fallback (Autoautorização)
Evidência: O fluxo "DIRECT" do Wizard permite que o usuário crie um estabelecimento totalmente local recebendo uma licença `TRIAL-LOCAL-XXXX` e se autoative, sem validação real da `CentralPlatformService`.
Como reproduzir: Na tela de setup, usar o botão "Cadastro do Estabelecimento", ignorar o pareamento por código e preencher dados hardcoded.
Impacto: Fraude de licenciamento. Clientes conseguem usar a versão em produção bypassando o faturamento e a autoridade da Central HQ.
Correção recomendada: Ocultar o fluxo "DIRECT" de produção. A inicialização de um node terminal DEVE depender exclusivamente da aprovação com `pairingCode` fornecido pela Central.

ID: P0-04
Severidade: CRÍTICO
Arquivo: src/app/core/sync/sync-outbox.service.ts & cloudflare-worker/src/index.ts
Linha: Múltiplas (lógicas de pullNow e handleSyncBatch)
Problema: Race Condition Gerando Contagem Dupla de Estoque (Double Counting)
Evidência: O backend intercepta `STOCK_MOVEMENT` e atualiza a entidade `PRODUCT` para salvar o saldo absoluto na nuvem. Quando o terminal B faz o Pull, ele recebe o `PRODUCT` (já deduzido) E o `STOCK_MOVEMENT`. O `sync-outbox.service.ts` injeta o `PRODUCT` e, em seguida, aplica o delta do `STOCK_MOVEMENT` localmente, deduzindo o estoque DUAS VEZES.
Como reproduzir: Terminal A vende um item (Estoque = 9). Terminal B sincroniza. O Terminal B recebe o saldo 9 (via PRODUCT) e depois aplica -1 (via STOCK_MOVEMENT), resultando em Estoque = 8.
Impacto: Perda irrecuperável de integridade de estoque nos demais caixas.
Correção recomendada: Mutações de transações contábeis que possuem gatilhos de backend (calculando saldo total) não devem disparar atualizações retroativas em cascata via `pullNow`. A responsabilidade de consolidar totais absolutos no frontend a partir de DLTs não pode sofrer race com o absolute put.

ID: P0-05
Severidade: CRÍTICO
Arquivo: src/app/core/workflow/transaction.engine.ts
Linha: 69
Problema: Poluição de Payload com TenantID (Tenant Escape Injection)
Evidência: A injeção em `_saveEntity` usa `if (entity.companyId === undefined)`. 
Como reproduzir: Atacante passa payload modificado `{ companyId: "ID_DE_OUTRA_EMPRESA" }` pela camada UI do PDV. O Payload contorna o check e vai para o D1 contendo a string de outra empresa dentro do JSON, mesmo sob a root key do cliente ativo.
Impacto: Comprometimento da higienização multi-tenant. Dados corrompidos trafegarão na nuvem com identificadores mistos, causando danos à governança de dados.
Correção recomendada: O TransactionEngine deve FORÇAR a atribuição `entity.companyId = currentCompanyId;` sobrescrevendo silenciosamente, independente se o atributo veio da UI ou não.

---

# 4. P1

ID: P1-01
Severidade: ALTO
Arquivo: src/app/core/storage/dexie.db.ts
Linha: 17
Problema: Uso de window bruto quebrando Angular SSR
Evidência: Função `isBrowser` avaliando `typeof window !== 'undefined'`.
Impacto: Pode crashear a aplicação de front end durante renderizações server-side, o que viola o requisito híbrido absoluto de isolamento de plataforma.

ID: P1-02
Severidade: ALTO
Arquivo: src/app/modules/vendas/pdv.component.ts & src/app/modules/caixa/caixa.component.ts
Linha: Fluxos de confirmarVenda() e confirmarFechamento()
Problema: Rejeição de Promise Silenciosa na UI (UX Quebrada)
Evidência: Erros lógicos gerados pelo TransactionEngine (ex: falhas de limite, estoque não liberado) são cuspidos em forma de exceções não capturadas (`await this.engine.processSale(...)`). O Modal não dá retorno ou loading visual de "FALHOU", mantendo o caixa congelado.
Impacto: O operador de caixa perde noção do que aconteceu (transação paralisada, falha de feedback visual).

ID: P1-03
Severidade: ALTO
Arquivo: cloudflare-worker/src/index.ts
Linha: 166-250
Problema: Falha de Projeção em CASH_SESSION (Nuvem Desincronizada)
Evidência: O Worker projeta impactos de estoque (`STOCK_MOVEMENT` -> `PRODUCT`), mas não intercepta lançamentos `CASH_MOVEMENT` para incrementar `CASH_SESSION.finalCashCalculated` na persistência Cloudflare D1.
Impacto: Um backup ou segundo terminal lerão saldos de gaveta obsoletos a partir do Pull, se baseados unicamente em leitura da Sessão sem re-fold de Movimentações.

---

# 5. P2

ID: P2-01
Severidade: MÉDIO
Arquivo: src/app/core/workflow/transaction.engine.ts
Linha: 232 (finalizeManufacturingOrder)
Problema: Fragilidade em Relações de Entidade (Uso de nome como chave)
Evidência: A query de estoque de insumos compara por string (`p.name === comp.name`) em vez de utilizar o ID imutável do produto.
Impacto: Se o usuário renomear o insumo (ex: Sal 1KG para Sal Fino 1KG), a ordem de fabricação de outros produtos vai crashear porque não achará o insumo.

ID: P2-02
Severidade: MÉDIO
Arquivo: src/app/core/sync/sync-outbox.service.ts
Linha: Múltiplas
Problema: Ausência de limite em toArray()
Evidência: Utilização pontual de métodos Dexie não paginados.
Impacto: Em tenants com altíssimo tráfego, carregar todo o outbox na memória para filtrar pendentes pode causar degradação progressiva de UI/UX.

---

# 6. P3

ID: P3-01
Severidade: BAIXO
Arquivo: Vários
Problema: Mix de Padrões Naming de Database
Evidência: D1 (Worker) usa snake_case (`company_id`, `tenant_id`), enquanto Frontend envia JSON em camelCase e gerencia local em camelCase.
Impacto: Pequena dissonância mental na manutenção, mas atualmente mapeado corretamente pelo Worker.

ID: P3-02
Severidade: BAIXO
Arquivo: src/app/modules/vendas/pdv.component.ts
Problema: Otimização prematura em atualizações do DB
Impacto: Códigos de leitura do DOM re-renderizando além do necessário em componentes autônomos.

---

# 7. DOCUMENTAÇÃO × REALIDADE

| Afirmação da documentação | Implementação real | Evidência     | Resultado |
| ------------------------- | ------------------ | ------------- | --------- |
| RBAC completo e Seguro    | Frontend valida; Backend confia cegamente | worker/index.ts | FAIL |
| Sync automático           | Implementado com Backoff e Worker. DLT correto | sync-outbox.service.ts | PASS |
| Operações ACID            | Falha caso tabelas misturem Platform e Business | dexie.db.ts | FAIL |
| Multi-tenant Seguro       | Edge verifica Token, mas não injeta forçado JSON | transaction.engine.ts | FAIL |
| Licenciamento Fechado     | Há um modo hardcoded (TRIAL-LOCAL) livre na UI | setup-wizard.component.ts | FAIL |
| Funciona 100% Offline     | Transações locais confirmam atomicidade local | Vários | PASS |

---

# 8. FLUXOS CRÍTICOS

* **LOGIN / SETUP**: FAIL (Violação de Licenciamento P0, Setup bypass via TRIAL-LOCAL).
* **VENDA / PDV**: FAIL (Transação não tratada na interface P1, Falhas de dupla contagem no Sync P0).
* **ESTOQUE**: FAIL (Server aplica offset e cliente re-aplica delta - race condition de P0).
* **CAIXA / FINANCEIRO**: FAIL (A sessão de caixa salva em nuvem fica estática frente aos movimentos P1).
* **SYNC / NUVEM**: FAIL (Falta total de verificação de permissões do operador assinante P0).

---

# 9. TESTES QUE ESTÃO FALTANDO

* **P0 Security E2E**: Teste que força a emissão de payload mutado (como um cliente forjando ser da matriz).
* **P0 Concurrency**: Teste que roda `pullNow()` recebendo um Produto e Movimento de Estoque no mesmo batch para provar a contagem correta do estoque.
* **P0 ACID Recovery**: Teste simulando falha no DB ao meio de salvar a auditoria, atestando que a venda não foi registrada órfã.
* **P1 SSR Check**: Build server executando navegações nativas para confirmar tolerância de janela.

---

# 10. ARQUITETURA RECOMENDADA

* PROBLEMA: O banco Dexie tem duas instâncias locais separadas (`platformDb` e `businessDb`), o que impede transações atômicas nativas do IndexedDB de englobarem o sistema como um todo.
* ARQUITETURA RECOMENDADA: Mesclar todas as tabelas em um único banco IndexedDB versionado sob a mesma interface `AppDexieDb`. Utilizar apenas filtragens em memória ou por prefixos de ID para isolar `system` de `tenant`. Isso garante o ACID imediato pelo Engine de banco nativo do browser.

* PROBLEMA: O Backend atua apenas como um "JSON Dump" com base no token do dispositivo (Idempotency key).
* ARQUITETURA RECOMENDADA: Extrair o `operatorId` do Header do Sync. O Worker deve buscar no banco local o nível do operador e impedir mutações de Entidades Bloqueadas baseadas na lista de acesso. O backend deve ser co-responsável e rejeitar mutações corrompidas.

---

# 11. PLANO DE CORREÇÃO

* **FASE 1 — P0 (Críticos):**
  1. Forçar a remoção do bypass de Setup (remover `TRIAL-LOCAL` e modo DIRECT).
  2. Implementar verificação RBAC por Token JWT no Worker Cloudflare.
  3. Modificar `_saveEntity` para fazer overriding irrestrito de `companyId` da Entidade.
  4. Tratar o duplo recebimento de Sync de Estoque (Cliente decide se ignora delta baseado no sync state, ou Backend emite APENAS eventos transacionais).
  5. Unificar os bancos locais do Dexie para restaurar suporte a transações ACID unificadas.

* **FASE 2 — P1:**
  1. Remover referência hardcoded do `window` em isBrowser() usando `PLATFORM_ID`.
  2. Aplicar blocos de Catch no PDV e Caixa e emitir feedbacks de Toast de UI para o usuário.
  3. Ajustar `tenant_records` update logic para processar Deltas Financeiros (`CASH_SESSION`).

* **FASE 3 — P2 e Hardening:** Ajuste em buscas de nomes (passando a usar chave estrangeira de ID no módulo de produção), revisão de paginação de memória.


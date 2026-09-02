# Decisões de Arquitetura (ADRs)

Este documento registra as decisões de projeto significativas (Architectural Decision Records - ADRs) tomadas ao longo da evolução técnica do ecossistema, detalhando o contexto, os fatores de decisão, as consequências e o status de cada escolha.

---

## 🏛️ ADR 1: Derivação de Chaves por PBKDF2-HMAC-SHA256 para PINs Locais
*   **Status:** `🟢 IMPLEMENTADO`
*   **Contexto:** O **3eatcru OS** necessita de login ágil por teclados numéricos (PIN de 4 dígitos) para operadores em terminais físicos de vendas.
*   **Problema:** Hashes simples de ciclo único (ex: SHA-256) em senhas curtas são vulneráveis a ataques offline de força bruta ultra rápidos caso a base local do navegador IndexedDB seja copiada. Um atacante pode decifrar a senha em frações de segundos.
*   **Decisão:** Substituímos o SHA-256 legado por **PBKDF2-HMAC-SHA256** com **10.000 iterações** e salt dinâmico gerado de forma exclusiva por dispositivo.
*   **Consequência:** Aumento maciço no custo computacional de validação local. Tentativas de força bruta tornam-se ineficientes e inviabilizadas no navegador, elevando a segurança física do estabelecimento do lojista.

---

## 🏛️ ADR 2: Autorização de APIs de Sincronismo por syncToken
*   **Status:** `🟢 IMPLEMENTADO`
*   **Contexto:** Os terminais operacionais sincronizam dados críticos offline e recebem atualizações por meio de endpoints REST.
*   **Problema:** O uso do cabeçalho opcional enviado pelo cliente `X-Tenant-ID` para isolar transações permitia forjamento de IDs e roubo de dados de concorrência por usuários mal-intencionados manipulando o console do navegador.
*   **Decisão:** Eliminar a confiança em cabeçalhos HTTP puros enviados pelo cliente. Toda chamada de API de sincronismo deve autenticar-se sob a diretiva `Authorization: Bearer <syncToken>`. O token de sincronismo é gerado e assinado pela Central no pareamento físico, e o backend resolve a empresa/tenant de forma opaca no servidor.
*   **Consequência:** Bloqueio definitivo de spoofing de tenant de rede. Se as informações cruzadas divergirem, a Central de Serviços recusa sumariamente a conexão com erro `HTTP 403 Forbidden`.

---

## 🏛️ ADR 3: Sincronismo Incremental Pull Baseado em Cursors Temporais
*   **Status:** `🟢 IMPLEMENTADO`
*   **Contexto:** Os terminais locais operam de forma isolada offline e necessitam obter atualizações cadastrais publicadas no console administrativo do **HQ** ou por outros caixas concorrentes.
*   **Problema:** A falta de sincronização de entrada mantinha os caixas desatualizados. A busca de tabelas inteiras consome banda e sobrecarrega a rede.
*   **Decisão:** Implementação do sincronismo incremental bidirecional chamando o endpoint `/api/sync/pull?lastSyncedAt=TIMESTAMP` em conjunto com um cursor de tempo mantido localmente em milissegundos no navegador.
*   **Consequência:** Redução drástica de consumo de banda e processamento no cliente. Apenas mutações ocorridas de forma real após o marco temporal local do terminal são trafegadas e consolidadas de forma delta direta no banco de dados Dexie.

---

## 🏛️ ADR 4: Reconciliação de Estoque e Caixa por Deltas Cumulativos
*   **Status:** `🟢 IMPLEMENTADO`
*   **Contexto:** Múltiplos caixas locais operam transações de faturamento e estoque de forma offline e concorrente, sincronizando em momentos distintos.
*   **Problema:** A regra anterior Last-Write-Wins (LWW) baseada em timestamp substituía inteiramente as propriedades dos registros, causando furos graves de estoque e perdas financeiras em caixas.
*   **Decisão:** Substituímos a resolução genérica cega de concorrência por processamentos matemáticos acumulativos baseados em deltas imutáveis para as tabelas críticas de `STOCK_MOVEMENT` e `CASH_MOVEMENT`.
*   **Consequência:** Integridade de auditoria preservada. Vendas simultâneas em caixas distintos offline diminuem o estoque real e alimentam os saldos centrais de caixa por soma aritmética sequencial sem sobrescritas cegantes de saldos absolutos.

---

## 🏛️ ADR 5: Desacoplamento Físico de Módulos e App Runtime (Planejado)
*   **Status:** `🔵 PLANEJADO`
*   **Contexto:** Atualmente, os aplicativos de negócios (PDV, CRM, WhatsApp, etc.) residem como componentes integrados de compilação monolítica junto ao **3eatcru OS**.
*   **Problema:** Acoplamento físico impede instalação modular de soluções, desenvolvimento independente, distribuição isolada e atualizações parciais.
*   **Decisão:** Criação de um barramento de ciclo de vida de aplicativos (App Runtime) e SDK de banco e hardware no Core. O OS passa a compilar limpo e a injetar módulos de negócio dinamicamente sob especificações de manifestos estruturados.
*   **Consequência:** Desacoplamento absoluto e modularidade real. O ecossistema torna-se uma plataforma flexível e extensível de mercado.

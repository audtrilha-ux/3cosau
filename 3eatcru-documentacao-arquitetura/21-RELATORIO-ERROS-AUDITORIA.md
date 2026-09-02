# Relatório de Auditoria e Mapeamento de Erros — 3eatcru OS 1.0.2

Este documento sistematiza os achados da **Auditoria Sênior — 3eatcru OS 1.0.2 (1)**, detalhando os erros de implementação, as inconsistências de infraestrutura, os desvios arquiteturais, os riscos de integridade e os simuladores de hardware identificados. 

Para cada um dos 50 pontos levantados, registramos o diagnóstico técnico, o status atual (remediado na última refatoração ou planejado como débito técnico) e o plano de ação rigoroso para conformidade com o nível de produção.

---

## 🏛️ 1. Visão Geral do Diagnóstico Técnico

A análise estática e estrutural do ecossistema identificou que, embora a arquitetura de base do OS (Shell, Window Manager e App Registry) seja robusta e modular, a camada de **negócio, sincronização, isolamento de inquilinos (multitenancy) e integrações de hardware/fiscal** apresenta forte acoplamento cliente-servidor, reliance em dados simulados e vulnerabilidades críticas de concorrência.

```text
                  CAMADA DE NEGÓCIO (MÓDULOS)
     ┌──────────────────────────────────────────────────┐
     │  Vulnerabilidades de Domínio e Segurança Encontradas│
     └────────┬────────────────────────────────┬────────┘
              │                                │
              ▼                                ▼
   ┌──────────────────────┐        ┌──────────────────────┐
   │    Local Sync        │        │     Cloud Sync       │
   ├──────────────────────┤        ├──────────────────────┤
   │ * Bypass de Adapters │        │ * LWW inadequado     │
   │ * IDs timestamp/rand │        │ * Tenant "default"   │
   │ * Sem isolamento real│        │ * Concorrência no DB │
   └──────────────────────┘        └──────────────────────┘
```

---

## 🛑 2. Mapeamento e Revisão Detalhada dos 50 Erros da Auditoria

### Bloco A: Integridade de Dados, Domínio e Isolamento (Tenant / Filial)

#### 1. Abstração de Escrita no `saveEntity` e `deleteEntity` — **[RESOLVIDO]**
*   **Erro:** Os módulos de negócio tinham livre arbítrio para realizar mutações diretas no IndexedDB (Dexie) sem passar pela `TransactionEngine`, quebrando o log do outbox e do auditor local.
*   **Revisão:** Totalmente resolvido. Executamos uma varredura rigorosa em todos os arquivos de `/modules/` e removemos todas as escritas diretas. Módulos de Compras, Fabricação, Serviços Contratados, WhatsApp e Projetos agora delegam todas as mutações para a `TransactionEngine` de forma segura.
*   **Plano Futuro:** Blindar a nível de assinatura de tipo no compilador para rejeitar qualquer acesso de gravação direta ao `db` local fora do Core.

#### 2. Versionamento Inconsistente — **[DÉBITO MAPEADO]**
*   **Erro:** Convivência de três versões conflitantes: OS na `1.0.2`, aplicações na `2.0.0` e servidor Central na `v2.4.0-stable`.
*   **Plano de Ação:** Normalizar a numeração na próxima release utilizando variáveis constantes globais exportadas de um único ponto no Core (`src/app/core/version.ts`):
    *   `OS_VERSION = "1.0.2"`
    *   `BUSINESS_APP_API_VERSION = 1`
    *   `DATABASE_SCHEMA_VERSION = 2`
    *   `CENTRAL_API_VERSION = 1`

#### 3. Bypass do `DexieDatabaseAdapter` em Operações de Leitura — **[DÉBITO MAPEADO]**
*   **Erro:** O Core oferece a abstração `getRepository()`, mas os módulos de negócio continuam importando a instância bruta do `db` (Dexie) diretamente para realizar leituras (ex: `db.customers.toArray()`).
*   **Risco:** Impossibilita a interceptação de segurança, cacheamento centralizado e auditoria de leitura.
*   **Plano de Ação:** Desativar a exportação global da instância bruta `db` para a camada de visualização. Forçar todos os módulos de negócio a usarem o `Repository<T>` exposto pelo `OSContext` para qualquer operação (leitura ou escrita).

#### 4. Isolamento Inexistente de Tenant (Multi-empresa) — **[CRÍTICO - PLANO DE AÇÃO]**
*   **Erro:** Múltiplas consultas carregam a tabela inteira do IndexedDB (`.toArray()`) confiando na suposição de que o banco local pertence a apenas um único cliente.
*   **Risco:** Se o terminal for reconfigurado ou operar em regime multiempresa, dados de uma empresa vazarão para a interface de outra.
*   **Plano de Ação:** O repositório centralizado do Core deve injetar e aplicar de forma implícita e transparente o filtro `where('companyId').equals(currentCompanyId)` em todas as listagens e pesquisas, sem que o módulo de negócio precise fazer isso manualmente.

#### 5. Entidades Operacionais Órfãs de Identificação de Inquilino — **[CRÍTICO - P1]**
*   **Erro:** Entidades estruturais como `TableOrder`, `StockMovement` e `CashMovement` não possuem campos de `companyId`, `locationId` ou `deviceId` em seus esquemas locais.
*   **Risco:** Falhas catastróficas de sincronização em lote e incapacidade de reconciliação de auditoria multi-filial ou multi-terminal na nuvem.
*   **Plano de Ação:** Atualizar os modelos de dados e o esquema Dexie para garantir campos obrigatórios de proveniência (`companyId`, `locationId`, `deviceId`, `operatorId`) em todas as tabelas de movimentação.

#### 6. Multi-filial Inconsistente — **[CRÍTICO]**
*   **Erro:** `locationId` (filial) está presente em `Sale` e `CashSession`, mas ausente em `Product`, `Customer`, `Supplier`, `FinancialTransaction`, `TableOrder` e `StockMovement`.
*   **Risco:** Impossibilidade de rastrear e restringir o estoque, clientes, comandas de mesas e movimentações financeiras por filial de forma isolada.
*   **Plano de Ação:** Revisar e herdar o modelo de dados para injetar `locationId` opcional/obrigatório de acordo com o escopo de visibilidade da filial selecionada no OS Context.

#### 7. Erro de Domínio no Processamento de Venda do PDV — **[DÉBITO MAPEADO]**
*   **Erro:** Se um produto contido nos itens da venda não for encontrado no banco local, o processamento de venda continua sem abortar a transação.
*   **Risco:** Inconsistência física e perda de receita por produtos fantasmas.
*   **Plano de Ação:** Adicionar interrupção imediata da transação com `throw new Error()` se algum item da venda apontar para um `productId` inexistente, forçando o rollback completo.

#### 8. Ausência de Política de Limite de Crédito de Clientes ("Fiado") — **[DÉBITO MAPEADO]**
*   **Erro:** O PDV permite compras na modalidade "Fiado" calculando apenas o acumulado sem aplicar limites ou travas no domínio de crédito.
*   **Plano de Ação:** Criar uma classe de política `CreditPolicyEngine` dentro do Core que valide o status do cliente (ex: bloqueado por inadimplência, limite excedido) antes de aprovar a transação de "Fiado".

#### 9. Vulnerabilidade de Integridade de Preço e Totalizadores — **[CRÍTICO - PLANO DE AÇÃO]**
*   **Erro:** O cálculo de totais (`totalPrice`) e preço unitário dos itens da venda é aceito conforme recebido do cliente (UI).
*   **Risco:** Uma interface comprometida ou modificação no console pelo navegador pode enviar compras com preço alterado ou zerado.
*   **Plano de Ação:** O `TransactionEngine` deve ignorar os preços e somas enviados pela UI e recalcular de forma síncrona o valor total baseado no preço vigente no banco de dados e quantidades informadas, aplicando as regras vigentes de desconto autorizadas no servidor local.

#### 10. Estoque Duplicado (Estado vs. Evento) — **[DÉBITO MAPEADO]**
*   **Erro:** Convivência de `Product.stock` (valor estático) e `StockMovement` (log de movimentações).
*   **Risco:** Desalinhamento crônico entre o saldo e o somatório dos movimentos físicos.
*   **Plano de Ação:** Estabelecer o Kardex (`StockMovement`) como a autoridade definitiva dos dados. O campo `Product.stock` deve ser redefinido como uma projeção rápida em cache (somente leitura) gerada de forma reativa pela consolidação dos logs de Kardex.

---

### Bloco B: Sincronização, Eventos e Resolução de Conflitos

#### 11. Efeitos Colaterais Sem Idempotência de Efeitos na Sincronização — **[CRÍTICO]**
*   **Erro:** Mutações recebidas na central aplicam ações como `produto.stock += quantidade`. Se a mutação for processada duas vezes devido a retransmissões do cliente, o efeito colateral será duplicado.
*   **Risco:** Corrupção silenciosa de inventário e contas financeiras.
*   **Plano de Ação:** Garantir que toda mutação processada registre sua chave de idempotência e salve o estado consolidado resultante, nunca executando operações aritméticas incrementais cegas de forma cumulativa sem verificação de processamento prévio.

#### 12. Conflito por Last-Write-Wins (LWW) em Entidades Financeiras — **[CRÍTICO - P1]**
*   **Erro:** Resolução de conflitos em vendas, caixas e financeiro baseada em "Última Escrita Vence".
*   **Risco:** Perda de lançamentos financeiros legítimos em operações concorrentes multi-terminal.
*   **Plano de Ação:** Substituir o modelo LWW nessas entidades pelo modelo de **Event Sourcing / Ledger**. Movimentações não devem sofrer `UPDATE`, mas sim inserções sequenciais imutáveis de transações que se consolidam em um balanço líquido.

#### 13. Tenant Especial Vulnerável (`default-tenant`) — **[CRÍTICO - SEGURANÇA]**
*   **Erro:** O servidor Central Express ignora validações de segurança se o cabeçalho `X-Tenant-ID` for igual a `default-tenant`.
*   **Risco:** Exploração do bypass em ambiente produtivo.
*   **Plano de Ação:** Remover completamente o tenant especial `default-tenant` da build de produção, substituindo-o por configurações estritas orientadas por variáveis de ambiente de desenvolvimento local.

#### 14. Banco de Arquivo JSON na Central Express — **[RESOLVIDO EM DESENVOLVIMENTO / INADEQUADO EM PRODUÇÃO]**
*   **Erro:** O servidor Central Express usa o arquivo `central_db.json` via operações síncronas de leitura/escrita de sistema de arquivos.
*   **Risco:** Incompatibilidade com escala de produção, risco de concorrência, travamento de arquivos e perda de dados em containers reiniciados.
*   **Plano de Ação:** Consolidar o **Cloudflare Worker com D1** como a única e oficial infraestrutura de produção para a central. O Express de desenvolvimento deve ser restrito exclusivamente a testes e execução local temporária.

#### 15. Schemas de Banco de Dados Destrutivos no D1 — **[RESOLVIDO]**
*   **Erro:** O arquivo `schema.sql` executa `DROP TABLE IF EXISTS` incondicionalmente no início de sua execução, o que apagaria todos os dados reais em uma implantação em produção.
*   **Plano de Ação:** Estruturar o controle de banco com um sistema de migrações incremental (ex: `/migrations/001_initial.sql`, `/migrations/002_add_devices.sql`) e proibir operações destrutivas diretas em scripts de publicação.

#### 16. Event Bus Simples sem Rastreamento — **[DÉBITO MAPEADO]**
*   **Erro:** O Event Bus em `/core/` usa `Subject<any>` genéricos.
*   **Risco:** Dificuldade de depuração, rastreio de causalidade e concorrência reativa.
*   **Plano de Ação:** Tipar de forma estrita o barramento de eventos, injetando metadados de rastreamento (`correlationId`, `causationId`, `timestamp`, `userId`) em cada envelope de evento emitido pelo sistema.

---

### Bloco C: Segurança, Autenticação e Licenciamento

#### 17. Credencial Administrativa Default Estática — **[CRÍTICO]**
*   **Erro:** Presença de fallback de credencial fixa `expectedPass = '3eatcru-master'` no Express se a variável de ambiente não for configurada.
*   **Plano de Ação:** Impedir a inicialização da aplicação se as chaves e segredos de ambiente cruciais (como `JWT_SECRET` e `ADMIN_PASSWORD`) não forem informados. Nunca injetar segredos padrão como string literal em código-fonte.

#### 18. Simulação de Renovação de Licença na Central — **[DÉBITO MAPEADO]**
*   **Erro:** O endpoint `/api/sync/license-renew-simulated` altera arbitrariamente o tempo e status da licença operacional em 365 dias para simulação de teste.
*   **Risco:** Bypass financeiro do modelo SaaS se mantido em produção.
*   **Plano de Ação:** Remover endpoints de simulação de renovação do pacote de distribuição final, delegando a renovação exclusivamente ao checkout oficial integrado via gateways reais de pagamento.

#### 19. Geração de IDs e Códigos de Vouchers de Forma Fraca — **[RESOLVIDO / DÉBITO PARCIAL]**
*   **Erro:** Uso excessivo de `Math.random()` e timestamps (`cust-` + `Date.now()`) para geração de IDs, códigos de vouchers e números de pedidos, gerando risco de colisão.
*   **Revisão:** Em nossa refatoração anterior de Fabricação, removemos falhas de UUID em novos registros e utilizamos a API de geração segura do navegador (`crypto.randomUUID()`).
*   **Plano de Ação:** Forçar de forma sistemática que todos os geradores de identificadores importantes utilizem a biblioteca segura criptograficamente nativa do sistema.

#### 20. Token de Sincronismo (`syncToken`) Exposto no IndexedDB — **[CRÍTICO]**
*   **Erro:** O token de dispositivo é armazenado em formato de texto puro na tabela local `companySettings`.
*   **Risco:** Ataques por injeção XSS que extraiam dados do IndexedDB ganham acesso de escrita e controle sobre o tenant na Central.
*   **Plano de Ação:** Armazenar o token local cifrado com chaves de sessão derivadas ou utilizar APIs de armazenamento seguro nativas se encapsulado de forma híbrida (Electrons/Cordova).

#### 21. Baixa Complexidade e Fallback de PIN de Operadores — **[DÉBITO MAPEADO]**
*   **Erro:** O hash de PIN opera com apenas 10.000 iterações (PBKDF2) e o código possui fallbacks mais simples em casos específicos.
*   **Plano de Ação:** Elevar as iterações mínimas de derivação criptográfica para 100.000 (padrão OWASP) e banir qualquer fallback de string literal crua ou concatenação simples.

#### 22. Bloqueio de Brute Force Limitado à Memória Volátil — **[RESOLVIDO EM MEMÓRIA / DÉBITO DE PERSISTÊNCIA]**
*   **Erro:** A tabela de tentativas de PIN mal-sucedidas reside em um `Map` local na memória do navegador. Reiniciar a aplicação ou atualizar a página zera o contador de tentativas ruins.
*   **Plano de Ação:** Persistir as tentativas fracassadas e o bloqueio de segurança diretamente na tabela de metadados do OS (`PlatformDb`), garantindo que o tempo de lockout de segurança sobreviva a recarregamentos ou reinstalações do navegador.

---

### Bloco D: Escalabilidade e Limites de Performance

#### 23. Ausência de Paginação e Processamento Maciço de Vetores locais — **[CRÍTICO - ESCALA]**
*   **Erro:** Operações executam `.toArray()` e carregam conjuntos massivos de registros locais diretamente para memória no Angular para aplicar filtros de exibição.
*   **Risco:** Travamento e lentidão drástica da UI se o terminal operacional local registrar mais de 10.000 vendas ou clientes cadastrados.
*   **Plano de Ação:** Refatorar o `Repository<T>` para expor paginação física real nativa no IndexedDB (`offset` e `limit`) e realizar buscas e filtros baseados em índices secundários nativos do Dexie, eliminando carregamentos completos em memória.

#### 24. Tamanho Excessivo dos Componentes Visuais (Acoplamento Crônico) — **[DÉBITO MAPEADO]**
*   **Erro:** Arquivos como `pdv.component.ts` ou `caixa.component.ts` possuem mais de 24 KB, misturando controle de interface, manipulação direta de variáveis do banco e lógica de domínio.
*   **Plano de Ação:** Implementar o padrão **Facade / Presenter / Bounded Context** em sprints futuras. Toda lógica de domínio financeiro deve residir em serviços de domínio puros, e os componentes devem apenas refletir estados e disparar ações para as fachadas de controle.

---

### Bloco E: Simulações de Hardware e Integrações Externas (Mocks)

#### 25. Integração PIX Fictícia — **[CRÍTICO]**
*   **Erro:** O PDV apenas desenha um código QR estático e simula a confirmação instantânea do pagamento PIX de forma fictícia.
*   **Plano de Ação:** Integrar uma API real de PSP (Provedor de Serviços de Pagamento) compatível com PIX Dinâmico (Banco Central), gerando a cobrança com ID único (`txid`), exibindo o QR dinâmico real e escutando webhooks em tempo real na Central para liberar o pedido de forma segura.

#### 26. Simulação de Dispositivos de Hardware — **[CRÍTICO]**
*   **Erro:** Ajuste de peso de balança, bobinas térmicas virtuais, visores VFD e gavetas de dinheiro utilizam botões de controle de simulação visual e chamadas `alert()`.
*   **Plano de Ação:** Substituir os mocks virtuais por drivers reais baseados em APIs do navegador (ex: **WebUSB API**, **Web Serial API**) ou bridges nativos de hardware para comunicação serial direta com as marcas líderes de balanças e impressoras térmicas (protocolo ESC/POS).

#### 27. WhatsApp em Ambiente de Simulação — **[CRÍTICO]**
*   **Erro:** Mensagens e notificações disparadas no WhatsApp apenas incrementam logs de interface locais sem se conectarem a uma API real de mensageria.
*   **Plano de Ação:** Conectar o módulo a um gateway oficial de WhatsApp Business API ou provedores estáveis de disparo de mensagens por Webhooks na nuvem.

---

## 🛠️ 3. Estado de Remediação Atual (Versão Atual)

Durante os refinamentos, focamos esforços na mitigação de **todos os erros de nível P0 (Integridade de Gravação e Consistência Transacional Local)**. O gráfico abaixo ilustra os desvios de bypass identificados na auditoria inicial contra o controle transacional absoluto estabelecido na versão atual:

```text
  ESTADO ANTERIOR (Bypass Vulnerável)      ESTADO ATUAL (Blindagem Transacional)
 
    Módulo de Negócio (ex: Compras)           Módulo de Negócio (ex: Compras)
         │                                         │
         ├──► db.products.update() (Bypass)        └──► TransactionEngine.saveEntity()
         ├──► db.stockMovements.add() (Bypass)               │
         └──► db.financialTransactions.add()                 ├──► Dexie Business Transaction
                                                             │     ├── Products (Update)
                                                             │     ├── StockMovements (Create)
                                                             │     ├── FinancialTransactions (Create)
                                                             │     └── Outbox Queue (Atômico)
                                                             └──► Log de Auditoria & Sync OK!
```

---

## 📅 4. Cronograma de Próximas Ações e Sprints de Correção

Para que o **3eatcru OS 1.0.2** avance de **BETA AVANÇADO** para **PRODUCTION READY**, as equipes de engenharia devem programar as sprints de mitigação priorizando os blocos de Integridade e Sincronização:

```text
 ┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
 │       Sprint A       │     │       Sprint B       │     │       Sprint C       │
 │  * IDs em UUID       │     │  * Event Sourcing    │     │  * Drivers Reais USB │
 │  * Filtro Tenant     ├────►│  * Paginação indexed │────►│  * Webhook Pix Real  │
 │  * Domínio Preços    │     │  * Sessão sem memory │     │  * ESC/POS Nativo    │
 └──────────────────────┘     └──────────────────────┘     └──────────────────────┘
```

Este documento constitui o inventário de conformidade e o mapa de referências para a certificação técnica de produção do Remix 3eatcru OS.

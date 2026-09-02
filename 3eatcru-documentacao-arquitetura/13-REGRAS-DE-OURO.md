# Regras de Ouro da Arquitetura do Ecossistema

Este documento estabelece as leis arquiteturais não-negociáveis de todo o ecossistema **3eatcru**, as quais devem reger qualquer desenvolvimento de código futuro para evitar débitos técnicos e perdas de integridade de sistema.

---

## 🏛️ As Leis de Dependências Canônicas

A hierarquia de dependência e fluxo do ecossistema deve obedecer estritamente a seguinte diretriz:

```text
       APLICATIVOS (Módulos de Negócio) ──► 3EATCRU OS (Plataforma Local)
                                                    │
                                                    ▼
       HQ (Console Administrativo) ──────► CENTRAL (Infraestrutura Nuvem)
```

### 1. Primeira Lei: Desacoplamento Físico de Apps
> **Os Aplicativos dependem do OS (`APPS → OS`), mas o OS nunca conhece os Apps.**
*   **Significado Prático:** O **3eatcru OS** deve iniciar, compilar e rodar todas as suas funções essenciais (Área de trabalho, janelas, sincronização, segurança física, logins e pareamentos) de forma perfeita sem que exista um único arquivo de código-fonte de qualquer aplicativo de negócio no projeto.
*   **Proibição:** É estritamente proibido realizar importações estáticas diretas de componentes operacionais (ex: `PdvComponent`, `EstoqueComponent`) em arquivos estruturais da plataforma, como `desktop.shell.ts`. A injeção de aplicativos deve ocorrer de forma dinâmica sob o contrato de `AppManifest`.

### 2. Segunda Lei: O Core Database é da Plataforma
> **O motor do banco local fornece o Storage Engine, mas não abriga schemas de negócios específicos.**
*   **Significado Prático:** O banco operacional nativo do Core deve gerenciar apenas as tabelas necessárias para o próprio sistema rodar (`outbox`, `operators`, `companySettings`, `auditLogs` e `hardwareDevices`).
*   **Proibição:** O Core do OS não deve declarar tabelas específicas de aplicações de negócios (como cadastros de lead de CRM, mesas de restaurantes ou comissões de funcionários). Cada aplicativo de negócio deve gerenciar e migrar seu próprio esquema lógico de dados por meio da API de Storage fornecida pelo OS.

### 3. Terceira Lei: HQ e Central são Sistemas Distintos
> **O HQ é o painel de visualização administrativa. A Central é a infraestrutura de serviços.**
*   **Significado Prático:** Toda lógica de validação de licenças, regras de sincronização, deduplicação e barramento de autenticação reside na Central de Serviços Headless. O HQ consome essas APIs como um cliente estratégico de rede (`HQ → CENTRAL`).
*   **Proibição:** É proibido misturar UIs ou painéis de controle administrativos com a camada lógica de barramento da Central. O OS nunca depende de nenhuma interface visual do HQ para operar.

---

## 🔒 Leis de Segurança e Offline-First

### 4. Quarta Lei: Preservação de Dados Offline
> **A indisponibilidade de rede ou expiração comercial nunca destrói dados do cliente localmente.**
*   **Significado Prático:** O **3eatcru OS** opera de forma totalmente autônoma offline. Caso ocorra expiração do trial ou da licença, o sistema executa um bloqueio estritamente visual operacional. O banco IndexedDB local permanece intacto e preservado, garantindo zero risco de perda de dados históricos do lojista.

### 5. Quinta Lei: Zero-Trust Identity
> **O cliente nunca dita sua identidade ou tenant. A Central é a autoridade absoluta.**
*   **Significado Prático:** O terminal local nunca envia IDs de tenant (`companyId`) em texto limpo ou cabeçalhos arbitrários que possam ser facilmente adulterados no DevTools do navegador. Toda requisição é autorizada e direcionada por meio de tokens criptográficos assinados (`syncToken`), cuja validação e mapeamento de banco ocorrem de forma opaca no servidor.

### 6. Sexta Lei: Idempotência de Mutações
> **Toda mutação de dados local possui integridade transacional atômica e ID de idempotência único.**
*   **Significado Prático:** Transações críticas (como registrar uma venda, reduzir estoque e movimentar o caixa) operam de forma atômica no cliente. Se uma rede instável causar retransmissões redundantes na outbox, a Central descarta duplicados de forma limpa, evitando duplicidades de faturamento.

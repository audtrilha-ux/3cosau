# 3eatcru OS — Visão Geral do Ecossistema

Este documento descreve as bases conceituais e a divisão arquitetural canônica de todo o ecossistema **3eatcru**, estabelecendo as fronteiras entre a plataforma cliente, a infraestrutura em nuvem, a gestão administrativa e os aplicativos verticais de negócios.

---

## 🏛️ Divisão Arquitetural Canônica

O ecossistema **3eatcru** é composto por quatro elementos fundamentais, rigorosamente desacoplados e com responsabilidades bem definidas:

```text
                           DOCUMENTAÇÃO CANÔNICA
                                     │
                                     │ define contratos e arquitetura
                                     ▼

                             ┌───────────────┐
                             │    CENTRAL    │
                             │ Infraestrutura│
                             └───────┬───────┘
                                     │
                          ┌──────────┴──────────┐
                          │                     │
                          ▼                     ▼
                         HQ                 3EATCRU OS
                   Gestão Admin              Plataforma
                          │                     │
                          │                     │ Platform API / SDK
                          │                     ▼
                          │                 APLICATIVOS
                          ▼               (Módulos de Negócio)
                Gestão Estratégica
```

### 1. 3EATCRU OS (A Plataforma Operacional Cliente)
O **3eatcru OS** é o sistema operacional e plataforma de runtime local executado no estabelecimento comercial do cliente. Projetado sob a filosofia *Offline-First*, ele encapsula toda a complexidade de interface gráfica de janelas, gerenciamento de ciclo de vida de aplicações locais, persistência tolerante a falhas, impressão e integração com hardware.

*   **Responsabilidades:** Kernel, Shell, Desktop, Windows Manager, Taskbar, App Runtime & Lifecycle, Session & Local Security, Storage Engine (Dexie/IndexedDB), Offline-First Engine, Sync Client (Push/Pull), Hardware, Impressão, Notificações e Diagnóstico.
*   **Regra de Ouro:** O 3eatcru OS é totalmente independente e **deve iniciar e compilar perfeitamente mesmo sem nenhum aplicativo de negócio instalado**.

### 2. CENTRAL (A Infraestrutura de Serviços em Nuvem)
A **Central** representa a infraestrutura mestre, os barramentos de mensageria, segurança, persistência em nuvem e APIs do ecossistema. Ela opera estritamente sem interface de usuário (headless) e atua como a autoridade absoluta do sistema.

*   **Responsabilidades:** APIs Centrais, Identity Provider (Firebase Auth Integration), Authentication Infrastructure, Licensing (Geração e validação de chaves assinadas), Device Registry (Pareamento e revogação de terminais), Synchronization Engine (Deduplicação, Idempotência, Deltas), Updates Delivery, App Registry, Cloud Services, Backup & Restore e Telemetry.
*   **Regra de Ouro:** A Central decide **quem** pode usar a plataforma e **o que** está habilitado, funcionando como o barramento de infraestrutura de alta performance do ecossistema.

### 3. HQ (O Ambiente de Gestão Administrativa e Estratégica)
O **HQ (Headquarters)** é o sistema administrativo voltado ao franqueador, proprietário ou equipe de retaguarda estratégica. É uma aplicação de gestão de recursos de rede que consome as APIs da Central para monitoramento.

*   **Responsabilidades:** Administração global de empresas, Gestão de operadores de alta patente, Controle de planos e licenciamento, Monitoramento de integridade de dispositivos pareados, Auditoria administrativa, Relatórios consolidados globais, Painéis estratégicos (BI) e Faturamento.
*   **Regra de Ouro:** O HQ é um consumidor da Central (`HQ → CENTRAL`). O HQ não fornece serviços operacionais para os PDVs, nem implementa as APIs de sincronização. **O HQ é totalmente desacoplado do 3eatcru OS.**

### 4. APLICATIVOS (Os Módulos de Negócio Verticais)
Os **Apps** são produtos modulares de negócio que resolvem fluxos específicos dos lojistas (ex: Varejo, Restaurante/Mesas, CRM, Compras, Delivery, Serviços). Eles não possuem permissão para acessar o hardware do dispositivo ou a internet diretamente; em vez disso, utilizam as APIs públicas e o SDK disponibilizado pelo **3eatcru OS**.

*   **Responsabilidades:** Telas de operação diária, fluxos lógicos de negócio, regras de formulários, representações de domínio local (ex: comanda de mesas, funil de CRM).
*   **Regra de Ouro:** Os Apps dependem exclusivamente do OS (`APPS → OS`). **O OS nunca deve importar ou depender diretamente de um App de negócio.**

---

## 🌐 Princípios Universais do Ecossistema

1.  **Independência de Rede (Offline-First):** O **3eatcru OS** funciona de forma 100% autônoma. Quedas de internet nunca impedem o registro de transações, vendas, aberturas de caixas ou impressões locais.
2.  **Segurança Baseada em Prova (Zero-Trust):** O terminal local nunca dita sua identidade ou tenant. A Central valida de forma estrita cada conexão através de tokens de pareamento (`syncToken`) e chaves assimétricas de licenciamento.
3.  **Resolução Criptográfica de Licença:** O OS valida a validade do software localmente através de chaves públicas, validando assinaturas digitais geradas de forma inviolável pela Central.
4.  **Consistência por Deltas:** Alterações em domínios críticos (estoque, caixa) operam via transações imutáveis e acúmulos de deltas, eliminando conflitos de concorrência e perdas financeiras na sincronização.

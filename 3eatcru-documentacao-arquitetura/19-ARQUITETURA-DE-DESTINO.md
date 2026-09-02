# Arquitetura de Destino do Ecossistema

Este documento especifica a arquitetura ideal de destino (Target Architecture) para o ecossistema **3eatcru**, fornecendo os diagramas de blocos, de fluxos e de dependências para unificação da plataforma sob princípios rigorosos de isolamento e modularidade.

---

## 🏛️ 1. Diagrama de Dependências Canônico

Na arquitetura ideal, cada componente ocupa uma camada isolada de responsabilidade de forma unidirecional, proibindo qualquer ciclo ou dependência cruzada:

```text
               ┌─────────────────────────────────────────┐
               │          DOCUMENTAÇÃO CANÔNICA          │
               │      (Define contratos e protocolos)    │
               └────────────────────┬────────────────────┘
                                    │
                                    ▼
               ┌─────────────────────────────────────────┐
               │           CENTRAL DE SERVIÇOS           │
               │   (APIs Headless, Licensing, Firebase)  │
               └────────────────────┬────────────────────┘
                                    │
                         ┌──────────┴──────────┐
                         │                     │
                         ▼                     ▼
               ┌──────────────────┐  ┌──────────────────┐
               │      HQ WEB      │  │    3EATCRU OS    │
               │ (Console Admin)  │  │ (Platform Shell) │
               └──────────────────┘  └─────────┬────────┘
                                               │
                                               ▼
                                     ┌──────────────────┐
                                     │  APLICATIVOS     │
                                     │ (Varejo, CRM...) │
                                     └──────────────────┘
```

---

## 🚦 2. Detalhamento Técnico das Camadas

### A. CENTRAL (Headless Cloud Infrastructure)
A Central reside inteiramente em infraestrutura em nuvem descentralizada e escalável (Cloudflare Workers + D1 SQL Database).
*   **Acesso:** Protegido por criptografia HTTPS e autenticação estrita baseada em tokens JWT gerados via Firebase Auth.
*   **Responsabilidade:** Receber e deduplicar mutações do outbox, emitir e revogar tokens de dispositivos (`syncToken`), assinar criptograficamente arquivos de licença comercial e estender prazos de Trial.

### B. HQ (Headquarters - Administration Web UI)
É a aplicação front-end voltada ao proprietário ou equipe administrativa para gestão global de redes de estabelecimentos comerciais.
*   **Dependência:** Comunica-se exclusivamente com as APIs públicas expostas pela Central de Serviços (`HQ → CENTRAL`).
*   **Isolamento:** O HQ não possui relação física de código-fonte nem de dependência direta com o **3eatcru OS**. Ele apenas configura as permissões e licenças na Central, que serão posteriormente baixadas e consumidas pelos terminais operacionais físicos.

### C. 3EATCRU OS (The Client Platform Core)
O **3eatcru OS** é o sistema operacional local do cliente. Ele deve ser totalmente agnóstico e desconhecer regras de negócio ou telas específicas das verticais.
*   **Responsabilidade:** Kernel de controle de janelas, gerenciamento de ciclo de vida das janelas locais de Apps, segurança por PIN, adaptador transacional local de armazenamento SQLite/Dexie, fila sequencial outbox, sincronismo de dados com a Central e interfaces abstratas de drivers de hardware (Impressão ESC/POS, gavetas de dinheiro, balanças).
*   **Isolamento:** O OS não importa nem compila arquivos de código dos Apps de negócio. Ele é o runtime hospedeiro.

### D. APLICATIVOS (Modular Business Apps)
Os Apps são pacotes modulares de visualização e regras de negócios específicas (Varejo, Restaurante, Serviços, CRM, etc.).
*   **Dependência:** Os Apps dependem unicamente das APIs públicas expostas e fornecidas pelo Core do **3eatcru OS** (`APPS → OS`).
*   **Acesso a Baixo Nível:** Os Apps nunca invocam a internet ou portas físicas de impressoras diretamente. Toda gravação em banco, sincronismo para a nuvem, disparo de impressões ou notificações é efetuada por meio do consumo de contratos de barramentos fornecidos pelo OS.

---

## 💾 3. Arquitetura de Storage Modularizada (Banco de Dados)

Na arquitetura ideal de destino, o banco de dados deixa de ser monolítico. O OS fornece o Storage Engine e cada módulo hospeda suas próprias instâncias:

```text
               ┌────────────────────────────────────────┐
               │          STORAGE ENGINE (OS)           │
               └───────────────────┬────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │ (Cria instâncias Dexie) │ (Cria instâncias Dexie) │
         ▼                         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   os_storage    │       │ app_retail_db   │       │   app_crm_db    │
│ (Core Platform) │       │ (Varejo App)    │       │   (CRM App)     │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ companySettings │       │ products        │       │ crmLeads        │
│ operators       │       │ sales           │       │ whatsappTempl...│
│ outbox          │       │ stockMovements  │       └─────────────────┘
│ auditLogs       │       │ cashSessions    │
└─────────────────┘       └─────────────────┘
```
1.  O Core gerencia as tabelas lógicas de plataforma no banco principal `os_storage`.
2.  No momento em que o **App Varejo** é instalado ou executado, o Storage Engine do OS provisiona e monta uma base local isolada de dados (`app_retail_db`) para persistência de produtos, faturamentos, movimentos de estoque e turnos de caixa de forma totalmente separada do banco nativo do OS.
3.  O mesmo princípio aplica-se ao **App CRM** que cria a base `app_crm_db` para armazenar funis de leads de forma isolada, eliminando poluição de tabelas e facilitando atualizações estruturais sem quebra de dependências.

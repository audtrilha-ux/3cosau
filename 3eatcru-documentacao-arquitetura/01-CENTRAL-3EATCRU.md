# Central — Infraestrutura de Serviços e barramentos

Este documento detalha o papel da **Central** como camada de infraestrutura de nuvem, segurança e mensageria, especificando suas fronteiras rigorosas e diferenciando o seu papel do painel administrativo do **HQ**.

---

## 🏗️ Responsabilidades da Central

A Central é uma camada essencialmente headless (sem interface) e de alta confiabilidade, responsável por:

1.  **API Gateway:** Ponto único de entrada para todas as comunicações seguras do ecossistema.
2.  **Identity Management (Firebase Auth):** Infraestrutura de autenticação em nuvem para administradores e operadores globais.
3.  **Licensing Engine:** Geração, expiração e assinatura criptográfica de licenças comerciais e trials.
4.  **Synchronization Hub:** Endpoint de mensageria idempotente bidirecional (`/api/sync/batch` e `/api/sync/pull`).
5.  **Device Registry:** Controle de pareamento, geração de tokens de segurança (`syncToken`) e fingerprints físicos.
6.  **App Registry:** Catálogo e controle de compatibilidade e versões dos aplicativos instaláveis.

---

## 🚦 Diferenciação Canônica: Central vs. HQ

Atualmente, o projeto possui uma interface visual acessível via cabeçalho chamada "Central 3eatcru" (`CentralComponent`). Sob a nova arquitetura canônica, as responsabilidades devem ser divididas da seguinte forma:

| Funcionalidade | Responsabilidade da CENTRAL (Infraestrutura) | Responsabilidade do HQ (Interface Visual) |
| :--- | :--- | :--- |
| **Autenticação** | Fornece e valida tokens JWT via Firebase Auth | Tela de login, formulários e manipulação do token no navegador |
| **Licenciamento** | Emite a assinatura criptográfica e calcula expirações | Dashboard de faturamento, compra de planos e listagem de licenças |
| **Dispositivos** | Valida o `syncToken` de requisições no endpoint de API | Painel para desautorizar ou revogar um terminal físico |
| **Sincronismo** | Recebe, processa e concilia deltas em lote (Idempotente) | Tela de monitoramento de integridade e auditoria de dados |

---

## 📊 Status Atual da Implementação vs. Alvo

### 🟢 IMPLEMENTADO (Em Produção Local)
*   **Barramento de Sincronização Lote (`/api/sync/batch`):** Processamento transacional de pacotes com suporte à rejeição de mutações conflitantes.
*   **Controle de Sincronismo de Saída (Pull Sync `/api/sync/pull`):** Envio incremental de alterações com cursor lógico temporal.
*   **Deduplicação de Mutações (Idempotência):** Verificador baseado em chaves e hashes exclusivos.
*   **Emissão e Pareamento de Dispositivos (`/api/central/devices/pair`):** Geração de `syncToken` criptográfico exclusivo por terminal físico.
*   **Autoridade de Licenciamento de Trial (`/api/sync/license-check`):** Endpoint de validação periódica da licença lojista de forma segura na nuvem.

### 🟡 PARCIALMENTE IMPLEMENTADO (Legado e Simulações)
*   **Mocks de Armazenamento Centralizado:** As tabelas da Central operam sobre uma infraestrutura local temporária Express (`server.ts`) armazenada em mapas voláteis na memória do servidor e arquivos locais.
*   **Fronteira com o HQ:** O componente visual de gestão atual (`CentralComponent`) está amalgamado com o backend Express sob o nome de Central, necessitando de divisão entre a camada de APIs (Central) e o console administrativo (HQ).

### 🔵 PLANEJADO (Arquitetura de Destino)
*   **Cloudflare Workers & D1:** Migração completa da infraestrutura headless Express para processadores serverless edge de alta concorrência com persistência SQL durável no Cloudflare D1.
*   **Assinatura Assimétrica de Licença:** Emissão de tokens de licenciamento assinados digitalmente com par de chaves privadas (Central) e chaves públicas (OS), permitindo validações 100% offline contra fraudes locais de relógio do sistema.

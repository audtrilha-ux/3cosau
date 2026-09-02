# Central API e Banco de Dados (Nuvem)

Este documento descreve a infraestrutura de rede, os esquemas de APIs e a estrutura do banco de dados central (nuvem) do ecossistema, especificando as garantias de segurança e isolamento de tenants.

---

## 🏛️ Infraestrutura e Comunicação Headless

A **Central** opera como o cérebro headless do ecossistema, fornecendo endpoints de alta eficiência para comunicação dos terminais físicos clientes e do console de retaguarda **HQ**.

*   **Padrão de API:** RESTful JSON trafegando sob canais criptografados obrigatórios (`HTTPS`).
*   **Autorização:** Controle rígido baseado no cabeçalho `Authorization: Bearer <token>`, onde o token identifica e autoriza o dispositivo e a empresa.

---

## 🔒 Isolamento de Tenants e Resolução de Segurança

### A Vulnerabilidade do Cabeçalho `X-Tenant-ID`
*   **Problema Histórico:** Versões de simulação e desenvolvimento do backend costumavam confiar no cabeçalho opcional `X-Tenant-ID` enviado pelo próprio cliente (3eatcru OS) para direcionar as mutações e requisições para o banco de dados correspondente. Isso era uma vulnerabilidade grave (P0), pois usuários mal-intencionados podiam forjar cabeçalhos para ler ou gravar dados de outras empresas.
*   **Resolução Arquitetural (Implementada):**
    *   O **3eatcru OS** agora utiliza o token exclusivo de sincronização (`syncToken`) gerado de forma assinada e autoritativa no momento de pareamento do terminal.
    *   Toda requisição para `/api/sync/batch` ou `/api/sync/pull` deve enviar o token correspondente sob a diretiva `Authorization: Bearer <syncToken>`.
    *   O backend recebe o token, resolve de forma criptográfica e inviolável a qual **Empresa (companyId)** e **Tenant** o dispositivo pertence, isolando as transações na camada de persistência.
    *   Se o cabeçalho `X-Tenant-ID` for enviado, ele é verificado de forma cruzada contra a empresa proprietária do token. Caso divirjam, a Central rejeita a conexão imediatamente com erro `HTTP 403 Forbidden`.

---

## 📊 Status de Implementação

### 🟢 IMPLEMENTADO (Servidor de Desenvolvimento Integrado)
*   **Endpoints de Sincronismo e Operações:**
    *   `POST /api/sync/batch` - Recepção e consolidação atômica de lotes de outbox locais.
    *   `GET /api/sync/pull` - Sincronização incremental baseada no timestamp do cursor local do cliente.
    *   `POST /api/central/devices/pair` - Solicitação de pareamento físico do dispositivo com fingerprint de hardware e emissão de `syncToken`.
    *   `GET /api/sync/license-check` - Validação do status comercial e dias restantes do Trial.
    *   `POST /api/sync/license-renew-simulated` - Renovação ativa da assinatura da empresa no banco de dados.
*   **Isolamento Transacional por Tenant:** O backend Express local (`server.ts`) gerencia e isola dados lógicos e tabelas através de identificadores estruturados por tenant, protegendo o tráfego concorrente entre diferentes estabelecimentos.

### 🟡 PARCIALMENTE IMPLEMENTADO
*   **Banco em Nuvem Volátil:** O armazenamento centralizado do servidor de desenvolvimento Express opera em dicionários de memória do processo Node.js e escritas locais de persistência simulada.

### 🔵 PLANEJADO (Arquitetura de Destino - Cloudflare Workers & D1)
*   **Cloudflare Workers Serverless:** Migração completa da lógica headless para microsserviços Workers implantados na borda da internet, proporcionando latência ultra reduzida e escala automática sob concorrência em tempo real.
*   **Cloudflare D1 SQL Serverless:** Persistência centralizada em banco SQLite distribuído na nuvem, otimizando o isolamento transacional de múltiplos tenants em arquivos e chaves SQL isoladas fisicamente para máxima segurança e baixo custo operacional.

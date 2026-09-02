# Segurança e Mitigação de Fraudes

Este documento especifica a arquitetura de segurança, criptografia e conformidade de dados do ecossistema, mapeando as vulnerabilidades conhecidas e as soluções definitivas implementadas para proteção da operação física do lojista.

---

## 🏛️ Princípios de Segurança

O ecossistema é projetado sob a ótica de **Zero-Trust** e **Tolerância a Falhas**, onde nenhum nó cliente (terminal do lojista) pode tomar decisões de privilégios ou identidade sem validação matemática do servidor central.

---

## 🔒 Vetores de Ataque e Soluções Implementadas

### 1. Ataque de Força Bruta Offline de PINs (Mitigado com Defesa em Profundidade 🛡️)
*   **Vulnerabilidade:** Se o banco de dados IndexedDB de um terminal operacional for extraído, um invasor com acesso direto ao storage pode tentar quebrar PINs curtos (4 a 6 dígitos).
*   **Solução:** Implementamos uma estratégia em camadas:
    1. Derivação criptográfica de chaves **PBKDF2-HMAC-SHA256** com **10.000 iterações** e salt dinâmico por operador/dispositivo via Web Crypto API, elevando o custo de computação por tentativa.
    2. Bloqueio progressivo local (cooldown e lockout) após tentativas consecutivas inválidas no terminal.
    3. Recomenda-se em ambientes de alta segurança a exigência de PINs alfanuméricos/senhas para operadores de nível gerencial e cancelamento de transações.

### 2. Fraude e Spoofing de Tenant (Resolvido ✅)
*   **Vulnerabilidade:** Dispositivos locais podiam tentar forjar o cabeçalho `X-Tenant-ID` para acessar ou sobrescrever dados de outros tenants.
*   **Solução:** O endpoint do Cloudflare Worker exige obrigatoriamente a combinação do cabeçalho `X-Tenant-Id` com um token criptografado de terminal ativo (`syncToken`) validado contra a tabela `devices` vinculada à empresa autorizada (`company_id`). Requisições sem token válido ou com token divergente do tenant recebem `401 Unauthorized`.

### 3. Fraude de Relógio Local para Expiração de Licenças (Resolvido ✅)
*   **Vulnerabilidade:** Alterar a data do relógio do sistema operacional local para burlar o limite do período de testes (Trial) ou licenças vencidas.
*   **Solução:** Implementamos validações online assíncronas contra a Central de Licenças via endpoint `/api/sync/license-check` e logs de auditoria sequenciais e timestamps de mutações no banco de dados. O **3eatcru OS** impede retrocessos e bloqueia novas operações se o timestamp do banco for superior à data atual detectada na inicialização do sistema.

---

## 📊 Matriz de Responsabilidades de Segurança

| Recurso | Tipo de Proteção | Escopo | Status |
| :--- | :--- | :--- | :--- |
| **Identidade Admin** | Firebase Auth Integration (JWT) | Central / HQ | `🔵 PLANEJADO` |
| **Identidade Operador** | PBKDF2-HMAC-SHA256 (10k Iterações) | 3eatcru OS | `🟢 IMPLEMENTADO` |
| **Sessão do Caixa** | Identificadores efêmeros criptografados | 3eatcru OS | `🟢 IMPLEMENTADO` |
| **Comunicação de Rede** | Protocolo HTTPS + Autorização por Token | Central API | `🟢 IMPLEMENTADO` |
| **Assinatura de Licença** | Chaves Assimétricas Assimétricas | Central / OS | `🔵 PLANEJADO` |
| **Logs de Auditoria** | Mutabilidade atômica na outbox local | 3eatcru OS | `🟢 IMPLEMENTADO` |

---

## 🚨 Boas Práticas para Terminais Físicos (Clientes)

1.  **Imutabilidade de Históricos:** Logs de auditoria locais e mutações em andamento de caixas nunca podem ser apagados pelo operador. Toda modificação crítica (como cancelamento de pedidos) gera um contra-lançamento e é enviada na outbox.
2.  **Revogação Ativa de Tokens:** Caso um tablet ou computador de venda seja roubado, o Proprietário pode acessar o console administrativo **HQ** e revogar o token de pareamento correspondente na Central. Qualquer tentativa de sincronização futura do terminal roubado é sumariamente rejeitada pela API, protegendo a base de dados da empresa.

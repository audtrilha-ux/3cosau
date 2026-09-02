# Identidade, Usuários e Autenticação por PIN

Este documento especifica a arquitetura de segurança para controle de identidade de usuários no ecossistema, distinguindo a autenticação global realizada na nuvem da autenticação física ágil por teclado numérico (PIN) nos terminais operacionais do **3eatcru OS**.

---

## 🏛️ Diretrizes de Autenticação e Perfis

O ecossistema divide as responsabilidades de identificação e privilégios de acordo com o escopo operacional:

1.  **Identidade Administrativa Global (Central):** Utilizada por franqueadores, proprietários de estabelecimentos ou equipe de retaguarda técnica para login na Central e no console **HQ**. Opera via credenciais seguras de e-mail e senha.
2.  **Identidade Operacional Local (3eatcru OS):** Utilizada por caixas, gerentes e operadores locais para identificação ágil por meio de teclados numéricos simplificados (PIN de 4 a 6 dígitos).

---

## 🚦 Divisão de Responsabilidades de Segurança

```text
                      AUTENTICAÇÃO GLOBAL (CENTRAL)
                         E-mail / Senha / OAuth
                        [ Firebase Auth Service ]
                                   │
                                   ▼
                       PROPRIETÁRIO (ADMIN HQ)
                                   │
                                   │ Ativação / Cadastro
                                   ▼
                       OPERADORES LOCAIS (OS)
                      PIN com Hash PBKDF2 Local
                        [ Web Crypto Engine ]
```

### Perfis de Acesso (RBAC):
*   **Platform Owner (Central Admin):** Privilégios de infraestrutura global da Central de Serviços.
*   **Company Owner (Proprietário):** Privilégios administrativos completos da sua respectiva empresa, incluindo configuração de caixas, contratação de planos no HQ e visualização de auditorias.
*   **Manager (Gerente):** Liberação de sangrias, cancelamentos de vendas e ajustes de estoque locais no terminal.
*   **Operator (Operador de Caixa / Garçom):** Permissões restritas ao lançamento diário de pedidos e aberturas de turnos.

---

## 📊 Status de Implementação

### 🟢 IMPLEMENTADO (Fortalecimento Criptográfico Local Concluído)
*   **Segurança Física com PBKDF2-HMAC-SHA256:**
    *   Substituímos o algoritmo legado de SHA-256 de ciclo único. Agora, o cadastro de PINs durante o Setup Wizard utiliza o derivador criptográfico de nível militar **PBKDF2** com **10.000 iterações** de chave hash.
    *   **Proteção de Força Bruta Local:** A geração e validação de PINs são executadas de forma pesada usando a Web Crypto API do navegador. Isso eleva de forma massiva o custo computacional por tentativa, tornando impossível adivinhar PINs numéricos de 4 ou 6 dígitos por ataques offline de dicionário, mesmo que o banco de dados IndexedDB local seja extraído.
*   **Sem PIN Padrão em Produção:** O Setup Wizard do terminal operacional obriga o Proprietário a criar credenciais personalizadas de PIN de 4 dígitos no primeiro boot, eliminando a falha comum de PINs de fábrica (`1234`, `0000`).

### 🟡 PARCIALMENTE IMPLEMENTADO
*   **Sessão Integrada com Firebase Auth:** O login do Proprietário no painel de controle administrativo mestre atual utiliza credenciais de variáveis de ambiente do backend Express local (`server.ts`). A integração direta baseada na passagem e validação de tokens JWT emitidos de forma real e integrada pelo SDK do Firebase Auth é planejada.

### 🔵 PLANEJADO (Arquitetura de Destino)
*   **Federated Identity (Firebase Auth):** Unificação completa do login do Proprietário por meio do Firebase Authentication (com suporte a login por e-mail, Google ou senhas de uso único - OTP), atuando como barramento inviolável de identidade na nuvem.

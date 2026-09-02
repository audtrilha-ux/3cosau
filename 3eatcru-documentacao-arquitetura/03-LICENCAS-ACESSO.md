# Licenciamento, Trial e Controle de Acesso

Este documento detalha as políticas de controle comercial, o ciclo de vida do período de testes (Trial) e as regras criptográficas de licenciamento do ecossistema, diferenciando as implementações ativas do destino arquitetural planejado contra fraudes.

---

## 🏛️ Políticas de Controle Comercial

O ecossistema opera de forma comercial sob o modelo SaaS (Software as a Service). O acesso operacional ao **3eatcru OS** é condicionado ao status contratual ativo do tenant na **Central**.

*   **Trial de 7 Dias:** Concedido automaticamente no cadastro da empresa na nuvem. Serve para validação operacional sem compromisso financeiro.
*   **Assinatura Ativa:** Planos mensais ou anuais que liberam o funcionamento irrestrito dos Apps e da sincronização com a nuvem.
*   **Preservação de Dados (Regra Crítica):** Caso a licença expire ou o Trial chegue ao fim, o **3eatcru OS** **NUNCA** apaga o banco de dados IndexedDB local. O histórico de vendas, caixas e configurações do lojista permanece criptografado e intacto, impedindo a perda de dados. Ocorre apenas um bloqueio visual operacional.

---

## 🚦 Diferenciação Canônica: Responsabilidades de Licença

Para assegurar total isolamento contra fraudes de relógio do sistema ou violações locais, a gestão comercial de licenças é segmentada de forma rígida:

1.  **A Central é a Única Autoridade de Tempo:** Os prazos, dias restantes de trial e renovações de planos são calculados e gerenciados estritamente nos servidores da Central.
2.  **O OS é a Autoridade de Validação e Execução Local:** O terminal operacional do cliente consome e valida localmente o status de licenciamento. Ele garante que as regras sejam aplicadas mesmo em completo isolamento offline de rede.

---

## 📊 Status Atual da Implementação vs. Alvo

### 🟢 IMPLEMENTADO (Proteção e Validação Online Real)
*   **Autoridade de Licenciamento na Central (`/api/sync/license-check`):** Endpoint real implementado no backend Express. O terminal realiza checagens assíncronas periódicas contra a Central para validar a data de trial e licença de forma inviolável.
*   **Ativação de Plano Sincronizada (`/api/sync/license-renew-simulated`):** O processo de ativação foi integrado à Central. Ao ativar o plano, o terminal envia uma requisição para a Central de Licenças que estende a assinatura de forma autoritativa na nuvem, retornando a confirmação real para o terminal lojista.
*   **Preservação Absoluta do IndexedDB:** O motor local de banco de dados Dexie permanece intocado quando ocorre a expiração, bloqueando apenas novos registros operacionais por meio de um overlay visual de "Trial Expirado" no desktop do OS.

### 🟡 PARCIALMENTE IMPLEMENTADO (Mocks e Limitações)
*   **Validação Offline de Contingência:** Na ausência de internet por períodos prolongados, o terminal operacional recorre a um cache local de status. Isso é provisório, pois a validação do status offline ainda não conta com checagem criptográfica assimétrica local.

### 🔵 PLANEJADO (Arquitetura de Destino - Licenciamento Assimétrico)
*   **Assinatura por Chave Privada (RSA/ECDSA):**
    *   Toda vez que uma licença é contratada ou o Trial é iniciado, a Central emite um arquivo de licença criptograficamente assinado com a chave privada mestre da plataforma.
    *   Este arquivo contém: `licenseId`, `companyId`, `expirationTimestamp`, `allowedApps` e a `digitalSignature`.
    *   O **3eatcru OS** carrega este arquivo localmente e valida a assinatura digital utilizando a chave pública mestre embutida de forma inalterável em seu Core.
    *   **Segurança Absoluta:** O cliente não pode alterar o arquivo local de licença (pois quebraria a assinatura criptográfica), nem fraudar o relógio local (pois o OS rejeita retrocessos temporais detectados através de logs sequenciais de auditoria e timestamps do banco).

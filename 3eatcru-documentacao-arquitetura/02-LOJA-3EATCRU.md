# Loja 3eatcru — Catálogo e Distribuição de Aplicativos

Este documento detalha o papel da **Loja 3eatcru** como mecanismo remoto de catálogo e empacotamento, especificando as regras de distribuição e o desacoplamento necessário entre as definições dos aplicativos de negócio e o Kernel/Shell do **3eatcru OS**.

---

## 🏛️ O Papel da Loja

A Loja não é um módulo interno do **3eatcru OS**. Ela é um serviço integrado à **Central** que gerencia o catálogo universal de soluções homologadas de negócio (Apps).

*   **Responsabilidades:** Catálogo de soluções, controle de versionamento, verificação de compatibilidade, controle de permissões exigidas e fornecimento de pacotes assinados por Hash criptográfico para download seguro.
*   **Acesso:** O lojista navega na Loja através do console estratégico do **HQ** ou através de um aplicativo gerenciador de atualizações nativo do **3eatcru OS**.

---

## 🚦 Desacoplamento de Dependências: OS vs. Apps

Para manter o **3eatcru OS** resiliente e livre de poluição de domínio, a arquitetura de distribuição e carregamento de Apps deve seguir as seguintes diretrizes:

1.  **Independência de Compilação:** O código-fonte do **3eatcru OS** deve compilar e rodar 100% de suas funções (Shell, Área de Trabalho, Teclado Numérico, Gerenciador de Janelas, Motor de Banco e Sincronismo) de forma limpa, sem a presença física de nenhum arquivo de código dos Apps no projeto.
2.  **SDK e Contratos Públicos:** Os Apps acessam recursos de baixo nível (como disparar impressões, gravar dados no motor offline, disparar notificações) consumindo exclusivamente contratos públicos definidos no Core do **3eatcru OS**.
3.  **Contrato de Manifesto do Aplicativo:** Cada App empacotado na Loja deve conter um manifesto (`manifest.json`) estruturado:

```json
{
  "id": "3eatcru.varejo",
  "name": "3eatcru Varejo",
  "version": "1.2.0",
  "entrypoint": "main.js",
  "permissions": [
    "storage",
    "printer",
    "hardware.drawer"
  ],
  "icon": "storefront",
  "category": "Operacional"
}
```

---

## 📊 Status de Implementação

### 🟢 IMPLEMENTADO
*   *Nenhum recurso real de carregamento de pacotes dinâmicos em tempo de execução está presente no código da aplicação Angular monolítica atual.*

### 🟡 PARCIALMENTE IMPLEMENTADO
*   **Mapeamento de Módulos Locais:** Os módulos de negócio (PDV, Mesas, Estoque, CRM, etc.) estão implementados como pacotes locais dentro do diretório `src/app/modules/` e importados diretamente pelo shell do desktop. Isso serve para simular a operação visual completa do ecossistema, mas viola o isolamento modular estrito de um sistema operacional.

### 🔵 PLANEJADO (Arquitetura de Destino)
*   **App Runtime Dinâmico:** O **3eatcru OS** passa a conter um motor de carregamento de módulos (Federated Modules ou Lazy Loading isolado) que lê a pasta de apps instalados locais, valida os manifestos, verifica assinaturas de hash criptográfico e injeta os componentes em tempo de execução na Área de Trabalho de forma dinâmica.
*   **Controle e Verificação de Hash:** Toda vez que um App for iniciado, o OS verifica se o hash local do arquivo bate exatamente com a licença concedida pela Central, impedindo adulterações ou infecções por malware local no terminal de venda.

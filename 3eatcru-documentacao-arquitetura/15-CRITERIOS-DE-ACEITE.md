# Critérios de Aceite e Testes Arquiteturais

Este documento define os critérios objetivos e testes de conformidade técnica para homologação do ecossistema, garantindo o desacoplamento de responsabilidades entre o **3eatcru OS**, os **Aplicativos** e a **Central**.

---

## 🏛️ Testes de Homologação da Plataforma

Para garantir que a evolução do código respeite as leis arquiteturais, os testes abaixo devem passar de forma obrigatória antes de qualquer liberação de versão de produção.

---

## 📊 Matriz de Critérios e Testes Obrigatórios

### 🧪 Teste 1: Independência de Boot do OS (OS Boot without Apps)
*   **Ação:** Remover todas as pastas de aplicativos sob `src/app/modules/`.
*   **Resultado Esperado:** O projeto **3eatcru OS** continua compilando perfeitamente (`ng build` com sucesso) e o sistema operacional inicia normalmente, exibindo a Área de Trabalho, barra de tarefas, carregando as configurações e bloqueando por PIN sem qualquer erro no console do desenvolvedor.
*   **Se Falhar:** ❌ *O OS ainda conhece os Apps. Há importações diretas acopladas no Shell.*

### 🧪 Teste 2: Instalação Modular de Apps (Add App without modifying Core)
*   **Ação:** Criar uma nova pasta sob `/modules/` representando um novo aplicativo de negócio (ex: `Módulo Estacionamento`) contendo um `manifest.json` válido e arquivo de inicialização de componentes.
*   **Resultado Esperado:** O aplicativo é registrado automaticamente no Shell e inicializado em uma nova janela de forma isolada, consumindo os drivers de banco e impressão do OS sem necessidade de alterar uma única linha de código do Kernel ou do `desktop.shell.ts`.
*   **Se Falhar:** ❌ *O OS não possui um App Runtime genérico extensível.*

### 🧪 Teste 3: Contingência Offline (Central Offline Fallback)
*   **Ação:** Desconectar a placa de rede ou derrubar o servidor Central Express local e operar o PDV de forma offline por vários minutos, lançando vendas e turnos de caixa.
*   **Resultado Esperado:**
    1.  Nenhum erro visual ou lentidão ocorre na interface operacional do lojista.
    2.  O `TransactionEngine` conclui todas as transações de forma atômica localmente.
    3.  A outbox enfileira as mensagens como `PENDING`.
    4.  Ao reestabelecer a conexão, o `SyncOutboxService` processa as mutações automaticamente e recebe o ACK da Central, alterando o status local para `SYNCED`.
*   **Se Falhar:** ❌ *O OS é síncrono com a rede, violando a filosofia Offline-First.*

### 🧪 Teste 4: Isolamento e Proteção de Dados (Zero-Trust Tenant Isolation)
*   **Ação:** Tentar forçar o cabeçalho HTTP `X-Tenant-ID` com valor fraudulento de outra empresa de testes durante a sincronização de dados de um dispositivo pareado.
*   **Resultado Esperado:** A Central de Serviços rejeita sumariamente a requisição com código `HTTP 403 Forbidden` e bloqueia a operação, validando que o mapeamento de banco baseia-se exclusivamente no token de sincronização JWT/syncToken verificado de forma opaca no backend.
*   **Se Falhar:** ❌ *A Central aceita identificadores do cliente, violando a segurança contra espionagem industrial.*

### 🧪 Teste 5: Isolamento de Storage (Database Separation)
*   **Ação:** Iniciar o aplicativo de CRM ou WhatsApp no terminal operacional e verificar o banco local do navegador.
*   **Resultado Esperado:** O banco principal da plataforma (`3eatcru_os_db`) não abriga dados ou tabelas desses módulos de forma monolítica. Os cadastros de leads ou templates residem em instâncias lógicas ou bancos IndexedDB separados, fornecidos dinamicamente pelo Storage Engine do OS para o App de CRM.
*   **Se Falhar:** ❌ *O banco centralizado do Core possui tabelas de negócios, violando o isolamento de persistência.*

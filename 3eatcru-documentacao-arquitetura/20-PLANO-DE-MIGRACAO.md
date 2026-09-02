# Plano de Migração Arquitetural — 3eatcru OS

Este documento detalha o plano de migração estruturado em fases sequenciais seguras para conduzir o ecossistema **3eatcru** de seu estado atual monolítico para a arquitetura de destino desacoplada e modularizada.

---

## 📅 Resumo Cronológico das Fases

```text
 FASE 1 ──► FASE 2 ──► FASE 3 ──► FASE 4 ──► FASE 5 ──► FASE 6 ──► FASE 7 ──► FASE 8
Contratos  Shell   Manifest   Storage   Central    HQ Web    Patches    Testes
Isolados   Limpo    Runtime    Modular   Workers    Isolado   Limpos   Arquitetura
```

---

## 🏛️ Detalhamento das Fases de Migração

### 🚀 FASE 1: Isolamento de Contratos Públicos e SDK do OS
*   **Ação:** Extrair todas as definições de interfaces de dados de domínio do Core e movê-las para uma camada pública de SDK.
*   **Resultados Esperados:**
    *   Definir os contratos de baixo nível (`IPrinterDriver`, `IStorageAdapter`, `ISyncDispatcher`) em uma pasta unificada `/src/app/core/sdk/`.
    *   Assegurar que nenhum aplicativo precise acessar rotinas internas do Kernel para interagir com recursos físicos do terminal.

### 🚀 FASE 2: Eliminação de Importações Diretas no Shell do Desktop
*   **Ação:** Remover todas as importações estáticas e acopladas de componentes operacionais (ex: `import { PdvComponent }`) de dentro de `desktop.shell.ts`.
*   **Resultados Esperados:**
    *   Reduzir a array de `imports` e as declarações visuais rígidas de templates na Área de Trabalho.
    *   O `desktop.shell.ts` compila de forma limpa, desconhecendo a existência das pastas em `/modules/`.

### 🚀 FASE 3: Criação do App Manifest e do Runtime de Janelas
*   **Ação:** Desenvolver o gerenciador de inicialização dinâmica (`AppRuntimeService`).
*   **Resultados Esperados:**
    *   Implementar o carregador que lê arquivos `manifest.json` locais de forma genérica.
    *   Criar contêineres dinâmicos de janelas (`WindowContainerComponent`) que recebem o ponto de entrada (entrypoint) do componente de negócios em tempo de execução e o injetam no DOM do desktop de forma lazy e desacoplada.

### 🚀 FASE 4: Modularização e Divisão do Banco de Dados Dexie
*   **Ação:** Quebrar o esquema centralizado e estático monolítico do `AppDexieDb` em múltiplos bancos de dados Dexie/IndexedDB isolados lógicos.
*   **Resultados Esperados:**
    *   Reduzir o esquema do banco nativo do OS (`3eatcru_os_db`) a apenas 5 tabelas de plataforma: `companySettings`, `operators`, `outbox`, `auditLogs` e `hardwareDevices`.
    *   Implementar um mecanismo na fábrica do banco de dados que permite que os Apps criem instâncias próprias lógicas isoladas e dinâmicas (ex: `app_retail_db` para vendas e estoque).

### 🚀 FASE 5: Migração das APIs da Central para Cloudflare Workers
*   **Ação:** Substituir o servidor Express monolithic de desenvolvimento por rotas serverless independentes e escaláveis.
*   **Resultados Esperados:**
    *   Reescrever toda a lógica de segurança, pareamento, licenciamento e sincronização em TypeScript compilado para Cloudflare Workers (Edge computing).
    *   Migrar os armazenamentos simulados em arquivos e memória local do Express para tabelas robustas estruturadas no banco SQL relacional serverless Cloudflare D1.

### 🚀 FASE 6: Isolamento e Autonomia do HQ Web
*   **Ação:** Apartar o console de retaguarda mestre da plataforma, convertendo-o em um projeto Angular/Web separado do repositório do **3eatcru OS**.
*   **Resultados Esperados:**
    *   O HQ passa a ser uma aplicação independente que consome as rotas headless expostas pelas Cloudflare Workers da Central.
    *   Nenhum arquivo visual ou lógico do HQ reside na base de compilação ou no repositório de runtime do **3eatcru OS**.

### 🚀 FASE 7: Consolidação e Limpeza de Scripts de Patches Legados
*   **Ação:** Auditar, documentar e expurgar todos os arquivos soltos e scripts de patches que foram gerados durante a evolução e remediação do projeto (`patch_*.py`, `fix_*.py`).
*   **Resultados Esperados:**
    *   Consolidar rotinas cruciais permanentes de manutenção dentro do ecossistema formal de testes, linter ou tarefas npm do `package.json`.
    *   Arquivar e deletar arquivos legados órfãos, limpando a raiz do repositório físico do projeto.

### 🚀 FASE 8: Implementação de Testes Arquiteturais Automatizados
*   **Ação:** Integrar verificações de importação estrita e dependências nas tarefas integradas de integração contínua (CI/CD).
*   **Resultados Esperados:**
    *   Criar testes de linter automatizados que bloqueiam o build e acusam falhas se for detectada qualquer importação de arquivos de `/modules/` dentro do diretório `/core/` ou `/shell/`.
    *   Garantir a imutabilidade das leis canônicas do ecossistema por validações automatizadas de código.

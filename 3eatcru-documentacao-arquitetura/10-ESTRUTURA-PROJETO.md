# Estrutura do Projeto e Mapeamento de Diretórios

Este documento descreve a organização de arquivos e a estrutura de pastas do projeto, identificando as responsabilidades de cada diretório e os acoplamentos existentes na implementação atual.

---

## 🏛️ Estrutura de Diretórios Atual

O projeto está organizado na seguinte árvore de pastas principal sob o framework **Angular 21 (Zoneless)** e **Tailwind CSS v4**:

```text
/
├── .env.example                               # Exemplo de variáveis de ambiente do sistema
├── angular.json                               # Configurações de compilação do Angular CLI
├── package.json                               # Gerenciamento de dependências npm e scripts
├── server.ts                                  # Servidor Express (API de Dev, Central e SSR)
│
├── 3eatcru-documentacao-arquitetura/          # Documentação canônica do ecossistema
│
├── src/
│   ├── main.ts                                # Ponto de partida do Bootstrap do app client
│   ├── main.server.ts                         # Bootstrap do Server-Side Rendering
│   ├── index.html                             # Casca HTML do sistema operacional
│   ├── styles.css                             # Estilos globais e importação do Tailwind
│   │
│   ├── app/
│   │   ├── app.ts                             # Componente raiz do Angular
│   │   ├── app.config.ts                      # Provedores e configurações globais (Zoneless)
│   │   ├── app.routes.ts                      # Roteamento básico da aplicação
│   │   │
│   │   ├── core/                              # Núcleo do 3eatcru OS (Kernel e Infra)
│   │   │   ├── models/                        # Interfaces e definições de dados de domínio
│   │   │   ├── services/                      # Serviços da plataforma (PWA, Contexto, etc.)
│   │   │   ├── storage/                       # Motor de Armazenamento Local (Dexie DB)
│   │   │   ├── sync/                          # Motor de Sincronismo (Sync, Outbox, Pull)
│   │   │   └── window-manager.service.ts      # Gerenciador de janelas e ciclo de vida do OS
│   │   │
│   │   ├── shell/                             # Casca visual do OS (Desktop, Taskbar, Modals)
│   │   │   └── desktop/
│   │   │       ├── desktop.shell.ts           # Área de Trabalho principal do OS
│   │   │       └── components/                # Componentes do Shell (Taskbar, Lock, Wizard)
│   │   │
│   │   └── modules/                           # Aplicativos de negócio (Atualmente acoplados)
│   │       ├── vendas/ (PDV)                  ├── caixa/ (Turnos)
│   │       ├── mesas/ (Restaurante)           ├── estoque/ (Inventário)
│   │       ├── clientes/ (CRM Leve)           ├── financeiro/ (Fluxo)
│   │       └── ... Outros 12 módulos de negócio
```

---

## 🚦 Avaliação de Responsabilidades e Desacoplamento Concluído

Após a execução do plano de migração canônico, todos os pontos críticos de acoplamento físico foram resolvidos com sucesso:

### 1. Desacoplamento Total de Importações no `DesktopShell` (Fase 2 & Fase 3)
*   **Implementado:** O arquivo `desktop.shell.ts` foi completamente desvinculado dos módulos de negócio. Ele não possui nenhuma importação direta de componentes sob `/modules/`.
*   **Runtime Dinâmico:** A injeção e ciclo de vida dos módulos de negócio é orquestrada pelo `AppRegistry` e pelo `WindowContainerComponent` via `ngComponentOutlet` e `DynamicComponentLoader`, garantindo carregamento dinâmico sem acoplamento em tempo de compilação.
*   **Regra de Linter Automatizada (Fase 8):** O `eslint.config.js` bloqueia permanentemente qualquer importação de `/modules/` dentro do `/core/` e `/shell/`.

### 2. Segregação e Modularização de Dados no `DexieDB` (Fase 4)
*   **Implementado:** O esquema monolítico foi dividido fisicamente em bancos IndexedDB separados: `3eatcru_os_db` (banco nativo com 5 tabelas da plataforma) e `3eatcru_business_db` (banco de negócios).
*   **Fábrica Dinâmica:** Foi implementada a fábrica `createAppDatabase` para instanciação dinâmica e isolada de novos esquemas sob demanda por qualquer aplicativo ou extensão.

---

## 📊 Status de Implementação e Mitigação

### 🟢 100% IMPLEMENTADO & CONFORME
*   **Core e Shell Robustos:** Toda a lógica de gerenciamento de janelas em tempo de execução, foco, minimização, barra de tarefas, bloqueio de PIN, verificação de trial e outbox de sincronização é gerenciada no diretório `/src/app/core/` e `/src/app/shell/` com altíssima qualidade técnica.
*   **Isolamento Modular de Módulos de Negócios:** Os aplicativos de negócio operam de forma 100% desacoplada do Shell e do Core, instanciados dinamicamente via registro de manifesto.
*   **Cloudflare Workers Edge Serverless:** A lógica de sincronização, licenciamento e pareamento da Central está migrada em `/cloudflare-worker/` pronta para implantação serverless com banco D1.
*   **Repositório Limpo e Protegido:** Todos os scripts legados foram expurgados e regras de arquitetura estão ativas no linter.

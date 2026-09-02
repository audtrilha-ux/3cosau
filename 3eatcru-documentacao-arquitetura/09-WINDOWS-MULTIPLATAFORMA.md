# Compilação Multiplataforma (Windows & Web)

Este documento descreve as diretrizes para empacotamento e distribuição nativa do **3eatcru OS** como aplicativo executável autônomo de alta performance para Windows, detalhando o compartilhamento de código e as restrições de navegadores.

---

## 🏛️ Filosofia de Código Único (Shared Core)

Para garantir máxima manutenibilidade e agilidade na evolução do ecossistema, o **3eatcru OS** compartilha a mesma base de código em TypeScript e Angular entre a versão Web (executada em navegadores) e a versão Desktop Nativa para Windows.

*   **Camada de Visualização (HTML/CSS):** Idêntica em ambos os ambientes, utilizando classes utilitárias responsivas do Tailwind CSS.
*   **Camada de Negócio e Sincronismo:** O Core (serviços de domínio, transaction engine, sync outbox) é 100% reutilizado.

---

## 💻 Arquitetura de Empacotamento Windows (Tauri vs. Electron)

A compilação nativa para Windows é projetada utilizando wrappers leves que encapsulam a aplicação Web, fornecendo APIs de acesso ao hardware de baixo nível da máquina.

```text
                        ┌──────────────────────────────┐
                        │     3EATCRU OS (DESKTOP)     │
                        │                              │
                        │    [ Camada Visual / UI ]    │
                        │       Angular + Tailwind     │
                        ├──────────────────────────────┤
                        │    [ Adaptador de Storage ]  │
                        │       SQLite / Dexie API     │
                        ├──────────────────────────────┤
                        │     [ Tauri Rust Wrapper ]   │
                        │   Acesso a Portas Seriais    │
                        │   Impressão Térmica Direta   │
                        └──────────────┬───────────────┘
                                       │
                                       ▼
                              Sistema Operacional
                               Windows / Hardware
```

### Por que Tauri como Escolha Padrão?
*   **Baixo Consumo:** Diferente do Electron (que embarca um navegador Chromium inteiro e consome centenas de megabytes de RAM), o Tauri utiliza a engine de renderização web nativa do próprio Windows (WebView2), resultando em instaladores extremamente pequenos (<15MB) e consumo de RAM irrisório (<40MB).
*   **Segurança e Velocidade:** O backend do Tauri é escrito em Rust, garantindo velocidade nativa no acesso a portas seriais, gavetas de dinheiro e impressoras térmicas locais.

---

## 📊 Status de Implementação

### 🟢 IMPLEMENTADO (Web / Nuvem)
*   **PWA Integrado (Progressive Web App):** Suporte a Service Workers e Web App Manifest. O usuário pode "instalar" o **3eatcru OS** no desktop a partir do Google Chrome, permitindo carregamento offline instantâneo do Shell.
*   **Adaptação de UI para iFrames:** Tratamento visual de alertas e interações para bom funcionamento dentro do painel integrado do AI Studio, sem interrupções por popups ou bloqueios de segurança do navegador.

### 🟡 PARCIALMENTE IMPLEMENTADO
*   **Pontes de Hardware:** O acesso a impressoras térmicas e periféricos na versão Web utiliza as APIs nativas do navegador (`navigator.serial` ou `window.print`). A unificação dessas pontes sob uma única abstração de driver nativo está planejada.

### 🔵 PLANEJADO (Arquitetura de Destino - Compilação Nativa)
*   **Compilação em Rust (Tauri Wrapper):** Empacotamento oficial da build estática de produção do Angular em instalador `.msi` para Windows.
*   **Storage SQLite Integrado:** Adaptador local que substitui de forma transparente o IndexedDB por um banco SQLite local criptografado em disco no Windows, garantindo imunidade contra limpezas de cache automáticas do navegador.
*   **Impressão Térmica ESC/POS Direta:** Envio de comandos de impressão de cupom não fiscal diretamente para a porta serial (COM) ou USB da impressora térmica lojista, sem passar por telas de visualização ou prompts de impressão do Windows.

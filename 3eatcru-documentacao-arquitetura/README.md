# 3eatcru — Documentação Canônica da Arquitetura do Ecossistema

Este diretório contém a documentação técnica oficial, canônica e atualizada de todo o ecossistema **3eatcru**. Ela estabelece a divisão rigorosa de responsabilidades entre as plataformas e serve como diretriz absoluta para evolução do código-fonte.

---

## 🏛️ Mapa Geral da Documentação

### Visão Geral e Fronteiras
1.  **[00-VISAO-GERAL.md](./00-VISAO-GERAL.md)** — Princípios universais, divisão canônica em 4 partes e fronteiras do ecossistema.
2.  **[01-CENTRAL-3EATCRU.md](./01-CENTRAL-3EATCRU.md)** — O papel da Central como camada de infraestrutura de serviços em nuvem.
3.  **[02-LOJA-3EATCRU.md](./02-LOJA-3EATCRU.md)** — Mecanismos de distribuição modular e catalogação de aplicativos.

### Segurança e Controle
4.  **[03-LICENCAS-ACESSO.md](./03-LICENCAS-ACESSO.md)** — Gerenciamento de Trial, assinaturas e criptografia assimétrica de licenças.
5.  **[04-IDENTIDADE-USUARIOS-PIN.md](./04-IDENTIDADE-USUARIOS-PIN.md)** — Autenticação de administradores na Central vs. operadores por PIN (PBKDF2).
6.  **[08-SEGURANCA.md](./08-SEGURANCA.md)** — Vetores de ataque locais e remotos mitigados, controle de acessos e auditorias.

### Funcionamento Local e Sincronismo
7.  **[05-3EATCRU-OS-OFFLINE-FIRST.md](./05-3EATCRU-OS-OFFLINE-FIRST.md)** — Funcionamento offline autônomo, motor transacional atômico e Storage Engine.
8.  **[06-SINCRONIZACAO.md](./06-SINCRONIZACAO.md)** — Fila outbox sequencial, recebimento incremental por cursor (Pull Sync) e integridade de deltas.
9.  **[07-API-E-BANCO.md](./07-API-E-BANCO.md)** — Protocolo REST, isolamento inviolável de tenants e prevenção de spoofing de ID de rede.
10. **[09-WINDOWS-MULTIPLATAFORMA.md](./09-WINDOWS-MULTIPLATAFORMA.md)** — Compilação compartilhada de base única em wrappers desktop de alta performance (Tauri).

### Estrutura e Prática
11. **[10-ESTRUTURA-PROJETO.md](./10-ESTRUTURA-PROJETO.md)** — Mapeamento do diretório de pastas atual, regras de core e acoplamentos.
12. **[11-FLUXOS.md](./11-FLUXOS.md)** — Diagramas de sequência para inicialização, faturamento outbox e recebimento pull.
13. **[13-REGRAS-DE-OURO.md](./13-REGRAS-DE-OURO.md)** — Leis arquiteturais fundamentais e inegociáveis de dependência e dados.
14. **[14-MODELO-DADOS.md](./14-MODELO-DADOS.md)** — Estruturas das tabelas nativas de plataforma de OS e do Storage Engine.

### Roadmap e Decisões
15. **[12-ROADMAP.md](./12-ROADMAP.md)** — Cronograma de sprints executadas e planejamento de refatorações de desacoplamento.
16. **[15-CRITERIOS-DE-ACEITE.md](./15-CRITERIOS-DE-ACEITE.md)** — Cenários reais de testes e homologações de conformidade arquitetural.
17. **[16-STATUS-ATUAL-E-PLANEJADO.md](./16-STATUS-ATUAL-E-PLANEJADO.md)** — Diagnóstico analítico de recursos e status técnico real contra o alvo ideal.
18. **[17-DECISOES-ARQUITETURA.md](./17-DECISOES-ARQUITETURA.md)** — Registro formal das principais decisões de engenharia (ADRs).

### Novas Seções de Auditoria & Destino
19. **[18-ESTADO-REAL-DA-IMPLEMENTACAO.md](./18-ESTADO-REAL-DA-IMPLEMENTACAO.md)** — Relatório técnico de dívidas críticas e acoplamentos físicos descobertos.
20. **[19-ARQUITETURA-DE-DESTINO.md](./19-ARQUITETURA-DE-DESTINO.md)** — Diagrama técnico detalhado e separação modularizada e segura de bancos de dados.
21. **[20-PLANO-DE-MIGRACAO.md](./20-PLANO-DE-MIGRACAO.md)** — Roteiro sequencial de 8 fases práticas para dissociação segura do monólito de código.
22. **[21-RELATORIO-ERROS-AUDITORIA.md](./21-RELATORIO-ERROS-AUDITORIA.md)** — Mapeamento detalhado e plano de ação para os 50 erros identificados na Auditoria Sênior 1.0.2.

---

## 🚦 Regra de Leitura Obrigatória

> Os desenvolvedores do ecossistema devem consultar a documentação técnica oficial antes de propor alterações de barramentos de APIs ou tabelas de banco de dados locais. A implementação atual reflete o progresso prático planejado e deve caminhar rigorosamente em direção à **Arquitetura de Destino** por meio das fases descritas no **Plano de Migração**.

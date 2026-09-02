# Remix 3eatcru OS — Diretrizes Rigorosas de Desenvolvimento

Este arquivo define os parâmetros intransigentes de arquitetura, segurança, integridade de dados e design do ecossistema **Remix 3eatcru OS 1.0.2**. Qualquer agente ou desenvolvedor que realizar modificações neste repositório DEVE obedecer estritamente a estas regras de ouro.

---

## 1. Integridade Transacional & Persistência (P0 / P1)

### Regra de Ouro: Proibição de Escritas Diretas em Tabelas Sincronizáveis
Nenhum componente ou serviço de UI pode gravar dados diretamente utilizando chamadas cruas ao banco (ex: `db.tableName.put()` ou `db.tableName.add()`) se a entidade for replicável pela nuvem.
- **Como gravar dados:** Toda gravação, atualização e exclusão de dados sincronizáveis DEVE obrigatoriamente ser delegada à `TransactionEngine` utilizando o método unificado e auditável `saveEntity()` ou `deleteEntity()`:
  ```typescript
  // CORRETO: Gera log de auditoria e insere mutação de forma atômica no Outbox
  await this.txEngine.saveEntity('financialTransactions', transacao, 'CREATE');
  ```
- **Por que isso é crítico:** Chamadas diretas ao banco quebram o fluxo offline-first, fazendo com que dados fiquem órfãos localmente e nunca cheguem à Central Administrativa.

### Transações e Atomicidade (ACID)
Todas as operações multidominiais (ex: venda diminuindo estoque, gerando movimentação de caixa e atualizando histórico do cliente) devem ocorrer dentro de uma transação Dexie segura:
```typescript
await db.transaction('rw', [db.sales, db.products, db.stockMovements], async () => {
  // Lógicas atômicas aqui...
});
```

---

## 2. Segurança & Blindagem de Edge (Cloudflare Worker)

### Rate Limiting no Edge baseado em Persistência
- **Proibição de Memória Volátil:** Tentativas de pareamento ou operações com taxa limite não podem ser rastreadas em estruturas voláteis em memória do Worker (como `Map` global). Em rotas serverless, as requisições flutuam por múltiplos servidores, burlando limites baseados em variáveis locais.
- **Uso do Cloudflare D1:** Todo rate limit por IP para rotas críticas (como pareamento de novos dispositivos) deve ser persistido e consultado de forma síncrona diretamente no banco **Cloudflare D1** (`rate_limits`).

### Whitelist e Segurança de Endpoint
O Worker só deve aceitar mutações de tabelas registradas no manifesto oficial de entidades. Payloads que não correspondam à whitelist estrita de tabelas operacionais da empresa devem ser sumariamente rejeitados.

---

## 3. Compatibilidade Completa com Renderização Híbrida (SSR)

### Isolamento de APIs do Navegador
O código Angular Universal pré-renderiza páginas no servidor, onde objetos como `window`, `document`, `sessionStorage` e `navigator` não existem.
- **Validação de Plataforma:** Antes de acessar qualquer objeto nativo do navegador, injete o token `PLATFORM_ID` e use `isPlatformBrowser`:
  ```typescript
  import { PLATFORM_ID, inject } from '@angular/core';
  import { isPlatformBrowser } from '@angular/common';

  export class MeuComponente {
    private platformId = inject(PLATFORM_ID);

    ngOnInit() {
      if (isPlatformBrowser(this.platformId)) {
        // Seguro para executar lógicas dependentes de window
        const token = sessionStorage.getItem('user_token');
      }
    }
  }
  ```
- **Proibição Absoluta:** O uso direto de `isBrowser()` ou verificações cruas de `typeof window !== 'undefined'` em ciclos de vida principais sem proteção de plataforma nativa do Angular é estritamente proibido em arquivos que compõem o bundle de produção do frontend.

---

## 4. Filosofia de Design Visual ("Anti-Slop")

### Tipografia e Contraste
- **Fontes Display:** Sempre emparelhar fontes display refinadas com fontes sem-serifa de alta legibilidade para o corpo.
- **Tamanho Mínimo:** O texto de leitura operacional nunca deve ser menor que `14px` (`text-sm`).

### Espaçamento Matemático (Padding Rítmico)
- **Margens:** O padding externo de qualquer container (mínimo `16px`) deve ser sempre igual ou maior do que o espaçamento interno entre os elementos filhos.
- **Cantos Arredondados:** Seguir a regra matemática de cantos aninhados: `Inner Radius = Outer Radius - Padding`.

### Proibição de Exageros Visuais (Clichês de IA)
- **Paleta de Cores:** Evitar gradientes "arco-íris", roxo-com-azul neon, ou brilhos exagerados de vidro (*glassmorphism*) em temas escuros. Preferir paletas minimalistas baseadas em tons de cinzas profundos (`zinc`, `neutral`, `slate`), com toques refinados de cores de destaque (`emerald` para ações positivas, `rose` para advertências ou finanças).
- **Sem Recursos Inadequados:** Não adicionar widgets flutuantes, barras de IA supérfluas, playgrounds ou seções não solicitadas pelo usuário. O design deve expressar eficiência, espaço negativo equilibrado e elegibilidade operacional de alto desempenho.

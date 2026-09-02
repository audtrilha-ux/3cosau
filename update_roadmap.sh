sed -i 's/Sprint 5 (Planejada)/Sprint 5 (Concluída - Segurança, Cloudflare Edge & D1)/g' 3eatcru-documentacao-arquitetura/12-ROADMAP.md

cat << 'INNER_EOF' >> 3eatcru-documentacao-arquitetura/12-ROADMAP.md

### 🟢 Sprints Adicionais Concluídas (Hardening P0/P1)
*   **Validação Estrita de Schemas (P1):** Integração de validação estática/runtime de DTOs nas operações críticas (`handleCreateCompany`, `handleSyncBatch`, `handleRevokeDevice`, etc).
*   **Eliminação de Any (P1):** Tipagem dos payloads para reduzir furos de segurança.
*   **Filtros de Multitenancy Rigorosos (P0):** Consultas de banco IndexedDB reescritas para filtrar obrigatoriamente por `companyId` e `locationId`.
*   **Segurança Criptográfica no Pareamento (P0):** O token de pareamento agora trafega validado e só é armazenado no servidor como Hash SHA-256 (`sync_token_hash`), impedindo roubo e vazamentos pelo banco.
*   **Cursores de Sincronização Seguros:** Sincronização (Pull) baseada em cursor dual (`synced_at` + `mutation_id`), impedindo a perda matemática de mutações concomitantes.

---
## 🏁 Status Final do Projeto
A auditoria Senior Pro foi respondida e as refatorações arquiteturais concluídas. A aplicação consolidou a mudança de "Protótipo" para **"Pré-Produção/RC (Release Candidate)"**.
INNER_EOF

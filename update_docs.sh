sed -i 's/Cursor incremental temporal; proteção ativa/Cursor sequencial determinístico (synced_at + mutation_id); proteção ativa/g' 3eatcru-documentacao-arquitetura/16-STATUS-ATUAL-E-PLANEJADO.md

sed -i 's/Cloudflare Worker & D1.*TESTED.*Autenticação HMAC-SHA256 segura/Cloudflare Worker & D1 | 🟢 | 🟢 | PRODUCTION READY | Autenticação HMAC-SHA256 rigorosa, sync_token criptografado no banco, pull seguro e D1/g' 3eatcru-documentacao-arquitetura/16-STATUS-ATUAL-E-PLANEJADO.md


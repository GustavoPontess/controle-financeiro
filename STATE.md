---
owner: Gustavo
last_reviewed: 2026-06-16
status: AGUARDANDO_DECISAO
foco: 'segurança — sprint de auth hardening (começar pelo C1)'
---

# STATE — onde parei

**Estado vivo da sessão.** Só duas coisas: o que está em execução agora e a próxima ação concreta. Backlog completo em [`ROADMAP.md`](ROADMAP.md).

> Atualizar ao fim de toda sessão que mexeu em código/docs. Substitui o antigo `IMPLEMENTATION_STATE.md` (Q2-Q5 em `docs/history/`).

---

## Em execução

Nada em código. **3 🔴 (C1/C2/C3) + A1/A2 + reset-token/rate-limit/política + re-auth/CSP + A3 (código) fechados.** Sprint de Auth Hardening (parte de código) **completa** — resta só a metade manual da rotação de segredos (valores reais) + re-pesquisa dos gaps.

## Próxima ação concreta

- **Segredos de DEV rotacionados** ✅ (feito 2026-06-17): `JWT_SECRET` + senha Postgres novos (aleatórios) nos `.env` locais (gitignored); volume do Postgres recriado; API + login verificados. Chave de dev antiga invalidada. **Pendente só pra quando houver deploy:** gerar segredos frescos no secret manager de **produção** (nunca reaproveitar os de dev).
- **Código (eu), por prioridade:** re-pesquisar gaps **LEVE** (§8.6) — key rollover sem downtime, MFA, cripto-at-rest/PII, logging/auditoria, **LGPD + BACEN/Open Finance** (#126) — ou pegar um P2 catalogado.

P2 catalogados (não-bloqueantes): refresh token também em plaintext; NIST remover regras de composição; CSP no SPA (frontend prod); 403×401 ownership.

> Follow-up aberto (não-bloqueante): **403 (ownership) × 401 (auth)** — hoje todo `UnauthorizedAccessException` vira 401 e o front desloga; separar ownership em 403. Pré-existente em ~32 sites. Chip `task_65e37c60`.

---

## Entregue nesta sessão (2026-06-16)

- **Rotação dos segredos de DEV** ✅ — `JWT_SECRET` + senha Postgres novos (aleatórios, `openssl`) nos `.env` locais; Postgres recriado (volume novo) com a senha nova; API reseedada + login do dev verificado (cookie jwt assinado pela chave nova). Chave de dev antiga morta. (Prod fica pra quando deployar.)
- **A3 — segredos fora do compose/CI versionado** 🟠→✅ (código) — compose exige `${POSTGRES_PASSWORD:?}`/`${JWT_SECRET:?}` (sem default fraco), `.env.example` raiz + `.env` gitignored, CI passa valores efêmeros. Validado `docker compose config` (resolve com .env; falha sem). Confirmado: chave real **não está no git**.
- **Re-auth + CSP/headers** 🟠→✅ — verificado que troca de senha exige senha atual e que jwt+refresh estão em cookie HttpOnly+Secure+SameSite=Strict (não há troca de e-mail/delete); `SecurityHeadersMiddleware` novo: CSP (estrita p/ API, relaxada p/ Swagger/Hangfire) + nosniff + X-Frame DENY + Referrer + Permissions + HSTS(HTTPS). 5 testes (back 251/251). Headers confirmados ao vivo via curl.
- **Reset token hasheado + rate-limit por conta + política 15 chars** 🟠→✅ — token guardado como SHA-256 (`OpaqueTokenHasher`), bruto só no e-mail; rate-limit 3/conta/hora no job; política 10→15 + teto 128 (front e back, com testes ajustados). Achados catalogados (P2): refresh token plaintext, NIST dropar composição. Back 246/246, front 287/287.
- **A1/A2 — PasswordHasher** 🟠→✅ — migrado p/ **Argon2id** (Konscious, m=19456/t=2/p=1, salt 16B, saída 32B), formato versionado + **rehash transparente no login** (aceita hash legado PBKDF2, regrava sem reset). Decisão por **deep-research verificado** (OWASP/NIST, 24/25 claims). 8 testes (back 238/238).
- **C3 — soft-delete de `Transacao`** 🔴→✅ — `DeletarAsync` virou soft delete (`Ativo=false`+`Cancelado`+`CanceladoEm`+motivo) e **global query filter** `HasQueryFilter(t => t.Ativo)` no `Transacao` exclui canceladas de toda query/navegação. Corrige de quebra pernas de transferência soft-deleted que apareciam na lista. 3 testes (back 230/230).
- **C2 — contrato de exceção** 🔴→✅ — 67 `throw new Exception(...)` → tipos certos (404/400/409/401 por semântica); `GlobalExceptionHandlerMiddleware` deixou de ecoar `Message` no 500 (genérico; detalhe só no log). 5 testes do middleware + 26 asserts atualizados (back 227/227). Conversão feita via workflow (9 services em paralelo + verificação adversarial).
- **C1 — reset token não vaza mais** 🔴→✅ — `/forgot-password` responde genérico e idêntico pra qualquer e-mail; geração de token + envio agora é **fire-and-forget** (`HangfirePasswordResetDispatcher` → `PasswordResetEmailJob` → `IPasswordResetEmailSender`). Mata account takeover + timing/enumeração. 6 testes de regressão (back 222/222).
- **Flaky test `RecorrentesPage`** corrigido — `getAllByTitle` síncrono → `await findAllByTitle` (header estático rendava antes das rows async). PR #204.
- **Reorg de docs (solo)** — modelo `ROADMAP` + `STATE`; Q5 arquivado; COLLABORATION deletado; QUICK_REFERENCE/CLAUDE/PROMPT/GIT_WORKFLOW atualizados; `docs/` limpo (redesign-ux Q4 → history, ponteiros consertados).
- **Auditoria do código herdado** — `docs/AUDITORIA_CODIGO_HERDADO.md`. 3 🔴 (C1/C2/C3) + altos.
- **Branches consolidadas na `main`** — #114 (Postgres único) + #92 (E2E Playwright) cherry-picked; fix crítico de boot (Npgsql legacy timestamp órfão pós-#114) achado pelo CI.
- **CI E2E via docker compose** — robusto (corrigiu compose quebrado: API porta 8080→5293).
- **Caio + João apagados do repo** — autoria reescrita (196 commits → só Gustavo), **132 co-autorias do Claude removidas** da história, histórico **linearizado** (sem merge commit), removidos do site (Sobre) e das branches. Refs órfãs limpas.
- **Versionamento** — SemVer 0.x; `CHANGELOG.md` + `docs/RELEASING.md` (processo); release **`v0.9.0`** publicada. `1.0.0` reservado pro lançamento público.
- **Pesquisa de segurança** — deep-research verificado (OWASP/NIST) → `docs/SEGURANCA_BEST_PRACTICES.md`. Gaps abertos (rate-limit cortou): MFA-.NET, rotação de segredos, cripto-at-rest, logging, LGPD/BACEN — **re-pesquisar**.
- **Regra de conformidade gravada** (CLAUDE.md): sempre pesquisar prática bancária + LGPD + regulatório antes de lançar.

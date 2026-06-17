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

Nada em código. **C1 fechado** (reset token não vaza mais; geração+e-mail fire-and-forget via Hangfire). Seguindo a Sprint de Auth Hardening.

## Próxima ação concreta

**Sprint de Auth Hardening** (ordem em `ROADMAP.md` → Higiene, spec em `docs/SEGURANCA_BEST_PRACTICES.md`). Próximo:
- **C2 — contrato de exceção furado** 🔴 — 67 `throw new Exception(...)` viram HTTP 500 e vazam `Message`. Trocar pelos tipos certos (`ArgumentException`→400, `KeyNotFoundException`→404, `InvalidOperationException`→409, `UnauthorizedAccessException`→401) + garantir que o middleware não ecoa `Message` no 500. Branch `fix/c2-excecoes`.

Depois: **C3** (soft-delete de `Transacao`) → **A1/A2** (PBKDF2 600k/Argon2id) → reset hasheado + rate-limit por conta + política 15 chars → re-auth em op sensível + CSP → **rotacionar segredos** (urgente, ex-colaboradores têm a JWT key no clone).

---

## Entregue nesta sessão (2026-06-16)

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

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

Nada em código. **Lote 1 fechado** (1.1 filtros ✅ · 1.2 privacy ✅ · 1.3 variação% ✅ · 1.4 orçamento no Dashboard ✅). Segurança (código) toda fechada.

> **1.4 decisão:** em vez do "salário+meta" do ROADMAP (modelo rígido), reaproveitamos o `Orcamento` por-categoria que já existe (suporta orçamento geral) num card "safe-to-spend" no Dashboard. Alinhado ao mercado (Monarch/YNAB), zero migration.

> **Frente de segurança (código) ESGOTADA:** C1/C2/C3 + A1/A2 + reset/rate-limit/política + re-auth/CSP + A3 + rotação dev + refresh-token-hash + 403×401 + CSP-SPA — tudo fechado e mergeado. Falta só deploy-config (prod) ou decisão/pesquisa.

## Próxima ação concreta

**Lote 1 completo.** Próximo passo é **escolha de direção** (decidir com o Gustavo):
- **Lote 2 (fosso de produto):** família real — rateio "quem paga o quê" + settle-up. **Spec própria antes de codar** (`docs/features/familia/`). É o maior diferencial; pede planejamento + decisões.
- **Lote 3 (aquisição/SEO):** tela de Assinaturas, ferramentas grátis, referral.
- **Conformidade:** LGPD #126 (pesquisa leve + decisão legal).
- **Polish:** replicar variação% em /reports; UI de orçamento geral mais explícita na /limites.
- **Conformidade — pesquisa LEVE** (§8.6, não desperdiçar orçamento): **LGPD #126** (base legal, direitos do titular, minimização, DPO/RIPD; e se BACEN/Open Finance se aplica). Tem componente legal/decisão.
- **P2 restante:** dropar regras de composição da senha (NIST) — **decisão de UX do Gustavo** (afrouxa a senha).
- **Deploy (futuro):** rotacionar segredos de prod; ajustar `connect-src` do CSP + baseURL hardcoded do axios pro domínio real.

---

## Entregue nesta sessão (2026-06-16)

- **1.3 Variação % vs mês anterior** ✅ (1ª feature de produto pós-segurança) — cards "Entrou/Saiu" do Dashboard ganham delta % vs mês anterior + seta colorida. Back: `EntradasCaixaMesAnterior`/`SaidasCaixaMesAnterior` no `DashboardDto`/service. 1 teste back + 2 front; verificado no preview (real: Entrou +10% verde, Saiu +6% vermelho).
- **CSP do SPA (frontend prod)** (P2) ✅ — `nginx.conf` que serve o build ganhou CSP estrita + headers de segurança (nosniff, X-Frame DENY, Referrer, Permissions). Dev/Vite não passa por nginx (HMR intacto). Verificado via build+curl. Prod real precisa ajustar `connect-src` + baseURL hardcoded do axios.
- **403 (ownership) × 401 (auth)** (P2) ✅ — `ForbiddenAccessException`→403; 27 sites de ownership remapeados (401→403); AuthService mantém 401 só pra autenticação real. Front não desloga mais em erro de permissão (interceptor só age em 401). Convenção em `PROMPT §11`. 14 asserts + caso 403 no middleware (back 255/255).
- **Refresh token hasheado no banco** (P2) ✅ — `RefreshToken.Token` virou hash SHA-256 (`OpaqueTokenHasher`); bruto só no cookie; `CriarRefreshTokenAsync` devolve `(entity, bruto)`; refresh/logout por hash. 3 testes (back 254/254).
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

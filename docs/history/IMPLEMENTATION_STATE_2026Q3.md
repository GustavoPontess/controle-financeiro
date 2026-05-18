---
owner: Gustavo
archived_at: 2026-05-18
status: ARQUIVADO
---

# Implementation State — Q3 2026 [ARQUIVADO]

> Snapshot final do checkpoint vivo do ciclo Q3, encerrado em 2026-05-18.
> Estado granular do backlog ativo está em `IMPLEMENTATION_STATE.md` (Q4 2026).

Ciclo encerrado com 21/21 itens concluídos (100%). Todas as issues #11 a #31 entregues e mergeadas.

---

## Issues entregues no ciclo

### Bloco A — Higiene de Produção
- **#11 — Segredos via variáveis de ambiente** (PR #23)
  - `DotNetEnv`, `.env.example` versionado, fail-fast sem vars
- **#12 — Corrigir CORS contraditório** (PR #23, mesmo commit que #11)
  - Removido `AllowAnyOrigin()`, lista lida de `CORS_ALLOWED_ORIGINS`
- **#13 — JWT em httpOnly cookie + CSRF token** (PR #26)
  - `CsrfTokenService`, `SetAuthCookies` HttpOnly + SameSite=Strict, `CsrfValidationMiddleware`
  - Frontend `withCredentials: true`, zero tokens em localStorage
- **#14 — Rate limiting em endpoints sensíveis**
  - `Microsoft.AspNetCore.RateLimiting` (.NET 8 shared framework)
  - 3 políticas FixedWindow por IP: login 5/5min, register 3/1h, forgot 1/15min
- **#15 — Política de senha forte**
  - 10+ chars, complexidade, lista de senhas comuns PT-BR
  - `RegisterPage` com indicador de força em tempo real

### Bloco B — Infraestrutura para Escalar
- **#16 — Migrar SQLite para Postgres** (PR #35)
  - `DatabaseProvider` dinâmico por connection string; `EnableLegacyTimestampBehavior`
  - 27 migrations SQLite descartadas, regeneradas como InitialCreate Postgres
- **#17 — Hangfire com PostgresStorage** (PR #36)
  - Storage dinâmico (Postgres/Memory); dashboard `/hangfire` protegido por auth
- **#18 — Docker + docker-compose** (PR #34, sócio)
- **#19 — GitHub Actions CI** (PR #38, sócio)
- **#20 — Health checks + observabilidade** (PR #39)
  - `/health` (liveness) e `/health/ready` (banco + Hangfire)
  - Serilog console JSON + arquivo rotativo; CorrelationIdMiddleware; Sentry via sink
- **#21 — Testes frontend Vitest + RTL** (sócio)

### Bloco C — Pivot Família
- **#22 — Família + Membros** (PR #42) — 14 testes
- **#23 — Despesa Compartilhada igualitária** (PR #46) — 7 testes
- **#24 — Dependentes** (PR #48) — 10 testes
- **#25 — Modos de rateio (proporcional + personalizado)** (PR #49) — 14 testes
- **#26 — Acerto de contas** (PR #50) — 8 testes (Bloco C completo 🎉)

### Bloco D — Retenção e UX B2C
- **#27 — Importação OFX/CSV** (PR #51) — 14 testes
- **#28 — PWA instalável + offline básico** (PR #54)
- **#29 — Onboarding guiado pós-cadastro** (PR #52) — 8 testes
- **#30 — Notificações in-app** (PR #53) — 7 testes (Push/e-mail ficam como follow-up)
- **#31 — Dark mode** (sessão 26, sócio)

---

## Suíte de testes ao final do ciclo

130+ testes verdes (cresceu de ~48 ao início do ciclo).

## Decisões estratégicas registradas

### Sessão 25 (depois revertida)
Pausar #31 e pivotar para redesign UX inspirado em Monarch Money.
- Pause revertida na sessão 26 — sócio terminou #31 sobre a base visual atual
- Iniciativa de redesign mantida e movida para Q4 como ciclo monobloc

### Sessão 26 — saída do ciclo
- Q3 encerrado em 21/21 (100%)
- Q4 começa como ciclo monobloc de Redesign UX
- Ambos os devs trabalhando no front juntos
- Material público do Monarch + design tokens extraídos servem de base

---

## Histórico de issues por sessão

Detalhes completos em `docs/history/PROGRESS_2026Q3.md`. O ciclo anterior (Q2 2026, Parcelamento) está em `docs/history/IMPLEMENTATION_STATE_2026Q2_parcelamento.md`.

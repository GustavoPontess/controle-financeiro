---
owner: Gustavo
last_reviewed: 2026-05-15
next_review: 2026-08-15
status: CURRENT
---

# Progress Tracker — Q3 2026

**Objetivo:** Tornar o projeto produto B2C de finanças familiares.
**Backlog atual:** 21 itens em 4 blocos sequenciais (ver `ISSUES.md`).
**Iniciado em:** 2026-05-15.

---

## Dashboard

```
Bloco A — Higiene de Produção:          5/5  ✅ #11, #12, #13, #14, #15  🎉 BLOCO COMPLETO
Bloco B — Infraestrutura para Escalar:  6/6  ✅ #16, #17, #18, #19, #20, #21  🎉 BLOCO COMPLETO
Bloco C — Pivot Família:                4/5  ✅ #22, #23, #24, #25  ⏳ #26
Bloco D — Retenção e UX B2C:            0/5  ⏳ #31 (em andamento)

Total Q3 2026:                          15/21 (71%)
```

**Status geral:** Blocos A e B 100% 🎉. Bloco C 4/5 — #22 (Família), #23 (Despesa Compartilhada), #24 (Dependentes) e #25 (Modos de rateio) concluídas; falta #26 (Acerto de contas). Sócio em #31 (Dark mode).

---

## Backlog Q2 2026 (concluído)

Todos os 10 issues do backlog anterior foram resolvidos.
Histórico completo em `docs/history/PROGRESS_2026Q2.md` e `docs/history/ISSUES_2026Q2.md`.

Síntese:
- ✅ #1 Parcelamento Flexível (11h)
- ✅ #2 Testes Unitários/Integração (1h — 48 testes)
- ✅ #3 Validações de Negócio (30min)
- ✅ #4 Paginação em Endpoints (1h)
- ✅ #5 Autenticação Robusta — refresh + reset (1h)
- ✅ #6 Documentação com Dono e Revisão (20min)
- ✅ #7 API Versioning (`/api/v1`) (1h)
- ✅ #8 Error Handling Consistente (1h)
- ✅ #9 SQL Raw removido de Program.cs (30min)
- ✅ #10 Features Básicas — relatórios, CSV, orçamento (2h, parcial)

---

## Em progresso

#22, #23, #24 e #25 concluídas. Última do Bloco C: **#26 — Acerto de contas**. Sócio em #31 (Dark mode, Bloco D).

---

## Histórico de sessões

### Sessão 24 — 2026-05-17
- **Issue #25 — Sub-feature 4: Modos de rateio (✅ CONCLUÍDA)** — PR #49
  - Enum `ModoRateio`, `Familia.ModoRateioPadrao`, `MembroFamilia.RendaMensal`, `Transacao.ModoRateio`, entidade `RateioTransacao` + migration
  - `RateioService` (modo da família, renda, rateio personalizado); balanço recalcula cota por modo efetivo (igualitário/proporcional/personalizado)
  - Endpoints de modo-rateio/renda na FamiliasController e rateio na TransacoesController
  - Frontend: seletor de modo + renda por membro na FamiliasPage, diálogo de rateio na TransactionTable
  - 14 testes (suíte 69 → 83)
- **Issue #24 — Sub-feature 3: Dependentes (✅ CONCLUÍDA)** — PR #48
  - Entidade `Dependente` (sem login) + `TipoDependente` + `Transacao.DependenteId`
  - `DependenteService` (CRUD, atribuir despesa, gasto por dependente no mês) + endpoints + frontend
  - 10 testes
- **Issue #23 — Sub-feature 2: Despesa Compartilhada (✅ CONCLUÍDA)** — PR #46
  - `Transacao.FamiliaId`; `DespesaCompartilhadaService`; endpoints de compartilhamento, feed e balanço
  - Frontend: ação compartilhar na TransactionTable, balanço/despesas na FamiliasPage
  - 7 testes (suíte 62 → 69)
  - #23 estava CLOSED por engano (tracking trocado) — reaberta e concluída
- **Issue #22 — Sub-feature 1: Família + Membros (✅ CONCLUÍDA)** — PR #42
  - Entidades `Familia`, `MembroFamilia`, `ConviteFamilia` + migration
  - `FamiliaService` + `ConviteService`; `FamiliasController` + `ConvitesController`
  - Frontend: `familiaService`, `FamiliasPage`, rota `/familias`, item no Sidebar
  - 14 testes de serviço (suíte 48 → 62)
  - Validado em SQLite e Postgres
- **Postgres vira default de dev** (PR #43) — paridade dev/prod
- **Próxima ação:** Bloco C — #24 Dependentes

### Bloco B — itens do sócio
- **Issue #18 — Docker + docker-compose (✅ CONCLUÍDA)** — PR #34
- **Issue #19 — GitHub Actions CI (✅ CONCLUÍDA)** — PR #38 (corrige lint, CI verde)
- **Issue #21 — Testes frontend Vitest + RTL (✅ CONCLUÍDA)**

### Sessão 23 — 2026-05-16
- **Issue #16 — Migrar SQLite para Postgres (✅ CONCLUÍDA)** — PR #35
  - `DatabaseProvider`: provider escolhido em runtime pela connection string (`Host=` → Postgres)
  - Postgres usa migrations versionadas; SQLite (dev) cria schema via `EnsureCreated`
  - 27 migrations SQLite descartadas e regeneradas como `InitialCreate` Postgres; `AppDbContextFactory` fixa Postgres no design-time
  - `Npgsql.EnableLegacyTimestampBehavior` (DateTime naïve → `timestamp without time zone`)
  - `docker-compose.yml`: serviço Postgres; validado CRUD completo em Postgres real
- **Issue #17 — Hangfire com PostgresStorage (✅ CONCLUÍDA)** — PR #36
  - Storage dinâmico: `PostgreSqlStorage` (schema `hangfire`) em Postgres, `MemoryStorage` em dev SQLite
  - Dashboard `/hangfire` protegido (`HangfireDashboardAuthFilter` — exige autenticação)
  - Validado: 5 jobs recorrentes persistem após restart da API
- **Issue #20 — Health checks + observabilidade (✅ CONCLUÍDA)** — PR #39
  - Health checks: `/health` (liveness) e `/health/ready` (banco + Hangfire)
  - Serilog: console JSON + arquivo rotativo diário; `CorrelationIdMiddleware` (ID por request)
  - Sentry: sink do Serilog, ativado por `SENTRY_DSN` (não validado end-to-end — requer DSN real)
- **Fixes pré-existentes** (em branch própria, PRs separados): CORS, redirect loop, PagedResult
- **Próxima ação:** Issue #21 — Testes frontend (Vitest + RTL), Bloco B

### Sessão 22 — 2026-05-16
- **Issue #15 — Política de senha forte (✅ CONCLUÍDA) — Bloco A 100% completo 🎉**
  - `PasswordPolicyService`: mínimo 10 chars, minúscula, maiúscula, número, especial, lista de senhas comuns PT-BR aware
  - `AuthService`: substituídos 3 checks `< 6` por `ValidarOuLancar` em Register, ResetSenha e ChangePassword
  - `RegisterPage.tsx`: indicador de força em tempo real (LinearProgress + checklist ✓/○ por regra)
  - Fix colateral: `RecorrentesPage.tsx` bug pré-existente (`notify` sem `useOutletContext`)
  - Build backend + frontend: 0 erros ✅
- **Próxima ação:** Issue #16 (Migrar SQLite → Postgres) — Bloco B

### Sessão 21 — 2026-05-16
- **Issue #14 — Rate limiting em endpoints sensíveis (✅ CONCLUÍDA)**
  - `Microsoft.AspNetCore.RateLimiting` (middleware nativo .NET 8, shared framework)
  - 3 políticas `FixedWindow` particionadas por IP: login (5/5min),
    register (3/1h), forgot-password (1/15min)
  - Resposta `429` com header `Retry-After`; `FixedWindow` escolhido pois
    `SlidingWindow` não popula o metadata `RetryAfter`
  - Testes curl: login 6º→429 (Retry-After:300), register 4º→429,
    forgot-password 2º→429
- **Fixes pré-existentes na mesma branch** (não fazem parte de #14):
  - CORS `AllowCredentials` — frontend `withCredentials` exigia o header
  - Loop de redirect 401 em `/auth/login`
  - Services de listagem desempacotam `PagedResult.items` (5 services)
  - Error handling em `Promise.all` em 6 páginas
- **Próxima ação:** Issue #15 (Política de senha forte) — Bloco A

### Sessões 16–20 — 2026-05-16
- **Issue #13 — JWT em httpOnly cookie + CSRF token (✅ CONCLUÍDA)**
  - Backend: `CsrfTokenService`, `SetAuthCookies` (HttpOnly + SameSite=Strict), `CsrfValidationMiddleware`
  - Middleware skipa endpoints públicos (login, register, password reset)
  - `Secure` flag adapta ao protocolo (false em HTTP dev, true em HTTPS prod)
  - Register/Refresh/Logout leem/emitem cookies; JWT não aparece no body
  - `JwtBearer.OnMessageReceived` lê token do cookie `jwt`
  - Frontend: `withCredentials: true`, CSRF header automático em mutators, zero tokens em localStorage
  - `AuthContext`: logout chama `POST /auth/logout` para limpar cookies no servidor
  - `savedAccounts` em localStorage é lista de contas (não tokens)
  - Testes curl: 403 sem CSRF header, 200 com header ✅, JWT não em localStorage ✅
  - PR #26 mergeado, Issue #13 fechada

- **Próxima ação:** Issue #14 (Rate limiting em endpoints sensíveis) — Bloco A

### Sessão 15 — 2026-05-16
- **Issue #11 — Segredos via variáveis de ambiente (✅ CONCLUÍDA)**
  - Moveu JWT secret, database URL e CORS origins para variáveis de ambiente via `DotNetEnv`
  - Criou `.env.example` versionado; `.env` local ignorado
  - Atualizou `Program.cs` com `Env.Load()` e fallback claro (fail-fast)
  - Removeu segredos de `appsettings.json` versionado
  - Testou build ✅, API sobe com `.env` ✅, erro sem vars ✅
  - Documentou em `docs/STANDARDS.md` §Configuration via Environment Variables
  - PR #23 mergeado em main
  
- **Issue #12 — Corrigir CORS contraditório (✅ CONCLUÍDA)**
  - Removido `.AllowAnyOrigin()` que sobrescrevia `WithOrigins()`
  - CORS origins agora lidos dinamicamente de `CORS_ALLOWED_ORIGINS` env var
  - Resolvida como parte de #11 (mesmo commit que env vars)
  - Requisição de origem não-permitida retorna erro CORS correto
  - Issue #12 fechada

- **Próxima ação:** Issue #13 (JWT em httpOnly cookie + CSRF token) — Bloco A, segurança crítica

### Sessão 14 — 2026-05-15
- Análise crítica completa do projeto sob lente de produto B2C (`docs/ANALISE_PRODUTO.md`)
- Decisão de pivot para nicho de finanças familiares/casais
- Reorganização da documentação em `docs/features/` por feature
- Backlog Q2 arquivado em `docs/history/`
- Novo backlog Q3 criado com 21 itens em 4 blocos
- Visão da feature Família escrita (`docs/features/familia/visao.md`)

---

## Checklist de encerramento de sessão

Cada sessão que tocar em código deve, ao terminar, atualizar este arquivo:

1. Mover itens iniciados de "Pendentes" para "Em progresso" ou "Resolvidos"
2. Atualizar dashboard (`X/Y` de cada bloco)
3. Adicionar entrada nova em "Histórico de sessões" com data, o que foi feito, próxima ação
4. Se um item virou concluído, mover seção dele de `ISSUES.md` para a área "Resolvidos" (mantém referência)
5. Commit do estado: `chore(docs): atualiza progress — sessão N`

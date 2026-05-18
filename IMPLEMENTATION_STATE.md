---
owner: Caio
last_reviewed: 2026-05-16
status: CONCLUIDA
issue_atual: '#15 — Política de senha forte'
---

# Implementation State — sessão atual

**Este arquivo é o checkpoint vivo entre sessões.** Toda sessão começa lendo este arquivo, e termina atualizando-o.

> O estado anterior (Issue #1 — Parcelamento Flexível, 13 sessões) está arquivado em `docs/history/IMPLEMENTATION_STATE_2026Q2_parcelamento.md`.

---

## Issue em execução

**Issue:** #13 — JWT em httpOnly cookie + CSRF token
**Bloco:** A (Higiene de Produção)
**Iniciada em:** 2026-05-16 (sessão 16)
**Sessões nessa issue:** 4
**Status:** 100% CONCLUÍDA ✅ — backend ✅, frontend ✅, testes curl ✅, validação de código ✅, PR #26 mergeado

### Etapas
- [x] 1. CsrfTokenService: gerar e validar tokens
- [x] 2. AuthController: SetAuthCookies com HttpOnly, Secure, SameSite=Strict
- [x] 3. Login/Refresh: emitir em cookies, não no body
- [x] 4. CsrfValidationMiddleware: validar X-CSRF-Token em POST/PUT/DELETE/PATCH
- [x] 5. Frontend: remover JWT de localStorage
- [x] 6. Frontend: axiosConfig com withCredentials: true
- [x] 7. Frontend: incluir X-CSRF-Token em headers (mutators)
- [x] 8. Frontend: remover Token/RefreshToken de storage — refatorado AuthContext
- [x] 9. Testar: JWT não aparece em localStorage (curl: token vazio no body ✅)
- [x] 10. Testar: CSRF bloqueado — 403 sem header, 200/400 com header ✅

### Fixes aplicados na sessão 19
- `SetAuthCookies`: `Secure = Request.IsHttps` (falso em dev HTTP, verdadeiro em prod HTTPS)
- `Register`: agora chama `SetAuthCookies`, retorna body sem tokens
- `Refresh`: lê refreshToken do cookie (não do body)
- `Logout`: lê refreshToken do cookie, chama `ClearAuthCookies()`
- `JwtBearer.OnMessageReceived`: lê token do cookie `jwt`
- `AuthContext.logout()`: chama `api.post('/auth/logout')` para limpar cookies no servidor
- Commits: 050b2b0

### Sessão 20 (2026-05-16)
- Validação de código frontend: zero referências a localStorage com tokens ✅
- `axiosConfig.ts`: `withCredentials: true`, CSRF header só em mutators, sem `Authorization: Bearer` ✅
- `AuthContext.tsx`: `savedAccounts` em localStorage (lista de contas, não tokens), logout chama POST /auth/logout ✅
- PR #26 mergeado
- Próxima issue: #14 — Rate limiting em endpoints sensíveis (Bloco A)

---

## Issue em execução

**Issue:** #14 — Rate limiting em endpoints sensíveis
**Bloco:** A (Higiene de Produção)
**Iniciada em:** 2026-05-16 (sessão 21)
**Sessões nessa issue:** 1
**Status:** 100% CONCLUÍDA ✅ — build verde, testes curl ✅

### Escopo
- Rate limiting em `/auth/login`, `/auth/register`, `/auth/forgot-password`
- Limites (todos particionados por IP):
  - login: 5 tentativas / 5min
  - register: 3 / 1h
  - forgot-password: 1 / 15min
- `Microsoft.AspNetCore.RateLimiting` (middleware nativo .NET 8)
- Resposta `429 Too Many Requests` com header `Retry-After`

### Decisões
- forgot-password particionado por IP (não por e-mail) — consistente com
  login/register, sem necessidade de buffering do request body. Decisão do
  usuário em 2026-05-16.

### Etapas
- [x] 1. `AddRateLimiter` com 3 políticas particionadas por IP em `Program.cs`
- [x] 2. `OnRejected` → setar `Retry-After` + status 429
- [x] 3. `UseRateLimiter` no pipeline
- [x] 4. `[EnableRateLimiting]` nos 3 endpoints do `AuthController`
- [x] 5. Build verde (`dotnet build`)
- [x] 6. Testar curl — login 6º→429 (Retry-After:300), register 4º→429, forgot-password 2º→429
- [x] 7. Commit (8ab9317), atualizar docs, PR

### Resultado
- `FixedWindowRateLimiter` escolhido sobre `SlidingWindow`: SlidingWindow não
  popula o metadata `RetryAfter`, e o escopo exige o header `Retry-After`.
- `Microsoft.AspNetCore.RateLimiting` é parte do shared framework .NET 8 —
  não precisou de `PackageReference`.

### Próxima ação concreta
Issue #15 concluída. Bloco A 100% concluído. Próxima: #16 — Migrar SQLite para Postgres (Bloco B).

### Contexto da sessão 21 (fixes pré-existentes)
Antes de iniciar #14, foram corrigidos bugs pré-existentes nesta branch
(commits ec895e3..f2d3baa): CORS AllowCredentials, redirect loop 401,
desempacote de PagedResult em 5 services. Não fazem parte de #14.

---

---

## Issue em execução

**Issue:** #15 — Política de senha forte
**Bloco:** A (Higiene de Produção)
**Iniciada em:** 2026-05-16 (sessão 22)
**Sessões nessa issue:** 1
**Status:** 100% CONCLUÍDA ✅ — build verde backend ✅, build verde frontend ✅, commit c9eedcd, PR aberto (aguarda merge)

### Etapas
- [x] 1. `PasswordPolicyService.cs`: validar 10+ chars, minúscula, maiúscula, número, especial, lista senhas comuns
- [x] 2. `AuthService.cs`: substituir checks `< 6` em RegisterAsync, ResetSenhaAsync, ChangePasswordAsync
- [x] 3. `RegisterPage.tsx`: indicador de força em tempo real (LinearProgress + checklist ✓/○)
- [x] 4. Builds verdes (backend + frontend)
- [x] 5. Commit + push + PR (gh não disponível; PR criado manualmente no GitHub)

### Fix colateral
- `RecorrentesPage.tsx`: bug pré-existente (`notify` não declarado). Fix: `useOutletContext<OutletContextType>()`.

### Próxima ação concreta
Issue #15 concluída. **Bloco A 100% concluído.**

---

## Issue em execução

**Issue:** #16 — Migrar SQLite para Postgres
**Bloco:** B (Infraestrutura para Escalar)
**Iniciada em:** 2026-05-16 (sessão 23)
**Sessões nessa issue:** 1
**Status:** 100% CONCLUÍDA ✅ — validado em Postgres, 48 testes verdes

### Etapas
- [x] 1. `Npgsql.EntityFrameworkCore.PostgreSQL` + `DatabaseProvider` (seleção por connection string)
- [x] 2. `Program.cs`: provider dinâmico — Postgres `Migrate()`, SQLite `EnsureCreated()`
- [x] 3. `AppDbContextFactory` (design-time fixa Postgres) + migrations regeneradas para Postgres
- [x] 4. `docker-compose.yml` com Postgres 16
- [x] 5. Fix `Npgsql.EnableLegacyTimestampBehavior` (DateTime naïve → `timestamp without time zone`)
- [x] 6. Validado: API roda em Postgres, CRUD completo, 48 testes verdes

### Decisões
- Detecção de provider: connection string com `Host=` → Postgres, senão SQLite.
- SQLite (dev) usa `EnsureCreated` (sem migrations); Postgres (prod) usa migrations
  versionadas. Migrations multi-provider no mesmo assembly causam conflito de
  snapshot — separar por provider de runtime evita isso.
- Migrations SQLite antigas (27) descartadas e regeneradas como uma `InitialCreate`
  Postgres — não havia banco de produção a preservar.
- `EnableLegacyTimestampBehavior`: o domínio usa `DateTime` naïve; o modo legado
  mapeia para `timestamp without time zone`. Migrar o domínio para UTC-aware está
  fora do escopo de #16.

### Próxima ação concreta
#16 concluída.

---

## Issue em execução

**Issue:** #17 — Hangfire com PostgresStorage
**Bloco:** B (Infraestrutura para Escalar)
**Iniciada em:** 2026-05-16 (sessão 23)
**Sessões nessa issue:** 1
**Status:** 100% CONCLUÍDA ✅ — validado em Postgres, 48 testes verdes

### Etapas
- [x] 1. Package `Hangfire.PostgreSql`
- [x] 2. Storage dinâmico: Postgres → `PostgreSqlStorage` (schema `hangfire`, `PrepareSchemaIfNecessary`), SQLite → `MemoryStorage`
- [x] 3. Dashboard `/hangfire` protegido (`HangfireDashboardAuthFilter` — exige autenticação)
- [x] 4. Validado: schema `hangfire` criado, 5 jobs recorrentes persistem após restart, dashboard 401 sem auth

### Decisões
- Storage segue o provider (igual ao DbContext de #16): MemoryStorage em dev
  SQLite, PostgreSqlStorage em prod. Hangfire.PostgreSql só funciona com Postgres.
- Dashboard exige usuário autenticado (não papel admin — papéis não existem
  ainda; virão no Bloco C).
- Health check do Hangfire fica para #20 (Health checks + observabilidade).

### Próxima ação concreta
#17 concluída.

---

## Issue em execução

**Issue:** #20 — Health checks + observabilidade
**Bloco:** B (Infraestrutura para Escalar)
**Iniciada em:** 2026-05-16 (sessão 23)
**Sessões nessa issue:** 1
**Status:** 100% CONCLUÍDA ✅ — build verde, 48 testes verdes

### Etapas
- [x] 1. Health checks: `/health` (liveness) e `/health/ready` (banco + Hangfire)
- [x] 2. Serilog: console JSON compacto + arquivo rotativo diário (`logs/`)
- [x] 3. `CorrelationIdMiddleware`: ID por request, response header + LogContext
- [x] 4. Sentry: sink do Serilog (Error+), ativado por `SENTRY_DSN`

### Decisões
- Health check do banco usa `AddDbContextCheck` (provider-agnóstico), não
  `AddNpgSql` — funciona em SQLite (dev) e Postgres (prod).
- `/health/ready` sem auth: readiness probe é consumido por orquestradores/
  docker healthcheck, que não autenticam. O response não expõe dado sensível.
- Sentry via sink do Serilog (não `UseSentry` no WebHost): o
  `GlobalExceptionHandlerMiddleware` captura todas as exceções, então elas
  nunca chegariam "não tratadas" ao Sentry — o sink capta o log Error.
- Sentry não validado end-to-end (requer DSN real). Integração e ativação
  condicional testadas; sem DSN o Sentry fica desligado.

### Próxima ação concreta
#20 concluída. Bloco B 6/6 (sócio fechou #19 e #21).

---

## Issue em execução

**Issue:** #22 — Sub-feature 1: Família + Membros (sem rateio)
**Bloco:** C (Pivot Família)
**Iniciada em:** 2026-05-17 (sessão 24)
**Sessões nessa issue:** 1
**Status:** 100% CONCLUÍDA ✅ — backend + frontend + testes, 62 testes verdes

### Etapas
- [x] 1. Entidades (Familia, MembroFamilia, ConviteFamilia) + enum + AppDbContext + migration
- [x] 2. DTOs + `FamiliaService` + `ConviteService`
- [x] 3. `FamiliasController` + `ConvitesController`
- [x] 4. Frontend: `familiaService` + `FamiliasPage` + rota `/familias` + Sidebar
- [x] 5. Testes de serviço — 14 testes (FamiliaService + ConviteService), suíte 48→62

### Contexto
- Spec técnica completa em `docs/features/familia/sub-1-familia-membros/arquitetura.md`
  — ler antes de continuar (entidades, endpoints, regras de negócio).
- Migration `AddFamiliaMembros` aplicada e validada em Postgres real (docker-compose).

### Decisões
- `Papel` é string livre (presets só na UI). Admin = membro cujo `UsuarioId`
  == `Familia.CriadoPorUsuarioId`.
- Unicidade de membro ativo `(FamiliaId, UsuarioId)` validada no service (soft
  delete permite reentrada — índice único impediria).
- #23 (Sub-feature 2) está CLOSED no GitHub com `stateReason: COMPLETED` sem PR
  visível — possível fechamento por engano; confirmar com o usuário/sócio.

### Validação do backend
Fluxo testado em **SQLite e Postgres** (curl): migration `AddFamiliaMembros`
aplica em Postgres; criar família → convidar → aceitar → família com 2 membros.
Fix aplicado: `ConviteFamiliaDto` não expunha `Token` (convidado não conseguia
aceitar).

### Próxima ação concreta
#22 concluída — PR #42 mergeado.

---

## Issue em execução

**Issue:** #23 — Sub-feature 2: Despesa Compartilhada (modo igualitário)
**Bloco:** C (Pivot Família)
**Iniciada em:** 2026-05-17 (sessão 24)
**Sessões nessa issue:** 1
**Status:** 100% CONCLUÍDA ✅ — backend + frontend + testes, 69 testes verdes

### Etapas
- [x] 1. `Transacao.FamiliaId` + FK + índice + migration `AddFamiliaIdToTransacao`
- [x] 2. DTOs + `DespesaCompartilhadaService` (marcar, desmarcar, feed, balanço)
- [x] 3. Endpoints — `TransacoesController` (compartilhamento) + `FamiliasController` (despesas, balanço)
- [x] 4. Frontend: visualização (balanço + despesas na FamiliasPage) + ação compartilhar na TransactionTable
- [x] 5. Testes de serviço — 7 testes (DespesaCompartilhadaService), suíte 62→69

### Validação do backend
Testado em Postgres (curl): compartilhar transação → 204; feed retorna a
despesa com pagador; balanço igualitário correto (total 300, cota 300 com
1 membro, saldo 0).

### Contexto
- #23 estava CLOSED por engano (issue GitHub #13 com título trocado — tracking
  de JWT/CSRF). Reaberta nesta sessão.
- Spec completa em `docs/features/familia/sub-2-despesa-compartilhada/arquitetura.md`.

### Decisões
- Despesa compartilhada = `Transacao` com `FamiliaId` preenchido. Sem entidade
  nova: rateio igualitário é calculado (total ÷ nº membros). Pagador =
  `Transacao.CriadoPor`. Entidades de pagador/beneficiário só em #25.
- MVP só modo igualitário; só `Tipo = Despesa` compartilhável.

### Próxima ação concreta
#23 concluída — PR #46 mergeado.

---

## Issue em execução

**Issue:** #24 — Sub-feature 3: Dependentes
**Bloco:** C (Pivot Família)
**Iniciada em:** 2026-05-17 (sessão 24)
**Sessões nessa issue:** 1
**Status:** 100% CONCLUÍDA ✅ — backend + frontend + testes, 79 testes verdes

### Etapas
- [x] 1. Entidade `Dependente` + enum `TipoDependente` + `Transacao.DependenteId` + AppDbContext + migration
- [x] 2. DTOs + `DependenteService` (CRUD, atribuir despesa, gasto por dependente)
- [x] 3. Endpoints — `FamiliasController` (dependentes) + `TransacoesController` (atribuir)
- [x] 4. Frontend: CRUD de dependentes na `FamiliasPage` + atribuir na `TransactionTable`
- [x] 5. Testes de serviço — 10 testes (`DependenteServiceTests`), suíte 69→79

### Contexto
- Spec completa em `docs/features/familia/sub-3-dependentes/arquitetura.md`.
- Dependente = entidade sem login (rótulo de atribuição de despesa). `Transacao`
  ganhou `DependenteId` nullable — independente de `FamiliaId` (#23).

### Decisões
- Endpoints de dependente foram adicionados ao `FamiliasController` (não um
  `DependentesController` separado) — consistente com despesas/balanço, que já
  ficam aninhados sob `/familias/{id}`.

### Próxima ação concreta
#24 concluída — PR #48 (atualizar de Draft para Ready). Próxima no Bloco C:
#25 — modos de rateio.

---

## Template para preencher quando começar uma issue

```
## Issue em execução

**Issue:** #XX — [nome]
**Bloco:** [A/B/C/D]
**Iniciada em:** YYYY-MM-DD
**Sessões nessa issue:** N

### Etapas
- [x] 1. [descrição] — checkpoint: [...]
- [ ] 2. [descrição] — checkpoint: [...]
- [ ] 3. [descrição] — checkpoint: [...]

### Etapa atual
[Qual etapa, o que falta pra fechar]

### Próxima ação concreta
[Exatamente o próximo passo — arquivo a tocar, método a criar, etc]

### Decisões tomadas nesta sessão
- [Decisão importante que afeta outros pontos]

### Pontos pendentes / dúvidas para o usuário
- [Coisa que precisa de input antes de avançar]
```

---

---

## Como esse arquivo se relaciona com PROGRESS.md e ISSUES.md

- **ISSUES.md** = catálogo de tudo que precisa ser feito, com escopo e severidade. Não muda durante a sessão.
- **PROGRESS.md** = dashboard de quanto já foi feito, histórico de sessões. Atualizado ao final de cada sessão.
- **IMPLEMENTATION_STATE.md (este)** = estado granular de **uma** issue em execução. Atualizado a cada etapa concluída dentro da sessão.

Os três funcionam em camadas: este é o mais granular, PROGRESS.md é a visão mensal, ISSUES.md é o catálogo trimestral.

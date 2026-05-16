---
owner: Gustavo
last_reviewed: 2026-05-16
status: EM_EXECUCAO
issue_atual: '#13 — JWT em httpOnly cookie + CSRF token'
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
Issue #14 concluída. Próxima: #15 — Política de senha forte (Bloco A).

### Contexto da sessão 21 (fixes pré-existentes)
Antes de iniciar #14, foram corrigidos bugs pré-existentes nesta branch
(commits ec895e3..f2d3baa): CORS AllowCredentials, redirect loop 401,
desempacote de PagedResult em 5 services. Não fazem parte de #14.

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

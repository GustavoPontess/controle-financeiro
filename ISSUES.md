---
owner: Gustavo
last_reviewed: 2026-05-15
next_review: 2026-08-15
status: CURRENT
---

# Issues & Roadmap — Q3 2026

**Contexto:** O backlog Q2 2026 (Issues #1-#10) foi concluído — ver `docs/history/ISSUES_2026Q2.md`. Esse backlog focou em higiene de código sobre o que já existia. Este novo roadmap reflete:

1. Análise crítica de produto feita em 2026-05-15 (ver `docs/ANALISE_PRODUTO.md`)
2. Decisão de **pivot para nicho de finanças familiares/casais** (ver `docs/features/familia/visao.md`)
3. Lacunas reais para virar produto B2C, não cobertas pelo backlog Q2

**Status geral:** 0/20 itens iniciados • 4 blocos sequenciais

---

## Estrutura em 4 blocos

A ordem dos blocos é **obrigatória** — pular blocos cria dívida que volta a custar caro depois.

| Bloco | Tema | Duração estimada | Por que nessa posição |
|---|---|---|---|
| **A** | Higiene de produção | 5-7 dias | Vulnerabilidades reais. Não pode ter usuário antes de fechar |
| **B** | Infraestrutura para escalar | 10-14 dias | Sem isso, qualquer crescimento quebra o app |
| **C** | Pivot Família | 4-6 semanas | A feature diferenciadora. Sem ela, somos só "mais um app de finanças" |
| **D** | Retenção e UX B2C | 6-10 semanas | Importação OFX, mobile, push — o que mantém usuário no app |

Total realista: **4-6 meses part-time** ou **2-3 meses full-time**.

---

## 🅰️ BLOCO A — Higiene de Produção

> Sem isso, qualquer usuário real é incidente de segurança. **Inadiável.**

### 🔴 #11 — Segredos via variáveis de ambiente

**Severidade:** 🔴 CRÍTICA • **Esforço:** 2h • **Status:** ⏳ NÃO INICIADO

**Problema:** JWT secret e connection string hardcoded em `Program.cs` (linha 64) e `appsettings.json` (linha 9). Qualquer um com acesso ao repositório consegue forjar tokens válidos.

**Solução:**
- Mover JWT secret para variável de ambiente `JWT_SECRET`
- Connection string via `DATABASE_URL` (já preparando migração para Postgres no Bloco B)
- Adicionar `appsettings.Development.json` com placeholders (ignorado em git)
- Documentar em `docs/STANDARDS.md` o padrão de configuração

**Checkpoint:** API sobe lendo variáveis do ambiente; `appsettings.json` versionado não contém segredos reais.

---

### 🔴 #12 — Corrigir CORS contraditório

**Severidade:** 🔴 CRÍTICA • **Esforço:** 30min • **Status:** ⏳ NÃO INICIADO

**Problema:** `Program.cs` linha 169 tem `.WithOrigins("http://localhost:5173").AllowAnyOrigin()` — `AllowAnyOrigin()` sobrescreve `WithOrigins()` e na prática aceita qualquer origem.

**Solução:**
- Remover `.AllowAnyOrigin()`
- Configurar lista de origens permitidas via variável de ambiente `CORS_ALLOWED_ORIGINS` (separada por vírgula)
- Default em dev: `http://localhost:5173`
- Em produção: domínio real do frontend
- Validar headers expostos (`Authorization`, `Content-Type`) e métodos (`GET, POST, PUT, DELETE, PATCH`)

**Checkpoint:** Requisição de origem não-permitida retorna erro CORS no browser.

---

### 🔴 #13 — JWT em httpOnly cookie + CSRF token

**Severidade:** 🔴 CRÍTICA • **Esforço:** 1 dia • **Status:** ⏳ NÃO INICIADO

**Problema:** Frontend armazena JWT em `localStorage` (`axiosClient.ts`). XSS rouba o token e o atacante se passa pelo usuário.

**Solução:**
- Backend emite JWT em `Set-Cookie` com flags `HttpOnly`, `Secure`, `SameSite=Strict`
- Refresh token em cookie separado com mesmo padrão
- CSRF token em header customizado (`X-CSRF-Token`) emitido junto via cookie comum
- `axiosClient` envia credenciais (`withCredentials: true`) e inclui o CSRF token nos métodos mutators
- Backend valida CSRF token em POST/PUT/DELETE/PATCH

**Checkpoint:** Inspeção do DevTools não mostra JWT em `localStorage`/`sessionStorage`. Tentativa de CSRF de outra origem é bloqueada.

---

### 🟡 #14 — Rate limiting em endpoints sensíveis

**Severidade:** 🟡 ALTA • **Esforço:** 3h • **Status:** ⏳ NÃO INICIADO

**Problema:** `/auth/login`, `/auth/register`, `/auth/forgot-password` sem rate limiting — brute force trivial.

**Solução:**
- Usar `AspNetCoreRateLimit` ou middleware nativo `Microsoft.AspNetCore.RateLimiting` (.NET 8)
- Política fixa: 5 tentativas de login por IP em 5min
- 3 cadastros por IP por hora
- 1 reset de senha por e-mail por 15min
- Retornar `429 Too Many Requests` com `Retry-After`

**Checkpoint:** 6ª tentativa de login no mesmo IP retorna 429.

---

### 🟡 #15 — Política de senha forte + 2FA opcional

**Severidade:** 🟡 ALTA • **Esforço:** 4h (senha) + 2 dias (2FA fora do MVP) • **Status:** ⏳ NÃO INICIADO

**Problema:** Senha mínima de 6 chars sem requisito de complexidade. Cai em ataque de dicionário.

**Solução (MVP — só senha):**
- Mínimo 10 caracteres
- Pelo menos 1 letra minúscula, 1 maiúscula, 1 número, 1 caractere especial
- Verificação contra lista das 10k senhas mais comuns (`HaveIBeenPwned` API offline ou arquivo local)
- Frontend mostra força da senha em tempo real
- Mensagem clara do que está faltando

**Solução (futura — 2FA):**
- TOTP via app autenticador (Google Authenticator, Authy)
- Opt-in via configuração do usuário
- Backup codes para recuperação

**Checkpoint MVP:** Cadastro com senha fraca retorna erro listando requisitos.

---

## 🅱️ BLOCO B — Infraestrutura para Escalar

> O que separa "rodando no meu computador" de "100 usuários sem cair".

### 🔴 #16 — Migrar SQLite para Postgres

**Severidade:** 🔴 CRÍTICA • **Esforço:** 3-4 dias • **Status:** ⏳ NÃO INICIADO

**Problema:** SQLite é single-writer. Acima de ~50 usuários ativos simultâneos, queries começam a serializar e a UX cai. Backup é "copia arquivo" — não há replicação.

**Solução:**
- Adicionar `Npgsql.EntityFrameworkCore.PostgreSQL`
- Connection string genérica via `DATABASE_URL` com prefixo (`postgres://` vs `sqlite://`)
- Provider selecionado dinamicamente em `Program.cs`
- Revisar migrations existentes — algumas usam funções SQLite-specific (`datetime('now')`)
- Manter SQLite em dev/test (rápido para subir) e Postgres em prod
- Script de seed que funcione nos dois providers

**Checkpoint:** API roda em Postgres local (docker-compose) com 100% dos testes passando.

---

### 🔴 #17 — Hangfire com PostgresStorage

**Severidade:** 🔴 CRÍTICA • **Esforço:** 4h • **Status:** ⏳ NÃO INICIADO

**Problema:** Atualmente Hangfire usa `MemoryStorage` (`Program.cs` linha 58). A cada deploy, fila de jobs é perdida. Fatura agendada não fecha, recorrente não dispara.

**Solução:**
- Trocar para `Hangfire.PostgreSql`
- Schema separado `hangfire` no mesmo banco
- Migration automática na inicialização (`PrepareSchemaIfNecessary = true`)
- Dashboard `/hangfire` protegido por autenticação admin
- Health check do Hangfire incluído no `/health`

**Checkpoint:** Restart da API mantém jobs agendados intactos.

---

### 🟡 #18 — Docker + docker-compose

**Severidade:** 🟡 ALTA • **Esforço:** 1 dia • **Status:** ⏳ NÃO INICIADO

**Problema:** Sem containerização. Deploy depende de ambiente local com .NET SDK + Node + dependências.

**Solução:**
- `Dockerfile` multi-stage para a API (build SDK → runtime alpine)
- `Dockerfile` para o frontend (build Node → nginx servindo dist/)
- `docker-compose.yml` orquestrando: API + Web + Postgres + Volume de dados
- `docker-compose.dev.yml` com volumes para hot reload
- README atualizado com comandos `docker compose up`

**Checkpoint:** `docker compose up` sobe stack inteira em ambiente limpo.

---

### 🟡 #19 — GitHub Actions: build, test, lint

**Severidade:** 🟡 ALTA • **Esforço:** 1 dia • **Status:** ⏳ NÃO INICIADO

**Problema:** Sem CI. Mudanças vão para `main` sem nenhum gate automático.

**Solução:**
- `.github/workflows/ci.yml` rodando em PR e push para main
- Job backend: `dotnet restore`, `dotnet build --no-restore --warnaserror`, `dotnet test`
- Job frontend: `npm ci`, `npm run lint`, `npm run build`, futuramente `npm test`
- Cache de NuGet e node_modules
- Badge no README com status
- Bloqueio de merge se algum job falhar (configurar em branch protection)

**Checkpoint:** PR com código quebrado vira merge bloqueado.

---

### 🟡 #20 — Health checks + observabilidade

**Severidade:** 🟡 ALTA • **Esforço:** 1-2 dias • **Status:** ⏳ NÃO INICIADO

**Problema:** Sem `/health`, sem logs estruturados, sem rastreamento de erros. Em produção, problema vira mistério até usuário reclamar.

**Solução:**
- `Microsoft.AspNetCore.Diagnostics.HealthChecks` + `AspNetCore.HealthChecks.NpgSql` + `AspNetCore.HealthChecks.Hangfire`
- Endpoints `/health` (público, leve) e `/health/ready` (detalhado, protegido)
- Serilog com sink para console (estruturado JSON) e arquivo rotativo
- Sentry (`Sentry.AspNetCore`) com DSN via env var — só ativa em produção
- Correlation ID injetado em logs e response headers

**Checkpoint:** Erro proposital aparece no Sentry com stacktrace completo e correlation ID.

---

### 🟠 #21 — Testes frontend (Vitest + RTL)

**Severidade:** 🟠 MÉDIA • **Esforço:** 2-3 dias • **Status:** ⏳ NÃO INICIADO

**Problema:** Zero teste no frontend. Refactor é roleta russa.

**Solução:**
- Configurar `vitest` + `@testing-library/react` + `@testing-library/user-event`
- Setup com `jsdom`, mocks para axios e react-router
- Cobertura inicial mínima: smoke test em cada página + lógica de validação de formulários críticos (transação, login, parcelamento)
- Adicionar ao CI (`npm test`)

**Checkpoint:** 30+ testes no frontend rodando no CI.

---

## 🅲️ BLOCO C — Pivot Família

> A feature que justifica o produto existir. Ver `docs/features/familia/visao.md` antes de começar.

### 🟢 #22 — Sub-feature 1: Família + Membros (sem rateio)

**Severidade:** 🟢 FEATURE • **Esforço:** 2 semanas • **Status:** ⏳ NÃO INICIADO

**Escopo:** Criar família, convidar membros (existentes e novos), aceitar/recusar, papéis editáveis, listar, sair.

**Pré-requisitos:** Blocos A e B concluídos.

**Spec técnica:** A criar em `docs/features/familia/sub-1-familia-membros/` quando começar.

---

### 🟢 #23 — Sub-feature 2: Despesa Compartilhada (modo igualitário)

**Severidade:** 🟢 FEATURE • **Esforço:** 1-2 semanas • **Status:** ⏳ NÃO INICIADO

**Escopo:** Marcar transação como compartilhada, feed compartilhado, balanço mensal igualitário.

**Spec técnica:** A criar em `docs/features/familia/sub-2-despesa-compartilhada/` quando começar.

---

### 🟢 #24 — Sub-feature 3: Dependentes

**Severidade:** 🟢 FEATURE • **Esforço:** 1 semana • **Status:** ⏳ NÃO INICIADO

**Escopo:** Criar dependente, atribuir despesa, filtro por dependente.

---

### 🟢 #25 — Sub-feature 4: Modos de rateio (proporcional + custom)

**Severidade:** 🟢 FEATURE • **Esforço:** 1 semana • **Status:** ⏳ NÃO INICIADO

**Escopo:** Regra de divisão proporcional à renda e custom por despesa. Recalcular balanços.

---

### 🟢 #26 — Sub-feature 5: Acerto de contas

**Severidade:** 🟢 FEATURE • **Esforço:** 4-5 dias • **Status:** ⏳ NÃO INICIADO

**Escopo:** Marcar saldo como acertado, histórico, comprovante opcional.

---

## 🅳️ BLOCO D — Retenção e UX B2C

> O que mantém o usuário no app depois da primeira semana.

### 🔴 #27 — Importação OFX/CSV de extrato bancário

**Severidade:** 🔴 CRÍTICA PRA RETENÇÃO • **Esforço:** 1-2 semanas • **Status:** ⏳ NÃO INICIADO

**Por que crítica:** Sem isso, o usuário precisa lançar cada despesa manualmente. Taxa de abandono em 7 dias passa de 60% em apps que pedem entrada manual.

**Escopo MVP:**
- Upload de arquivo OFX (todos os bancos brasileiros suportam)
- Parsing de campos: data, descrição, valor, conta
- Deduplicação contra transações já lançadas
- Tela de revisão pré-importação (usuário aprova/categoriza antes de salvar)
- Sugestão automática de categoria baseada em descrição (regra primeiro, ML depois)

---

### 🟡 #28 — PWA instalável + offline básico

**Severidade:** 🟡 ALTA • **Esforço:** 3-4 dias • **Status:** ⏳ NÃO INICIADO

**Escopo:**
- `manifest.json` com ícones e theme color
- Service Worker via Workbox cacheando shell da aplicação
- Funciona offline para visualização do que já carregou
- Botão "Adicionar à tela inicial" promovido após 2ª sessão

---

### 🟡 #29 — Onboarding guiado pós-cadastro

**Severidade:** 🟡 ALTA • **Esforço:** 1 semana • **Status:** ⏳ NÃO INICIADO

**Escopo:** Primeiro acesso após registro guia o usuário por: (1) cadastrar primeira conta, (2) cadastrar primeiro cartão, (3) importar OFX ou lançar 3 transações de exemplo, (4) opcionalmente criar família. Skip a qualquer momento.

---

### 🟠 #30 — Notificações (push + e-mail)

**Severidade:** 🟠 MÉDIA • **Esforço:** 1-2 semanas • **Status:** ⏳ NÃO INICIADO

**Escopo:** Vencimento de fatura, estouro de orçamento, despesa compartilhada lançada por outro membro, acerto de contas pendente, novo convite de família. Web Push API + e-mail transacional.

---

### 🟠 #31 — Dark mode

**Severidade:** 🟠 MÉDIA • **Esforço:** 2 dias • **Status:** ⏳ NÃO INICIADO

**Escopo:** Theme MUI com paleta dark. Toggle no header com persistência. Respeitar `prefers-color-scheme` no primeiro acesso.

---

## Histórico

Backlog anterior (Q2 2026, Issues #1-#10) — todos concluídos.

Ver: `docs/history/ISSUES_2026Q2.md`

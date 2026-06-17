---
owner: Gustavo
last_reviewed: 2026-06-16
status: ATIVO
---

# Auditoria do código herdado (Caio-Amarall + Joao Coelho)

Varredura completa (READ-ONLY) de tudo que os ex-colaboradores mergearam, feita em 2026-06-16 após a saída deles do projeto. **41 commits** auditados em 6 frentes paralelas: auth/segredos, injeção, backend/multi-tenancy, infra, telas Q5, qualidade de testes.

**TL;DR:** a maior parte do trabalho é de qualidade **boa a alta** — infra sólida, telas Q5 bem-feitas, testes reais (502 verdes), família com multi-tenancy bem trancado, CSV injection corrigido. Mas há **3 defeitos 🔴 que bloqueiam produção**, todos no backend financeiro/auth. Nenhum é vazamento cross-tenant explorável; o pior é um account-takeover via reset de senha.

> Atribuição: alguns 🔴 são **pré-existentes** (não introduzidos pelos commits do Caio, mas presentes no código que ele tocou). Marcado onde aplicável. O débito de NBSP no `ReportsPage.test` é do **Gustavo** (commit `bae7d18`), não do Caio.

---

## 🔴 Críticos — corrigir antes de qualquer release

### C1. Reset token vazado na resposta HTTP → account takeover ✅ CORRIGIDO (2026-06-16)
`AuthService.cs:240-245` + `AuthController.cs:189-191`. O endpoint `forgot-password` retornava `ResetToken` direto no JSON da resposta. O envio por e-mail era um `// TODO`. Qualquer um que soubesse um e-mail cadastrado recebia o token e trocava a senha da vítima — **takeover sem autenticação**.
**Fix aplicado:** `ForgotPasswordResponseDto` agora só tem `Mensagem` (genérica e idêntica pra qualquer e-mail — sem enumeração). A geração do token + envio do e-mail passou a ser **fire-and-forget** via Hangfire (`IPasswordResetDispatcher` → `HangfirePasswordResetDispatcher` → `PasswordResetEmailJob` → `IPasswordResetEmailSender`), então o caminho da requisição é constante (sem timing oracle) e o token só chega pelo e-mail (`LoggingPasswordResetEmailSender` loga em Dev, omite em prod). 6 testes de regressão em `AuthServiceTests.cs`.

### C2. Contrato de exceção furado → erros viram HTTP 500 + vazam mensagem ✅ CORRIGIDO (2026-06-16)
67 `throw new Exception("...")` espalhados pelos services (ex.: "Conta não encontrada", "valor deve ser positivo"). O `GlobalExceptionHandlerMiddleware` (#8) só mapeia `ArgumentException/KeyNotFoundException/InvalidOperationException/UnauthorizedAccessException`; `Exception` caía no default → **500 INTERNAL_ERROR** para o que deveria ser 400/404/409. Pior: o middleware (`:65`) ecoava `exception.Message` **inclusive no 500** → vazava detalhe interno (EF/Npgsql) e o front tratava erro de validação como "erro do servidor".
**Fix aplicado:** os 67 throws viraram o tipo correto pela semântica — not-found→`KeyNotFoundException` (404), validação→`ArgumentException` (400), conflito de estado→`InvalidOperationException` (409), ownership→`UnauthorizedAccessException` (401, consistente com os ~32 sites já existentes). O ramo 500 do middleware passou a retornar mensagem genérica (`"Erro interno do servidor. Tente novamente mais tarde."`); o detalhe fica só no log do servidor. Testes: `GlobalExceptionHandlerMiddlewareTests` (mapeamento + regressão do leak no 500) + 26 asserts de teste de service atualizados. **Follow-up não-bloqueante:** distinguir 403 (ownership) de 401 (auth) — hoje 401 desloga o usuário no front; refator próprio (chip `task_65e37c60`).

### C3. Soft-delete de `Transacao` violado ✅ CORRIGIDO (2026-06-16)
`TransacaoService.cs:281` (`DeletarAsync`) fazia `_context.Transacoes.Remove()` — hard delete proibido pelo CLAUDE.md em entidade financeira (apaga histórico, `FinancialEventLog` perde referência). E `ListarAsync` (`:132-139`) **não filtrava `Ativo`** — a listagem paginada mostrava transações canceladas (ex.: pernas de transferência excluída, que o `TransferenciaService` já soft-deletava) misturadas com ativas (não havia global query filter no DbContext).
**Fix aplicado:** `DeletarAsync` virou soft delete (`Ativo=false` + `StatusTransacao.Cancelado` + `CanceladoEm` + `MotivoCancelamento`, mesmo padrão do `TransferenciaService`). Em vez de filtrar `Ativo` em ~40 sites à mão, foi adicionado um **global query filter** `modelBuilder.Entity<Transacao>().HasQueryFilter(t => t.Ativo)` no `AppDbContext` → toda query e navegação (saldo calculado, listagem, dashboard, relatório, totais de fatura, limite) exclui canceladas automaticamente; para auditoria usa-se `.IgnoreQueryFilters()`. Saldo é calculado, então se corrige sozinho. Testes de regressão em `TransacaoServiceTests` (soft delete preserva a linha; listagem não retorna cancelada; DbSet filtrado × IgnoreQueryFilters).

---

## 🟠 Altos

| # | Local | Problema | Fix |
|---|---|---|---|
| A1 | `PasswordHasher.cs:10` | ✅ **CORRIGIDO (2026-06-17).** Era PBKDF2 **10.000 iterações** (~60× abaixo do OWASP). Migrado p/ **Argon2id** (Konscious, m=19456/t=2/p=1) + formato versionado + **rehash transparente no login**. |
| A2 | `PasswordHasher.cs:9` | ✅ **CORRIGIDO (2026-06-17).** Era hash truncado em **20 bytes**. Agora **32 bytes** (saída nativa). |
| A3 | `docker-compose.yml` | ✅ **CORRIGIDO (2026-06-17).** Compose deixou de hardcodar senha Postgres + `JWT_SECRET` default; agora `${POSTGRES_PASSWORD:?}`/`${JWT_SECRET:?}` (falha-rápido, sem default). `.env.example` + `.env` gitignored; CI com valores efêmeros. Falta a metade manual: definir os valores reais (rotação). |
| A4 | `OrcamentoService.cs:124` vs `RelatorioService.cs:41-42` | Critério de "gasto do usuário" **divergente**: Orçamento usa `CriadoPor`, Relatório usa ownership de conta/cartão. Mesmo mês mostra números diferentes nas duas telas. Não vaza cross-tenant. | Padronizar o critério e usar nos dois. |

---

## 🟡 Médios

**Auth/segredos**
- ✅ **Reset token E refresh token** agora hasheados no banco (SHA-256 via `OpaqueTokenHasher`, 2026-06-17). O bruto só vai pro usuário (e-mail/cookie); lookup por hash. Vazamento de DB não expõe tokens reutilizáveis.
- ✅ Enumeração de usuário por **timing** no `forgot-password` — resolvido no C1 (fire-and-forget) + rate-limit por conta no job (2026-06-17).
- JWT sem validação de comprimento de chave + `Encoding.ASCII` descarta bytes (`Program.cs:208`, `JwtTokenProvider.cs:26`). Exigir `Length>=32` + UTF8.
- `reset-password` sem `[EnableRateLimiting]` (`AuthController.cs:196`) — brute-force do token (mitigado por 64 bytes de entropia).

**Backend**
- `TransacaoService.cs:46-59`: categoria validada **sem filtro de dono** — possível anexar transação a categoria custom alheia (leve). Add `(c.UsuarioId == null || c.UsuarioId == usuarioId)`.
- `TransacaoService.cs:294-296`: `ObterResumoPorContaAsync` não filtra `Ativo` — resumo diverge do saldo real.
- `OrcamentosController`: endpoints transacionais sem `Idempotency-Key` (mitigado por unique-guard categoria+mês+ano).

**Infra (higiene dev)**
- Porta Postgres `5432:5432` em todas interfaces → bind em `127.0.0.1`. Imagens base sem digest pin. CI backend sem serviço Postgres (ok se testes são todos in-memory).

**Telas Q5 (cosmético/baixo impacto)**
- `FamiliasPage.tsx:547`: confirm de remover **outro** membro mostra cópia "Sair desta família?" (passa `ehProprio=true` fixo).
- Form "Registrar acerto" (família) valida via **toast** em vez de erro inline por campo.
- `RateioService.cs:32` `DefinirRendaAsync` exige só membro (não admin) → qualquer membro seta renda de outro (usada no rateio).
- `<button>` nativo nos toggles olho-de-senha (Login/Register) → `PontesIconButton`.
- Cor inline `style={{color: var(--pontes-danger)}}` em Accounts/Bancos → classe CSS Module.

**Testes (profundidade, não honestidade)**
- Multi-tenancy testado em só **5 de 23** services — falta nos financeiros core (Transacao, Conta, CartaoCredito, Emprestimo seedam usuarioId mas não testam vazamento).
- Cálculo de fatura/juros de cartão e geração de parcelas via transação **sub-cobertos**.
- Busca textual (`q`) e interceptors do axios sem rede automatizada.
- Sem **coverage gate** no CI (impossível auditar objetivamente o que falta).

---

## ✅ Confirmado correto (riscos óbvios verificados)

- **Auth core bem desenhado:** rotação real de refresh token (revoga antigo), reset uso único + expira 1h + revoga refresh tokens, comparação de senha constant-time (`FixedTimeEquals`), política de senha validada no backend (10+ chars + blacklist), JWT HS256 60min com issuer/audience, cookies HttpOnly+SameSite=Strict, `[Authorize]` nos endpoints sensíveis. **Nenhum segredo real commitado** no appsettings.
- **CSV formula injection (#121, Joao):** corrigido e bom — neutraliza `= + - @`, todas as colunas de texto, único caminho de export real, 8 testes xUnit. Gap teórico só em Tab inicial (sem exploit).
- **Branch `security/appsec-findings-20260522`:** sem pendências — só uma cópia redundante do fix de CSV, e está atrás da main.
- **Sem SQL injection** (queries 100% parametrizadas/LINQ, zero SQL raw com input) e **sem XSS** (zero `dangerouslySetInnerHTML`).
- **Paginação (#4):** clampa `pageSize` em [1,100] e `page>=1` nos 5 services — protege contra `pageSize=10000`/offset negativo. `PagedResult.Total` correto.
- **API versioning (#7):** `v1` global consistente, retrocompat.
- **Migrations refactor (#9):** remoção de SQL raw do startup **não quebra** schema (movido p/ migration idempotente `CREATE TABLE IF NOT EXISTS`).
- **Multi-tenancy Família:** **bem trancado** — `ExigirMembroAsync` em cada operação, convite valida e-mail do convidado vs token, sem caminho p/ ler/editar família alheia.
- **Telas Q5:** conformidade Pontes quase total (CSS Modules + vars, DS exclusivo, PontesDialog), validação por campo com bloqueio de submit, sem `/api/v1/api` duplicado.
- **Infra:** CI **falha de verdade** (sem `continue-on-error`), multi-stage Docker, healthchecks, provider por env sem default inseguro, Hangfire dashboard protegido.
- **Testes:** **502 verdes** (286 front + 216 back), zero skip, EF InMemory real (não repo mockado), asserts significativos incluindo matemática financeira agregada. Não é teatro.

---

## Branches remotas não-mergeadas (PRs pendentes do Caio)

| Branch | Conteúdo | Recomendação |
|---|---|---|
| `origin/feature/114-drop-sqlite` | Remove SQLite, Postgres único provider | **MERGEAR-COM-AJUSTE** — direção boa, mas mata o fallback "dev sem Docker"; validar que migrations cobrem o schema + atualizar CLAUDE.md. Conflita com 92 em `Program.cs`. Mergear **antes** do 92. |
| `origin/feature/92-e2e-playwright` | Testes E2E Playwright **reais** (asserts significativos, storageState) | **MERGEAR-COM-AJUSTE** — valor alto, risco baixo. ⚠️ carrega **clandestinamente** uma mudança de rate-limit de login no `Program.cs` (`isDev ? 100 : 5`) escondida num PR "de teste" — revisar conscientemente. Credenciais de teste batem com o DevDataSeeder (não vazam). |

---

## Ordem de correção recomendada

1. **C1 reset token** (account takeover — bloqueante absoluto).
2. **C2 contrato de exceção** (67 ocorrências; varredura + middleware).
3. **C3 soft-delete Transacao** (delete + listagem).
4. **A1/A2 PasswordHasher** (iterações + hash size; rehash no próximo login).
5. **A3 segredos do compose/CI** (antes de reusar compose fora de dev).
6. **A4 critério de gasto** Orçamento×Relatório.
7. Médios em branch de fixes; depois mergear 114→92 com os ajustes.

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

### C2. Contrato de exceção furado → erros viram HTTP 500 + vazam mensagem
67 `throw new Exception("...")` espalhados pelos services (ex.: "Conta não encontrada", "valor deve ser positivo"). O `GlobalExceptionHandlerMiddleware` (#8) só mapeia `ArgumentException/KeyNotFoundException/InvalidOperationException/UnauthorizedAccessException`; `Exception` cai no default → **500 INTERNAL_ERROR** para o que deveria ser 400/404/409. Pior: o middleware (`:65`) ecoa `exception.Message` **inclusive no 500** → vaza detalhe interno (EF/Npgsql) e o front trata erro de validação como "erro do servidor".
**Fix:** trocar os `throw new Exception(...)` pelos tipos corretos nos services; no ramo 500 do middleware retornar mensagem genérica e logar o detalhe só no servidor.

### C3. Soft-delete de `Transacao` violado
`TransacaoService.cs:281` (`DeletarAsync`) faz `_context.Transacoes.Remove()` — hard delete proibido pelo CLAUDE.md em entidade financeira (apaga histórico, `FinancialEventLog` perde referência). E `ListarAsync` (`:132-139`) **não filtra `Ativo`** — a listagem paginada mostra transações canceladas misturadas com ativas (não há global query filter no DbContext). _Provável pré-existente._
**Fix:** soft delete (`Ativo=false` + status Cancelado), como `TransferenciaService` já faz; adicionar `.Where(t => t.Ativo)` na listagem.

---

## 🟠 Altos

| # | Local | Problema | Fix |
|---|---|---|---|
| A1 | `PasswordHasher.cs:10` | PBKDF2 com **10.000 iterações** (mín. pedido ≥100k; OWASP 210k). Acelera brute-force de hashes vazados. | Subir p/ ≥100k; versionar hash p/ rehash gradual. |
| A2 | `PasswordHasher.cs:9` | Hash truncado em **20 bytes** (SHA-256 = 32). Resquício de exemplo SHA-1. | `HashSize = 32`. |
| A3 | `docker-compose.yml:8,25-26` | Senha Postgres (`postgres`) e `JWT_SECRET` default hardcoded no compose **versionado**. | Mover p/ `.env` não-versionado; `${JWT_SECRET:?obrigatório}` p/ falhar fast. |
| A4 | `OrcamentoService.cs:124` vs `RelatorioService.cs:41-42` | Critério de "gasto do usuário" **divergente**: Orçamento usa `CriadoPor`, Relatório usa ownership de conta/cartão. Mesmo mês mostra números diferentes nas duas telas. Não vaza cross-tenant. | Padronizar o critério e usar nos dois. |

---

## 🟡 Médios

**Auth/segredos**
- Refresh + reset tokens armazenados em **plaintext** no banco (`AuthService.cs:39-40`) → vazamento de DB expõe tokens reutilizáveis. Persistir `SHA-256(token)`.
- Enumeração de usuário por **timing** no `forgot-password` (ramo "existe" faz INSERT, ramo "não existe" retorna na hora). `AuthService.cs:200-217`.
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

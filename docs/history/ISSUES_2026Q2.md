# Issues & Problemas Técnicos

**Descobertos em:** 2026-05-07  
**Contexto:** Auditoria para preparar projeto para virar produto  
**Status Geral:** 🔴 10 problemas críticos/altos + 7 médios

---

## ✅ RESOLVIDOS

### ✅ #1: Parcelamento Inflexível

**Severidade:** 🔴 CRÍTICA  
**Status:** ✅ RESOLVIDO (2026-05-10)  
**Tempo:** ~11 horas (11 sessões)  
**Commits:** 11 principais

**Problema Original:**
- Atual: 12 parcelas sempre consecutivas (mai→jun→jul...)
- Precisava: Parcela 1 em JUL, 2 em SET, 3 em NOV (flexível)
- Causa: Tabela `Transacao` misturava "compra" com "parcela"

**Solução Implementada:**
- ✅ Criada tabela `Parcelamentos` (novo)
- ✅ Criada tabela `ParcelasTransacao` (novo)
- ✅ Criada tabela `FinancialEventLog` (novo)
- ✅ Atualizada `Fatura` com 3 flags ortogonais (EstadoCiclo, EstadoPagamento, EstaAtrasada)
- ✅ Atualizado `CartaoCredito` com `LimiteTotal`
- ✅ Atualizado `Transacao` com ParcelamentoId, StatusTransacao, soft delete (Ativo)
- ✅ Atualizado `Recorrente` com janela 3 meses + CartaoCreditoId

**Entidades Novas:**
- `Parcelamentos` — 1+ parcelas flexíveis de uma compra
- `ParcelasTransacao` — cada parcela individual com data própria
- `FinancialEventLog` — auditoria + idempotência

**Services Novos:**
- `ParcelamentoService` — Criar/Cancelar/Listar/Detalhe
- `ParcelaTransacaoService` — PagarAntecipado/Cancelar individual
- `LimiteCalculatorService` — Cálculo dinâmico de limite
- `FinancialEventLogService` — Auditoria + idempotência

**Controllers Novos:**
- `ParcelamentosController` — CRUD + cancelar
- `ParcelasController` — Pagar + Cancelar parcela

**Jobs Novos (Hangfire):**
- FaturaFechamentoJob — Aberta → Fechada
- FaturaAtrasoJob — Marca atrasada + juros
- ExpandirRecorrentesJob — Janela móvel 3 meses
- ExecutarRecorrentesJob — Previsao → Executado
- RecalcularLimitesJob — Limites dinâmicos

**Frontend:**
- Pages: `/parcelamentos` (listagem) + `/parcelamentos/:id` (detalhe)
- Componentes: cards, modais pagar/cancelar, status badges
- Types: Parcelamento, ParcelaTransacao, Fatura (atualizado)
- Service: ParcelamentoService com idempotência

**Testes (13 total):**
- 5 LimiteCalculatorService (cálculo, validações)
- 5 ParcelamentoService (criar, validar, cancelar, listar)
- 3 E2E (create, idempotência, cancel)

**Documentação Atualizada:**
- [x] docs/DATABASE.md — 3 entidades + updates
- [x] docs/FLOWS.md — 3 fluxos (criar, pagar antecipado, cancelar)
- [x] docs/STANDARDS.md — padrões ACID, soft delete, idempotência, Hangfire

**QA Final:**
- ✅ Build backend: 0 erros, 0 warnings
- ✅ Build frontend: 0 erros
- ✅ Testes: 13/13 passing
- ✅ Swagger: endpoints novos listados
- ✅ Hangfire: `/hangfire` dashboard acessível

**Impacto:**
- Parcelamento 100% flexível (pula meses conforme necessário)
- Juros simples suportados (PIX com taxa customizável)
- Soft delete + auditoria completa
- Idempotência via header HTTP
- Limite bloqueado/liberado automaticamente
- 5 jobs background para automação

---

## ✅ #3: Validações de Negócio Ausentes

**Severidade:** 🔴 CRÍTICA
**Status:** ✅ RESOLVIDO (2026-05-11)
**Tempo:** ~30 min
**Commit:** `65baf78`

**O que mudou:**
- `TransacaoService`: bloqueia data futura (Criar + Atualizar); valida `Valor > 0` em Atualizar
- `CartaoCreditoService`: Nome obrigatório; `Limite > 0` quando `TemCredito=true`; `DiaFechamento`/`DiaVencimento` entre 1–28
- `ContaService`: `saldoInicial < 0` agora lança erro explícito
- `EmprestimoService`: `ValorTotal > 0`; `DataVencimento >= DataInicio`; `Valor > 0` em RegistrarPagamento

---

## ✅ #2: Sem Testes Unitários/Integração

**Severidade:** 🔴 CRÍTICA
**Status:** ✅ RESOLVIDO (2026-05-11)
**Tempo:** ~1h
**Commits:** feat(testes): adicionar testes unitários — Issue #2

**O que foi feito:**
- Setup xUnit já existia (projeto `ControleFinanceiro.Api.Tests`)
- Criados 4 arquivos de testes novos cobrindo serviços com novas validações:
  - `TransacaoServiceTests.cs` — 9 testes (valor zero/negativo, data futura, conta não encontrada, sem conta/cartão, categoria incompatível, dados válidos, atualizar valor/data)
  - `CartaoCreditoServiceTests.cs` — 10 testes (nome vazio, limite zero/negativo, dia fechamento/vencimento inválido, sem crédito ignora validações, dados válidos, atualizar limite)
  - `ContaServiceTests.cs` — 7 testes (nome vazio/longo, saldo negativo, saldo positivo cria receita, saldo zero, dados válidos, carteira não deletável)
  - `EmprestimoServiceTests.cs` — 9 testes (valor zero/negativo, vencimento anterior, dados válidos, sem vencimento, pagamento zero/negativo/parcial/total)
- **Total:** 48 testes passando (35 novos + 13 existentes do Issue #1)

**Padrão adotado:**
- InMemory DB com `Guid.NewGuid().ToString()` como nome único por teste
- `ConfigureWarnings(TransactionIgnoredWarning)` para InMemory
- Helper `Build()` retorna `(ctx, svc)` com dependências injetadas
- Helper `SeedConta()` para testes que precisam de conta existente

**QA:**
- ✅ `dotnet test`: 48/48 passando, 0 falhas

## 🔴 BLOQUEADORES CRÍTICOS (Atacar Depois)

---

---

### #3: Validações de Negócio Ausentes

**Severidade:** 🔴 CRÍTICA  
**Impacto:** Dados inválidos no banco  
**Esforço:** 4 horas  
**Status:** ⏳ NÃO INICIADO

**Problema:**
- Transação pode ser futura (❌ não deveria)
- Parcela pode ter valor negativo (❌ não deveria)
- CartãoCredito pode ter limite negativo (❌)
- Saldo de Conta pode ser manipulado direto (❌)

**Solução:**
- Adicionar validações em Services
- Adicionar FluentValidation ou data annotations
- Testes de validação

**Checklist After Resolve:**
- [ ] Documentar validações em docs/STANDARDS.md
- [ ] Atualizar memory/decisions_and_constraints.md
- [ ] Adicionar exemplos de erro em docs/

---

## ✅ #4: Sem Paginação em Endpoints

**Severidade:** 🟡 ALTA
**Status:** ✅ RESOLVIDO (2026-05-13)
**Tempo:** ~1h
**Commit:** `06f9371`

**O que foi feito:**
- Criado `DTOs/Common/PagedResult<T>` — envelope genérico `{ items, total, page, pageSize, totalPages }`
- Paginação adicionada em 5 endpoints de listagem (os que crescem sem limite):
  - `GET /api/transacoes` — `?page=1&pageSize=20`
  - `GET /api/emprestimos`
  - `GET /api/parcelamentos` — mantém filtro `?ativo=`
  - `GET /api/recorrentes`
  - `GET /api/transferencias`
- Categorias, Cartões e Contas **não paginados** (conjuntos naturalmente pequenos)
- Validação: `page >= 1`, `pageSize` clampado 1–100, default 20
- Services: `CountAsync()` + `Skip().Take()` na mesma query (eficiente)
- 48/48 testes passando

## 🟡 PROBLEMAS ALTOS (Atacar Depois)

---

## ✅ #5: Autenticação Não-Robusta

**Severidade:** 🟡 ALTA
**Status:** ✅ RESOLVIDO (2026-05-13)
**Tempo:** ~1h
**Commit:** `863efad`

**O que foi feito:**
- `RefreshToken` e `PasswordResetToken` — 2 entidades novas com cascade delete
- Migration `AddRefreshAndResetTokens` aplicada
- `AuthService`:
  - `LoginAsync` / `RegisterAsync` agora retornam `refreshToken` + `refreshTokenExpiresAt` (7 dias)
  - `RefreshAsync` — rotação de token: revoga o antigo, emite novo par JWT+refresh
  - `LogoutAsync` — revoga refresh token (silencioso se não encontrado)
  - `SolicitarResetSenhaAsync` — gera token de reset (1h), invalida tokens anteriores (em prod: enviar por e-mail)
  - `ResetSenhaAsync` — valida token, atualiza senha, revoga todos os refresh tokens do usuário
- 4 endpoints novos: `POST /auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`
- 2FA fora do escopo (requer infra SMS/TOTP)
- 48/48 testes passando

---

## ✅ #6: Documentação Sem Dono/Revisão

**Severidade:** 🟡 ALTA
**Status:** ✅ RESOLVIDO (2026-05-13)
**Tempo:** ~20 min
**Commit:** `d812c0c`

**O que foi feito:**
- Frontmatter adicionado em 4 docs: `DATABASE.md`, `FLOWS.md`, `STANDARDS.md`, `README.md`
- Campos: `owner: Gustavo`, `last_reviewed`, `next_review` (trimestral), `status: CURRENT`
- Checklist trimestral de revisão adicionado no `README.md`
- Known issues no README atualizados (itens já resolvidos removidos)

---

## ✅ #7: Sem Versionamento de API

**Severidade:** 🟡 ALTA
**Status:** ✅ RESOLVIDO (2026-05-13)
**Tempo:** ~1h
**Commit:** `8804037`

**O que foi feito:**
- Instalado `Asp.Versioning.Mvc` 8.1.0 + `Asp.Versioning.Mvc.ApiExplorer` 8.1.0
- `DefaultApiVersionConvention` (IControllerConvention) reescreve rotas globalmente de `api/*` → `api/v{version:apiVersion}/*` sem tocar nos 14 controllers
- `Program.cs`: `AddApiVersioning` com `UrlSegmentApiVersionReader`, `AssumeDefaultVersionWhenUnspecified=true`, Swagger doc v1
- Frontend: `axiosConfig.ts` e `axiosClient.ts` atualizados para `http://localhost:5293/api/v1`
- 48/48 testes passando, 0 erros, 0 warnings

---

## 🟠 PROBLEMAS MÉDIOS (Atacar Depois)

## ✅ #8: Tratamento de Erro Inconsistente

**Severidade:** 🟠 MÉDIA
**Status:** ✅ RESOLVIDO (2026-05-13)
**Tempo:** ~1h
**Commit:** `16ff4b5`

**O que foi feito:**
- `ErrorResponseDto` — envelope único `{ message, code }` em camelCase
- `GlobalExceptionHandlerMiddleware` — captura todas as exceções não tratadas e mapeia para status codes padronizados:
  - `ArgumentException` → 400 `VALIDATION_ERROR`
  - `KeyNotFoundException` → 404 `NOT_FOUND`
  - `InvalidOperationException` → 409 `BUSINESS_RULE_VIOLATION`
  - `UnauthorizedAccessException` → 401 `UNAUTHORIZED`
  - `*` → 500 `INTERNAL_ERROR`
- Removidos todos os `try/catch` de erro dos 12 controllers (476 linhas de boilerplate eliminadas)
- `AuthService`: exceções ajustadas para tipos semânticos corretos
- `ContasController`: `ValidarCartao` convertido para `throw ArgumentException`

---

## ✅ #9: SQL Raw em Program.cs (Não Migração)

**Severidade:** 🟠 MÉDIA
**Status:** ✅ RESOLVIDO (2026-05-13)
**Tempo:** ~30 min
**Commit:** `7cb2870`

**O que foi feito:**
- Diagnóstico: `AplicarSistemaFaturasAsync` era redundante — `AddParcelamentoSchema` (20260509025858) já cria Faturas via `CREATE TABLE IF NOT EXISTS` e `MigrateAsync()` roda antes do raw SQL
- Removidos ~115 linhas de DDL raw do `Program.cs`
- Startup agora: `MigrateAsync()` → seed bancos → seed categorias
- `20260505120000_AddFaturaSystem.cs` mantida com comentário explicativo (migration legada sem Designer.cs, não reconhecida pelo EF Core)

---

## ✅ #10: Features Básicas (parcial)

**Severidade:** 🟠 MÉDIA
**Status:** ✅ PARCIALMENTE RESOLVIDO (2026-05-13)
**Tempo:** ~2h
**Commit:** `298f882`

**Implementado:**
- ✅ Relatórios customizáveis: `GET /api/v1/relatorios/periodo?dataInicio=&dataFim=[&categoriaId][&tipo][&contaId]` — evolução diária, gastos por categoria e meio de pagamento, limite 2 anos
- ✅ Export CSV: `GET /api/v1/relatorios/export/csv` (mesmos filtros) — download direto Content-Disposition
- ✅ Orçamento/Metas: CRUD completo (`/api/v1/orcamentos`) — limite por categoria/mês, alertas de consumo, `emAlerta`, `ultrapassado`, cálculo em tempo real

**Pendente (out of scope para agora):**
- ⏳ Export PDF (requer biblioteca, ex: QuestPDF)
- ⏳ Avisos de limite em tempo real (WebSocket/SignalR)
- ⏳ Sincronização com banco (Open Finance/BCB)

---

## 📋 Formato de Resolução

Cada problema, quando resolvido, segue este checklist:

```markdown
## ✅ #X: [Nome Problema]

**Resolvido em:** YYYY-MM-DD
**Tempo gasto:** X horas
**Commits:** #abc123, #def456

**O que mudou:**
- Descrição da mudança

**Documentação atualizada:**
- [x] docs/DATABASE.md
- [x] docs/FLOWS.md
- [x] memory/decisions_and_constraints.md
- [x] docs/STANDARDS.md
- [x] QUICK_REFERENCE.md
- [x] CLAUDE.md

**Testes adicionados:**
- [x] TransacaoServiceTests.cs
- [x] ParcelaTransacaoTests.tsx

**Próximo problema:** #4
```

---

## 📊 Prioridade de Ataque

```
Semana 1: #1 (Parcelamento) + #2 (Testes) + #3 (Validações)
Semana 2: #6 (Docs Owner) + #4 (Paginação)
Semana 3: #5 (Auth) + #9 (Migrations)
Semana 4: #7 (API Versioning) + #8 (Erro Handling)
Depois: #10 (Features)
```

---

## 🎯 Próximo Passo

**Qual atacar primeiro?**
- [ ] #1 Parcelamento inflexível
- [ ] #2 Testes
- [ ] #3 Validações
- [ ] Outro?

Decide e a gente começa! 🚀

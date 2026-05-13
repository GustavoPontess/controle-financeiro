# Progress Tracker

**Objetivo:** Virar produto  
**Status Geral:** 🟢 10/10 problemas resolvidos (parcialmente em #10)  
**Data Início:** 2026-05-07  
**Última Atualização:** 2026-05-13 (Issue #10 — Features Básicas)

---

## 📈 Dashboard de Progresso

```
Bloqueadores Críticos:    3/3 ✅ (resolvidos: #1, #2, #3)
Problemas Altos:          4/4 ✅ (resolvidos: #4, #5, #6, #7)
Problemas Médios:         3/3 ✅ (resolvidos: #8, #9, #10 parcial)

Total:                    10/10 problemas resolvidos ✅
Features pendentes:       PDF export, WebSocket alertas, Open Finance
```

---

## ✅ Resolvidos

### ✅ #1: Parcelamento Inflexível

**Resolvido em:** 2026-05-10  
**Tempo gasto:** ~11 horas (11 sessões)  
**Commits:** 11 commits principais (ver IMPLEMENTATION_STATE.md Histórico de sessões)

**O que mudou:**
- **Backend Completo:** 3 entidades novas (Parcelamento, ParcelaTransacao, FinancialEventLog)
- **Services:** ParcelamentoService, ParcelaTransacaoService, LimiteCalculatorService, FinancialEventLogService
- **Controllers:** ParcelamentosController, ParcelasController
- **Jobs:** 5 Hangfire background jobs (FaturaFechamento, FaturaAtraso, ExpandirRecorrentes, ExecutarRecorrentes, RecalcularLimites)
- **Tests:** 13 xUnit tests (5 LimiteCalculator, 5 Parcelamento, 3 E2E)
- **Frontend:** React components para Parcelamentos (listagem + detalhe + modais)
- **Migrations:** 3 migrations (AddParcelamentoSchema, MigrateLegacyData, RemoveLegacyColumns)

**Documentação atualizada:**
- [x] docs/DATABASE.md (3 entidades + 4 atualizações)
- [x] docs/FLOWS.md (3 fluxos novos)
- [x] docs/STANDARDS.md (padrões ParcelamentoService, soft delete, idempotência, Hangfire)
- [x] CLAUDE.md (já continha padrões gerais)

**Testes adicionados:**
- [x] LimiteCalculatorServiceTests (5)
- [x] ParcelamentoServiceTests (5)
- [x] ParcelamentoE2ETests (3)

**QA:**
- [x] Build backend: 0 erros, 0 warnings
- [x] Build frontend: 0 erros
- [x] Testes: 13/13 passando
- [x] Swagger: endpoints listados
- [x] `/hangfire` dashboard: acessível
- [x] npm run dev: sem erros

**Próximo problema:** #4 (Paginação em Endpoints)

---

### ✅ #3: Validações de Negócio Ausentes

**Resolvido em:** 2026-05-11
**Tempo gasto:** ~30 min
**Commit:** `65baf78`

**O que mudou:**
- `TransacaoService`: data futura bloqueada; `Valor > 0` em Atualizar
- `CartaoCreditoService`: Nome obrigatório; Limite > 0; DiaFechamento/DiaVencimento 1–28
- `ContaService`: saldoInicial negativo → erro explícito
- `EmprestimoService`: ValorTotal > 0; DataVencimento >= DataInicio; Valor > 0 em pagamento

**Próximo problema:** #7 (API Versioning)

---

### ✅ #6: Documentação Sem Dono/Revisão

**Resolvido em:** 2026-05-13
**Tempo gasto:** ~20 min
**Commit:** `d812c0c`

**O que mudou:**
- Frontmatter `owner/last_reviewed/next_review/status` nos 4 docs
- Checklist de revisão trimestral no README

---

### ✅ #5: Autenticação Não-Robusta

**Resolvido em:** 2026-05-13
**Tempo gasto:** ~1h
**Commit:** `863efad`

**O que mudou:**
- Refresh token (7 dias) com rotação — Login/Register retornam o par completo
- Logout revoga refresh token
- Forgot/Reset password com token de 1h
- Reset revoga todos os refresh tokens do usuário
- 4 endpoints novos em `/auth`

---

### ✅ #4: Sem Paginação em Endpoints

**Resolvido em:** 2026-05-13
**Tempo gasto:** ~1h
**Commit:** `06f9371`

**O que mudou:**
- `PagedResult<T>` genérico em `DTOs/Common/`
- 5 endpoints paginados: Transações, Empréstimos, Parcelamentos, Recorrentes, Transferências
- Query: `CountAsync()` + `Skip().Take()`, page/pageSize com clamp 1–100
- 48/48 testes passando

---

### ✅ #10: Features Básicas (parcial)

**Resolvido em:** 2026-05-13
**Tempo gasto:** ~2h
**Commit:** `298f882`

**O que mudou:**
- Relatórios customizáveis: `/api/v1/relatorios/periodo` com filtros de período, categoria, tipo, conta
- Export CSV: `/api/v1/relatorios/export/csv` — download direto
- Orçamento/Metas: CRUD completo com alertas de consumo em tempo real

---

### ✅ #9: SQL Raw em Program.cs

**Resolvido em:** 2026-05-13
**Tempo gasto:** ~30 min
**Commit:** `7cb2870`

**O que mudou:**
- Removido `AplicarSistemaFaturasAsync()` do Program.cs (~115 linhas de DDL raw)
- `AddParcelamentoSchema` já fazia o mesmo via `CREATE TABLE IF NOT EXISTS`
- Startup limpo: `MigrateAsync()` → seed

---

### ✅ #8: Tratamento de Erro Inconsistente

**Resolvido em:** 2026-05-13
**Tempo gasto:** ~1h
**Commit:** `16ff4b5`

**O que mudou:**
- `ErrorResponseDto` — envelope único `{ message, code }` em camelCase para todas as respostas de erro
- `GlobalExceptionHandlerMiddleware` — mapeamento único: ArgumentException→400, KeyNotFoundException→404, InvalidOperationException→409, UnauthorizedAccessException→401, *→500
- Todos os 12 controllers limpos de try/catch de erro (476 linhas removidas)
- `AuthService` com tipos de exceção semânticos corretos

---

### ✅ #7: Sem Versionamento de API

**Resolvido em:** 2026-05-13
**Tempo gasto:** ~1h
**Commit:** `8804037`

**O que mudou:**
- `Asp.Versioning.Mvc` 8.1.0 + `Asp.Versioning.Mvc.ApiExplorer` instalados
- `DefaultApiVersionConvention` reescreve rotas globalmente → `api/v1/*` sem alterar os 14 controllers
- `Program.cs`: `AddApiVersioning` + `UrlSegmentApiVersionReader` + Swagger v1
- Frontend: `axiosConfig.ts` + `axiosClient.ts` atualizados para `/api/v1`
- `AssumeDefaultVersionWhenUnspecified=true` mantém retrocompatibilidade

---

### ✅ #2: Sem Testes Unitários/Integração

**Resolvido em:** 2026-05-11
**Tempo gasto:** ~1h

**O que mudou:**
- 4 arquivos de testes novos: TransacaoService (9), CartaoCreditoService (10), ContaService (7), EmprestimoService (9)
- **Total:** 48 testes passando (35 novos + 13 do Issue #1)
- Padrão: InMemory DB único por teste, helpers `Build()` e `Seed*()`

**QA:**
- [x] `dotnet test`: 48/48 passando, 0 falhas

---

## ⏳ Em Progresso

*(Nenhum — #1, #2, #3 resolvidos)*

---

## 📋 Não Iniciados

### 🔴 CRÍTICOS

*(Todos resolvidos)*

### 🟡 ALTOS

*(Todos resolvidos)*

### 🟠 MÉDIOS

- [ ] **#8** Erro Handling Consistente (2h)
- [ ] **#9** Migrations (SQL raw → EF) (2h)
- [ ] **#10** Features Básicas (20h)

---

## 🎯 Próximo a Atacar

**Sugestão:** #1 Parcelamento (bloqueador crítico)

Quer começar por qual?

---

## 📝 Histórico de Sessões

### Sessão 1 (2026-05-07)
- Auditoria arquitetural completa
- Descobertos 10 problemas
- Criado ISSUES.md para rastreamento
- **Próximo:** Escolher primeiro problema a resolver

---

## 📌 Checklist Pós-Resolução (Copiar)

Use este template cada vez que resolver um problema:

```markdown
## ✅ Resolvido #X: [Nome Problema]

**Data:** YYYY-MM-DD
**Tempo:** X horas
**Commits:** 
- commit hash - descrição

### Mudanças Técnicas
- [ ] Alteração 1
- [ ] Alteração 2

### Documentação Atualizada
- [ ] docs/DATABASE.md (se schema mudou)
- [ ] docs/FLOWS.md (se fluxo mudou)
- [ ] docs/STANDARDS.md (se padrão mudou)
- [ ] memory/decisions_and_constraints.md
- [ ] memory/architecture_audit.md (remover de "Não Iniciados")
- [ ] QUICK_REFERENCE.md (se resumo mudou)
- [ ] CLAUDE.md (se arquitetura mudou)
- [ ] CONTROLLER_TEMPLATE.md (se padrão mudou)
- [ ] ISSUES.md (marcar como resolvido)
- [ ] PROGRESS.md (mover para ✅ Resolvidos)

### Testes Adicionados
- [ ] Test 1
- [ ] Test 2

### QA
- [ ] Build sem warnings
- [ ] Testes passam
- [ ] Swagger atualizado
- [ ] Nenhum console.error

### Próximo Problema
**#X** [Nome]
```

---

## 💡 Notas

- Manter este arquivo **sempre atualizado**
- Cada problema resolvido = atualizar PROGRESS.md + ISSUES.md
- Cada problema resolvido = revisar docs + memory
- Commit toda semana com o estado de progresso

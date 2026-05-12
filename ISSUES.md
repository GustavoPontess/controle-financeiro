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

## 🟡 PROBLEMAS ALTOS (Atacar Depois)

### #4: Sem Paginação em Endpoints

**Severidade:** 🟡 ALTA  
**Impacto:** API fica lenta com muitas transações  
**Esforço:** 2 horas  
**Status:** ⏳ NÃO INICIADO

**Problema:**
- GET /transacoes retorna TUDO (10k transações? Tudo!)
- Sem limite

**Solução:**
- Adicionar `skip` e `take` em controllers
- Frontend com paginação

**Checklist After Resolve:**
- [ ] Atualizar CONTROLLER_TEMPLATE.md
- [ ] Documentar paginação em docs/

---

### #5: Autenticação Não-Robusta

**Severidade:** 🟡 ALTA  
**Impacto:** Inseguro para produção  
**Esforço:** 5 horas  
**Status:** ⏳ NÃO INICIADO

**Problema:**
- Sem "forgot password"
- Sem "2FA"
- Sem "session management"
- Sem "refresh token"

**Solução:**
- Implementar forgot password
- Refresh token para expiração
- 2FA opcional

**Checklist After Resolve:**
- [ ] Atualizar docs/FLOWS.md (novo fluxo auth)
- [ ] Documentar segurança em docs/
- [ ] Atualizar memory/decisions_and_constraints.md

---

### #6: Documentação Sem Dono/Revisão

**Severidade:** 🟡 ALTA  
**Impacto:** Docs ficam obsoletas  
**Esforço:** 1 hora  
**Status:** ⏳ NÃO INICIADO

**Problema:**
- Quem é responsável por cada doc?
- Quando revisar?
- Status (CURRENT / DEPRECATED)?

**Solução:**
- Adicionar frontmatter em cada doc:
  ```yaml
  owner: Gustavo
  last_reviewed: 2026-05-07
  next_review: 2026-08-07
  status: CURRENT
  ```

**Checklist After Resolve:**
- [ ] Adicionar metadata em todos docs em docs/
- [ ] Adicionar metadata em memory/
- [ ] Criar checklist de revisão mensal

---

### #7: Sem Versionamento de API

**Severidade:** 🟡 ALTA  
**Impacto:** Quebracliente se mudar schema  
**Esforço:** 3 horas  
**Status:** ⏳ NÃO INICIADO

**Problema:**
- POST /api/transacoes (v1 implícita)
- Sem suporte a múltiplas versões

**Solução:**
- POST /api/v1/transacoes
- Suporte a v1, v2 simultâneas por 1-2 anos

**Checklist After Resolve:**
- [ ] Atualizar Program.cs com versionamento
- [ ] Atualizar controllers
- [ ] Documentar estratégia em docs/

---

## 🟠 PROBLEMAS MÉDIOS (Atacar Depois)

### #8: Tratamento de Erro Inconsistente

**Severidade:** 🟠 MÉDIA  
**Impacto:** Confunde frontend e usuário  
**Esforço:** 2 horas  
**Status:** ⏳ NÃO INICIADO

**Problema:**
- Alguns endpoints: `{ message: "erro" }`
- Outros: `{ mensagem: "erro" }`
- Inconsistência em status codes

**Solução:**
- Padrão único de erro
- Códigos de erro (ERROR_001)
- Middleware de error handling

**Checklist After Resolve:**
- [ ] Atualizar CONTROLLER_TEMPLATE.md
- [ ] Documentar erro handling em docs/

---

### #9: SQL Raw em Program.cs (Não Migração)

**Severidade:** 🟠 MÉDIA  
**Impacto:** Deploy arriscado, difícil de sincronizar  
**Esforço:** 2 horas  
**Status:** ⏳ NÃO INICIADO

**Problema:**
- AplicarSistemaFaturasAsync() executa SQL direto
- Não é migration EF Core
- Difícil de rollback

**Solução:**
- Converter tudo para migrations EF Core
- Deletar SQL raw do Program.cs

**Checklist After Resolve:**
- [ ] Atualizar docs/ se schema mudou
- [ ] Testar em DB limpo
- [ ] Documentar migração em docs/

---

### #10: Sem Features Básicas

**Severidade:** 🟠 MÉDIA  
**Impacto:** Produto não é competitivo  
**Esforço:** 20+ horas  
**Status:** ⏳ NÃO INICIADO

**Problemas:**
- ❌ Relatórios customizáveis
- ❌ Export (CSV, PDF)
- ❌ Orçamento / metas
- ❌ Avisos de limite
- ❌ Recorrentes com auto-execução
- ❌ Sincronização com banco

**Checklist After Resolve:**
- [ ] Documentar cada feature
- [ ] Testar end-to-end
- [ ] Atualizar docs/FLOWS.md

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

---
owner: Gustavo
last_reviewed: 2026-06-16
next_review: 2026-08-19
status: CURRENT
---

# Regras de Negócio — Cartão de Crédito

> **Front (Q5 #84):** `CreditCardsPage` refatorada pra biblioteca Pontes (saiu do MUI/CustomButton/tokens.ts) — cards, stats, painel de faturas (lista + detalhe expansível), modais de cartão e pagamento, tudo em `@/components/pontes` + CSS Modules. Validação por campo (padrão DS) nos modais. Auditado ponta-a-ponta: ciclo, fatura Aberta→Fechada→Paga, pagamento (parcial/total), limite usado + restauração após pagamento, transações da fatura. Fixes: datas de ciclo formatadas em UTC (não caem pro dia anterior); a tela recarrega ao criar transação pelo popup global (evento `transactionCreated`).

Documento de referência para o domínio `CartaoCredito` e `Fatura`. Cobre tipos de cartão, ciclo de faturamento, cálculo de limite, atribuição de transações e estados de fatura.

---

## 1. Tipos de Cartão

Cada cartão possui três flags ortogonais que podem coexistir:

| Flag | Descrição |
|------|-----------|
| `TemCredito` | Cartão pós-pago com limite e fatura mensal |
| `TemDebito` | Cartão débito — débita direto da conta vinculada |
| `EhPrePago` | Cartão pré-pago (ex: VR, VA, gift card) — sem conta vinculada |

**Regras de validação ao criar/editar:**
- Se `TemCredito = true`: `Limite > 0`, `DiaFechamento ∈ [1, 28]`, `DiaVencimento ∈ [1, 28]` são obrigatórios.
- Se `EhPrePago = true`: `ContaId` é ignorado (campo nulo).
- Um mesmo cartão pode ter `TemCredito = true` e `TemDebito = true` simultaneamente (cartão múltiplo).

---

## 2. Ciclo de Faturamento

### 2.1 Cálculo do período da fatura

Dado `DiaFechamento = D` e `dataTransacao`:

```
se dataTransacao.dia < D:
    → fatura fecha neste mês no dia D
    → período começa no dia D do mês anterior (inclusive)

se dataTransacao.dia >= D:
    → transação cai na NOVA fatura (próximo ciclo)
    → período começa no dia D deste mês
    → fatura fecha no dia D do mês seguinte
```

**Exemplo** — DiaFechamento = 10:
| Data da compra | Fatura que fecha em |
|----------------|---------------------|
| 09/05 | 10/05 (ciclo: 10/04 → 10/05) |
| 10/05 | 10/06 (ciclo: 10/05 → 10/06) |
| 19/05 | 10/06 (ciclo: 10/05 → 10/06) |

> Implementado em `FaturaService.CalcularPeriodo()`.

### 2.2 Cálculo da data de vencimento

Dado `DiaVencimento = V` e `dataFechamento`:

- Se `DiaVencimento > DiaFechamento` no mesmo mês → vencimento no mesmo mês do fechamento.
- Se `DiaVencimento <= DiaFechamento` → vencimento no mês seguinte ao fechamento.
- Se o cartão não tem `DiaVencimento` → vencimento = fechamento + 10 dias.

> Implementado em `FaturaService.CalcularVencimento()`.

---

## 3. Fatura

### 3.1 Criação automática

Ao registrar uma transação de crédito (`UsadoComoCredito = true`), o sistema chama `ObterOuCriarFaturaAsync`:
- Busca fatura existente pelo `DataFechamento` do ciclo calculado.
- Cria nova fatura caso não exista.
- **Uma única fatura por ciclo de fechamento** — fusão por design, não bug.

### 3.2 Datas permitidas nas transações de crédito

- Transações de crédito **aceitam datas futuras** — uma compra pode ser registrada hoje mas cair na fatura do próximo ciclo.
- Transações de conta corrente (débito/receita) **não aceitam datas futuras**.

### 3.3 Estados da fatura (3 flags ortogonais)

```
EstadoCiclo:      0 = Aberta   | 1 = Fechada
EstadoPagamento:  0 = NaoPago  | 1 = Parcial  | 2 = Pago
EstaAtrasada:     false        | true
```

**Transições válidas:**

```
Aberta + NaoPago
  → [transação adicionada]    → total aumenta (valorTotal recalculado dinamicamente)
  → [job FaturaFechamento]    → EstadoCiclo = Fechada
  → [usuário paga parcial]    → EstadoPagamento = Parcial
  → [usuário paga total]      → EstadoPagamento = Pago, DataPagamentoTotal = now

Fechada + NaoPago
  → [job FaturaAtraso]        → EstaAtrasada = true (DataVencimento ultrapassado)
  → [usuário paga parcial]    → EstadoPagamento = Parcial
  → [usuário paga total]      → EstadoPagamento = Pago, EstaAtrasada = false

Fechada + Pago                → estado final, fatura arquivada
```

> ⚠️ `EstadoPagamento` pode ficar desatualizado se uma nova transação for adicionada após a fatura já ter sido marcada como `Pago`. A UI usa `valorRestante > 0` (calculado dinamicamente) como fonte de verdade para exibir o botão de pagamento — não o `EstadoPagamento`.

### 3.4 Cálculo do valor total

```
valorTotal = Σ transacoes WHERE UsadoComoCredito = true AND Ativo = true
           + Σ parcelasTransacao WHERE Status != Cancelada (ValorComJuros, ou Valor se sem juros)
valorRestante = max(0, valorTotal − ValorPago)
```

Fonte única: `Services/RegrasFinanceiras.cs` (`ValorTotalFatura` / `ValorRestanteFatura`) — nunca recalcular em outro lugar (#269). Parcela `Paga` antecipadamente **continua** no total (o pagamento antecipado soma em `ValorPago`; tirá-la descontaria 2x).

**Depois de cancelar parcela/parcelamento** o total cai sem dinheiro novo, então o estado é reconciliado (`ReconciliarFaturasAposCancelamentoAsync`): ciclo **fechado** coberto (`ValorPago > 0` e restante 0) → `Pago` + `FaturaPagaTotal` no audit log; ciclo **aberto** fica `Parcial` com restante 0 até o `FaturaFechamentoJob` quitar no fechamento (marcar `Pago` antes travaria a próxima compra do ciclo). Parcela `Pendente` numa fatura **coberta pelo pagamento** já foi paga: o cancelamento a preserva (`requerEstorno`) e pagar antecipado recusa.

Transações de pagamento da fatura **não entram** no total — elas têm `ContaId` preenchido e `UsadoComoCredito = false`.

---

## 4. Limite de Crédito

### 4.1 Limite usado e disponível — regra única (como no banco)

Comprou, o usado sobe; pagou a fatura (**mesmo em parte**), o usado desce na medida do pago. Compra parcelada bloqueia **todas** as parcelas ainda não pagas, inclusive as de faturas futuras.

```
executado(fatura) = Σ crédito à vista vivo e EFETIVADO (UsadoComoCredito, Ativo, Executado)
                  + Σ parcelas não canceladas (ValorComJuros ?? Valor)      ← regra do total da fatura, sem previsão
limiteUsado       = Σ por fatura do cartão de max(0, executado − ValorPago)
                  + Σ compra efetivada no cartão SEM fatura (sem conta, despesa)
limiteDisponivel  = LimiteTotal − limiteUsado                               ← pode ficar negativo (estouro)
```

- **Previsão** (recorrente futura no cartão) não usa limite — aparece à parte como `ExposicaoFuturaPrevisao`.
- **Piso por fatura:** excesso pago numa fatura (pagou a mais, parcela cancelada depois) não libera o limite das outras.
- **Parcela `Pendente` em fatura coberta** pelo pagamento não bloqueia mais (o pagamento da fatura já a cobriu) — o limite segue o `ValorPago`, não o rótulo `EstadoPagamento`.
- **Compra sem fatura:** hoje só nasce de `RecorrenteService.GerarPendentesAsync` (recorrente de cartão lançada sem `FaturaId`). Nenhuma fatura a cobra, então pagar fatura não a libera; sai do usado ao excluir o lançamento.

Fonte única: `Services/RegrasFinanceiras.cs` (`LimitesUsadosDosCartoesAsync` — somas no SQL, uma linha por fatura; `LimiteUsadoDaFatura`; `LimiteDisponivel`). Consumidores: `CartaoCreditoService` (card da tela, `LimiteUsado`/`LimiteDisponivel` no DTO) e `LimiteCalculatorService` (trava "Limite insuficiente" do parcelamento, `NovoLimite` de pagar/cancelar parcela e parcelamento, dashboard) — o mesmo número em todos.

---

## 5. Pagamento de Fatura

- Pagamento debita da `Conta` informada pelo usuário (cria `Transacao` com `ContaId`).
- Pagamento parcial permitido: `0 < valorPagamento <= valorRestante`.
- Pagamento total: `EstadoPagamento = Pago`, `DataPagamentoTotal = now`, `EstaAtrasada = false`.
- Uma fatura com `EstadoPagamento = Pago` **não pode** ser paga novamente via API (guard no service).
- **Idempotência + concorrência (#268):** header `Idempotency-Key` obrigatório (400 sem ele); a chave vai pra `RegistroIdempotencia` (índice único) no mesmo `SaveChanges` do pagamento. Retry com os mesmos dados → 204 sem pagar de novo; com outros dados → 409. `xmin` na `Fatura`: pagamento concorrente → 409. Detalhe do fluxo em `docs/FLOWS.md` §4.

### 5.1 Histórico detalhado — sem "pago" por compra

Pagar a fatura **abate o total dela**; não quita uma compra específica (é assim no banco). Por isso a lista de compras da fatura não marca compra nenhuma como paga (a antiga coloração verde por "cobertura acumulada" foi removida em 2026-09-27 — dava a impressão de compra paga com a fatura ainda devendo). O quanto já foi pago aparece só no resumo da fatura ("Total pago R$ X · falta R$ Y") e nas linhas de pagamento da linha do tempo.

---

## 6. Jobs Hangfire

| Job | Gatilho | Ação |
|-----|---------|------|
| `FaturaFechamentoJob` | Cron diário | Fecha faturas cujo `DataFechamento <= hoje` e `EstadoCiclo = Aberta`; se o ciclo fecha coberto (`ValorPago > 0` e restante 0) vira `Pago` e registra `FaturaPagaTotal` |
| `FaturaAtrasoJob` | Cron diário | Marca `EstaAtrasada = true` onde `DataVencimento < hoje`, `EstadoPagamento != Pago` **e restante > 0**; juros (1%/mês) e multa (2%) sobre o **restante** |

Os dois salvam o lote num `SaveChanges`; com o `xmin` na `Fatura`, um conflito (pagamento no meio) faz o job refazer **uma a uma**, relendo cada fatura — a que conflitar de novo fica pra próxima execução. "Vencida" no DTO também deriva do restante (`FaturaDto.Vencida`).

---

## 7. Invariantes do domínio

1. Toda transação de crédito pertence a exatamente uma `Fatura` (`FaturaId` obrigatório se `UsadoComoCredito = true`).
2. `CartaoCredito` não pode ser deletado se tiver faturas abertas (delete behavior: `Restrict`).
3. Transações financeiras nunca são deletadas fisicamente — soft delete via `Ativo = false`.
4. `Conta.Saldo` não é armazenado; é calculado on-the-fly como `Σ Receitas - Σ Despesas`.
5. O saldo da conta só é afetado **no momento do pagamento da fatura** — não quando a transação de crédito é criada.
6. `DiaFechamento` e `DiaVencimento` máximos são 28 para garantir que toda data seja válida em fevereiro.

---

## 8. Referências de código

| Conceito | Arquivo |
|----------|---------|
| Cálculo de período/vencimento | `Services/FaturaService.cs` — `CalcularPeriodo`, `CalcularVencimento` |
| Criação automática de fatura | `Services/FaturaService.cs` — `ObterOuCriarFaturaAsync` |
| Pagamento de fatura | `Services/FaturaService.cs` — `PagarFaturaAsync` |
| Limite usado/disponível | `Services/RegrasFinanceiras.cs` — `LimitesUsadosDosCartoesAsync` (usado por `CartaoCreditoService` e `LimiteCalculatorService`) |
| Validação de criação de cartão | `Services/CartaoCreditoService.cs` — `CriarAsync`, `AtualizarAsync` |
| Estados da fatura (enums) | `Domain/Enums/EstadoCicloFatura.cs`, `EstadoPagamentoFatura.cs` |
| UI — histórico de faturas | `controle-financeiro.web/src/pages/CreditCards/CreditCardsPage.tsx` |
| Tipos frontend | `controle-financeiro.web/src/types/Fatura.ts`, `CartaoCredito.ts` |

---

## 9. Decisões #138 (redesign visual/UX — 2026-05-26)

### 9.1 Fatura "atual" é identificada pela data, não pela posição
O job `ExpandirRecorrentes` cria faturas reais futuras (com transações `StatusTransacao.Previsao` das assinaturas), então `faturasSorted[0]` deixou de ser a "atual" (passou a ser a mais futura). A atual é a que contém hoje no período: `dataInicio <= hoje <= dataFechamento`. Frontend determina via `atualIdx` (com fallback pra primeira que já começou).

### 9.2 Excluir cartão — pagamentos viram histórico da conta
`CartaoCreditoService.DeletarAsync` antes barrava no FK `Restrict` da relação `Transacao.FaturaPaga → Fatura`. Decisão: ao deletar o cartão, **as transações de pagamento de fatura** (débito real numa conta) são **desvinculadas da fatura** (`FaturaPagaId = null`) e permanecem como despesas no extrato da conta. As **compras** feitas no cartão são removidas junto (cascade hard-delete — viola o princípio geral de soft-delete, mas é cascade do cartão removido; pendência: avaliar manter como soft-deleted).

### 9.3 Job `ExpandirRecorrentes` precisa marcar `UsadoComoCredito = true`
Sem essa flag, `FaturaService.DetalheAsync` (filtra por `t.UsadoComoCredito`) esconde as transações previstas — assinaturas sumiam da fatura. Agora a flag é setada quando `r.CartaoCreditoId.HasValue`.

### 9.4 Horizonte de previsão = fim do ano corrente (Dezembro)
Tanto o job (`dataProximaJanela = 1º Jan do ano seguinte`) quanto a projeção visual do frontend (em cima da última fatura real, capada em Dezembro). Em maio cobre mai→dez (7 meses); em janeiro cobre jan→dez (12 meses).

### 9.5 Pagamentos no detalhe da fatura
`FaturaDetalheDto.Pagamentos` retorna as transações com `FaturaPagaId == fatura.Id` (separadas das compras, que vão em `Transacoes`). Frontend renderiza compras + pagamentos numa **linha do tempo única ordenada por `criadoEm`** (data+hora) — dá pra acompanhar parcial-1, compra, parcial-2, compra, total. Linha de pagamento destacada em verde. Nota "Total pago" no fim quando houver pagamento.

### 9.6 "Paga" só quando fechada + quitada
`statusKey` (UI):
- `EstadoCiclo === Fechada` e `valorRestante <= 0` → **Paga**
- `EstadoCiclo === Fechada` e `valorRestante > 0` → **Fechada** (a pagar)
- `EstadoCiclo === Aberta` → **Aberta** (mesmo com pagamento parcial/antecipado — novas compras ainda podem entrar)

### 9.7 Cartão visual = face + bloco de info separados
- `.card`: gradiente da bandeira (cor real, valor de dado), arredondado em tudo, chip + contactless, número em relevo.
- `.cardMeta`: bloco neutro (`var(--pontes-surface)`) abaixo do cartão com disponível/limite/barra/data — fora do gradiente, com cores via `var(--pontes-*)`.
- **Modo foco**: ao clicar no cartão, esconde os outros e mostra só ele com a fatura abaixo (sem o header redundante "Fatura — {nome}"). Botão "Todos os cartões" volta.
- **1 cartão só → abre direto no foco** (auto-open via ref).

### 9.8 Navegação por mês (em vez de histórico)
Painel da fatura tem setas ‹ ›; previstas usam `faturaIdx < 0`. Carregamento por **janela de 3** (mês selecionado + vizinhos) — escala pra muitas faturas sem disparar N requests.

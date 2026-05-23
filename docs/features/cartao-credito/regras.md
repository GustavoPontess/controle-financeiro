---
owner: Caio
last_reviewed: 2026-05-23
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
           + Σ parcelasTransacao.ValorComJuros (ou Valor se sem juros)
```

Transações de pagamento da fatura **não entram** no total — elas têm `ContaId` preenchido e `UsadoComoCredito = false`.

---

## 4. Limite de Crédito

### 4.1 Limite disponível

```
gastosCicloAtual = Σ transacoes WHERE:
    UsadoComoCredito = true
    AND Tipo = Despesa
    AND Data ∈ [inicio_ciclo_atual, fim_ciclo_atual]
    AND FaturaId NOT IN (faturas com EstadoPagamento = Pago)

limiteDisponivel = LimiteTotal - gastosCicloAtual
```

### 4.2 Restauração após pagamento

Quando uma fatura é paga integralmente (`EstadoPagamento = Pago`), suas transações são **excluídas** do cálculo de `gastosCicloAtual`. O limite é restaurado imediatamente na próxima leitura.

> Implementado em `CartaoCreditoService.ToDto()` — exclui faturas pagas via `faturasPagas HashSet`.

---

## 5. Pagamento de Fatura

- Pagamento debita da `Conta` informada pelo usuário (cria `Transacao` com `ContaId`).
- Pagamento parcial permitido: `0 < valorPagamento <= valorRestante`.
- Pagamento total: `EstadoPagamento = Pago`, `DataPagamentoTotal = now`, `EstaAtrasada = false`.
- Uma fatura com `EstadoPagamento = Pago` **não pode** ser paga novamente via API (guard no service).

### 5.1 Coloração no histórico detalhado

Na listagem de transações dentro de uma fatura, a cor do valor indica cobertura pelo pagamento:

- Ordenar transações por `CriadoEm` (mais antiga primeiro).
- Acumular valores; se `valorPago >= acumulado` → **verde** (coberta).
- Caso contrário → **vermelho** (ainda em aberto).

---

## 6. Jobs Hangfire

| Job | Gatilho | Ação |
|-----|---------|------|
| `FaturaFechamentoJob` | Cron diário | Fecha faturas cujo `DataFechamento <= hoje` e `EstadoCiclo = Aberta` |
| `FaturaAtrasoJob` | Cron diário | Marca `EstaAtrasada = true` onde `DataVencimento < hoje` e `EstadoPagamento != Pago` |

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
| Limite disponível | `Services/CartaoCreditoService.cs` — `ToDto` |
| Validação de criação de cartão | `Services/CartaoCreditoService.cs` — `CriarAsync`, `AtualizarAsync` |
| Estados da fatura (enums) | `Domain/Enums/EstadoCicloFatura.cs`, `EstadoPagamentoFatura.cs` |
| UI — histórico de faturas | `controle-financeiro.web/src/pages/CreditCards/CreditCardsPage.tsx` |
| Tipos frontend | `controle-financeiro.web/src/types/Fatura.ts`, `CartaoCredito.ts` |

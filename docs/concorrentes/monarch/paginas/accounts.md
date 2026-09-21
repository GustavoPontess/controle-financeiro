# Monarch — Página **Accounts** (`/accounts`)

> Engenharia reversa. Conta de teste (trial), dados fictícios inseridos por mim. Objetivo: replicar no nosso.

## Função
Visão de **patrimônio (net worth)** = soma de todas as contas (ativos − passivos). Lista as contas agrupadas por classe + gráfico no topo + resumo lateral.

## Topo — gráfico de patrimônio
Dois **modos de gráfico** (dropdown, canto sup. dir.):

| Modo | Tipo de gráfico | Dropdown de período | O que mostra |
|---|---|---|---|
| **Performance** | linha (evolução do saldo) | 1 month · 3 months · 6 months · Year to date · 1 year · All time | trajetória do net worth no tempo + "X change" (delta do período) |
| **Breakdown** | barras (empilhadas por classe) | Monthly · Quarterly · Yearly | composição por período (ativo vs passivo empilhado) |

- Header do gráfico: **"Net worth" $valor · delta (verde ↑ / vermelho ↓) · "X change"** conforme período.
- O estado do gráfico vai pra **URL** (`?chartType=performance&dateRange=1M&timeframe=month`) → deep-link/estado persistido em query string.

## Corpo — lista de contas
- Agrupada por **classe** (ex.: "Cash") com subtotal + "X change" por grupo, colapsável (▸/▾).
- Cada linha: ícone · **nome** · subtipo (ex.: "CD") · **saldo** · "há X min" (last updated).
- Barra superior: **Sort · Filters · Refresh all · Add account** (Add account = mesmo fluxo do onboarding, ver [add-account](./add-account.md)).

## Lateral — Summary
- Abas **Totals × Percent**.
- **Assets** (com barra proporcional por classe) + **Liabilities**.
- **Download CSV**.

## Detalhe da conta (`/accounts/details/{id}`)
Clique na conta → página própria:
- **CURRENT BALANCE** grande + gráfico de **histórico de saldo** (linha) + range (All time…).
- **Lista de transações** da conta (ou "No transactions yet" + botão Add transaction).
- **Summary lateral:** Account type · **APY** ("Add missing APY" — eles rastreiam taxa de juros/rendimento por conta) · Last updated · Created.
- Botão **Edit** (dropdown) com **muita portabilidade de dados**:
  - Edit account · **Download transactions** · **Import transactions** · **Transfer data** (badge "New") · **Copy balance history** · **Download balance history** · **Import balance history** · **Edit balance history**.

## ⭐ O que roubar pro nosso
1. **Net worth de verdade** = precisa das classes de ativo/passivo além de conta/cartão (ver [add-account](./add-account.md)). Hoje só temos conta/cartão → dá pra evoluir agregando empréstimo (já temos módulo) como passivo.
2. **Dois modos de gráfico** (linha de evolução + barras de composição) com o mesmo dataset — padrão reaproveitável no nosso Dashboard.
3. **Estado do gráfico na URL** (deep-link de período/modo) — bom pra compartilhar/persistir.
4. **APY por conta** — campo simples que habilita projeção de rendimento (casa com Forecasting).
5. **Portabilidade** (import/export/edit balance history) — diferencial de confiança ("seus dados são seus"); casa com LGPD (portabilidade é direito do titular).

## Como fazer no nosso (stack)
- Gráfico: `recharts` (`LineChart` p/ Performance, `BarChart` empilhado p/ Breakdown) — já usamos recharts no Dashboard.
- Range/modo → querystring via React Router `useSearchParams` (temos RR v7).
- Backend: `Conta.Saldo` já é calculado. Net worth = agregação nova por classe (ativo/passivo) — precisa do modelo de tipos de conta (ver add-account).

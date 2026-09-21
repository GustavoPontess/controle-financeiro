# Monarch — **Cash Flow** (`/cash-flow`)

> "Pra onde meu dinheiro vai." Entrada × saída × poupança do período. Gráficos ótimos pro nosso Dashboard.

## Layout
- Topo: **Monthly / Quarterly / Yearly** + **Filters**.
- **Gráfico superior** (barra por período): income (verde, acima do zero) × expenses (vermelho, abaixo), com marcador de net. Um mês selecionável.
- **4 stat cards:** `Income` · `Expenses` · `Total savings` (income − expenses) · **`Savings rate` %** (savings / income). Ex.: $5.000 / $2.620 / $2.380 / **47.6%**.
- **Breakdown Income** e **Breakdown Expenses**, cada um com abas **Category · Group · Merchant · Share** e barras horizontais proporcionais ao valor (%).

## ⭐ View dropdown — 2 tipos de gráfico
Estado vai pra URL (`?view=breakdown&sankey=category&timeframe=month`).
1. **Bar Chart** — barras income/expense por período.
2. **Sankey Diagram** ⭐ — **diagrama de fluxo** (a viz-assinatura do Monarch): renda entra à esquerda (Paychecks $5.000 100%), passa por nó central e **se ramifica** em Net Income $2.380 (47.6%) + cada categoria de despesa (Rent $1.500 30% · Groceries $650 13% · Restaurants $280 5.6% · Gas&Electric…). Abas **Category / Group / Both / Share**. Fluxos coloridos por categoria. É lindo e comunica "pra onde vai o dinheiro" na hora.

## Como fazer no nosso (stack)
- **Sankey:** `recharts` não tem Sankey nativo bom → usar `@nivo/sankey` ou `d3-sankey`. Dataset: nós = {renda, categorias, "poupança"}; links = {source→target, valor}. Alto impacto visual, vale o esforço.
- **Bar chart** income/expense: `recharts BarChart` com barras positivas/negativas + `ReferenceLine y=0`.
- **Savings rate** = KPI simples (savings/income) — bom card pro nosso Dashboard.
- Breakdown com abas Category/Group/Merchant: mesma query agregada por dimensão diferente (precisa de entidade Merchant — ver [transacao-modal](./transacao-modal.md)).
- Filtros por período (Monthly/Quarterly/Yearly) = agregação temporal.

## O que roubar
- **Sankey** é o gráfico que mais impressiona — forte candidato pro nosso Dashboard/relatórios (nenhum concorrente BR tem).
- **Savings rate** como métrica de destaque (motiva o usuário).
- Breakdown por **Merchant** (além de categoria) — só possível com entidade Merchant.

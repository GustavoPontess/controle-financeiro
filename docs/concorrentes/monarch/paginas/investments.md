# Monarch — **Investments** (`/investments`)

> Acompanhamento de carteira + benchmark. US-cêntrico (S&P 500). Pro BR = adaptar (B3, Tesouro, FIIs, CDB).

## Sub-abas
- **Holdings** (grátis) · **Advanced** (⭐ **Plus** — gated, mais um upsell).

## Backtested performance (chart)
- Abas **Market / Allocation** + range (3 Months…) + download.
- **Market:** linha de retorno % comparando **Your Portfolio** com benchmarks **S&P 500 · US Stocks · US Bonds** no período. Legenda mostra retorno de cada (ex.: S&P 500 +2.38%, US Bonds −2.71%). Eixo % (−3% a +9%).
- **Allocation:** breakdown da alocação da carteira (por classe de ativo).

## Holdings (tabela)
- Colunas: **Security · Price · Quantity · Value · Weight · Past 3 Months** (retorno).
- Agrupável **By asset class**.
- **Add Holding:** "Search for an investment and enter the quantity you own to track the value" — busca um security (ticker) + quantidade → rastreia valor. Suporta conta de investimento conectada OU manual (ver "Track: manually" no [add-account](../app.md)).

## ⭐ Aba Advanced (Plus) — mapeada por dentro
Análise sofisticada de carteira, 3 views (dropdown de agrupamento + chart-type + download em cada):

### 1. Allocation — "Allocation breakdown"
- **Treemap por Asset class** (blocos proporcionais): ex.: **U.S. stocks 99.44%** + Cash + outros. Mostra **diversificação**.
- Tabela por classe: Price · Quantity · Value · **Weight (%)**.
- (Agrupável por outras dimensões além de asset class.)

### 2. Gains & Losses — "Unrealized gains & losses"
- **4 KPIs:** Portfolio value · **Portfolio cost (cost basis)** · **Gain/loss value ($)** · **Gain/loss percent (%)**.
- **Chart empilhado** (Cost Basis + Gain + Loss) por grupo de classe.
- Tabela por holding: Security · Quantity · **Total cost basis** · Current value · **Gain/loss $** · **Gain/loss %**.
- = ganho/perda **não-realizado** (marcação a mercado vs. custo).

### 3. Funds — "Fund analysis" (look-through)
- Só **ETFs e fundos mútuos** ("individual stocks/bonds not included").
- **Donut** + tabela por **Broad asset class** (ex.: US Equity 100%) — **olha DENTRO dos fundos** (o ETF VOO → US Equity). Sofisticado: revela a exposição real através dos fundos.
- Agrupável (Broad asset class / detalhado / setor…).

### + Add tax lots
No menu **Add**: **Add holding** · **Add tax lots** — lotes de custo (cost basis por lote) pra cálculo de **imposto** (ganho de capital). Avançado/US.

## Monetização
- **Advanced = Plus** (análise mais profunda de investimento é paga). Padrão: base grátis (Holdings + benchmark) + avançado pago (Allocation/Gains&Losses/Funds/tax lots) — igual Forecasting.

## Como fazer no nosso — Advanced (BR)
- **Allocation treemap:** `@nivo/treemap`; classe de ativo BR (Ações/FIIs/RF/Tesouro/Cripto/Exterior).
- **Gains & Losses:** guardar **preço médio (cost basis)** por holding → ganho não-realizado = valor atual − custo. KPI + tabela. (No BR liga com IR sobre ganho de capital / DARF — oportunidade forte pro eixo contador.)
- **Funds look-through:** exige base de composição de FIIs/ETFs BR (mais difícil; fase 2).
- **Tax lots → DARF BR:** rastrear lotes pra apuração de IR mensal de ações/cripto = **feature matadora BR** (ninguém faz bem; dor real do investidor PF).

## Como fazer no nosso (BR)
- Benchmark BR: **CDI · IBOV · IPCA · Tesouro** (não S&P 500). Retorno % vs benchmark é KPI forte.
- Holdings BR: **ações/FIIs (B3), Tesouro Direto, CDB/LCI/LCA, cripto**. `Holding { Ticker, Classe, Quantidade, PrecoMedio, ContaId }`; valor = quantidade × cotação (fonte de preço BR — B3/brapi).
- Alocação por classe = pizza/treemap (reusa [reports](./reports.md)).
- **Open Finance BR** traria holdings automáticos (nosso roadmap) — hoje manual, como o Monarch permite.

## O que roubar
- **Comparação com benchmark** (sua carteira × índice) — motiva e dá contexto.
- **Weight** (peso de cada ativo) + alocação por classe.
- Modelo **base grátis / Advanced pago**.

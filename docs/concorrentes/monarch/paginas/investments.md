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

## Monetização
- **Advanced = Plus** (análise mais profunda de investimento é paga). Padrão: base grátis + avançado pago (igual Forecasting).

## Como fazer no nosso (BR)
- Benchmark BR: **CDI · IBOV · IPCA · Tesouro** (não S&P 500). Retorno % vs benchmark é KPI forte.
- Holdings BR: **ações/FIIs (B3), Tesouro Direto, CDB/LCI/LCA, cripto**. `Holding { Ticker, Classe, Quantidade, PrecoMedio, ContaId }`; valor = quantidade × cotação (fonte de preço BR — B3/brapi).
- Alocação por classe = pizza/treemap (reusa [reports](./reports.md)).
- **Open Finance BR** traria holdings automáticos (nosso roadmap) — hoje manual, como o Monarch permite.

## O que roubar
- **Comparação com benchmark** (sua carteira × índice) — motiva e dá contexto.
- **Weight** (peso de cada ativo) + alocação por classe.
- Modelo **base grátis / Advanced pago**.

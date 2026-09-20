# Monarch — **Reports** (`/reports`)

> Relatórios flexíveis (múltiplos gráficos + salvar config). Vira nosso módulo de relatórios/insights.

## Sub-abas
**Cash Flow · Spending · Income** (`/reports/cash-flow`, `/reports/spending`, `/reports/income`).

## Controles (topo)
- **Date** (range) · **Filters** · **Reports** (dropdown de relatórios salvos) · **Save** (salva a config atual como relatório customizado).
- Por gráfico: **chart type** (dropdown) · **grouping** ("By category" / group / merchant) · **download** (exporta imagem/CSV).

## Tipos de gráfico (Spending) ⭐
Dropdown com 4 opções (cada um pra um ângulo):
1. **Pie** (donut) — "Your expense breakdown at a glance". Centro = total; segmentos por categoria + legenda com % (Rent 57.3%, Groceries 24.8%…).
2. **Breakdown** — "Expenses, biggest to smallest" (barras horizontais ordenadas).
3. **Treemap** — "Proportional category breakdown" (retângulos proporcionais).
4. **Trend bars** — "Your spending behavior over time" (barras por período).

## Abaixo do gráfico
- **Transactions** (lista filtrada pelo relatório: Edit multiple · Sort · Columns).
- **Summary** (painel): **Total transactions · Largest transaction · Average transaction · Total spending**.

## Income tab
Espelho do Spending pro lado da receita (mesmos tipos de gráfico, breakdown por fonte de renda).

## Cash Flow tab
= a página [Cash Flow](./cash-flow.md) embutida (bar + Sankey).

## Como fazer no nosso (stack)
- **Pie/donut, Breakdown (bar), Trend bars:** `recharts` (`PieChart`, `BarChart`). **Treemap:** `recharts Treemap` ou `@nivo/treemap`.
- **Relatórios salvos:** entidade `RelatorioSalvo { UsuarioId, Nome, Config(json: tipo, grouping, filtros, range) }` → dropdown "Reports" + botão "Save". Bom pro usuário avançado/contador (eixo B2B).
- **Summary stats** (largest/average/total) = agregações simples da query filtrada.
- **Export** (CSV/imagem) — importante pro eixo contador.

## O que roubar
- **Múltiplos tipos de gráfico pro mesmo dado** (Pie/Breakdown/Treemap/Trend) — deixa o usuário ver do jeito dele.
- **Relatórios salvos + export** — feature de poder, casa com nosso eixo contador (B2B).

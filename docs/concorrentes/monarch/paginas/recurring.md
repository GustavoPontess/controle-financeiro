# Monarch — **Recurring** (`/recurring`)

> Contas/receitas recorrentes previstas. Nós já temos `Recorrente` — comparar campos + a ligação com Forecasting.

## Layout
- Navegador de mês (September 2026) · Today · views **List / Calendar**.
- 3 seções: **Income** (Add recurring income) · **Expenses** (Add recurring expenses) · **Credit cards** (Set up bill sync — sincroniza vencimento de fatura de cartão).
- Controles: Monthly · All recurring · Filters · **Manage recurring**.
- Empty state por mês: "No recurring items yet."

## ⭐ Recorrência é ligada a MERCHANT (não a transação avulsa)
Add recurring = **"Search for a merchant"** → escolhe um comerciante que tem transações com padrão. Monarch detecta padrões automaticamente e sugere. Config no **Edit merchant**:

| Campo | Valores |
|---|---|
| **Mark this merchant as recurring** | toggle (mostra na seção Recurring com transações futuras esperadas) |
| **Recurring frequency** | 11 opções: Every week · Every 2 weeks · Every 4 weeks · Twice a month (1st & 15th) · Twice a month (15th & last day) · Every month · Every 2 months · Every 3 months · Every 4 months · Every 6 months · Every year |
| **Recurring type** | Expense / Income |
| **Starting date** | ⭐ "used to **forecast** future transactions at this merchant" (alimenta o Forecasting) |
| **Amount** | valor esperado |
| **Recurring status** | Active / Canceled (Canceled mantém histórico mas para de prever) |

## Ligações
- **→ Forecasting:** recorrentes são a base da projeção de fluxo futuro (starting date + frequency + amount).
- **→ Budget:** recorrentes viram linhas de orçamento "Fixed" esperadas.
- **→ Merchant:** depende de ter entidade Merchant (que nós não temos ainda — ver [transacao-modal](./transacao-modal.md)).

## Views
- **List** — lista por seção com próxima data esperada.
- **Calendar** — calendário do mês com os vencimentos marcados nos dias (bom pra ver "quando cai cada conta").

## Comparar com nosso `Recorrente`
- Nós já temos `Recorrente` + jobs Hangfire (`ExpandirRecorrentes`, `ExecutarRecorrentes`). Checar se cobrimos: as 11 frequências (esp. "twice a month" e quinzenal), o vínculo a merchant, o status Canceled, e a **previsão futura** (não só gerar a transição no dia).
- **Roubar:** a **view Calendar** dos vencimentos + a lista de 11 frequências + "bill sync" de cartão (vincular vencimento da fatura). E usar recorrentes como input do nosso futuro Forecasting.

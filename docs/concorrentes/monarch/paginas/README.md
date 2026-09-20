# Monarch — relatórios por página (engenharia reversa)

> Mapeamento exaustivo do app do Monarch (conta de teste, dados fictícios inseridos por mim, zero compra). 1 arquivo por página/área. Objetivo: replicar/superar no nosso produto.
>
> Contexto: ver [../onboarding.md](../onboarding.md) (funil de entrada + pricing), [../app.md](../app.md) (visão geral + add manual account), [../comparativo.md](../comparativo.md), [../produto.md](../produto.md).

## Índice
| Página | Arquivo | Destaque |
|---|---|---|
| Dashboard | [dashboard.md](./dashboard.md) | grid de widgets + **IA contextual por card** |
| Accounts / Net worth | [accounts.md](./accounts.md) | Performance × Breakdown, portabilidade, APY |
| Transactions (lista) | [transactions.md](./transactions.md) | filtros multi-dimensão, Receipts/Retail Sync, CSV |
| Modal Add/Edit transação | [transacao-modal.md](./transacao-modal.md) | **Debit/Credit (sem negativo)**, merchant entidade, taxonomia categorias |
| Cash Flow | [cash-flow.md](./cash-flow.md) | ⭐ **Sankey**, savings rate |
| Reports | [reports.md](./reports.md) | Pie/Breakdown/Treemap/Trend + relatórios salvos |
| Budget | [budget.md](./budget.md) | Planned/Actual/Remaining, Flex×Category, **metas no orçamento** |
| Recurring | [recurring.md](./recurring.md) | 11 frequências, recorrência via merchant |
| Goals | [goals.md](./goals.md) | ⭐⭐ **modelo de ALOCAÇÃO** + fórmula meta-por-data + 2 gráficos |
| Forecasting | [forecasting.md](./forecasting.md) | ⭐⭐⭐ **projeção de vida** ("comprar casa") — **gated no Plus** |
| Investments | [investments.md](./investments.md) | performance vs benchmark; Advanced=Plus |
| Advice | [advice.md](./advice.md) | ⚠️ **descontinuado** (migra pra IA) |
| AI Assistant | [ai-assistant.md](./ai-assistant.md) | chat grounded (não alucinou ao vivo) |
| Household / Casal + Contador | [household-casal.md](./household-casal.md) | ⭐⭐⭐ **nossos 2 fossos** |
| Settings | [settings.md](./settings.md) | Rules (automação), Data (LGPD), Security |
| Top nav / Notif / Upsell | [notificacoes-e-topo.md](./notificacoes-e-topo.md) | pricing completo + tática de conversão |

## Loop central do produto deles (o que amarra tudo)
**Forecasting** (futuro/what-if) → **Goals** (alvo + data → mensalidade) → **Budget** (mês: cada real tem função) → **Transações** (real) → **Allocation** (reserva de saldo real) → volta pro net worth/Forecasting. As metas/alocações aparecem no Budget (Contributions) e alimentam o Forecasting. É um sistema fechado, não features soltas.

## Pricing (resumo)
- **Core**: $14.99/mo ou $99.99/ano. **Plus**: $199.99/ano (Forecasting + Investments Advanced). Trial 7 dias (exige cartão). Só cartão/Stripe — **sem PIX/boleto** (brecha BR).

## Onde superamos (tese: nenhum BR tem esse nível; a gente iguala e ganha no fosso)
1. **Casal/família com rateio** (eles só marcam personal/shared, não fazem o acerto).
2. **IA de casal** (household-aware).
3. **Local BR**: PIX/boleto, Open Finance BR, NFC-e/QR (Receipts), benchmarks BR (CDI/IBOV).
4. **Forecasting como isca grátis** (eles cobram no Plus).

> Backlog priorizado da engenharia reversa: ver [../roubar-priorizado.md](../roubar-priorizado.md).

## Cobertura (sweep exaustivo)
Mapeado por completo: todas as telas do Core + **Plus** (Forecasting: setup, premissas, 9 eventos + params, sub-fluxos, cenários; Investments Advanced: Allocation/Gains&Losses/Funds/tax lots), Goals (Save up + **Pay down** + Allocate + Manage), Reports (Cash Flow/Spending/**Income**), **todas as sub-páginas de Settings** (Profile/Display/Notifications/Security/Early Access/Integrations-MCP/General/Businesses/Members/Preferences/Institutions/Categories/Merchants/Rules/Tags/Data), questionário de Advice completo. **Fora do escopo:** app **mobile** (só web foi acessado) — iOS/Android podem ter UX própria a checar depois.

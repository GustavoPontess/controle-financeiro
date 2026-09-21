# Monarch — **Dashboard** (`/dashboard`)

> Home pós-login. Grid de widgets customizável, com IA embutida em cada card.

## Estrutura
- Saudação "Hello, Gustavo!" + botão **Customize** (top-right).
- **Grid de widgets** (2 colunas), cada um resumindo uma área + link pra página cheia.

## Widgets (10, todos toggleáveis + reordenáveis via drag)
`Customize dashboard` → "Select the widgets you want to see":
1. **Getting started guide** — checklist de ativação (4/6): Invite your partner (badge "Next"), Customize categories… ("I'll explore on my own" pra dispensar).
2. **Budget** — resumo do mês (Expenses).
3. **Credit score** — "Monitor your credit score / Enable" (⚠️ feature US — score de crédito; BR seria Serasa/SPC, outro modelo).
4. **Net worth** — $ + mini-chart (range 1 month…).
5. **Savings goals** — cards de meta (Comprar Casa 2027 · On track · dez/2027 · $2.000).
6. **Spending trend** — "$X this month" + **line chart "This month vs. last month"** (acumulado diário Day 1→31, 2 linhas sobrepostas).
7. **Transactions** — Most recent / All transactions.
8. **Recurring transactions** — "$X remaining due this month".
9. **Investments** — "Sync your brokerage for a live view".
10. **Advice** — (mesmo sendo descontinuado, ainda no dash).

## ⭐ IA embutida em cada widget
Cada card tem um hook **"Understand insights about…"** (ícone 🪄) que dispara a [AI Assistant](./ai-assistant.md) explicando **aquele** widget. Ex.: "Understand your budget for September 2026", "Understand insights about your goals progress", "Understand how your spending changed this month vs last month". → a IA não é uma página isolada, é **transversal** (contextual por widget).

## Como fazer no nosso (stack)
- **Grid customizável:** cada widget é um componente do DS Pontes; preferência do usuário `DashboardConfig { widgets: [{id, visivel, ordem}] }`. Drag-reorder (checar se temos lib; senão `dnd-kit`).
- **Spending "this vs last month":** `recharts LineChart` com 2 séries (acumulado diário). Card de alto valor.
- **Hook de IA por widget:** botão contextual que abre o assistente com um prompt pré-montado sobre aquele dado. Diferencial forte — **fazer no nosso desde o começo** (IA transversal, não página separada).
- Widgets = resumo + deep-link pra página cheia (Accounts/Budget/Goals/etc).

## O que roubar
- **Dashboard customizável** (usuário escolhe/ordena widgets).
- **IA contextual em cada card** ("entenda este widget") — nenhum BR faz.
- **Getting started checklist** de ativação (onboarding contínuo) — "Invite your partner" no topo casa 100% com nosso fosso casal.
- Card **"this vs last month"** (comparação temporal imediata).

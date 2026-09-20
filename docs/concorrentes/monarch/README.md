# Monarch (Monarch Money) — resumo executivo

> `monarch.com`, analisado em 2026-05-31 (site público) + **deep-dive logado completo em 2026-09-20** (conta de teste paga, trial ativo, dados fictícios inseridos, zero compra — engenharia reversa de TODAS as telas/forms/gráficos). **Concorrente real do nosso espaço** (finanças pessoais B2C) e **o benchmark global de finanças de casal**. US-only, inglês, USD.
>
> ⭐ **Deep-dive logado (2026-09-20):** mapeamento tela a tela em [`paginas/`](./paginas/README.md) — Dashboard, Accounts, Transactions, modal de transação, Cash Flow (Sankey), Reports, Budget, Recurring, Goals (modelo de alocação), **Forecasting** (projeção de vida — gated no Plus), Investments, AI Assistant, Household/casal, Settings/Rules, pricing completo. Backlog priorizado do "que roubar" → [`roubar-priorizado.md`](./roubar-priorizado.md).
>
> **Achado central:** o produto deles é um **loop fechado** — Forecasting (futuro) → Goals (alvo+data→mensalidade) → Budget (mês) → Transações (real) → Allocation (reserva de saldo real). Não são features soltas. **Nenhum concorrente BR tem esse nível** (tese do Gustavo confirmada).

## O que é

App de finanças pessoais premium, **sucessor de fato do Mint** (que fechou). *"The modern way to manage money — budget, track, plan, all in one app."* Agrega todas as contas (bancos, cartões, empréstimos, investimentos, imóveis) via 13.000+ instituições, categoriza, mostra net worth/cash flow, orçamento flexível, metas, recorrências/assinaturas, relatórios, bill calendar, apps iOS/Android.

**Prova social forte:** 4.9★ (100k+ reviews), WSJ "Best Overall Budgeting App", Forbes "Best Budgeting App of 2026", CNBC "Best for Ease of Use".

## Público (como divulgam)

Nav inteiro organizado por público: **Features · For Couples · For Professionals · Pricing · Download**.
- **Casais** = segmento-headline (página dedicada `/for-couples`). É o coração do marketing deles.
- **Profissionais** (`/for-professionals`) = consultores financeiros (advisors) colaboram com clientes. Adjacente ao nosso contador, mas é advisor, não contador fiscal.
- Indivíduos / households com muitas contas.

## Preço

Trial **7 dias** (cartão exigido), depois pago — **sem free perpétuo**.
| Plano | Preço | Inclui |
|---|---|---|
| **Core** | **$8.33/mês ($99,99/ano)** | net worth completo, orçamento, relatórios custom, metas poupança/dívida |
| **Plus** | **$16.67/mês ($199,99/ano)** | tudo do Core + **business income/expenses, P&L + tax-prep exports**, retirement forecast, análise de investimento avançada, **criar testamento (will)** |

- Promo "30% OFF 1º ano (WELCOME)".
- **Parceiro/colaborador é GRÁTIS** ("invite your partner at no extra cost") — não cobram por pessoa. (≠ Despezzas, que cobra perfis no Plus.)
- Plus toca **PJ/profissional** (business income + P&L + tax-prep) — ângulo PJ relevante pra nós.

## Casais — como funciona (o ponto que mais importa pra nós)

Página `/for-couples`: *"Stay on the same page about money — create a shared view of your finances."* Modelo:
- **Visão única do household:** junta contas **separadas + conjuntas** numa visão só. "Saiba como vocês gastam **como household, não importa quem comprou**."
- **Net worth conjunto** (avatares dos dois: Dylan + Jessie).
- **Atribuir transação pra revisar:** "5 need review" + dropdown (Anyone / Jessie / Dylan) — taggar o parceiro pra revisar lançamento.
- **Orçamento + metas compartilhados** ("partner on a budget", goals conjuntos: Emergency Fund, Vacation).

**Modelo = MERGE (visão compartilhada) + atribuição leve.** É o modelo US de casal que **junta tudo**.

## Onde está nosso fosso (Monarch NÃO faz)

Monarch é "ver junto e orçar junto" — **não tem rateio "quem paga o quê", split/divisão proporcional, settle-up (quem deve a quem), papéis/permissões diferenciados, dependentes, fluxo de aprovação.** Assume casal de finanças fundidas. O modelo BR (casais que mantêm parte separada, divisão proporcional, dependentes, papéis) é **espaço aberto** — e é exatamente o nosso fosso.

## Leitura pra nós

- **Valida nossa tese:** "finanças de casal" é mercado grande e premiado (é o headline do líder US). Reforça apostar nisso.
- **Mas o modelo deles é merge**, não rateio. Nosso diferencial real = **rateio + papéis + dependentes + aprovação** (modelo família/casal BR), não só "ver junto".
- **Lição de pricing:** **parceiro grátis** impulsiona adoção de casal. Não enterrar família atrás do plano mais caro (erro do Despezzas).
- **Copiar barato:** "atribuir transação ao parceiro pra revisar" é um primitivo de colaboração simples e ótimo.
- **Não opera no BR** (US/USD/inglês) → não é concorrente operacional aqui, mas **é O benchmark de produto/design de casal**.

## Docs

- [`produto.md`](./produto.md) — features, sitemap, páginas
- [`design.md`](./design.md) — design system + o que aprender
- [`comparativo.md`](./comparativo.md) — Monarch × nós, gaps, fosso

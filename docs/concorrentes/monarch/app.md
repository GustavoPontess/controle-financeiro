# Monarch — o APP (pós-onboarding)

> Exploração do produto do Monarch por dentro (trial ativo), lendo o DOM. Continuação de [`onboarding.md`](onboarding.md).
> Objetivo (mesma tese): mapear o **nível de software** deles pra a gente **bater a régua** e ganhar no fosso BR (casal real + PIX/Open Finance). Nenhum concorrente BR chega nesse nível.
> Data: 2026-09-20. Conta em trial, **sem banco conectado** (pulei o connect) — o app mostra **dados de exemplo** (Starbucks, net worth $708k) pra não parecer vazio.

---

## Navegação principal (menu lateral = o set de features)
`Dashboard · Accounts · Transactions · Cash Flow · Reports · Budget · Recurring · Goals · Investments · Forecasting · Advice · What's New`
- **Rodapé do menu:** AI Assistant · Help & Support · **"Get 45% discount"** (upsell/retenção) · avatar "G Gustavo".
- **Topo:** badge **"Free trial · 7 days left"** (contador sempre visível — pressão suave pra converter).
- **Comparado ao nosso:** eles têm **Cash Flow (Sankey), Reports, Forecasting (projeção), Advice (metas de vida), Investments** — áreas que a gente não tem. Nosso menu é mais raso. Mas nenhum tem **casal/rateio**.

## Getting Started — checklist de ativação (0/6) ⭐
"Gustavo, let's finish setting up your account" — **checklist gamificado 0/6** no topo do dashboard:
1. **Add an account** 🏦 (marcado "Next") — Link your main spending account
2. **Invite your partner** 🤝 — Share a complete financial picture
3. **Review your spending** 💳
4. **Customize categories** ✨ — Automate your tracking
5. **Create a budget** 📈
6. **Create a goal** 🎯
- Links: "See more" · **"I'll explore on my own"** (deixa sair do checklist).
- **O que roubar:** checklist de ativação com progresso (0/6) é **o motor de ativação** — guia o usuário aos "aha moments" sem forçar. "Invite your partner" está no passo 2 (casal em destaque de novo). No nosso, o checklist seria: conectar/cadastrar conta → **convidar parceiro + escolher rateio** → 1ª transação → 1º acerto.

## Dashboard — widgets modulares (cada um com empty-state + CTA)
Cada card vazio tem **CTA claro** (nunca um vazio morto):
- **Budget (September 2026 / Expenses):** "Take control of your spending. Set limits..." → **Create budget**.
- **Credit score:** "Monitor your credit score..." → **Enable credit score** (feature de score de crédito — US).
- **Net worth: $708,000** (+$42.729,61 · 6,4%) + **gráfico de linha** (patrimônio no tempo, seletor 1 month). _(dado de exemplo)_
- **Goals:** "Start saving toward a goal. Set a target and we'll tell you how much to save each month." → **Create a goal**.
- **Spending: $952 this month** — gráfico **this month vs last month** (linha acumulada por dia).
- **Transactions (Most recent):** lista com **ícone emoji por categoria** (☕️ Coffee, 🗓 Subscriptions, 🍽 Restaurants) — Starbucks, Spotify, Cheesecake Factory. _(exemplo)_
- **Recurring: $74,66 remaining due** — assinaturas do mês com "in -X days".
- **Investments:** "Sync your brokerage for a live view..." → **Sync investments**.
- **Advice — "Prioritized by you":** metas de vida (Track cash flow · Buy a home · Pay off student loans · Save for college) · "View all priorities (5)".
- **AI onboarding assistant:** "Hello, Gustavo! Let's begin by connecting..." com prompts contextuais ("Understand your budget", "Understand how your spending changed", etc.) — o **AI explica cada widget**.

### O que roubar do dashboard
- **Dashboard = grid de widgets modulares**, cada um com empty-state acionável (CTA), não tela vazia.
- **Dados de exemplo** enquanto não conecta banco → app nunca parece vazio no 1º acesso (reduz abandono).
- **Ícone emoji por categoria** na lista de transações (leve, escaneável).
- **AI Assistant contextual** explicando cada card.
- Contador de trial + upsell de desconto sempre à vista.

## Transactions (lista)
- **Abas:** **All · Receipts · New · Retail Sync**
  - **Receipts** = anexar/gerir comprovantes.
  - **New** = transações novas/não revisadas.
  - **Retail Sync** = puxa **detalhe de pedido de varejo** (ex.: itens de Amazon/Walmart), não só o valor.
- **Toolbar:** **Edit multiple** (edição em massa) · **Sort** · **Columns** (escolher colunas visíveis) · filtros ("Clear filters") · **Download CSV**.
- **Linha:** Merchant + **ícone emoji da categoria** · Categoria · Conta (Checking/Savings/IRA/Amex) · Valor (verde = entrada). Cada transação tem **View merchant**, **View category** e **anexos** ("2 attachments" — comprovantes por transação).
- **Painel Summary:** "Understand how your money is moving (trends, recurring activity, and outliers) without reviewing every transaction" (resumo/insights sem revisar tudo).
- **O que roubar:** edição em massa, colunas customizáveis, export CSV, **anexo de comprovante por transação**, e o conceito de **Retail Sync** (detalhe de item do pedido) é avançado. No nosso já temos busca/filtro server-side; falta bulk-edit + anexos + colunas.

### Popups/nudges na tela de Transactions (2 simultâneos)
1. **Nudge contextual de empty-state (topo-dir):** card "See your transaction history across all of your accounts" + CTA laranja **"Connect an account to get started"** — aparece sobre a lista vazia, empurrando pro passo que ativa o app (conectar conta). Contextual (só onde faz sentido).
2. **Modal "Take a tour of the app" (centro):** card de **vídeo do YouTube** ("Getting Started with Monarch · Monarch Guides & Updates" · "Assista no YouTube") + copy *"Before you start your Trial, get an in-depth view of Monarch with our Head of Advice & Planning as she goes through everything from setup to tips to personalize for you."* — **tour em vídeo com pessoa real** (Head of Advice), humaniza + ensina no 1º acesso do trial.
3. **Card persistente "What's New" (menu lateral):** "New Reports, Early Retirement Forecasting, and more." + "Learn More" + X pra fechar — changelog/novidades sempre visível.
- **O que roubar:** nudges **contextuais** (não um tour genérico que bloqueia tudo) + **vídeo curto com rosto humano** no 1º uso + card de novidades fechável. Mas cuidado: 2 popups juntos já é **beira do exagero** — no nosso, 1 de cada vez.

## Cash Flow (renda × gasto × poupança no tempo) — feature-assinatura
- **KPIs no topo:** **Income $2.500 · Expenses $2.000 · Total savings $500 · Savings rate 0%** (⭐ **taxa de poupança** = (receita-despesa)/receita — métrica que a gente não tem).
- **Seletor de período:** meses (Apr…Sep) + range.
- **View toggle:** **Bar Chart** (e o **Sankey** que aparece no dashboard — fluxo entrada→saída por categoria; é a imagem-símbolo do Monarch).
- **Agrupar por:** **Category · Group · Merchant** (toggle) — mostra **Income** e **Expenses** quebrados com **% share** por categoria (🗓 Subscriptions 4.1%, 🛍 Shopping 3.8%, etc.).
- **O que roubar:** o **Sankey** (fluxo do dinheiro) + **savings rate** + agrupamento flexível (categoria/grupo/comerciante) com % — é visualização de nível alto. Nosso Relatórios é mais simples; dá pra evoluir pra isso.

## Adicionar conta MANUAL (fluxo completo) ⭐ relevante pro nosso (somos manual-first)
> Gatilho: várias telas (ex.: Budget) **não passam sem ter conta**. O modal "Connect an account" abre com **Banks & credit cards** (busca 13.000+ instituições + bancos populares) e, no rodapé, **"Add manual account"** (o caminho sem agregador — o nosso caso no BR).

### Passo 1 — "Add Manual Account": escolher o TIPO (modelo de NET WORTH, ativo × passivo)
Monarch modela **patrimônio líquido** (ativos − passivos), não só conta bancária. Tipos:
- **Asset (ativos):**
  - 💲 **Cash** (dinheiro/conta)
  - 📈 **Investments**
  - 🏠 **Real Estate** (imóveis)
  - 🚗 **Vehicles** (veículos)
  - 💎 **Valuables** (bens de valor)
  - ➕ **Other Assets**
- **Liability (passivos):**
  - 💳 **Credit Card**
  - 🏦 **Mortgage** (financiamento imobiliário)
  - **Loans** (empréstimos)
  - ➖ **Other Liabilities**
- **O que roubar:** o **modelo de net worth completo** (ativo × passivo) é o que dá o "$708.000 net worth" no dashboard. Nosso app é focado em conta/transação/cartão — pra ter net worth de verdade faltam **imóvel, veículo, investimento, bens** (ativos) e **financiamento/empréstimo** (passivos). Empréstimo a gente já tem módulo; dá pra evoluir pro net worth agregando esses tipos. Categorizar **ativo vs passivo** é a chave.

### Passo 2 — form da conta manual (por tipo)
**Navegação do modal:** cada tipo abre um form; **setinha ← (top-left) volta** pra lista de tipos (Escape fecha o modal INTEIRO). Botões **Cancel / Save** por form. Padrão base: **Name + Type(subtipo) + Balance**; alguns tipos têm campo extra.

| Tipo | Campos | Subtipos (Type) |
|---|---|---|
| **Cash** 💲 | Name + Type + Balance | CD · Checking · Savings · Money Market · **Mobile Payment System** · Prepaid · Cash Management (7) |
| **Investments** 📈 | Name + Type + **Track** + Balance | lista LONGA e **US-específica**: 401a · 401k · 403b · 457b · 529 Plan · Brokerage (Taxable) · ISA-Cash · … (aposentadoria/corretora US) |
| Real Estate 🏠 | Name + Type + Balance | Primary Home · Secondary Home · Rental Property (3) |
| Vehicles 🚗 | Name + Type + Balance | Car · Boat · Motorcycle · Snowmobile · Bicycle · Other (6) |
| Valuables 💎 | Name + Type + Balance | Art · Jewelry · Collectibles · Furniture · Other (5) |
| Other Assets ➕ | Name + Type + Balance | Other (1) |
| Credit Card 💳 | **Name + Balance** (sem subtipo) | — (só nome + saldo devedor) |
| Mortgage 🏦 | **Name + Balance** (sem subtipo, padrão liability) | — |
| Loans | **Name + Balance** (sem subtipo) | — (confirmado) |
| Other Liabilities ➖ | **Name + Balance** (padrão liability) | — |

**Achado do padrão:** **ATIVOS** têm subtipo (Name + **Type** + Balance); **PASSIVOS** (Credit Card/Mortgage/Loans/Other Liab) são **só Name + Balance** (sem subtipo) — o saldo é a dívida. Investments é o único com campo extra (**Track**: manual × detalhado).

- **Campo extra "Track" (Investments):** "Balances manually" (informar saldo à mão) — sugere que a alternativa é rastrear posições (holdings) quando conectado. Bom padrão: deixar o usuário escolher **rastrear saldo manual × detalhado**.
- **Padrão base:** conta manual = pessoa informa e atualiza o saldo à mão (sem sync). É o **mesmo modelo manual-first** que a gente já tem — diferença é a **cobertura de tipos** (eles cobrem patrimônio inteiro; a gente cobre conta/cartão).
- **O que roubar (BR):** "**Mobile Payment System**" (carteira/PIX-like) e "Prepaid" cabem no BR. Ignorar a sopa de tipos de aposentadoria US. Manter o form minimalista (nome + tipo + saldo) + o "Track manual × detalhado" pra investimento.

## Goals (metas) ⭐⭐ resposta deles pro nosso problema de "meta move dinheiro real"
- **Dois tipos:** **Save up** (poupar) e **Pay down** (quitar dívida) — abas.
- **Card de cada meta:** nome · valor atual · **status (On track / At risk / Completed / No target date)** · **data-alvo** (+ "16 months behind" quando atrasado) · **% do alvo**. Ex.: Emergency Fund "At risk · fev/2028 (16 months behind) · 50% of $40,000"; Retirement "No target date · 25% of $2M".
- **⭐ MODELO DE FINANCIAMENTO = ALOCAÇÃO (não contador, não transação):** tem **"$14.000 Available for goals"** e você **aloca** saldo de contas reais pras metas → "Jon's Savings +$5.000", "Melanie's Brokerage +$2.000"… com botões **"Allocate funds"** e **"Edit goal accounts"**. Ou seja: **o dinheiro CONTINUA na conta, mas fica "earmarked" (reservado) pra meta.** É o modelo **envelope/reserva** (a "opção b" que discutimos pro nosso Metas) — resolve a desconexão sem criar transação nem dinheiro fantasma.
- **Projeção:** "recommended contributions" + data de conclusão projetada, com **disclaimer** ("estimates only, not personalized advice").
- **Couple aparece aqui:** as contas alocadas são de **duas pessoas** ("Jon's" + "Melanie's") → household de casal alimentando metas em conjunto.
- **⭐ O QUE ISSO RESOLVE PRO NOSSO (ROADMAP Metas):** nosso `ContribuirAsync` hoje só incrementa um contador fictício (P2 no ROADMAP). O Monarch mostra o caminho: **meta = alocação de saldo real de conta(s)**, com "disponível pra alocar" = saldo não-comprometido. Não precisa gerar transação (o dinheiro não sai da conta) — só marca. Isso casa com casal (aloca de contas de ambos). **Forte candidato pro redesign do nosso Metas.**

## ⏸️ Onde paramos — RETOMAR AQUI (2026-09-20)
**Estado da exploração do app Monarch (tab-2 do browser, trial ativo, conta do Gustavo):**
- ✅ **Já documentado:** navegação/menu, checklist de ativação 0/6, Dashboard (widgets), 2 popups (nudge + vídeo-tour), Transactions, Cash Flow, Goals (⭐ modelo de alocação), Reports (parcial), **Add Manual Account completo** (tabela de todos os 10 tipos + subtipos + padrão ativo/passivo).
- ⏸️ **Parado no meio de:** criar uma conta manual pra fechar o nudge "connect an account" e destravar o app. Form "Add Cash Account" estava aberto com **Name = "Conta Teste Pontes"** preenchido; faltou preencher Balance + Save (parou por classifier temporariamente fora + pedido de ponto verde).
- ▶️ **Retomar assim:** (1) terminar de criar a conta manual (Balance + Save) OU criar do zero via "Add account → Add manual account → Cash → Checking"; (2) com o app destravado, explorar e documentar as seções que faltam: **Budget (detalhe da tabela Planned/Actual/Remaining), Recurring, Investments, Forecasting, Advice, Accounts**, + **AI Assistant**, **notificações (sino)**, **Settings**, upsell "Get 45% discount", "What's New". Capturar popups/modais também.
- **Nav confiável:** `window.location.href='https://app.monarch.com/<rota>'` via javascript_tool (o `navigate` dropa o path). Rotas: /dashboard /accounts /transactions /cash-flow /reports /plan (Budget) /recurring /goals/savings /investments /forecast /advice.
- **Dica de UI:** no modal de conta, subtipos aparecem como `menuitem` (não `option`); a setinha **← (Back)** volta pra lista de tipos; **Escape fecha o modal inteiro** (evitar). Cliques por coordenada desalinham (viewport escalado) — usar refs de `find`/`read_page`.

<!-- próximas seções (Budget detalhe, Recurring, Investments, Forecasting, Advice, Accounts, AI, Settings) entram aqui -->

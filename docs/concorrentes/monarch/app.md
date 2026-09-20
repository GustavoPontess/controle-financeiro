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

### Passo 2 — form da conta manual (ex.: "Add Cash Account")
Form curto de 3 campos:
- **Name** (texto, placeholder "My Cash Account")
- **Type** (dropdown de **subtipo**) — pra Cash: **CD · Checking · Savings · Money Market · Mobile Payment System · Prepaid · Cash Management** (7 opções).
- **Balance** (dinheiro, placeholder "$0.00") — saldo atual que a pessoa digita.
- Botões **Cancel / Save**. (Back/Close no topo do modal.)
- **Padrão:** cada TIPO (Cash/Investments/Real Estate/Credit Card/Loan…) abre um form curto **Name + subtipo + valor/saldo**. Conta manual = pessoa informa e atualiza o saldo à mão (sem sync). É **exatamente o modelo manual-first** que a gente já tem — a diferença é a **cobertura de tipos** (eles cobrem patrimônio inteiro, a gente cobre conta/cartão).
- **O que roubar:** o subtipo "**Mobile Payment System**" (carteira/PIX-like) e "Prepaid" cabem bem no BR. E o form minimalista (nome + tipo + saldo) é o padrão certo pra cadastro manual rápido.

<!-- próximas seções (Reports, Goals, Forecasting, Advice, Recurring, Investments, Accounts) entram aqui -->

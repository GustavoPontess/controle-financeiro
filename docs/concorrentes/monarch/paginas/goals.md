# Monarch — **Goals** (`/goals`) ⭐⭐ resposta pro nosso "meta move dinheiro real"

> A feature mais importante pra copiar. Resolve o P2 do nosso Metas (contribuir só incrementa contador fictício) **e** casa com casal.

## Tela principal (`/goals/savings`)
- Abas: **Save up** (poupar) · **Pay down** (quitar dívida).
- Topo: **Manage · Allocate funds · Add goal**.
- Lista de cards de meta: imagem · **nome** · **status** (On track / At risk / Completed) · barra de progresso.
- Rodapé com **disclaimer legal**: *"Estimates only, not guarantees or personalized investment, tax or financial advice. Projected completion dates and recommended contributions depend on your assumptions and may differ materially."* (⚠️ copiar esse tipo de disclaimer — é aconselhamento financeiro, tem risco regulatório; ver [[feedback_baseline_seguranca_qualidade]] e CONFORMIDADE_BR).

## Wizard de criação (5 telas) — `Add goal`
Barra de progresso: **Select → Targets → Contribution → Budget → (complete)**.

### 1. Select — tipo da meta
Presets com imagem: **Emergency fund · Down payment · Car · Vacation · Wedding · Education · Retirement · Custom**. (Emergency fund e Down payment têm comportamento especial — ver toggles.)

### 2. Targets — alvo
- **Foto** (Customize photo) — cada meta tem imagem (stock ou custom).
- **Name**.
- **Target amount** (opcional) — se vazio, meta é "no target" (só acumula).
- **Target date** (opcional) — **dois selects: mês + ano**. ⚠️ **fica desabilitado até ter Target amount** ("Target amount required").
- Toggle **"Spending reduces goal progress"** — "marcar transação como gasta de uma meta diminui o progresso; útil pra emergency fund". Liga com o campo **"Spend from save up goal"** do form de transação.

### 3. Contribution — "Add funds you have already saved" (head start)
- **Select account** (agrupado por classe: Cash, etc).
- Ao escolher conta: mostra **Current balance** + campo **Amount** (quanto alocar pra meta) + checkbox **"Use entire balance and account growth towards this goal"** + **"Available to contribute $X"** (saldo − já alocado).
- ⭐ **ALOCAÇÃO:** o dinheiro **continua na conta**; você só **marca** quanto daquele saldo está reservado pra meta. Modelo envelope/earmark. Não cria transação, não cria dinheiro fantasma.

### 4. Budget — contribuição mensal planejada
- "How much of your monthly income do you plan to contribute to your goals?"
- **Monthly planned contributions: $X** (agregado de todas as metas).
- Por meta: **General contribution 100% $X** — "$Y/mo. needed from any account(s)".

### 5. Complete — "Congrats! You're on your way."

## ⭐ Fórmula do "meta por DATA → impacto" (o que o Gustavo quer no nosso)
Dado **target amount**, **target date** e **já poupado (alocado)**:

```
meses_ate_data       = diff(target_date, hoje)   // ex.: set/2026 → dez/2027 ≈ 16 meses
contribuicao_mensal  = (target_amount − ja_poupado) / meses_ate_data
status               = plano_mensal >= contribuicao_mensal ? "On track" : "At risk"
```

**Provado ao vivo:**
- $60.000 alvo, dez/2027 (~16 meses), $0 poupado → **Est. $3.750/mo**.
- Aloquei $2.000 de head-start → **needed $3.625/mo** = ($60.000 − $2.000) / 16.
- Status virou **On track** (barra de progresso mostra $2.000 / $60.000).

Ou seja: **muda a data → muda a mensalidade necessária**; **aloca mais agora → cai a mensalidade**. Simples e é exatamente o "quero comprar casa ano que vem, quanto preciso guardar / dá pra chegar?".

## Modelo de dados (allocation) — como fazer no nosso
- Meta: `Id, Nome, TipoMeta(SaveUp/PayDown), ValorAlvo?, DataAlvo?, Imagem, SpendingReduces:bool`.
- **Alocação** (nova entidade): `MetaAlocacao { MetaId, ContaId, Valor, UseEntireBalance:bool }` — liga meta ↔ conta com valor reservado. **`Available to contribute` de uma conta = Saldo − Σ alocações daquela conta.**
- Cálculo (sem transação): `progresso = Σ alocações da meta`; `mensal_necessaria = (alvo − progresso) / meses`; `status` por comparação com contribuição planejada.
- **Casal:** alocações podem vir de contas de **pessoas diferentes** do household → meta conjunta (Monarch faz isso). Casa com nosso fosso família ([[feedback_copy_sensivel_casal]]).
- **Transação ↔ meta:** o form de transação já tem "Contribute/Link/Spend to goal" → uma transação pode ajustar a alocação (ex.: gastei da reserva → reduz progresso quando `SpendingReduces=on`).

## Prós/contra vs. nosso modelo atual
| | Monarch (alocação) | Nosso hoje |
|---|---|---|
| Dinheiro sai da conta? | Não (earmark) | Contador fictício (não conectado) ❌ |
| Progresso vem de | Σ alocações reais | incremento manual sem lastro |
| "meta por data" | ✅ calcula mensalidade | ❌ |
| Casal | ✅ contas de ambos | ❌ |
| Disclaimer legal | ✅ tem | ❌ (adicionar) |

## ⭐ Goal detail page (`/goals/{id}`) — os 2 gráficos que o Gustavo quer
Header: imagem hero (Customize image) + card (status · data · $atual · % do alvo) + **Manage · Allocate funds**.

**4 stat cards:** `Total saved` · `Total spent` · `Available to spend` · `Left to save` (alvo − poupado).

**Gráfico (2 abas):**
1. **Timeline** — trajetória cumulativa:
   - X = mês a mês da criação até a **target date** (ex.: Set/2026 → Dez/2027).
   - **Linha roxa sólida** horizontal = **target amount** ($60K).
   - **Linha tracejada diagonal** = **trajetória de poupança projetada** (começa no já-alocado $2.000 e sobe até tocar o alvo na data). Legenda: Savings (verde) / Spending (cinza).
   - = visualização de "meta por data → o caminho pra chegar". Conforme você aloca/contribui, a linha real acompanha (ou não) a projetada.
2. **Contributions** — aporte mensal:
   - **Linha tracejada "Budget $3.750"** = contribuição mensal planejada.
   - **Barras por mês** + **✓ check-off** por mês (marcou se contribuiu naquele mês). Dividido por ano (←2026 | 2027→).

**Abaixo:** `Activity` (lista; alocação aparece como "Contribution +$X"; toggle "Show adjustments") · `Allocation` (contas alocadas + Allocate funds) · `Details` (Edit — configs da meta).

### Como fazer no nosso (stack)
- `recharts LineChart`: `ReferenceLine y={alvo}` (linha do alvo) + série tracejada projetada (`strokeDasharray`) calculada por interpolação linear (alocado → alvo em N meses). Já usamos recharts.
- Contributions: `recharts BarChart` + `ReferenceLine y={budgetMensal}` + ícone ✓ por mês (mês tem contribuição >0).
- Backend: endpoint `GET /metas/{id}/projecao` devolve pontos (mês → saldo projetado, saldo real) + budget mensal. Cálculo é a fórmula acima; nada de IA.

## Painel lateral "$X Available for goals"
Na lista de Goals: **"$X Available for goals"** = Σ (saldo das contas − alocações). Expande por conta. Botões **Allocate funds** (realocar) e **Edit goal accounts**. É o "não-comprometido" — quanto ainda dá pra reservar.

## Allocate funds (realocar) + Manage
- **Allocate funds** (modal): **From** (conta OU meta) → **To** (conta OU meta) · **Amount** · **Date** · toggle **"Include in budget"** (a alocação entra nos actuals do orçamento). = **transferir earmark** entre conta↔meta↔meta, datado. Confirma o modelo: alocação é movível, não um lançamento fixo.
- **Manage** (dropdown): **Edit goal accounts** (quais contas alimentam as metas) · **Reconciliation history** (auditoria das alocações — histórico de reconciliação).
- Painel lateral "**$X Available for goals**" (não-comprometido) + **Allocate funds** + **Edit goal accounts**.

## Pay down (metas de dívida) — `/goals/debt-paydown`
- Aba irmã do Save up. **Data-driven das contas de dívida** (não é alvo manual).
- **4 KPIs:** Current Debt Principal · **Projected Interest** · Total Principal & Interest · **Debt Free Date** (projeção de quitação).
- **Overview chart** (abas **Timeline** / **Principal & Interest**).
- Conecta **contas de passivo** (Add account); "No debt accounts" = "parabéns, sem dívida".
- → No nosso: liga com módulo de **Empréstimo** que já temos (projetar quitação + juros + data livre-de-dívida = feature de alto valor, avatar de "sair das dívidas").

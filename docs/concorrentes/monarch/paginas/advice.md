# Monarch — **Advice** (`/advice`) ⚠️ SENDO DESCONTINUADO

> ⚠️ **Sinal estratégico:** banner no topo — *"The Advice page is going away on **September 28th** to make room for what's next. Save anything you'd like to reference before then."* Monarch está **matando o Advice** — provavelmente substituindo pela **AI Assistant** (conselho estático → conversacional). **Lição pro nosso produto:** não investir pesado num motor de "advice" estático em cards; o mercado (líder) está migrando pra assistente de IA.

## O que era (enquanto existe)
Motor de **recomendações/educação guiada** em cards, agrupado por categoria.

- **Recommendations "Prioritized by you"** (Edit — usuário reordena prioridade). Cada card:
  - Tag: **SPEND / SAVE / PAY DOWN / INVEST**.
  - Título + descrição educativa. Ex.: "Buy a home — Buying a home is a big goal for many people… figure out how much you might be able to…".
  - Status: **NOT STARTED · N TASKS TO COMPLETE** (checklist de tarefas por recomendação).
  - Exemplos: Track cash flow · Buy a home · Pay off student loans · Save for college · Save up an emergency fund.
- **Categories** (lateral): Recommendations · Save up · Spend · Pay down · Protect · Invest · Wellness.
- Onboarding: **"Get personalized advice by answering a few questions — We'll provide guidance on how to prioritize and make progress on your finances."** (questionário → prioriza recomendações).

## Questionário de advice personalizado ("Resume / Get personalized advice")
Fluxo de intake que prioriza as recomendações (persona + assessment de prontidão):
- **Persona:** "Natalie, **CFP® (Certified Financial Planner) + BFA™ (Behavioral Financial Advisor)**" com foto. Claim de **padrão fiduciário**: *"committed to looking out for your best interests… advice will never be used to sell you something you don't need."* (posicionamento anti-conflito-de-interesse).
- **Q1 — "What is most important to you?"** (multi-select): Buy a home · Buy a car · **Grow our family** · Have the right insurance · Improve credit score · Manage a budget · Pay off student loans / credit card / high-interest / low-interest debt · Pay off mortgage · Save for emergencies · Save for college · Save for retirement · None of the above. (+ "I don't know").
- **7 perguntas no total** (respondi todas):
  1. **"What is most important to you?"** (multi) — as prioridades/metas (lista acima).
  2. **"Were you able to connect all your finances in Monarch?"** (Yes/No).
  3. **"Have you set up a budget in Monarch?"** (Yes/No).
  4. **"Have you checked your credit reports in the past 12 months?"** (👍/👎).
  5. **"Do you have any of these types of debt?"** (multi): cartão não quitado · student loans · mortgage · car loan · outros ≥10% · outros <10% · None.
  6. **"Which types of insurance do you have?"** (multi): Health · Disability · Life · Homeowners/renters · Car · Umbrella · None.
  7. **"Do you have any of these in place?"** (multi, sucessório): Beneficiaries em todas as contas · Health care directive (living will) · Power of attorney · Last will · None.
- Cada pergunta tem **"I don't know"** + **Save & Exit** (retoma depois — botão "Resume").
- Ao terminar, **processa**: "Reviewing your answers → Analyzing your financial data → Building personalized advice → Prioritizing advice → Wrapping up your plan".

### Plano gerado (output)
- **"Prioritized by you"** — recomendações das prioridades escolhidas (ex.: escolhi "Buy a home" → card **Buy a home** aparece no topo).
- **"Essential advice"** — baseline pelos gaps de prontidão: **Review cash flow setup** (7 tasks) · **Save up an emergency fund** (6) · **Review health insurance** (10)…
- **Categorias** (lateral): Recommendations · Save up · Spend · Pay down · Protect · Invest · Wellness.
- Botão **Update profile** (refaz o questionário).

### Anatomia de uma recomendação (ex.: "Buy a home", 8 tasks)
- Descrição educativa.
- **"Essentials recommended"** = grafo de **pré-requisitos** ("complete estes antes pra ter base sólida"): Save for retirement · Review health insurance · Review homeowners/renters insurance · Review car insurance · **View all 10** (com barra de progresso de cada).
- **Tasks** (checklist marcável): 1) Decide if you should rent vs buy · 2) Check your credit score · 3) Decide how much home you can afford · 4) **Create a goal for your down payment** · 5) **Schedule automated transfers** · 6) Review mortgages · 7) Get pre-approved for a mortgage · 8) Buy a home.
- ⭐ As tasks **orquestram as outras features** (task 4 → Goals; task 5 → recorrente/alocação). Advice era a "capa" que amarrava Goals+Budget+Recurring num plano guiado — função que migra pra **IA**.

**Leitura:** é um **assessment de bem-estar financeiro** (metas desejadas × prontidão real) que gera um plano priorizado. As perguntas revelam as áreas que eles consideram "saúde financeira": contas conectadas, orçamento, crédito, reserva, dívida, seguro, aposentadoria, filhos/casa. **Reaproveitar como input do nosso onboarding/IA** (não como página de cards). "Grow our family" + household = gancho casal.

## Leitura pro nosso produto
- **Não copiar o Advice estático** — o próprio Monarch abandonou. 
- A **estrutura de categorias** (Save/Spend/Pay down/Protect/Invest/Wellness) e o **questionário de priorização** são reaproveitáveis como *input* pra um assistente/onboarding, não como página de cards.
- Direção validada: **assistente de IA conversacional > cards de conselho**. Ver [ai-assistant](./ai-assistant.md). Casar com nosso eixo casal (conselho pra o casal, não só individual).

# Onboarding do Monarch — captura do fluxo de entrada

> Fluxo de entrada do Monarch (app.monarch.com), capturado em 2026-09-20, pra inspirar o **nosso** onboarding.
> Prints ficam em `docs/referencias/monarch/` (gitignored) quando salvos manualmente do pane.
> Entrada: e-mail → **código de verificação por e-mail** → sequência de perguntas com **barra de progresso** no topo.

---

## Padrões gerais (o que o Monarch acerta)
- **Barra de progresso** fina no topo (laranja) durante todo o onboarding — mostra que tem N passos e onde você está. Corta a ansiedade de "quanto falta".
- **Uma pergunta por tela**, centralizada: título grande + subtítulo curto com o *porquê* ("...and we'll help you achieve them in Monarch").
- Botão primário único **"Continue"** laranja, largo, embaixo. Zero distração.
- Só o **logo** no topo durante o onboarding — sem navbar completa. Foco total no passo.
- Copy na **1ª pessoa do usuário** ("Track **my** investments", "Manage **my** budget") — soa como as metas dele, não como lista de features nossa.
- **Verificação de e-mail por código** logo na entrada (antes do onboarding), então a conta já nasce com e-mail confirmado.

---

## Passo 0 — Cadastro + verificação de e-mail (ANTES do onboarding)
_(Descrito pelo Gustavo — essas telas passam antes da tela 1; não recapturadas porque exigem criar conta nova.)_
- **0a — Pede o e-mail:** tela pede só o **e-mail** pra começar (sem senha ainda). Fricção mínima na entrada.
- **0b — Confirma o e-mail por código:** manda um **código pro e-mail** e pede pra digitar (verificação antes de entrar). Só depois de confirmar é que cai no onboarding (tela 1).
- **Padrão:** e-mail primeiro → **código de verificação** → onboarding. A conta já nasce com **e-mail confirmado** (nada de "confirme depois"), e o cadastro é progressivo (pede o mínimo pra começar, o resto vem no onboarding).
- **O que roubar pro nosso:** cadastro em etapas (e-mail → verifica → resto), verificação de e-mail logo de cara (garante e-mail válido + reduz conta fake), fricção baixa no 1º passo. _Atenção segurança: código com TTL curto, uso único, teto de tentativas — a gente já tem esse padrão (`EmailOtpService`)._

## Tela 1 — "What brings you to Monarch?" (prioridades/metas)
- **Pede:** selecionar as prioridades financeiras (multi-select, checkbox).
- **Subtítulo:** "Select your financial priorities below and we'll help you achieve them in Monarch."
- **Opções (2 colunas, pílulas com ícone):**
  - Track income and spending
  - View all my finances in one place
  - Manage my budget
  - Save up for a goal
  - Track my investments
  - Pay down my debt
  - Forecast my finances
  - Other (…)
- **UX:** pílulas em outline laranja claro; "Other" destacado em branco. CTA "Continue". Barra de progresso no topo.
- **O que roubar pro nosso:** abrir perguntando a **intenção** (o que quer resolver) antes de pedir qualquer dado — o app personaliza o resto e a pessoa já se compromete. No nosso, casar com o fosso casal/família: opções tipo "Organizar as contas do casal", "Dividir despesas", "Acompanhar metas juntos", além das clássicas (gastos, orçamento, dívidas, metas).

---

## Tela 2 — "Tell us about your financial landscape" (o que a pessoa tem)
- **Pede:** marcar tudo que se aplica (multi-select) — tipos de conta/ativo/renda.
- **Subtítulo:** "Select everything that applies. We'll use this to tailor your dashboard, goals, and recommendations."
- **Opções (2 colunas, pílulas com ícone):** Checking · Credit cards · Investments · Real estate · Loans · Crypto · Equity · Business income · Other.
- **UX:** aparece o **← voltar** no topo (dá pra corrigir passo anterior sem perder progresso); barra de progresso ~metade.
- **O que roubar pro nosso:** perguntar o "landscape" ANTES de conectar/cadastrar qualquer coisa serve pra **montar o dashboard só com o que importa** pra pessoa (quem não tem cripto/investimento não vê esses cards). No nosso, dá pra usar isso pra ligar/desligar módulos (cartão, empréstimo, investimento) e não poluir a tela inicial. Também alimenta o setup guiado ("você marcou Cartões → vamos cadastrar seu 1º cartão").

## Tela 3 — interstitial de valor "See every dollar without the spreadsheet"
- **Não pede nada** — é uma tela de **reassurance/value prop** no MEIO do onboarding.
- **Copy:** título "See every dollar without the spreadsheet." + "Monarch pulls in your transactions and categorizes them automatically. Always know where your money is and where it's going."
- **Visual:** print real do produto (relatório de **Cash Flow / Sankey** mostrando dinheiro entrando→saindo por categoria). Só botão "Continue".
- **Padrão:** intercalar telas de valor entre as de coleta de dado — quebra a monotonia do formulário, lembra a pessoa do que ela ganha, e usa **screenshot do próprio produto** como prova. O título ("...without the spreadsheet") ataca a dor do concorrente real (planilha).
- **O que roubar pro nosso:** 1-2 interstitials assim entre os passos, com print de uma tela nossa forte (ex.: o dashboard de casal / rateio) + copy atacando a dor ("Chega de brigar sobre dinheiro / de planilha compartilhada bagunçada").

## Tela 4 — "How did you hear about Monarch?" (atribuição de marketing)
- **Pede:** de onde a pessoa conheceu (single-select) + campo de texto livre. Tem **"Skip"** (opcional).
- **Opções:** Podcast · TikTok · YouTube · TV/Streaming · Reddit · Article or Website · Facebook/Instagram · Google or Bing · Friend or Family · **AI (ChatGPT, Gemini, etc)** · Other.
- **UX:** pílulas em 2 colunas; "Skip" no topo direito (não força resposta); barra de progresso avança.
- **O que roubar pro nosso:** capturar **canal de aquisição** no onboarding é ouro pra saber o que traz usuário (e onde investir). Detalhe moderno: **"AI (ChatGPT, Gemini)"** já é um canal — vale ter. É pergunta de negócio (não ajuda o usuário), então deixar **opcional (Skip)** é correto — não travar quem só quer entrar.

## Tela 5 — "Privacy and security" (confiança, antes de conectar banco)
- **Não pede nada** — interstitial de **confiança** posicionado logo ANTES do passo de conectar conta bancária.
- **Copy (título + 3 bullets):**
  - "Your information stays private and protected"
  - "Login details are never stored and bank access is read-only"
  - "Monarch is privacy-first and ad-free"
  - "All data is encrypted and protected using bank-level security measures"
- **Padrão:** derrubar o medo de segurança **exatamente antes** de pedir pra ligar o banco (o momento de maior ansiedade). "read-only", "never stored", "bank-level", "ad-free" — cada frase mata uma objeção.
- **O que roubar pro nosso:** quando a gente for pedir Open Finance / conectar conta, pôr uma tela dessas ANTES, com a copy certa (leitura apenas, criptografado, sem anúncio, LGPD). No manual (sem Open Finance) não precisa, mas quando ligar agregador, é essencial.

## Tela 6 — "Tell us about yourself" (perfil pessoal) ⭐ chave pro nosso fosso
- **Pede:** dados pessoais pra personalizar.
- **Subtítulo:** "Share a few more details about your personal situation so we can tailor your experience."
- **Campos:**
  - **Full name** (texto)
  - **Country** (dropdown, 🇺🇸 default)
  - **"Do you manage your finances with a partner?"** → Yes / No ⭐
  - **"Do you work with a financial professional?"** → Yes / No (gancho contador/B2B)
  - **"Do you have side income or own a business?"** → Yes / No (gancho PJ)
  - Continue
- **⭐ O QUE MAIS IMPORTA PRO NOSSO:** o Monarch pergunta **"gerencia as finanças com um parceiro(a)?"** logo no onboarding — é exatamente o nosso **fosso (casal/família)**, e eles tratam como sim/não simples. Isso valida o mercado. **No nosso isso não pode ser um sim/não escondido — é o CORAÇÃO.** Se "sim" → puxar o fluxo de casal (convidar parceiro, escolher modo de rateio, contas compartilhadas) já no onboarding. As outras duas perguntas (profissional financeiro / renda PJ) são os ganchos **contador** e **PJ** que já estão no nosso roadmap (Lote 4).
- **Padrão:** agrupar várias perguntas sim/não numa tela só (aqui pode, porque são rápidas e relacionadas — contraria o "1 pergunta por tela", mas faz sentido pra dados de perfil).

---

## Tela 7 — "How your free trial works" (paywall / trial)
- **Vende o trial** antes de pedir cartão. Título "Try Monarch for free" + "You won't be charged anything today".
- **3 blocos com emoji:**
  - 🎉 **Jump right in** — "Connect your accounts today and start getting insights in minutes."
  - ⭐️ **Get a new level of clarity** — "Monarch helps you save more, stress less and reach your goals."
  - 💰 **We've got your back** — "Try Monarch risk-free. Cancel anytime with our money-back guarantee."
- **Checkbox (⭐ sacada):** "Email me a reminder before my trial ends so I can cancel if Monarch isn't the right fit." — Monarch **oferece o lembrete pra cancelar**. Contra-intuitivo, mas aumenta conversão: tira o medo de "esquecer e ser cobrado", então mais gente aceita o trial.
- **UX:** Monarch é **pago** (sem tier grátis real) — o trial é a porta. O paywall vem DEPOIS de todo o onboarding de perguntas (a pessoa já investiu tempo/dados → mais propensa a converter). "Continue" leva pra **escolha de plano** (tela 8), não direto pro cartão.
- **O que roubar pro nosso:** o **lembrete-de-cancelamento** é uma jogada de confiança forte (mesmo que a gente tenha tier grátis). E a ordem "engaja primeiro (perguntas + valor), cobra por último" é o padrão. _Nota: nosso modelo é grátis-manual / pago-integração (ver `emprestimo-bancario/regras.md`), então o paywall nosso seria só pra features premium, não pra entrar._

---

## Tela 8 — "Choose your plan" (planos e PREÇOS) 💰
- **Compara 2 planos** (Core × Plus), billing **anual** (é o que a tela mostra por padrão; não achei toggle mensal explícito). Ambos com **"Try for $0.00"** (trial).
- **Copy topo:** "Choose your plan" / "Compare our Core and Plus plans to find the right fit for you".

### CORE — "Budget, save, and stay on track"
- **Preço (tem dropdown Mensal/Anual no card):**
  - **Mensal:** **US$ 14,99/mês**
  - **Anual:** **US$ 99,99/ano** (= US$ 8,33/mês) — selo **"Save $79"** (economiza ~US$80/ano vs. mensal; 14,99×12 = 179,88)
- CTA: **Try for $0.00**
- **Inclui:**
  - See your complete net worth (patrimônio total)
  - Build a budget that fits your life (orçamento)
  - Visualize your money with custom reports (relatórios custom)
  - Set and track savings and debt goals (metas de poupança/dívida)

### PLUS — "Advanced tools for long-term planning and multiple income streams" — **RECOMMENDED FOR YOU**
- **Preço:** **US$ 199,99/ano** (= US$ 16,67/mês). ⚠️ **O card do Plus NÃO tem dropdown de mensal** — só mostra anual (o Core tem os dois). Monarch **empurra anual no tier premium** (não deixa nem ver o mensal aqui).
- CTA: **Try for $0.00**
- **Everything in Core, plus:**
  - Forecast your path to retirement (projeção de aposentadoria)
  - Track business income and expenses (renda/despesa PJ)
  - Get P&L reports and tax-prep exports (DRE + export pra imposto)
  - Access advanced investment analysis (análise de investimento avançada)
  - Create a will to protect what you've built (testamento)

### Leitura de negócio
- **Sem tier grátis** — Monarch é 100% pago, trial como porta. Core ~R$500/ano, Plus ~R$1.000/ano (câmbio ~5). **Caro pro Brasil** — abre espaço pro nosso posicionamento (grátis-manual / pago-integração).
- **Ancoragem:** mostram "Save $79" (anual vs mensal) e marcam o Plus como "RECOMMENDED FOR YOU" (empurra pro mais caro).
- **Segmentação Plus = nossos Lotes futuros:** PJ (renda/despesa/DRE/imposto) + investimento avançado + aposentadoria. Confirma que esses são recursos "premium" cobráveis.
- **O que roubar:** o Plus valida que **PJ/contador e planejamento de longo prazo** são o que a galera paga a mais. No nosso, casal/família + Open Finance seriam os candidatos a premium.

---

## Tela 9 — Checkout / "Select a plan" (pagamento do trial) 💳
- **Confirmei ao vivo:** depois de "Try for $0.00" vai pra esta tela de **checkout** (não conectar banco). Layout 2 colunas: **argumentos de confiança** à esquerda + **pagamento (Stripe)** à direita.
- **Topo personalizado:** "**Gustavo, Experience Monarch today**" (usa o 1º nome).
- **Prova social no momento do pagamento:** "**4.9 stars on App Store (100K+ reviews)**".
- **Bullets de confiança (matam objeção bem na hora de pagar):**
  - "Cancel anytime, no pressure or hassle"
  - "We'll remind you before your trial ends"
  - "Not for you? Get a refund for the unused time"
  - "Easily track your trial days in your dashboard"
- **Método de pagamento (MPE):** **cartão de crédito via Stripe**. Um único campo "Número do cartão" (expande pra validade/CVC) + botão verde **"Usar"** = **Stripe Link** (checkout 1-clique com cartão salvo do Link). "Powered by Stripe".
  - ⚠️ **SÓ cartão** — **sem** Apple Pay / Google Pay / PIX / boleto. Produto US, preço em USD, público americano.
  - Tem **"Add a promo code"** (cupom).
  - **O que isso diz pro nosso:** Stripe é o processador (bom pra a gente também). MAS pro **Brasil** o método deles é fraco/inaplicável — **PIX e boleto são obrigatórios** aqui. Isso é uma **brecha nossa**: cobrar em BRL com PIX/cartão/boleto (Stripe BR ou Pagar.me/Iugu/Asaas) já é vantagem local sobre o Monarch.
- **Resumo do trial (transparência total):**
  - Your plan: **Core (Monthly)**
  - Today's total: **$0.00**
  - After trial: **$14.99**
  - (Billed **Sep 27, 2026**) — trial de **7 dias**, mostra a data exata da cobrança
  - CTA: **"Start your free 7-day trial"**
- **O que roubar pro nosso:** pôr **prova social + bullets de confiança do lado do pagamento** (não numa tela separada), **mostrar a data exata da 1ª cobrança** (transparência que reduz chargeback/raiva), **Stripe** pra pagamento, **campo de promo code**, e o **lembrete de cancelamento** repetido aqui. Personalizar com o 1º nome.

---

## ⛔ Onde parei (zona proibida)
Cheguei no **checkout** (tela 9). O único passo que falta é **digitar o cartão** e clicar "Start your free 7-day trial" — **não faço** (dado de pagamento). O **onboarding + funil de conversão inteiro** (cadastro → 6 perguntas/valor → trial → planos → checkout) está todo capturado acima.

---

## 🎯 Síntese — como fazer o NOSSO onboarding (destilado do Monarch)
1. **Cadastro progressivo:** e-mail → código de verificação → onboarding. Pede o mínimo pra começar.
2. **Barra de progresso** + **1 pergunta por tela** + **← voltar** + CTA único. Foco total, baixa ansiedade.
3. **Começar pela intenção** ("o que te traz aqui?") — inclui opções de casal/família (nosso diferencial).
4. **Perguntar o "landscape"** (o que a pessoa tem) pra montar o dashboard só com o que importa / ligar-desligar módulos.
5. **Perfil pessoal** com a pergunta-chave **"gerencia com parceiro(a)?"** → se sim, **puxar o fluxo de casal no onboarding** (convite + rateio). Ganchos contador/PJ também.
6. **Interstitials de valor** (2-3) entre as perguntas, com print de tela nossa forte + copy atacando a dor ("chega de planilha / de brigar sobre dinheiro").
7. **Tela de confiança/segurança** ANTES de pedir Open Finance (leitura apenas, criptografado, LGPD, sem anúncio).
8. Copy na **1ª pessoa do usuário** ("minhas metas", "nossas contas").


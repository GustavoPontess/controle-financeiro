# Onboarding do Monarch — captura do fluxo de entrada

> Fluxo de entrada do Monarch (app.monarch.com), capturado em 2026-09-20, pra inspirar o **nosso** onboarding.
> Prints ficam em `docs/referencias/monarch/` (gitignored) quando salvos manualmente do pane.
> Entrada: e-mail → **código de verificação por e-mail** → sequência de perguntas com **barra de progresso** no topo.

---

## 🎯 Tese (por que documentar isso)
**Nenhum concorrente brasileiro tem o nível de software do Monarch.** O Monarch é a **barra de qualidade** — onboarding polido, sem fricção, cada detalhe pensado (progresso, 1 pergunta por tela, interstitials de valor, prova social no lugar certo, transparência de cobrança, personalização com nome). Os apps BR (Mobills, Organizze, Minhas Economias, etc.) ficam MUITO atrás dessa régua de produto/UX.

**A oportunidade do Pontes:** ser o **1º produto BR nesse nível de software** — e com **fosso mais fundo** que o próprio Monarch:
1. **Casal/família de verdade** — Monarch só "junta a visão"; a gente resolve **rateio (quem paga o quê) + acerto (quem deve a quem) + papéis + dependentes** (a treta real do dinheiro do casal BR).
2. **Local:** pagamento em BRL (PIX/boleto, não só cartão) + **Open Finance BR** (o agregador deles é US-only, 0 banco BR).

Ou seja: **igualar a régua de software deles + ganhar no que é BR e no fosso casal.** Este doc existe pra a gente **mirar nessa régua**, não pra copiar features soltas.

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

## Nota de pagamento
No checkout (tela 9) **eu não digitei o cartão** (dado de pagamento — não faço). **O Gustavo iniciou o trial** e seguimos capturando o **pós-pagamento** (telas 10-13, abaixo). O único passo que EU não executo é conectar banco (credencial) — parei no seletor de instituições (tela 13).

---

## Depois do pagamento (Gustavo assinou o trial — capturando o app)
_(O Gustavo digitou o cartão e iniciou o trial; eu não fiz o pagamento. Daqui em diante é o 1º contato com o produto pago.)_

### Tela 10 — "Welcome to Monarch!" (boas-vindas + depoimentos, pós-pagamento)
- **Copy:** "Welcome to Monarch! You now have one of the best tools to help make your money work harder for you. Here is what a few other people have said about Monarch:"
- **6 depoimentos** com nome (Paul W., Aaron V., Miten M., Joshua W., themidnighteagle, Stephen C.) — prova social forte, incluindo **ataque a concorrente**: _"I tried YNAB, I tried Mint, I use Monarch. Soooo much more intuitive..."_ e _"no ads and no unwanted advisors calling me"_.
- Botão **Continue**.
- **Padrão:** logo APÓS pagar, uma tela de **reforço da decisão** (reduz arrependimento de comprador) com depoimentos reais. Não pede nada — só valida a escolha.
- **O que roubar pro nosso:** tela de boas-vindas pós-conversão com depoimentos (quando tivermos) + reforço do diferencial. No começo, sem depoimentos, dá pra usar reforço do valor ("agora vocês dois veem tudo no mesmo lugar").

### Tela 11 — "Invite your partner" (CASAL/HOUSEHOLD) ⭐⭐⭐ o nosso fosso, do jeito deles
- **Título:** "Invite your partner to join your household for free"
- **Sub:** "They'll receive a secure login and can connect their accounts, helping you both stay in sync with your money—together."
- **Campo:** Partner's email. Botões: **Continue** + **Skip for now** (opcional).
- **3 bullets de valor (a copy do modelo de casal deles):**
  - **"One place for yours, mine, and ours"** — Bring separate and shared accounts together into one clear view.
  - **"See your finances, solo and together"** — Switch between personal and shared views of spending, net worth, and more.
  - **"Reach your goals as a team"** — Track progress on shared goals and grow your net worth together.
- **Modelo de casal do Monarch (o que dá pra extrair):**
  - Conceito de **"household"** (lar) — você convida o parceiro **de graça**.
  - Parceiro recebe **login próprio e seguro** e **conecta as contas dele** (cada um tem sua conta, não é senha compartilhada).
  - **Views separadas: pessoal × compartilhada** ("solo and together") — dá pra ver só o seu OU o de vocês, alternando.
  - **"yours, mine, and ours"** — contas separadas + compartilhadas num só lugar.
  - **Metas compartilhadas** + patrimônio do casal juntos.
  - Posicionado **logo após o pagamento/boas-vindas** (destaque máximo), mas com **"Skip for now"** (não obriga).
- **⭐ ONDE A GENTE GANHA (nosso fosso é MAIS fundo):** o Monarch para em "junta as contas + view solo/junto + metas". **O que eles NÃO têm e é o nosso diferencial BR:** **rateio explícito "quem paga o quê"** (50/50, %, valor fixo), **acerto de contas** ("quem deve a quem", a acertar/a receber — [[feedback_copy_sensivel_casal]]), **papéis/permissões** na família, **dependentes**. O Monarch valida o mercado (casal é passo #1 pós-pagamento), mas trata como "visão compartilhada"; a gente resolve a **treta real do dinheiro do casal** (divisão + acerto), não só juntar a visão.
- **O que roubar direto:** o convite por e-mail com **login próprio pro parceiro** (não senha compartilhada), a ideia **"yours/mine/ours"** com **toggle pessoal↔compartilhado**, e pôr o convite de parceiro **cedo e com destaque** no onboarding (mas opcional/Skip).

### Tela 12 — priming pra conectar ("Start feeling in control now")
- **Copy:** "Start feeling in control of your finances now" / "Users who connect their accounts within 10 minutes report a greater sense of financial control."
- Só **Continue**. É um interstitial de **urgência/priming** com estatística, ANTES do connect, pra empurrar a conectar já.
- **O que roubar:** usar um dado/gatilho ("quem conecta em X min sente mais controle") pra reduzir a procrastinação no passo mais importante (conectar/cadastrar contas).

### Tela 13 — "Connect spending account" (agregador — o STOP do walkthrough) 🏦
- **Copy:** "Let's begin by connecting the account where most of your spending happens" + "Securely give Monarch **read-only** access to automatically keep track of your accounts. **We don't sell or share your data.**"
- **UI:** busca **"Search 13,000+ institutions"** + grid de bancos populares: **Chase · Capital One · Wells Fargo · Bank of America · American Express · Citi** (todos **US**). Botão **Skip for now**.
- **Intel:** agregador (tipo Plaid/MX) com **13.000+ instituições**, mas **100% US** — nenhum banco BR. Reforço de segurança bem no passo (read-only + não vende dado). Começa pedindo **a conta onde a pessoa mais gasta** (a mais útil primeiro).
- **⛔ PAREI AQUI:** clicar num banco abre o **login do banco (credencial)** — não faço. O walkthrough do onboarding+app até a conexão está capturado.
- **⭐ BRECHA BR (nossa):** o agregador deles é **US-only**. No Brasil o caminho é **Open Finance** (via Pluggy/Belvo) — nenhum concorrente gringo cobre banco BR. Cadastro manual + Open Finance BR é vantagem local direta.


## 🧩 Mecânica dos campos — por tela (como cada campo funciona)
| Tela | Campo(s) | Tipo / comportamento |
|---|---|---|
| 0a e-mail | E-mail | input de e-mail (só e-mail, **sem senha** nessa etapa) |
| 0b código | Código de verificação | input do código enviado por e-mail (dígitos); confirma → entra |
| 1 prioridades | 8 opções | **checkbox multi-select** (pílulas toggláveis); "Continue" avança **mesmo sem seleção** (observado) |
| 2 landscape | 9 opções | **checkbox multi-select**; **← voltar** disponível; "Continue" |
| 3 value prop | — | sem campo; só "Continue" |
| 4 atribuição | pílulas + texto | **single-select** (pílulas) + **input texto livre** ("How did you hear about us?"); **Skip** (topo dir) + "Continue" |
| 5 segurança | — | sem campo; só "Continue" |
| 6 perfil | Full name / Country / 3× Yes-No | **texto** (nome) + **dropdown** país (default 🇺🇸) + **3 pares Yes/No** (single-select cada) + "Continue" |
| 7 trial explainer | 1 checkbox | checkbox "email me a reminder before trial ends" + "Continue" |
| 8 planos | dropdown billing + CTAs | **dropdown Annual/Monthly** (só no card Core; **troca o preço na hora**), "See more" expande features, **"Try for $0.00"** por card |
| 9 checkout | cartão (Stripe) / promo | **campo Stripe em iframe** ("Número do cartão" → expande validade/CVC) + botão **"Usar" (Stripe Link)** + link "Add a promo code" + "Start your free 7-day trial" |
| 10 welcome | — | sem campo; depoimentos + "Continue" |
| 11 parceiro | E-mail do parceiro | **input e-mail** ("Partner's email") + "Continue" + **"Skip for now"** |
| 12 priming | — | sem campo; "Continue" |
| 13 conectar | busca + bancos | **input de busca live** ("Search 13,000+ institutions", filtra conforme digita) + **botões quick-pick** de banco + "Skip for now"; clicar num banco → **login do agregador** (OAuth/credencial) |

**Padrão de campo que vale copiar:** validação/feedback no próprio campo, defaults inteligentes (país, billing anual pré-selecionado), opcional explícito ("Skip"), e o CTA principal sempre habilitado e único por tela.

## 🎯 Síntese — como fazer o NOSSO onboarding (destilado do Monarch)
1. **Cadastro progressivo:** e-mail → código de verificação → onboarding. Pede o mínimo pra começar.
2. **Barra de progresso** + **1 pergunta por tela** + **← voltar** + CTA único. Foco total, baixa ansiedade.
3. **Começar pela intenção** ("o que te traz aqui?") — inclui opções de casal/família (nosso diferencial).
4. **Perguntar o "landscape"** (o que a pessoa tem) pra montar o dashboard só com o que importa / ligar-desligar módulos.
5. **Perfil pessoal** com a pergunta-chave **"gerencia com parceiro(a)?"** → se sim, **puxar o fluxo de casal no onboarding** (convite + rateio). Ganchos contador/PJ também.
6. **Interstitials de valor** (2-3) entre as perguntas, com print de tela nossa forte + copy atacando a dor ("chega de planilha / de brigar sobre dinheiro").
7. **Tela de confiança/segurança** ANTES de pedir Open Finance (leitura apenas, criptografado, LGPD, sem anúncio).
8. Copy na **1ª pessoa do usuário** ("minhas metas", "nossas contas").


# Despezzas — produto, telas e superfície

> O que dá pra mapear do produto. Marketing + tela de auth + mockups do site são fonte direta; telas internas logadas estão **pendentes** (precisam de conta) e marcadas com ⏳.

## Plataformas e acesso

- **Mobile-first:** apps iOS (App Store `id6447892484`) e Android (Play `com.despezzas`) são o CTA primário da landing.
- **Web:** `despezzas.com.br/auth` → web app sincronizado ("mesma facilidade do app, no navegador, em tempo real"). Sync por conta logada.
- **Auth:** Google · Apple · e-mail. Detalhe abaixo.

## Mapa do site público (FASE 1 — navegado/clicado/testado 2026-05-31)

| Página/destino | Tipo | URL |
|---|---|---|
| **Landing** (single-page) | marketing | `/` |
| ↳ Recursos / Depoimentos / Planos / FAQ | âncoras | `/#recursos` `/#depoimentos` `/#planos` `/#faq` |
| ↳ Fale conosco | âncora | `/#contato` |
| **Ferramentas** (índice, tema dark) | SEO | `/ferramentas` |
| **Blog** (~400 artigos, 47 pgs) | SEO | `/blog` + `/blog/<slug>` |
| **Auth** (criar conta + login) | auth | `/auth` · `/auth/login` |
| App Store / Google Play | download | externos |
| YouTube · LinkedIn · Instagram · TikTok | social | externos |

**Estrutura:** igual ao Pierre, landing single-page com âncoras + páginas reais só pra Ferramentas, Blog e Auth. **Sem páginas legais (Termos/Privacidade) expostas no footer** (≠ Pierre que tem). **i18n no footer:** Português / English / Español (combobox). Social = **YouTube/LinkedIn/Instagram/TikTok** (≠ Pierre: Instagram/Discord/WhatsApp) → Despezzas aposta em redes de conteúdo de massa (TikTok/YouTube), não comunidade fechada.

### Ferramentas — testadas ao vivo (são calculadoras reais, não estáticas)

6 tools (tema light, breadcrumb "Investimentos > Despezzas"), todas com cálculo em tempo real:
- **Calculadora de rendimento** (`/calculadora-rendimento`): Valor inicial + Aporte mensal + Taxa %a.a + Período → Valor final / Total aportado / Total em juros / Rendimento médio-mês + gráfico evolução. **Testei:** mudei Aporte 500→1000 e a projeção recalculou ao vivo (Valor final R$142k→R$252.988,52). Dica embutida: "−12% Selic, −13% CDI, −10% IPCA+".
- **Calculadora CLT vs PJ** (`/calculadora-clt-vs-pj`): tabs **CLT / PJ / Comparar**, inputs (salário bruto, dependentes, benefícios) → líquido mensal/anual, INSS, IRRF, FGTS, 13º, férias+1/3, custo total empresa.
- **Calculadora de IRPF** (`/calculadora-imposto-de-renda`): rendimentos, retido, dependentes, despesas saúde/educação, INSS → Saldo a pagar/restituir + **recomenda modelo** (Simplificado × Completo) + gráfico por faixa progressiva.
- **Tabela ICMS / IRRF / Salário mínimo** (`/tabela-*`): dados de referência 2026 (ex: salário mín. Mensal R$1.612 / Diário R$53,73 / Hora R$7,33 + pisos regionais por estado).

**Leitura:** essas tools são SEO de alto valor e **dão pra copiar pro nosso site** (front puro). Despezzas as usa "sem cadastro" pra capturar busca e converter pro app.

### Blog — artigo (estrutura)

Post tem: "Voltar ao blog", badge de categoria (ex: Planejamento), título, "por Equipe Despezzas · data · X min de leitura", imagem hero, corpo. **Conteúdo de casal é real** (artigo "Como organizar as finanças do casal sem brigas", `/blog/como-organizar-as-financas-do-casal`) → Despezzas comunica pro público casal/família no marketing, não só na feature.

## Telas de auth (pré-login)

**`/auth` (criar conta — padrão):** tela split. Esquerda = painel claro com wordmark "despezzas" + 3 botões pílula preta (Continuar com Google / Apple / e-mail) + termos + "Já tem uma conta? Entrar". Direita = hero **dark** com 2 **arcos finos cruzando** (motivo ponte/X) e headline *"O controle financeiro que você precisa."*. Default da tela = **criar conta** (cadastro primeiro, reduz fricção pra novo usuário).

**`/auth/login` (e-mail):** card central claro, **brand mark "ZZ"** (monograma do despe**zz**as num quadrado arredondado), título "Entrar no Despezzas" + "Bem-vindo de volta! efetue o login para continuar". Campos: E-mail, Senha, checkbox "Lembre-se de mim", botão preto "Entrar". Links: "Não tem uma conta? Crie uma" e "Esqueceu a senha?". Seta de voltar no topo.

**Validação testada (submit vazio):** erro **inline por campo, vermelho** — E-mail "E-mail inválido" + Senha "Senha deve ter pelo menos 6 caracteres" (borda vermelha no campo + texto abaixo). **Mesmo padrão que o nosso DS exige** (`PontesField error` por campo, nunca toast pra campo faltando). Bloqueia submit. Ou seja: a validação de form deles está no mesmo nível do nosso padrão.

**`/auth/forgot-password` (recuperação):** "Recuperação de senha — Insira seu e-mail de autenticação e enviaremos um código de confirmação." Campo E-mail + "Enviar código" + "Voltar para o login". **Fluxo por código/OTP** (não link mágico).

**Resumo do auth Despezzas:** e-mail+senha tradicional (≠ Pierre, que é WhatsApp-first passwordless) + Google + Apple. Cadastro/login separados, "criar conta" como tela default. Reset por OTP. Validação por campo sólida. Fricção média (mais que Pierre, igual a nós).

## Blog — engine de conteúdo (SEO) — `/blog`

**Investimento pesado de content marketing:** *"Página 1 de 47"* (~400+ artigos), *"Conteúdo novo toda semana"*. Categorias: **Planejamento**, **Educação Financeira**, **Open Finance**. Cada card: categoria + título + resumo + data + tempo de leitura + "Ler mais".

**Temas revelam posicionamento (adjacente ao nosso fosso):**
- *"Como organizar as finanças do casal sem brigas"* — **mira casais** (nosso terreno).
- *"Controle financeiro para MEI: separe pessoa física da jurídica"* — **MEI/PJ** (o "perfil PJ" do plano Plus).
- *"Categorização de gastos com IA: como funciona e por que importa"* — empurra o diferencial IA.
- *"O Open Finance é seguro?"* — ataca a barreira de confiança da conexão bancária.
- Genéricos de alto volume de busca: reserva de emergência, método bola de neve, orçamento mensal, economizar no supermercado, planejamento anual.

**Leitura:** blog + ferramentas grátis = máquina de aquisição orgânica forte. E o conteúdo de **casal/MEI** mostra que Despezzas já comunica pro público família/compartilhado — não só funcionalidade, mas marketing.

## Mockup do dashboard (do hero da landing — fonte direta)

O telefone no hero mostra a tela principal do app:

- **Topo:** avatar + nome ("Thiago") + **seletor de perfil** ("Perfil Principal ⌄") → confirma o conceito de **múltiplos perfis** trocáveis.
- **Seletor de mês** ("Maio 2026 ⌄") + botão "Expandir".
- **Saldo atual** com olho de ocultar valor (privacy toggle) — R$ 7.453,63.
- **Grid 2×2 de KPIs:** **Receitas / Despesas / Recebido / Pago**.
  - Distingue **previsto (Receitas/Despesas) × efetivado (Recebido/Pago)** — mesma distinção que acabamos de implementar (Previsto/Efetivado). Forte sinal de que essa separação é padrão de mercado BR.
- **Gastos com Cartão:** valor + **badge de variação % vs mês anterior** ("↘ 17,9% vs mês anterior") + gráfico de linha/área.

## Recursos (declarados na landing)

| Recurso | Descrição deles |
|---|---|
| **Open Finance** | conecta Nubank, Itaú, Bradesco e outros; transações entram automático |
| **Categorização automática (IA)** | cada transação cai em moradia/alimentação/transporte… sozinha |
| **Controle de assinaturas** | agrupa recorrentes (iFood, Spotify, Uber, Netflix), mostra total e em qual cartão |
| **Controle de contas** | poupança, corrente, investimento |
| **Controle de cartões** | múltiplos cartões num lugar |
| **Limite de gastos** | teto por categoria |
| **Categorias personalizadas** | usuário cria as próprias |
| **Relatórios** | resumos com gráficos "simples e completos" |
| **Metas** | acompanhar progresso de metas pessoais (ilimitadas nos pagos) |
| **Chat IA financeira** | assistente conversacional sobre as finanças |
| **Perfis compartilhados** | separar Família / PJ / Investimentos (até 3 no Plus) |

## Ferramentas públicas (SEO) — `/ferramentas`

Seção **dark** com 6 cards (grid 3 col), "sem cadastro, dados oficiais 2026":

| Ferramenta | Rota | O que faz |
|---|---|---|
| Calculadora de rendimento | `/calculadora-rendimento` | juros compostos + aportes mensais |
| Calculadora CLT vs PJ | `/calculadora-clt-vs-pj` | compara líquido + custo total CLT × PJ (INSS, IRRF, FGTS, 13º, férias) |
| Calculadora de Imposto de Renda | `/calculadora-imposto-de-renda` | estima IRPF 2026 |
| Tabela ICMS | `/tabela-icms` | alíquotas inter/intra dos 27 estados |
| Tabela IRRF | `/tabela-irrf` | faixas mensais IRRF |
| Tabela de Salário Mínimo | `/tabela-salario-minimo` | nacional + pisos regionais |

Cada card: ícone, seta externa, "Abrir ferramenta →" (CTA verde). CTA de conversão no fim de cada tool = baixar o app.

## FAQ (verbatim resumido)

- **É pago?** "Não. Gratuito para sempre. Porém alguns recursos só no premium." (freemium)
- **Cancelar?** Via Apple/Google (gerenciamento de assinaturas do device).
- **Web + celular?** Sim, dados sincronizados na mesma conta.

## Prova social

350K+ usuários ativos · 50M+ transações · 500K+ downloads. Carrossel de depoimentos (xislari, Helyott, Roberto Cavalcante, Patricia P, Marlon Carvalho…). Tom: "melhor custo-benefício", "integração bancária funciona muito bem".

## FASE 3 — app logado (testado 2026-05-31, conta grátis)

### Layout
- **Sidebar** com 2 grupos: **CONTROLE** [Dashboard · Transações · Recorrentes · Contas · Cartões 🔒PRO · Categorias · Despezzas IA 🔒PRO] · **ORGANIZAÇÃO** [Limites de gastos 🔒PRO · Metas 🔒PRO · Investimentos 🔒PRO · Relatórios 🔒PRO] · Configurações.
- **Freemium agressivo:** 6 das ~13 áreas são 🔒PRO (Cartões, Despezzas IA, Limites, Metas, Investimentos, Relatórios). Banner fixo "Assine o Premium" no topo de tudo.
- Dashboard: "Olá, <nome>", Resumo do mês (seletor + Expandir), **4 KPIs** (Saldo / Receitas / Despesas / Gastos com Cartões), card "Configure seu orçamento" (salário + meta), bloco "Despezzas IA" (colapsável), gráfico Gastos com Cartão.

### Perfis / Família — VALIDAÇÃO DA PROMESSA (o ponto-chave) ⚠️
- Multi-perfil existe no menu da conta: **"Meus perfis" → Trocar de perfil + Novo perfil**.
- **No plano grátis:** só **"Perfil pessoal"** e **"Novo perfil" está DESABILITADO** (cinza). **Não dá pra criar perfil Família/PJ sem pagar.**
- Na paywall (tela de upgrade, vista ao clicar qualquer PRO): **Individual NÃO tem "Perfis de acesso compartilhado"** (riscado ❌) — **só o Plus tem** ("Até 3 perfis extras").
- **Veredito:** o "casal/família" do marketing é **exclusivo do plano Plus** (o mais caro: R$ 89,90/mês ou R$ 289,90/ano). No grátis e no Individual **não existe**. A funcionalidade REAL de rateio/compartilhamento (como convida, papéis, quem-paga-o-quê) fica atrás do Plus — **não deu pra validar se é rateio de verdade ou só "visão separada"** sem assinar o topo. Mesmo assim: confirma que o "família" deles é **só separar perfis** (Família/PJ/Investimentos), posicionado como organização pessoal, não gestão familiar colaborativa. **Nosso fosso (rateio real, aprovação, papéis) continua de pé.**

### Transações — CRUD completo (create-manual, igual a nós; ≠ Pierre)
- **Criar** (testei: criei "Cafe" R$12,50): modal com Tipo (Despesa/Receita) · Valor · Título · Descrição · **Conta OU Cartão** · Categoria + **Subcategoria** (hierárquico) · Data · Tipo recorrência (Único…) · **toggle "Pago"** (= previsto/efetivado, igual nosso "Efetivado"). KPIs atualizam ao vivo.
- **Menu da transação:** **Editar · Marcar como pago/não pago · Duplicar · Excluir** (com diálogo de confirmação "não pode ser desfeita"). **CRUD total** — testei criar→excluir, funcionou. Oposto do Pierre (que só oculta).
- **Validação por campo** (erro inline vermelho) ✅ — **MAS as mensagens vazam em inglês** ("Either account or credit card must be selected", "Category is required") = **bug de i18n / falha de qualidade** deles.
- **Tabs:** Fluxo de caixa | Todos os lançamentos. **Sub-views:** Geral | Cartões | Contas. Seleção em massa (checkbox por linha). Exportar.
- **KPIs:** Receitas · **Recebido** · Despesas · **Pago** · Balanço (previsto×efetivado).

### Filtros de Transações (drawer "Filtrar transações")
Abas **Detalhes / Categorias**. Detalhes: **Status** (Todos/Pagas/Não pagas) · **Tipo** (Despesa/Receita) · **Contas** (multi-select) · **Cartões** (multi-select) · **Valor mínimo (R$)**. + **Período** (range de data, topo) + **Busca** + **Ordenar**. Filtros **mais ricos que os nossos** (temos só mês + chips Tudo/Receitas/Despesas + 1 categoria). Despezzas tem filtro por conta, cartão, valor e status — todos que faltam pra nós.

### Contas (`/account`)
- "Minhas Contas" + saldo consolidado. KPIs: Saldo total · Open Finance (Nenhuma) · Manuais (2). Tabs: Todas / Open Finance / Manuais / Investimentos.
- 2 contas manuais (Carteira ★Padrão · Nubank, esta com flag **"Fora do total"** = excluir do saldo consolidado). + **Nova Conta**.
- Distingue **conta manual × Open Finance × investimento** — modelo mais rico de contas que o nosso.

### Categorias (`/categories`)
- **25 categorias + 96 subcategorias** padrão (hierárquico), cada uma com ícone + cor. Tabs Categorias / Subcategorias. + Adicionar Categoria (CRUD próprio).

### Gates PRO (testado)
- Clicar **Cartões / Limites / Metas / Investimentos / Relatórios / Despezzas IA** → tela **"Recurso Premium — exclusiva para assinantes Premium"** com os 2 planos (Mensal/Anual, "Economize 73%" no anual).
- **Preços anuais (revelados aqui):** Individual **R$ 169,90/ano**, Plus **R$ 289,90/ano**.

### Recorrentes (`/recurring-installments`)
Sub-tabs **Recorrentes | Parceladas** (recorrências + parcelamentos no mesmo lugar). Mesma barra (KPIs, filtro, período, Adicionar). Vazio na conta nova.

### Configurações — TODAS as sub-páginas (testadas)
- **Perfil** (`/settings/profile`): foto + Nome/Telefone/E-mail/**Estado civil**/**Tem Filhos**(toggle) + Profissão/Salário/**Funcionário CLT**(toggle). Coletam dados pessoais ricos (pra orçamento/personalização). Plano Gratuito + Assinar Premium.
- **Preferências** (`/settings/preferences`): **Aparência** (Claro/Escuro/Sistema — só 3, **sem paleta/fonte** → nossa personalização é diferencial) + **Idioma** + **Moeda** (multi-moeda).
- **Orçamento** (`/settings/budget`): Salário mensal − Meta de economia = **Orçamento do mês** (calculado). Alimenta o card "Configure seu orçamento" do dashboard.
- **Notificações** (`/settings/notifications`): toggles Receber todas · Lembretes de feriados · Dicas sazonais · **Desafios financeiros** (gamificação).
- **Perfis de Acesso** (`/settings/access-profiles`): 🔒 **"Recurso Plus"** — gate. É a config do compartilhamento família, paywall.
- **Meu Plano** (`/settings/plan`): status + comparativo Individual×Plus (reconfirma perfis compartilhados = só Plus).
- **Exportar dados** 🔒PRO.
- **Convide e Ganhe** (`/settings/invite`): **programa de indicação** — código + "0/5 amigos", amigos ganham **14 dias Premium grátis**. Loop viral de crescimento (a gente não tem).
- **Sugestões e Problemas** (`/settings/feedback`): form de feedback (Tipo: melhorias/assinatura/sumiço de dados/acessibilidade/sincronização/nova versão/bugs) + descrição + **upload de até 5 prints**.

### CRUD de Contas e Categorias (forms testados)
- **Nova Conta:** menu **Adicionar manualmente** (free) | **Conectar via Open Finance** (🔒PRO). Form manual: Banco (lista com logos) · Título · Saldo inicial · toggle **"Incluir no saldo total"**.
- **Adicionar Categoria:** Nome + **Cor** (~30 cores) + **Ícone** (picker grande). Categoria custom com ícone+cor. Subcategorias = aba separada (96 default).

### Gates PRO — todos idênticos
Cartões, Despezzas IA, Limites, Metas, Investimentos, Relatórios, Exportar dados, Conectar Open Finance, Perfis de Acesso → todos abrem a MESMA tela "Recurso Premium/Plus" (Mensal/Anual, Individual R$169,90/ano · Plus R$289,90/ano). **Open Finance real e IA chat ficam atrás de plano pago** — não deu pra testar sem assinar.

### Menus de conta (topo-direita = rodapé-esquerda, duplicados)
Minha conta · Editar perfil · Meu plano · Configurações · Meus perfis (Trocar/Novo-desabilitado) · tema · idioma · FAQ · Suporte · API (em breve) · Sair.

### Cobertura
Tudo que é **acessível no grátis** foi aberto/testado. Atrás de paywall (não testável sem assinar): app mobile nativo, Open Finance real, IA chat/categorização, Cartões/faturas, Limites, Metas, Investimentos, Relatórios, e **o funcionamento real dos perfis compartilhados** (Plus).

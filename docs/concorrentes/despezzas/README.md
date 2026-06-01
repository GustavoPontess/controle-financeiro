# Despezzas — resumo executivo

> Análise do concorrente **Despezzas** (`despezzas.com.br`), navegado ao vivo no site público em **2026-05-31**. App interno (telas logadas, filtros, UX) **pendente** de acesso com conta — ver nota no fim.

## O que é

App **mobile-first** (iOS + Android) de finanças pessoais com **versão web** (`despezzas.com.br/auth` → web app), modelo **freemium** ("gratuito para sempre" + recursos premium). Empresa: **INSIDE TECH LTDA** (CNPJ 41.629.624/0001-50).

Posicionamento: **Open Finance + IA**, igual ao Pierre — mas **barato** (5×–6× mais barato que o Pierre no topo) e com **escala grande** declarada (350K usuários ativos, 500K downloads, 50M transações). Copy acessível: *"Automatize seu controle financeiro e economize sem esforço"*.

## Por que é o concorrente mais perigoso pra nós

1. **Preço compatível com o mercado BR** (R$ 34,90 / R$ 89,90) — diferente do Pierre (R$ 39 / R$ 199), que é caro. Despezzas mira o mesmo bolso que a gente.
2. **Toca o nosso fosso família**: plano Plus = *"Separe Família, PJ e Investimentos em até 3 perfis compartilhados"*. Tem **perfis de acesso compartilhado** já nos dois planos pagos.
3. **Escala real** (350K usuários) — já tem comunidade e prova social, não é um MVP.
4. **Open Finance + IA + chat** entregues, não "em breve".

## Planos e preços

Toggle **Mensal / Anual** (valores anuais não expostos no card sem interação — provável desconto).

| Plano | Mensal | Anual | Para quem | Open Finance | Perfis compartilhados |
|---|---|---|---|---|---|
| **Grátis** | R$ 0 | — | uso básico (muita coisa 🔒PRO) | limitado | ❌ (só "Perfil pessoal") |
| **Individual** | **R$ 34,90/mês** | **R$ 169,90/ano** | finanças pessoais "tudo desbloqueado" | **4 bancos** | **❌ NÃO** (riscado na paywall) |
| **Plus** (RECOMENDADO) | **R$ 89,90/mês** | **R$ 289,90/ano** | Família / PJ / Investimentos | **ilimitado** | **✅ até 3 perfis** |

Anual = "Economize 73%" vs mensal.

**Ambos os pagos incluem:** contas ilimitadas, cartões ilimitados, categorização automática com IA, chat com IA financeira, categorias personalizadas, relatórios e insights avançados, metas ilimitadas.

**⚠️ Correção pós-deep-dive (2026-05-31):** os **"perfis compartilhados / família"** são **EXCLUSIVOS do Plus** (o plano mais caro). Confirmado logado: no grátis "Novo perfil" está **desabilitado**, e na paywall o Individual mostra "Perfis de acesso compartilhado" **riscado (❌)**. Diferença Individual→Plus = **conexões bancárias (4→ilimitado) + perfis compartilhados (não→até 3)**. A funcionalidade de casal/família fica atrás de R$ 89,90/mês.

**Modelo de monetização:** assinatura gerenciada pela **Apple/Google** (in-app purchase), não cobrança própria. Monetizam **conexões bancárias + perfis compartilhados** — o CRUD é grátis. Mesma lógica do Pierre (monetiza integração, não o básico).

## Recursos declarados (site)

Open Finance (Nubank, Itaú, Bradesco…) · categorização automática por IA · controle de assinaturas (iFood, Spotify, Uber, Netflix…) · controle de contas (poupança/corrente/investimento) · controle de cartões · limite de gastos por categoria · criação de categorias · relatórios com gráficos · criação de metas · chat IA financeira · sync web+mobile em tempo real · i18n (PT/EN/ES).

## SEO / aquisição

Máquina de aquisição orgânica forte, dois braços:
- **6 calculadoras/tabelas grátis** "sem cadastro": rendimento (juros compostos), CLT×PJ, IRPF 2026, tabela ICMS, IRRF, salário mínimo.
- **Blog com ~400+ artigos** ("Página 1 de 47", conteúdo novo toda semana) — categorias Planejamento / Educação Financeira / Open Finance.

**Atenção:** o conteúdo do blog já mira **casais** (*"finanças do casal sem brigas"*) e **MEI/PJ** (*"separe pessoa física da jurídica"*) — ou seja, eles **comunicam pro público família/compartilhado**, não só entregam a feature. Isso encurta a vantagem de marketing do nosso fosso família.

## Gaps deles (oportunidade nossa)

- **Sem tags** nas transações — pedido explícito num depoimento (Marlon Carvalho): tags + filtro/gráfico por tag. Eles ainda não têm.
- **Dependência de loja** (Apple/Google) pra cobrança — não controlam billing nem web-checkout próprio.
- **Perfis compartilhados ≠ gestão de família real**: é "separar perfis" (Família/PJ/Investimentos), não rateio "quem paga o quê", aprovação de despesa, papéis dinâmicos. Aí ainda dá pra cavar fosso (confirmar no deep dive).

## Como ler esta pasta

- [`produto.md`](./produto.md) — superfície de produto, telas e o que dá pra inferir do app
- [`design.md`](./design.md) — design system deles e o que aprender
- [`comparativo.md`](./comparativo.md) — Despezzas × Pontes, gaps e recomendações priorizadas
- [`prints/`](./prints/) — screenshots capturados

## Nota de escopo

Análise atual = **site público** (landing, planos, FAQ, ferramentas, tela de auth). As **telas internas do app** (dashboard logado, transações, filtros, criação de lançamento, perfis compartilhados na prática) exigem login. Próximo passo: acessar logado e documentar igual fizemos com o Pierre — inserir dados de teste com **rótulos genéricos** (nunca referência a análise/concorrência) e mapear filtros, UX e fluxo real.

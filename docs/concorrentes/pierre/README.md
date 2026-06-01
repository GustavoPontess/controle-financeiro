# Concorrente: Pierre — `pierre.finance`

> Análise feita em **2026-05-31** navegando o app real (conta dev, plano grátis) + o site de marketing (`lp.pierre.finance`). **Somente observação** — nenhum dado inserido/alterado na conta deles.
> Tagline oficial: *"Assistente de IA para Finanças Pessoais"*.
> **Backing:** bancado pela **Cloudwalk** (fintech BR, dona da InfinitePay) — *"aposta da Cloudwalk pra crescer com o consumidor final"*. Concorrente bem financiado, com forte presença de imprensa.
> **Marketing/pré-login** documentado em [`produto.md`](./produto.md) → seção "Pré-login — site de marketing".

## Índice

| Arquivo | Conteúdo |
|---|---|
| [`produto.md`](./produto.md) | Todas as rotas/telas, com o que cada uma faz e detalhes de interação |
| [`design.md`](./design.md) | Design system deles — cores, tipografia, layout, componentes, tom de marca |
| [`comparativo.md`](./comparativo.md) | Pierre × nosso produto — filtros, gaps, recomendações priorizadas |
| [`prints/`](./prints/) | Referência dos screenshots (capturados na sessão; ver `prints/README.md`) |

---

## Resumo executivo (1 minuto)

Pierre é um app de finanças pessoais **IA-first + Open Finance**, posicionamento **premium** e **individual** (não toca família/casais).

**O que define o produto:**
1. **Open Finance** — sincroniza extrato/cartão do banco automaticamente. Lançamento manual é exceção.
2. **IA conversacional** ("Fale com o Pierre") — chat sobre as próprias finanças.
3. **Agentes autônomos** — automações IA agendadas (monitorar, alertar, economizar).
4. **Insights automáticos** — frases no topo do dashboard ("gasolina subiu 300%! bora revisar").

**Filosofia de produto — "detect-and-correct":** como tudo vem do banco, o app **detecta** transações, assinaturas e parcelamentos; o usuário só **ajusta** (ocultar / "não é assinatura"). Quase não há CRUD manual. (Nós somos o oposto: "create-manual".)

**Nosso fosso:** família/casais (rateio, dependentes, aprovação, papéis). Pierre não compete aqui.

---

## Tabela de preços

> Modal "Upgrade". Toggle Mensal/Anual (capturado no Mensal). Tagline: *"O futuro do seu dinheiro chegou — Comece com R$ 39,00/mês, cancele quando quiser"*.

| Plano | Preço (mensal) | Inclui |
|---|---|---|
| **Grátis** | R$ 0 | (plano atual da conta de teste; limitações não detalhadas no modal) |
| **Pro** _(marcado "Popular")_ | **R$ 39,00/mês** | Conecte até **5 contas bancárias** · Relatórios exclusivos e personalizados · Suporte prioritário · Até **5 agentes autônomos** |
| **Premium** | **R$ 199,00/mês** | **Múltiplas** contas bancárias · Até **10 agentes autônomos** · **Conexão via API e MCP** · Acesso antecipado a funcionalidades |

**Leitura de monetização:**
- Âncora em **R$ 39** (Pro) com salto grande pra **R$ 199** (Premium) — Premium mira power-users / devs (API + MCP).
- O que eles cobram = **número de contas conectadas** + **número de agentes** + **API/MCP**. Ou seja, monetizam a automação IA e a profundidade de Open Finance, não o CRUD básico.
- Preço alto para o mercado BR de finanças pessoais (Organizze/Mobills ficam ~R$ 10–25/mês) — posicionamento premium justificado pela IA.

📷 Print: `prints/` → *pricing-modal* (2 cards Pro/Premium, toggle Mensal/Anual, fundo escuro com glow verde no card Premium).

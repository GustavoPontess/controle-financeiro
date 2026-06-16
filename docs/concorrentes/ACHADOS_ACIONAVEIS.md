# Achados acionáveis — consolidado dos concorrentes

> ⚠️ **Documento-fonte (pesquisa).** O backlog vivo e priorizado deriva daqui mas mora no **`ROADMAP.md`** (raiz) — é lá que se acompanha o que fazer/feito. Este arquivo guarda o raciocínio cru por trás de cada item.
>
> Itens concretos pra fazer, tirados das análises (Pierre, Despezzas, Monarch, Conta Azul, Bling). Priorizados por impacto × custo. Fonte = quem validou.

## 🟢 Curto prazo — barato, front/dados que já temos

| # | Ação | Por quê / fonte |
|---|---|---|
| 1 | **Filtros de transação ricos** — por conta, cartão, **valor**, status (pago/não pago), multi-categoria | Despezzas + Pierre têm; nós só temos mês + chips + 1 categoria. Gap puro de front. |
| 2 | **Tela de Assinaturas** — agrupar recorrências + "em qual cartão" + projeção anual | Já temos `Recorrente`; falta a visão. Pierre, Despezzas e Monarch têm. Vira table-stakes. |
| 3 | **Orçamento simples** — salário − meta de economia = "quanto posso gastar" | Despezzas. Barato, alto valor percebido. |
| 4 | **Programa de indicação (referral)** — convidado ganha X dias premium | Despezzas + Monarch. Loop viral de aquisição. |
| 5 | **Variação % vs mês anterior** nos cards (cartão/categoria) | Pierre + Despezzas. Já no radar do `/reports`. |
| 6 | **Ferramentas grátis (SEO)** — calculadoras (rendimento, CLT×PJ) + páginas de comparação (vs concorrente) | Despezzas, Monarch, Qive. Aquisição orgânica barata. |
| 7 | **Atribuir transação a um membro/parceiro pra revisar** | Monarch. Primitivo de colaboração simples — encaixa no nosso família. |
| 8 | **Parceiro/membro da família GRÁTIS** (decisão de pricing) | Monarch (acerto) × Despezzas (erro: cobra perfis no plano caro). Não enterrar família no topo. |
| 9 | **Privacy toggle** (ocultar saldo) | Despezzas. Barato, sinal de confiança. |
| 10 | **Fotografia lifestyle de casal/família** no site (`/casais`, `/contadores`) | Monarch. "Household" vende melhor que screenshot puro. |
| 11 | **Subcategorias hierárquicas + ícone/cor por categoria** (conferir se completo) | Pierre + Despezzas (25+96). Reconhecimento visual. |

## 🟠 Médio prazo — diferencial / nosso fosso

| # | Ação | Por quê / fonte |
|---|---|---|
| 12 | **Família REAL — rateio "quem paga o quê" + settle-up (quem deve a quem)** | **NINGUÉM faz bem.** Monarch = só merge/visão compartilhada; Despezzas = "separar perfis" (pago); Pierre = individual. **Prioridade de produto = nosso fosso.** |
| 13 | **Papéis/permissões + dependentes** na família | Monarch só tem "ver junto" + atribuir. Mais rico = nosso. |
| 14 | **Fluxo de aprovação de despesa** (família) | Ninguém tem. |
| 15 | **Net worth mais completo** (investimentos, imóveis) | Monarch eleva a régua. |
| 16 | **Conteúdo SEO mirando "finanças do casal/família"** | Despezzas já disputa "finanças do casal" no Google. |
| 17 | **Wedge PJ leve + ponte pro contador** — emitir NF simples, separar PF/PJ, conciliar (não-ERP) | Conta Azul é referência do fluxo contador ("emite NF → entrega pro cliente E contabilidade"); Bling prova que NF/PJ dá pra ser R$55. Gap entre o pessoal e o ERP pesado. |
| 18 | **App mobile / PWA forte** | Todos B2C têm. (Ressalva: memória = desktop primeiro, mobile pro fim.) |

## 🔴 Longo prazo — caro, estratégico

| # | Ação | Por quê / fonte |
|---|---|---|
| 19 | **Open Finance / agregação bancária** | Pierre, Despezzas, Monarch (13k+ instituições). **Table-stakes** — sem isso somos "o app que dá trabalho de digitar". Gap nº 1. |
| 20 | **IA conversacional / categorização automática** | Pierre (core), Despezzas. Alta percepção de valor. |

## ✅ A nosso favor — defender / usar como argumento

- **Despezzas vaza mensagens de validação em inglês** ("Category is required") — bug de i18n. Nossa validação por campo (`PontesField`) está no nível, sem esse furo.
- **Pierre não deixa editar/excluir NADA** (só ocultar) — irrita quem quer controle. Nosso **CRUD completo** é argumento.
- **Personalização** (15 paletas + 7 fontes) — nenhum concorrente tem.
- **Contador** — segmento que Pierre, Despezzas e Monarch ignoram; temos `/contadores`.

## Síntese estratégica

**Cavar família real (rateio/papéis/dependentes/aprovação) é a aposta nº 1** — é onde TODOS falham. Em paralelo, fechar os gaps baratos de UX (1–11) pra não parecer atrás. Open Finance + IA entram depois; o fosso vem primeiro. Pricing: ancorar no BR (R$ 35–90, faixa Despezzas) com **família/parceiro acessível** (lição Monarch).

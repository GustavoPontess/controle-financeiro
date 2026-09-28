---
owner: Gustavo
last_reviewed: 2026-09-27
status: PESQUISA
---

# Pix no crédito ("Pix parcelado") — como funciona no mercado

Pesquisa leve (2 agentes, 2026-09-27) pra decidir se a tela de Parcelamentos pode morar dentro de Cartões.

## Resposta curta

**Nem todo Pix parcelado cai no cartão.** Existem dois modelos no mercado, e o Banco Central não padronizou nenhum.

| Modelo | Como funciona | Quem faz (fonte) | Onde encaixa no Pontes |
|---|---|---|---|
| **A — no cartão** | Usa o limite do cartão; parcelas caem na **fatura**; tem **juros + IOF** (compra parcelada comum não tem IOF) | Nubank "Pix no crédito" (até 12x, [blog oficial](https://blog.nubank.com.br/pix-no-credito-cartao-parcelado-diferencas/)); Itaú (até 12x na fatura, [página oficial](https://feito.itau.com.br/saiba-como-fazer-pix-parcelado/)) — o mais comum | Parcelamento do cartão, tipo `PIXCredito` (já existe, exige cartão + taxa) |
| **B — linha de crédito à parte** | Empréstimo separado; parcelas **debitadas da conta** ou boleto, fora da fatura | Mercado Pago "Linha de Crédito" ([página oficial](https://www.mercadopago.com.br/blog/pix-no-credito-linha-de-credito-mercado-pago), leitura bloqueada — só o título confirmado); BB/PicPay/Inter: fontes secundárias contraditórias | **Empréstimo** (bancário), não cartão |

## Regra oficial (BCB)

- O BCB discutiu padronizar o "Pix Parcelado" em 2025 ([slide do Fórum Pix, 04/12/2025](https://aprendervalor.bcb.gov.br/content/estabilidadefinanceira/pix/Forum_Pix_Plenaria/20251204-Forum_Pix.pdf)) e **desistiu** em dez/2025 ([Agência Brasil](https://agenciabrasil.ebc.com.br/economia/noticia/2025-12/apos-adiamentos-banco-central-desiste-de-regular-pix-parcelado)): cada banco define taxa, prazo e forma de cobrança.
- Efeito de marca (secundária): o manual da marca Pix veta os nomes **"Pix Parcelado"** e **"Pix Crédito"**; **"Pix no crédito"** segue permitido. Vale pra instituição financeira, mas o Pontes deve usar "Pix no crédito" na UI pra falar a mesma língua dos bancos.
- Pra quem recebe é Pix comum (valor cheio na hora); a dívida é de quem paga.

## Implicação pro produto

- Mover Parcelamentos pra dentro de Cartões **cobre o modelo A** (a maioria), que é o único que o Pontes modela hoje (`PIXCredito` exige cartão).
- O **modelo B** entra como **empréstimo bancário** (módulo Empréstimos, `Origem`/banco), não como parcelamento de cartão.
- Decisão do Gustavo registrada na Fila do `ROADMAP.md`.

## Lacunas (não verificado)

- Resolução BCB nº 587 (18/09/2026, participantes do Pix) não foi lida — pode ter mudado algo.
- Manual da marca Pix não lido direto (vedação de nome vem da imprensa).
- BB, Inter, PicPay sem fonte oficial.

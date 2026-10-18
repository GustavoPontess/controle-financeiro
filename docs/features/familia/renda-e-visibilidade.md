# Renda de cada um e o que a família vê

> Pesquisa aprofundada + arquitetura (2026-10-18), a pedido do Gustavo. Princípio dele, que vira o eixo
> da spec: **renda é da pessoa; a família só reflete o que cada um liberou.** Quem não libera nada usa a
> família só pra dividir conta; quem libera aparece; "renda da casa" é a soma de quem liberou pra quem olha.
> Status: **spec aprovável, não implementado.** Decisão pendente: ordem (antes ou depois das ações de família
> na tela da transação).

## 1. Pesquisa

### 1.1 Como os apps tratam renda

| App | Renda | O que aprendemos |
|---|---|---|
| **Monarch** | Orçamento parte de uma **renda esperada do mês**; "Planned · Actual · Remaining"; lançamentos de receita precisam de categoria certa (paycheck, bonus, business income) porque o orçamento nasce delas; detecta depósitos recorrentes e pede pra confirmar valor e frequência ([ajuda](https://help.monarch.com/hc/en-us/articles/360048883631-Creating-Your-Budget-in-Monarch), [review](https://clark.com/save-money/monarch-money-review/amp/)) | Previsto × recebido por mês é padrão de mercado; a origem da receita é o que faz o número valer |
| **Copilot** | **Não** tem renda esperada; receita aparece pela categoria "Income" no fluxo de caixa; notifica depósito ≥ $10; não categoriza tipos de renda (só tags) ([ajuda](https://help.copilot.money/en/articles/5542019-income-vs-budget)) | Caminho mínimo: renda = soma das receitas; aviso quando entra dinheiro |
| **YNAB** | Não orça renda futura, só dinheiro que já caiu; pra renda irregular, "orce pelo pior mês" ([guia](https://www.ynab.com/guide/irregular-income)) | O "recebido" tem que ser o número forte; o previsto é apoio, nunca promessa |
| **Mobills / Organizze** | Receita lançada com data; sem previsto × recebido como conceito (nada na ajuda deles) | Nenhum BR faz isso; é diferencial |

### 1.2 Como os apps tratam "quem vê"

| App | Modelo |
|---|---|
| **Honeydue** | Por conta, quem é dono escolhe: *tudo* · *só saldo* · *nada*; e dá pra esconder **um lançamento** isolado ([ajuda](https://support.honeydue.com/en/articles/3283211-how-to-change-what-my-partner-can-see)). É o único granular |
| **Monarch** | Membro da casa vê **tudo**; "mine/theirs/ours" é filtro, não privacidade ([ajuda](https://help.monarch.com/hc/en-us/articles/42228648365076-Shared-Views-in-Monarch)) |
| **YNAB** | Orçamento único, os dois veem tudo |
| **Zeta** | "cada um controla 100% do que mostra" (reviews; serviço pode ter fechado) |
| **Splitwise / Tricount** | Não existe renda; só despesas do grupo |

**Leitura:** o nosso é Honeydue (dono decide, por nível) aplicado à **renda** e com um nível a mais: *valor pra
quem eu escolher* (cônjuge sim, filho não). Ninguém faz isso.

### 1.3 O Brasil que precisa caber

- Informalidade em **37,5%** dos ocupados (38,7 milhões; PNAD Contínua nov/25–jan/26): comissão, bico, diária,
  app. A renda do mês só se sabe no fim do mês ([IBGE via Portal](https://portaldeprefeitura.com.br/bastidores-da-politica/brasil-tem-387-milhoes-de-trabalhadores-sem-carteira-assinada-e-sem/610375/)).
- **Renda do governo é renda:** Bolsa Família (mín. R$ 600/família + adicionais; paga por final do NIS, escalonado),
  BPC/LOAS e aposentadoria/pensão (calendário INSS), seguro-desemprego, Pé-de-Meia, Gás do Povo ([calendário 2026](https://www.moneytimes.com.br/bolsa-familia-pe-de-meia-gas-do-povo-e-mais-confira-o-calendario-completo-dos-programas-sociais-do-governo-para-2026-isbl/)).
- 81,6% das famílias com dívida; inadimplência 38,6% nas de até 3 salários; cartão em 84,6% dos endividados (CNC/Peic mai/26, [CNN](https://www.cnnbrasil.com.br/economia/financas/endividamento-bate-recorde-de-816-das-familias-diz-cnc/)).
- Bets: ~R$ 3 bi/mês de famílias do Bolsa Família (BC ago/24, contestado; STF mandou barrar) ([CartaCapital](https://www.cartacapital.com.br/economia/apostas-consumiram-r-3-bi-de-beneficiarios-do-bolsa-familia-em-um-unico-mes-aponta-o-bc/)).
  Pro produto: não é "gente burra", é dinheiro que ninguém enxerga. Ver "entrou R$ 600 (Bolsa Família) · saiu
  R$ 300 (Apostas)" é a conversa. (Categoria Apostas + aviso de gasto fora do padrão: Fase 1, não aqui.)

## 2. Arquitetura: duas camadas

```
PESSOA (sempre, com ou sem família)                 FAMÍLIA (só reflete)
┌──────────────────────────────────────┐            ┌──────────────────────────────────────┐
│ Origem de renda (subcategoria de     │            │ Por membro: nível de visibilidade     │
│   Renda): Salário, Comissão, INSS,   │   libera   │   escolhido PELA PESSOA, por família: │
│   Bolsa Família, BPC, Seguro-desemp… │  ───────▶  │   só o peso · valor pra [quem] · nada │
│ Recebido no mês = receitas executadas│            │ Renda da casa = soma de quem liberou  │
│   com origem de renda                │            │   pra QUEM ESTÁ OLHANDO               │
│ Previsto = contas fixas de receita   │            │ Rateio proporcional = peso (previsto) │
│   + variável esperada do mês         │            │   de quem liberou pelo menos o peso   │
└──────────────────────────────────────┘            └──────────────────────────────────────┘
```

Tudo que é **número** mora na pessoa e já existe em boa parte: `StatusTransacao.Previsao/Executado`
(Dashboard já calcula `recebido` e `aReceber`), conta fixa de receita (`Recorrente` com `Tipo = Receita`),
categoria "Renda" com subcategorias padrão (`SubcategoriaSeeder`), `EntraNoResultado` (tira transferência,
estorno, saldo inicial). A família **não guarda renda**: guarda só a regra de quem vê.

### 2.1 Pessoa: origem de renda

A categoria "Renda" **já tem** subcategorias padrão (`SubcategoriaSeeder`): Salário · 13º e férias · Freelance e PJ ·
Aposentadoria · Auxílio do governo · Aluguel recebido · Dividendos e juros · Cashback · Reembolso · Pensão recebida.
Mudanças:
- **Entram:** `Comissão / variável`, `Bolsa Família`, `BPC / LOAS`, `Seguro-desemprego`, `Pé-de-Meia e outros
  benefícios` (o "Auxílio do governo" genérico vira esses; migration renomeia e mantém o que já foi lançado nele).
- **Cada subcategoria padrão de Renda ganha `OrigemRenda`**: `Trabalho` (Salário, 13º, Freelance, Comissão) ·
  `Governo` (Aposentadoria/INSS, Bolsa Família, BPC, Seguro-desemprego, Pé-de-Meia…) · `Patrimônio` (Aluguel,
  Dividendos) · `Outra` (Pensão recebida) · **`null` = não é renda** (Cashback, Reembolso: dinheiro que volta,
  não dinheiro que entra; hoje inflam "Renda"). O "Recebido" (2.2) soma só `OrigemRenda != null`.
- Relatório pode dizer "R$ X da casa vem de benefício" (Governo) sem expor pessoa.
- Importação de extrato: `Sinonimos` reconhecem "PAGAMENTO BOLSA FAMILIA", "INSS", "SEGURO DESEMPREGO" e sugerem
  a subcategoria; "PIX RECEBIDO" continua sem categoria (não é renda).

### 2.2 Pessoa: previsto × recebido

- **Recebido no mês** = `Σ receitas Executadas do mês com categoria Renda` (qualquer subcategoria), filtro
  `EntraNoResultado`. É o número forte (lição do YNAB).
- **Previsto no mês** = `Σ contas fixas de receita do mês` (já existe: salário, aposentadoria, benefício como
  conta fixa com dia) **+** `RendaVariavelEsperada` (valor que a pessoa digita e muda quando quiser;
  entidade pequena `RendaPrevista { UsuarioId, Mes, Ano, VariavelEsperada }`, uma linha por mês, copia do mês
  anterior quando não há). Sem conta fixa nem variável, o app **sugere** a média dos 3 últimos meses recebidos.
- Tela da pessoa (Visão geral): cartão **"Renda do mês"**: `Previsto R$ 4.200 · Recebido R$ 3.650 · faltam R$ 550`
  e, aberto, a lista de entradas. Mês abaixo do previsto é informação, não alerta.
- Configurações → **"Minha renda"**: a variável esperada, as contas fixas de receita (link), e **por família**
  o nível de visibilidade (2.3).

### 2.3 Família: o que cada um libera (modelo Honeydue aplicado à renda)

`MembroFamilia` ganha `VisibilidadeRenda { Nada = 0, SoPeso = 1 (padrão), ValorParaAlguns = 2, ValorParaTodos = 3 }`
e `RendaVisivelPara: List<Guid>` (só quando `ValorParaAlguns`). **Só a própria pessoa muda o seu**; admin não.
`RendaMensal` (manual, hoje) sai: passa a ser derivada da camada pessoa (2.2). Migration de transição: quem tinha
`RendaMensal` vira `RendaVariavelEsperada` do mês corrente + `SoPeso`.

| Nível | Peso no rateio proporcional | Quem vê o valor | Entra na "renda da casa" de quem olha |
|---|---|---|---|
| Nada | não entra (cai pra parte igual) | ninguém | não |
| Só o peso (padrão) | sim | ninguém | não (aparece "+ renda de Marina, não mostrada") |
| Valor pra alguns | sim | os marcados | só pra os marcados |
| Valor pra todos | sim | todos os membros com permissão Membro/Admin | sim |

Quem é "só vê" (permissão Dependente) **nunca** vê valor de ninguém, em nenhum nível. Peso = previsto (estável);
a família pode trocar a regra pra "recebido do mês" (Regras), aí o peso muda mês a mês.

### 2.4 Família: o que aparece

- **Aba Mês:** "Renda da casa em outubro: R$ 7.900 (previsto R$ 8.400)" **só se pelo menos um membro liberou
  valor pra quem está olhando**; senão o bloco nem aparece. Quem não liberou: "+ renda de Marina, não mostrada".
  Sem ranking, sem "quem ganha mais".
- **Aba Pessoas, ficha do membro:** "Renda: compartilhada com você (R$ X)" / "só o peso" / "não compartilha";
  na **própria** ficha, o controle do nível (o mesmo de Configurações → Minha renda).
- **Regras:** "Divisão proporcional usa: renda prevista | renda recebida do mês".

### 2.5 API

- `GET /renda/mes?mes&ano` → `{ previsto, recebido, variavelEsperada, fixas: [...], entradas: [...] }` (pessoa).
- `PUT /renda/mes` `{ mes, ano, variavelEsperada }`.
- `PUT /familias/{id}/membros/{membroId}/renda-visibilidade` `{ nivel, para: [usuarioId] }` (só o próprio).
- `GET /familias/{id}/renda?mes&ano` → `{ total, previsto, membros: [{ usuarioId, nome, mostrada: bool, recebido?, previsto? }] }`
  calculado **no servidor** com base em quem está pedindo (nunca mandar valor e esconder no front).
- Balanço/rateio proporcional: lê o peso pela regra da família. Remove `PUT /membros/{id}/renda`.

### 2.6 Segurança e LGPD

Renda é dado pessoal sensível na prática (não é "sensível" na lei, mas é o que mais briga gera). O servidor
é quem decide o que sai no JSON (2.5); nunca `rendaMensal` no DTO pra depois o front esconder. Log de segurança
quando alguém pede renda de outro sem permissão (403). Política de Privacidade (P1 já aberta) cita renda e
compartilhamento com a família.

## 3. Ordem de implementação

1. **Pessoa, sem família (vale sozinho):** subcategorias de Renda + `OrigemRenda` (2.1); `RendaPrevista` +
   `GET/PUT /renda/mes` (2.2); cartão "Renda do mês" na Visão geral do v2; "Minha renda" em Configurações.
   DemoSeeder: Gabriel com salário fixo + comissão variável; Marina com Bolsa Família + bico.
2. **Família reflete:** `VisibilidadeRenda` + endpoint (2.3); "Renda da casa" na aba Mês e a linha na ficha
   do membro (2.4); migration tirando `RendaMensal`.
3. **Rateio proporcional** lendo o peso derivado + regra "prevista | recebida" em Regras.

Fora: conta júnior/mesada (visão §16.6), alerta de apostas (Fase 1), Open Finance puxando salário (Fase 4).

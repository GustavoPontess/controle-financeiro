# Família: renda de cada um e o que a família vê

> Pesquisa + proposta (2026-10-18), a pedido do Gustavo: "o app já sabe a renda do mês da pessoa; renda
> variável (comissão, bico) tem que caber; previsto × recebido; só mostra pra família se a pessoa quiser e pra
> quem ela quiser (os filhos não precisam saber); renda do governo entra".
> Status: **proposta, não implementado**. Decisão pendente: agora (bloco C) ou depois das ações de família
> na tela da transação.

## 1. O que o mercado faz

| App | Quem vê o quê | Renda |
|---|---|---|
| **Monarch** (household) | Membro da casa vê **tudo** ("full visibility"). "Shared Views" marca conta/lançamento como *mine / theirs / ours*, mas é **filtro, não privacidade**: não dá pra esconder conta do parceiro ([ajuda](https://help.monarch.com/hc/en-us/articles/42228648365076-Shared-Views-in-Monarch), [casais](https://help.monarch.com/hc/en-us/articles/20926382202004-Monarch-for-Couples)) | Não tem conceito de renda por pessoa; o fluxo de caixa mostra a média de meses |
| **Honeydue** (casal) | Por conta, cada um escolhe: tudo · **só saldo** · nada. É o único com privacidade granular ([Experian](https://www.experian.com/blogs/ask-experian/honeydue-app-review/)) | Não trata renda |
| **YNAB** (together) | Orçamento único, os dois veem tudo; sem esconder conta | Não orça renda futura: só dinheiro que já caiu ("budget only money you have") |
| **Copilot** | Individual | **Expectativa de renda por mês** (muda mês a mês) e marca depósito fora do padrão pra não virar "renda recorrente" ([comparativo](https://joingerald.com/learn/financial-wellness/budgeting-app-variable-income)) |
| **Splitwise / Tricount** | Grupo vê as despesas do grupo | Não existe renda; divisão por percentual fixo |

**Leitura:** ninguém junta as três coisas (renda detectada + previsto/recebido + visibilidade por pessoa). O
mais perto é Honeydue (visibilidade) + Copilot (expectativa mensal). É espaço nosso.

## 2. O Brasil que a feature precisa atender

- **Renda variável é a regra, não a exceção:** informalidade em **37,5%** dos ocupados (PNAD Contínua, nov/25 a
  jan/26; **38,7 milhões** de pessoas) ([IBGE via Portal de Prefeitura](https://portaldeprefeitura.com.br/bastidores-da-politica/brasil-tem-387-milhoes-de-trabalhadores-sem-carteira-assinada-e-sem/610375/)).
  Rendimento médio R$ 3.722 (1º tri/26). Comissão, bico, diária, app de entrega: a renda do mês só se sabe no fim do mês.
- **Renda do governo é renda de família:** Bolsa Família (mínimo R$ 600/família + adicionais por criança,
  gestante e nutriz; paga por final do NIS, escalonado na semana), BPC/LOAS (calendário do INSS), Pé-de-Meia
  (estudante do médio), Gás do Povo (até 15 milhões de famílias do CadÚnico), seguro-desemprego, aposentadoria
  e pensão do INSS ([calendário 2026](https://www.moneytimes.com.br/bolsa-familia-pe-de-meia-gas-do-povo-e-mais-confira-o-calendario-completo-dos-programas-sociais-do-governo-para-2026-isbl/)).
  Hoje o app só tem a categoria "Renda": benefício cai como "Renda" genérica ou some em "Outros".
- **Endividamento recorde:** 81,6% das famílias com dívida, inadimplência 12,3% (CNC/Peic, mai/26); nas
  famílias de até 3 salários mínimos a inadimplência é 38,6%; cartão de crédito é a dívida de 84,6% dos
  endividados ([CNN Brasil](https://www.cnnbrasil.com.br/economia/financas/endividamento-bate-recorde-de-816-das-familias-diz-cnc/)).
- **Apostas:** estudo do Banco Central (ago/24): ~**R$ 3 bilhões** em Pix de famílias do Bolsa Família pra
  bets num mês, ~5 milhões de pessoas, mediana R$ 100; 70% chefes de família; o setor contesta (R$ 210 mi) e o
  STF obrigou a barrar benefício social em bet ([CartaCapital](https://www.cartacapital.com.br/economia/apostas-consumiram-r-3-bi-de-beneficiarios-do-bolsa-familia-em-um-unico-mes-aponta-o-bc/), [O Povo](https://www.opovo.com.br/noticias/economia/2024/11/14/stf-confirma-liminar-que-proibe-uso-de-bolsa-familia-em-bets.html)).
  **Pro produto:** o problema não é "gente burra", é renda que não se enxerga e gasto que não se enxerga. A
  família que vê "entrou R$ 600 do Bolsa Família, saiu R$ 300 em apostas" tem a conversa que hoje não acontece.
  (Categoria "Apostas" própria e o aviso de gasto fora do padrão são da Fase 1, não desta spec.)

## 3. Proposta

### 3.1 Renda deixa de ser número digitado: é o que entrou

- **Renda recebida no mês** = soma das **receitas** da pessoa no mês com **origem de renda** (ver 3.2). Pix de
  amigo, estorno, resgate, transferência entre contas próprias e saldo inicial ficam fora (já são
  `EntraNoResultado = false` ou outra categoria).
- **Renda prevista** = o que a pessoa diz que espera: `fixa` (salário, aposentadoria, benefício) +
  `variável esperada` (comissão, bico), por mês. Pode mudar quando ela quiser; sem ela, o app sugere a **média
  dos últimos 3 meses recebidos**.
- A tela da pessoa mostra: **"Previsto R$ 4.200 · Recebido R$ 3.650 · faltam R$ 550"** e a lista de entradas
  que compõem o recebido. Mês fechado abaixo do previsto não é alerta, é informação.
- O campo manual `MembroFamilia.RendaMensal` (hoje usado no rateio proporcional) passa a ser **derivado**:
  rateio proporcional usa a **renda prevista** (estável) e, quando a pessoa pedir, a **recebida** do mês
  (muda o peso mês a mês). Decisão de produto: padrão = prevista.

### 3.2 Origem de renda (tipos)

Subcategorias de "Renda" (ou campo `OrigemRenda` na receita; decidir na spec técnica):
`Salário` · `Comissão / variável` · `Autônomo / bico` · `Aposentadoria / pensão (INSS)` ·
`Bolsa Família` · `BPC/LOAS` · `Seguro-desemprego` · `Outro benefício do governo (Pé-de-Meia, Gás do Povo…)` ·
`Aluguel recebido` · `Pensão alimentícia recebida` · `Outra renda`.
Governo em bloco próprio pro relatório poder dizer "R$ X da família vem de benefício". Importação de extrato
e categorização automática reconhecem "PAGAMENTO BOLSA FAMILIA", "INSS", "SEGURO DESEMPREGO" pelo texto.

### 3.3 Quem vê (visibilidade por pessoa, modelo Honeydue + o nosso)

Por membro e por família, três níveis, escolhidos **pela própria pessoa**:
1. **Só o peso** (padrão de hoje): a família vê que a renda foi informada e usa o peso no rateio; ninguém vê valor.
2. **Valor pra quem eu escolher:** marca membros (ex.: cônjuge sim, filhos não). Os outros ficam no nível 1.
3. **Nada:** nem peso; no rateio proporcional a pessoa entra como "não informou" (cai pra divisão igual).
Dependente (quem só vê) nunca vê renda de ninguém. Guardar como `VisibilidadeRenda` + lista de `UsuarioId`
autorizados em `MembroFamilia`; o DTO já esconde `RendaMensal` dos outros, estende-se a regra.

### 3.4 O que a família vê no mês (com a visibilidade respeitada)

- **"Renda da casa neste mês: R$ 7.900 · prevista R$ 8.400"**, somando só quem liberou o valor pra quem está
  olhando; quem não liberou aparece como "+ renda de Marina (não mostrada)".
- Sem comparação pessoa × pessoa na tela (sem ranking, sem "quem ganha mais"): o número é da casa.

## 4. Fora desta proposta

- Conta júnior / mesada (visão §16.6). Alerta de gasto com apostas (Fase 1, regras). Open Finance pra
  puxar o salário sozinho (Fase 4).

## 5. Ordem sugerida

1. Origem de renda (3.2) + "Previsto × Recebido" na tela da pessoa (3.1). Vale sozinho, sem família.
2. Visibilidade por pessoa (3.3) + renda da casa (3.4) na aba Pessoas/Mês da família.
3. Rateio proporcional lendo a renda derivada (3.1, último parágrafo).

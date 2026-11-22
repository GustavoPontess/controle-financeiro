# Fatura a detalhar (plano, 2026-11-22)

Pedido do Gustavo, importando os extratos reais do Nubank: o relatório dizia "ainda dá pra gastar R$ 3.512,24" com R$ 428 na
conta. O extrato da conta JÁ diz quanto saiu pro cartão ("Pagamento de fatura, R$ 3.273,80"), mas o app joga esse valor fora
(é só registro) e espera as compras do cartão, que só vêm se a pessoa cadastrar o cartão e importar a fatura.

> "Fica me obrigando a detalhar tudo, sendo que eu já tenho o dado com a informação que eu preciso pra ter um relatório
> correto. E tem que tomar cuidado pra isso não ficar engessado: nem todo banco põe o pagamento de fatura no extrato desse
> jeito." (Gustavo, 2026-11-22)

## A ideia em uma frase

**O que saiu da conta pro cartão já é gasto.** Enquanto as compras do cartão não chegam, esse valor conta como gasto
"Cartão (a detalhar)". Quando as compras chegam, cada uma ocupa o seu lugar (na sua categoria) e o "a detalhar" encolhe
até zero. Detalhar é opcional: quem nunca detalha tem o relatório certo do mesmo jeito, só com menos categoria.

## Hoje x depois

| | Hoje | Depois |
|---|---|---|
| Pagamento de fatura no extrato | só registro, não conta como gasto | gasto "Cartão (a detalhar)" no dia do pagamento |
| Sem cartão cadastrado | o dinheiro some do relatório | conta igual; cadastrar cartão é opcional |
| Importou as compras do cartão | (não dá: o importador recusa cartão) | compras entram no cartão e o "a detalhar" daquela fatura diminui |
| Pagou e detalhou tudo | (não acontecia) | "a detalhar" = 0; só as compras contam, nada em dobro |
| Detalhou mais do que pagou (fatura ainda aberta, pagamento parcial) | (não acontecia) | conta as compras; o "a detalhar" nunca fica negativo |

## Exemplo com os números dele (fatura que venceu em 08/11)

```
Extrato Nubank (conta)         09/11  Pagamento de fatura           R$ 3.273,80
Fatura do cartão (CSV)         compras de 01/10 a 25/10             R$ 3.273,77

Antes de importar a fatura:    gasto de novembro  = R$ 274,90 + R$ 3.273,80 (Cartão, a detalhar)
Depois de importar a fatura:   as compras de outubro entram nas categorias delas (Alimentação, Farmácia...)
                               o "a detalhar" de 09/11 vira R$ 0,03 (diferença de centavos fica visível)
```

Repare: o gasto **muda de mês** quando detalha. O pagamento cai em novembro (o dia em que o dinheiro saiu); a compra é de
outubro (o dia em que gastou). É a mesma regra que o app já usa na visão Gastos (gasto na data em que gastou). Na tela do
mês aparece assim, pra ninguém se assustar: "R$ 3.273,80 pagos de fatura em novembro, já detalhados nas compras de
outubro".

## Como fica na tela

**Relatórios / Dinheiro do mês:** uma linha a mais em "Por categoria", com a ação de detalhar.

```
Por categoria
  Cartão (a detalhar)         R$ 3.273,80   [Detalhar fatura]
  Lazer e entretenimento      R$ 130,00
  ...
```

**Cartões:** cada fatura mostra o quanto já foi detalhado.

```
Nubank · fatura que venceu em 08/11
  Pago               R$ 3.273,80   (09/11, conta Nubank)
  Detalhado          R$ 3.273,77   (24 compras)
  Falta detalhar     R$ 0,03
  [Importar fatura]
```

Sem cartão cadastrado, a pessoa vê só a linha "Cartão (a detalhar)" no relatório. Cadastrar o cartão vira um convite
("Quer ver onde foi esse dinheiro? Importe a fatura"), nunca uma trava.

## Não engessar: cada banco escreve de um jeito

O que muda de banco pra banco e como o plano lida, sem "se for o banco X" no código (mesma regra do importador de CSV):

1. **Como o pagamento aparece no extrato da conta.** Nubank: "Pagamento de fatura". Outros: "PAG FATURA CARTAO", "Pgto
   cartão de crédito", "Boleto ITAU CARD", débito automático com o nome do cartão. Reconhecer:
   - pelas palavras (o `EhPagamentoDeFatura` de hoje vira uma lista de sinônimos em dado, como os `Sinonimos` do CSV);
   - e, quando o app não reconhece, **a pessoa marca**: nos Pendentes, um botão "Foi pagamento de cartão" (o irmão do
     "Foi entre minhas contas"). Ela marca uma vez e vira regra do lugar, como já acontece com a categoria.
2. **Banco que não põe o pagamento no extrato** (cartão de outro banco pago por boleto, ou o banco só mostra "Boleto"):
   cai no caso 1, a pessoa marca "Foi pagamento de cartão". Se nem isso existir (ela pagou em dinheiro), a fatura
   importada conta pelas compras, como hoje.
3. **Qual cartão foi pago.** A conta tem um cartão ligado: é dele. Tem vários, ou nenhum: o pagamento fica "Cartão (a
   detalhar)" sem dono, e na hora de importar a fatura a pessoa escolhe de qual cartão é (uma pergunta só).
4. **O arquivo da fatura.** Nubank manda CSV `date,title,amount` (valor com vírgula; pagamento e crédito negativos). Outros
   mandam OFX de cartão (`CREDITCARDMSGSRSV1`) ou PDF. O importador de cartão usa o mesmo leitor de CSV/OFX que já existe
   (separador, cabeçalho e colunas detectados; banco novo entra como dado). PDF fica fora deste passo.
5. **Linhas da fatura que não são compra.** "Pagamento recebido" (é o outro lado do pagamento da conta: não entra),
   "Crédito de confiança", estorno, IOF, anuidade, juros. Compra entra como despesa do cartão; estorno/crédito como
   devolução; IOF, juros e anuidade como despesa (categoria Impostos e taxas).
6. **Parcelas.** "Parcela 6/12" vira o `Parcelamento` que o app já tem (regra única: compra parcelada é sempre um
   Parcelamento). As faturas "do futuro" que o Nubank manda (2027) só têm parcelas: servem pra conferir, não criam nada
   novo.

## O que muda no código (passos, um PR cada)

1. **A regra.** `RegrasFinanceiras.GastosPorCategoriaDoMesAsync` passa a somar o "a detalhar": para cada pagamento de
   fatura do mês, `max(0, valor pago − compras detalhadas da fatura que ele pagou)`, na categoria virtual "Cartão (a
   detalhar)". Pagamento sem fatura ligada conta inteiro. Uma regra só: Relatórios, Dinheiro do mês, Check-up e
   Orçamento leem dela (nenhuma conta nova no front). Testes: sem cartão, com cartão sem compras, detalhado parcial,
   detalhado total, detalhado a mais, pagamento parcial, dois pagamentos na mesma fatura.
2. **Reconhecer o pagamento.** Sinônimos como dado + botão "Foi pagamento de cartão" nos Pendentes (com regra do lugar).
3. **Importar fatura de cartão.** No Importar extrato, escolher um cartão (hoje só conta). CSV/OFX de cartão, linhas
   classificadas (compra, estorno, taxa, pagamento recebido, parcela), cada compra na fatura do ciclo dela pela regra que
   já existe. Sem limite obrigatório pra cartão criado só pra detalhar (hoje o cadastro exige limite; a trava de limite
   não vale pra compra que veio de extrato, que já aconteceu).
4. **Telas.** Linha "Cartão (a detalhar)" nos relatórios e o quadro "Pago / Detalhado / Falta detalhar" em Cartões.

O que **não** muda: pagamento de fatura continua fora do resultado como lançamento (não vira despesa comum nem ganha
categoria); o "a detalhar" é calculado, não gravado. Assim, detalhar nunca precisa apagar nem editar nada.

5. **Assinaturas do cartão viram conta fixa (pedido do Gustavo 2026-11-22).** As recorrentes dele moram quase todas no
   crédito (Claude, streaming, servidor). Com as faturas no app, a mesma loja com valor parecido em 3+ faturas seguidas
   vira SUGESTÃO de conta fixa no cartão ("Parece que Claude cobra todo mês, R$ 110. Virar conta fixa?"). Nunca cria
   sozinho; a pessoa aceita ou dispensa. A cobrança que já veio na fatura vira a ocorrência daquele mês (sem duplicar).

## Decidido

- 2026-11-22: detalhou, a compra conta no mês em que foi feita (não no mês do pagamento).
- Ainda aberto: fatura antiga que nunca vai ser importada fica "a detalhar" pra sempre (proposta), ou ganha um
  "não vou detalhar"?

## Feito

- Passo 1 (a regra): `RegrasFinanceiras.ADetalharAsync` dentro de `GastosPorCategoriaPorMesAsync`, chave virtual
  `RegrasFinanceiras.CartaoADetalhar` (nome por `NomeDaChaveVirtual`; Orçamento não deixa planejar, check-up não sugere
  cortar). Relatórios leva a linha pra Transações filtrada em pagamento de fatura. Testes: `FaturaADetalharTests`.
- Atenção pro passo 3: ao importar a fatura de um cartão, o pagamento que veio do extrato sem fatura (`FaturaPagaId`
  null) TEM que ser ligado à fatura importada, senão conta duas vezes (pagamento inteiro + compras).
- Passo 2 (2026-11-22): `ImportacaoService.EhPagamentoDeFatura` lê listas (`PalavrasDePagamento`, `PalavrasDoCartao`,
  `NaoEPagamentoDeFatura`), palavra inteira e sem acento: banco novo entra como dado. Pendentes tem "Foi pagamento de
  cartão" (`POST /importacao/pendentes/pagamento-de-cartao`, tudo ou nada, só despesa pendente da conta da pessoa):
  marca `EhPagamentoFatura` e sai da fila. Ainda NÃO aprende regra do lugar (ROADMAP).
- Passo 3 (2026-11-22): `ImportacaoCartaoService` (`POST /importacao/cartao/preview|confirmar`, multipart, confirmar
  com Idempotency-Key). Na tela Importar extrato, seção "Fatura do cartão" (`telas/ImportarFatura.tsx`). Regras:
  - Linha: compra (sinal da maioria do arquivo), pagamento recebido (fica de fora: o dinheiro já saiu da conta), estorno
    (fica de fora por enquanto), **Pix no Crédito** (entra no cartão com `EhPixNoCredito`, sem categoria, fora do
    gasto: o gasto é o PIX que saiu da conta; cada linha entra solta, inclusive "2/2", nunca vira parcelamento).
  - "X - k/N" vira UM `Parcelamento` (`ParcelasPagasAntes` = k−1, parcelas k..N nas faturas do ciclo). Repetido entre
    arquivos sai; duas compras iguais no mesmo arquivo ficam duas.
  - Já no app: à vista pelo FITID ou data/valor/texto; parcelamento pela descrição, N e compra até 40 dias.
  - Compra vem sem trava de limite (já aconteceu) e com a categoria sugerida (sem sugestão vai pra Pendentes).
  - Pagamento da conta ligado à fatura (`ImportacaoCartaoService.Atribuir`): em ordem de data, a fatura mais antiga que
    ainda deve, com o ciclo já começado no dia do pagamento e até 5 dias depois do vencimento. **Pagar adiantado vale**
    (o Nubank deixa, e o Gustavo paga assim). Fica solto ("a detalhar") só o pagamento que cai na janela de uma fatura
    que não veio nos arquivos.
  - Fatura que já venceu e segue devendo conta como paga fora do app (`FaturaAntigaDoBanco`, só registro).
- Passo 4 (2026-11-22): `FaturaDto.ValorADetalhar` (`RegrasFinanceiras.ValorADetalharFatura` = pago − total, nunca
  negativo); Cartões mostra Pago / Detalhado / Falta detalhar com "Importar fatura".
- Passo 5 (2026-11-22): `ContaFixaDoCartaoService` (`GET /cartoes-credito/{id}/sugestoes-conta-fixa`, `POST
  .../dispensar`). Mesmo lugar em 3+ faturas seguidas, até 2 por fatura, valor até 10% do último, último há até 62 dias;
  Pix no Crédito fica fora. "Virar conta fixa" abre Nova conta fixa preenchida começando um mês depois da última
  cobrança (a última já está na fatura). "Não é" grava `SugestaoContaFixaDispensada` (cascade com cartão e pessoa, sai
  na exportação LGPD).
- Conferido com as 23 faturas reais do Nubank no banco local: 364 à vista, 10 parcelamentos, pagamentos da conta
  ligados, sugestão de conta fixa do Claude.

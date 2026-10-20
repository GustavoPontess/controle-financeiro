# Espaço da família: pesquisa e proposta (2026-10-19)

> Pedido do Gustavo, na hora de levar as ações de família pra tela da transação: "essa parte é bem complicada; faz
> uma pesquisa de como essa tela pode ser feita; essa tela é a mais importante que temos pra fazer". Quatro pontos
> dele viram o eixo deste documento. Status: **mapa aprovado em 2026-10-19 ("fechou, pode fazer assim"), decisão 4.2
> aprovada; passo 1 feito (`feat/familia-passo1-parte-gravada`).**

## 1. O que o Gustavo pediu

1. **O passado não muda.** "Dividi com o Gabriel, a gente já pagou algumas contas; se eu mudar a regra, as antigas
   não podem mudar nada, porque já foram pagas."
2. **A família junta as coisas dos dois.** "Era pra ter uma aba de Transações, uma aba de contas fixas ou contas da
   casa; a ideia de lá é juntar as coisas dos dois e está restringindo demais."
3. **O que registro na família tem que bater na minha conta.** "Registrei na família que paguei minha parte da conta
   da casa: isso tem que gerar um registro na minha conta pessoal, saída de dinheiro."
4. **Quem sai da família continua no histórico.** "Se uma pessoa sair da família eu ainda tenho que conseguir ver
   tudo que ela já pagou."

## 2. O que já temos e os buracos (conferido no código em 2026-10-19)

| Peça | Hoje | Buraco |
|---|---|---|
| Dividir uma despesa | `Transacao.FamiliaId` + `StatusAprovacao`; só pelo app antigo | O v2 não tem onde dividir |
| Regra de divisão | `Familia.ModoRateioPadrao` lido **ao vivo** no balanço (`DespesaCompartilhadaService.ObterBalancoAsync`: `despesa.ModoRateio ?? familia.ModoRateioPadrao`); só o modo "Do meu jeito" grava as partes (`RateioTransacao`) | **Mudar o padrão da família reescreve todos os meses passados** (ponto 1) |
| Pela renda | Peso = renda prevista do mês (`RendaService.PesosAsync`) | Editar a renda de um mês antigo muda a divisão daquele mês |
| Equilíbrio do mês | Soma de quem pagou × cota, só dos **membros ativos** | Quem saiu some do balanço dos meses em que estava; as despesas dela continuam no total (ponto 4) |
| "Marcar como feito" (acerto) | `AcertoContas`: só um registro da família (visão §7.4 dizia de propósito "não mexe nas contas reais") | Não gera saída na conta de quem passou nem entrada na de quem recebeu (ponto 3) |
| Sair da família | `MembroFamilia.Ativo = false`; despesas ficam com `FamiliaId` | Lista de despesas segue mostrando; balanço não |
| Excluir a conta (LGPD) | `AdminLgpdService` bloqueia a purga enquanto houver vínculo de família (`DetectarVinculosAsync`); quando purga, **apaga todas as transações** da pessoa, inclusive as divididas | Sem regra de "a família guarda o que a pessoa pagou" |
| Espaço da família (v2) | Visão geral · Despesas compartilhadas · Entre vocês · Membros · Dependentes · Regras | Sem Transações (tudo junto) nem Contas fixas da casa (ponto 2) |

## 3. Como os outros fazem

Fontes oficiais quando existem; onde só havia guia de terceiros, está marcado.

| | Dividir e "sua parte" | Mudar a regra | Quem sai | O dinheiro de verdade | Conta da casa × pessoal |
|---|---|---|---|---|---|
| **Splitwise** | Cada despesa: quem pagou, como divide (igual, %, partes, valor); o app mostra o saldo de cada um | Padrão de divisão do grupo é configuração (Pro) e vale pras **novas**; as antigas se editam uma a uma (guia de terceiros; o Kittysplit, do mesmo tipo, afirma o mesmo) | Sair "não apaga transações passadas"; saldo pendente continua tendo que ser resolvido (guias de terceiros) | "Settle up" é um registro no app; integração bancária é só pra importar | Não tem conta; é tudo despesa do grupo |
| **Tricount** | Igual ao Splitwise; "Total Expenses" é por pessoa | Sem resposta oficial | Dá pra remover participante (release 12.1.2); sem regra publicada pro saldo | "Transfer" = dinheiro entre participantes; "Reimbursements aren't part of those totals" (reembolso fica fora dos totais de gasto) | Não tem |
| **Honeydue** (casal) | "Split Expense" numa transação do extrato; lembrete de conta (quem lembra, quando) | Não se aplica (não tem regra de grupo) | Não se aplica | Contas bancárias reais ligadas; o split é marcação, o pagamento é fora | **Por conta, o dono escolhe:** "Share both balances and transactions", "Share balances only", "Nothing at all"; dá pra esconder **uma** transação |
| **Monarch** (casa) | Não divide: a casa tem **um** orçamento ("we don't currently offer a way to budget separately") | Não se aplica | Não se aplica | Contas reais | Cada conta e transação é "mine, theirs, or ours (shared)"; a transação herda da conta e "can be adjusted individually" |
| **YNAB Together** | Orçamentos compartilhados; o padrão sugerido é cada um ter um orçamento pessoal com uma categoria "Shared Budget" e transferir uma quantia (ou % da renda) pro orçamento da casa | Não se aplica | O gerente convida e remove membros | Dinheiro de verdade: cada um manda a parte pra conta/orçamento da casa | Orçamento da casa à parte do pessoal |

**O que aprendemos:**

- **Ninguém recalcula o passado.** Os apps de divisão guardam a divisão **em cada despesa**; a regra do grupo é só o
  valor inicial das próximas. É o que o Gustavo quer, e é o que o nosso balanço não faz hoje.
- **Quem sai fica no histórico.** Nenhum app apaga as despesas de quem saiu; o saldo em aberto continua existindo.
- **Dois modelos de "casa":** o de divisão (Splitwise/Tricount: tudo é despesa do grupo, cada um tem a sua parte) e o
  de visibilidade (Honeydue/Monarch: cada conta é minha, dele ou da casa, e a casa vê o que foi marcado). O nosso
  diferencial é juntar os dois: **dividir** (com a parte de cada um) **e** ter **contas da casa** cujo movimento já
  nasce da família, sem expor as contas pessoais (visão §8).
- **O dinheiro que passa de um pro outro é um registro à parte dos gastos** (Tricount "reimbursements aren't part of
  those totals"; YNAB move dinheiro de verdade). Pra nós: o acerto vira lançamento real nas duas contas, mas **fora
  do resultado** (não é gasto nem renda), igual ao empréstimo.

## 4. Proposta

### 4.1 A divisão fica gravada na despesa (ponto 1 e ponto 4)

- Ao dividir uma despesa, o app **grava a parte de cada membro** naquele momento (`RateioTransacao`, um item por
  membro que entra na divisão, com % e valor), em **todos** os modos: Igual, Pela renda, Do meu jeito. O modo fica
  gravado só como "como chegou nesses números".
- Mudar a regra da família (Regras) vale **só pras próximas**. A tela avisa: "As despesas já divididas ficam como
  estão." (Depois, se quiser: "Aplicar às deste mês", explícito.)
- O equilíbrio do mês passa a ser **a soma das partes gravadas**, não "membros ativos × regra". Quem saiu continua nas
  despesas em que estava: aparece no equilíbrio daquele mês com o nome e "saiu em out/2026".
- Migration: as despesas já divididas ganham as partes calculadas pela regra atual da família (o que a tela mostra
  hoje), e dali em diante nada mais muda sozinho.

### 4.2 O gasto de cada um é a parte dele (decisão)

Hoje a conta de luz de R$ 180 que o Gustavo pagou e dividiu conta R$ 180 no gasto do mês dele e R$ 0 no do Gabriel.
Com a parte gravada, dá pra fazer o que o Splitwise e o YNAB fazem: **o gasto do mês de cada um é a sua parte**
(R$ 90 e R$ 90). O saldo da conta do Gustavo desce R$ 180 e sobe R$ 90 quando o Gabriel passa a parte dele; o
resultado do mês (renda × gasto, limites, "vai dar?") fica certo pros dois. É o número que responde "estou
comprometendo minha renda?" de verdade. Mexe na regra única do gasto (`RegrasFinanceiras.GastosPorCategoriaDoMesAsync`,
cartão da renda, limites, visão Gastos): a despesa dividida entra pelo valor da parte de quem olha, e a parte dos
outros entra no mês deles. **Recomendação: sim**, porque sem isso a renda do Gustavo aparece "comendo" o que o
Gabriel vai devolver.

### 4.3 O acerto vira lançamento de verdade (ponto 3)

"Pra equilibrar o mês: Gabriel passa R$ 90 pro Gustavo" + **Marcar como feito** passa a funcionar como o pagamento
de empréstimo:

1. Quem passa escolhe **de qual conta saiu** (e a data). Nasce uma **saída** na conta dele, marcada "acerto da
   família" (fora do resultado: não é gasto; o gasto foi a parte dele na conta de luz).
2. Quem recebe vê "Gabriel passou R$ 90 pra você" e **confirma em qual conta entrou**: nasce a **entrada**, também
   fora do resultado. Até confirmar, fica "esperando confirmar" (sem mexer no equilíbrio de quem recebe).
3. Nos extratos os dois lançamentos levam a etiqueta "Acerto · Casa Pontes", como o "Empréstimo".
4. Marcar como feito sem informar conta (o Pix foi de fora e ninguém quer registrar): continua possível, com aviso
   "não cria lançamento". Default é com conta.

### 4.4 O espaço da família junta as coisas dos dois (ponto 2)

Menu da família (ajustado pelo Gustavo em 2026-10-19: "tem páginas que têm que ter na família também; Relatórios;
Dependentes dentro de Membros, são a mesma coisa"): **Visão geral · Transações · Contas fixas · Relatórios · Entre
vocês · Membros · Regras**. Depois, quando a parte pessoal tiver: **Metas da casa** e **Limites da casa**.

- **Membros (com os dependentes dentro):** uma lista só de quem é da casa. Quem tem conta no app (lança, divide,
  vê) e quem não tem (Theo, Bolt: só recebe gasto). Convidar e adicionar dependente na mesma tela; a ficha de cada um
  abre na linha (papel, o que vê, renda liberada, "saiu em…"). A rota `/dependentes` some.
- **Relatórios da família:** o check-up da casa, igual ao pessoal, mas com o dinheiro da família: pra onde foi o
  dinheiro da casa (por categoria), quanto cada um pagou × a parte de cada um, mês a mês, o que foi pros dependentes
  (Theo, Bolt), e as contas fixas da casa × renda da casa (de quem liberou). Segue a decisão de Relatórios ser a
  última tela: a da família nasce junto com a pessoal, com as mesmas peças.

- **Transações (nova):** tudo que é da casa, no mês, numa lista só, do mais recente pro mais antigo:
  - as despesas divididas por qualquer membro (hoje "Despesas compartilhadas", que vira esta aba), com **quem pagou**,
    **sua parte** e a situação (esperando aprovação / dividida);
  - os acertos ("Gabriel passou R$ 90 pro Gustavo");
  - o movimento das **contas da casa** (4.5), quando existirem.
  - Filtros: quem pagou, categoria, situação. Clicar abre a transação (quem lançou edita; os outros veem).
- **Contas fixas (nova):** as contas fixas **da casa** (aluguel, luz, internet, escola do Theo): uma conta fixa de um
  membro marcada "da casa" (`Recorrente.FamiliaId`). Cada cobrança nasce já dividida pela regra da família **naquele
  mês** (parte gravada, 4.1). A aba mostra o que vem este mês, quem paga (a conta de quem) e quanto é a parte de cada
  um; "Pausar/cancelar" segue na conta fixa de quem a criou.
- **Visão geral:** o equilíbrio do mês (como hoje) + "o que ainda vem da casa este mês" (as contas fixas da casa que
  ainda vão cair) + a resposta: "Pra equilibrar o mês, Gabriel passa R$ 90 pro Gustavo" (fato, sem cobrança).
- **Entre vocês:** o que já passou de um pro outro, agora com o lançamento de cada lado e "esperando confirmar".

### 4.5 Contas da casa (modelo Honeydue + Monarch, opcional, passo depois)

Em Bancos e Cartões, cada pessoa pode marcar uma conta ou cartão como **"da casa"** (ex.: a conta conjunta, o cartão
que paga o mercado). Tudo que entra nela:

- aparece na aba Transações da família pros dois;
- **nasce dividido** pela regra da família (parte gravada), sem a pessoa marcar um a um;
- continua sendo da pessoa (saldo, extrato) e é ela quem edita.

As contas **não marcadas** continuam privadas (visão §8: "nada vaza por acidente"). Não precisa do nível "só saldo"
do Honeydue por enquanto.

### 4.6 Quem sai e quem apaga a conta

- **Sair da família:** nada se apaga. As despesas que a pessoa dividiu ficam, com o nome dela; o equilíbrio dos meses
  em que estava continua certo (partes gravadas). Em Membros, aparece "saiu em out/2026". Saldo em aberto no mês em
  que saiu: fica visível pros dois até ser acertado (ou ignorado; é fato, não cobrança).
- **Excluir a conta (LGPD):** hoje a purga é bloqueada enquanto a pessoa tem vínculo de família. Proposta: a pessoa
  pode excluir; os dados **pessoais** somem; as despesas divididas ficam na família com **valor, data, categoria e
  "Membro que saiu"** no lugar do nome (sem e-mail, sem foto). Base: os outros membros têm o próprio histórico
  financeiro nessas despesas; guardar só o mínimo (valor e data, sem identificar) atende a minimização. Confirmar
  em `docs/CONFORMIDADE_BR.md` antes de implementar (dado de terceiro em registro de outro titular).

### 4.7 Cartão compartilhado (ideia do Gustavo, 2026-10-19; proposta, nada feito)

> "Se eu compartilhar o cartão com a família as pessoas conseguem usar o cartão, ou eu compartilho com uma em
> específico se quiser mais controle. Quando a pessoa fizer um lançamento, cai no meu cartão mostrando que foi gasto da
> pessoa, e na família já separa o que a pessoa usou do cartão."

É o **cartão adicional** da vida real (o banco dá um cartão pro cônjuge/filho na mesma fatura). Esboço:

- O dono do cartão escolhe **com quem compartilha**: a família toda (quem lança) ou pessoas específicas. Quem "só vê"
  nunca usa.
- Quem recebeu vê o cartão no formulário da despesa dele ("Cartão do Gustavo") e lança a compra ali. A compra entra na
  **fatura do dono** (limite e fatura são do dono) marcada **"Usado por Gabriel"**.
- A compra é do Gabriel no gasto do mês dele (ele que gastou); o dono pagou a fatura → no equilíbrio da família o dono
  "pagou" e o Gabriel "usou". Na família, uma seção mostra **o que cada um usou do cartão** no mês.
- Controle: o dono pode tirar o acesso a qualquer hora (as compras ficam), e talvez um **limite por pessoa** no mês.
- Segurança: hoje ninguém escreve em cartão de outro usuário (`DonoRecursos`). Isso abre uma escrita cruzada, então
  precisa de permissão explícita por cartão e pessoa, trava de limite do dono, e o dono vê/edita tudo; quem usou só
  edita/exclui o que ele mesmo lançou.

Decisões em aberto (uma por vez, antes de desenhar a tela): quem usou "deve" ao dono ou entra no equilíbrio da casa;
limite por pessoa; se a compra do adicional pode ser parcelada.

## 5. A tela da transação (bloco "Família")

Na página da despesa, abaixo dos dados:

- **Só sua:** "Dividir com Casa Pontes" + "Pra quem" (Theo, Bolt; vale mesmo sem dividir).
- **Dividida:** "Família · Casa Pontes" com a situação (dividida / esperando aprovação), **Como divide** (Igual, Pela
  renda, Do meu jeito; mudar aqui muda **só esta** despesa e regrava as partes), **Parte de cada um** (nome, %, valor),
  **Quem cuida** (só filtro da lista; não muda a divisão), **Pra quem**, e "Parar de dividir".
- No formulário de nova despesa: interruptor **"Dividir com a família"** ("Casa Pontes · igual entre Gustavo e
  Gabriel"); já nasce dividida.
- Despesa dividida por outro membro: a página mostra o bloco só pra ver (quem lançou é quem muda).

## 6. Ordem de construção (passos pequenos, cada um visível no navegador)

1. ✅ **Parte gravada** (2026-10-19): `RateioTransacao.Valor` em todo modo (`RateioService.CalcularPartesAsync`, regra
   única: dividir, mudar o jeito de uma despesa, voltar ao padrão), balanço pelas partes gravadas (quem saiu continua,
   `MembroFamilia.SaiuEm`), gasto do mês = a sua parte (`GastosPorCategoriaDoMesAsync`, inclusive nas despesas dos
   outros), migration `AddRateioCongelado` (as já divididas ganham as partes pela regra que a tela mostrava), aviso
   em Regras, "sua parte" na lista e "saiu em" no equilíbrio.
2. ✅ **Bloco Família na transação** + interruptor no formulário (2026-10-19): página da despesa com o quadro
   Família (`TransacaoFamilia.tsx`): só sua → "Dividir com {família}"; dividida → situação, Como divide (Igual · Pela
   renda · Do meu jeito com % que somam 100; muda só esta despesa), parte de cada um gravada (você primeiro, quem saiu
   com a data, quem só vê fora), Quem cuida dessa conta, Pra quem (dependente; também sem dividir) e Parar de dividir.
   Nova despesa: interruptor "Dividir com {família}" (`POST /transacoes` com `familiaId`, divide no mesmo pedido);
   parcelada ainda não divide (400). Família "Do meu jeito" dividindo sem partes começa igual
   (`RateioService.ModoAoDividir`).
3. ✅ **Acerto vira lançamento** (2026-10-19; decisão do Gustavo: espera quem recebeu confirmar, como o pagamento
   de empréstimo). Só quem passou ou quem recebeu registra ("Eu passei" / "Eu recebi", o dia e a conta). Quem passou
   registra → "Esperando {fulano} confirmar", fora do equilíbrio; quem recebeu confirma dizendo em qual conta entrou
   (ou "Não recebi", que desfaz). Quem recebeu registra → já vale. Cada um lança o SEU lado ("Lançar na minha conta")
   quando quiser; "Não registrar em conta" continua. Os lançamentos levam `Transacao.EhAcerto` (fora do resultado, não
   se editam nem excluem por Transações; "Acerto com Gabriel · Casa Pontes", etiqueta "Acerto"); Desfazer cancela os
   dois. `AcertoService` (idempotência nova `RegistroIdempotencia`, xmin no confirmar/lançar), migration
   `AddAcertoLancamento` (os acertos de antes ficam confirmados).
4. ✅ **Abas Transações e Contas fixas da família** + Membros com os dependentes dentro (2026-10-19). Menu: Visão geral ·
   Transações · Contas fixas · Entre vocês · Membros · Regras (`/despesas` e `/dependentes` levam pras páginas novas).
   **Transações:** despesas divididas + dinheiro entre vocês numa lista só, mais recente primeiro (aguardando
   aprovação no topo), filtros no servidor (quem pagou, categoria, situação; com categoria ou situação o dinheiro entre
   vocês sai) com o mesmo painel "Filtros" das Transações pessoais (`componentes/PainelFiltros`). **Contas fixas:**
   `Recorrente.FamiliaId` ("Dividir com {família}" no formulário da conta fixa, só conta a pagar); cada cobrança nasce
   dividida no molde único `RecorrenteService.GerarOcorrenciasAsync` (parte gravada, sem passar de novo pela aprovação);
   mudar a regra da família regrava só as cobranças PREVISTAS; a aba mostra quem paga, o dia, "Saiu dia / Vem dia" e a
   sua parte (`GET /familias/{id}/contas-fixas`). Prevista não entra em Transações nem no equilíbrio (só o que
   aconteceu). Mudar o valor de despesa dividida regrava as partes com o mesmo % (`RateioService.RegravarPeloValorAsync`).
   **Fica pra depois:** "o que ainda vem da casa este mês" na Visão geral.
5. **Gasto de cada um = sua parte** (se aprovado em 4.2): regra única do gasto + cartão da renda + limites.
6. ✅ **Contas da casa** (4.5; 2026-10-19). `Conta.FamiliaId` e `CartaoCredito.FamiliaId` (migration
   `AddContaCartaoDaCasa`), marcados por "Dividir com {família}" na ficha da conta (Bancos) e no bloco Família da
   página do cartão (`PUT /familias/contas/{id}/casa`, `PUT /familias/cartoes/{id}/casa`; só o dono, só quem lança na
   família, caixinha e conta encerrada não). Regra única `RateioService.DividirSeForDaCasaAsync`: a despesa que NASCE
   ali (lançamento, extrato importado, cobrança de conta fixa) já nasce dividida, com o limite de aprovação de sempre;
   fora o que não é gasto (`EntraNoResultado`), a compra parcelada e quem não lança mais. Marcar/desmarcar vale pras
   próximas. No formulário da despesa, conta/cartão da casa mostra o interruptor ligado e travado. Dinheiro que o outro
   põe na conta da casa é "Dinheiro entre vocês" (a conta é de quem a cadastrou). **Fica pra depois:** aviso pro
   outro membro a cada despesa da casa (hoje só aparece em Transações/aguardando aprovação), parcelada no cartão da
   casa, lançamento movido pra conta da casa na edição.
7. **Sair / excluir conta** (4.6), com a checagem de conformidade.
8. **Relatórios da família** (junto com o Relatórios pessoal, a última tela).

## 7. Decisões pro Gustavo (uma por vez)

1. O gasto do mês de cada um passa a ser **a sua parte** da despesa dividida? (4.2; recomendação: sim)
2. Contas da casa como em 4.5 (marcar conta/cartão "da casa", tudo nela nasce dividido)? Ou só despesa a despesa?
3. Quem exclui a conta: a família guarda valor/data/categoria com "Membro que saiu"? (4.6)
4. Marcar como feito **sem** conta continua existindo? (4.3, item 4)

## Fontes

- Splitwise: [FAQ/knowledge base](https://feedback.splitwise.com/knowledgebase) (títulos); split padrão do grupo (Pro): [App Store, resposta do desenvolvedor](https://apps.apple.com/app/splitwise-bill-splitter/id458023433); sair do grupo não apaga transações: [guia de terceiros](https://robots.net/fintech/how-to-leave-a-group-on-splitwise/)
- Kittysplit (mesmo modelo): [mudar participantes não muda despesas existentes](https://blog.kittysplit.com/families-and-couples-with-shared-expenses/)
- Tricount: [glossário](https://tricount.com/glossary) ("Transfer", "Reimbursements aren't part of those totals"), [FAQ](https://help.tricount.com/articles/tricount-faqs), [casais](https://tricount.com/en-nl/couples)
- Honeydue: [o que o parceiro vê, por conta](https://support.honeydue.com/en/articles/3283211-how-to-change-what-my-partner-can-see); split e lembretes de conta: [Experian](https://www.experian.com/blogs/ask-experian/honeydue-app-review/), [Clark](https://clark.com/personal-finance-credit/budgeting-saving/honeydue/)
- Monarch: [Shared views (mine / theirs / ours)](https://www.monarch.com/blog/shared-views), [para casais](https://www.monarch.com/for-couples)
- YNAB: [YNAB Together](https://www.ynab.com/ynab-together), [finanças separadas e orçamento conjunto](https://www.ynab.com/blog/discussion-best-practices-for-separate-finances-and-joint-budget)

# Feature — Empréstimo: forma de pagamento (parcelas/juros/multa) + agrupar por pessoa

> Spec curta (spec-driven, CLAUDE.md §Processo). **Status: forma de pagamento (parcelas/juros/multa)
> implementada em 2026-08-05 — ver seção "Implementação" no fim.** Agrupar por pessoa (seção 3)
> continua spec-only, ⚪ P3. Consolida os achados já catalogados no ROADMAP (linhas "parcelamento +
> extrato embutido" e "agrupar por pessoa"), especificados em detalhe a pedido do Gustavo em
> 2026-08-05 — testando ao vivo o fluxo de pagamento com aprovação, ele bateu em dois problemas
> reais: (1) hoje não existe forma de pagamento combinada (parcelado? juros? multa por atraso?), só
> um valor total com pagamentos avulsos acumulando; (2) 2+ empréstimos com a mesma pessoa aparecem
> soltos, sem visão consolidada.

## Problema

`Emprestimo` hoje é só `ValorTotal` + `ValorPago` (acumulado por solicitações avulsas, feature
`pagamento-aprovacao.md`). Isso cobre "fulano vai me pagando aos poucos", mas não cobre o caso comum
de dinheiro emprestado **com combinação prévia**: quantas parcelas, quando vence cada uma, se tem
juros, se tem multa por atraso. Sem isso:
- Não dá pra saber, olhando o app, se a próxima parcela está em dia ou atrasada.
- Pagamentos parciais viram uma lista plana de solicitações — sem ligação a "isso quita a parcela de
  outubro".
- Duas pessoas com quem você tem múltiplos empréstimos ativos (ex.: emprestou 2x pro mesmo amigo)
  aparecem como itens desconexos, sem visão "total dessa pessoa".

## Decisão de modelagem — não reaproveitar `Parcelamento`/`ParcelaTransacao`

Avaliado (era a dúvida registrada no ROADMAP). `Parcelamento` é fortemente acoplado a
`CartaoCredito` (`CartaoCreditoId` obrigatório, comentário no código: "ContaId não suportado no
MVP") e `ParcelaTransacao` exige `FaturaId` (agrupamento por fatura de cartão). Empréstimo
pessoa-a-pessoa não tem cartão nem fatura — é conta-a-conta. Forçar o reaproveitamento exigiria
afrouxar `CartaoCreditoId`/`FaturaId` pra opcional num modelo pensado pra outra coisa, mais
confuso que um modelo novo e simples. **Decisão: entidade própria, mais simples, sem Fatura.**

## Comportamento

### 1. Forma de pagamento (na criação do empréstimo, opcional)

Ao criar (ou depois, se ainda não vinculado — mudar forma de pagamento de um empréstimo já
`Vinculado` exige acordo dos dois lados, fora de escopo v1), escolher:
- **À vista** (padrão atual — sem mudança, `ValorTotal` único, sem parcelas).
- **Parcelado** — `QuantidadeParcelas` (2-36, mesmo range do `Parcelamento` existente),
  `PrimeiroVencimento` (data), intervalo mensal fixo entre parcelas (v1 não cobre intervalo
  customizado tipo quinzenal). Gera N `EmprestimoParcela` com `Valor = ValorTotal / N` (ajuste de
  centavos na última parcela, mesmo padrão usado no `Parcelamento` de cartão).
- **Juros** (opcional, só se parcelado) — `TaxaJuroMensal` (%), aplicado **simples sobre o valor da
  própria parcela** (`ValorComJuros = Valor * (1 + TaxaJuroMensal / 100)`), não sobre saldo devedor
  nem composto entre parcelas — mais simples de explicar e mais comum em empréstimo informal
  (decisão do Gustavo, 2026-08-05). Se informado, `EmprestimoParcela.ValorComJuros` é calculado na
  geração.
- **Multa por atraso** (opcional) — `PercentualMultaAtraso` (%), **livre, sem teto/mínimo** (usuário
  digita o combinado), aplicado **uma vez** sobre o valor da parcela quando ela vira `Atrasada` (v1
  não faz juros de mora diário — só multa fixa única, como a maioria dos combinados informais entre
  pessoas físicas).

### 2. Parcelas — estado e visualização

Cada `EmprestimoParcela`: `Numero`, `DataVencimento`, `Valor`, `ValorComJuros?`,
`ValorComMulta?` (calculado só quando vence sem pagamento), `Status`
(`Pendente|Paga|Atrasada|Cancelada`), `SolicitacaoPagamentoId?` (liga à
`EmprestimoPagamentoSolicitacao` — **reaproveita o fluxo de comprovante+aprovação já existente**,
só que agora uma solicitação pode apontar pra uma parcela específica em vez de só abater do total
"cego"). `Atrasada` é calculado (não é um job — igual o padrão de `Vencido` no `EmprestimoDto` atual:
`DataVencimento < hoje && Status == Pendente`), sem necessidade de Hangfire novo.

**UI:** card do empréstimo na lista ganha um **expandir** (chevron) quando `FormaPagamento =
Parcelado`. Expandido, mostra a lista de parcelas: número, vencimento, valor (com badge se atrasada
ou com multa aplicada), status, e — se paga — qual solicitação de pagamento a quitou (link pro
histórico já existente). Mesmo espírito visual do "Ver histórico de pagamentos" atual, mas por
parcela em vez de por solicitação avulsa.

### 3. Agrupar por pessoa

Quando 2+ `Emprestimo` ativos (`!Quitado`) têm a **mesma contraparte vinculada**
(`ContraparteUsuarioId` igual, `StatusVinculo = Vinculado`), a lista os agrupa visualmente sob um
cabeçalho com o nome da pessoa + saldo consolidado (soma dos restantes). Cada empréstimo continua
como item próprio dentro do grupo — **agrupar é só visual (UI), não uma fusão de dados**. Empréstimo
com pessoa não-vinculada (ainda sem conta no Pontes) não agrupa — não há como garantir que é "a
mesma pessoa" sem vínculo confirmado.

**Fora de escopo v1** (mas desenhado pra não travar isso depois): **unificar/consolidar** múltiplos
empréstimos num único plano de parcelas novo (tipo refinanciamento bancário — soma saldos, redefine
parcelas). É uma operação bem mais delicada (o que acontece com o histórico dos empréstimos
originais? viram `Quitado` com uma nota "consolidado em X"?) — decisão que precisa de mais conversa
com o Gustavo antes de especificar. Fica registrada como ⚪ P3 separada, depende desta feature já
estar no ar.

## Modelo de dados (rascunho)

**`Emprestimo`** — novos campos:
- `FormaPagamento` (enum novo `FormaPagamentoEmprestimo`: `AVista=1`, `Parcelado=2`)
- `TaxaJuroMensal` (decimal?, só se `Parcelado`)
- `PercentualMultaAtraso` (decimal?, opcional mesmo se `Parcelado`)

**`EmprestimoParcela`** (nova entidade):
- `Id`, `EmprestimoId` (FK), `Numero` (int), `QuantidadeTotal` (int, snapshot),
  `DataVencimento` (DateTime), `Valor` (decimal), `ValorComJuros` (decimal?),
  `ValorComMulta` (decimal?, calculado quando atrasa), `Status` (enum `StatusParcelaEmprestimo`:
  `Pendente=1`, `Paga=2`, `Cancelada=3` — `Atrasada` é calculado, não persistido, mesmo padrão do
  `Vencido` do `Emprestimo`), `SolicitacaoPagamentoId` (Guid?, FK →
  `EmprestimoPagamentoSolicitacao`), `CriadoEm`.

Migration nova (nome a definir na implementação).

## API (rascunho)

| método | rota | efeito |
|---|---|---|
| `POST` | `/emprestimos` (payload estendido) | `FormaPagamento`, se `Parcelado`: `QuantidadeParcelas`+`PrimeiroVencimento`+`TaxaJuroMensal?`+`PercentualMultaAtraso?` → gera as `EmprestimoParcela` junto |
| `GET` | `/emprestimos/{id}/parcelas` | lista as parcelas (qualquer participante) |
| `POST` | `/emprestimos/{id}/solicitar-pagamento` (endpoint existente) | ganha `ParcelaId?` opcional — se informado, a solicitação mira aquela parcela específica; aprovação marca a parcela `Paga` além de avançar `ValorPago` do total |

## Casos extremos

- **Empréstimo parcelado, devedor paga fora de ordem** (quita parcela 3 antes da 1) — v1 permite
  (não força ordem), cada parcela é independente.
- **Empréstimo parcelado sem vínculo ainda** (`StatusVinculo != Vinculado`) — parcelas existem mas
  `solicitar-pagamento` continua bloqueado até vincular (mesma regra atual).
- **Multa aplicada, depois a parcela é paga** — `ValorComMulta` fica congelado no valor calculado na
  data em que atrasou (não recalcula toda vez que a tela renderiza) — snapshot na primeira detecção,
  não um valor "flutuante".

## Fora de escopo (v1)

- Unificar/consolidar múltiplos empréstimos (ver seção 3 acima) — ⚪ P3 separada.
- Juros compostos, juros de mora diário, intervalo de parcela não-mensal (quinzenal/semanal).
- Editar forma de pagamento de um empréstimo já `Vinculado` (exigiria acordo das duas partes — fluxo
  de "proposta de mudança" fica pra depois se for pedido).
- Notificação automática de parcela vencendo em breve (fica pro job de lembrete geral, se existir).

## Decisões do Gustavo (2026-08-05)

1. **Multa por atraso: livre, sem teto/mínimo.** Usuário digita o percentual que combinou com a
   outra parte — sem validação de faixa. Ajusta a seção 1 acima: "aplicado **uma vez** sobre o valor
   da parcela" já está certo, só a falta de teto que fica explícita aqui.
2. **Juros: sobre o valor da parcela, não sobre saldo devedor.** Mais simples de explicar e mais
   comum em empréstimo informal. **Corrige a seção 1 acima** — o texto dizia "sobre o saldo devedor
   remanescente", isso está **desatualizado**; o cálculo real na implementação é
   `ValorComJuros = Valor * (1 + TaxaJuroMensal / 100)`, por parcela, sem efeito cascata entre
   parcelas.
3. **Prioridade: P1.** Já estamos com o módulo de empréstimo aberto e mexendo bastante nele —
   prioriza terminar aqui antes de abrir frente nova (ex.: conferência de caixa, que também é P1 mas
   fica pra depois).

## Implementação (2026-08-05)

Seções 1 e 2 (forma de pagamento + parcelas) implementadas como especificado, com um ajuste real
de escopo em relação ao rascunho original da API:

- **Vínculo solicitação↔parcela é pela solicitação, não pela parcela.** O rascunho original previa
  só `EmprestimoParcela.SolicitacaoPagamentoId?`, setado desde a solicitação. Na implementação,
  `EmprestimoPagamentoSolicitacao` ganhou `ParcelaId?` (a solicitação aponta pra parcela, não o
  contrário) — a parcela só recebe `SolicitacaoPagamentoId` e vira `Paga` **na aprovação**, não na
  solicitação. Motivo: uma solicitação pendente não deveria travar a parcela antes de aprovada (senão
  uma rejeição deixaria a parcela num limbo). Trava equivalente: não pode haver 2 solicitações
  não-rejeitadas pra mesma parcela.
- **Multa calculada e persistida (snapshot) na primeira leitura após o vencimento** — `GET
  /emprestimos/{id}/parcelas` detecta parcelas recém-atrasadas e grava `ValorComMulta` na hora,
  sem job novo (como a spec previu). Verificado por teste (`ListarParcelasAsync_ParcelaAtrasadaComMulta_CalculaESnapshotaValor`).
- **Endpoint final:** `GET /emprestimos/{id}/parcelas` (igual ao rascunho). `POST
  /emprestimos/{id}/solicitar-pagamento` ganhou `ParcelaId?` no lugar do `parcelaId` opcional já
  desenhado.
- **Frontend:** forma de pagamento (À vista/Parcelado) no form de criar, com quantidade/vencimento
  da 1ª parcela/juros/multa condicionais; lista de empréstimos ganhou badge "Parcelado Nx" + chevron
  que expande as parcelas (número, vencimento, valor com juros/multa, status); modal "Marcar como
  pago" ganhou seletor de parcela (obrigatório) quando o empréstimo é Parcelado, pré-preenchendo o
  valor com `valorComMulta ?? valorComJuros ?? valor`.
- **Achado ao vivo durante a verificação no browser:** `formatDate` da página formatava com
  `toLocaleDateString("pt-BR")` sem fixar fuso — em fuso negativo (Brasil), qualquer data-calendário
  de meia-noite UTC exibia o dia anterior (10/08 virava 09/08 na tela, dado no banco correto).
  Corrigido nesta página (`Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" })`); o mesmo padrão ainda
  existe em 8 outros arquivos do front — catalogado no ROADMAP como achado P1 separado, não corrigido
  nesta sessão (fora do escopo desta feature).
- Back 373/373 (+14 testes), front 325/325 (+3 testes). Verificado ao vivo no browser: criar
  empréstimo parcelado com juros, expandir e ver as 4 parcelas com valor e vencimento corretos.

## Referências

- `docs/features/emprestimo-compartilhado/spec.md` — vínculo bilateral (base).
- `docs/features/emprestimo-compartilhado/pagamento-aprovacao.md` — fluxo de solicitar/aprovar
  pagamento, reaproveitado aqui por parcela.
- `ControleFinanceiro.Api/Domain/Entities/Parcelamento.cs` +
  `ControleFinanceiro.Api/Domain/Entities/ParcelaTransacao.cs` — avaliados e descartados pra reuso
  direto (acoplamento a cartão/fatura).
- ROADMAP.md — achados originais "parcelamento + extrato embutido" (P2) e "agrupar por pessoa" (P3).

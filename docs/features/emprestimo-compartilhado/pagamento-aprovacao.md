# Feature — Empréstimo: pagamento com comprovante + aprovação do credor

> Spec curta (spec-driven, CLAUDE.md §Processo). Registrada no ROADMAP como P1 (achado 2026-07-20,
> testando o vínculo bilateral). Status: **spec — não implementado**. Extensão de
> `docs/features/emprestimo-compartilhado/spec.md` — reaproveita a arquitetura de aprovação já
> construída na Feature 2.4 (`Familia.LimiteAprovacao`/`Transacao.StatusAprovacao`), não desenha do
> zero.

## Problema

Hoje, mesmo depois do vínculo bilateral (`StatusVinculo = Vinculado`), só o **credor** tem
qualquer ação sobre o empréstimo — `RegistrarPagamento`/`Quitar`. O **devedor** não tem nada: só
visualiza. Na prática, quem paga (devedor) fez o Pix de verdade, mas depende 100% do credor lembrar
de entrar no app e marcar como recebido — sem isso, o registro fica desatualizado indefinidamente e
o devedor não tem como provar que pagou dentro do próprio app.

## Comportamento

Devedor de um empréstimo `Vinculado` pode **solicitar pagamento**: informa o valor + anexa um
comprovante — a mesma mecânica de criar-empréstimo-com-transação-vinculada já existe
(`ContaId`+`CategoriaId` → cria uma `Transacao` real na conta do devedor, `Tipo = Despesa`, já que é
ele saindo do bolso pra pagar). Isso cria uma solicitação com `StatusAprovacao = Pendente` — **não
mexe em `ValorPago` ainda**.

**Duas formas de comprovar** (mesmo raciocínio anti-duplicação do lado do credor na aprovação —
achado ao vivo testando o fluxo, 2026-08-05): (1) informar `ContaId`+`CategoriaId`+`Valor`+`Data` pra
criar a `Transacao` de saída na hora, ou (2) informar `TransacaoExistenteId` pra **vincular uma
despesa que já lançou por fora** (viu o Pix sair e registrou antes de vir marcar o empréstimo como
pago) — evita duplicar a saída. Nesse segundo caso `Valor` da solicitação vem da própria transação
(fonte da verdade), não do que o usuário digitou. Validação: a transação precisa ser `Despesa`,
pertencer a quem está solicitando, e não estar vinculada a outra solicitação **não-rejeitada** (uma
rejeitada libera a transação pra reaproveitar — reenviar ou uma nova solicitação, tanto faz).

Só o **credor** (mesma regra assimétrica por `Tipo` já usada em `RegistrarPagamento`/`Quitar`) pode:
- **Aprovar** → **sempre registra a entrada de verdade**, dois caminhos possíveis, um deles
  obrigatório (decidido com o Gustavo em 2026-08-05 — "não quero registrar entrada" **não pode ser
  opção**, dinheiro recebido tem que aparecer na conta do credor também, sem exceção): (1)
  `TransacaoExistenteId` — vincula uma receita já lançada por fora (viu o Pix cair e registrou antes
  de ver a solicitação pendente), evita duplicar; ou (2) `ContaId`+`CategoriaId` — cria a `Transacao`
  real de entrada (`Tipo = Receita`) agora. Depois de resolvido, `ValorPago` avança (mesmo
  clamp/lógica de `Quitado` que `RegistrarPagamentoAsync` já tem).
- **Rejeitar** → nenhuma `Transacao` é criada, `ValorPago` não muda; solicitação fica marcada como
  rejeitada (histórico, não desaparece). **A `Transacao` comprovante do devedor não é alterada nem
  apagada** — o dinheiro realmente saiu da conta dele quando ele solicitou; rejeição é só o credor
  dizendo "não bateu/não recebi isso", não desfaz o gasto real do devedor.

**Reenviar após rejeição.** O devedor (só quem solicitou originalmente) pode reenviar uma
solicitação `Rejeitada` — volta pra `Pendente`, mesma `Transacao` comprovante (não cria outra),
credor é notificado de novo. Cobre o caso de rejeição por engano ou desentendimento resolvido fora
do app.

Credor **não pode aprovar/rejeitar solicitação de empréstimo em que ele mesmo é o solicitante** —
não existe esse caso na prática (só devedor solicita), mas a checagem entra por segurança (mesmo
espírito do `if (transacao.CriadoPor == usuarioId) throw ForbiddenAccessException` da 2.4).

### UI/UX — escolha explícita, nunca padrão silencioso

Decidido com o Gustavo em 2026-08-05: em todo ponto da feature onde existe risco de duplicar um
lançamento (empréstimo criado, devedor marca como pago, credor aprova), a tela **força uma escolha
explícita** — nunca um checkbox desmarcado por padrão que silenciosamente significa "não faz nada" ou
"já foi feito". O formulário bloqueia o envio até a pessoa escolher uma opção (mesmo padrão de
`PontesField error=` já obrigatório em todo form do projeto).

- **Devedor marca como pago** — 2 opções, nenhuma pré-selecionada: "Já lancei essa saída em outro
  lugar" (abre um dropdown de despesas recentes pra vincular) ou "Ainda não lancei, lançar agora"
  (abre conta+categoria). Comprovante é sempre obrigatório — não existe terceira opção "não
  registrar".
- **Credor aprova** — mesmas 2 opções, espelhadas: "Já registrei essa entrada" (dropdown de receitas
  recentes) ou "Vou registrar agora" (conta+categoria). Também sem opção de pular — ver decisão
  acima.
- **Criar empréstimo** — 3 opções, porque aqui "ainda não movimentei esse dinheiro" é um estado real
  e comum (empréstimo combinado mas o Pix ainda não saiu): "Ainda não movimentei" (não cria/vincula
  nada), "Já lancei em outro lugar" (dropdown) ou "Vou lançar agora" (conta+categoria).

**Múltiplas solicitações ao longo do tempo são esperadas** (pagamento em partes) — cada uma é um
registro próprio, histórico completo fica visível (não é "1 pendência por vez" bloqueando as
próximas). Parcelamento formal (parcelas com vencimento) é feature separada, já registrada no
ROADMAP — aqui é só histórico de solicitações avulsas.

## Modelo de dados

Nova entidade **`EmprestimoPagamentoSolicitacao`** (não reaproveita `StatusAprovacaoDespesa` da
Família — mesmo padrão, enum próprio, domínios diferentes):

- `Id` (Guid)
- `EmprestimoId` (Guid, FK → `Emprestimo`)
- `Valor` (decimal)
- `TransacaoComprovanteId` (Guid**?**, FK → `Transacao`) — obrigatório quando quem registra é o
  **devedor** (não existe solicitação dele sem comprovante); **null** quando é o **credor** que
  registra o próprio recebimento (nullable desde 2026-08-08, migration
  `TornarComprovanteOpcionalPagamentoEmprestimo` — antes era obrigatório sempre, quebrava o caminho
  do credor por não ter "saída do devedor" nenhuma pra referenciar)
- `SolicitadoPor` (Guid — quem registrou; devedor OU credor desde a unificação)
- `StatusAprovacao` (enum novo `StatusAprovacaoPagamentoEmprestimo`: `Pendente=1`, `Aprovada=2`,
  `Rejeitada=3`)
- `AprovadoPorUsuarioId` (Guid?), `AprovadoEm` (DateTime?)
- `TransacaoRecebimentoId` (Guid?, FK → `Transacao`) — entrada real na conta do credor, só setado
  na aprovação
- `MotivoRejeicao` (string?, opcional) — texto livre que o credor pode escrever ao rejeitar;
  entra na notificação pro devedor e fica visível no histórico (decisão de 2026-08-06)
- `CriadoEm` (DateTime)

`EmprestimoPagamentoSolicitacaoDto` (resposta da API) ganhou `RegistradoPeloCredor` (bool,
2026-08-08) — `true` quando `AprovadoPorUsuarioId == SolicitadoPor` (só acontece no caminho
credor-registra-e-já-aprova; o fluxo normal devedor→credor proíbe autoaprovação). Front usa isso
pra não mostrar "Saída: ..." no histórico quando não existe comprovante de saída nesse caminho.

Migration: `AddPagamentoAprovacaoEmprestimo`.

`FinancialEventType` novo bloco (próximo livre = 75): `EmprestimoPagamentoSolicitado = 75`,
`EmprestimoPagamentoAprovado = 76`, `EmprestimoPagamentoRejeitado = 77`.

`TipoNotificacao` novo: `EmprestimoPagamentoSolicitado = 10` (notifica credor),
`EmprestimoPagamentoAvaliado = 11` (notifica devedor quando aprovado/rejeitado).

## API

| método | rota | quem | efeito |
|---|---|---|---|
| `POST` | `/emprestimos/{id}/solicitar-pagamento` | devedor OU credor do registro (unificado 2026-08-08, ver seção própria abaixo) | devedor: cria `Pendente` + comprovante (Despesa). Credor: cria já `Aprovada` + recebimento (Receita), avança `ValorPago` na hora |
| `GET` | `/emprestimos/{id}/solicitacoes` | qualquer participante (credor ou devedor) | lista histórico de solicitações, com data+conta de cada lançamento vinculado (comprovante e, se houver, recebimento) — leitura tipo extrato, não só status |
| `POST` | `/emprestimos/solicitacoes/{solicitacaoId}/aprovar` | credor do registro | body `{ contaId?, categoriaId? }` → se informados, cria `Transacao` de entrada; sempre `Aprovada` + avança `ValorPago` |
| `POST` | `/emprestimos/solicitacoes/{solicitacaoId}/rejeitar` | credor do registro | body `{ motivo? }` opcional → `Rejeitada`, `ValorPago` intacto, motivo (se informado) vai na notificação e fica no histórico |
| `GET` | `/emprestimos/solicitacoes-pendentes` | usuário logado | solicitações pendentes onde eu sou credor (pra badge/lista, mesmo padrão de `convites-pendentes`) |
| `POST` | `/emprestimos/solicitacoes/{solicitacaoId}/reenviar` | quem solicitou originalmente, só se `Rejeitada` | volta pra `Pendente`, mesma `Transacao` comprovante, notifica credor de novo |

`SolicitarPagamentoAsync` aceita `IdempotencyKey` (mesmo padrão das outras mutações financeiras).

## Autorização (o ponto que mais importa, igual na spec original)

**Pedido do Gustavo em 2026-08-06:** documentar por completo — essa feature tem regra pra tudo
quanto é lado, e é fácil confundir "quem pode disparar a ação" com "quem precisa concordar pra ela
valer". As duas coisas são diferentes e a tabela abaixo separa isso.

### Quem pode disparar cada ação

| ação | quem pode | efeito |
|---|---|---|
| Registrar pagamento (devedor OU credor, mesmo endpoint — ver seção própria) | qualquer um dos dois participantes | devedor: `Pendente`, **não muda nada sozinho**. Credor: já `Aprovada`, `ValorPago` avança na hora |
| Aprovar solicitação `Pendente` de um devedor | só o credor do registro | `ValorPago` avança de verdade, `Transacao` de entrada criada/vinculada |
| Rejeitar solicitação `Pendente` de um devedor | só o credor do registro | nada muda no `Emprestimo`; comprovante do devedor continua valendo |
| Reenviar solicitação rejeitada | só quem solicitou originalmente (o devedor) | volta pra `Pendente`, credor notificado de novo |
| Ver histórico de solicitações | qualquer um dos dois participantes | só leitura |
| Quitar (marca 100% pago de uma vez, sem passar por parcela/solicitação) | só o credor do registro | avança `ValorPago`/`Quitado` na hora |
| Vincular (convite de vínculo) | só o `CriadoPor` do empréstimo | dispara convite — **não vincula sozinho**, ver abaixo |
| Aceitar/Recusar convite de vínculo | só quem recebeu o convite (e-mail bate) | só aqui o vínculo passa a valer |

Reaproveita `EhCredor(Emprestimo, usuarioId)` já existente no `EmprestimoService` — devedor é
"não-credor" entre os dois participantes de um registro `Vinculado`. Testar os dois `Tipo`
explicitamente (mesmo aviso da spec original: é fácil inverter essa regra por engano).

### Ações unilaterais × ações que precisam da outra parte concordar

**Unilateral (efeito imediato, a outra parte só fica sabendo depois, via notificação):**
Aprovar, Rejeitar, Registrar pagamento direto, Quitar. Nenhuma dessas espera confirmação de
ninguém — quem tem a permissão age e o registro muda na hora. A `EhCredor` check garante que só
quem devia ter esse poder o exerce; a outra parte não tem voz sobre acontecer ou não.

**Bilateral (a ação de uma parte só produz efeito real depois que a outra confirma):**
- **Vincular** — o convite (`VincularAsync`) não vincula nada sozinho, só cria
  `StatusVinculo = PendenteAceite`. Só `AceitarVinculoAsync`/`AceitarVinculoPorIdAsync` (disparado
  pelo CONVIDADO, não por quem convidou) muda pra `Vinculado`. Até lá, o empréstimo se comporta como
  se não tivesse segunda parte nenhuma.
- **Solicitar pagamento** é, na prática, também bilateral mesmo sem ter esse nome: o devedor
  "propõe" que pagou (`Pendente`), mas **nada no saldo muda até o credor aprovar**. A diferença pro
  vínculo é que aqui existe um terceiro estado explícito (`Rejeitada`) que não invalida o que o
  devedor fez fora do app (a `Transacao` comprovante continua valendo) — só significa "o credor não
  confirma que bateu, mas o dinheiro que você gastou/mandou continua registrado do seu lado".

### Toda ação que muda algo fica registrada (o "sistema de arquivo" pedido pelo Gustavo)

Todo ponto que já muda estado ou dinheiro grava `FinancialEventLog` (auditoria — nunca só UI) **e**
dispara `Notificacao` pra quem precisa saber:

| evento | quem é notificado | mensagem |
|---|---|---|
| Devedor solicita pagamento | credor | "Fulano marcou R$X como pago em 'Y' — confirme o recebimento." |
| Credor aprova | devedor | "Seu pagamento de R$X em 'Y' foi confirmado." |
| Credor rejeita | devedor | "Seu pagamento de R$X em 'Y' foi rejeitado." + motivo, se o credor escreveu um (ver abaixo) |
| Devedor reenvia após rejeição | credor | "Fulano reenviou R$X em 'Y' — reavalie." |
| Credor propõe vínculo | contraparte (se já tem conta) | "Fulano quer vincular um empréstimo com você." |
| Contraparte aceita vínculo | credor | "Fulano aceitou o vínculo do empréstimo 'Y'." |

Nenhuma dessas notificações é opcional/silenciosa — é o mecanismo que garante que "rejeitei"
sempre chega pra quem mandou, mesmo que a pessoa não esteja olhando a tela na hora.

### Motivo da rejeição (decidido 2026-08-06)

`RejeitarPagamentoSolicitacaoAsync` ganha `Motivo` opcional (texto livre, sem tamanho mínimo —
credor pode rejeitar seco, sem digitar nada, se quiser rapidez). Quando informado, entra na
notificação (`"...foi rejeitado: {motivo}"`) e fica gravado na solicitação
(`EmprestimoPagamentoSolicitacao.MotivoRejeicao`), visível no histórico junto do badge
"Rejeitada" — assim o devedor sempre vê o porquê antes de decidir se reenvia (e o reenvio já
existe, `ReenviarPagamentoSolicitacaoAsync`, sem mudança).

### Barra de progresso com 3 cores (decidido 2026-08-06)

Pedido do Gustavo: a barra de progresso do empréstimo não pode só mostrar `ValorPago` confirmado —
precisa deixar visível que existe dinheiro "em trânsito" (solicitado, aguardando aprovação) e
dinheiro que já foi recusado, **sem que isso altere o saldo real de ninguém** ("ninguém pode
alterar nada na conta de ninguém só porque recusou — deve ficar o registro mostrando pra ela que
ela falou que foi pago e que a pessoa recusou").

`EmprestimoDto` ganhou dois campos agregados, só informativos (não entram em `ValorPago`/
`PercentualPago`, que continuam só refletindo aprovações reais):
- `ValorPendente` — soma das solicitações `Pendente` do empréstimo.
- `ValorRecusado` — soma das solicitações `Rejeitada`.

Frontend: a barra usa `PontesProgress` (biblioteca Pontes, componente estendido pra suportar
`segments` — barra empilhada com N cores, ver `docs/DESIGN_SYSTEM.md`/showroom `/design-system`)
com 3 fatias: verde (`var(--pontes-success)`, confirmado), laranja (`var(--pontes-warning)`,
pendente), vermelho (`var(--pontes-danger)`, recusado). Cada fatia tem `title` com o valor, visível
no hover. Antes disso a barra usava `data-tone={isEmprestei ? "success" : "danger"}` (cor por
direção do empréstimo, não por status) — trocado porque status de confirmação é a informação mais
importante aqui; direção continua visível pelo ícone/valor do item.

### Banners de pendência viraram `PontesAlert` (achado UI, 2026-08-06)

Os banners "N convites pendentes" e "N pagamentos aguardando aprovação" usavam um `PontesCard`
com CSS ad-hoc (`.pendentesCard`) fora do padrão da biblioteca — Gustavo apontou que "tá fora dos
nossos padrões, tá feia". Trocado por `PontesAlert tone="warning"` (componente já existente na
lib, usado em outras telas pra banner inline com ícone+borda+cor semântica). O título vai como
`children` (um `<div className={styles.listHeadTitle}>`), não na prop `title` do Alert — essa prop
acrescenta ": " automático no texto (`<strong>{title}: </strong>`), o que quebrava o texto exato
esperado nos testes e não fazia sentido pra um título de banner (não é "rótulo: valor").

### Aprovar/Rejeitar também dentro do histórico do empréstimo (achado UI, 2026-08-06)

Gustavo: "isso é um dado que tem que ter registro por empréstimo" — antes, Aprovar/Rejeitar só
existiam no banner global do topo (`solicitacoes-pendentes`), que some assim que a pessoa age;
"Reenviar" já vivia certo, preso ao histórico por empréstimo (`GET .../solicitacoes`), então a
inconsistência ficava óbvia. Corrigido: o modal de histórico agora também mostra Aprovar/Rejeitar
em cada item `Pendente` quando `historicoEmprestimo.souCredor` — mesmo fluxo/modais reaproveitados
(`openAprovar`/`openRejeitar`), sem endpoint novo.

**Gotcha de implementação:** `PontesModal` usa `z-index` fixo (9999) no overlay pra todo mundo —
sem stacking dinâmico por ordem de abertura. Abrir "Aprovar" (ou "Rejeitar") de dentro do
"Histórico" só empilha visualmente por cima se o modal de Histórico estiver **antes** dele na
árvore JSX (elemento posterior no DOM pinta por cima com mesmo z-index). Resolvido reordenando o
bloco do modal de Histórico pra antes dos blocos de Aprovar/Rejeitar no `EmprestimosPage.tsx`.
Vale de lição pra qualquer modal que abre outro modal por cima: checar a ordem no JSX, não só o
`open=`.

Também corrigido no mesmo achado: empréstimo `AVista` não mostrava forma de pagamento nenhuma na
lista (só `Parcelado` ganhava badge) — "preciso saber a forma de pagamento combinada do
empréstimo". Agora todo item mostra o badge — `Parcelado Nx` ou `À vista`.

### Banner de "pagamentos aguardando aprovação" removido (achado UI, 2026-08-06)

Depois do ponto acima (Aprovar/Rejeitar também no histórico por empréstimo), o banner global no
topo virou puro redundante — Gustavo: "não quero que tenha esse banner aí não". Removido por
completo: `pagamentosPendentes` (state), a chamada a `listSolicitacoesPagamentoPendentes` em
`loadData`, e o bloco `PontesAlert` correspondente. A pendência de aprovação continua visível de
duas formas, ambas presas ao registro do empréstimo (não a um feed solto): o segmento laranja na
barra de progresso (`ValorPendente`) e o item `Pendente` dentro do histórico, com Aprovar/Rejeitar
ali mesmo.

**O banner de "convites de empréstimo pendentes" foi mantido** — não é redundante como o de
pagamento: aceitar/recusar vínculo só existe ali, não há ainda um lugar por-registro pra isso (o
`Emprestimo` nem aparece na lista principal do usuário convidado antes do aceite).

### Unificação: registrar pagamento pra credor E devedor, mesmo fluxo (2026-08-08)

**3 achados encadeados, ao vivo, testando os 6 empréstimos reais que o Gustavo ditou pra cadastrar:**

1. **`RegistrarPagamentoAsync` (ação antiga "$" do credor) estava quebrada de verdade.** Bumpava
   `Emprestimo.ValorPago` direto, sem passar pela parcela nem pela `EmprestimoPagamentoSolicitacao`
   — pra um empréstimo `Parcelado`, registrar R$10 não sabia dizer *qual* parcela isso quitava (nem
   marcava nenhuma como `Paga`), e não deixava rastro nenhum visível pro devedor (só um
   `FinancialEventLog` genérico). Gustavo confirmou ao vivo que foi ele mesmo quem clicou o botão
   testando — e mesmo assim: "do jeito que esta feito ta errado pq não kita parcela não tem
   registro de nada... isso ta errado mesmo temos que resolver".
2. **UX inconsistente por papel.** O devedor tinha "Marcar como pago" (ícone `Receipt`, fluxo
   completo com parcela+comprovante+aprovação) e o credor tinha "Registrar pagamento" (ícone
   `DollarSign`, um valor solto sem nada em volta) — **dois botões, dois ícones, dois modais**
   pro mesmo conceito. Gustavo: "e se eu for o credor de umas e devedor de outras vai ser um
   caminho diferente pra cada pra registrar pagamento não pode ser assim... lembra nosso objetivo é
   usabilidade".
3. **Pesquisa de mercado antes de desenhar a correção** (pedido explícito do Gustavo): Splitwise já
   passou por essa decisão — tinha confirmação obrigatória do outro lado pro "settle up" e
   **removeu**, porque travava demais o uso; hoje é "wiki-style": qualquer um registra, o outro só é
   **notificado**, pode apagar/disputar se achar errado. Isso valida o desenho: o fluxo
   devedor→credor (mais rígido, pede aprovação) já é mais forte que o padrão de mercado — fazia
   sentido manter; o que faltava era o credor ter o **mesmo rigor** (parcela+audit) que o devedor já
   tinha, só sem precisar aprovar a si mesmo.

**Desenho final — um botão só, um endpoint só, `SolicitarPagamentoAsync` decide por papel:**

`POST /emprestimos/{id}/solicitar-pagamento` deixou de checar `EhCredor` como bloqueio (`if
(EhCredor(...)) throw Forbidden` — removido) e passou a ramificar pelo papel de quem chama
(`souCredor = EhCredor(emprestimo, usuarioId)`):

| | Devedor registra | Credor registra |
|---|---|---|
| Transação criada/vinculada | `Despesa` (saída da conta dele) | `Receita` (entrada na conta dele) |
| Campo preenchido na solicitação | `TransacaoComprovanteId` | `TransacaoRecebimentoId` |
| `StatusAprovacao` ao nascer | `Pendente` | `Aprovada` (auto — ver justificativa de mercado acima) |
| Efeito imediato em `ValorPago`/parcela | nenhum, espera aprovação | avança na hora, parcela vira `Paga` na hora |
| Quem é notificado | credor ("aguardando aprovação") | devedor ("pagamento confirmado") — só se `Vinculado` |
| `FinancialEventType` gravado | `EmprestimoPagamentoSolicitado` | `EmprestimoPagamentoAprovado` |

Front: um único botão **"Registrar pagamento"** (ícone `Receipt`), visível pra qualquer papel em
qualquer empréstimo não-quitado, abrindo o mesmo `PontesModal` — só o texto/labels mudam por
`e.souCredor` (copy explicando saída vs. entrada, "Como comprovar esse pagamento?" vs. "Como
registrar esse recebimento?", "Conta (de onde saiu)" vs. "Conta (pra onde foi)", filtro de
categoria Despesa vs. Receita, footer "Enviar pra aprovação" vs. "Confirmar recebimento"). O modal
antigo "Registrar pagamento" (valor solto, sem parcela) foi **apagado** — `handlePagamento`,
`pagamentoFor`/`valorPagamento`/`pagamentoErr`, o serviço `registrarPagamento`, a rota
`PATCH /emprestimos/{id}/pagamento` (`RegistrarPagamento` no controller) e
`EmprestimoService.RegistrarPagamentoAsync` inteiros removidos — sem substituto direto, o novo
fluxo unificado cobre o mesmo caso de uso com mais rigor.

**Empréstimo sem vínculo (registro solo, sem contraparte) continua funcionando** — o guard
`StatusVinculo != Vinculado → throw` foi removido do `SolicitarPagamentoAsync` porque, sem vínculo,
`ContraparteUsuarioId` é sempre `null` (só é setado em `AceitarInternoAsync`), então só o `CriadoPor`
consegue carregar o registro, e `EhCredor` sempre retorna `true` pra ele nesse caso — ou seja,
`souCredor` é sempre `true` quando não tem vínculo, o caminho devedor é fisicamente inalcançável.
A notificação pro devedor fica atrás de `if (StatusVinculo == Vinculado)` pra não tentar notificar
um `ContraparteUsuarioId` nulo.

**Verificado ao vivo nos dois papéis** (com um empréstimo de teste dedicado, não nos 6 reais — ver
lição abaixo): credor registrando "Fiança Loft" (À vista) quitou na hora, sem esperar ninguém;
devedor (Ana) registrando parcela 1/10 de "Móveis" ficou `Pendente`, `ValorPago` não mudou até
aprovar do lado do Gustavo — os dois caminhos batem com a tabela acima.

**Lição gravada em memória:** durante essa verificação, o primeiro teste do caminho credor foi feito
sem querer em cima da "Fiança Loft" real (um dos 6 empréstimos que o Gustavo tinha acabado de
ditar), quitando R$175 de verdade na conta Nubank dele antes de perceber o erro. Revertido na hora
(soft-delete da transação + reset de `ValorPago`/`Quitado`), mas a regra ficou clara: **nunca
verificar fluxo em cima de registro financeiro real do usuário, mesmo em dev/seed local — sempre
criar um registro dedicado só pra teste.**

## Casos extremos

- **Credor já registrou a entrada por fora, antes de ver a solicitação pendente** — vincula via
  `TransacaoExistenteId` em vez de criar outra. Sistema não tenta detectar/casar automaticamente com
  uma transação já existente — a pessoa escolhe explicitamente no dropdown (mesmo espírito de "não
  travar" da conferência de caixa, mas sem opção silenciosa de pular).
- **Solicitação pendente quando `Emprestimo` é quitado por outro caminho** (credor usa `Quitar`
  direto) — solicitações pendentes remanescentes ficam órfãs semanticamente; v1 não bloqueia nem
  auto-rejeita, fica como pendência visível mas sem efeito prático (`Emprestimo.Quitado` já true).
- **Valor solicitado maior que o restante** — mesmo comportamento do `RegistrarPagamentoAsync` atual
  (`Math.Min(ValorPago + valor, ValorTotal)`), sem erro, só não passa do total.
- **Devedor tenta vincular uma transação que já é comprovante de outra solicitação pendente/aprovada**
  — bloqueado (`InvalidOperationException`), evita duas solicitações "provadas" pela mesma saída de
  dinheiro. Se a solicitação anterior foi rejeitada, a transação libera pra reaproveitar.
- **Devedor tenta vincular transação de outro usuário ou do tipo errado (Receita)** — 404/400
  (mesmo tratamento de "não existe pra você" das outras checagens de ownership do serviço).
- **Emprestimo perde vínculo (`Recusado`) com solicitação pendente** — não deveria acontecer na
  prática (recusa de vínculo só antes de aceitar, e sem vínculo não existe devedor pra solicitar) —
  não é um caso alcançável pelo fluxo normal.

### Apagar empréstimo vinculado sem atividade (2026-08-11)

**Achado (Gustavo, 2026-08-08): "nenhum emprestimo e editavel e se eu colocar valor errado como
faz?"** `DeletarAsync` bloqueava (`ForbiddenAccessException`) qualquer `Emprestimo` `Vinculado`,
sem exceção — só restava `Quitar` (errado: marca 100% pago, não corrige nada). Editar campos
(valor/data/descrição) de um empréstimo já vinculado é um problema maior (o que fazer com parcelas
já geradas, `TransacaoId`, se a contraparte precisa reaprovar a mudança) e ficou **fora de escopo
por decisão explícita** — só a parte "apagar sem atividade" foi implementada agora.

**Regra nova:** `Vinculado` só bloqueia apagar se já **tem atividade real** — `ValorPago > 0`, ou
alguma `EmprestimoParcela` `Paga`, ou **qualquer** `EmprestimoPagamentoSolicitacao` vinculada ao
empréstimo, **mesmo rejeitada**. Rejeitada ainda conta como atividade porque a contraparte já viu e
interagiu com o registro — apagar apagaria o rastro dela também, mesmo raciocínio de auditoria do
resto do módulo. Sem nenhuma dessas três coisas (aceite bilateral existe, mas ninguém tentou pagar
nada ainda), apagar segue liberado — resolve "coloquei o valor errado ao criar, quero começar de
novo" sem precisar de um fluxo de edição inteiro.

Verificado ao vivo com empréstimo de teste dedicado (criado, vinculado à Ana, aceito por ela,
depois apagado como Gustavo — sucesso, sumiu da lista dos dois lados) — os 6 empréstimos reais não
foram tocados.

### Aprovar/rejeitar direto na parcela, sem abrir o histórico (2026-08-12)

**Achado ao vivo (Gustavo viu "R$500,00 aguardando aprovação" no card do Móveis):** "onde que eu
aprovo ou recuso isso?" O único lugar era o modal "Histórico de pagamentos" — nada no card, nada na
parcela sinalizava. Depois de eu apontar o caminho (histórico → item Pendente → ✓/✕), reação
imediata: "não pode ser ai vei... lembra do ui/ux... pq não coloca junto com a parcela? sla eu clico
na parcela e abre em baixo pra mim e na parcela aparece um icone de alerta".

**Dois sinais novos, sem precisar abrir nada:**
1. **Badge no card** — `⚠ Aguardando sua aprovação` (tone warning) no cabeçalho de qualquer
   empréstimo (À vista ou Parcelado) com `souCredor && valorPendente > 0`. Zero custo de API —
   `valorPendente` já vinha no `EmprestimoDto`, só faltava um badge visível (antes só existia como
   segmento fino laranja na barra de progresso, fácil de não perceber).
2. **Botões Aprovar/Rejeitar direto na linha da parcela (só Parcelado)** — a parcela específica com
   solicitação `Pendente` ganha dois ícones inline, verde (✓ Aprovar) e vermelho (✗ Rejeitar), depois
   do valor. Chamam os mesmos modais já existentes (`openAprovar`/`openRejeitar`), só mudou de onde
   são disparados — sem etapa intermediária.

**Primeira versão tinha um painel amarelo que abria ao clicar na parcela — trocado no mesmo dia, em
duas rodadas de redesign.** Gustavo: "não sei pq não gostei desse trem de clicar na parcela e
aparecer esse trem amarelo ai de aprovação grandão". Pedido explícito de redesenho: "coloca na mema
linha depois do preço... um botão de aprovar e um de recusar em verde e em vermelho, clicar na
parcela abre o historico dela quando foi paga se atrasou ou não tudo que for possivel".

**Rodada 1 do redesign:** botões sempre visíveis na própria linha (sem clique intermediário) +
clicar na parcela abrindo o modal "Histórico de pagamentos" já existente, filtrado por `parcelaId`.

**Rodada 2, minutos depois:** "não quero que esse historico de parcela abra assim nem a pau, quero
que abra em baixo" — o modal em si (por cima de tudo, com overlay) não servia, mesmo filtrado.
**Trocado por painel 100% inline**, embaixo da própria linha da parcela (mesmo padrão de
show/collapse do `expandedId` do empréstimo, agora por parcela): `historicoInlineParcelaId` guarda
qual parcela está com o histórico aberto, busca via `listSolicitacoesPagamento` + filtro client-side
por `parcelaId`, sem tocar no modal "Histórico de pagamentos" original (que continua intacto pro
botão de nível do empréstimo). Clicar de novo na mesma parcela recolhe. Também nessa rodada: botões
diminuídos de 32px pra 24px (tamanho novo na lib, `PontesIconButton size={24}`) com mais espaço
entre eles (`gap` de 2px pra 8px), e o badge da parcela pendente deixou de mostrar o genérico
"Pendente" — vira "Aguardando aprovação" (tone warning) quando há solicitação esperando avaliação,
pra o status por si só já indicar o que fazer, não só os botões.

**Backend:** `EmprestimoParcelaDto` ganhou `SolicitacaoPendenteId` (`Guid?`), populado em
`ListarParcelasAsync` via uma query em lote (`EmprestimoPagamentoSolicitacoes` com `ParcelaId` numa
lista + `StatusAprovacao == Pendente`, agrupado num dicionário parcela→solicitação). Não muda nada
do fluxo de histórico — é sinal adicional pro front, a fonte da verdade continua a mesma tabela.

**Dois bugs reais pegos pelos testes antes de ir pro ar:**
1. `Dictionary<Guid,Guid>.GetValueOrDefault(chaveAusente)` devolve `Guid.Empty` (`00000000-...`), não
   `null` — ao atribuir isso a um parâmetro `Guid?`, C# embrulha o Guid zerado num `Guid?` **com
   valor**, não `null`. Resultado: toda parcela sem solicitação pendente aparecia como se tivesse uma
   (id zerado). Corrigido com `TryGetValue`. Lição: `GetValueOrDefault` com `TValue` struct nunca é
   seguro pra distinguir "ausente" de "valor default" — só funciona limpo quando `TValue` já é
   nullable.
2. **`EmprestimoPagamentoSolicitacaoDto` nunca expunha `ParcelaId`** — campo existia na entidade
   (`EmprestimoPagamentoSolicitacao.ParcelaId`) e no tipo do front, mas o mapeamento em
   `ToSolicitacaoDtosAsync` nunca copiava esse campo pro DTO de saída. Passou despercebido até agora
   porque nada dependia dele — o filtro "histórico da parcela" foi a primeira coisa a precisar. Achado
   ao vivo (histórico da parcela voltava vazio mesmo com solicitação real registrada), corrigido
   adicionando `ParcelaId = s.ParcelaId` no mapeamento + o campo na classe DTO.

**Componentes novos foram pra biblioteca Pontes, não pra página** (regra do `PROMPT_NOVA_SESSAO.md`
§5): `PontesButton` ganhou `variant="success"`/`"success-outline"` (espelha `danger`/`danger-outline`
que já existia) e `PontesIconButton` ganhou `variant="success"`/`"danger"` (preenchidos, só tinha
`primary/soft/outline/ghost`) + tamanho `24` novo (só tinha `32/40/48`) — todos com demo em
`/design-system` e smoke test em `pontes.test.tsx` antes de usar em Empréstimos.

**Verificado ao vivo** com empréstimo de teste dedicado (nunca nos 6 reais): "TESTE aprovar parcela
inline" (Parcelado 2x), vinculado à Ana, ela solicitou pagamento da parcela 1 — do lado do Gustavo,
os botões verde/vermelho (preenchidos, 24px) apareceram direto na linha, badge mudou pra "Aguardando
aprovação", "Aprovar pagamento" abriu o modal certo sem clique intermediário, e clicar na parcela
abriu o histórico dela inline embaixo da própria linha (não modal) com a solicitação real da Ana
listada. Back 381/381 (+2 testes no total do redesenho), front 331/331 (+2 testes: comportamento
inline da parcela + variantes novas da lib).

**Bug real achado logo na verificação seguinte:** Gustavo aprovou de verdade pela linha da parcela
("registrei entrada mas o status continua como aguardando aprovação") — conferido no Postgres (só
leitura) que o backend tinha aprovado certo (`StatusAprovacao=2`, `AprovadoEm` preenchido), mas a
tela continuava mostrando "Aguardando aprovação". Causa: `parcelasPorEmprestimo` (cache de parcelas
por empréstimo expandido) só é buscado uma vez ao expandir — `handleAprovar`/`handleRejeitar`/
`handleReenviar` chamavam `loadData()` (recarrega a lista de empréstimos + stats) mas nunca
re-buscavam as parcelas nem o histórico inline aberto. Corrigido com `refreshParcelasEHistoricoInline`
— depois de aprovar/rejeitar/reenviar, se tem empréstimo expandido, rebusca `listParcelasEmprestimo`
pra ele e, se tem histórico inline de parcela aberto, rebusca e refiltra também. Front +1 teste
(mocka duas respostas diferentes de `listParcelasEmprestimo`, confirma que a badge some depois de
aprovar). Verificado ao vivo de novo: aprovou a parcela real de teste, badge sumiu, progresso foi
pra 50%, sem precisar recarregar a página manualmente.

**Achado colateral, no meio da investigação:** ao checar por que o R$500 do Móveis (empréstimo real)
não mostrava mais o badge, uma consulta só-leitura no Postgres revelou que a solicitação real já
tinha sido rejeitada minutos antes por conta própria do Gustavo (fora da sessão do Claude, provável
outra aba) — não foi ação minha. Serviu de confirmação indireta de que o badge reage certo ao status
real (sumiu do card assim que deixou de ser `Pendente`).

### Valor sem parcela: aplica em sequência nas parcelas pendentes (2026-08-12)

**Achado real, ao vivo:** Gustavo tinha registrado uma entrada de R$200 numa parcela de R$50 (via
"vincular transação existente") — a solicitação ficou com `Valor=200` amarrada numa parcela que
valia R$50, e não dava pra usar os R$150 restantes em outra parcela nenhuma. "a gente fez uma
associação de uma entrada de 200 numa parcela de 50 e não deu pra colocar outra sendo que esse 200
dava pra pagar tudo... tem que fazer essa conta também validar se o valor associado a parcela não é
maior do que o empréstimo ou parcela em cima". Nenhuma validação comparava o valor da solicitação
com o valor devido da parcela escolhida.

**Decisão do redesenho (depois de pesquisa leve de mercado, a pedido do Gustavo — "faz um estudo
disso e me traz todas as opções"):** financiamento bancário real no Brasil já resolve isso —
excedente de um pagamento abate as parcelas seguintes automaticamente (fonte: pesquisa sobre
amortização de financiamento). Splitwise nem tem parcela fixa (só saldo corrente, sem "escolher
qual parcela"), então não dava pra copiar sem jogar fora vencimento/juros/multa por parcela que já
existiam. Escolhido: **"Auto-aplica em sequência" (como banco faz)** — o usuário não escolhe mais
uma parcela específica, só informa o valor pago; o sistema cobre as parcelas pendentes mais antigas,
em ordem, quantas o valor fechar por completo. Sobra que não fecha uma parcela inteira não aplica
agora (fica pro próximo pagamento — não quebra nada, não gera solicitação com valor errado).

**Backend — mudança de contrato:** `SolicitarPagamentoEmprestimoDto.ParcelaId` removido por
completo (não existe mais escolha manual). `EmprestimoService.SolicitarPagamentoAsync` mudou de
retornar `EmprestimoPagamentoSolicitacaoDto` (um item) pra `List<EmprestimoPagamentoSolicitacaoDto>`
— uma chamada pode gerar N solicitações agora (uma por parcela coberta), todas amarradas na mesma
`Transacao` de comprovante/recebimento. Algoritmo: busca parcelas `Pendente` do empréstimo **sem
solicitação ativa** (`StatusAprovacao != Rejeitada`) já ligada — uma parcela `Pendente` pode já ter
uma solicitação do devedor esperando aprovação do credor, então não pode receber uma segunda — em
ordem por `Numero`; pra cada uma, se o valor restante cobre o `ValorComMulta ?? ValorComJuros ??
Valor` dela, cria uma solicitação (mesma lógica de sempre: devedor nasce `Pendente`, credor nasce já
`Aprovada`) e desconta o valor aplicado; para na primeira que não fecha inteira. Se zero parcela foi
coberta, `ArgumentException` ("esse valor não cobre nenhuma parcela pendente por completo") — nunca
falha silenciosamente. Notificação e `FinancialEventLog` viram um por solicitação criada, mas a
mensagem de notificação é consolidada (ex.: "confirmou o recebimento de R$200,00 (4 parcelas)") em
vez de uma notificação por parcela. `À vista` não muda nada — nunca teve `ParcelaId`, sempre foi uma
solicitação só.

**Frontend:** o seletor "Qual parcela isso quita?" saiu do modal "Registrar pagamento" — pra
Parcelado, só aparece um aviso ("se o valor cobrir mais de uma parcela, todas são quitadas em
sequência, da mais antiga pra mais nova"). O serviço `solicitarPagamentoEmprestimo` retorna array
agora; a mensagem de sucesso do toast reflete a quantidade (`"(N parcelas)"` quando `N>1`).

**Cobertura de teste do redesenho:** back ganhou os testes centrais do achado —
`ValorCobreVariasParcelas_CriaUmaSolicitacaoPorParcelaEmSequencia` (R$200 numa emprestimo de 4x50 →
4 solicitações, uma por parcela, em ordem), `ValorCobreParcialmenteAProximaParcela_NaoAplicaOResto`
(R$120 em 4x50 → só 2 solicitações, R$100 aplicado, R$20 não vira nada), e a versão do lado credor
(`CredorComValorMaiorQueParcela_MarcaVariasParcelasPagasNaHora`, auto-aprovada na hora). Testes
antigos que dependiam de escolher `ParcelaId` explicitamente foram reescritos ou removidos (o cenário
"parcela de outro empréstimo" deixou de fazer sentido — não existe mais como apontar pra uma parcela
específica de jeito nenhum, muito menos de outro empréstimo). Back 384/384 (+9 no total desde o
início da sessão), front 333/333 (+2: sem seletor de parcela + mensagem de sucesso com quantidade).

**Verificado ao vivo, ponta a ponta (2026-08-12):** criado empréstimo de teste dedicado "TESTE
emprestimo grande 10x" (Parcelado 10x, R$1.000 = R$100/parcela) a pedido do Gustavo ("esse e
pequeno de mais, cria um de 10 parcelas"), vinculado à Ana. Ana registrou pagamento de R$250,00 sem
escolher parcela — toast confirmou "aguardando aprovação do credor (2 parcelas)". Logado como
Gustavo (credor): badge "Aguardando sua aprovação" no card, parcelas 1/10 e 2/10 com botões ✓/✗
inline (3/10 em diante seguiram `Pendente`, os R$50 de sobra não fecharam a 3ª — comportamento
certo). Aprovadas as duas pela própria linha da parcela — ambas viraram `Paga`, R$200,00 pago (20%),
R$800,00 restante, badge sumiu. Confirma o algoritmo no browser real, não só nos testes
automatizados. Nenhum empréstimo real tocado.

### Sobra parcial vira adiantamento na parcela, não some (2026-08-13)

**Achado real, na mesma verificação ao vivo do dia seguinte:** testando de novo o auto-aplica-em-
sequência (empréstimo "TESTE aprovar parcela inline", 2x R$50, 1ª já paga), o Gustavo notou que um
segundo pagamento de R$150 (sobre outro empréstimo de teste) só registrava R$100 no histórico da
parcela, e perguntou "ela lançou 150 pq aqui só mostrou 100?" — junto de uma pergunta maior: "ela
poderia pagar uma parte da outra parcela com esses 50 poderia não? [...] que nem o cartão de
crédito, posso pagar adiantado antes de fechar a fatura".

Conferido no código: **era bug real, não só UX.** A `Transacao` real criada tinha o valor total
digitado (R$150 saía de verdade da conta), mas o algoritmo só criava `EmprestimoPagamentoSolicitacao`
pra parcela que o valor fechava **por completo** — a sobra que não fechava uma parcela inteira não
virava solicitação nenhuma, não ficava de crédito em lugar nenhum, simplesmente sumia do rastro do
empréstimo (a doc da sessão anterior até documentava errado que "fica pro próximo pagamento" —
não ficava). Dinheiro real desalinhado do registro é falha de integridade financeira, prioridade
imediata (decisão do Gustavo: corrigir antes de seguir pro unificar/consolidar).

**Implementado — adiantamento parcial na parcela:** `EmprestimoParcela` ganhou `ValorPago` (decimal,
soma de tudo já aplicado nela, migration `AddValorPagoParcelaEmprestimo`). O algoritmo de
`SolicitarPagamentoAsync` agora aplica o valor **integralmente**: pra cada parcela pendente em
sequência, aplica `Math.Min(restante, valorDevido - parcela.ValorPago)` — se não fechar tudo, cria
uma solicitação com o valor parcial mesmo assim (não descarta nada). `AprovarPagamentoSolicitacaoAsync`
espelha a mesma lógica: soma no `ValorPago` da parcela, só marca `Paga` quando o acumulado cobre o
valor devido por completo. Parcela pode receber **múltiplos** adiantamentos ao longo do tempo — a
trava de "não pode mirar parcela com solicitação ativa" foi ajustada pra só bloquear solicitação
ainda `Pendente` (não confirmada); uma solicitação já `Aprovada` (adiantamento anterior aplicado) não
bloqueia mais um segundo pagamento na mesma parcela. Pagar mais do que resta em todas as parcelas
pendentes agora lança `ArgumentException` explícito ("Esse valor é maior que o total das parcelas
pendentes") em vez de sumir com o excedente. `TotalAReceberVencido` (card "Vencido") corrigido pra
descontar `ValorPago` de parcelas vencidas parcialmente pagas (antes contava o valor cheio, dobrando
o que já tinha entrado).

**Frontend:** parcela com `ValorPago > 0` e ainda não fechada mostra badge nova (`tone="accent"`)
"R$X de R$Y pago" no lugar do "Pendente" genérico. Aviso do modal "Registrar pagamento" ganhou a
frase "se não fechar uma parcela inteira, entra como adiantamento nela — nada se perde".

**Testes:** back ganhou 5 novos (`ValorCobreParcialmenteAProximaParcela_AplicaComoAdiantamento`
reescrito do antigo "NaoAplicaOResto", `ValorMaiorQueTotalDasParcelasPendentes_LancaArgumentException`,
`CredorPagaParcial_AtualizaValorPagoSemFecharParcela`,
`SegundoAdiantamentoFechaParcelaQueJaTinhaParcial`,
`AprovarPagamentoSolicitacaoAsync_ComParcelaParcial_SomaValorPagoSemFechar`); front ganhou 1
(badge parcial). Back 388/388, front 334/334, tsc+lint limpos.

**Verificado ao vivo:** registrado R$30 na parcela 2/2 do "TESTE aprovar parcela inline" (que já
tinha R$50 devidos) — badge mostrou "R$30,00 de R$50,00 pago" em vez de virar Paga ou sumir, parcela
continuou Pendente. **Incidente de segurança de teste no processo:** um erro de contagem de posição
ao clicar um botão numa lista repetida (ver_page inclui linhas fora da viewport) fez um clique cair
sobre o empréstimo real "Aluguel atrasado" em vez do de teste — criou R$30 de `Transacao` real +
solicitação `Aprovada` por engano. Detectado na hora (verificação do request de rede antes de
prosseguir), revertido imediatamente via Postgres (`DELETE` na solicitação/log de evento/transação,
reset do `ValorPago` da parcela e do empréstimo pra 0) — confirmado que o empréstimo real voltou a
R$0,00 e ficou intacto pro resto da sessão. Lição gravada em memória (`feedback_nao_testar_em_dado_real`):
em listas com botão repetido por linha, confirmar o registro certo (nome visível, ou `scroll_to` +
network request) antes de agir, nunca contar posição de cabeça a partir de um screenshot.

**Achado seguinte, mesma sessão — badge da parcela não atualizava após registrar pagamento novo:**
Gustavo apontou (elemento selecionado na UI) que a badge "R$X de R$Y pago" ficava com o valor antigo
depois de um novo "Registrar pagamento", mesmo o card no topo já refletindo o valor certo. Mesma
classe de bug já corrigida em 2026-08-12 pra aprovar/rejeitar/reenviar (`refreshParcelasEHistoricoInline`
só era chamado nesses três handlers) — faltava cobrir o quarto ponto de mutação, `handleSolicitar`
(registrar pagamento novo), que só chamava `loadData()` (atualiza os cards) sem recarregar
`parcelasPorEmprestimo`. Corrigido adicionando a mesma chamada nos dois branches de `handleSolicitar`
(vincular transação existente e lançar nova). Front +1 teste (regressão: registra pagamento com
parcela expandida, confirma `listParcelasEmprestimo` chamado de novo e a badge nova aparece). Front
335/335, tsc+lint limpos. Verificado ao vivo: badge foi de "R$35,05 de R$50,00 pago" pra "R$40,05 de
R$50,00 pago" na hora, sem reload manual.

## Fora de escopo (v1)

- Parcelamento formal com vencimento (item separado no ROADMAP).
- Anexo de foto/imagem do comprovante — o "comprovante" aqui é a `Transacao` real em si (valor+data+
  conta), não um arquivo anexado.
- Editar/cancelar solicitação já enviada pelo devedor.

## Testes (backend)

- Devedor solicita pagamento → cria solicitação `Pendente` + `Transacao` vinculada; `ValorPago` do
  Emprestimo **não muda ainda**.
- Credor registra pagamento (unificado 2026-08-08) → cria solicitação já `Aprovada` + `Transacao`
  de recebimento (`Receita`); `ValorPago` avança na hora, parcela (se informada) vira `Paga`.
- Credor registra em empréstimo `Parcelado` → marca a parcela mais antiga como `Paga` na hora (sem
  esperar aprovação).
- Valor cobre várias parcelas de uma vez (2026-08-12) → cria uma solicitação por parcela coberta, em
  sequência, mais antiga primeiro (`SolicitarPagamentoAsync_ValorCobreVariasParcelas_...`).
- Valor cobre parcialmente a próxima parcela → só aplica nas que fecham inteiras, resto não vira
  solicitação nenhuma (`..._ValorCobreParcialmenteAProximaParcela_NaoAplicaOResto`).
- Nenhuma parcela pendente-sem-solicitação-ativa é coberta → `ArgumentException`, nunca falha
  silenciosamente (`..._ValorNaoCobreNenhumaParcelaPendente_LancaArgumentException`).
- Parcela já tem solicitação ativa → próximo pagamento pula pra próxima pendente em vez de travar
  (`..._ParcelaJaTemSolicitacaoAtiva_PulaPraProximaPendente`).
- Empréstimo `SemVinculo` (registro solo) → credor registra normalmente, sem notificar ninguém
  (não existe contraparte).
- Devedor tenta aprovar a própria solicitação (via `AprovarPagamentoSolicitacaoAsync`) → 403.
- Credor aprova solicitação `Pendente` de um devedor → `ValorPago` avança, `Quitado` se bateu o
  total, `FinancialEventLog` gravado.
- Credor rejeita → `ValorPago` intacto, `FinancialEventLog` gravado.
- Testar os dois `Tipo` (`Emprestei`/`PegueiEmprestado`) explicitamente pra autorização de
  solicitar/aprovar.
- Idempotência: replay do `POST solicitar-pagamento` com mesma chave não duplica.
- `DeletarAsync` de empréstimo `Vinculado` sem atividade → soft-delete permitido.
- `DeletarAsync` de empréstimo `Vinculado` com solicitação `Pendente` → 403.
- `DeletarAsync` de empréstimo `Vinculado` com solicitação `Rejeitada` → 403 (rastro conta como atividade).
- `ListarParcelasAsync` com solicitação `Pendente` numa parcela → `SolicitacaoPendenteId` bate só na parcela certa, `null` nas outras.
- `SolicitarPagamentoAsync` com `ParcelaId` → DTO retornado expõe `ParcelaId` (pegou o bug do mapeamento faltando).

## Referências

- `docs/features/emprestimo-compartilhado/spec.md` — vínculo bilateral e autorização assimétrica por `Tipo` (base desta extensão).
- `docs/features/familia/aprovacao-despesa.md` — arquitetura de aprovação reaproveitada (`StatusAprovacaoDespesa`, padrão "criador não aprova a própria").

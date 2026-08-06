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
- `TransacaoComprovanteId` (Guid, FK → `Transacao`, **obrigatório** — diferente da criação de
  empréstimo onde o vínculo a transação é opcional; aqui não existe "solicitar sem comprovante")
- `SolicitadoPor` (Guid — sempre o devedor no momento da solicitação)
- `StatusAprovacao` (enum novo `StatusAprovacaoPagamentoEmprestimo`: `Pendente=1`, `Aprovada=2`,
  `Rejeitada=3`)
- `AprovadoPorUsuarioId` (Guid?), `AprovadoEm` (DateTime?)
- `TransacaoRecebimentoId` (Guid?, FK → `Transacao`) — entrada real na conta do credor, só setado
  na aprovação
- `MotivoRejeicao` (string?, opcional) — texto livre que o credor pode escrever ao rejeitar;
  entra na notificação pro devedor e fica visível no histórico (decisão de 2026-08-06)
- `CriadoEm` (DateTime)

Migration: `AddPagamentoAprovacaoEmprestimo`.

`FinancialEventType` novo bloco (próximo livre = 75): `EmprestimoPagamentoSolicitado = 75`,
`EmprestimoPagamentoAprovado = 76`, `EmprestimoPagamentoRejeitado = 77`.

`TipoNotificacao` novo: `EmprestimoPagamentoSolicitado = 10` (notifica credor),
`EmprestimoPagamentoAvaliado = 11` (notifica devedor quando aprovado/rejeitado).

## API

| método | rota | quem | efeito |
|---|---|---|---|
| `POST` | `/emprestimos/{id}/solicitar-pagamento` | devedor do registro (souCredor=false, Vinculado) | cria solicitação `Pendente`, cria `Transacao` comprovante |
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
| Solicitar pagamento | só o devedor do registro | cria solicitação `Pendente` — **não muda nada sozinho**, só registra |
| Aprovar solicitação | só o credor do registro | `ValorPago` avança de verdade, `Transacao` de entrada criada/vinculada |
| Rejeitar solicitação | só o credor do registro | nada muda no `Emprestimo`; comprovante do devedor continua valendo |
| Reenviar solicitação rejeitada | só quem solicitou originalmente (o devedor) | volta pra `Pendente`, credor notificado de novo |
| Ver histórico de solicitações | qualquer um dos dois participantes | só leitura |
| Registrar pagamento direto / Quitar (fluxo antigo, sem solicitação) | só o credor do registro | avança `ValorPago`/`Quitado` na hora |
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

## Fora de escopo (v1)

- Parcelamento formal com vencimento (item separado no ROADMAP).
- Anexo de foto/imagem do comprovante — o "comprovante" aqui é a `Transacao` real em si (valor+data+
  conta), não um arquivo anexado.
- Editar/cancelar solicitação já enviada pelo devedor.

## Testes (backend)

- Devedor solicita pagamento → cria solicitação `Pendente` + `Transacao` vinculada; `ValorPago` do
  Emprestimo **não muda ainda**.
- Credor tenta solicitar (é ele quem deveria aprovar, não solicitar) → 403.
- Devedor tenta aprovar a própria solicitação → 403.
- Credor aprova → `ValorPago` avança, `Quitado` se bateu o total, `FinancialEventLog` gravado.
- Credor rejeita → `ValorPago` intacto, `FinancialEventLog` gravado.
- Solicitar pagamento em empréstimo `SemVinculo`/`Recusado` → erro (não existe "devedor" sem vínculo).
- Testar os dois `Tipo` (`Emprestei`/`PegueiEmprestado`) explicitamente pra autorização de
  solicitar/aprovar.
- Idempotência: replay do `POST solicitar-pagamento` com mesma chave não duplica.

## Referências

- `docs/features/emprestimo-compartilhado/spec.md` — vínculo bilateral e autorização assimétrica por `Tipo` (base desta extensão).
- `docs/features/familia/aprovacao-despesa.md` — arquitetura de aprovação reaproveitada (`StatusAprovacaoDespesa`, padrão "criador não aprova a própria").

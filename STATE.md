---
owner: Gustavo
last_reviewed: 2026-08-06
status: EM_PROGRESSO
foco: 'Módulo Empréstimos — regra do Gustavo (2026-08-06): terminar TUDO mapeado aqui antes de pular pra outra frente do ROADMAP. PONTO SEGURO: working tree limpo, tudo commitado e pushado até `17c1a2b` em feature/emprestimo-compartilhado (8 commits nesta sessão: parcelamento, bug de data, motivo de rejeição+barra 3 cores+PontesAlert, aprovar/rejeitar no histórico+badge forma pagamento, remoção do banner redundante). Back 376/376, front 328/328, tsc+lint limpos, build ok. Servidores locais no ar (5293/5173/Postgres). Única peça mapeada faltando pro módulo fechar por completo: "unificar/consolidar" (credor propõe juntar N empréstimos da mesma pessoa num plano novo, devedor precisa aceitar) — ainda NÃO especificado em detalhe, zero código. Próxima sessão: especificar antes de codar.'
---

# STATE — onde parei

**Estado vivo da sessão.** Só duas coisas: o que está em execução agora e a próxima ação concreta. Backlog completo em [`ROADMAP.md`](ROADMAP.md).

> Atualizar ao fim de toda sessão que mexeu em código/docs. Substitui o antigo `IMPLEMENTATION_STATE.md` (Q2-Q5 em `docs/history/`).

---

## Em execução

**Empréstimo — pagamento com comprovante + aprovação do credor** — spec em
`docs/features/emprestimo-compartilhado/pagamento-aprovacao.md` (extensão da spec original de
vínculo bilateral). **Backend + frontend completos e testados, mas 100% NÃO commitados** — tudo
solto no working tree da branch `feature/emprestimo-compartilhado` (que já está pushada até o
commit anterior, `8dc0b7e`).

**O que a feature faz:** devedor marca "paguei" anexando comprovante (cria `Transacao` real de
saída na própria conta) → vira `Pendente`. Só o credor aprova (opcionalmente informando pra qual
conta foi — cria `Transacao` de entrada; **se já registrou por fora, aprova sem conta, não
duplica**) ou rejeita (não mexe na `Transacao` do devedor, que fica valendo — o dinheiro saiu de
verdade independente do credor confirmar). Devedor pode **reenviar** uma rejeitada (volta pra
`Pendente`, mesma transação comprovante, sem duplicar). Entidade nova
`EmprestimoPagamentoSolicitacao`, migration `AddPagamentoAprovacaoEmprestimo` já aplicada no banco
de dev local (não commitada — só na branch local + banco).

**3 decisões de design corrigidas ao vivo pelo Gustavo durante a implementação** (registradas na
spec):
1. Aprovação do credor precisa gerar entrada real na conta dele, não só avançar `ValorPago` (gap
   que eu tinha deixado passar na primeira versão).
2. Conta/categoria no aprovar viram **opcionais** — evita duplicar se o credor já lançou a entrada
   por fora antes de ver a solicitação pendente.
3. Reenviar após rejeição — sem isso, uma rejeição por engano trava o fluxo pra sempre.

**Verificação end-to-end no browser retomada e concluída** (sessão seguinte à interrupção
"para em ponto seguro"): logado como Gustavo (seed real) + Ana Paula (seed real, cookie de sessão
compartilhado entre abas — trocar de conta exige logar de novo em cada aba, não é sessão isolada por
aba). Fluxo completo testado ao vivo: criar empréstimo → vincular Ana Paula → aceitar convite →
Ana solicita pagamento (comprovante real criado na conta dela) → Gustavo aprova informando conta
(entrada real criada na conta dele) → `ValorPago` bateu o total → `Quitado=true` → histórico mostra
extrato dos dois lados (data+conta da saída e da entrada). Confirmado direto no Postgres de dev, não
só na UI.

**Achado ao vivo durante o teste (Gustavo, 2 mensagens seguidas) — corrigido antes de continuar:**
o mesmo risco de duplicar dinheiro que já tinha sido resolvido do lado do credor (aprovar
"opcional") **também existia do lado do devedor** — "marcar como pago" sempre criava uma `Transacao`
nova, então se o devedor já tinha lançado a saída por fora antes de vir marcar o empréstimo,
duplicava. Corrigido: `SolicitarPagamentoEmprestimoDto` ganhou `TransacaoExistenteId` opcional — se
informado, **vincula** a despesa já lançada (valor vem dela, não do que o usuário digitou) em vez de
criar outra; bloqueado se a transação já é comprovante de outra solicitação não-rejeitada
(`InvalidOperationException`), liberado de novo se aquela foi rejeitada. Frontend ganhou toggle "Já
lancei essa saída em outro lugar" no modal, que troca pra um picker de despesas recentes
(`PontesSelect` sobre `listTransactionsPage(tipo=Despesa)`, sem endpoint novo). Histórico também
ganhou data+conta de cada lançamento (comprovante e recebimento), não só o status — pedido do
Gustavo pra ler como extrato. +5 testes back (63 no arquivo), suite completa 354 back / 321 front,
tsc+lint limpos. Spec atualizada (`pagamento-aprovacao.md`).

**Depois disso, mais uma rodada de correção ao vivo** (Gustavo: "tudo que faz de um lado faz do
outro... quero uma trava"): a mesma trava anti-duplicata virou **escolha explícita obrigatória**
(rádio, nunca checkbox desmarcado por padrão) nos 3 pontos de risco — criar empréstimo (3 opções:
ainda não movimentou / já lancei / lançar agora), devedor marca pago (2 opções, comprovante sempre
obrigatório), credor aprova (2 opções — **removida a opção de "não registrar nada"**, decisão do
Gustavo: dinheiro recebido tem que aparecer na conta do credor, sempre, vinculado ou criado).
Backend: `TransacaoExistenteId` espelhado em `CriarEmprestimoDto` e `AprovarPagamentoEmprestimoDto`
(mesmo padrão do `SolicitarPagamentoEmprestimoDto`), com a mesma trava de "já vinculada a outro
registro" nos 3 pontos. Frontend: componente local `GateOption` (rádio estilizado, `data-selected`)
reaproveitado nos 3 modais. Back 359/359 (+9 testes novos), front 322/322 (3 testes reescritos pro
novo fluxo), tsc+lint limpos.

**Gate reverificado ao vivo no browser** (sessão seguinte): logado como Gustavo (seed real),
modal "Novo Empréstimo" — confirmado que submeter sem escolher opção bloqueia ("Escolha uma opção"
em vermelho no grupo), e que marcar "Já movimentou e ainda não lancei — lançar agora" libera o
submit e revela Conta/Categoria. Só o ponto "Criar" foi testado manualmente — Solicitar/Aprovar
usam o mesmo componente `GateOption` e a mesma validação, já cobertos pelos testes automatizados
reescritos, não repetidos ao vivo por economia de tempo/orçamento.

**Commitado e pushado** — feature inteira (fluxo original + vincular-existente + a trava de
escolha explícita) em `a9586a5`, branch `feature/emprestimo-compartilhado` pushada até esse commit.
PR ainda não aberto.

**Depois de resolver esse achado, Gustavo escalou dois problemas maiores** (mesma sessão de teste,
"a gente ta batendo cabeça de mais com essa aba... acho melhor documentar o que temos e especificar
todo o resto"): (1) hoje não existe forma de pagamento combinada pro empréstimo — parcelado? juros?
multa por atraso? — só um valor total com pagamentos avulsos; (2) 2+ empréstimos com a mesma pessoa
aparecem soltos, sem visão consolidada, sem opção de agrupar/unificar. **Especificado em vez de
codado** (pedido explícito — parar de iterar ao vivo, documentar primeiro): spec nova completa em
`docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md`, incluindo decisão de
**não reaproveitar** `Parcelamento`/`ParcelaTransacao` (acoplados a cartão/fatura, não servem pra
empréstimo pessoa-a-pessoa) e 3 perguntas em aberto pro Gustavo antes de implementar (percentual de
multa, juros sobre saldo vs sobre parcela, prioridade real P1/P2/P3). Zero código ainda.

**Gustavo respondeu as 3 perguntas em aberto na sessão seguinte** (2026-08-05, mesmo dia): multa
livre sem teto ("deixa a pessoa colocar"), juros sobre o valor da parcela (não saldo devedor,
"mais simples"), e prioridade **P1** ("da prioridade pra parcelamento a gente ja ta editando um
monte de coisa nela"). Doc `parcelamento-e-agrupamento.md` atualizado com as respostas antes de
codar.

**Implementado na sequência — forma de pagamento + parcelas** (seções 1 e 2 da spec; agrupar por
pessoa, seção 3, ficou de fora, continua P3/spec-only): backend — enums `FormaPagamentoEmprestimo`
(AVista/Parcelado) e `StatusParcelaEmprestimo` (Pendente/Paga/Cancelada); `Emprestimo` ganhou
`FormaPagamento`/`TaxaJuroMensal`/`PercentualMultaAtraso`; entidade nova `EmprestimoParcela`
(Numero, DataVencimento, Valor, ValorComJuros, ValorComMulta, Status, SolicitacaoPagamentoId),
migration `AddParcelamentoEmprestimo` aplicada no banco de dev. `CriarAsync` gera as N parcelas
(2-36, ajuste de centavos na última) quando `Parcelado`, com `ValorComJuros = Valor * (1 + Taxa/100)`
por parcela (decisão do Gustavo — sem cascata entre parcelas). `EmprestimoPagamentoSolicitacao`
ganhou `ParcelaId?` — **desvio consciente do rascunho da spec**: o vínculo é pela solicitação (não
pela parcela), a parcela só vira `Paga` **na aprovação**, não na solicitação (senão uma rejeição
deixaria a parcela num limbo); trava equivalente via "já existe solicitação não-rejeitada pra essa
parcela". Multa (`ValorComMulta`) calculada e persistida (snapshot, não recalculada) na primeira
leitura de `GET /emprestimos/{id}/parcelas` após o vencimento — sem job novo, como a spec previu.
Frontend: forma de pagamento no form de criar (com quantidade/vencimento/juros/multa condicionais),
badge "Parcelado Nx" + chevron expandindo as parcelas na lista, picker de parcela obrigatório no
"Marcar como pago" quando parcelado (pré-preenche o valor com multa/juros já aplicados). Back
373/373 (+14 testes), front 325/325 (+3 testes), tsc+lint limpos. Detalhe completo em
`docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md` → seção "Implementação".

**Verificado ao vivo no browser** (não só automatizado): logado como Gustavo, criou empréstimo
"Carro parcelado" R$1.200 em 4x com 2% de juros — as 4 parcelas apareceram certas (R$306,00 cada,
vencimento mensal) ao expandir. **Achado e corrigido no processo:** `formatDate` da página usava
`toLocaleDateString("pt-BR")` sem fixar fuso — em fuso negativo (Brasil, UTC-3) qualquer
data-calendário de meia-noite UTC exibia o dia anterior (vencimento 10/08 aparecia como 09/08; dado
no banco estava certo, só a exibição errada). Corrigido nesta página
(`Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" })`); **mesmo padrão ainda existe em 8 outros
arquivos** do front (`CreditCardsPage`, `RecorrentesPage`, `FamiliaDetalhe`, `TransferenciasPage`,
`ImportacaoPage`, `Parcelamentos/[id]`, `components/pontes/form/DateInput`,
`components/Notificacoes/NotificationBell`) — catalogado no ROADMAP como achado 🟠 P1 separado, não
corrigido nesta sessão (fora do escopo desta feature).

**Commitado e pushado** — feature de parcelamento em `74fa438`, em cima do `a9586a5` já pushado da
feature anterior. Branch `feature/emprestimo-compartilhado` com 2 commits, PR ainda não aberto.

**Achado do `formatDate` resolvido (2026-08-06)** — dos 8 arquivos catalogados, 2 eram
falso-positivo (`NotificationBell.tsx` formata timestamp real, fuso local é o certo;
`components/pontes/form/DateInput.tsx` faz round-trip só com componentes locais, nunca toca
string do backend). Os 6 reais corrigidos com `timeZone: "UTC"` (`EmprestimosPage`,
`TransferenciasPage`, `FamiliaDetalhe`, `ImportacaoPage`, `RecorrentesPage`, `Parcelamentos/[id]`,
`CreditCardsPage` — que tinha 1 ocorrência esquecida do padrão que o resto do arquivo já usava).
tsc+lint limpos, 325/325 front. **Commitado e pushado** (`fc25168`).

**Regra nova do Gustavo, registrada em memória:** projeto solo sempre termina o módulo aberto por
completo antes de trocar de frente, mesmo que o próximo item do módulo seja P3 e outra frente do
ROADMAP seja P1. Empréstimos continua sendo a frente até esgotar tudo mapeado nele.

**Gustavo levantou 2 pontos reais faltando no módulo (2026-08-06):**
1. **Rejeição sem motivo não fecha o ciclo** — credor rejeita, devedor via notificação genérica
   "foi rejeitado" sem saber por quê. Pedido: "sistema tipo arquivo/ticket" — toda ação registrada
   e visível pra quem precisa saber. **Implementado e verificado ao vivo nesta sessão** (motivo
   opcional, decisão do Gustavo): `MotivoRejeicao` (string?) na `EmprestimoPagamentoSolicitacao`,
   migration `AddMotivoRejeicaoEmprestimo` aplicada; `RejeitarPagamentoEmprestimoDto { Motivo? }`;
   notificação vira "...foi rejeitado. Motivo: X" só se preenchido; histórico mostra "Motivo: X"
   abaixo do badge Rejeitada. Frontend: botão "Rejeitar pagamento" agora abre modal com
   `PontesTextarea` opcional (era ação direta sem confirmação antes). **Verificado end-to-end no
   browser real** (Ana solicita → Gustavo rejeita com motivo → notificação da Ana mostra o motivo
   → histórico mostra o motivo → botão reenviar aparece pra Ana). Back 375/375 (+3 testes), front
   326/326. Doc atualizada (`pagamento-aprovacao.md` ganhou seção "Autorização" completa: tabela
   de quem dispara cada ação, unilateral × bilateral, tabela de notificações). **Ainda NÃO
   commitado.**
2. **Agrupamento é decisão do credor, e é mais que visual — é "unificar/consolidar"** — Gustavo
   corrigiu o entendimento original (`parcelamento-e-agrupamento.md` §3 tinha isso como fora de
   escopo v1): ele quer, como credor, poder juntar N empréstimos ativos da mesma pessoa vinculada
   num plano novo renegociado (soma o que falta, redefine parcelas). **Confirmado com o Gustavo: o
   devedor precisa aceitar as novas condições antes de valer** (mesmo padrão do vínculo bilateral
   — não é o credor definindo sozinho e já valendo). **Ainda não especificado em detalhe nem
   codado** — é a próxima peça. A spec previa isso como "decisão delicada, precisa mais conversa"
   — a conversa aconteceu, falta escrever a spec técnica (nova entidade tipo
   `EmprestimoUnificacaoProposta`? o que acontece com os empréstimos originais — viram `Quitado`
   com nota "consolidado em X"?) antes de implementar.

**Mais 2 achados de UI ao vivo (mesma sessão, 2026-08-06), já resolvidos:**
3. **Banner de pendência fora do padrão** — "tá fora dos nossos padrões, tá feia". Os cards de
   "N convites pendentes"/"N pagamentos aguardando aprovação" usavam CSS ad-hoc
   (`.pendentesCard`) em vez de componente da lib. Trocado por `PontesAlert tone="warning"` (já
   existia na lib, só não estava sendo usado aqui). Detalhe: a prop `title` do Alert acrescenta
   ": " automático — usei `children` pro título pra não quebrar (e pra não ganhar um ":" indevido).
4. **Barra de progresso precisa de 3 cores** — "não pode simplesmente pq o cara recusou alterar na
   conta da outra pessoa... deve ficar o registro mostrando que ela falou que foi pago e que a
   pessoa recusou". A barra só mostrava `ValorPago` confirmado. Agora mostra 3 fatias: verde
   (confirmado/aprovado), laranja (pendente, aguardando aprovação), vermelho (recusado) — sem
   alterar `ValorPago`/saldo real de ninguém, só uma leitura visual do que está "em trânsito".
   Backend: `EmprestimoDto.ValorPendente`/`ValorRecusado` (soma de solicitações Pendente/Rejeitada
   por empréstimo, query em lote pra não gerar N+1 na listagem). Frontend: `PontesProgress`
   (biblioteca) ganhou suporte a `segments` (barra empilhada com N cores) — extensão de componente
   existente, com demo no `/design-system` e smoke test, antes de usar em Empréstimos (regra do
   `PROMPT_NOVA_SESSAO.md` §5). Verificado ao vivo (rejeitado R$50 aparece vermelho, pendente R$40
   aparece laranja, sobre um total de R$150). Back 376/376 (+1 teste), front 327/327 (+1 teste).
   **Commitado e pushado** (`60c4168`), junto com o motivo de rejeição.

**Mais 2 achados ao vivo na mesma sessão (Gustavo revisando o resultado), já resolvidos — AINDA
NÃO COMMITADOS:**
5. **Aprovar/Rejeitar preso só no banner global, inconsistente com Reenviar** — "isso é um dado
   que tem que ter registro por empréstimo... onde fica o botão pra reenviar pra pessoa". O
   Reenviar já vivia certo dentro do histórico por empréstimo; Aprovar/Rejeitar só existiam no
   banner do topo (some assim que age nele). Corrigido: histórico agora também mostra
   Aprovar/Rejeitar em cada item `Pendente` quando `souCredor`, mesmos modais reaproveitados.
   **Gotcha achado no processo:** `PontesModal` tem `z-index` fixo (9999) sem stacking dinâmico —
   abrir um modal de dentro de outro só empilha por cima se vier depois dele na árvore JSX.
   Corrigido reordenando o bloco do modal de Histórico pra antes de Aprovar/Rejeitar no arquivo.
   Vale de lição geral pra qualquer modal-sobre-modal no projeto.
6. **Empréstimo À Vista não mostrava forma de pagamento nenhuma** — "esse empréstimo aí, por que
   tá assim, ele não foi parcelado, eu preciso saber a forma de pagamento combinada". Só
   `Parcelado` ganhava badge; agora todo item mostra `Parcelado Nx` ou `À vista`.
   Back 376/376 (sem mudança de contrato), front 329/329 (+2 testes). **Commitado e pushado**
   (`d600602`).

**Mais 1 achado ao vivo, na mesma rodada — banner de pagamento removido de vez:** Gustavo viu o
banner de novo e foi direto — "não quero que tenha esse banner aí não". Como Aprovar/Rejeitar já
tinha ido pro histórico (achado 5), o banner virou puro redundante. Removido por completo:
`pagamentosPendentes` state, chamada a `listSolicitacoesPagamentoPendentes` em `loadData`, bloco
`PontesAlert` no JSX, mocks mortos nos testes. Pendência continua visível via segmento laranja da
barra + item Pendente no histórico (nenhuma perda de informação, só menos redundância). **Banner
de convites de vínculo mantido** — não é redundante, é o único lugar onde dá pra aceitar/recusar
(registro nem aparece na lista principal do convidado antes do aceite). Front 328/328 (-1, teste
duplicado removido no processo). **Commitado e pushado** (`1a3f6f7`).

**Pendências reais, na ordem:**
1. Especificar "unificar/consolidar" em detalhe (nova seção na spec, decisões de modelagem) —
   **antes** de codar, mesmo padrão do resto da sessão.
2. Implementar unificar/consolidar — última peça do módulo Empréstimos.
3. Só depois disso: decidir se abre PR, ou escolher outra frente do ROADMAP (conferência de caixa
   é a candidata mais provável, mas só depois do módulo fechado).
5. Servidores locais (backend 5293, frontend 5173, Postgres) — **no ar** no fim da sessão.

**Achados que ainda restam no intake do ROADMAP** (não atacados nesta sessão):
- 🟡 P2 — Empréstimo ↔ Conta/Transacao real — **resolvido** para os dois fluxos existentes (criação
  e pagamento com aprovação já vinculam transação real dos dois lados). A "QUESTÃO CRÍTICA" de
  `familia/visao.md` §16.5 (despesa compartilhada × saldo real) continua em aberto — decisão de
  modelagem diferente, não coberta por isso.
- 🟡 P2 — forma de pagamento (parcelas/juros/multa) + parcelas expansíveis — spec pronta (ver acima).
- ⚪ P3 — agrupar/unificar empréstimos por pessoa — spec pronta (ver acima), depende do P2 acima.
- ⚪ P3 — gesto "toque duplo na traseira" (ressalva técnica: recurso nativo iOS, não dá pra PWA).
- 🟡 P1 catalogado em sessão anterior (fora do fluxo do empréstimo) — spec
  `docs/features/conferencia-caixa/spec.md` escrita, **não implementada ainda**: saldo declarado ×
  calculado, dois modos (achar lançamento faltante × aceitar ajuste automático).

> ⚠️ **Lição reforçada de novo:** contexto ficou grande outra vez nesta sessão (já passou por 1
> compactação hoje). Antes de compactar de novo, sempre atualizar este arquivo — é o que evita
> perder o fio.

## Próxima ação concreta

1. Commitar o motivo de rejeição (pronto, testado, verificado ao vivo).
2. Escrever a spec técnica de "unificar/consolidar" (nova seção em
   `parcelamento-e-agrupamento.md` §3) — devedor precisa aceitar, decidido com o Gustavo.
3. Implementar unificar/consolidar — última peça mapeada do módulo Empréstimos.
4. Só depois: decidir PR, ou trocar de frente (regra do Gustavo — módulo por completo primeiro).

**Depois de fechar Empréstimos por completo — escolha de direção** (decidir com o Gustavo):
- **2.3-frontend** (badge de papel, convite com papel, promover/rebaixar, gates de UI) — ainda pendente, sem trabalho nesta sessão.
- **Lote 3 (aquisição/SEO):** tela de Assinaturas, ferramentas grátis, referral.
- **Conformidade — pesquisa LEVE** (§8.6): LGPD #126 (base legal, direitos do titular, minimização, DPO/RIPD; e se BACEN/Open Finance se aplica). Tem componente legal/decisão.
- **P2 restante:** dropar regras de composição da senha (NIST) — decisão de UX do Gustavo (afrouxa a senha).
- **Deploy (futuro):** rotacionar segredos de prod; ajustar `connect-src` do CSP + baseURL hardcoded do axios pro domínio real.

---

## Entregue (2026-07-20)

- **Empréstimo compartilhado — vínculo bilateral (spec + backend + frontend)** ✅ — spec em `docs/features/emprestimo-compartilhado/spec.md` (validada contra OWASP API1:2023/BOLA, Pix Automático do Bacen, e Splitwise antes de codar). Backend: migration `AddVinculoEmprestimo`, fluxo de convite por e-mail com token hasheado (`OpaqueTokenHasher`, mesmo padrão do reset/refresh), autorização assimétrica de confirmação por `Tipo` (credor do registro específico, não só `CriadoPor`), soft-delete (bug do EF `defaultValue: false` corrigido antes de aplicar — teria apagado empréstimos existentes), `FinancialEventLog`, idempotência. Frontend: badge de vínculo + gate de pagamento/quitar por `souCredor`, modal de vincular com link pra copiar (sem envio de e-mail automático — projeto não tem SMTP real), seção de convites pendentes in-app (aceite sem token, por e-mail autenticado), landing pública `/convite/emprestimo/:token`. Back 323/323, front 317/317, 0 warning. **Verificado end-to-end no browser real com 2 contas** (não só teste automatizado): perspectiva invertida certa nos dois lados, gate de autorização confirmado (devedora não vê botão de pagamento).
- **Doc reconciliation** (início da sessão, antes do empréstimo) — PRs #232/#233/#234 mergeados: `STATE.md`/`ROADMAP.md` reconciliados contra `gh pr list` (1 mês sem review), exemplos MUI trocados por Pontes em `CLAUDE.md`/`STANDARDS.md`, item 2.2 corrigido (marcado "falta" já resolvido há semanas). Branch `claude/shared-loan-feature-d4327e` (nome não-conforme, criada pelo harness) apagada; convenção `feature/<slug>` retomada.
- **Seeder pessoal de dogfooding** — `Data/MeuCenarioSeeder.cs` (gitignored) + wiring via reflection em `Program.cs` (compila com ou sem o arquivo — CI/outros checkouts não quebram). Resolve o pedido de testar com cenário real sem colocar dado financeiro real ou de terceiro no Git.
- **Painel DEV do login virou lista** — 3 contas fictícias do seeder + extensível via `.env` local (`VITE_DEV_LOGIN_EXTRA`, gitignored).

## Entregue (2026-06-22)

- **UI da família — lista com cards ricos + página de detalhe** ✅ (branch `feat/familia-pagina-detalhe`, PR #233) — `/familias`: lista virou cards ricos (avatares + nomes dos membros, papel, chip do modo de rateio, seu saldo do mês "a receber / a acertar / quitado") clicáveis → detalhe em página dedicada `/familias/:id`. Detalhe extraído no componente reutilizável `FamiliaDetalhe` + casca fina `FamiliaDetalhePage`; resumo dos cards buscado por cima da lista (`getFamilia`+`getBalancoFamilia`). Mata a modalzona antiga (tudo empilhado).
- **Copy:** "deve" → "acerto / equilíbrio / a acertar / a receber" em todo contexto de casal (app `FamiliaDetalhe` + site Casais/Home/Sobre). "Deve" pesa como cobrança num relacionamento.
- **Login:** atalho de credenciais de teste (`dev@controle.test`) no canto inferior direito, clicável p/ autopreencher — só em DEV (`import.meta.env.DEV`), nunca em prod.
- tsc + lint limpos, 52 testes de família verdes, verificado no preview (cards, clique→detalhe, voltar, zero erro de console).
- **Abandonado:** export do DS pro "Claude Designer" (refazer o front existente lá dava muito retrabalho e frustração). Pasta `docs/ds-export/` apagada — não vai pro repo.
- _Ficou pronta e commitada em 2026-06-22 mas só ganhou PR/merge em 2026-07-17 — motivo de mais um mês sem review dos arquivos de estado._

## Entregue (2026-06-18) — reconstruído via `gh pr list`, nunca tinha sido registrado aqui

- **2.4 Aprovação de despesa** ✅ — back (PR #224): `Familia.LimiteAprovacao` + `Transacao.StatusAprovacao`, endpoints de aprovar/rejeitar, migration, 12 testes. Front (PR #225): config de limite, badge de status, botões aprovar/rejeitar.
- **2.1 Responsável de despesa** ✅ (PR #226) — `Transacao.ResponsavelUsuarioId`, atribuição por qualquer membro, filtro no feed.
- **2.3 Papéis/permissões — backend** ✅ (PR #228) — enum `PapelFamilia`, `FamiliaPermissoes` central nos 6 services, endpoint de permissão. Back 294/294. Front ainda não feito.
- **CI: zero warnings + GitHub Actions Node 24** ✅ (PR #227).
- **Vitrine do design system** ✅ — tokens de espaçamento/radii/sombras (PR #229), aba "Espaço & Efeitos" + fonte de título corrigida (PR #230).
- **Flake `CreditCardsPage` (CI vermelho)** ✅ (PR #231) — race de auto-foco + data hardcoded corrigidos.

## Entregue (2026-06-17)

- **Auditoria do módulo família (workflow 7 agentes)** ✅ — mapeou back+front+testes e reconciliou contra o ROADMAP. Veredito: fosso construído ponta-a-ponta com testes fortes; gaps reais = segurança de app de dinheiro. Status do Lote 2 corrigido no ROADMAP; achados catalogados (P1/P2/P3).
- **Acerto de contas endurecido (P1, branch `fix/familia-acerto-safety`)** 🟠→✅ — (1) **authz no cancelamento** (`AcertoService.CancelarAsync`): só criador ou partes (de/para) cancelam → `ForbiddenAccessException` (era: qualquer membro cancelava acerto alheio); (2) **idempotência** no POST `/acertos` (`idempotencyKey` no DTO + `BuscarPorIdempotencyKeyAsync`, padrão `ParcelamentoService`; front gera UUID estável por tentativa, reusa no retry); (3) **`FinancialEventLog`** (`AcertoRegistrado`/`AcertoCancelado`) em registrar/cancelar. Back 266/266 (+novos casos: replay idempotente, 403 de terceiro, cancel por participante, audit log); front 295/295 (+teste de service); build+lint verdes. _Descartado como não-bug: hard-delete de `RateioTransacao` (config de split, não ledger)._

## Entregue nesta sessão (2026-06-16)

- **1.3 Variação % vs mês anterior** ✅ (1ª feature de produto pós-segurança) — cards "Entrou/Saiu" do Dashboard ganham delta % vs mês anterior + seta colorida. Back: `EntradasCaixaMesAnterior`/`SaidasCaixaMesAnterior` no `DashboardDto`/service. 1 teste back + 2 front; verificado no preview (real: Entrou +10% verde, Saiu +6% vermelho).
- **CSP do SPA (frontend prod)** (P2) ✅ — `nginx.conf` que serve o build ganhou CSP estrita + headers de segurança (nosniff, X-Frame DENY, Referrer, Permissions). Dev/Vite não passa por nginx (HMR intacto). Verificado via build+curl. Prod real precisa ajustar `connect-src` + baseURL hardcoded do axios.
- **403 (ownership) × 401 (auth)** (P2) ✅ — `ForbiddenAccessException`→403; 27 sites de ownership remapeados (401→403); AuthService mantém 401 só pra autenticação real. Front não desloga mais em erro de permissão (interceptor só age em 401). Convenção em `PROMPT §11`. 14 asserts + caso 403 no middleware (back 255/255).
- **Refresh token hasheado no banco** (P2) ✅ — `RefreshToken.Token` virou hash SHA-256 (`OpaqueTokenHasher`); bruto só no cookie; `CriarRefreshTokenAsync` devolve `(entity, bruto)`; refresh/logout por hash. 3 testes (back 254/254).
- **Rotação dos segredos de DEV** ✅ — `JWT_SECRET` + senha Postgres novos (aleatórios, `openssl`) nos `.env` locais; Postgres recriado (volume novo) com a senha nova; API reseedada + login do dev verificado (cookie jwt assinado pela chave nova). Chave de dev antiga morta. (Prod fica pra quando deployar.)
- **A3 — segredos fora do compose/CI versionado** 🟠→✅ (código) — compose exige `${POSTGRES_PASSWORD:?}`/`${JWT_SECRET:?}` (sem default fraco), `.env.example` raiz + `.env` gitignored, CI passa valores efêmeros. Validado `docker compose config` (resolve com .env; falha sem). Confirmado: chave real **não está no git**.
- **Re-auth + CSP/headers** 🟠→✅ — verificado que troca de senha exige senha atual e que jwt+refresh estão em cookie HttpOnly+Secure+SameSite=Strict (não há troca de e-mail/delete); `SecurityHeadersMiddleware` novo: CSP (estrita p/ API, relaxada p/ Swagger/Hangfire) + nosniff + X-Frame DENY + Referrer + Permissions + HSTS(HTTPS). 5 testes (back 251/251). Headers confirmados ao vivo via curl.
- **Reset token hasheado + rate-limit por conta + política 15 chars** 🟠→✅ — token guardado como SHA-256 (`OpaqueTokenHasher`), bruto só no e-mail; rate-limit 3/conta/hora no job; política 10→15 + teto 128 (front e back, com testes ajustados). Achados catalogados (P2): refresh token plaintext, NIST dropar composição. Back 246/246, front 287/287.
- **A1/A2 — PasswordHasher** 🟠→✅ — migrado p/ **Argon2id** (Konscious, m=19456/t=2/p=1, salt 16B, saída 32B), formato versionado + **rehash transparente no login** (aceita hash legado PBKDF2, regrava sem reset). Decisão por **deep-research verificado** (OWASP/NIST, 24/25 claims). 8 testes (back 238/238).
- **C3 — soft-delete de `Transacao`** 🔴→✅ — `DeletarAsync` virou soft delete (`Ativo=false`+`Cancelado`+`CanceladoEm`+motivo) e **global query filter** `HasQueryFilter(t => t.Ativo)` no `Transacao` exclui canceladas de toda query/navegação. Corrige de quebra pernas de transferência soft-deleted que apareciam na lista. 3 testes (back 230/230).
- **C2 — contrato de exceção** 🔴→✅ — 67 `throw new Exception(...)` → tipos certos (404/400/409/401 por semântica); `GlobalExceptionHandlerMiddleware` deixou de ecoar `Message` no 500 (genérico; detalhe só no log). 5 testes do middleware + 26 asserts atualizados (back 227/227). Conversão feita via workflow (9 services em paralelo + verificação adversarial).
- **C1 — reset token não vaza mais** 🔴→✅ — `/forgot-password` responde genérico e idêntico pra qualquer e-mail; geração de token + envio agora é **fire-and-forget** (`HangfirePasswordResetDispatcher` → `PasswordResetEmailJob` → `IPasswordResetEmailSender`). Mata account takeover + timing/enumeração. 6 testes de regressão (back 222/222).
- **Flaky test `RecorrentesPage`** corrigido — `getAllByTitle` síncrono → `await findAllByTitle` (header estático rendava antes das rows async). PR #204.
- **Reorg de docs (solo)** — modelo `ROADMAP` + `STATE`; Q5 arquivado; COLLABORATION deletado; QUICK_REFERENCE/CLAUDE/PROMPT/GIT_WORKFLOW atualizados; `docs/` limpo (redesign-ux Q4 → history, ponteiros consertados).
- **Auditoria do código herdado** — `docs/AUDITORIA_CODIGO_HERDADO.md`. 3 🔴 (C1/C2/C3) + altos.
- **Branches consolidadas na `main`** — #114 (Postgres único) + #92 (E2E Playwright) cherry-picked; fix crítico de boot (Npgsql legacy timestamp órfão pós-#114) achado pelo CI.
- **CI E2E via docker compose** — robusto (corrigiu compose quebrado: API porta 8080→5293).
- **Caio + João apagados do repo** — autoria reescrita (196 commits → só Gustavo), **132 co-autorias do Claude removidas** da história, histórico **linearizado** (sem merge commit), removidos do site (Sobre) e das branches. Refs órfãs limpas.
- **Versionamento** — SemVer 0.x; `CHANGELOG.md` + `docs/RELEASING.md` (processo); release **`v0.9.0`** publicada. `1.0.0` reservado pro lançamento público.
- **Pesquisa de segurança** — deep-research verificado (OWASP/NIST) → `docs/SEGURANCA_BEST_PRACTICES.md`. Gaps abertos (rate-limit cortou): MFA-.NET, rotação de segredos, cripto-at-rest, logging, LGPD/BACEN — **re-pesquisar**.
- **Regra de conformidade gravada** (CLAUDE.md): sempre pesquisar prática bancária + LGPD + regulatório antes de lançar.

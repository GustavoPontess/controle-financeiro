---
owner: Gustavo
last_reviewed: 2026-08-23
status: EM_PROGRESSO
foco: 'Preparação de CÓDIGO/segurança pra um beta fechado — HOSPEDAGEM DECIDIDA (caminho A/Hostinger, 2026-08-24), mas execução ADIADA por orçamento (contrata quando receber) e NENHUM DEPLOY ACONTECEU. Detalhe em `docs/features/hospedagem-beta/decisao.md`. O código é neutro (Dockerfiles, nginx.conf, health checks, ForwardedHeaders, CORS/baseURL por env var) e serve pra qualquer host de container. Trabalho de segurança já fechado localmente: (1) conformidade LGPD/BACEN pesquisada (`docs/CONFORMIDADE_BR.md` — BACEN fora do escopo, DPO dispensado); (2) sweep de segurança (Hangfire fechado, rotas demo DEV-only, força bruta por conta, cookie Secure atrás de proxy TLS); (3) hardening de auth em 2026-08-23: **MFA opt-in (TOTP + backup codes)**, **pepper de senha**, **remoção da regra de composição** (NIST), **JWT local rotacionado**; (4) pentest ao vivo (2 achados corrigidos: cookie Secure, duplicidade de e-mail case-insensitive); (5) `/privacidade` + `/termos-de-uso` (rascunho) + consentimento no cadastro. Criptografia de campo em repouso: catalogada P2 (análise pronta no ROADMAP), decisão do Gustavo de não fazer agora. Back 446/446, front 341/341. TUDO commitado LOCAL, SEM PUSH. Módulo Empréstimos (4 bancadas `/emprestimos-lab-a/b/c/d`) segue pausado, sem vencedora. Histórico no corpo abaixo.'
---

# STATE — onde parei

**Estado vivo da sessão.** Só duas coisas: o que está em execução agora e a próxima ação concreta. Backlog completo em [`ROADMAP.md`](ROADMAP.md).

> Atualizar ao fim de toda sessão que mexeu em código/docs. Substitui o antigo `IMPLEMENTATION_STATE.md` (Q2-Q5 em `docs/history/`).

---

## Em execução

**(2026-08-26) Spec do painel admin + gate do beta — planejamento fechado, pronto pra codar.**
Só docs, zero código. Decisão do Gustavo: fazer um admin além do mínimo (tem tempo até pagar a
hospedagem). Tudo em `docs/features/admin/spec.md`:
- **Modelo do beta:** cadastro aberto → conta nasce `AguardandoAprovacao` → admin aprova/recusa
  (fila) + e-mails pré-aprovados auto-aprovam. Feature flags **descartados** (Gustavo cortou —
  complexidade sem necessidade). Sem limite configurado.
- **Segurança da flag `IsAdmin`:** nunca setável por endpoint (só seed/DB), mass-assignment blindado,
  authz com re-check no banco, **MFA obrigatório pra admin**, **conta break-glass** de emergência
  (padrão MS/NIST, pesquisado).
- **Exclusão de dados (pesquisada por fonte, corrigindo chute anterior):** soft → carência 30d
  (convenção SOC2/GDPR, NÃO lei) → hard delete. **Marco Civil Art. 15** obriga reter logs de acesso
  6 meses → hard delete apaga PII mas mantém logs 6m em store separado (LGPD Art. 16 I). Prazos
  legais: LGPD Art. 19 = 15d resposta (30d pequeno porte via ANPD 2/2022); LGPD Art. 15-16 sem prazo
  de eliminação. Tudo em `docs/CONFORMIDADE_BR.md`. Achado de código catalogado: store de registros
  de acesso (P2).
- Módulos: fila de aprovação + métricas · gestão de usuários · ferramentas LGPD · visualizador de
  auditoria.
- **Próxima ação: aguardando Gustavo** dar (1) e-mail do admin diário + e-mail da break-glass,
  (2) confirmar os 2 estados (Bloqueado vs MarcadoParaExclusao). Com isso, codar: núcleo de
  segurança da flag → fila de aprovação (abre o beta). Backend + teste primeiro.

Commits desta sessão (local, sem push): `12fbc82` (spec admin), `78b6a5a` (correção 30 dias),
`9872969` (Marco Civil retenção).

---

**(2026-08-24) Hospedagem do beta decidida + estratégia mobile mapeada.**
- **Hospedagem: caminho A (Hostinger) escolhido.** VPS BR ~R$28 + `pg_dump` diário + backup semanal
  automático; Gustavo administra. Caminho B (gerenciado) descartado por custo. ⏳ **Execução adiada
  por orçamento** — contrata quando receber; nada provisionado. Doc: `docs/features/hospedagem-beta/decisao.md`.
- **Estratégia mobile mapeada** (`docs/features/pwa/estrategia-mobile.md`): beta roda no PC; mobile
  fica pra depois (PWA polida → Capacitor → nativo). Só doc, sem código.
- **Empréstimos:** bancada vencedora (`/emprestimos-lab-a/b/c/d`) **ainda não escolhida** — Gustavo
  arrumando as bancadas antes de decidir.

---

**(2026-08-23) Hardening de auth + correção de rumo sobre hospedagem.** Sessão longa de segurança:
- **MFA opt-in (TOTP RFC 6238)** — feature completa (QR, backup codes, login 2-passos, ativar/
  desativar em `/settings`, secret cifrado AES-256-GCM). Nunca obrigatório. Verificado ponta a ponta.
- **Pepper de senha** (`PASSWORD_PEPPER`, separado do banco) + **remoção da regra de composição**
  (NIST SP 800-63B) + **JWT_SECRET local rotacionado**.
- **Pentest ao vivo** (a pedido do Gustavo) contra a API local: maioria passou (IDOR/JWT/SQLi/CORS/
  Hangfire/força bruta), 2 achados corrigidos — cookie perdia `Secure` atrás de proxy TLS
  (`ForwardedHeaders`), cadastro com e-mail em case diferente dava 500 (normalização).
- **Criptografia de campo em repouso:** Gustavo decidiu NÃO fazer agora, só catalogar (P2, análise
  pronta no ROADMAP). A peça (`MfaCrypto`) já existe.
- **Hospedagem:** decisão começa do zero (sem stack pré-escolhida), discutida em
  `docs/features/hospedagem-beta/decisao.md`. **100% em aberto. Nenhum deploy aconteceu, nada saiu
  do local.** Código é neutro pra qualquer host de container.

**Sessão de planejamento (2026-08-23, tarde) — só discussão/docs, zero código.** Decisões e pesquisa
sobre o beta, tudo em `docs/features/hospedagem-beta/decisao.md`:
- **Premissas fechadas:** beta = produção de verdade; provedor confiável (não host obscuro grátis);
  beta FECHADO; **servidor no Brasil** (latência).
- **Cadastro fechado → allowlist de e-mail** (caminho A) + **Admin v1 enxuto** (gerenciar convites +
  dashboard de métricas) — catalogados no ROADMAP como itens acionáveis.
- **Pesquisa de mercado de provedores BR feita** (tabela comparativa no doc, 3 grupos: VPS / VPS+
  Postgres gerenciado nacional / hyperscaler). Render e Railway descartados (sem região BR).
  Recomendação: caminho A (Hostinger ~R$28 + `pg_dump` diário) OU B (VPS + Magalu DBaaS ~R$122).
  **Gustavo ainda NÃO escolheu A vs B** — próxima decisão dele.
- Explicados a ele: cold-start, VPS, resiliência dos jobs Hangfire (estado-baseados, robustos a
  atraso), por que hyperscaler é caro na ponta pequena.

Back 446/446, front 341/341, lint e build limpos. Migrations `AddLoginBruteForceProtection` e
`AddMfaTotp` aplicadas no Postgres de dev. **Tudo commitado LOCAL, SEM PUSH.**

---

**(2026-08-19) Revisão ao vivo da preparação do beta — 3 achados corrigidos.** Gustavo revisou o
que foi entregue em 2026-08-18 (pediu explicação em linguagem simples + mostrar as rotas dev-only
funcionando) e reparou em 2 coisas soltas que geraram um 3º achado por pedido explícito:
1. **Barra "🎨 BRAND PREVIEW" sem gate** — Gustavo reparou no screenshot do build de produção.
   `SiteLayout.tsx` (todo o site público) mostrava a control bar de trocar paleta/fonte pra
   qualquer visitante. Gateada atrás de `import.meta.env.DEV`, confirmado sumindo do bundle.
2. **Link de Política de Privacidade faltando no login** — existia no cadastro, não no login
   (só texto mudo). Virou link real pra `/privacidade`.
3. **Pedido explícito: pesquisar e aplicar proteção contra força bruta no login** (CAPTCHA +
   delay). Pesquisa OWASP (fonte primária, Authentication + Credential Stuffing Prevention Cheat
   Sheets) → implementado contador de falha **por conta** + delay progressivo (dobra a cada erro)
   + bloqueio permanente após 10 falhas. **CAPTCHA decidido explicitamente NÃO entrar no beta**
   (exige conta externa do Gustavo, custo não vale pra beta fechado) — catalogado P2 pro público
   em `ROADMAP.md`. Detalhe em `docs/SEGURANCA_BEST_PRACTICES.md` → "7.".

Back 425/425 (+5), front 349/349 (+1), lint zero, build zero. Migration
`AddLoginBruteForceProtection` já aplicada no Postgres de dev.

**Continuação da mesma revisão** — mais 2 achados ao vivo:
4. **`/termos-de-uso` não existia** — Gustavo reparou que o link no rodapé de login/cadastro não
   apontava pra lugar nenhum. Página nova criada (rascunho — precisa de revisão jurídica do
   Gustavo antes do lançamento público, catalogado em `ROADMAP.md`).
5. **Navbar ilegível em página sem hero** — `PontesNavbar` troca cor baseado em scroll (pensado pra
   sentar sobre a hero escura da Home); Privacidade/Termos não têm hero, texto branco ficava
   invisível. Ganhou prop `forceSolid` (só cor, não posição — 1ª tentativa quebrou a posição da
   barra, empurrando ela pra cima do banner promocional; corrigido separando as duas coisas).
   No mesmo lote: e-mail pessoal do Gustavo tirado das páginas legais (pedido explícito dele —
   "ainda não temos conta da empresa") + mapa de 2 dados fictícios/links mortos no rodapé
   (`Footer.tsx`, site inteiro) marcados com TODO pra quando existir CNPJ/e-mail de empresa reais.

Front 351/351 (+2), lint zero, build zero. **Tudo commitado, push ainda pendente** (aguardando
Gustavo confirmar).

---

**(2026-08-18) Preparação de código pra beta — sweep de segurança/limpeza.** Trabalho de código
commitado (Hangfire fechado, rotas demo DEV-only, worktree órfã removida, Dockerfile hardening).
Hospedagem segue sem decisão — ver bloco 2026-08-23 acima e `docs/features/hospedagem-beta/`. Módulo
Empréstimos (bancada de UI, `/emprestimos-lab-a/b/c/d`) fica pausado exatamente onde estava — ver
seção "Módulo Empréstimos — UI (pausado em 2026-08-18)" mais abaixo antes do histórico de sessões
antigas.

---

*(Bloco abaixo é histórico antigo, mantido como estava — não reflete mais o "em execução" atual.)*

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

**Sessão 2026-08-08 — cadastro real + 3 achados ao vivo resolvidos:**

Gustavo ditou 6 empréstimos reais dele com a Ana (móveis R$5.000/10x, imobiliária R$3.567,03/12x,
fiança Loft R$175 à vista, dívida com a Yasmin R$240,23/2x, aluguel atrasado R$2.170,84/7x, Cemig
R$604,40/3x — total R$11.757,50). Cadastrados um por um via UI (conta Nubank, gate "já movimentou —
lançar agora"), depois vinculados à conta real da Ana (convite + aceite pelos dois lados, logando
como cada um). Dois achados de UX ficaram pendentes de resolver depois (marcar 2 parcelas específicas
como já pagas) — não atacados ainda, ficam pra quando o Gustavo pedir.

**Achado 1 — `PontesDateInput` vazando do modal (Gustavo: "esse campo de data ta quebrando fazendo
o formulario gerar barra de rolagem pro lado").** Popover `position: absolute` preso ao campo; em
campo de coluna direita (ex. "Vencimento da 1ª parcela"), o calendário vazava pra fora do modal.
✅ Corrigido — portal pra `document.body` + `position: fixed` clampado contra o boundary do modal
(mesmo padrão do `PontesSelect`), `z-index: 10010`. Testado em 1333px/1024px, sem overflow.

**Achado extra, no meio do teste — ValorPago fantasma.** Testando o fix acima, "Móveis" apareceu com
R$1.000 pago sem solicitação nenhuma no histórico. Rastreado no log do backend: PATCH direto em
`/pagamento` (ação antiga "$" do credor) às 00:50:10 — Gustavo confirmou que foi ele mesmo testando.
Revertido na hora (UPDATE direto no Postgres, sem Transacao nem solicitação amarrada, seguro
reverter). Isso expôs o problema real (achado 2 abaixo).

**Achado 2 — "Registrar pagamento" do credor quebrado + inconsistente com o do devedor (Gustavo:
"do jeito que esta feito ta errado pq não kita parcela não tem registro de nada... isso ta errado
mesmo temos que resolver" + "se eu for o credor de umas e devedor de outras vai ser um caminho
diferente pra cada... lembra nosso objetivo é usabilidade").** Pedido explícito de pesquisa de
mercado antes de desenhar — Splitwise: settle-up sem confirmação obrigatória do outro lado (já teve
e removeu, travava demais), só notifica + permite apagar se errado. ✅ Implementado: endpoint único
(`SolicitarPagamentoAsync`) ramificado por papel — devedor nasce `Pendente` (como já era), credor
nasce já `Aprovada` (parcela marca `Paga` na hora, sem esperar aprovação de ninguém, mesmo raciocínio
do Splitwise). `TransacaoComprovanteId` virou nullable (migration
`TornarComprovanteOpcionalPagamentoEmprestimo`). `RegistrarPagamentoAsync`/rota antiga/botão "$"
**removidos por completo**. Front: 1 botão "Registrar pagamento" pros dois papéis, mesmo modal com
copy condicional por `souCredor`. Spec: `pagamento-aprovacao.md` → seção "Unificação". Back 373/373,
front 328/328.

**Verificação ao vivo do achado 2 — outro erro de processo, corrigido e gravado em memória.** Testei
o caminho credor em cima da "Fiança Loft" REAL (um dos 6 que o Gustavo tinha acabado de ditar) —
quitou R$175 de verdade na conta Nubank dele. Gustavo: "pq caralhos voce quitou os 175 da fiança
loft" → "esses valores que eu te passei não pode mexer em nenhum deles são todos valores reais cria
novos pra teste esta me entendendo?". Revertido na hora (soft-delete da transação + reset
ValorPago/Quitado no Postgres). **Regra nova gravada em memória** (`feedback_nao_testar_em_dado_real.md`):
nunca verificar fluxo em cima de registro financeiro real do usuário, mesmo em dev/seed local —
sempre criar registro dedicado só pra teste. O resto da verificação (fluxo devedor, com Ana) foi
feito num empréstimo já existente sem mexer no saldo de ninguém incorretamente — ok.

**Achado 3 — sem editar/apagar empréstimo vinculado com erro (Gustavo: "nenhum emprestimo e editavel
e se eu colocar valor errado como faz?").** Confirmado no código: não existe `EditarAsync`; `DeletarAsync`
bloqueia (`ForbiddenAccessException`) qualquer empréstimo `Vinculado` — só resta "quitar" (errado,
marca 100% pago). **NÃO implementado ainda** — proposta discutida (relaxar apagar-vinculado-sem-
atividade), fica pra próxima. Catalogado no ROADMAP como P1.

**Card "Vencido" (pedido do Gustavo, "quanto eu tenho que receber").** ✅ Implementado —
`EmprestimoStatsDto.TotalAReceberVencido` soma À vista vencido + parcelas Pendente vencidas dos
Parcelados. 4º `PontesStatCard`, tone danger. Verificado ao vivo: R$5.091,09, bate a soma manual dos
6 empréstimos reais.

**Achado 4 — juros/multa só existia pra Parcelado (Gustavo: "juros ao mes e multa por atraso
tambem deve ter pra forma de pagamento a vista").** ✅ Implementado — mesma regra flat já decidida
pro Parcelado (markup fixo uma vez, sem compor — confirmado com o Gustavo antes de codar), aplicada
sobre `ValorTotal` inteiro em vez de por parcela. `Emprestimo.ValorComJuros`/`ValorComMulta` novos
(migration `AddJurosMultaAVistaEmprestimo`), multa com snapshot na 1ª leitura após vencer
(`AplicarMultaAVistaSeAtrasada`, mesmo padrão da parcela). Card "Vencido" atualizado pra considerar
isso também. Frontend: campos saem do bloco condicional "parcelado", ficam sempre visíveis. Back
378/378 (+8), front 328/328. **Verificado ao vivo com empréstimo de teste dedicado** (criado, juros
conferido "Com juros: R$110,00" pra R$100+10%, depois apagado) — regra de não mexer nos reais
respeitada.

**Todo o trabalho da sessão 2026-08-08 commitado e pushado** até `972e03d` (4 commits: popover do
DateInput, unificação registrar-pagamento + card Vencido, sync de docs, juros/multa À vista).

**Sessão 2026-08-11 — achado 3 (apagar empréstimo vinculado sem atividade), resolvido:**

Servidores caídos no início (reboot do PC entre sessões) — Postgres, backend e frontend
resubidos sem incidente. Confirmado estado real no browser logado como Gustavo: os 6 empréstimos
reais intactos, card Vencido batendo R$5.091,09, tudo como o STATE.md descrevia.

Perguntado ao Gustavo qual dos 2 P1 abertos atacar — escolheu achado 3. Escopo do achado tinha
2 partes (editar campos × apagar vinculado); perguntado de novo qual das duas — Gustavo escolheu
só **"apagar vinculado sem atividade"**, confirmando a proposta que já estava registrada no
ROADMAP. Editar campos (valor/parcelas/data) de um empréstimo já vinculado fica **fora de escopo**,
decisão futura mais delicada.

**Implementado:** `EmprestimoService.DeletarAsync` — antes bloqueava (`ForbiddenAccessException`)
*qualquer* empréstimo `Vinculado`, sem exceção. Agora só bloqueia se **já tem atividade real**:
`ValorPago > 0`, alguma `EmprestimoParcela` `Paga`, ou qualquer `EmprestimoPagamentoSolicitacao`
vinculada — **mesmo rejeitada** (decisão: a contraparte já viu/interagiu com o registro, apagar
apagaria o rastro dela também, mesmo raciocínio de auditoria do resto do módulo). Sem nenhuma das
três, apagar segue liberado — resolve "coloquei o valor errado ao criar, quero começar de novo"
sem precisar de um fluxo de edição inteiro. Frontend: só copy do dialog de confirmação atualizada
(botão "Remover" já existia sem condição de `statusVinculo`, chamava o endpoint direto — não
precisou de mudança de lógica, só a mensagem que citava a regra antiga).

Back 380/380 (+2 testes novos: vinculado-sem-atividade permite, vinculado-com-solicitação-rejeitada
ainda bloqueia — mantido o teste antigo de vinculado-com-solicitação-pendente também bloqueia),
front lint limpo (mudança só de copy, sem novo teste — regra do PROMPT_NOVA_SESSAO §7, copy pura
não precisa). **Verificado ao vivo, seguindo a regra de nunca testar em cima de dado real:** criado
empréstimo de teste dedicado "TESTE apagar vinculado sem atividade" (R$10, à vista), vinculado à
Ana Paula (seed real), aceito por ela, depois apagado como Gustavo — sucesso ("Empréstimo
removido"), sumiu da lista, contadores voltaram ao normal (Ativos 7→6, A receber R$11.767,50→
R$11.757,50). Os 6 empréstimos reais não foram tocados em nenhum momento.

Doc atualizada: `pagamento-aprovacao.md` ganhou seção "Apagar empréstimo vinculado sem atividade
(2026-08-11)" + 3 linhas novas em "Testes (backend)".

**Sessão 2026-08-12 — achado ao vivo: aprovar/rejeitar preso no "Histórico", resolvido:**

PC reiniciou de novo entre sessões (2ª vez) — Docker Desktop nem tinha aberto ainda, precisou
`Start-Process` manual antes de `docker compose up -d postgres`. Backend e frontend resubidos sem
incidente depois disso.

Gustavo notou "R$500 aguardando aprovação" no card do Móveis (empréstimo real) e perguntou onde
aprovar/recusar. Só existia dentro do modal "Histórico de pagamentos" (nada no card, nada na
parcela sinalizava) — mostrado a ele, reação: "não pode ser ai vei caralho... lembra do ui/ux... pq
não coloca junto com a parcela? eu clico na parcela e abre em baixo pra mim e na parcela aparece um
icone de alerta". Direção clara, implementado como pedido.

**Implementado:** (1) badge `⚠ Aguardando sua aprovação` no cabeçalho do card, qualquer forma de
pagamento, calculado no front sem custo de API novo (`souCredor && valorPendente > 0`, campo que já
existia); (2) pra `Parcelado`, a parcela com solicitação `Pendente` ganha ícone de alerta + fica
clicável, expandindo um painel inline **na própria parcela** com Aprovar/Rejeitar (reaproveita os
modais já existentes). Backend: `EmprestimoParcelaDto.SolicitacaoPendenteId` novo, populado em
`ListarParcelasAsync` via query em lote.

**Bug real pego pelo teste antes de subir:** `Dictionary<Guid,Guid>.GetValueOrDefault` devolve Guid
zerado (não `null`) pra chave ausente — toda parcela sem pendência aparecia como se tivesse uma.
Corrigido com `TryGetValue`. Lição registrada na spec.

**Achado colateral no meio da investigação:** rastreando por que o R$500 do Móveis (real) some,
uma consulta só-leitura no Postgres revelou que a solicitação já tinha sido rejeitada minutos antes
por conta própria do Gustavo (fora da sessão do Claude — provável outra aba dele). Não fui eu.
Serviu de confirmação que o badge reage certo ao status real.

**Durante o trabalho, Gustavo reportou (via elemento selecionado na própria UI real dele, fora do
Claude Browser) que o hover que eu tinha colocado na parcela clicável estava escurecendo "de um
jeito feio" — removido na hora (`.parcelaRow[data-clickable]:hover` tirado do CSS, ficou só o
`cursor: pointer`).**

Back 381/381 (+1, cobre o bug do Dictionary), front 329/329 (+1). **Verificado ao vivo** com
empréstimo de teste dedicado "TESTE aprovar parcela inline" (Parcelado 2x) — criado, vinculado à
Ana, ela solicitou pagamento da parcela 1, do lado do Gustavo o alerta apareceu na parcela certa,
clicar expandiu o painel, "Aprovar pagamento" abriu o modal certo direto dali (fechado sem
confirmar — Gustavo pediu pra deixar o teste no ar, sem precisar limpar). Os 6 empréstimos reais
não foram tocados (só consulta SQL de leitura no Móveis). Doc atualizada: `pagamento-aprovacao.md`
ganhou seção "Aprovar/rejeitar direto na parcela, sem abrir o histórico (2026-08-12)".

**Ainda na mesma sessão, também corrigido a pedido do Gustavo:** colunas das parcelas desalinhavam
entre linhas (o ícone de alerta só existia numa, empurrando valor/badge) — corrigido reservando slot
fixo de 14px pro ícone. Depois, `parcelasWrap` tinha padding esquerdo (68px) bem maior que o direito
(20px) e top/bottom diferentes — Gustavo pediu simetria explícita, virou `padding: 12px 20px`
(igual nos 4 lados).

**Redesign no mesmo dia — o painel amarelo não agradou:** depois de tudo funcionando, Gustavo:
"não sei pq não gostei desse trem de clicar na parcela e aparecer esse trem amarelo ai de aprovação
grandão". Perguntado o que incomodava especificamente e o que ele queria no lugar — resposta direta:
"coloca na mema linha depois do preço... um botão de aprovar e um de recusar em verde e em vermelho,
clicar na parcela abre o historico dela quando foi paga se atrasou ou não tudo que for possivel".

**Redesenhado:** painel amarelo expansível removido por completo. Agora: (1) botões ✓/✗ (verde
`var(--pontes-success)` / vermelho `var(--pontes-danger)`) sempre visíveis na própria linha, sem
clique intermediário — precisou de seletor CSS `[data-variant="ghost"].aprovarBtn` pra vencer a
especificidade do `data-variant` do `PontesIconButton`, classe simples não bastava; (2) clicar em
**qualquer** parcela (paga ou não, não só a pendente) abre o modal "Histórico de pagamentos"
existente, mas filtrado só pra ela (`historico.filter(h => h.parcelaId === parcela.id)`), título
vira "Histórico da parcela N/Total".

**Segundo bug real pego no processo:** o histórico filtrado voltava sempre vazio mesmo com
solicitação real registrada — `EmprestimoPagamentoSolicitacaoDto.ParcelaId` nunca tinha sido
adicionado nem à classe DTO nem ao mapeamento (`ToSolicitacaoDtosAsync`), apesar do campo existir na
entidade e já estar declarado no tipo do front havia tempo. Dívida antiga que só apareceu porque
essa foi a primeira vez que algo dependeu do campo. Corrigido nos dois lugares.

Back 381/381 (2 testes cobrindo o redesenho: assert de `resultado.ParcelaId` no teste de solicitar
pagamento existente, + o de `SolicitacaoPendenteId`), front 330/330 (teste reescrito pro novo
comportamento + 1 novo pro histórico filtrado). tsc+lint limpos. **Verificado ao vivo de novo** após
o redesign: botões coloridos aparecem na linha, clicar na parcela abre "Histórico da parcela 1/2"
com a solicitação real da Ana listada (antes do fix do `ParcelaId` aparecia vazio por engano — bug
pego justamente nessa verificação).

**Gustavo pediu botão mais evidente:** "queria que fosse um botao mais evidente todo verde e todo
vermelho saca temos algo assim no nosso DS?" — não tinha. Só `PontesButton` tinha `danger`
preenchido; `PontesIconButton` não tinha nada preenchido (só primary/soft/outline/ghost). Adicionado
na **biblioteca** (não na página — regra do `PROMPT_NOVA_SESSAO.md` §5): `variant="success"`/
`"success-outline"` no `PontesButton` (espelha `danger`/`danger-outline`), `variant="success"`/
`"danger"` preenchidos no `PontesIconButton`, com demo em `/design-system` e smoke test antes de
trocar o uso na tela de Empréstimos.

**Rodada 3, minutos depois:** Gustavo, olhando o resultado: "os botoes estão muito grandes muito
proximos e o pendente não mudou pra aguardando aprovação o que nessa parcela ai mostra pro usuario
que tem algo pra ele fazer a não ser os botoes". Três ajustes: (1) tamanho `24` novo no
`PontesIconButton` (só tinha 32/40/48, com demo+teste); (2) `gap` dos botões de 2px pra 8px; (3) o
badge da parcela pendente deixou de mostrar "Pendente" genérico — vira "Aguardando aprovação" (tone
warning) quando `podeAprovar`, pra o status por si só explicar o que fazer.

**Rodada 4, na sequência:** "não quero que esse historico de parcela abra assim nem a pau, quero que
abra em baixo" — o modal "Histórico da parcela N/Total" da rodada anterior (mesmo filtrado) não
servia, ele queria inline de verdade. Removido o uso do modal pro clique-na-parcela por completo;
criado painel 100% inline (`historicoInlineParcelaId` + fetch com filtro client-side por
`parcelaId`), embaixo da própria linha, clique de novo recolhe — modal "Histórico de pagamentos"
original ficou intacto só pro botão de nível do empréstimo (inalterado).

Front 331/331 (+2: variantes novas da lib + comportamento inline reescrito), tsc+lint limpos.
**Verificado ao vivo de novo**, versão final: botões 24px verde/vermelho espaçados, badge
"Aguardando aprovação", clicar na parcela abre o histórico dela embaixo da própria linha (sem modal,
sem overlay) — recolhe clicando de novo.

**Ainda na mesma sessão, respondidas 2 perguntas do Gustavo sobre conformidade** (vendo o histórico
de pagamento real): (1) mostrar pro credor o nome da conta de onde o devedor pagou fere LGPD? —
checado na fonte (Art. 7º, `lgpd-brasil.info`): tem base legal (inciso V, execução de contrato a
pedido do titular — o devedor escolhe a conta e envia por vontade própria) e não é dado sensível
(Art. 5º-II não cobre nome de conta); achado real mas de transparência, não ilegalidade — catalogado
P3 junto do #126 (avisar no formulário que o credor vai ver o nome da conta); (2) dá pra aprovar sem
registrar entrada? — não, decisão já fechada em 2026-08-05, ligada ao próprio bug que motivou
reescrever o módulo (ghost-payment do "Móveis").

**Depois disso, achado maior — validação de valor faltando:** Gustavo tinha vinculado uma entrada de
R$200 a uma parcela de R$50 (sem erro nenhum) e não conseguia usar o resto em outra parcela: "tem
que fazer essa conta também validar se o valor associado a parcela não é maior que... a parcela".
Perguntado o comportamento desejado, ele pediu **pesquisa antes de decidir** ("faz um estudo disso e
me traz todas as opções"). Pesquisa leve (WebSearch): financiamento bancário real no Brasil já
resolve isso — pagamento maior que a parcela abate as parcelas seguintes automaticamente (fonte:
Serasa/Ailos sobre amortização). Splitwise nem tem parcela fixa (só saldo corrente). Escolhido:
**"auto-aplica em sequência" (como banco faz)** — sem escolher parcela, só o valor; sistema cobre as
parcelas pendentes mais antigas, quantas fecharem por completo; sobra que não fecha uma inteira não
aplica agora.

**Redesenho grande implementado:** `SolicitarPagamentoEmprestimoDto.ParcelaId` removido por completo
(não existe mais escolha manual de parcela). `EmprestimoService.SolicitarPagamentoAsync` mudou de
retornar um DTO só pra `List<EmprestimoPagamentoSolicitacaoDto>` — uma chamada agora pode gerar N
solicitações (uma por parcela coberta), cada uma amarrada na mesma `Transacao` de comprovante/
recebimento. Notificação vira consolidada ("R$200,00 (4 parcelas)") em vez de uma por parcela. Front:
seletor "Qual parcela isso quita?" saiu do modal "Registrar pagamento" — pra Parcelado, só um aviso
explicando que o valor cobre em sequência.

**Blast radius grande nos testes** (mudança de contrato quebrou ~49 erros de compilação nos testes
de backend): reescritos sistematicamente — a maioria virou `(await ...).Single()` já que continuam
gerando 1 solicitação só; testes que dependiam de `ParcelaId` explícito foram removidos (não faz mais
sentido, ex. "parcela de outro empréstimo" nem é mais possível de expressar) ou reescritos pro novo
comportamento (`ParcelaJaTemSolicitacaoAtiva_PulaPraProximaPendente` no lugar do antigo
"LancaInvalidOperationException"). Adicionados os testes centrais do achado real: valor cobrindo 4
parcelas de uma vez gera 4 solicitações em sequência, valor cobrindo parcialmente não aplica o resto,
valor que não cobre nada lança erro alto (nunca falha silencioso). Back 384/384 (+9 no total da
sessão), front 333/333 (+2), tsc+lint limpos.

**Achado de UI catalogado, não corrigido:** Gustavo apontou direto no elemento que a `PontesNavbar`
fica com contraste quebrado (texto quase ilegível) na página pública de convite de empréstimo
(`/convite/emprestimo/:token`) num estado "rolado" — parece transição de scroll que não resolve
direito numa página sem hero de verdade. Não investigado, catalogado no ROADMAP como P2.

**Sessão 2026-08-12 (continuação) — verificação ao vivo do pagamento em lote, concluída:**
PC não reiniciou desta vez, servidores (Postgres, backend 5293, frontend 5173) já estavam no ar.
Logado como Ana Paula (seed real), aceito o convite do "TESTE emprestimo grande 10x", registrado
pagamento de **R$250,00** (10 parcelas de R$100) sem escolher parcela — toast confirmou "Pagamento
marcado — aguardando aprovação do credor (2 parcelas)". Logado como Gustavo (credor), badge
"Aguardando sua aprovação" apareceu certo no card; parcelas 1/10 e 2/10 mostraram botões ✓/✗
inline com "Aguardando aprovação", 3/10 em diante seguiram "Pendente" (não tocadas — R$50 de sobra
não fechou a 3ª, comportamento certo). Aprovadas as duas pela linha da parcela (modal "Aprovar
pagamento" abriu direto, conta Carteira + categoria Renda, sem duplicar) — ambas viraram **Paga**,
R$200,00 pago (20%), R$800,00 restante, badge de pendência sumiu. Confirma o algoritmo "auto-aplica
em sequência" ponta a ponta no browser real, não só nos testes automatizados. Nenhum empréstimo
real tocado (só o de teste dedicado).

**Sessão 2026-08-13 — achado real: sobra parcial não pode sumir do rastro, resolvido:**

Gustavo, olhando o histórico de um segundo teste de pagamento (R$150 numa parcela de R$100),
notou que só R$100 aparecia registrado — "ela lançou 150 pq aqui só mostrou 100??? ela poderia
pagar uma parte da outra parcela com esses 50 poderia não? [...] que nem o cartão de crédito, posso
pagar adiantado antes de fechar a fatura". Conferido no código: bug real, não só UX — a `Transacao`
saía da conta com o valor total digitado, mas o algoritmo só criava solicitação pra parcela que
fechava por completo; a sobra não virava nada, nem crédito nem solicitação, só sumia (a doc da
sessão anterior até dizia errado que "fica pro próximo pagamento"). Dinheiro real desalinhado do
registro do empréstimo — decisão do Gustavo: corrigir agora, antes de seguir pro unificar/
consolidar ("isso é core do pagamento que subimos hoje, dinheiro sumindo do rastro é sério").

**Implementado:** `EmprestimoParcela.ValorPago` novo (migration `AddValorPagoParcelaEmprestimo`) —
parcela aceita adiantamento parcial (mesma lógica de fatura de cartão paga antes de fechar), só vira
`Paga` quando o acumulado cobre o valor devido por completo. Algoritmo de solicitar/aprovar
pagamento reescrito pra aplicar 100% do valor sempre (nunca descarta sobra); trava de "parcela já
ocupada" ajustada pra só bloquear solicitação `Pendente` (uma `Aprovada` — adiantamento anterior —
não impede um segundo pagamento na mesma parcela); pagar mais que o total pendente agora lança erro
explícito em vez de sumir com o excedente; card "Vencido" corrigido pra não contar de novo o que já
tinha entrado como parcial. Frontend: badge nova mostrando "R$X de R$Y pago" na parcela parcial.
Back 388/388 (+5), front 334/334 (+1), tsc+lint limpos.

**Verificado ao vivo** — R$30 aplicado na parcela 2/2 de "TESTE aprovar parcela inline" (devia
R$50): badge mostrou "R$30,00 de R$50,00 pago", parcela continuou Pendente (não fechou, não sumiu).

**Incidente de segurança de teste, detectado e revertido na hora:** um erro de contagem de posição
ao clicar botão numa lista repetida (`read_page` inclui linhas fora da tela, contagem visual por
screenshot errou por 1) fez um clique cair no empréstimo REAL "Aluguel atrasado" em vez do de teste
— criou R$30 de `Transacao` real + solicitação `Aprovada`. Pego antes de prosseguir (conferência do
request de rede), revertido na hora via Postgres (`DELETE` solicitação + log de evento + transação,
`ValorPago` da parcela e do empréstimo resetados pra 0) — confirmado voltou a R$0,00, ficou intacto
o resto da sessão. Lição gravada em memória (`feedback_nao_testar_em_dado_real`): em lista com botão
repetido por linha, confirmar o registro certo antes de agir (nome visível, `scroll_to`, ou request
de rede), nunca contar posição de cabeça a partir de screenshot.

**Mais um achado na mesma sessão, resolvido:** Gustavo notou a badge nova de adiantamento parcial
("R$X de R$Y pago") não atualizando após registrar um pagamento novo (mesmo card já refletindo o
valor certo). Mesmo bug de cache já corrigido em 2026-08-12 pra aprovar/rejeitar/reenviar
(`refreshParcelasEHistoricoInline`) — faltava cobrir o quarto handler, `handleSolicitar`, que só
chamava `loadData()`. Corrigido nos dois branches. Front 335/335 (+1). Verificado ao vivo: badge
atualizou na hora, sem reload manual.

**Mais um achado, via elemento selecionado:** empréstimo `Quitado` mostrando "Aguardando sua
aprovação" — Gustavo suspeitou de soft-delete vazando na lista. Não era isso (`VisivelPara` já
filtra `Ativo` certo). Bug real: `QuitarAsync` nunca resolvia solicitação `Pendente` esquecida antes
do quitar na marra, ficava presa pra sempre. Corrigido nos dois lados: backend rejeita
automaticamente ao quitar (motivo explícito, notifica), frontend esconde a badge pra quitado (defesa
em profundidade). Back 389/389 (+1), front 336/336 (+1). Verificado ao vivo.

**Mais 2 achados de limpeza de teste, resolvidos manualmente:** dois empréstimos de teste já
quitados ("Teste vincular existente", "Teste pagamento aprovacao") pareciam soft-deletados mas
`Ativo=true` no banco — Gustavo tinha tentado apagar e o botão bloqueou (regra de 2026-08-11: quitado
sempre tem atividade real, apagar fica travado de propósito), sem ele perceber o erro. Como eram
puro dado de teste, marcados `Ativo=false` direto no Postgres — sumiram da lista (10→9→8
registrados), nenhum empréstimo real tocado.

**Achado maior na sequência, só especificado (não codado):** Gustavo perguntou por que não dá pra
apagar um quitado. Confirmado: é a trava de 2026-08-11 funcionando como decidido (protege histórico
que a Ana também vê). Opção de relaxar a trava rejeitada pelo próprio Gustavo (mesmo risco de sempre).
**Escolhido: arquivar/ocultar em vez de apagar** — esconde da lista principal sem apagar nada, os
dois lados continuam vendo num canto tipo "Ver arquivados". Design esboçado (per-usuário —
`ArquivadoPorCriador`/`ArquivadoPorContraparte`, só permitido pra `Quitado`, endpoints
arquivar/desarquivar, toggle "Mostrar arquivados" no front) — catalogado em detalhe no ROADMAP.
**Zero código escrito ainda** — sessão parada aqui a pedido do Gustavo ("e vamo dormir").

**Sessão 2026-08-14 — "arquivar/ocultar quitado" implementado por completo:** backend
(`ArquivadoPorCriador`/`ArquivadoPorContraparte` per-usuário, migration `AddArquivarEmprestimo`,
`ArquivarAsync`/`DesarquivarAsync`, `ListarAsync` com `incluirArquivados`) + frontend (botão
Arquivar/Desarquivar nos itens quitados, checkbox "Mostrar arquivados"). Back 393/393 (+4), front
340/340 (+4), tsc+lint limpos. Verificado ao vivo com empréstimo de teste, ciclo completo (arquivar
→ some → toggle revela → desarquivar → volta ao normal). Nenhum empréstimo real tocado. Detalhe:
`docs/features/emprestimo-compartilhado/pagamento-aprovacao.md` → seção "Arquivar/ocultar
empréstimo quitado".

**Módulo Empréstimos: única peça mapeada ainda faltando é "unificar/consolidar".**

**Pendências reais, na ordem:**
1. Especificar "unificar/consolidar" em detalhe (nova seção na spec, decisões de modelagem) —
   **antes** de codar. Única peça que falta pro módulo Empréstimos fechar por completo.
2. Implementar unificar/consolidar.
3. Só depois de tudo isso: decidir se abre PR, ou escolhe outra frente do ROADMAP.
4. Servidores locais (backend 5293, frontend 5173, Postgres) — checar se ainda estão no ar na
   próxima sessão (reboots já aconteceram entre sessões recentes; Docker Desktop pode não subir
   sozinho, precisa `Start-Process` manual às vezes).

**Sessão 2026-08-14 — "arquivar/ocultar quitado" implementado, testado e polido:**

Servidores caídos no início (reboot entre sessões) — Postgres subiu sozinho, backend e frontend
resubidos manualmente sem incidente.

Implementado exatamente como especificado na sessão anterior: `Emprestimo` ganhou
`ArquivadoPorCriador`/`ArquivadoPorContraparte` (bool, migration `AddArquivarEmprestimo`,
per-usuário — arquivar não afeta a visão da contraparte), só permitido pra `Quitado`
(`ArgumentException` senão). `ListarAsync` ganhou `incluirArquivados` (default false).
Endpoints `PATCH /emprestimos/{id}/arquivar` e `/desarquivar`, idempotentes. Frontend: botão
`Arquivar`/`Desarquivar` nos itens quitados + checkbox "Mostrar arquivados" no cabeçalho. Back
393/393 (+4), front 340/340 (+4), tsc+lint limpos. Verificado ao vivo com "TESTE emprestimo grande
10x" (virou quitado nesse meio tempo) — ciclo completo arquivar→some→toggle revela→desarquivar→volta.

**Round 1 de feedback visual:** Gustavo, olhando o checkbox: "não gostei de como ficou esse botão
feio aí em cima, faz um filtro aí bonitinho". Trocado `PontesCheckbox` pelo padrão de filtro chip
já usado em `TransactionsPage` (`PontesButton size="sm" variant={ativo?"primary":"outline"}` com
ícone) — reaproveitou convenção existente em vez de inventar um padrão novo. Verificado ao vivo
(outline quando inativo, azul preenchido quando ativo).

**Round 2, escopo maior:** "eu não tô gostando da visualização dessa parte de seus empréstimos
mesmo" — perguntado o que especificamente, resposta: "layout geral/densidade". Ajustes na lista
inteira (não só o filtro): padding do item 16px→20px/24px, badge de forma de pagamento ("Parcelado
Nx"/"À vista") saiu do amontoado de badges de status pra virar texto simples na linha de
contraparte/vencimento (reduz de até 5 badges pra até 4, e tira a mais "decorativa" delas do
cluster), gap dos ícones de ação 2px→6px (mesma lição já aplicada nos botões da parcela em
2026-08-12 — cramped demais gera mis-click, como aconteceu literalmente nesta mesma sessão ao
clicar errado numa lista de botões repetidos), divisor sutil antes do "Remover" (separa ação
destrutiva do resto). Front 340/340, tsc+lint limpos. Verificado ao vivo — Gustavo ainda não deu
feedback final sobre esse segundo round quando a sessão foi interrompida pra compactar.

Tudo commitado e pushado: `740d8ae` (feature), `d7b09ec` (chip), `9a57198` (densidade). Working
tree limpo. Detalhe técnico completo: `docs/features/emprestimo-compartilhado/pagamento-aprovacao.md`
→ seção "Arquivar/ocultar empréstimo quitado".

**Achados que ainda restam no intake do ROADMAP** (não atacados nesta sessão):
- 🟡 P2 — Empréstimo ↔ Conta/Transacao real — **resolvido** para os dois fluxos existentes (criação
  e pagamento com aprovação já vinculam transação real dos dois lados). A "QUESTÃO CRÍTICA" de
  `familia/visao.md` §16.5 (despesa compartilhada × saldo real) continua em aberto — decisão de
  modelagem diferente, não coberta por isso.
- ⚪ P3 — gesto "toque duplo na traseira" (ressalva técnica: recurso nativo iOS, não dá pra PWA).
- 🟡 P1 catalogado em sessão anterior (fora do fluxo do empréstimo) — spec
  `docs/features/conferencia-caixa/spec.md` escrita, **não implementada ainda**: saldo declarado ×
  calculado, dois modos (achar lançamento faltante × aceitar ajuste automático).

> ⚠️ **Lição reforçada de novo:** contexto ficou grande outra vez nesta sessão. Antes de compactar
> de novo, sempre atualizar este arquivo — é o que evita perder o fio. **Lição nova desta sessão:**
> nunca executar ação que muda estado (registrar pagamento, aprovar, quitar) em cima de registro
> financeiro REAL do usuário pra testar código — sempre criar um registro dedicado só pra isso.

**Sessão 2026-08-14 (2ª do dia) — "unificar/consolidar" implementado, módulo Empréstimos fecha
por completo:**

Pedido direto do Gustavo: "Faz a parte de unificar consolidar e tudo tem que ter um log registro
auditavel em [mensagem cortada, mas a intenção — auditoria completa — ficou clara pelo resto do
pedido]".

**Implementado exatamente como a spec previa** (decisão já fechada em 2026-08-06: devedor precisa
aceitar antes de valer): nova entidade `EmprestimoConsolidacaoProposta` + join
`EmprestimoConsolidacaoItem` (migration `AddConsolidacaoEmprestimo`), `Emprestimo` ganhou
`ConsolidadoNoEmprestimoId`. Credor propõe (`POST /emprestimos/consolidar`) juntar 2+ empréstimos
ativos (vinculados, não quitados) da **mesma contraparte** — bloqueia contraparte diferente,
bloqueia se já existe consolidação pendente envolvendo um dos empréstimos. Devedor aceita
(`POST .../consolidacoes/{id}/aceitar`) ou recusa (motivo opcional). No aceite: **revalida os
originais do zero** (protege contra estado mudado desde a proposta — ex. um deles foi quitado por
fora nesse meio tempo, lança erro explícito pedindo nova proposta em vez de consolidar sujo);
soma o restante **real**, não o snapshot da proposta; cria o `Emprestimo` novo (já `Vinculado`,
pula convite — os dois já são vinculados entre si); gera parcelas se `Parcelado`; cada original
vira `Quitado` + `ConsolidadoNoEmprestimoId` + **auto-arquivado dos dois lados** (decisão de
design: registro superado não deve poluir a lista principal de ninguém).

**Auditoria — ponto central do pedido do Gustavo:** 4 `FinancialEventType` novos
(`EmprestimoConsolidacaoProposta/Aceita/Recusada/Cancelada`). No aceite, todos os eventos da
operação (proposta + `EmprestimoCriado` do novo + `EmprestimoQuitado` de cada original)
compartilham o **mesmo `correlationId`** — reconstrói a cadeia inteira numa query só. Verificado
direto no Postgres depois do teste ao vivo: 4 linhas sob o mesmo `CorrelationId` pra uma
consolidação real de 2 empréstimos.

Back 415/415 (+22 testes, arquivo novo `EmprestimoConsolidacaoServiceTests.cs`), front 345/345
(+5 testes em `EmprestimosPage.test.tsx`), tsc+lint limpos.

**Verificado ao vivo no browser, com cuidado extra dado o incidente de segurança de teste da
sessão anterior:** criados 2 empréstimos de teste dedicados ("TESTE consolidar A" R$50, "TESTE
consolidar B" R$70) vinculados à Ana Paula (seed real). Ao abrir o modal "Propor consolidação", o
grupo-candidato junta **todos** os empréstimos ativos com aquela contraparte por padrão — nesse
caso os 6 reais + "TESTE aprovar parcela inline" + os 2 novos, 9 no total, todos pré-marcados.
**Desmarcados manualmente e conferidos por texto visível (nome do empréstimo, não posição) os 7
que não eram de teste antes de confirmar** — proposta final ficou só com os 2 de teste (R$120,00
batendo 50+70). Aceito como Ana: novo empréstimo "Consolidação com Ana Paula..." R$120,00 criado;
os 2 originais viraram Quitado + "Consolidado num plano novo" + sumiram da lista principal (só em
Arquivados); os 6 reais e o "TESTE aprovar parcela inline" ficaram com os valores idênticos ao
estado anterior — conferido linha por linha no `get_page_text` antes e depois.

**Achado de processo — bug real de infraestrutura de verificação, resolvido no caminho:**
`npm run build` (`tsc -b`) falhava com 9 erros de tipo — nenhum deles introduzido nesta sessão
(confirmado via `git diff --stat`, mudança só de adição em `types/Emprestimo.ts`). Causa: 2
campos que o código já usava havia tempo (`parcelaId` em `EmprestimoPagamentoSolicitacao`,
`transacaoExistenteId` em `AprovarPagamentoEmprestimo`) nunca tinham sido declarados no tipo
TypeScript, e `ConviteEmprestimoPage.tsx` passava `variant="mark"` pro `PontesLogo`, prop que o
componente nunca teve. **Por que passou despercebido em toda sessão anterior que "rodou tsc":**
`npx tsc --noEmit` solto na raiz do projeto é um no-op silencioso — `tsconfig.json` raiz tem
`"files": []` e só delega via `references` (`tsconfig.app.json`/`tsconfig.node.json`), que só são
seguidas com `-b` (build mode); rodar sem `-b` verifica **zero arquivos** e retorna limpo sempre.
Corrigido (2 campos adicionados, 2 props inválidas removidas) — `npm run build` agora realmente
compila. **Lição gravada:** verificar tipo neste projeto sempre via `npm run build` (ou
`tsc -b --noEmit`), nunca `tsc --noEmit` isolado — ele nunca vai pegar nada de errado.

**Também durante a verificação:** um clique de autofill do painel DEV de login (`ref` clicado sem
passar `tabId` explícito) caiu na aba errada — só trocou uma paleta de cor na página pública de
brand-preview (achado inofensivo, nenhum dado tocado), detectado na hora conferindo a página antes
de prosseguir. Lição reforçada: sempre passar `tabId` explícito em toda chamada de tool de browser
quando há mais de uma aba aberta.

Detalhe técnico completo: `docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md`
→ seção "Unificar/consolidar — implementação (2026-08-14)". `ROADMAP.md` atualizado (item marcado
`[x]`).

**Módulo Empréstimos está fechado por completo** — todo item mapeado (vínculo bilateral,
pagamento com aprovação, parcelas/juros/multa, arquivar/ocultar, unificar/consolidar) implementado
e testado.

**Sessão 2026-08-14 (3ª do dia) — UI da tela de Empréstimos incomodando o Gustavo, resolvido via
bancada de teste funcional (`/emprestimos-lab`):**

Depois do "unificar/consolidar" pronto, Gustavo pediu uma demo ao vivo (2 empréstimos de teste
"TESTE consolidar A/B", propor → aceitar, igual à verificação automatizada) — funcionou igual.
Perguntado "e agora o que falta?", respondido: módulo fechado, só falta decidir PR vs próxima
frente. Ele então: "sem pr da branch ainda essa tela de emprestimos... não gostei de como ta".

**3 ajustes diretos na tela real, nenhum resolveu sozinho (mas ficaram, são melhorias reais):**
1. Card "Consolidar dívidas" — estava entre título e KPIs (quebrava o fluxo título→KPIs→lista que
   já existia antes da feature) → movido pra logo antes da lista.
2. Descrição longa (ex. "Consolidação com Ana Paula Cesar Martins Oliveira") quebrava em 2 linhas
   e desalinhava a altura das linhas da lista → trunca com ellipsis + `title=` no hover pro nome
   completo. Bug real que eu mesmo causei no meio do fix: dei `flex-grow:1` no título, ele tomou
   todo o espaço da linha e empurrou os badges pra quebrar linha — corrigido pra `flex: 0 1 auto`.
3. Removido e devolvido no mesmo turno: badge "Vinculado" (tirei achando redundante — aparece em
   100% das linhas — Gustavo mandou voltar: "o bedge de vinculado tem que ter"). Ícones de ação
   (Registrar pagamento/Quitar/Histórico/Remover) só aparecem no hover da linha agora — reduz
   ruído visual constante, mantido.

**"não resolveu" de novo → pedido de bancada de teste** ("cria uma pagina teste pra gente ai
testar novos estilos"): nova rota `/emprestimos-lab` (sem link no menu, só URL direta), 3
composições lado a lado com o empréstimo ativo real — **A · Extrato** (1 linha, sem card, borda
colorida em vez de badge), **B · Tabela** (planilha densa, coluna de ações fixa), **C · Agrupado
por pessoa** (subtotal por contraparte). Gustavo: "o agrupado traz pouca informação... cadê
vinculado, cadê os botões de ação?" — corrigido: as 3 variantes ganharam o mesmo cluster de
badges de status e os mesmos ícones de ação da tela real. Depois: "clico nos botões não acontece
nada, quero telas funcionais" — **os ícones foram religados nos MESMOS serviços da tela
principal** (`solicitarPagamentoEmprestimo`, `quitarEmprestimo`, `deleteEmprestimo`,
`listSolicitacoesPagamento`, `listParcelasEmprestimo`), com os mesmos modais/confirmações
(`PontesDialog` pra quitar/remover, `PontesModal` com o gate existente/novo pra registrar
pagamento). **Verificado ao vivo:** "Ver histórico" abriu modal real com dado real ("Nenhum
pagamento solicitado ainda" pra Fiança Loft, correto), "Ver parcelas" buscou parcelas reais da
API (parcela 1/2 Paga, 2/2 Pendente da "TESTE aprovar parcela inline"). Ainda sem reação final do
Gustavo sobre qual das 3 composições prefere.

**Também nesta sessão:** renomeada a conta seed real da Ana pra **"Bobe"** a pedido do Gustavo
("Tudo que tiver o nome da Ana eu preciso trocar pra bobe") — `Usuarios.Nome`/`Email` no Postgres
(`bobe.seed@local.test`) + label do painel DEV de login (`.env` do frontend, gitignored, Vite
reiniciado pra recarregar). Confirmado zero linha com "ana" restando em `Usuarios` (nome ou
e-mail). Campos de texto livre já existentes (Descricao/Pessoa de empréstimos antigos) ficaram
como estavam — Gustavo não confirmou se quer trocar esses também.

Front 345/345 (sem teste novo pro `/emprestimos-lab` — é bancada de teste explícita, não feature
shippada, mesmo espírito de exceção de "copy/CSS" do §7), `npm run build` limpo, lint limpo.
Commitado e pushado: `135f301` (em cima de `bc74a78` do unificar/consolidar).

## Próxima ação concreta

1. **Decidir hospedagem** (do Gustavo, sem pressa, nada escolhido). Discussão/pesquisa em
   `docs/features/hospedagem-beta/decisao.md` — trava nas restrições dele (orçamento, cartão
   internacional, servidor no BR, nº de testadores, apetite de manutenção). O código está pronto e
   neutro pra qualquer host de container. Só depois de escolher: gerar secrets de prod
   (`JWT_SECRET`/`PASSWORD_PEPPER`/`MFA_ENCRYPTION_KEY` novos) → deploy → smoke test.
2. **Push** — tem bastante commit local sem push (hardening + MFA + limpeza de docs). Quando o
   Gustavo mandar, `git push` na branch `feature/emprestimo-compartilhado`.
3. Quando/se voltar pro módulo Empréstimos (pausado, não abandonado): retomar a bancada
   `/emprestimos-lab-a/b/c/d` de onde parou — ver seção "Módulo Empréstimos — UI (pausado em
   2026-08-18)" logo abaixo pro contexto completo.
4. **Gate `1.0.0` público** (mais adiante, não bloqueia o beta): endpoint de autoatendimento LGPD
   (exportar/apagar dado), política pra pedido de exclusão de terceiro sem conta em empréstimo,
   reavaliar porte se a base de usuários crescer, criptografia de campo em repouso, upgrade .NET 10
   (prazo nov/2026) — tudo catalogado em `ROADMAP.md`.

## Módulo Empréstimos — UI (pausado em 2026-08-18)

1. **Bancada com 4 direções no ar**, Gustavo ainda iterando ativamente (não travado como na
   sessão anterior — desta vez com referência concreta, progresso real a cada rodada):
   `/emprestimos-lab-a` (extrato, StatCard grid), `/emprestimos-lab-b` (painel admin, StatCard
   compacto + busca + paginação real), `/emprestimos-lab-c` (agrupado por pessoa, hero gradiente
   da TransactionsPage), `/emprestimos-lab-d` (junção B+C: tabela densa agrupada por pessoa —
   a mais recente, também a mais refinada em detalhe até agora). Nav ◀▶ entre as 4
   (`EmprestimosLabNav`, ordem a→b→c→d→a).
2. Continuar refinando o que o Gustavo apontar (padrão da sessão: ele reage a screenshot/elemento
   selecionado, pede ajuste específico — funcionou bem, manter esse ritmo em vez de gerar
   variantes novas do zero).
3. Depois de escolher: portar a composição vencedora pra `EmprestimosPage.tsx` de verdade — com
   teste automatizado dessa vez, já que vira feature real. Lógica já extraída em
   `useEmprestimosLogic.ts`/`EmprestimosLabModals.tsx`/`EmprestimosLabItemParts.tsx`, reaproveitável.
4. Decidir: apagar as páginas de bancada depois de usadas, ou deixar pra próximas rodadas.
5. Só depois: abrir PR da branch `feature/emprestimo-compartilhado` (nunca aberto, muitos commits
   acumulados desde 2026-07-20) — módulo Empréstimos já está fechado no backend, só falta a UI
   assentar.

**Achado catalogado, não é bug:** free-text `Pessoa`/`Descricao` de empréstimos antigos podem
divergir do nome oficial do usuário vinculado se ele for renomeado depois (aconteceu com Ana→Bobe,
corrigido manualmente via SQL duas vezes já). Não há sincronização automática — o campo é
snapshot no momento da criação. Não catalogado como P-alguma coisa porque é comportamento
esperado (mesmo texto livre existe pra permitir descrever alguém sem conta), só registrado aqui
como lição pra próxima vez que um nome de seed mudar.

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

---
owner: Gustavo
last_reviewed: 2026-10-14
status: EM_PROGRESSO
foco: 'Preparação de CÓDIGO/segurança pra um beta fechado — HOSPEDAGEM DECIDIDA (caminho A/Hostinger, 2026-08-24), mas execução ADIADA por orçamento (contrata quando receber) e NENHUM DEPLOY ACONTECEU. Detalhe em `docs/features/hospedagem-beta/decisao.md`. O código é neutro (Dockerfiles, nginx.conf, health checks, ForwardedHeaders, CORS/baseURL por env var) e serve pra qualquer host de container. Trabalho de segurança já fechado localmente: (1) conformidade LGPD/BACEN pesquisada (`docs/CONFORMIDADE_BR.md` — BACEN fora do escopo, DPO dispensado); (2) sweep de segurança (Hangfire fechado, rotas demo DEV-only, força bruta por conta, cookie Secure atrás de proxy TLS); (3) hardening de auth em 2026-08-23: **MFA opt-in (TOTP + backup codes)**, **pepper de senha**, **remoção da regra de composição** (NIST), **JWT local rotacionado**; (4) pentest ao vivo (2 achados corrigidos: cookie Secure, duplicidade de e-mail case-insensitive); (5) `/privacidade` + `/termos-de-uso` (rascunho) + consentimento no cadastro. Criptografia de campo em repouso: catalogada P2 (análise pronta no ROADMAP), decisão do Gustavo de não fazer agora. TUDO MERGEADO na `main` (`b482c93`): base beta (#236-#241) + multi-conta P0 (#246) + empty-states (#247) + 5 services testados (#248) + **trusted-device MFA (#249)** + **login-experience: manter-conectado + roster (#252)** + **UX toolbars + primitivos DS PontesSegmented/Stack/Inline (#251)**. Auth agora tem: troca real de conta, sessões/dispositivos, reuse-detection, revogação INSTANTÂNEA (access 15min + claim `sid` + OnTokenValidated), trusted-device opt-in, manter-conectado + roster. Pré-condição de PROD (gate 1.0.0, não-código): rotacionar `Jwt:Key`. Histórico no corpo abaixo.'
---

# STATE — onde parei

**Estado vivo da sessão.** Só duas coisas: o que está em execução agora e a próxima ação concreta. Backlog completo em [`ROADMAP.md`](ROADMAP.md).

> Atualizar ao fim de toda sessão que mexeu em código/docs. Substitui o antigo `IMPLEMENTATION_STATE.md` (Q2-Q5 em `docs/history/`).

---

## Em execução

### 📌 Sessão 2026-10-14 — front com cara de produto · branch `feat/ds-premium` (a partir da `main`)

**Pivô do Gustavo:** "o front parece amador e me trava". Primeiro tentamos um front novo separado (`controle-financeiro.v2/`, branch `feat/front-v2`: login completo, layout com trilho, dashboard com gráfico próprio, claro/escuro) — ficou como **bancada/referência**, roda do worktree irmão `E:\VSCode\controle-financeiro-v2` (`launch` "v2", :5174). Decisão: **evoluir o v1 no lugar, mantendo a paleta** (cor fica; só escala/ar/ruído mudam). Plano e status na 🎯 Fila do `ROADMAP.md`, item 0.

**Entrou na branch:** login redesenhado (`0f00f11`, `2bbcb07`, `c8b1788` grade + Fraunces na chamada), Manrope padrão + escala +1px (`9eb988a`), controles do DS nos tamanhos do v2 (`c833318`, `25b7ef5`), **casca plana** (`1acb514`), **dashboard** (`698792f`), launch do v2 pelo worktree (`13d18ad`). Suíte do front 934/934, lint e build ok. PR #299 (editar sem hora) segue aberto esperando "ci verde". `feat/cartoes-lab` (9 commits, labs A–E, sem PR) fica como referência pra Cartões.

**Cuidado no dev:** o navegador embutido do app **não compartilha cookie entre :5173 e :5174**, e login num front revoga o do outro — usar **um front por vez** e marcar "Manter-me conectado" (sem isso o cookie é de sessão). Paleta/fonte moram no `localStorage` (`pontes.paletteId`, `pontes.fontId`) — "sumiu a cor" = paleta trocada no navegador, não código.

**Rumo do front (decisão do Gustavo, 2026-10-14):** o **v2 é o front definitivo** (`feat/front-v2`, worktree `E:\VSCode\controle-financeiro-v2`, :5174). Telas novas só lá, no visual neutro; **nada de portar visual pro v1** (só correção); paletas do v1 entram no v2 **depois** de todas as telas (memória `feedback_v2_primeiro_depois_porta`). Pendente: beta de 07/11 no v1 ou no v2. Transações já está no v2 (agrupada por dia, filtros no servidor). PRs abertos: **#299** (editar sem hora) e **#300** (ordem intradia: hora conhecida primeiro, empate por `CriadoEm`) — mergear quando o Gustavo disser "ci verde". Cuidado: a API no ar foi subida da branch do #300; o `.exe` em execução trava o build dos testes do back (parar com preview_stop antes de `dotnet test`).

**Base global do v2** (`d574c41`): tokens no `:root`, tema no `<html>`, barra de rolagem global por tema, reduced-motion, `.gitignore` do v2. **Componentes `Botao`, `Campo`, `Entrada`** (`93bc224`): todas as telas do v2 usam; regras em `controle-financeiro.v2/CONVENCOES.md`. **Nova transação no v2** pronta (`/transacoes/nova`) + peças novas no DS (`SeletorData`, `Segmentos`, `Interruptor`, `EntradaValor`, `Etiqueta`, `Formulario`). Achados: filtro de período sem o último dia e filtro de valor aceitando negativo (corrigidos no v2); criar transação/transferência sem Idempotency-Key no back (P2 no ROADMAP); v2 sem testes (P2). Depois: busca à esquerda em Transações. O caminho "Início / seção / item" no topo (e a logo alinhada nele) foi testado e removido — "não ficou bom". Logo do menu agora centrada na linha do título (y=32). Formulário da transação (nova e editar) redesenhado em duas colunas com prévia (`PreviaLancamento`, `Formulario layout="lateral"`); telas de ver/nova/editar sem `max-width`. Criar e editar agora são o mesmo `FormularioTransacao`. **Edição completa no servidor — FEITO (2026-10-15):** PR #301 (`feat/edicao-completa-transacao`, `c0ad1fc`): `LancamentoService` + `PUT /transacoes/{id}` com tudo (no lugar: conta/cartão/status; transferência/conta fixa/parcelado trocam o registro numa transação só), Idempotency-Key em editar e criar; 18 testes novos, suíte 1447 verde; conferido ao vivo no v2 (troca de conta no mesmo id; conversão em transferência; registro de teste apagado). v2 manda o PUT completo (`edec5d9`) e volta pra lista quando vira outro registro. **A API no ar roda da branch do #301** — pra reiniciar, o checkout da API tem que estar nela (o repo principal volta pra `feat/ds-premium` só pra docs). Achado P2 no ROADMAP: sessão do navegador embutido derrubada (cookies sumiram, 403 CSRF) — investigar. Docs agora em worktree próprio (`E:\VSCode\controle-financeiro-docs`, branch `feat/ds-premium`): o checkout principal fica na branch do PR aberto, sem troca (a troca fazia o badge do PR sumir no app).

**Cartões no v2 (2026-10-15):** passo 1 pronto — lista (`/cartoes`) e página do cartão (`/cartoes/:id`: meses, fatura, lançamentos por dia, limite, número de parcelamentos → página `/cartoes/:id/parcelamentos` paginada, ações no pé). Desenho novo (não é o lab E nem o v1), aprovado com a ressalva "parcelamentos não vão no canto". API ganhou filtro por cartão em parcelamentos/stats (commit na branch do #301).

**Incidente 2026-10-15 — cartão excluído com fatura aberta:** back não checava dívida no DELETE (soft-delete cego). Dados do Nubank restaurados no banco de dev (totais conferidos). Fix em **PR #302** (worktree `../controle-financeiro-fix`, branch `fix/excluir-cartao-com-fatura` de `origin/main`): 409 quando alguma fatura tem restante > 0; 2 testes; suíte verde. PRs abertos: #299, #300, #301, #302.

**Topo do v2 (2026-10-15):** tema foi pra Configurações (tela nova, só Aparência por enquanto; conta/segurança apontam pro app atual) e o lugar dele no topo virou o sino → página Notificações (lista, marcar lida/todas, abre o assunto).

**Cartões passo 2 (2026-10-15):** novo/editar cartão em página prontos e testados ao vivo. Menu da conta no pé do menu lateral (Configurações + Sair), em todo estado.

**Fatura com busca/filtro/paginação no servidor (2026-10-15):** endpoint novo na branch do #301 (API rodando dela, já com a `main`/#302 dentro); tela do cartão usa. Testado ao vivo.

**Cartões passo 3 (2026-10-15):** pagar fatura em página pronto e testado de ponta a ponta (pagar + estornar com R$ 0,01 em cartão de teste, apagado depois). Módulo Cartões no v2: lista, cartão, parcelamentos, novo/editar, pagar — falta só ações de parcelamento (cancelar/antecipar).

**Ações de parcelamento (2026-10-15):** página do parcelamento + antecipar/cancelar parcela + cancelar parcelamento, testados de ponta a ponta. Módulo Cartões no v2 completo.

**Contas fixas no v2 (2026-10-15):** lista, página, novo/editar (mesmo formulário da transação), só a próxima, pausar/retomar/cancelar/excluir — testado de ponta a ponta. API: `GET /recorrentes/{id}` na branch do #301.

**DECISÃO 2026-10-15: o beta sai no v2; o v2 vira o front principal e o v1 vai pra documentação.** Plano em blocos (A entrar e começar · B dia a dia · C família/empréstimos · D completar + exclusão de conta LGPD · E termos/privacidade · F admin · G virar principal) no ROADMAP, item 0 da Fila. Toda tela nova do v2 sai com teste. Checagem de prazo na sexta 24/10.

**Dados de demonstração (2026-10-15):** `DemoSeeder` (PR #303) enche a conta de exemplo Gabriel Dev + Marina (família) via services — contas fixas em todos os estados, 2º cartão + só débito, parcelamentos, notificações. Liga com `SEED_DEMO=true` no `.env` local (já ligado). Ver: sair → painel DEV do login → Gabriel Dev. **Toda tela nova do v2 ganha um bloco nele.** Sino do v2 agora abre painel com as últimas + "Ver todas".

**Testes no v2 + v2 na main (2026-10-15):** vitest no v2 (16 testes); #303 (DemoSeeder) mergeado; **#304** (pasta do v2 + job de CI) e **#305** (excluir conta não apaga histórico: recusa + FK Restrict) abertos, CI rodando. Worktrees temporários: `../controle-financeiro-int` (branch do #304) e `../controle-financeiro-fix` (branch do #305) — apagar depois do merge. Depois do #304: o v2 passa a ser desenvolvido a partir da `main` (checkout principal), o worktree `../controle-financeiro-v2` (`feat/front-v2`, com o lab de cartões do v1) aposenta.

**Bancos/contas + encerrar conta (2026-10-15):** #304 (v2 na main) e #305 (excluir conta não apaga histórico) mergeados; o v2 agora vive na `main` do checkout principal (`controle-financeiro.v2/`), o worktree antigo do v2 foi aposentado (`feat/front-v2` fica no remoto com o lab de cartões do v1). **PR #306** (`feat/v2-bancos-contas`): encerrar/reabrir conta no back (transferência ou ajuste do saldo, Idempotency-Key, encerrada sem dinheiro novo, migration `AddEncerradaEmConta`) + telas de Bancos no v2 + bloco no DemoSeeder. 1474 testes back, 24 no v2.

**Bancos refeita (2026-10-15):** #306 mergeado. Gustavo achou a página da conta redundante (repetia a linha + extrato que não é dessa tela): **PR #307** — a lista é a tela, clicar abre a ficha (banco, tipo, agência, número — vazios como "—" — e os **cartões ligados à conta**, cada um link pra página do cartão) e as ações ali embaixo (modelo Pierre); sem extrato nem "ver lançamentos" (assunto de Transações); Nova/Editar/Encerrar voltam com a conta aberta (`state.abrir`); abertas em grupos com total (em conta / poupança / carteira por último); "Nova conta" é Botao padrão. Labs A (cartões) e B (lista agrupada) foram feitos e descartados — Gustavo preferiu a lista atual com os grupos. **Tipos de conta:** achado + conserto — o cadastro criava a carteira como poupança (migration `CarteiraTipoDinheiro`); `IsCarteira` não vem mais do tipo (dá pra ter cofrinho); tipo **Investimento** (6) novo; formulário e grupos (em conta / poupança / investimentos / dinheiro) no v2. Depois: `EntradaValor compacto` (saldo inicial / limite em caixa comum) e **editar saldo inicial** no v2 (DTO traz o ponto de partida; zero cancela o lançamento). 1484 testes back, 33 no v2.

**Cadastro no v2 (2026-10-15):** #307 mergeado. Branch `feat/v2-cadastro` (PR aberto): tela `/cadastro` com as regras do servidor (senha NIST 15+, aceite LGPD nunca pré-marcado), confirmação "aguardando aprovação" sem logar, 5 testes (38 no v2). `Entrar.module.css` virou `Auth.module.css`.

**Login inteiro (2026-10-15):** #308 mergeado. Branch `feat/email-smtp-login` (PR aberto): **achado** — envio de e-mail era stub de log (reset/OTP/aviso de exclusão não chegavam); agora `SmtpEmailSender` (MailKit) + Mailpit no compose (`docker compose up -d mailpit`, http://localhost:8025; `.env` local já aponta); `/redefinir-senha` no v2; Termos/Privacidade no v2. Ponta a ponta local provado. Depois: layout novo dos e-mails (logo embutido por CID, conta citada, prévia, rodapé anti-golpe); `.env` local do Gustavo manda por **Gmail** (senha de app, gitignored) — trocar de volta pro Mailpit quando ele quiser; **MFA nas Configurações do v2** (ativar/recuperação/desativar), provado na conta dele (ativar → login pede código → errado barrado → recuperação → confiar no dispositivo → desativar; MFA ficou desligado). Depois: Configurações em seções empilhadas (Gustavo não quis lado a lado); **convite "Proteja sua conta" pós-login** (MFA desligado → `/proteja-sua-conta`: Ativar agora / Agora não = 30 dias / Não perguntar mais; resposta no servidor, migration `AddMfaConviteUsuario`). Depois: **Configurações separadas por assunto** (NavSecoes, `?s=`: Segurança e login · Perfil · Aparência · Dados e privacidade) com **Trocar senha**, **Sessões ativas** e **Dispositivos confiáveis** (endpoints novos `/auth/trusted-devices`); trocar senha encerra as outras sessões (opção marcada). Login do v2 completo. Perfil (editar) e Dados (baixar/excluir) ainda no app atual — bloco D. Depois: pesquisa de política de senha (NIST rev4 + OWASP, na fonte) → **senha vazada via Pwned Passwords + lista local 15+ + NFC** (P1 fechado); copy sem travessão no v2/e-mails/legais. Onboarding adiado pro fim (G). 63 testes v2, 1520 back. **#309 mergeado (squash) com CI todo verde, inclusive E2E.** Conta do Gustavo ganhou 6 contas fixas de exemplo (aluguel, condomínio, luz, água, internet, celular — Nubank, mensais) pra ele ver a tela.

**Formulário próprio da conta fixa (2026-10-15):** Gustavo revisou o formulário de Contas fixas (era o da transação com interruptor) e aprovou separar. **PR #310** (`feat/v2-form-conta-fixa`, **mergeado (squash `66f7e18`) com CI verde**): `FormularioContaFixa` (criar e editar a regra), com **Como paga** obrigatório (débito automático, boleto, Pix, cartão de crédito…); a transação perdeu o interruptor "Conta fixa" (um botão "Transformar em conta fixa" chegou a entrar e o Gustavo mandou tirar: conta fixa nasce só em Contas fixas). Depois, a pedido dele: **subcategoria na conta fixa** (migration `AddSubcategoriaRecorrente`, opcional, sempre da categoria, cobranças herdam; campo ao lado de Categoria; página mostra "Moradia › Aluguel"); as 5 contas fixas de exemplo de moradia ganharam subcategoria. 1548 back, 80 v2. Back: `DebitoAutomatico` (7), `Recorrente.MeioPagamento` (migration `AddMeioPagamentoRecorrente`, ocorrências herdam), `MeioPagamentoExtensions` (rótulo único + `DoCliente`). **Achado corrigido junto:** criar/editar transação e pagar fatura gravavam qualquer número como forma de pagamento (agora 400). 1538 back, 82 v2. Conferido ao vivo com registros de teste (apagados); as 6 contas fixas de exemplo do Gustavo ganharam forma de pagamento.

**Pacote vulnerável (2026-10-15):** **PR #311** (`fix/pacote-pkcs-mailkit`, aberto): `System.Security.Cryptography.Pkcs` fixado na 10.0.13 (CVE-2026-84008 alta, CVE-2026-70162 moderada; vinha 10.0.0 pelo MailKit/MimeKit). API sem pacote vulnerável; 1548 back; envio pro Mailpit conferido.

**#311 mergeado (`2bfbb10`).** **Categorias no v2 (2026-10-16):** **PR #312 mergeado**. Back consertado (achados no ROADMAP): editar categoria (PUT), tipo validado, nome repetido recusado, 404 pra de outro usuário, cor/ícone da subcategoria validados, `/uso` e **excluir em uso movendo tudo pra outra categoria** (decisão do Gustavo: opção A; subcategorias vão junto, mesma nome se junta, limite do mesmo mês soma, numa transação só). Front: `/categorias` (Despesas | Receitas, as suas e as padrão, ficha com subcategorias), nova/editar categoria e subcategoria, excluir com "pra onde vai". Componente novo `ListaFicha` (Bancos passou a usar). DemoSeeder: Pets/Freelas/Reembolsos + Jardinagem em Moradia + lançamentos e conta fixa em Pets. 1568 back, 97 v2. Conferido no Postgres com registros de teste (apagados).

**#312 mergeado (squash `5a6d7ac`, CI todo verde).** Depois do PR: formulário de categoria na largura toda, segmento ativo com contorno igual nos 4 lados (sombra caía só pra baixo; vale pra todo `Segmentos`), e as suas categorias separadas das padrão (cadeado + "Não dá pra editar nem excluir", inicial em destaque, "Suas categorias" mesmo vazio; `ListaFicha` ganhou ícone de grupo, linha entre grupos e `VazioFicha`).

**Importar extrato no v2 (2026-10-16):** branch `feat/v2-importar-extrato`. Desenho aprovado pelo Gustavo ("planilha de banco não tem documentação"): OFX como padrão; CSV vira tabela + mapeamento (lembrado por conta e cabeçalho em `ModeloImportacao`, migration `AddModeloImportacao`; sugestão pelos nomes das colunas = `Sinonimos`, ou pelo conteúdo; sem confiança a tela pergunta), linhas de saldo saem, entrada/saída separadas, "150,00 D", data dia/mês ou mês/dia. Confirmar: transação só + Idempotency-Key + FITID repetido pulado (P1 do ROADMAP fechado). Tela `/importar`: conta + arquivo → "Qual coluna é o quê" (se precisar) → prévia marcável com categoria → resumo centralizado (Gustavo achou o primeiro feio). Componente `Marcar`. Transações aceita `state.filtros`. **Achado P1 corrigido junto:** DTO record com validação na propriedade derrubava o endpoint (confirmar; e convite da família, acerto e vincular empréstimo pela trava nova `DtoRecordValidacaoTests`). Arquivos de exemplo em `docs/features/importacao/exemplos/`. 1586 back, 105 v2, 938 v1. Conferido ao vivo numa conta de teste (apagada no banco local depois).

**Importar extrato, revisão tela a tela (2026-10-17, commit `71c40f5` no PR #313, CI verde no anterior):** o Gustavo está vendo cada estado da tela ("abre um por vez e eu falo próximo"). Vistas: 1 conta+arquivo, 2 lendo, 3 OFX reconhecido, 4 arquivo vazio, **5 "Não reconhecemos as colunas"** e 6 Inverter. A tela 5 foi refeita **quatro vezes** (campos soltos → escolha no cabeçalho → cartão por coluna → grade de rádio) até ele pedir pesquisa de mercado: YNAB/Actual/Goodbudget = prévia do arquivo + um campo por informação com dropdown das colunas; Lunch Money = dropdown no cabeçalho (tem tópico de usuários confusos com "Amount vs inflow/outflow"); Organizze/Mobills não mapeiam (planilha-modelo). Ficou **do jeito do YNAB**: prévia em cima com etiqueta na coluna escolhida, campos Data/Descrição/Dinheiro que entrou/Dinheiro que saiu (opção = coluna + exemplo, `Selecao` ganhou `detalhe`), mesma coluna em entrou e saiu quando é uma só (escolher uma preenche a outra), palpite pelos exemplos, erro no campo, prévia "Vai ficar assim" sempre à vista. **Ainda sem o OK explícito dele na tela 5** (parou pra dormir). Também no commit: `Selecao` com lista `position: fixed` (a antiga cortava/rolava a tabela), resumo da importação centralizado e "Nada novo pra importar". Regra nova dele: **em iteração visual mexer só no desktop; mobile da tela depois do OK** (a tela 5 ainda não tem CSS de celular). Build ok, 105 v2. Conta "Teste importação" segue no banco local (vazia ou com o que ele importou; apagar por SQL quando o bloco fechar).

**Importar extrato fechado + Reconciliação no v2 (2026-10-18):** o Gustavo cansou da revisão estado por estado ("mal feito é melhor que não feito, bora pra próxima tela"): **#313 mergeado** (squash `6c6473d`), conta e cartão de teste apagados do banco local. Regras novas dele (memória): "próxima tela" = próxima feature, tela funcionando está pronta; falar 1-2 linhas; **não esperar CI**: PR fica com CI rodando e ele aprova os merges na ordem. **PR #314** `feat/v2-reconciliacao` (commit único): tela `/reconciliacao` em cima do back que já existia (marcos por conta): conta + saldo no app + última conferência no topo; "Conferir saldo" (dia + saldo no banco → diferença ao vivo); lista de conferências com ficha na linha (diferença recalculada agora, Ajustar, Lançar o que falta, Agora bate: confirmar, Ver lançamentos = Transações filtrada pelo período, Remover com confirmação); saldo inicial = "Ponto de partida" (edita na conta). Sem calendário nem tabela de movimentos. DemoSeeder: 3 conferências (bateu, ajustada, em aberto). 6 testes; 111 v2; API compila. Conferido ao vivo na conta Nubank dele (só leitura).

**Famílias no v2 (2026-10-18, PR #315, empilhado no #314):** branch `feat/v2-familias` (base `feat/v2-reconciliacao`; o PR troca pra `main` quando o #314 entrar). `/familias` (convites pra pessoa + famílias com ficha do mês + "Abrir família"), `/familias/:id` (balanço do mês com navegação, "a receber / a acertar / em dia"; despesas compartilhadas com aprovação e responsável na linha; acertos; membros com renda/relação na ficha e promover/rebaixar/remover de admin; convites pendentes; dependentes; regras), páginas de formulário: nova família, convidar, dependente, registrar acerto. `dominio/familia.ts`. DemoSeeder: dependentes, convite, limite, acerto na Casa Dev. 7 testes; 118 v2; API compila. **Fora:** ações de família na tela da transação (compartilhar, responsável, dependente, rateio por despesa) = próximo PR do bloco C.

**Família em 3 abas + copy sem cobrança (2026-10-18, commit `9bea247` no #315):** o Gustavo quis sub-abas e achou "a receber / a acertar" pesado; pesquisa (Splitwise, Tricount, Settle Up, Honeydue, Monarch) → Mês | Pessoas | Regras (`?aba=`), "pagou a mais / pagou a menos / equilibrado", "Pra equilibrar o mês: X → Y R$ V" com "Marcar como feito" (abre o registro preenchido), seção "Entre vocês". Memória atualizada. Conta dele no banco local é de TESTE (família "Casa Pontes (teste)" com Gabriel e Marina criada pra ele ver; pode apagar quando quiser).

**Renda de cada um e o que a família vê (2026-10-18, PR #316, empilhado no #315):** pesquisa aprofundada + spec `docs/features/familia/renda-e-visibilidade.md` (eixo dele: renda é da PESSOA, a família só reflete; `OrigemRenda` caiu a pedido dele, Cashback/Reembolso viram categoria "Dinheiro que volta"). Implementado inteiro: `RendaService` (recebido × previsto = contas fixas de receita + `RendaPrevista.VariavelEsperada` por mês, herdada), `GET/PUT /renda/mes`, `MembroFamilia.VisibilidadeRenda` + `RendaVisivelPara` (só a própria muda; `RendaMensal` manual saiu), `GET /familias/{id}/renda` calculado pra quem pede, rateio proporcional com `PesosAsync`; migration move dados antes de apagar a coluna. v2: Configurações › Minha renda (`?s=renda`), cartão "Renda do mês" na Visão geral, "Renda da casa" na família + linha de renda na ficha do membro. Back 1591, v2 122. Migration aplicada no banco local. **Falta ele ver no navegador.**

**Correções do Gustavo na renda (2026-10-18, commits `52c21ab` e `12869f2` no #316):** "Minha renda" saiu de Configurações e virou página `/renda` no menu (Configurações é só conta/app); renda fixa e variável passaram a ser DECLARADAS (`RendaPrevista.FixaEsperada` + migration `AddRendaFixaEsperada`, `PUT/DELETE /renda/mes`), sem nenhuma ligação com contas fixas (conta fixa = conta a pagar); o bloco "quem vê a sua renda" saiu da página Renda e vai pra dentro da família. Ele pediu "tenta de novo fazer uma tela de família boa" e explicou: a tela é a mais importante do projeto e por texto ele só corrige depois de pronto. **Processo novo (memória):** desenho antes de codar + construir em passos visíveis. **Workflow (ultracode) rodando:** 3 propostas de IA da página da família (casal / grupo / revisão mensal) → 3 juízes → plano por arquivo; o plano vira mockup pra ele aprovar e só então vai pro código.

**Página da família refeita + espaço de família (2026-10-18, commits `1f61a9a` e o seguinte no #316):** o workflow (3 propostas → 3 juízes → plano) virou mockup aprovado pelo Gustavo ("vai, e tira quem só vê da divisão") e código: Mês num bloco (despesas da família; "Renda da casa" só de quem liberou pra quem olha; pagou a mais / a menos / Equilibrado; "Pra equilibrar o mês: X → Y" com "Marcar como feito"; "Passou entre vocês"), **"Quem vê a sua renda" = uma caixa por pessoa na própria ficha** (nunca grava `ValorParaTodos`; quem só vê fica fora), ficha dos outros SEM linha de renda se a pessoa não liberou, **quem só vê fora da divisão e do peso** (back, com teste), notificação "recusou". `NavegadorMes` novo (Renda usa). Depois ele pediu organização maior e aprovou o **espaço de família** (modelo Notion/Slack; Monarch faz só Solo ↔ Shared view): o menu da conta (bloco da pessoa embaixo, modelo Notion; ele mandou tirar do topo; sai da barra por cima do conteúdo) tem três partes: a conta ativa com os ESPAÇOS dela (Pessoal ↔ cada família), CONTAS (outras conectadas neste navegador: trocar via `/auth/switch`, "Adicionar conta" via `/entrar?adicionar` + `/auth/add-account`, que a API já tinha e o v2 não usava) e as ações; o bloco diz o espaço atual; provado ao vivo (Gabriel Dev adicionado e troca nos dois sentidos); dentro da família o menu vira Visão geral · Despesas compartilhadas · Entre vocês · Membros · Dependentes · Regras, cada um uma página (`telas/Familia*.tsx` + `FamiliaPecas.tsx`; `estado/espaco.ts` com o mês único do espaço); "Famílias" saiu do menu (convites e Nova família moram no seletor). 127 testes v2 (Familia 8, Espaco 3), back verde no filtro. Conferido ao vivo na conta dele (família "Casa Pontes (teste)", todas as páginas). Fora, catalogado no ROADMAP: mobile das telas novas; páginas futuras do espaço (Relatórios, Metas da casa); DemoSeeder com "só vê" e despesas em todos os estados; proporcional com adulto sem previsto; decisão "Receita" como conta fixa.

**Perfil e exclusão de conta no v2 (2026-10-18, branch `feat/v2-perfil-exclusao`, PR empilhado no #316):** o Gustavo pediu o que falta na conta pessoal antes das telas de família; escolheu Perfil + exclusão. Configurações → Perfil: nome e nascimento editáveis na caixa (e-mail só leitura; salvar recarrega /auth/me). Configurações → Dados e privacidade: baixar os dados (JSON) e excluir a conta em dois passos (senha + código por e-mail/autenticador; carência de 30 dias já existia no back); depois sai de todas as contas e o login avisa como reativar. Back: achado P2 fechado (`PUT /auth/profile` valida nome 200 e data de nascimento; cadastro usa a mesma regra). 133 testes v2, 2 no back. Lista do que ainda falta na conta pessoal (ordem combinada): Relatórios, Metas, Limites (em construção), Empréstimos, tipo de conta Benefícios, nome curto de banco, mobile, onboarding.

**Foto de perfil (2026-10-18, mesmo PR #317):** ele perguntou e aprovou. Back: `FotosPerfil` (1:1, cascade, migration `AddFotoPerfil` aplicada no startup), `FotoPerfilService` com SkiaSharp 4.153.1 (MIT; nativo Windows + Linux musl do Alpine): decide o formato pelo conteúdo, teto de 8 MB e de pixels, redesenha em WebP 256x256 (some EXIF/GPS), só a própria pessoa e quem divide família ativa vê (senão 404); `PUT/DELETE /usuarios/me/foto` (rate limit 10/10 min), `GET /usuarios/{id}/foto`; versão no `/auth/me` e no membro da família; exportação LGPD leva a foto, purga apaga; Política de Privacidade cita a foto. Front: `Avatar` + `urlFoto`, Perfil com Adicionar/Trocar/Remover, foto no menu da conta e nas listas da família. Provado ao vivo: upload de 30 KB virou 3 KB WebP, SVG disfarçado de JPG → 400, Gabriel (mesma família) vê, id qualquer → 404. A conta dele ficou com uma foto de teste "GN" em degradê (trocar pela dele em Configurações → Perfil). Depois, a pedido dele ("pega o exemplo do insta"): Perfil com foto grande clicável + nome/e-mail + "Editar perfil"; clicar na foto abre a janela "Foto do perfil" (foto grande, Trocar/Remover/Cancelar); `componentes/Dialogo` novo; foto guardada em 512. 1607 back, 135 v2. Também: Perfil e Trocar senha preenchem a caixa (memória + CONVENCOES).

**E2E vermelho no #316 e #317 consertado (2026-10-19, `45a189a`):** a migration `AddRendaPrevistaEVisibilidade` criava a categoria padrão "Dinheiro que volta" também em banco VAZIO; como roda antes do `CategoriaSeeder`, o seeder achava que já tinha semeado e pulava todas, o `DevDataSeeder` caía procurando "Renda" e a API do CI não subia (/health 180s). Agora só cria em banco que já tem categorias; reproduzido e conferido com banco novo local (bancos de teste apagados). Mergeado no #317. Lição: migration com dado nunca cria registro "padrão" que um seeder usa como sinal de "já semeei".

**Metas no v2 (2026-10-19, branch `feat/v2-metas`, PR #318 empilhado no #317):** primeiro saiu o modelo de reserva (Monarch); o Gustavo viu e perguntou se o dinheiro sai da conta ("veja como o nubank faz"). Depois da pesquisa das Caixinhas do Nubank + mockup, **escolheu "Mover pra uma caixinha"** e os quatro visuais (cartões estilo caixinha, página da meta, histórico de guardar e resgatar, ícone e temas sugeridos). A reserva foi desfeita (migration `AddMetaReserva` apagada antes de subir) e virou: cada meta nasce com a própria conta (`TipoConta.Caixinha` = 7, `Meta.ContaId` + `Icone`, migration `AddMetaCaixinha`); guardar/resgatar = `TransferenciaService` (Idempotency-Key, teto = saldo da conta / guardado); guardado = saldo da caixinha; histórico = transferências dela. **Trava num lugar só no `AppDbContext.SaveChanges`:** lançamento numa caixinha, conta fixa ou cartão ligado a ela → 409, salvo o guardar/resgatar (`LiberarCaixinha`); `GET /contas` esconde caixinha; a lista geral de transações mostra só a perna da conta real. v2: `/metas` em cartões, `/metas/:id` (página da meta), `/metas/:id/guardar` e `/resgatar`, formulário com sugestões e ícone; Bancos mostra o grupo "Caixinhas das metas" (só ver, "Abrir a meta"); Início junta as caixinhas numa linha. Pedido no meio: **Transações mostrava hoje por último** (previsões de contas fixas meses pra frente em cima) → sem período a lista vai até hoje; "Previsto" no filtro mostra do mais perto pro mais longe. 1623 back, 143 v2. Na conta do Gustavo: as 5 metas de teste ganharam ícone e dinheiro guardado da "Poupança (teste)" (Viagem com um resgate no histórico); DemoSeeder recriou as do Gabriel Dev. **Depois, "o que acontece com a grana quando conclui?":** concluída era só guardado ≥ alvo, então resgatar pra gastar desfazia; o Nubank não guarda registro (resgata e exclui). Feito o que ele aprovou: "Concluir e usar o dinheiro" (guardado todo pra uma conta, `ConcluidaEm` + `ValorJuntado`, caixinha encerrada), trava `FOR UPDATE` por meta, 404 pra estranho, `diaDeInstante` no v2. 1629 back, 147 v2. Conta do Gustavo: "Notebook (teste)" concluída; a Viagem está "Chegou lá" pra ele testar o botão. Gabriel Dev: "Notebook novo" concluída (DemoSeeder com bloco por meta, sem apagar). **Depois ele ajustou:** Concluídas só as marcadas ("Chegou lá" fica Em andamento, situação `chegou-la`), e a concluída é registro: um botão só, "Criar outra igual" (meta nova preenchida e zerada, mesma duração do prazo); back recusa mexer nela, Reabrir saiu. 1629 back, 147 v2.

**Limites no v2 (2026-10-19, branch `feat/v2-limites`, empilhada na de Metas):** o Gustavo escolheu "vale todo mês" (Monarch). Back reescrito: `Orcamento` vira linha do tempo (vale deste mês em diante; 0 = tirou), pôr/mudar/tirar só do mês atual pra frente, `GET /orcamentos?ano&mes` (limites + sem limite + totais + editável), `GET /orcamentos/sugestao` (média dos 3 meses antes), `PUT`/`DELETE /orcamentos`. **Achado P1 fechado:** o gasto do limite ignorava compra parcelada (parcelamento não vira lançamento) → regra única `RegrasFinanceiras.GastosPorCategoriaDoMesAsync` (parcela do mês com juros; previsto à parte). Excluir categoria movendo limites agora soma as linhas do tempo. v2: `/limites` (faixa, Com limite/Sem limite, ficha com Tirar/Editar), `/limites/novo` e `/editar` (média dos 3 meses). DemoSeeder do Gabriel: passou, perto, com folga (valor mudou neste mês, vinha de 3 meses), sem gasto. Conta do Gustavo: Alimentação 400 (passou), Moradia 1.900 (perto), Lazer 200, Transporte 300. 1620 back, 154 v2. Sobras no ROADMAP. Depois: alerta de limite (`AlertaLimitesJob`, `Notificacao.Chave`) e, a pedido do Gustavo, a tarefa dos reais: branch `fix/reais-sem-cultura` (empilhada na de Limites) troca as 21 mensagens `{x:C}` por `Reais.Formatar`, tira o `CultureInfo("pt-BR")` do Relatório (`MesesPt`), tira os travessões das notificações de empréstimo e põe a trava `SemCulturaNasMensagensTests`. 1633 back.

**Respostas, passo 1 (2026-10-19, branch `feat/v2-respostas`, empilhada na `fix/reais-sem-cultura`):** direção nova do Gustavo: o app responde perguntas ("vai dar?", "essa meta cabe?"), não só registra (visão em `docs/features/respostas/visao.md`; o cartão foi ideia dele a partir do medidor de contexto do Claude Code). Feito: (A) `DinheiroDoMesService` + `GET /dinheiro-do-mes` (renda base, já saiu por categoria, ainda vem, livre, resposta com tom e ações); (B) Início com o cartão `UsoDaRenda` (barra da renda, o que vem listrado, marca "sua renda", resposta) no lugar de "Renda do mês"; saiu "Maiores gastos do mês" (outro número pro mesmo nome); (C) Limites: situação "Vai passar", lista do que ainda vem com link pra conta fixa, frase "dá pra gastar mais X sem passar" / "passa X" / "pausar ou cancelar alivia"; (D) `ViabilidadeMetaService` + formulário de meta respondendo se cabe e oferecendo o prazo que dá. Com os dados do Gustavo: 171% da renda usada em outubro; viagem de R$ 5 mil em dezembro → "não sobra nada: o seu gasto normal (R$ 3.073,27 por mês) já passa da renda (R$ 3.069,40)". 1648 back, 160 v2. Próximo: passo 2 (lista de Metas + cartão na Renda), depois **Empréstimos** (antes de Relatórios, pedido dele).

**Próxima tela combinada:** Limites → Empréstimos → família (começando pelas ações na tela da transação). Relatórios por último. **Relatórios por ÚLTIMO** (decisão do Gustavo, 2026-10-19): a tela responde perguntas com os dados que as outras telas fazem a pessoa preencher, então só dá pra desenhar direito depois delas. Até lá o item do menu segue mandando pro app antigo.

**Merge (2026-10-19, pedido do Gustavo):** a pilha #315 a #321 foi juntada de cima pra baixo (squash de cada um na branch de baixo; o #320 teve conflito add/add no `visao.md`, resolvido com a versão mais nova) e o #314 entrou na main com tudo (squash `4bbc8bd`, auto-merge). Branches apagadas: as 8 da pilha + `feat/v2-na-main` (#304) e `fix/excluir-conta-com-historico` (#305). Ficaram: `feat/ds-premium` (este worktree de docs; 105 commits, mexe no v1), `feat/front-v2` e `feat/cartoes-lab` (sem PR; ver com o Gustavo). **Fatura no cartão da renda (2026-10-19, #323, squash `37174b9`):** decisão 1 resolvida: o cartão da renda ganhou "Faturas a pagar este mês" à parte (vencimento, compras de/a, falta pagar, atrasada), fora do gasto e do livre; `RegrasFinanceiras.FaturasAPagarNoMesAsync` (total pela regra da fatura). Na conta do Gustavo a do Nubank vence 8/11 (R$ 2.239,87), aparece em novembro. 1649 back, 160 v2.

**Parcelas já compradas (2026-10-19, `feat/v2-respostas-parcelas`):** decisão 2 ("pode fazer assim"): cada parcela segue como "já saiu" no mês dela, e o que já está comprado pros próximos meses aparece à parte. `RegrasFinanceiras.ParcelasPorMesAsync` (parcelas de `Parcelamento` não canceladas, com juros, por mês e categoria; `soPendentes` pra frente). Cartão da renda: grupo "Parcelas já compradas pros próximos meses" (3 meses + "depois, até …"). Limites: linha na ficha "R$ x até <mês>" da categoria. Meta: a folga desconta a média das parcelas no prazo e o "gasto normal" passa a ser sem parcelas (senão contava duas vezes); frase nova quando são as parcelas que apertam (ação → Cartões). Conta do Gustavo: R$ 4.762,85 até julho/2027; criada "Geladeira (teste)" 5x em Moradia (ficha mostra R$ 1.500 até março/2027) e "Sofá (teste)" 4x pelo formulário de transação. 1652 back, 160 v2. **Achado P1 nisso:** a nova transação parcelada do v2 (`POST /transacoes` com `parcelas`) usa o fluxo antigo (`FaturaService.CriarParcelamentoAsync`: N lançamentos soltos "X (i/N)"), não cria `Parcelamento`; não aparece em Cartões › Parcelamentos, não antecipa nem cancela em grupo e não entra em "parcelas já compradas". Na Fila do ROADMAP.

**Compra parcelada de verdade + Transações › Gastos (2026-10-19, branch `fix/v2-parcelado-de-verdade`):** #324 mergeado (squash `617db91`). O Gustavo pediu pra consertar o achado acima ("pode fazer agora") e, perguntado onde a compra aparece em Transações, explicou: a parcela é do cartão, o dinheiro só sai quando paga a fatura, e o registro é na ordem de quando gastou ("pesquisa como funciona no mercado"). Pesquisa (Organizze, Mobills, YNAB, Monarch) → ele escolheu **dois modos como o Organizze**. Feito: (1) `ParcelamentoService.CriarDoLancamentoAsync` (1ª parcela na fatura em que a compra cai; compra antiga com parcelas em faturas vencidas entra como compra em andamento) usado pelo `POST /transacoes` com parcelas e pela edição que vira parcelado; `FaturaService.CriarParcelamentoAsync` e o replay por nome "X (i/N)" saíram. (2) Criar parcelamento passou pro padrão `RegistroIdempotencia` (op `CriarParcelamento`, mesmo SaveChanges, entra na transação de quem chama). (3) `Parcelamento.SubcategoriaId` (migration `AddParcelamentoSubcategoria`), movido junto ao excluir categoria/subcategoria e contado no uso da subcategoria. (4) `GET /transacoes?visao=gastos` (`TransacaoService.ListarGastosAsync`: despesa que entra no resultado + parcelamento ativo uma vez pela data da compra, UNION ALL com filtro/ordem/página no banco). (5) v2: seletor Saldo | Gastos (lembrado no navegador), sem "tipo de lançamento" em Gastos, linha da compra parcelada "Nubank · Moradia · 5x de R$ 300,00" abrindo o parcelamento; barra arrumada no celular. Conferido no Postgres: "Cadeira (teste)" 3x criada pelo mesmo pedido do formulário (parcelas nov/dez/jan, replay devolve o mesmo), aparece em Gastos, em Cartões › Parcelamentos e nas parcelas já compradas (Moradia R$ 2.100 até março/2027). 1658 back, 162 v2. Pendência na Fila: os "Pagamento de fatura" do extrato local gravados como despesa. **Depois, trava de limite:** perguntado se trocava o bloqueio por aviso, o Gustavo respondeu que o app é registro manual e a compra à vista também tem que travar. `RegrasFinanceiras.ExigirLimiteDisponivelAsync` (mesma mensagem do parcelamento) no `CriarTransacaoAsync` (despesa efetivada no cartão) e no `AtualizarAsync` (só o aumento no mesmo cartão; vindo de conta ou outro cartão, o valor todo; baixar sempre passa). Provado ao vivo: Nubank com R$ 2.263,66 disponível recusou compra de R$ 3.000 (409, nada gravado). 1661 back. **Depois, conta fixa e aviso** (Gustavo: a cobrança sem limite tem que avisar, e o app tem que avisar "se fizer essa compra, não vai ter pra pagar a conta X"; escolheu "faz os dois"): (1) `RegrasFinanceiras.CobrarOcorrenciasAsync` (regra única, usada pelo `ExecutarRecorrentesJob` e pelo `RecorrenteService.GerarPendentesAsync`, onde a vencida no cartão nasce prevista e passa pela regra): a mais antiga primeiro, só cobra se o limite cobre; a que não cabe fica prevista, aviso uma vez por ocorrência (`TipoNotificacao.CobrancaSemLimite` = 14, link pro cartão) e o job tenta de novo todo dia. (2) `GET /transacoes/aviso?valor&cartaoId|contaId` (`AvisoDeCompraService`): no cartão, "Não cabe no limite..." (negativo) ou "Se fizer essa compra, falta limite no cartão X pra Netflix (dia 25, R$ 55,90)"; na conta, o saldo andando pelos previstos dos próximos 30 dias (o que entra no mesmo dia vem antes). Formulário de despesa nova mostra a resposta embaixo da prévia (espera parar de digitar). Ao vivo: compra de R$ 250 na conta Nubank (saldo negativo) avisou Internet, Plano de celular, Aluguel e mais 3. 1667 back, 163 v2. Depois, a pedido dele ("tá sem organização"): o aviso virou estruturado (`AvisoDeCompraDto`: frase curta, as contas uma por linha na `ListaAindaVem` sem link e com mês, e "Saldo da conta hoje"/"Limite disponível hoje" no fim; `Resposta` ganhou itens e detalhe). Mergeado no #325 (squash `41cf901`).

**Respostas, passo 2 (2026-10-19, branch `feat/v2-respostas-passo2`):** (1) "as metas juntas cabem?" no topo de Metas: `ViabilidadeMetaService.DasMetasAsync` + `GET /metas/viabilidade/todas` (mesma base do "essa meta cabe?", agora em `RendaEGastoNormalAsync` + `ParcelasPorMesAsync`: renda esperada − gasto normal − parcelas, média dos próximos 12 meses), somando o que as metas em andamento pedem por mês; não cabendo, sugere esticar o prazo da que mais pede até o mês que faz caber (ação "Ajustar X"). (2) Renda ganhou o bloco "Pra onde vai a renda" (o `UsoDaRenda` do mês escolhido), que se refaz quando a pessoa muda o que espera receber. Com os dados do Gustavo: "As metas pedem R$ 5.206,67 por mês, e hoje não sobra nada: o seu gasto normal (R$ 3.073,27 por mês) já passa da renda (R$ 3.069,40)." 1670 back, 165 v2. Mergeado no #326 (squash `7fcad66`).

**Empréstimos no v2 (2026-10-19, branch `feat/v2-emprestimos`):** mostrado o desenho antes (widget com exemplos) e o Gustavo escolheu as 4 recomendações: abas Em andamento | Quitados com os grupos "Você emprestou" / "Você pegou"; "falta voltar / falta devolver" (nunca deve/dívida/cobrar/a receber/a pagar); no topo a resposta + "Pra responder"; banco agora, juntar depois. Back: `ProximosEmprestimosService` + `GET /emprestimos/proximos` (o que vence em 30 dias dos dois lados, inclui o que já venceu, saldo nas contas sem caixinha; frase de fato) e `EmprestimoService.RestanteDaParcela`/`RestanteAVista` (regra única, o vencido do topo também usa). **Bug P1 achado e corrigido:** em "Peguei" sem vínculo, registrar o que devolveu criava RECEITA "Recebimento empréstimo" (o tipo seguia o `souCredor`, que sem vínculo é sempre o criador); agora segue `euEmprestei`. Provado ao vivo: devolver R$ 426,30 ao Itaú virou despesa da Poupança. Juros/multa: back recusa fora de 0 a 100%. v2: `telas/Emprestimos.tsx` (números, `Resposta` com as duas listas, Pra responder com Não recebi/Confirmar e Recusar/Aceitar, `ListaFicha` com parcelas e ações Excluir/Quitar/Convidar/Registrar/Tirar da lista), páginas `EmprestimoFormulario`, `RegistrarEmprestimo` (sugere a próxima parcela com juros), `ConfirmarPagamentoEmprestimo`, `ConvidarEmprestimo` (link pra mandar); `dominio/emprestimo.ts`; nome mostrado é o que a pessoa deu (o catálogo de bancos é razão social). Conta local do Gustavo: João, Marina, Ana, Bruno (teste) e Itaú. DemoSeeder do Gabriel: João 6x (2 voltaram), Carla (venceu), Bia (quitado), Itaú 12x com juros (3 devolvidas), Rafa, Marina acompanhando junto (R$ 200 pra confirmar) e convite dela pendente. 1675 back, 169 v2. Pendências na Fila do ROADMAP (juntar, vincular lançamento existente, decidir se empréstimo entra no resultado, falta sem juros). Mergeado no #327 (squash `f8490c8`).

**Empréstimo fora do resultado (2026-10-19, branch `feat/emprestimo-fora-do-resultado`):** decisão do Gustavo ("pode deixar fora como transferência"). `Transacao.EhEmprestimo` (migration `AddTransacaoEhEmprestimo`, que marca os lançamentos já ligados a empréstimo: o da criação e os dos pagamentos) em todo lançamento que o `EmprestimoService` cria ou liga (criar, registrar, confirmar, inclusive o já existente); fora do `RegrasFinanceiras.EntraNoResultado` e do `RendaService.EhRenda`, então sai do gasto do mês, dos limites, da renda, do Entrou/Saiu e da visão Gastos, e continua no saldo. v2: etiqueta "Empréstimo" no extrato. Ao vivo: o pagamento de R$ 426,30 ao Itaú ficou marcado e saiu de Gastos. Os "Resgate de empréstimo" do extrato importado do Gustavo não estão ligados a empréstimo nenhum e seguem como gasto (resolve com "vincular lançamento existente", na Fila). 1679 back, 170 v2. Mergeado no #328.

**Família: pesquisa + mapa (2026-10-19):** o Gustavo não entendeu o 1º desenho ("não entendi nada") e levantou 4 pontos: o passado não muda quando a regra muda; a família tem que juntar as coisas dos dois (abas Transações, Contas fixas); o que registro na família tem que gerar lançamento na minha conta; quem sai continua no histórico; "faz uma pesquisa, é a tela mais importante". Pesquisa (Splitwise, Tricount, Honeydue, Monarch, YNAB) + buracos conferidos no código em `docs/features/familia/espaco-da-familia.md`. Mapa aprovado: Visão geral · Transações · Contas fixas · Relatórios · Entre vocês · Membros (com os dependentes dentro) · Regras; depois Metas e Limites da casa. Decisão 4.2 aprovada: o gasto do mês de cada um é a SUA PARTE da despesa dividida. Ordem: 1 parte gravada → 2 bloco Família na transação → 3 acerto vira lançamento → 4 abas Transações/Contas fixas + Membros com dependentes → 5 contas da casa → 6 Relatórios da família.

**Família, passo 1: a parte de cada um fica gravada (2026-10-19, branch `feat/familia-passo1-parte-gravada`):** `RateioTransacao` ganhou `Valor` e passa a existir em TODO modo, calculado ao dividir (`RateioService.CalcularPartesAsync`: Igual; Pela renda = renda prevista do mês da despesa; Do meu jeito; centavos em quem pagou); `Transacao.ModoRateio` vira só "como chegou nesses números". `DefinirModoFamiliaAsync` vale pras próximas (Regras avisa). Equilíbrio (`ObterBalancoAsync`) = soma das partes gravadas; quem saiu continua nos meses em que dividiu (`MembroFamilia.SaiuEm`, "saiu em out/2026"); despesa antiga sem parte usa a regra de antes ao vivo (só até a migration rodar). `GastosPorCategoriaDoMesAsync`: despesa dividida conta pela parte da pessoa, e a parte dela nas despesas dos outros entra no mês dela (pendente/recusada conta inteira pra quem pagou); cartão da renda, limites e "cabe?" seguem. Migration `AddRateioCongelado` preenche as partes do que já estava dividido (igual entre os ativos que não são "só vê"; família "pela renda" entra como igual, não havia renda declarada) e o resto dos centavos vai pra quem pagou; no banco local: 21 despesas → 42 partes. v2: "sua parte R$ X" na lista da família, "saiu em" no equilíbrio, nota em Regras. **Ainda do passo 1 (Fila):** Transações › Gastos e o "Saiu" do topo ainda mostram o valor inteiro da despesa dividida (a lista do passo 4 traz "sua parte"). 1687 back, 171 v2. Mergeado no #329.

**Família, passo 2: o quadro Família na despesa (2026-10-19, branch `feat/familia-passo2-transacao`):** página da despesa ganhou o quadro Família (`telas/TransacaoFamilia.tsx`): só sua → "Dividir com Casa Pontes"; dividida → "No equilíbrio do mês / Esperando aprovação / Recusada", Como divide (Igual · Pela renda · Do meu jeito, com % que têm que somar 100; muda só aquela despesa e regrava as partes), a parte de cada um (você primeiro, quem saiu com a data, "Marina só vê: fica fora da divisão"), Quem cuida dessa conta, Pra quem (dependentes; vale sem dividir) e Parar de dividir (com confirmação). Nova despesa: interruptor "Dividir com {família}" nas Opções com "Igual entre Gustavo e Gabriel"; o `POST /transacoes` aceita `familiaId` e divide no mesmo pedido (`DespesaCompartilhadaService.ExigirPodeDividirAsync` antes de criar); parcelada com família → 400 (ainda não divide). `TransacaoDto` traz `familiaId`, `statusAprovacao`, `dependenteId`, `responsavelUsuarioId`. Família "Do meu jeito" dividindo sem dizer as partes começa igual (`RateioService.ModoAoDividir`; antes dava erro). Rótulos dos modos viraram "Igual / Pela renda / Do meu jeito". Visto no navegador: Plano de celular dividido (24,95 + 24,95), Do meu jeito 60/40 (29,94 + 19,96), "Feira da semana (teste)" criada já dividida (40 + 40). 1689 back, 178 v2. Mergeado no #330.

**Família, passo 3: o dinheiro entre vocês vira lançamento (2026-10-19, branch `feat/familia-passo3-acerto`):** decisão do Gustavo: quando quem PASSOU registra, espera quem recebeu confirmar (como o pagamento de empréstimo). Só quem passou ou quem recebeu registra (`AcertoService`; terceiro → 400). Formulário "Dinheiro entre vocês" virou "Eu passei / Eu recebi" + pra/de quem + valor + dia + "Saiu de / Entrou em" (contas da pessoa ou "Não registrar em conta"), preenchido pelo equilíbrio; "Marcar como feito" só aparece pra quem passa ou recebe. Registrou quem passou → "Esperando Gabriel confirmar" e o equilíbrio não muda; quem recebeu vê "Esperando você confirmar" com Confirmar (diz em qual conta entrou) e Não recebi (desfaz, inclusive a saída do outro). Registrou quem recebeu → já vale. Cada um lança o seu lado depois ("Lançar na minha conta") e vê "Ver na minha conta". Lançamentos `Transacao.EhAcerto` (fora do resultado e da renda; Transações mostra "Acerto da família"/etiqueta "Acerto" e não deixa editar/excluir; Desfazer cancela os dois). `AcertoContas` ganhou `Data`, `ConfirmadoEm`, `TransacaoSaidaId/EntradaId`, `Versao` (xmin); balanço só conta confirmado; idempotência nova (`RegistroIdempotencia`, op `RegistrarAcerto`); endpoints `POST /familias/{id}/acertos/{acertoId}/confirmar` e `/lancar`; migration `AddAcertoLancamento` (acertos antigos ficam confirmados). DemoSeeder: um acerto esperando o Gabriel confirmar. Visto no navegador: Gustavo "Eu recebi R$ 30" → mês equilibrado + entrada na Carteira; Gustavo "Eu passei R$ 20" → esperando; entrando como Gabriel (painel DEV) → Confirmar na Carteira dele → entrou no equilíbrio. 1698 back, 184 v2. Mergeado no #331.

**Família, passo 4: Transações, Contas fixas e Membros com os dependentes (2026-10-19, branch `feat/familia-passo4-abas`):** menu da família virou Visão geral · Transações · Contas fixas · Entre vocês · Membros · Regras (rotas antigas `/despesas` e `/dependentes` redirecionam). **Membros:** "Quem está" + "Dependentes" (com Adicionar) + convites, numa tela. **Transações:** despesas divididas + dinheiro entre vocês numa lista só por data, aguardando aprovação no topo; filtros no servidor (quem pagou, categoria, situação); o painel "Filtros" das Transações pessoais virou componente (`componentes/PainelFiltros`) e as duas telas usam. **Contas fixas da casa:** `Recorrente.FamiliaId` (migration `AddRecorrenteFamilia`), interruptor "Dividir com {família}" no formulário da conta fixa (só conta a pagar; aberto pela aba já vem ligado); cada cobrança nasce dividida em `GerarOcorrenciasAsync` (sem aprovação de novo; quem saiu/família dissolvida → sai só da pessoa); mudar a regra da família regrava as cobranças previstas; aba com "Você paga · todo dia 19", "Saiu dia / Vem dia" e a sua parte (`GET /familias/{id}/contas-fixas`). **Buraco do passo 1 fechado:** mudar o valor de uma despesa dividida (editar o lançamento ou a próxima cobrança) regrava as partes com o mesmo % (`RateioService.RegravarPeloValorAsync`). DemoSeeder: "Condomínio" da casa. Visto no navegador: Membros com Theo e Bolt; Transações com acertos e despesas misturados por data e filtro "Aguardando aprovação"; "Internet da casa (teste)" R$ 120 criada pela aba → "Vem dia 19/10 · sua parte R$ 60,00". 1706 back, 188 v2. Mergeado no #332.

**Família, passo 5: contas da casa (2026-10-19, branch `feat/familia-passo5-contas-da-casa`):** conta e cartão ganharam `FamiliaId` (migration `AddContaCartaoDaCasa`). "Dividir com {família}" na ficha da conta em Bancos e num bloco "Família" na página do cartão (componente `telas/DaCasa.tsx`; `PUT /familias/contas/{id}/casa` e `/familias/cartoes/{id}/casa`; só o dono e quem lança; caixinha e encerrada não). Regra única `RateioService.DividirSeForDaCasaAsync` chamada em `TransacaoService.CriarTransacaoAsync` (cobre formulário e extrato importado) e na geração das cobranças de conta fixa: a despesa que nasce ali já nasce dividida, com o limite de aprovação; fora transferência/fatura/acerto/empréstimo/saldo inicial/ajuste, compra parcelada e quem não lança mais. Marcar/desmarcar vale pras próximas (o passado não muda). Nova despesa numa conta/cartão da casa: interruptor ligado e travado "(conta da casa)". Visto no navegador: Poupança (teste) marcada → "Padaria da casa (teste)" R$ 64 nasceu dividida (sua parte R$ 32); bloco Família no cartão (não liguei no Nubank). 1713 back, 191 v2. **Fila (P3):** aviso pro outro membro a cada despesa da casa; parcelada no cartão da casa; lançamento movido pra conta da casa na edição. Mergeado no #333 (com o rótulo "Cartão da casa: as compras já entram divididas com…"; ideia do **cartão compartilhado/adicional** registrada no mapa §4.7 e no ROADMAP, decisão do Gustavo: fica como ideia).

**Família, passo 7: sair e excluir a conta (2026-10-19, branch `feat/familia-passo7-sair-excluir`):** decisão do Gustavo: quem exclui a conta deixa na família **só os números**. Antes a purga era recusada pra sempre se a pessoa era de família (pedido de eliminação sem atender, LGPD Art. 18). Agora `FamiliaAoExcluirConta.DesvincularAsync` roda na transação da purga (`AdminLgpdService.PurgarFisicoAsync`): despesas divididas que aconteceram, partes e acertos passam pra um "Membro que saiu" (`StatusUsuario.Removido`, sem e-mail real/senha, fora da lista e das métricas do admin) só com valor, data, categoria padrão e partes; sem descrição, conta, cartão, categoria própria, nota; responsável/aprovador nas despesas dos outros fica vazio; ficha de membro vira "Membro que saiu" com a data; família criada por ela passa pro membro mais antigo que lança (vira admin) ou é dissolvida; convites dela somem. `DetectarVinculosAsync` não trava mais por família (relacionamento, empréstimo, consolidação e conta compartilhada ainda travam). Membros ganhou "Saíram" (`FamiliaDetalheDto.QuemSaiu`). Tela "Excluir a conta" avisa quem é de família. Pesquisa: LGPD Arts. 5, 7 IX, 12, 16, 18 na cópia oficial da Câmara; registrado em `docs/CONFORMIDADE_BR.md` (não é anonimizado; base = interesse legítimo dos outros membros, com minimização). Consertado junto: o detalhe da família podia listar membro inativo já rastreado no contexto (Include filtrado + fixup). Visto no navegador: aviso na tela de excluir conta. 1718 back, 192 v2. Mergeado no #334 (com o ajuste de Dados e privacidade: texto na largura toda, botão embaixo).

**Permissões centralizadas (2026-10-19, branch `fix/permissoes-centralizadas`):** o Gustavo ficou preocupado com permissões (cartão compartilhado, família) e pediu pra centralizar. Antes: `FamiliaPermissoes` (papel) e `DonoRecursos` (dono) existiam, mas "é membro?/lança?/só vê?" estava reescrito na mão em ~12 lugares (Rateio, Recorrente, Meta, FotoPerfil, Acerto, DespesaCompartilhada, Renda, Convite, Onboarding, FamiliaAoExcluirConta, Família). Agora tudo passa por perguntas com nome no `FamiliaPermissoes` (inclusive "só o criador dissolve/não sai"); tabela "quem pode o quê" em `docs/PERMISSOES.md`; trava `PermissoesCentralizadasTests` (lê o código e falha se alguém reescrever a regra fora do helper; já pegou 2 que o levantamento manual não viu) + `QuemPodeOQueTests` (a tabela linha a linha). **Dois furos fechados no caminho:** "Do meu jeito" aceitava parte pra quem só vê; dinheiro entre vocês aceitava quem só vê como parte. 1725 back. **Próximo:** "o que ainda vem da casa" na Visão geral, depois essencial/não essencial + sinais → Relatórios (pessoal + família). **Próxima ação:** Gustavo ver o Início, Limites e o formulário de meta respondendo; depois passo 2 das respostas (lista de Metas + cartão na Renda) e **Empréstimos** (antes de Relatórios) → ações de família na tela da transação → Relatórios (última). PRs #314 → #315 → #316 → #317 → #318, com CI (mergear nessa ordem);

---

### 📌 Sessão 2026-10-12/13 — dogfood com o extrato real + Fase 0 + METAS E PRAZOS · branch `fix/transferencia-hora`

**Conta pessoal primeiro (2026-10-19/20):** o Gustavo parou a família ("arrumar tudo que é de conta pessoal primeiro"; PR #336 aberto). #337 mergeado (reconciliação: marco mostra a diferença de agora; os R$ 600 eram despesas de teste minhas, sumiram com o banco). Pedido seguinte: "valida tudo da parte pessoal… pode deletar o banco e criar uma conta do zero". Banco zerado (o MeuCenarioSeeder recriou a conta dele) e conta **"Teste Pessoal"** (`pessoal@controle.test`, senha de dev, 1 clique no painel DEV) montada por script nos endpoints reais com ago–out/2026 e conferida contra a conta esperada + tela por tela no navegador. Achados e correções em `fix/validacao-pessoal` (detalhe no topo da Fila do ROADMAP). Back 1730, v2 194. Scripts da validação no scratchpad da sessão (`valida_pessoal.py`, `valida_telas.py`), não no repo.

**Marcos combinados (ver topo do `ROADMAP.md`):** M1 Fase 0 + transação em página **24/10** · M2 beta no ar **07/11** (Gustavo contrata VPS + domínio até 27/10) · M3 usável no dia a dia **28/11** · M4 1.0 com cobrança **29/01/2027**.

**Entrou na `main` nesta sessão:** #289 (conta OU cartão com dono + saldo real nos Relatórios) · #290 (parcelamento em andamento) · #291 (Pix no Crédito fora do resultado + `RegrasFinanceiras.EntraNoResultado`) · #292 ("Pagamento de fatura" do extrato paga a fatura do app) · #293 (estorno de pagamento de fatura) · #294 (editar data da compra no cartão move de fatura) · #295 (reconciliação lista só efetivado) · #296 (transação em página: criar/ver/editar numa tela só, ações saem do ⋮ — popups apagados) · #297 (conta fixa idempotente + criar devolve a nova sem depender da 1ª página).

**Nesta branch (M1, sem PR ainda):** transferência guarda a hora (decisão do Gustavo: "guardar a hora") — DTO `Data` (DateOnly) + `Hora` (TimeOnly?) como o lançamento comum, as duas pernas com hora; back recusa data futura (só o front barrava). Back 1429 + front 934 verdes, lint/build OK, mutações conferidas, conferido ao vivo (transferência de teste de R$ 0,01 criada e apagada, saldos iguais).

**Banco local:** recriado pelo `MeuCenarioSeeder` (gitignored) — conta real do Gustavo; pode resetar à vontade (`DROP DATABASE` + subir a API). Vite: edição por `sed` às vezes não dispara o recarregamento — `touch` no arquivo resolve.

**Próxima ação:** PR da `fix/transferencia-hora` → resto do M1 até 24/10: editar lançamento sem hora (**decisão do Gustavo**: manter sem hora ou exigir), write skew compra × pagamento, sobras do extrato (Pix entre contas, empréstimo, resgate RDB).

---

### 📌 Sessão 2026-10-02 — Reconciliação: redesenho do painel + saldo inicial com data + editar saldo inicial · branch `exp/consistencia-front`

**PONTO VERDE TOTAL (back 1095 + front 662 testes, builds verdes).** Sessão grande: redesenho da reconciliação + saldo inicial com data + editar saldo inicial + **migração date/time (mata o bug de fuso)** + banco limpo/seed enxuto. Dogfood no `dev@controle.test` (senha `Dev@123456`, 1-clique no painel DEV).

**Modelo — saldo inicial com DATA (consertou o retroativo):** `ContaService.CriarAsync` += `dataSaldoInicial` (default hoje), carimba a transação `EhSaldoInicial` no **início desse dia** (não mais `UtcNow`). `CriarContaDto += DataSaldoInicial`; `ContaForm` ganhou campo "Saldo inicial desde" (só ao criar + saldo>0, max hoje). Antes: baseline caía "hoje" e todo dia passado ignorava a abertura (01/09=0, 16/09 sem os 2.000). Agora o baseline ancora no começo.

**Reconciliação — painel REDESENHADO (layout uniforme, iterado ao vivo com o Gustavo):**
- Seletor de conta ("Conta a conferir") mora no TOPO do painel de conferir (não mais topbar solta). Removido o contador "N contas".
- Painel uniforme: título → input → 3 linhas (Calculado/Declarado/Diferença) → slot de status (altura fixa) → ações no RODAPÉ. Conferir e marco têm a MESMA altura; calendário compacto (célula altura fixa, não quadrado gigante); as duas colunas `align-items: stretch` com o histórico/última ancorado embaixo.
- Copy do "banco": input "Saldo que aparece no seu banco" + "Abre o app do seu banco e põe o valor aqui".
- Aviso ESPECÍFICO pelo sinal: `dif>0` → "Sobrou R$ X — tem mais no banco…"; `dif<0` → "Faltou R$ X — tem menos no banco…" (não mais "Faltou (ou sobrou)").
- **Baseline removido da reconciliação** — saldo inicial = só no cadastro (uma fonte, sem lançar 2×); a tela só **confere/ajusta**.
- "Remover" marco em vermelho (`danger-outline`). Histórico virou **uma linha** "Última conferência" (calendário já mostra os marcos). Movimentos = `PontesTabela` full-width, SEMPRE visível (vazio do componente), coluna Valor **sem +/−** (só cor verde/vermelho — memória [[feedback_display_sem_sinal_valor]]).
- `abrirDia` leva o calendário pro mês do dia (clicar na última conferência de outro mês navega).

**EDITAR saldo inicial pela reconciliação (feature nova, dinheiro):** marco de partida ganhou "Alterar valor" → modo edição (Valor + Desde) → salva. Backend: `PUT /contas/{id}/saldo-inicial` + `ContaService.AtualizarSaldoInicialAsync` (dono/`UsuarioId` → 404 alheio, valor>0, data não futura, atualiza/cria a tx `EhSaldoInicial` no início do dia, `FinancialEventLog` `TransacaoAtualizada=52`). `AtualizarSaldoInicialDto`, `atualizarSaldoInicial` no `contaService.ts`. Verificado ao vivo (2.000→2.500, toast, partida atualizada).

**Hora na transação (2026-10-02, tarde):** (1) tabela de movimentos da reconciliação ganhou hora na coluna Data (`dd/mm HH:MM`, helper `fmtDiaHora`, lê UTC igual `fmtData` das Transações). (2) `TransactionForm` — **hora virou obrigatória** no único + transferência (`*` no label + erro inline "Informe a hora", bloqueia submit; recorrente segue sem hora). Verificado ao vivo. **Edit reusa o form → vale pra edição também.**

**✅ BUG DE FUSO RESOLVIDO PELA RAIZ — date/time SEPARADOS (migração grande, 2026-10-02):** `Transacao.Data` (timestamp único, saía sem `Z` → front deslocava +3h / rolava o dia) foi quebrado em **`Data` (`date`) + `Hora` (`time?`, null=sem hora)**. Migração `SepararDataHoraTransacao` (add Hora → UPDATE preserva a hora do timestamp, meia-noite→null → ALTER Data pra date; Down recompõe). **~20 arquivos backend** (núcleo de dinheiro eu: entidade, DTOs `CriarTransacaoDto`/`TransacaoDto` com `DateOnly Data`+`TimeOnly? Hora`, controller sem `.ToUniversalTime()`, `TransacaoService` ranges `DateOnly?`+ordena por Data/Hora, `FaturaService` ciclo DateOnly, `ReconciliacaoService`, Dashboard/Relatorio/Orcamento/Conta; periféricos via builder: Transferencia/Recorrente/Parcela/Importacao/DespesaCompartilhada/Emprestimo/AdminLgpd/DevDataSeeder/jobs — regra: assign DateTime→`DateOnly.FromDateTime`+`Hora=null` nos datados; ler como DateTime→`Data.ToDateTime(Hora ?? MinValue)`). **Front:** tipo `Transaction` +`hora`, dialogs mandam `data`+`hora` separados (`hora: "HH:MM:00"|null`), `fmtData`/`fmtDiaHora` leem campos separados (sem `new Date`/`getUTC*`), edit preenche hora de `transaction.hora`. **Verificado ao vivo:** read+write sem shift; ajuste que aparecia `01/10 02:59` agora `30/09 23:59`; criar grava `Data=2026-10-02 Hora=14:30:00` → exibe `02/10 14:30`. **Testes: back 1095 verde** (inclui round-trip JSON, migration, modelo Npgsql date/time) **+ front 662 verde.** **Fix de regressão aplicado:** `CalcularSaldoAteAsync` voltou a cortar por dia+hora (`t.Data < dia || (t.Data==dia && (Hora==null || Hora<=hora))`) — eu tinha perdido a precisão de hora ao migrar; o escritor-de-teste pegou.

**🧹 Banco limpo + seed enxuto (2026-10-02):** apagado tudo do Postgres local (confirmado: 0 dado real — só usuários de teste; Bancos mantidos). `DevDataSeeder` reescrito pro **casal** só: `dev@controle.test` (titular rico: CC+Poupança+Carteira+cartão Nubank+faturas+recorrentes+família) + `conjuge@controle.test` (agora com conta/renda próprias → rateio dos 2 lados). **Removido o `solo`.** Hora real nas ações, null nos gerados. Painel DEV base (`LoginPage.tsx`) enxugado (o painel real vem de `/auth/dev/contas`). `MeuCenarioSeeder` pessoal (gustavo.seed/anapaula.seed) intacto.

**Shell (vale pra TODAS as telas):** `DefaultLayout.module.css` `.page` max-width 1480→**1800**, `.main` padding 28→**20px 24px** (menos espaço lateral perdido em tela grande). `Navbar` ganhou wrapper `.inner` (mesmo cap+padding do conteúdo) → título e "Nova transação" ALINHAM com a página em qualquer largura.

**Galeria DEV:** `/reconciliacao-estados` (rota atrás de `import.meta.env.DEV`, `ReconciliacaoEstados.tsx`) — todos os modos do painel lado a lado, CSS real, dados fake. Pra revisar design sem ping-pong.

**Saldo inicial na tela de Bancos (2026-10-02, noite):** furo fechado — a Carteira nasce zerada no cadastro e não tinha onde receber saldo inicial. `AccountsPage` (rota `/accounts` = item "Bancos"; a `BancosPage` é código morto, catalogado P3) ganhou a ação "Saldo inicial" em toda conta (Carteira inclusive): modal Valor + Desde, pré-preenche pelo marco derivado (`listMarcos`), valida inline, salva via `atualizarSaldoInicial`. Helpers `parseMoney`/`maskMoney`/`moneyParaCampo` foram pra `utils/money.ts` (a reconciliação passou a importá-los). Verificado ao vivo na Carteira do dev (abre pré-preenchido, erro inline no vazio, salva e o saldo acompanha). **Seed:** "Saldo Inicial" do `DevDataSeeder` agora sai com `EhSaldoInicial` + hora nula → vira a partida da reconciliação.

**Dashboard redesenhado (2026-10-02, noite) — 1ª tela da fila de densidade.** Layout aprovado pelo Gustavo (inspiração Behance: WealthWise / Approx): faixa de saldo com Entrou/Saiu/Sobrou + troca de mês, gráficos lado a lado, recentes à esquerda e orçamento/contas/cartões à direita. Sem saudação nem textos explicativos. Backend: `DashboardService` corrigido (recentes só efetivadas até hoje, variação na mesma base do saldo, `DistinctBy`, maiores gastos = saídas de caixa com "Sem categoria"/"Outros", DTO de recentes com `Data`+`Hora`+flags, `UltimosDigitos` do cartão, `TipoConta.Descricao()` compartilhado com `ContasController`). `PontesCategoryDonut` com raio em % e % pt-BR (Relatórios conferido, sem quebra). Atalhos rápidos + atalhos de teclado do Dashboard REMOVIDOS (pedido do Gustavo). Padrão denso documentado em `docs/DESIGN_SYSTEM.md` → "Densidade"; fila de migração das outras telas no ROADMAP. **Testes: back 1144 · front 805 verdes.**

**Estado: TUDO VERDE e commitado** — último commit `4df2901` (push feito). Back 1144 testes · front 805 · lint+build limpos. Banco local já com o seed novo (só `dev@` + `conjuge@`, senha `Dev@123456`). `MeuCenarioSeeder` pessoal DESLIGADO (renomeado `.cs.bak`, gitignored — nunca commitar).

**2026-10-03 (madrugada) — dois itens fechados:**
- **Reconciliação: ajuste acidental FECHADO.** Campo do banco vazio ≠ zero: sem digitar, Declarado/Diferença ficam "—" e não aparece ação; "0,00" digitado vale. Back: `SaldoDeclarado` `decimal?` obrigatório (ausente → 400).
- **Dashboard: "Gasto no cartão" (decisão do Gustavo = opção A).** Caixa à parte (embaixo das recentes) com total + compras do mês; parcela aparece com o número ("TV 2/10"); "Saiu"/"Maiores gastos" seguem no caixa. Regras do total da fatura (`RegrasFinanceiras`).
- Testes: **back 1152 · front 812**, lint+build verdes. Verificado ao vivo na conta de teste da cônjuge (criado "Cartão Teste" •••• 4321 + "Tênis (teste)" + "TV (teste)" 10x — dado de teste, pode apagar).
- Achado novo (P2, ROADMAP): o seed grava lançamento efetivado com data futura → saldo/hero não batem com o "Calculado" de hoje.

**2026-10-04 — Reconciliação em 2 passos + eixo do gráfico:**
- Gustavo: "o ajuste só aparece depois que a pessoa lançar o que tem no banco". Agora: passo 1 = só "Salvar saldo do banco" (marco de verificação, sem ajuste); passo 2, no marco salvo = diferença recalculada ao vivo + "Lançar o que falta" / "Ajustar" (ou "Confere — atualizar marco" se já lançou o que faltava). Backend `POST /reconciliacao/marcos/{id}/fechar`. Ajuste virou linha ("Ajuste lançado"), sem etiqueta amarela. Marco com diferença pendente = vermelho no calendário.
- Dashboard: eixo do gráfico sem "R$" (não corta mais). Comparação com o mês anterior = decisão pendente do Gustavo (3 opções no ROADMAP).
- Coluna "Data" → "Data/Hora" (Reconciliação + Transações; a transação já guarda date + time separados). Fonte de título = fonte normal no app todo (Fraunces só no site público).
- **Back 1166 · front 828** verdes, lint+build limpos. Verificado ao vivo (Carteira da cônjuge: salvar → ajustar → remover; voltou ao saldo original).
- Pergunta aberta ao Gustavo: separar também a data/hora do MARCO da conferência (`ReconciliacaoSaldo.DataHora`)?
- **2026-10-05 (parte 6) — TUDO NA `main` (squash `8fee630`, #286) + faxina do ROADMAP.** A pilha #284→#285→#286 entrou num squash só depois de CI verde nos dois PRs; #284/#285 fechados como incluídos; branches `exp/consistencia-front`, `fix/bugs-dinheiro-p1`, `feat/responsivo`, `fix/titulos-e-descricoes` e os 2 worktrees `claude/*` apagados (vídeos do brag copiados pra `Vídeos\Pontes`; a ferramenta foi pra `tools/video-tour/`). CI agora roda em TODO PR. Faxina: fila do ROADMAP reescrita só com o aberto (fila antiga inteira + 42 itens ✅/[x] movidos sem cortes pro `docs/history/ROADMAP_CONCLUIDO.md`); "Onde estamos" e "Branches" atualizados; renda do casal dedutível virou decisão pendente. **Próxima ação:** Fase 0 — bugs de dinheiro P2 (topo da fila), começando por "excluir/editar compra no cartão não reconcilia a fatura"; oferecer revisão de segurança com agente (PERGUNTAR antes).
- **2026-10-05 (parte 5) — 🔴 P0 RESPONSIVO FEITO · branch `feat/responsivo` (sai da `fix/bugs-dinheiro-p1`; PR #285 desta empilhado na exp).** Levantamento a 375px (no ROADMAP) → em sequência, com commit por passo: (1) barra lateral vira gaveta no celular (`PontesDrawer bare`, `useMediaQuery`/`CELULAR`); (2) topo compacto (busca/"+" só ícone < 1024px, sem caminho no celular) + rótulo de botão em 1 linha; (3) `PontesTabela` vira lista de cartões por container query na caixa (< 640px); (4) heros empilham (Contas Fixas/Metas/Limites), Dashboard (Entrou/Saiu/Sobrou quebram, rosca empilha), `PontesChoiceCards`, grades de número 2 por linha, `PontesToggle` alinhado; "−R$" de Contas Fixas removido; (5) tabelas próprias (detalhe parcelamento/empréstimo, prévia da importação) viram cartões; alvos de toque ≥ 36px; (6) tablet: barra recolhida < 1024px; (7) site público: menu ☰ no `PontesNavbar`, rodapé, 5 páginas; (8) Admin com a mesma gaveta; Login/Cadastro com recuo menor. Também: teste instável da `RecorrentesPage` estabilizado (espera curta sob carga); botão Entrar no celular era artefato da simulação (Gustavo testou no aparelho). Medido por script: nenhuma tela do app (15) nem do site rola de lado a 375px e a 768px; desktop igual. **Front 911**, lint+build. **Próxima ação:** Gustavo olhar no celular de verdade; conferir ao vivo Admin (conta admin), Onboarding (conta nova) e Home do site deslogado; decidir PR da `feat/responsivo`. Agentes: **perguntar antes de cada um** (Gustavo escolheu a opção c, 2026-10-05).
- **2026-10-05 (parte 4) — P2 do motor de contas fixas FECHADOS (decisão do Gustavo: fechar antes do merge) · `fix/bugs-dinheiro-p1`.** P2-1: gerador volta antes de ir ao banco quando em dia; GET da lista e job só leem conta fixa com cursor vencido; índice `IX_Transacoes_RecorrenteOrigemId_Data`. P2-2: conserto de legado ÚNICO por conta fixa (`Recorrente.RealinhadoEm`; nova nasce marcada) — varredura diária virou `IdsParaRealinharAsync` (normalmente vazia). P2-3: realinhamento e expansão uma conta fixa por vez, cada uma grava sozinha. P2-4: `Transacao.EditadaPeloUsuario` (editar transação/"Editar próxima") preservada ao alterar/realinhar; ocorrência excluída pelo usuário (status Cancelado) segura o período — mês pulado não volta. Migration `MotorContaFixaP2` APLICADA no Postgres local; os jobs rodaram contra o Postgres local por script descartável (SQL novo conferido, 6/6 ativas marcadas, 0 período com 2 cobranças). **Back 1357 · front 899**, lint+build. Achado novo P2 catalogado: excluir/editar compra no cartão pela tela de Transações não reconcilia a fatura (pré-existente). **Próxima ação:** a branch `fix/bugs-dinheiro-p1` está pronta pra PR/merge na `main` (Gustavo decide); depois 🔴 P0 responsivo. Pergunta dos agentes (a/b/c) segue em aberto.
- **2026-10-05 (parte 3) — os 3 P1 do motor de contas fixas FECHADOS · `fix/bugs-dinheiro-p1`.** P1-3 (commit `3795c0f`): faixa da `DataInicio` (hoje−12m…hoje+5a, fim ≥ início) back+front + teto de 400 datas por geração. P1-1+P1-2: `Transacao.Competencia` (`M2026-10`/`A2026`/`S{n}`) + índice único parcial, gerador deduplica por PERÍODO, alterar/realinhar recomeçam do início do período (não dobra nem perde o mês), `xmin` na `Recorrente` (409), `toggle?ativo=` (estado pedido), GET×GET descarta a perdedora, `ExpandirRecorrentesJob` grava por conta fixa, front esconde Pausar/Retomar enquanto a 1ª não volta. Migration `AddCompetenciaTransacao` APLICADA no Postgres local (backfill 18/18, 0 duplicado). Provado ao vivo: 5 Retomar/4 Salvar/2 inverter simultâneos → 1 vence, resto 409, nenhum período com 2 vivas (conta fixa de teste criada e excluída). **Back 1344 · front 899**, lint+build. **Próxima ação:** P2 restantes do motor (P2-1 desempenho, P2-2 realinhar só uma vez, P2-3 resto, P2-4 preservar edição do usuário) — decidir com o Gustavo se fecham antes do merge ou se a branch vai pra `main` e eles entram na fila; depois 🔴 P0 responsivo. Pergunta dos agentes (a/b/c) segue em aberto.
- **2026-10-05 (noite, parte 2) — bugs de dinheiro P1 · branch `fix/bugs-dinheiro-p1` (saiu da exp, que contém a main inteira).** Corrigidos: (1) Parcelamentos — Idempotency-Key nasce ao ABRIR a janela (criar/pagar antecipado/cancelar), retry reusa; (2) Contas Fixas — campo de valor com a máscara do app ("1.500" não vira mais R$ 1,50 escondido); (3) Família — renda dos OUTROS não sai mais da API (nem pro admin), só `RendaInformada`; (6) custo mensal/anual soma todas as frequências no servidor. **Back 1171 · front 891** verdes, lint+build limpos. **Bugs 4+5 também feitos (OK do Gustavo):** motor das contas fixas reescrito — regra única de datas `AgendaRecorrente` (respeita o Dia, mês curto), gerador único `GerarOcorrenciasAsync` (não repete dia já cobrado), pausar cancela previsões / retomar recomeça de hoje, excluir = exclusão lógica (`ExcluidoEm` + migration `AddExcluidoEmRecorrente` APLICADA no Postgres local), `ExecutarRecorrentesJob` só efetiva conta fixa ativa, `ExpandirRecorrentesJob` realinha legado, DTO `ProximaCobranca`, front lê a data sem fuso. Verificado ao vivo numa conta fixa de teste (criada e excluída). **PONTO VERDE: back 1313 (+138 do agente escritor-de-teste) · front 893 · lint+build.** ⚠️ **Revisão de segurança achou 3 P1 que BLOQUEIAM O MERGE** (ROADMAP, item "BLOQUEIA O MERGE"): dedupe por DATA e não por COMPETÊNCIA (troca de Dia/realinhar legado dobra ou perde o mês — e o job das 03:00 UTC roda no Postgres local), duplo clique em Retomar duplica previsões (sem row version/índice único), `DataInicio` sem faixa (DoS). **Próxima ação:** corrigir P1-1/P1-2/P1-3 nesta branch antes de qualquer merge; depois os P2. **Depois: 🔴 P0 RESPONSIVO de todas as telas** (decisão do Gustavo 2026-10-05 — plano no topo da Fila do ROADMAP: levantamento a 375px → shell + componentes do DS → telas uma por vez com ele vendo). **Pergunta em aberto ao Gustavo:** agentes em segundo plano — (a) nunca sem ele pedir, (b) só a revisão de segurança, (c) perguntar antes; até responder, NÃO disparar agente sem perguntar. ⚠️ Se a API ficar ligada à noite, o ExpandirRecorrentesJob (03:00 UTC) aplica o realinhamento com o P1-1 no Postgres local (dado de teste).
- **2026-10-05 (noite) — calendário estável + colunas dos movimentos + ESCALA DE TIPOGRAFIA CENTRAL.** (1) Reconciliação: calendário sempre com 6 semanas (dias do mês vizinho apagados, sem clique) e semanas de 51px → é ele quem dita a altura dos 2 cards; trocar de dia/mês não mexe mais a tela. (2) Movimentos com as MESMAS colunas de Transações (Descrição/Conta, Tipo, Data/Hora, Status, Valor; Categoria/Pagamento ocultas) — definição PRÓPRIA da tela (Gustavo: "são telas diferentes", nada de arquivo compartilhado). (3) **`--pontes-fs-*` em `tokens.css`**: escala (10…40) + papéis (rótulo, linha, secundário, corpo, controle, títulos, hero, valor-destaque, display…). DS (114) + telas (325 + os 46 fora da escala padronizados) migrados; zero px/rem nas telas; título de caixa = 16 (tabelas desceram de 18); trava `tipografiaTokens.test.ts`; vitrine em `/design-system` → Tokens; docs (DESIGN_SYSTEM/CLAUDE/STANDARDS/PROMPT). CSS morto da reconciliação apagado. Achado P2 catalogado: movimentos listam PREVISTO mas o saldo só conta efetivado. **Front 885 + build + lint** verdes. **Próximo (decisão do Gustavo): bugs de dinheiro P1** — Parcelamentos idempotency-key por envio, Contas Fixas "1.500"→R$1,50, Família expõe renda de todos, conta fixa pausada debita, dia errado, custo mensal; depois terminar a reconciliação (previstos, erro inline, "Calculando…", "+" do topo, galerias DEV, revisão de segurança do `fechar`).
- **PONTO VERDE (2026-10-05, fim do dia) — último commit `bb756e3`.** Layout FINAL da reconciliação: painel de conferir à ESQUERDA com "Conta a conferir" em cima; calendário (com "Hoje") à DIREITA; os 2 cards com a mesma altura (o destaque da diferença cresce o que falta). Tipografia do painel no padrão denso (título 13,5px, linhas/lista 12px, rótulo 11px, padding 14/16). **Front 878 + build · back 1166** verdes. Próximo: Gustavo testar o resto da tela; pendências dele: comparação do gráfico de saldo com o mês anterior (Dashboard) e separar data/hora do marco.
- **2026-10-05 (tarde/noite) — Reconciliação redesenhada ao vivo com o Gustavo** (galeria DEV `/reconciliacao-modelos` com modelos do painel + opções de onde escolher a conta; escolhidos: "resultado em destaque" + seletor em cima do calendário). Tela real: calendário à esquerda (+ "Conta a conferir" em cima + "Hoje"), painel à direita (linhas Calculado/Banco, campo do banco na linha com lápis, diferença em destaque com ícone do tamanho certo, ações do marco numa lista embaixo, sem selos). **Back 1166 · front 878** verdes. Próximo: o Gustavo testar o resto da tela no layout novo.
- **2026-10-05:** diferença da reconciliação = valor PRETO + traço embaixo + ícone (⚠ vermelho / ✓ verde) do tamanho "topo da letra → traço" (cor no número parecia negativo); bug de CSS que nunca deixava a cor aparecer corrigido. Fix: digitar e APAGAR deixava "0,00" e liberava salvar zero (`maskMoney(raw, anterior)` — apagar até zerar esvazia; digitar "0" segue "0,00"). Dashboard: card do gráfico de saldo não estica mais vazio (rosca não empilha entre 300–380px; gráfico preenche o card). Fraunces de volta SÓ no título da página (Navbar, `--pontes-font-marca`). **Front 839** verde.
- **`PontesTabela` modo "Mostrar mais"** (`carregarMais`, alternativa à paginação): movimentos da reconciliação em lotes de 20 no servidor + botão "Mostrar mais · faltam N". Cartão vermelho "Sobrou/Faltou" removido (a linha Diferença já diz). **Front 835** verde.

**Próxima ação concreta (quando voltar):**
0. 🟠 Decisão do Gustavo: como o gráfico de saldo compara com o mês anterior (ROADMAP, Pendências do Dashboard).
1. 🟡 P2 seed com efetivado no futuro (fix no `DevDataSeeder` + reseed — pedir OK antes de apagar o banco).
2. Próxima tela da fila de densidade: `/categories` (Gustavo pediu pra deixar pra depois — uma por vez, com ele vendo).
3. 🟡 P2: transferência exige hora mas o back descarta; editar lançamento sem hora força inventar hora; "Alterar valor" do saldo inicial erra por toast (→ inline); Dashboard usa `DateTime.UtcNow` no fechamento; Dashboard carrega todas as transações em memória.
4. PR #284 (draft) segue; merge só quando a frente de consistência fechar.

---

### 📌 Sessão 2026-09-30 (parte 3) — Empréstimos → PontesTabela + ações restauradas + decisão: RECONCILIAÇÃO é a fundação · branch `exp/consistencia-front`

**Ponto verde (vai virar commit).** Front 534 testes verdes (55 arquivos); back `EmprestimoServiceTests` 132 (14 filtros + 8 `TotalAPagarVencido`); tsc/lint/build limpos. Backend buildado em saída separada (API rodando trava o `.exe`/`.dll` — não é erro de código).

**Empréstimos migrado pro `PontesTabela` (só params, sem tabela na mão):**
- Filtro de direção foi pro popover **Filtros** (select, `neutro:"todos"`); filtros server-side novos: **situação** (ativo/quitado), **forma** (avista/parcelado), **faixa de valor** (restante), **período de vencimento** — cada um casado com a coluna (só aparece se a coluna estiver visível).
- Colunas na ordem `Empréstimo · Status · Forma · Início · Vencimento · Valor total · Pago · Juros · Restante`; **padrão mínimo** = Empréstimo/Status/Vencimento/Valor total/Restante (`colunasPadraoOcultas`), salvável por `id="emprestimos"`.
- **Hero** simétrico: A receber / A pagar cada um com **seu vencido** embaixo (âmbar se atrasado) + **Ativos · Quitados** (contagem neutra; saldo líquido foi tirado — paia pra quem só pega emprestado).
- Ações ricas de volta no ⋮ da lista (`mode="full"` + `mostrarDetalhe={false}`): Registrar pagamento / Marcar quitado / Vincular / Histórico / Arquivar-Desarquivar / Remover. **Arquivados** = botão só-ícone; **Consolidar** condicional. Título/subtítulo saíram (vêm do PontesTabela).
- Backend: `ListarAsync` += situacao/forma/valorMin/valorMax/vencDe/vencAte (leitura, isolado por `UsuarioId`, EF parametrizado); `ObterStatsAsync` += `TotalAPagarVencido`; controller + `emprestimoService.ts` (6º arg `filtros`) + hook wired.

**`PontesTabela` ganhou (genérico):** slot `ferramentas` (antes do criar) + `ferramentasFim` (depois do criar; o ⊞ colunas agora é o ÚLTIMO). `ActionIcons` ganhou `mostrarDetalhe`.

**Transações — ações restauradas** (tinham sumido junto com o `TransactionTable` deletado): **Compartilhar com família · Atribuir a dependente · Definir rateio** + 3 modais + handlers (port fiel do `main`; serviços de `familiaService` estavam intactos, backend intacto). Gating: só **despesa real** (`tipo===1 && !ehTransferencia && !ehPagamentoFatura`). Recarrega após mutação; rateio personalizado valida "soma 100%" inline (não toast). Navbar: **breadcrumb voltou** (title 22→20).

**Removido:** Demo Empréstimos (rota/nav/página).

**🎯 Decisão estratégica (Gustavo):** a fundação que falta é a **RECONCILIAÇÃO** (nome escolhido — "conferência de caixa" era só exemplo). Sem ela o saldo é só soma de lançamentos, sem âncora → sempre parece errado; polir front em cima disso é bater cabeça à toa. É o **P0 real**. **Sequência: commitar este ponto verde primeiro, DEPOIS atacar a reconciliação em frente limpa.**

**Feito nesta parte:** rename `conferencia`→`reconciliacao`; **transação com hora** (campo data+hora, default agora); **backend da Reconciliação COMPLETO e verde** — entidade `ReconciliacaoSaldo` (marco: conta/data-hora/declarado/calculado/diferença/tipo baseline|verificação/ajuste vinculado/soft delete), enum `TipoMarcoReconciliacao`, `Transacao += EhAjusteReconciliacao`, migration `AddReconciliacaoSaldo` **aplicada** no Postgres, `ReconciliacaoService` (CalcularSaldoAté / CriarMarco com ajuste / Listar / Remover), controller `/api/reconciliacao/...`, DI, DbContext. Modelo: saldo segue sendo a soma (RegrasFinanceiras intacto); a diferença é fechada por um lançamento de **ajuste** (`EhAjusteReconciliacao`). **Gate de segurança rodado (via general-purpose, o `auditor-seguranca` não existe nesta sessão): SEM P0/P1** — isolamento por usuário + DonoRecursos em todo método, 404 pra alheio, idempotência atômica, FinancialEventLog, LGPD ok. Fixes P2/P3 aplicados: corrida→replay (não 500), 409 em chave com dados diferentes, validação de input (saldo/data/observação), auditoria do delta na remoção. **Testes: 94 no `ReconciliacaoServiceTests`** (verde) + transação-com-hora (front 543).

**TELA REAL da reconciliação — FEITA.** `/demo-reconciliacao` virou `/reconciliacao` (real, na nav Principal, ícone `Scale`; demo removida + pasta `DemoPadrao` apagada). `reconciliacaoService.ts` (listar marcos / saldo-calculado preview / criar com Idempotency-Key / remover), `types/Reconciliacao.ts`. Página: **começa no banner** (sem título de página — o header já mostra), select de conta no banner, calendário do mês com marcos, clicar dia → busca saldo calculado real, painel conferir (declarado × calculado × diferença → grava marco / "Definir saldo inicial" na 1ª (baseline) / "Ajustar" / "Lançar o que falta"→/transactions), remover marco com PontesDialog. **Design denso** (fonte/espaçamento menores — pedido do Gustavo: telas estavam grandes demais). Verificado no browser ao vivo. Testes: **24 na ReconciliacaoPage**; front total **567 verde**, build OK, lint 0.

**Reconciliação — polida (iteração de UX + saldo inicial):** hero **grande em destaque** (igual Transações — o hero é a exceção "grande"; resto denso), select de conta numa **toolbar abaixo do hero** (fora do banner), painel **abre em HOJE** (nunca vazio, calcula sempre — corrigido bug de troca de conta com marco hoje). **Saldo inicial da conta agora aparece como o marco BASELINE** (derivado, não removível): `ReconciliacaoSaldoDto += Derivado`; `ListarAsync` sintetiza o baseline a partir da `Transacao EhSaldoInicial` (Ativo+Executado) quando não há baseline real. Verificado ao vivo (conta com saldo inicial R$5.000 → dia 28 verde no calendário + "confere até 28/09"). Testes: back **110** (ReconciliacaoServiceTests) + front **31** (ReconciliacaoPage); front total 574.

**FASE 0 (fundação) — falta só varrer os bugs de dinheiro** (ver ROADMAP §1): idempotency-key do Parcelamento, conta fixa (valor "1.500"→1,50 / dia errado / pausada debita), dashboard "Saiu" ignora cartão, fatura não lista parcelas, hora em UTC.

**Próxima ação concreta:** gravar o **"caminho até pronto"** (fases 0→5, Monarch+família) no topo do ROADMAP, e começar a varrer os bugs de dinheiro da FASE 0. **Dívida P3 catalogar** (achados do escritor na reconciliação, não bloqueiam): tipo de marco pra dia anterior ao baseline sempre vira Verificação; corrida de clique no calendário (getSaldoCalculado sem cancelar o anterior); hora do marco de hoje recalculada no gravar; replay não compara Resolucao/Observacao; ticks do DataHora vs µs do Postgres; NU1903 (Newtonsoft.Json no projeto de teste).

---

### 📌 Sessão 2026-09-30 (parte 2) — Transações = EXTRATO DE CAIXA + tela real promovida + chrome denso · branch `exp/consistencia-front`

**NÃO está na `main`.** Continuação na branch **`exp/consistencia-front`** (base `821b063`; commit desta sessão no fim do bloco). **Build verde** (front `npm run build` + back `dotnet build` 0 erros). Testes desta rodada delegados ao `escritor-de-teste` (front `TransactionsPage` + back `apenasCaixa`/`natureza`/`meioPagamento`) — conferir resultado.

**Modelo mental (regra pro Gustavo e pro modelo barato):** `PontesTabela` (`src/components/pontes/data/`) é O componente de tela-de-lista. Aplicar = **só passar params**. NÃO redesenhar por tela. (memória [[feedback_pontestabela_componente_params]])

**Modelo de negócio travado — Transações = EXTRATO DE CAIXA (linha do tempo do que mexe no saldo):**
- **Entra:** movimento de conta (pix/débito/boleto/salário), **pagamento de fatura**, **transferência** entre contas próprias (2 pernas, neutras).
- **Sai (fora):** compra no **crédito** (tem `CartaoCreditoId`, sem `ContaId` → vive na aba Cartão/fatura); **saldo inicial** (equity, não é movimento).
- **Dois eixos separados** (a coluna antiga misturava): **Tipo** (natureza: Entrada/Saída/Transferência/Pagto. fatura) × **Status** (Previsto/Efetivado). "Pago"/"Recebido" = Executado + tipo, NÃO é status.
- Enum: **TipoTransacao Despesa=1 / Receita=2**; **StatusTransacao Previsao=0 / Executado=1 / Cancelado=2** (Cancelado = soft-delete, não aparece).

**Feito no componente (vale pra todas as telas):**
- Toolbar no cartão, célula identidade empilhada, filtro em popover, paginação numerada, linhas densas (fase 1, já era).
- **Colunas com "Padrão de exibição"**: default = mínimo (`colunasPadraoOcultas`), **Salvar padrão** + **Voltar ao padrão** (localStorage por `id`). Precisa de `id` na tela pra aparecer.
- **Filtros aparecem conforme as colunas visíveis** — cada `PontesFiltroAvancado` tem `coluna?`; se a coluna está oculta, o filtro some (sem `coluna` = sempre).

**Feito (telas / backend):**
- **Transações real (`/transactions`)**: a demo virou a real (component `TransactionsPage` reescrito com PontesTabela). `apenasCaixa: true`. Hero = Saldo em conta (soma `getContas`) + Entrou/Saiu **caixa** (`entradasCaixa`/`saidasCaixa`). Colunas Tipo+Status separadas, hora na Data quando houver. Criar = evento global `transactionCreated`; editar/excluir no ⋮.
- **Removidos:** `DemoTransacoesPage`, `TransactionTable` (+teste), e a **tela/rota/aba Transferências** inteira (criar transferência = tipo dentro de "Nova transação"; ver = no extrato filtrando Tipo). `transferenciaService` reduzido a create/delete.
- **Backend** (`TransacaoService.ListarAsync` + `TransacoesController` + `TransacaoDto`): params `apenasCaixa`, `meioPagamento`, `natureza` (entrada/saida/transferencia/fatura); DTO expõe `EhTransferencia`. `transactionService.ts` manda os params.
- **Chrome do shell** mais denso: sidebar 208 / rail 64 **centralizado** (logo/ícones/avatar não deslizam ao colapsar), header 60, sidebar **colada na borda** (shell `padding-left:0`), user chip "PrimeiroNome · Free" + seta pra baixo, menu do usuário abre largura normal + fecha ao sair o mouse (`closeOnMouseLeave` no PontesPopover). Title 22 sem breadcrumb.
- **LoginPage**: Ana Paula removida do fallback estático de contas DEV.

**Pendências (fila) — 3 frentes grandes, UMA POR SESSÃO (detalhe no ROADMAP):**
1. 🟠 **Conferência de caixa / consolidação** (spec `docs/features/reconciliacao/spec.md` — **multi-marco datável**) — resolve o "dado viajado" do saldo. **Atacar primeiro.** **Mockup pronto** em `/demo-reconciliacao` (`DemoReconciliacaoPage`, dados fake): hero (saldo + "confere até"), **calendário dos marcos** (dias conferidos verde ✓ + saldo, ajuste amber, "a conferir" tracejado, clicar dia → conferir), painel Conferir (declarado × calculado × diferença → grava marco / lança / ajusta). **Design em andamento** (Gustavo reagindo). Antes de codar o real, resolver: (a) marco = **verificação** × **baseline**; (b) **transação precisa de hora** (campo data+hora com default = agora). Backend: tabela `ReconciliacaoSaldo`, `Transacao += EhAjusteConferencia`, migration, `ReconciliacaoService`, gate `auditor-seguranca`.
2. 🟡 **Forms de criar/editar em PÁGINA, não popup** (Gustavo odeia editar em modal).
3. 🟡 **Migrar telas de lista reais restantes** (Recorrentes, Importação, Parcelamentos, Admin) — manual, uma a uma.

**Outras pendências:** apagar 150 `PAGTESTE` da conta `verificacao.p1` (Postgres local); virar PR pra `main` quando validar; **investigar** se o service worker do PWA cacheia GET da API (dado financeiro velho quando a API cai — não confirmado).

---

### 📌 Sessão 2026-09-28 (fecha em ponto verde) — dogfooding do cartão/parcelamento + padrão de telas · #270–#279

**Mergeado na `main` (`8cb8f4f` + docs), CI verde em todos:**
- **#270/#271** fila única no topo do ROADMAP + resultado da verificação manual dos P1 (feita no navegador interno com uma **conta de teste local** `verificacao.p1@pontes.test` — credenciais NÃO versionadas; dados fictícios no Postgres local).
- **#272** fatura sem "pago" por compra, trava de valor acima do que falta, `dataLocalISO()` (formulários abriam com a data de amanhã depois das 21h), caminho do topo com o nome do item no detalhe, parcelamento cancelado aparece como cancelado + restante sem parcela cancelada.
- **#273** Parcelamentos mora dentro de **Cartões de Crédito** (abas; `/parcelamentos` redireciona). Pesquisa Pix no crédito em `docs/features/parcelamento/pix-no-credito.md`.
- **#274** sem subtítulo explicativo nas telas internas; Metas/Limites com título certo na barra.
- **#275** 1ª parcela na fatura que **fecha** no mês escolhido (piso = 1ª fatura não vencida) + `PontesMonthInput` no DS.
- **#276** parcelas de parcelamento aparecem na lista da fatura.
- **#277** **limite com regra única** (usado = o que falta pagar em todas as faturas; barra mexe) + "já paga" pelo restante (fatura não trava mais) + migration **só de dados** `BackfillCreditoRecorrenteCartao` (faturas não pagas e a vencer).
- **#278** ROADMAP: vídeo promocional no lançamento (repositório "brag").
- **#279** **padrão de telas fase 1**: `PontesPageHeader`, `PontesToolbar`, `PontesRowActions` (⋮), Popover com teclado, Modal/Dialog pegam o foco; Contas Fixas (⋮, Ativas|Encerradas, busca no servidor, **cancelada ≠ pausada**) e Transferências.

**Diagnósticos que ficaram registrados:** MFA "lembrar 30 dias" não é bug do servidor — o painel de navegador do app Claude perde os cookies entre sessões (Gustavo confirmar no Edge/Chrome). Saldo inicial não entra em "Entrou" de propósito.

**Próxima ação:** a **🎯 Fila** do `ROADMAP.md` — item 1 é o **padrão de telas fase 2** (Parcelamentos, Empréstimos, Transações…). Decisões pendentes (uma de cada vez): dashboard "Saiu" com cartão; Empréstimos "Arquivados" → "Encerrados"; parcelamento no dashboard; dia 29-31; roster; banco pra importação.

**Ambiente:** `main` limpa, todas as branches mergeadas apagadas (local e remoto). API e front de dev **parados**. ⚠️ Sobrou a pasta `.claude/worktrees/wf_b8c402d4-d89-1` presa por um processo do Windows (já fora do git) — apagar depois de reiniciar (sem junção de `node_modules` dentro; conferido).

---

### 📌 Sessão 2026-09-27 (parte 2) — os 3 P1 da auditoria · #267, #268, #269

Feitos por workflow (3 builders em worktree → revisor adversarial → correções → 2ª revisão até ficar `ok`), mergeados em sequência:
- **#267** refresh **single-flight** no front + janela de 30s (mesmo dispositivo) na reuse-detection; a aba que perde a corrida recebe 401 `REFRESH_EM_CORRIDA` e só refaz a request. Log de segurança em todo uso da janela.
- **#268** pagar fatura **idempotente** (tabela `RegistroIdempotencia` com índice único, chave obrigatória, replay com outros dados → 409) + **`xmin`** na `Fatura` (409 em conflito) + fatura de outro usuário → 404 + aviso com a mensagem do servidor no modal.
- **#269** `Services/RegrasFinanceiras.cs`: total/restante da fatura sem parcela cancelada (5 cópias → 1) + saldo único agregado no banco (4 → 1) + **fatura travada após cancelar parcela** (reconciliação, atraso/"Vencida" pelo restante, juros sobre o restante) + jobs de fatura refazem uma a uma no conflito de `xmin`. Inclui a consolidação de docs (ROADMAP, ARQUITETURA, CLAUDE, DATABASE, FLOWS, regras do cartão).

**Próxima ação:** seguir a **🎯 Fila no topo do `ROADMAP.md`** — ordem de ataque, decisões pendentes do Gustavo (uma de cada vez), verificação manual pendente e gate de produção, tudo num lugar só. Item 1: CSRF antes do CORS no `Program.cs`.

---

### 📌 Sessão 2026-09-27 (fecha em ponto verde) — avaliação de arquitetura + P0s + fixes de dogfooding · 7 PRs mergeados

**Mergeado na `main` (`bdaa51d`), CI verde em todos:**
- **#259** docs Monarch · **#260** login: "← Voltar ao login" nas etapas MFA/reativação · **#261** empréstimos: lista enxuta → detalhe rico `/emprestimos/:id`.
- **#262** o CI **passa a rodar os testes de backend** — a `.sln` não tinha o projeto de testes, então o check "Backend (.NET 10)" ficava verde sem testar nada. + teste instável do Dashboard (corrida saudação × dados).
- **#264** 🔴 **P0 segurança** — Recorrente/Transação/Meta aceitavam conta/cartão/categoria de **outro usuário** (a Recorrente lançava no saldo da vítima). Helper `Services/DonoRecursos.cs`; API **nega por padrão** (`FallbackPolicy` + `[AllowAnonymous]` explícito nos públicos); Bancos: ler exige login, escrever só admin. +24 testes cross-user/HTTP.
- **#263** cartão: a fatura **sempre abre no mês de hoje** (mesmo sem fatura) e navega mês a mês, pra trás e pra frente. `ciclosFatura.ts` espelha `FaturaService.CalcularPeriodo`.
- **#265** parcelamentos: card empilhado reorganizado, sem a tag "Compra Parcelada"; limite estourado vira **aviso** amarelo com a mensagem do servidor (`utils/apiError.ts`, toast "Aviso").

**Avaliação de arquitetura** (6 agentes): monólito em camadas + transaction script + domínio anêmico, nota **5,5/10**, **não reescrever**. Registro completo em `docs/ARQUITETURA.md`; achados no ROADMAP (seção "Auditoria de arquitetura").

**Próxima ação:** os 3 P1 — ✅ feitos na parte 2 (acima).

**⚠️ Aprendizado (worktree):** worktree com `node_modules` ligado por junção → remover a junção com `cmd /c rmdir <caminho>` **antes** do `git worktree remove` (remoção recursiva pode seguir a junção e apagar o `node_modules` real).

**Ambiente:** `main` limpa em `bdaa51d`; API e front de dev parados; nenhum worktree de trabalho aberto além do de docs.

---

### 📌 Sessão 2026-09-20 (fecha em ponto verde) — Análise do concorrente Monarch (docs-only) · PR #259 aberto

Sessão **não-código**: engenharia reversa completa do **Monarch Money** (líder US de finanças de casal). Conta de teste paga (trial Core + **Plus ativado**), dados fictícios inseridos, zero compra além do trial. Tudo em `docs/concorrentes/monarch/` na branch `docs/concorrente-monarch-onboarding` (**PR #259, docs-only**).

**Feito:**
- **16 relatórios por página** (`docs/concorrentes/monarch/paginas/`) — Core + Plus, tela a tela: Dashboard, Accounts, Transactions+modal, Cash Flow (Sankey), Reports, Budget, Recurring, Goals (Save up+Pay down+Allocate), **Forecasting** (setup, premissas, 9 eventos+params, cenários), Investments (Holdings+Advanced), AI Assistant, Household/casal, Settings (todas sub-páginas), Advice.
- **Backlog priorizado** (`docs/concorrentes/monarch/roubar-priorizado.md`) — placar nós×Monarch + P1-P3 cruzado com scan do nosso código.

**Achado central:** já **estamos à frente** no fosso casal (rateio+acerto+dependentes; Monarch nem tem). Atrás em: Metas→alocação, Recorrente (3→11 freq), Sankey, Merchant, Rules, IA, Forecasting.

**Próxima ação (código) — inalterada da sessão anterior + do backlog Monarch:**
- **Recorrente 3→11 frequências** (gap fácil, alto ROI) OU **Metas: modelo de alocação + meta-por-data** (maior valor, resolve P2 do ROADMAP).
- Segue valendo: migrar Transações+Empréstimos pro `PontesSegmented`; tela "Dispositivos confiáveis"; `BancosController` sem `[Authorize]` na escrita.

**Pendências do Gustavo (não-código):** (1) cancelar trial do **Plus** antes de cobrar ($199,99/ano) se não for manter; (2) dados de teste na conta Monarch podem ser apagados; (3) mergear #259 quando quiser.

**Ambiente:** main inalterada (`b482c93` + PRs #253-#258 já mergeados na sessão anterior desta data). Working tree limpo, PR #259 aberto (docs). Nenhum código tocado nesta sessão.

---

### 📌 Sessão 2026-09-19 (fecha) — 3 PRs empacotados mergeados na `main` (`b482c93`) · zero PR aberto

Sessão de fechamento: trusted-device, login-experience e UX das toolbars/DS entraram na main, todos verdes no CI.

1. **#249 trusted-device MFA** (era `feat/trusted-device-mfa`) — checkbox opt-in "confiar neste dispositivo 30d" pula o 2º fator (NUNCA a senha) só pra a conta DONA do device (anti-cross-account, fail-closed). `TrustedDevice` + cookie `td` + revogação em troca/reset de senha, desativar MFA, marcar exclusão. Back 675/675, front 366/366.
2. **#252 login-experience** (era `feat/login-experience`) — "manter-me conectado" (cookies persistentes × sessão OWASP + **fix do silent refresh no `/auth/me`**) + roster "escolher conta" (chooser tipo Google, cookie opaco `rd` SameSite=Strict, e-mail mascarado + reveal deliberado, `ContaLembrada` só hash). Back 691/691, front 368/368.
3. **#251 ux-toolbars-ds** — Empréstimos toolbar em linha única (igual Transações, alturas 42px) + categoria no drawer de filtros das Transações + chip Tudo/Receitas/Despesas vira view-toggle (não dispara "Limpar"). Primitivos DS novos: `PontesSegmented` + `PontesStack`/`PontesInline`.

**⚠️ Aprendizado (processo):** squash-merge de PR **empilhado** quebra o PR de baixo — o GitHub FECHA o de baixo ao deletar a branch base, e o branch fica com os commits soltos conflitando com o commit squashado (`CONFLICTING` → CI nem roda). Fix aplicado: recriar o PR (#250→#252) + `git rebase --onto main <commit-que-virou-squash>` pra dropar os commits já absorvidos. Lição: evitar PR empilhado, ou mergear o de baixo com o de cima ainda aberto e retargetar ANTES de deletar a base.

**Feito nesta continuação:**
- ✅ **Fix P1 `pagar-antecipado`** (500 pós-débito) — `MontarPagarResultadoAsync` lia a Fatura por Include cíclico sob `AsNoTracking` (`VerifyNoCycles` estourava após o commit). Fix: Fatura numa query própria (raiz `Faturas`). **12 testes novos** de `ParcelaTransacaoService` (pagar/cancelar/idempotência/IDOR/saldo + **regressão do 500**, provada falhando contra o bug). Back **704/704**. Branch `fix/pagar-antecipado-500`. _(Os 23 testes do fan-out se perderam — worktree limpa; reescritos.)_

**Próxima ação:**
- **Migrar Transações + Empréstimos pro `PontesSegmented`** — o componente entrou (#251) mas as telas ainda usam CSS duplicado (`.tipoChips`/`.segmented`). Plugar + apagar a duplicação fecha o refactor de consistência.
- **Trusted-device — tela "Dispositivos confiáveis"** (Configurações): listar/revogar 1/esquecer todos (P1, `GET/DELETE /auth/trusted-devices`, anti-IDOR). Par imediato da parte do login.
- **P2 `BancosController` sem `[Authorize]`** na escrita (fix trivial, junto do próximo toque em auth).

**Ambiente:** main `b482c93`, working tree limpo, zero PR aberto. API :5293 reiniciada (`ba6mrb8vn`) — aplica migrations `AddTrustedDevice`+`AddRosterEManterSessao` no dev DB no boot. Postgres up.

---

### 📌 Sessão 2026-09-19 (cont.) — Testes de 5 services (#248, multi-agente) + trusted-device MFA (parte do login)

1. **Fan-out multi-agente de testes (#248, MERGEADO)** — 6 `escritor-de-teste` em worktrees isoladas cobriram **5/6** services sem teste dedicado (`Fatura`/`Categoria`/`Banco`/`FinancialEventLog`/`FamiliaPermissoes`, +115 testes). O fan-out pescou **2 achados reais** (confirmados na fonte, catalogados no ROADMAP): 🔴 **P1** `ParcelaTransacaoService.PagarAntecipadoAsync` estoura 500 DEPOIS de debitar (ciclo de Include `Fatura→ParcelasTransacao` sob `AsNoTracking`); 🟡 **P2** `BancosController` sem `[Authorize]` na escrita. `ParcelaTransacaoService` (23 testes prontos) segurado pra entrar junto com o fix do bug (não cravar 500 como "esperado").
2. **Trusted-device MFA — PARTE DO LOGIN (branch `feat/trusted-device-mfa`)** — spec `docs/features/auth/trusted-device.md`. Entidade `TrustedDevice` + migration `AddTrustedDevice` (aplicada no Postgres dev; migration só cria a tabela, sem phantom timestamptz) + cookie httpOnly `td` (30d) + **skip do 2º fator no login só pra a conta DONA do device** (anti-cross-account, fail-closed) + criação no verify quando o checkbox opt-in (desmarcado por padrão) é marcado + revogação em troca/reset de senha, desativar MFA e marcar conta pra exclusão. Nunca pula a senha. **Back 675/675, front 366/366**, builds ok.

**Próxima ação:**
- **Abrir PR do `feat/trusted-device-mfa`** e esperar CI.
- **Trusted-device — tela "Dispositivos confiáveis"** (Configurações): listar + revogar 1 + esquecer todos (`GET/DELETE /auth/trusted-devices`, anti-IDOR). Par imediato da parte do login.
- **Fix do P1 do pagar-antecipado** + entrar os 23 testes do `ParcelaTransacaoService`.

---

### 📌 Sessão 2026-09-19 — Multi-conta: fecha vazamento em navegador compartilhado (PR #246) + roster de agentes

1. **Fix do vazamento multi-conta (P0/P1) — PR #246** (branch `fix/multiconta-logout-vazamento`). Furo: sair/relogar como outra pessoa no mesmo navegador deixava as contas anteriores acessíveis. **Reproduzido e validado fechado ao vivo** (switch pra conta anterior: era 200, agora 401). Correções: `/auth/login` + `/auth/mfa/verificar-login` **sempre começam limpos** (revogam anteriores); novo **`POST /auth/add-account` `[Authorize]`** pro "adicionar conta"; **`logout()` async** com `await` no `/auth/logout-all` (revoga no servidor antes de limpar). Achado do **P1 pelo agente `auditor-seguranca`** (a heurística `IsAuthenticated` tinha brecha). Testes: `AuthHttpTests` 12/12 (+ regressão do P1), front multiconta 5/5, front 365/365, **back 562/562** (flakiness resolvida por um fork: `[Collection("PasswordHasherEnv")]`).
2. **Roster multi-agente montado** (mergeado #244): `.claude/agents/` builder + auditor-seguranca + escritor-de-teste. Regra: multi-agente **só pra tarefa grande**, Claude orquestra (`PROMPT_NOVA_SESSAO.md` §8.7).
3. **.NET 10** já na main (#243).

**Próxima ação:**
- **UI:** `PontesEmptyState` deve ocupar largura total + ícone/texto centralizado (pedido 2026-09-19; hoje `max-width:480px` fica estreito) — afeta ~8 telas (Cartões/Transferências/Parcelamentos/Contas/Categorias/Famílias/Metas/Limites), fix no componente DS.
- **Auth (gated no fix acima):** trusted-device MFA (P1) + roster "conta reaparece" (P1) — pesquisas prontas no ROADMAP.
- **Produto:** Conferência de caixa (P1, tem spec).
- Limpar contas de teste `teste-a`/`teste-b` do dev DB.

---

### 📌 Sessão 2026-09-17b — Upgrade .NET 8 → 10 (branch `feature/upgrade-net10`, EM PR) · verde local: back 559/559, 0 warnings

Migração de plataforma, precedida de **auditoria de risco multi-agente** (5 frentes). Detalhe em `docs/history/ROADMAP_CONCLUIDO.md`.

1. **.NET 8 → 10** — TFM API+Tests `net10.0`; pacotes Microsoft →10.0.x; **Npgsql EF →10.0.3** (evita bug #3699 do 10.0.0); Asp.Versioning →10.2.1; Serilog.AspNetCore →10; Hangfire →1.8.24; HealthChecks.Hangfire →9; Test.Sdk →18.10.0 + xunit →2.9.3 + runner →4.0.0. **Dockerfile** (`sdk`/`aspnet` → `10.0-alpine`) + **CI** (`dotnet-version` →`10.0.x`, label "Backend (.NET 10)").
2. **Swagger** — Swashbuckle →10.2.3 (net10-nativo); reescrito `AddSecurityDefinition`/`AddSecurityRequirement` pro Microsoft.OpenApi 2.x (namespace achatado + `OpenApiSecuritySchemeReference` + factory). **Fechada vuln HIGH** `Microsoft.OpenApi` 2.0.0 (removido o `AspNetCore.OpenApi` dead-ref; 10.2.3 traz OpenApi 2.7.5).
3. **Gate de migração:** `AppDbContextFactory` não setava `EnableLegacyTimestampBehavior` no design-time → EF10 gerava migration fantasma reescrevendo TODA coluna de data (perigoso). Fix: switch no static ctor → `has-pending-model-changes` **vazio**, zero mudança de schema.
4. **`CustomWebApplicationFactory`** — fix EF Core 9/10 ("Only a single database provider"): remove `DbContextOptions<>` **e** `IDbContextOptionsConfiguration<AppDbContext>` antes do InMemory.
5. **Bug pré-existente corrigido (revelado pelo analyzer AV0014):** `ImportacaoController` tinha `[ApiController]`/`[Route]`/`[Authorize]` na classe do form → rota resolvia em `/preview` (importação quebrada) e sem `[Authorize]`. Atributos movidos pro controller + teste de regressão. Removido código morto `DatabaseProvider.cs`.

**⚠️ Verificação pendente:** smoke em **Postgres real** (MigrateAsync/Npgsql 10.0.3/timestamp) NÃO rodou local (Docker fora do ar) → **cai no job E2E do CI** (Docker+Postgres). Acompanhar o CI do PR.

---

### 📌 Sessão 2026-09-17 — git limpo + P2 MFA download · verde: back 558/558, front 363/363 · main `42d45d5`

Sessão curta de higiene + 1 quick-win.

1. **Git arrumado:** commit do STATE que estava preso local (main protegida) virou PR **#240** e mergeou. Branch órfã `feature/emprestimo-compartilhado` deletada (remota+local) após confirmar que o conteúdo já estava na main (labs superados pelo #236; deploy Fly.io abandonado → Hostinger; /privacidade + Hangfire + Dockerfiles conferidos na main). 3 branches merjadas (#237/238/239) já estavam deletadas no remoto — só refs stale, limpos por prune. Estado: só `main`, working tree clean.
2. **P2 MFA baixar backup codes** (#241) — pedido do Gustavo. Ao ativar o MFA, os backup codes agora são **salvos automaticamente** num `.txt` (`pontes-codigos-recuperacao.txt`, Blob + `<a download>`) + botão "Baixar .txt" + nota; mantém "Copiar códigos". `ref` evita download duplicado. Front-only (`MfaSection`). Novo `MfaSection.test.tsx` (4). CI verde (Backend/Frontend/E2E).

---

### 📌 Sessão 2026-09-15/16 — TUDO MERGEADO na `main` (`dcaff66`) · verde: back 558/558, front 356/356

Todas as frentes viraram PR mergeado (não há mais branch solta, exceto a órfã de limpeza):

1. **Empréstimos** (#236) + **hospedagem beta** decidida: **mensal KVM1** (~R$53→88), sem lock; migrar pra 24m quando entrar grana (`docs/features/hospedagem-beta/decisao.md`). **P1 Docker** verificado — era stale (guard idempotente já estava na main).
2. **P1 auditoria server-side** (#237): auditadas 8 superfícies; **só o Admin** furava. Usuários/LGPD/Auditoria → `PagedResult` + busca/paginação server-side.
3. **P1 multi-conta** (#238) — o "login simultâneo" que o Gustavo pediu, agora funciona de verdade:
   - **Fase 1:** `/auth/switch` server-authoritative (accountId só seletor; autoridade = cookie httpOnly `rt_<slot>`; anti-IDOR); `logout`/`logout-all`; **guarda multi-aba** (`X-Active-Account` + `ActiveAccountGuardMiddleware` → 409); **silent refresh** (interceptor axios); **cap 5 contas**; CSRF 7d + `FixedTimeEquals`.
   - **Fase 2:** **reuse-detection** (RFC 9700 §4.14 — `FamiliaId`/`SubstituidoPorId`; replay → mata a família + alerta admin); tela **Sessões e dispositivos** (Configurações).
   - **Revogação INSTANTÂNEA:** access token 60→**15min** + claim `sid` no JWT + `OnTokenValidated` (valida por request se a sessão está viva + usuário Ativo → 401 na hora). Doc `docs/features/auth/multi-conta.md`.
4. **P1 testes HTTP de integração** (#239): `CustomWebApplicationFactory` (InMemory + boot gateado por `ASPNETCORE_ENVIRONMENT=Testing` — pula migrations/seeders/Hangfire/rate-limiter) + **8 testes** (`AuthHttpTests`: 401/CSRF-403/login/MFA/IDOR-404/**revogação instantânea**/**guarda 409**).

**⚠️ Pré-condição de PROD (gate 1.0.0, NÃO é código):** rotacionar `Jwt:Key` (quem tem a chave forja sessão de qualquer conta).

**Próxima ação (P1 restantes):**
- **Conferência de caixa** (saldo declarado × calculado; tem spec em `docs/features/reconciliacao/spec.md`) — **próximo recomendado**.

**Ambiente:** API :5293 **parada**; Postgres no ar; front preview pode estar no ar. Migrations aplicadas no dev DB (incl. `AddSessaoTrackingToRefreshToken`).

---

### 📌 Resumo da sessão 2026-09-13/14 (branch `feature/emprestimos-ui` → MERGEADA na main via #236 · verde: back 534/534, front 349/349)

**Módulo Empréstimos essencialmente fechado.** Bancada B eleita e **promovida a tela real**.

1. **B → `EmprestimosPage.tsx` real** — a página real agora É o layout B (tabela densa, kebab ⋮,
   wizard, hero, busca/direção server-side), via `useEmprestimosLogic` + `EmprestimosLabModals` +
   `EmprestimosLabItemParts`. **Apagados** Lab A/C/D + `EmprestimosLabNav` + rotas `/emprestimos-lab-*`.
   Teste reescrito pra nova UI (16 testes).
2. **Wizard 3 passos** (Novo empréstimo + Propor consolidação) com `PontesStepper` do DS, validação por passo.
3. **Empréstimo bancário — Fase 1 (tudo manual):** `Emprestimo.BancoId` (FK opcional) + enum
   `OrigemEmprestimo {Manual,OpenFinance}` + migration; no wizard, **"Com quem é? [Uma pessoa | Um banco]"**
   — banco ⇒ só "peguei emprestado" (UI + backend + testes); `PontesBankBadge` na lista.
4. **Hero co-igual** A receber (verde) / A pagar (vermelho) — não assume mais que todo mundo tem a receber.
5. **Toggle "Arquivados"** na toolbar (server-side, `mostrarArquivados`); kebab do à vista ganhou "Ver detalhe".
6. **Perf:** índice `(CriadoPor, Quitado, DataVencimento, DataInicio)` — antes o filtro de tenant caía em
   **seq scan O(N)** (CriadoPor sem índice); agora BitmapOr → **O(K)**. Migration `AddIndexEmprestimoCriadoPor`.
7. **fix DS `PontesField`** — helper entra no fluxo (não gruda no campo de baixo). Vale em todo form.

**Pesquisa + regras (docs):** `docs/features/emprestimo-bancario/pesquisa-openfinance.md` (Open Finance
entrega taxa/parcelas/saldo, mas acesso só via agregador Pluggy/Belvo — Fase 2) e **`regras.md`** (fonte da
verdade das regras de empréstimo). Decisões: **tudo manual na Fase 1**; **taxa é dado dinâmico, nunca
chumbada**; ideia de monetização grátis-manual / pago-integração (gancho = campo `Origem`).

**Próxima ação:**
- **P1 (Gustavo pediu):** auditar TODAS as tabelas/listas do app → busca/filtro/paginação server-side
  (Transações, Admin, Recorrentes, Parcelamentos, Cartões, Categorias/Bancos, Famílias). Ver ROADMAP.
- **Gaps abertos:** recobrir testes profundos de modal (P3); keyset pagination se escalar (P3).
- Apagar branch órfã `feature/emprestimo-compartilhado`. Pushar `feature/emprestimos-ui` quando decidir.
- App no ar: API :5293 (health 200) + front :5173. Dados de teste no dev DB (Marina x3 + NU bancário).

---

### 📌 Resumo da sessão 2026-09-12 (branch `feature/admin-beta-gate`, MERGEADO na main via PR #235 · verde: back 526/526, front 369/369)

19 commits (`bd3f27a` → `107df08`). Ponto verde. Detalhe de cada item nos blocos abaixo.

1. **Store Marco Civil** (`bd3f27a`) — `RegistroAcesso` (sem FK, sobrevive à purga LGPD) + captura de
   IP no login + retenção 6m (job) + purga. Fecha a pendência P1 pré-produção do Módulo C.
2. **Notificações do admin** (`67c0d75`) — stream próprio (`NotificacaoAdmin`), separado do financeiro
   (bug reportado: sino financeiro vazava no admin). 3 fontes: novo cadastro / segurança / LGPD.
3. **Mascaramento de PII no admin** (`7573046`) — olhinho de revelar (`useMaskData`, default mascarado);
   e-mail mascarado nas 4 telas admin. Antes: pesquisa LGPD (Art. 6º III + 46) confirmando que exibir
   ao admin é permitido; mascarar é privacy-by-design.
4. **Checklist de segurança+qualidade por entrega** (`281e8e8`) — cravado em `docs/SEGURANCA_BEST_PRACTICES.md` §0
   + regra 10 no `PROMPT_NOVA_SESSAO.md` (rodar sem pedir). Princípio: menor exposição de info.
5. **Sino do admin sem e-mail na mensagem** (`266d09b`) + **subtítulos admin removidos** (`783144d`,`2d1f462`).
6. **Pentest autorizado** (`78799ee`,`c0e34dc`) — 2 corrigidos (body>10MB→413 não 500; enumeração no
   register fechada), 1 falso achado retirado (HSTS já existe, gated em HTTPS — testado com X-Forwarded-Proto),
   resto passou (401/403/IDOR/CSRF/SQLi/JWT/CORS/Swagger dev-only). HSTS preload catalogado P3.
7. **Notificação acionável se resolve** (`1d5db2e`) — `AlvoId` na notif; aprovar/recusar baixa a do cadastro.
8. **Exclusão da própria conta self-service (LGPD Art. 18)** (`b01d097`→`ea6c602`) — o grande item, ver abaixo.

**⚠️ Lição de processo (repetida 3×, catalogar):** meu `Write` sobrescreveu arquivos existentes de
mesmo nome (`ContaService.cs`, `ContaServiceTests.cs`, `contaService.ts` — todos de contas bancárias).
Restaurados do HEAD (contagem de testes/`tsc` denunciaram). **Antes de Write num arquivo novo, checar se
o nome já existe** (grep/ls). O meu virou `MinhaContaService`/`minhaContaService`.

**App no ar:** Postgres + API :5293 + front :5173 (dev).

---

**(2026-09-12) Exclusão da própria conta (self-service, LGPD Art. 18) ✅ COMPLETO — back + front (branch `feature/admin-beta-gate`). Validado ao vivo E2E.**
Precedido de pesquisa OWASP/NIST (workflow, 5 agentes) sobre métodos de auth — conclusões-chave:
TOTP nunca substitui a senha (usá-lo só rebaixa AAL2→AAL1); e-mail é fator fraco (NIST veda como
out-of-band), só fallback, **nunca** bypass de TOTP; "esqueci a senha mas tenho TOTP" = recuperação
(reset por e-mail) + TOTP reexigido no login, não login alternativo. Registrado em
`docs/SEGURANCA_BEST_PRACTICES.md` §0.
- **Backend feito (3 commits, back 526/526):**
  - `EmailOtpService` + entidade `EmailOtp` (PIN 6 díg CSPRNG, só hash, TTL 10min, uso único, escopo
    por finalidade, teto de tentativas) + `IContaEmailSender` (migration `AddEmailOtp`).
  - `MinhaContaService` (self-service; nome distinto do `ContaService` BANCÁRIO já existente): excluir
    (step-up **senha atual + 2º fator**: TOTP se ativo, senão PIN e-mail) → soft-delete
    `MarcadoParaExclusao` + carência 30d + derruba tokens + auditoria (`AutoExclusaoConta`) + aviso
    out-of-band. Reativar por credenciais na carência (`AutoReativacaoConta`). Exportar meus dados
    (`AutoExportacaoDados`, reusa o montador do admin).
  - Login numa conta marcada não barra mais → `{contaMarcadaExclusao, diasRestantes}`.
  - Endpoints: `POST /auth/conta/excluir/enviar-codigo`, `POST /auth/conta/excluir`,
    `POST /auth/conta/reativar` (público, CSRF-isento, rate-limit), `GET /auth/conta/exportar`.
  - Enum `AcaoAdmin` += AutoExclusao/AutoReativacao/AutoExportacao (9/10/11).
  - **⚠️ Achado no processo:** meu Write sobrescreveu `ContaService.cs` e `ContaServiceTests.cs`
    (bancários) sem querer — restaurados do HEAD (a contagem de testes denunciou). Já existe
    `ContaService` (contas bancárias); o novo é `MinhaContaService`.
- **Front feito (Commit 4, front 369/369):** Settings → seção "Excluir minha conta" (zona de perigo:
  baixar meus dados + fluxo senha → 2º fator TOTP/PIN-email → exclui/desloga/vai pro login). Login →
  tela de **reativação** quando a conta está marcada (mostra dias restantes; reativa e loga de novo).
  `minhaContaService` (front; distinto do `contaService` bancário — que meu Write sobrescreveu e foi
  restaurado do HEAD). +4 testes. Validado ao vivo: E2E descartável (excluir 204→marcada→reativar) +
  zona de perigo/fase de senha conferidas no browser.
- **Próxima ação (a decidir):** admin + conformidade de beta bem robustos. Voltar às prioridades:
  testes de integração HTTP do admin (P1) / conferência de caixa (P1) / upgrade .NET 10 (P1) /
  Empréstimos. App no ar (:5293 + :5173).

---

**(2026-09-12) Notificação de admin acionável se resolve ao tratar o cadastro ✅ (branch `feature/admin-beta-gate`). Validado ao vivo.**
Achado (a partir de uma notificação órfã do pentest): a notificação "novo cadastro" não sumia depois
de aprovar/recusar. Pesquisa de UX (NN/g/Carbon/Toptal): **acionável** some quando tratada;
**informativa** fica como log.
- `NotificacaoAdmin.AlvoId` (Guid solto, migration `AddAlvoIdNotificacaoAdmin`, aplicada no dev) —
  preenchido só nas acionáveis (NovoCadastro → usuário pendente). `MarcarLidasPorAlvoAsync` (não salva;
  grava junto da ação, atômico). Aprovar/recusar (`AdminUsuarioService.DecidirAsync`) dá baixa.
  Segurança/ExclusaoLgpd seguem informativas (sem AlvoId, log manual).
- +3 testes (baixa por alvo não toca as outras; register seta AlvoId; aprovar baixa). Back **509/509**.
  Validado ao vivo: registrar→notif AlvoId Lida=f→aprovar 200→Lida=t; test users limpos.

---

**(2026-09-12) Batida de segurança / pentest autorizado (app local) ✅ (branch `feature/admin-beta-gate`).**
Agi como atacante contra a API :5293 (probes, sem mutar dado real — throwaways limpos depois).
- **Corrigido (2):**
  1. **Corpo > 10 MB → 413** (era **500**). `BadHttpRequestException` caía no default do
     `GlobalExceptionHandlerMiddleware`; agora mapeia pro StatusCode real (413, "Requisição grande
     demais."). Request já era rejeitado (DoS ok); só status/log estavam errados. +1 teste. Verificado
     ao vivo.
  2. **Enumeração de usuário no `/auth/register`** — respondia "Email já cadastrado" p/ existente vs
     "Cadastro enviado" p/ novo. Agora responde **sempre genérico**, sem criar duplicata, com hash
     descartado p/ equalizar timing. 2 testes atualizados. Verificado ao vivo (resposta genérica,
     count=1).
- **Falso achado retirado:** HSTS "ausente" — ERRO meu (catalogei sem checar). `SecurityHeadersMiddleware`
  JÁ seta HSTS gated em HTTPS; não apareceu só porque testei em HTTP. Removido do ROADMAP. (2º episódio
  de afirmar sem verificar nesta sessão — a checagem-antes-de-corrigir pegou.)
- **Passou (com evidência):** /admin/* exige auth (401) e barra não-admin (403); IDOR de conta de
  outro → 404/403; mass-assignment de isAdmin/status ignorado (register E profile — dev seguiu IsAdmin=f);
  CSRF sem/errado token → 403; SQLi no login → 400/401 (EF parametrizado); JWT forjado → 401; CORS nega
  origin externa; headers de segurança presentes (nosniff/X-Frame DENY/CSP `default-src 'none'`/Referrer/
  Permissions-Policy/HSTS-sob-HTTPS); Swagger dev-only; Hangfire exige auth; 500 não ecoa detalhe; login
  e forgot-password sem enumeração; sem `dangerouslySetInnerHTML`/`eval` no front.
- **Não coberto (honesto):** DDoS volumétrico real, fuzzing do parser de import OFX/CSV, XSS armazenado
  campo-a-campo (React escapa por padrão, sem innerHTML), timing fino. Back **506/506**.

---

**(2026-09-12) Mascaramento de dado sensível no admin (olhinho de revelar) ✅ (branch `feature/admin-beta-gate`). Validado ao vivo.**
Pedido do Gustavo: mascarar PII no painel admin com olho de revelar, igual ao "ocultar valores" do
financeiro. Antes disso, **pesquisa LGPD em fonte primária** (a pedido dele — eu tinha afirmado sem
verificar): Art. 6º III (necessidade/minimização) + Art. 46 (segurança/controle de acesso) — **exibir
e-mail pro admin autorizado é permitido** (dado necessário à finalidade + acesso restrito por IsAdmin);
mascarar é *privacy by design* extra, não obrigação legal. Confirmado no código que o e-mail aparecia
**nas duas telas** (Fila E Usuários), não só na Fila. Registrado em `docs/CONFORMIDADE_BR.md`.
- **Primitivo novo na lib Pontes (reusável, espelha o `useHideBalance`):** `useMaskData` (store global
  `useSyncExternalStore` + localStorage, **default MASCARADO**), `PontesMaskedValue` (mascara valor,
  revela conforme store), `PontesMaskToggle` (olho) + util `maskEmail` (`gu•••@g•••.com`, trata
  não-e-mail/vazio). Barrel + smoke tests. (Sem demo no /design-system — segue o precedente do
  `SensitiveValue`, que também não tem.)
- **Olho no `Navbar`:** slot `sensitiveToggle?` (mesmo padrão do slot `notifications`); `AdminLayout`
  injeta o olho (PontesIconButton, visual igual ao do financeiro). Estado global → vale em todas as
  telas admin, persiste no reload.
- **Mascarado nas 4 telas admin:** Fila (e-mail + dialog recusar), Usuários (e-mail + dialog/toast
  reset), LGPD (e-mail + modal de purga: display, placeholder e helper "use o olho pra revelar"; a
  comparação de confirmação usa o e-mail REAL), Auditoria (admin + alvo). Nome fica visível (usabilidade
  — o admin precisa reconhecer quem é; e-mail é o identificador sensível). Busca continua no dado real.
- **Hardening mantido:** olho + `PontesMaskedValue` + `admin/notificacoes` só no chunk `AdminApp`,
  zero no bundle comum (conferido no build). `tsc -b` 0 erros.
- **Testes:** front **365/365** (+4: `maskEmail`, `PontesMaskedValue`, `PontesMaskToggle`, wiring na
  LgpdPage). Testes das páginas admin que checam e-mail real forçam `setMaskData(false)` no beforeEach.
  Lint limpo.
- **Validado ao vivo:** Fila nasce com e-mail `te•••@e•••.com` + olho riscado → clico → e-mail
  completo + olho aberto → clico → volta a mascarar. Toggle global.

**⚠️ Fora do escopo desta rodada (catalogar se quiser):** a mensagem do sino de admin ("Novo cadastro
— Fulano (email)...") ainda mostra o e-mail em texto; é transitória (atrás de clique). Dá pra tirar o
e-mail da mensagem ou mascarar depois.

**⚠️ Obs de build (ambiente, não código):** a pasta `controle-financeiro.web/dist` ficou com lock de
handle no Windows (o dev server do PWA + cwd do shell). Build validado num outDir alternativo
(`tsc -b` 0 + vite build OK); `dist` é gitignored, não bloqueia. Se um build de deploy reclamar de
`EPERM` ao limpar `dist`, parar o preview e apagar a pasta antes.

---

**(2026-09-12) Notificações do admin — stream próprio, separado do financeiro ✅ (branch `feature/admin-beta-gate`). Validado ao vivo.**
Bug reportado pelo Gustavo: o sino de notificações **financeiras** aparecia também no painel admin
(o `NotificationBell` renderizava sem gate no `Navbar` compartilhado). Pedido dele: **não misturar** —
sino do financeiro só com notificação financeira, sino do admin só com a de admin.
- **Backend (tudo separado do financeiro, zero cruzamento de query):** entidade `NotificacaoAdmin`
  (global ao painel, sem FK/dono), enum `TipoNotificacaoAdmin { NovoCadastro, ExclusaoLgpd,
  Seguranca }`, `NotificacaoAdminService` (criar best-effort + listar + contar + marcar/marcar-todas),
  endpoints no `AdminController` (`GET /admin/notificacoes`, `.../contagem`, `PUT .../{id}/lida`,
  `PUT .../lidas`), migration `AddNotificacaoAdmin` (aplicada no dev).
- **Geradores (as 3 fontes que o Gustavo escolheu):** `RegisterAsync` → NovoCadastro (link
  /admin/pendentes); `LoginAsync` ao bater o teto de força bruta → Seguranca; job
  `PurgarExpiradasAsync` (LGPD) → ExclusaoLgpd (purgadas + vínculos pendentes).
- **Front (isolado no chunk admin):** `AdminNotificationBell` (espelha o sino, reusa o CSS, lê só
  `adminService.notificacoes`). `Navbar` ganhou slot `notifications?` — user usa o sino financeiro
  (como era; **revertido o gate errado da 1ª tentativa**), admin injeta o seu via `AdminLayout`.
  `types/NotificacaoAdmin.ts` + chamadas no `adminService`.
- **Hardening mantido:** `admin/notificacoes` + `AdminNotificationBell` **só no chunk `AdminApp`**,
  zero no bundle comum (conferido no dist).
- **Testes:** back **505/505** (+9: service + geração register/brute/purga), front **361/361** (+4:
  Navbar mostra o sino certo em cada contexto + AdminNotificationBell). Lint/build limpos.
- **Validado ao vivo:** registrei um descartável → notificação NovoCadastro criada → painel admin com
  sino badge **1** e "Novo cadastro na fila" no dropdown; sino do `/dashboard` **sem badge** (não
  puxou a de admin) → streams separados de fato. Artefatos de teste limpos do dev.

**⚠️ Nota de design:** read-state das notificações de admin é **global** (qualquer admin marca lida
pra todos) — beta ≈ 1 admin. Se entrar +1 admin, considerar read-state por admin (catalogar então).

---

**(2026-09-12) Store Marco Civil — `RegistroAcesso` + captura de IP no login ✅ (branch `feature/admin-beta-gate`). Validado ao vivo E2E contra Postgres real.**
Fecha a pendência P1 pré-produção que ficou aberta no Módulo C. Retenção de log de acesso (Marco
Civil da Internet, Lei 12.965/2014 Art. 15).
- **Pesquisa (fonte primária, regra de conformidade) reconfirmada 2026-09-12:** Art. 15 obriga
  provedor PJ/organizado/fins econômicos a guardar registros de acesso 6 meses sob sigilo; Art. 5 VIII
  define o registro como **data/hora + IP**. Pontes é pré-CNPJ → caput ainda não vincula pleno, mas
  ordem judicial (§1) vale pra qualquer um e o caput passa a valer com a empresa → desenhar desde já.
- **Backend:** entidade `RegistroAcesso` (append-only, **sem FK** → fora do cascade da conta, sobrevive
  à purga LGPD do Módulo C) com `UsuarioId` solto + `Email` (identificador snapshot, mantém o log útil
  após a purga) + `Ip` + `Tipo` (enum `TipoEventoAcesso.Login`) + `CriadoEm`. **Sem User-Agent**
  (minimização LGPD Art. 6º III — não integra o registro legal). `RegistroAcessoService`
  (`RegistrarLoginAsync` + `PurgarExpiradosAsync`, `RetencaoDias=180`). Captura no `AuthController`
  (único lugar com `HttpContext`; IP via `RemoteIpAddress`, que já reflete o X-Forwarded-For real
  atrás do proxy) nos 2 pontos de login concluído — sem MFA e após o 2º fator. **Best-effort:** falha
  ao gravar o log NÃO derruba o login (catch + `ILogger`). Job `PurgaRegistroAcessoExpiradoJob`
  (Hangfire, 4h30 UTC) purga a retenção vencida. Migration `AddRegistroAcesso` aplicada no dev.
- **Sem front, sem teste de front (decisão deliberada):** o log Marco Civil existe pra retenção
  legal/ordem judicial sob sigilo, não navegação de rotina — expor IP de todos no painel é mais
  exposição que a finalidade exige (minimização). Viewer gated catalogado P3 no ROADMAP se quiser.
- **Testes:** back **496/496** (+5): grava com identificador/IP/timestamp; IP vazio→placeholder; purga
  remove >180d e mantém <180d; sem-vencidos→no-op; **`RegistroAcesso` sobrevive a `Usuarios.Remove`**
  (prova a retenção). Build/migration limpos.
- **Validado ao vivo E2E (Postgres real, usuário descartável — regra de não-testar-em-dado-real):**
  registrar → aprovar → **antes do login: 0 linhas** → login (200) → **1 linha** com Email, `Ip=::1`
  (loopback real capturado), `Tipo=0` (Login), `UsuarioId` conferido, timestamp. Usuário de teste +
  linha limpos do dev depois.

**Estado do admin:** A · B · C · D ✅ + **store Marco Civil ✅**. Pendência P1 pré-produção fechada.

**Próxima ação (a decidir com o Gustavo):** admin + conformidade de beta completos. Opções: (1) **testes
de integração HTTP do admin** (P1 — WebApplicationFactory, cobre A/B/C/D + a captura de acesso); (2) sair
do admin pra P1 de produto (conferência de caixa / upgrade .NET 10, prazo 10/11/2026); (3) retomar
**Empréstimos** (regra "fecha o módulo aberto": consolidação/unificação spec-only + bancada UI sem
vencedora). App rodando (Postgres + API :5293).

---

**(2026-09-10) Admin Módulo C — LGPD (exportar + exclusão 2 estágios + purga real) ✅ (branch `feature/admin-beta-gate`). Validado ao vivo E2E contra Postgres real.**
Fecha o admin: A (fila) · B (usuários) · C (LGPD) · D (auditoria) todos ✅.
- **Backend:** `Usuario.MarcadoExclusaoEm` (migration `AddMarcadoExclusaoEm`, aplicada no dev). Enum
  `AcaoAdmin` += Exportar/Marcar/Cancelar/Purgar. `AdminLgpdService` novo:
  - **Exportar** — JSON com dados pessoais do usuário (perfil+contas+cartões+transações+metas+
    orçamentos), auditado (direito de acesso, LGPD Art. 18).
  - **Exclusão 2 estágios:** marcar (`→ MarcadoParaExclusao` + carimba data, derruba refresh tokens,
    reversível) → carência 30d → **purga física real**. Cancelar volta a Ativo.
  - **Purga:** guardas (não-a-si §0.6; só marcado→409; confirmação por e-mail→400) + **recusa se
    houver vínculo com outro usuário** (relacionamento/família/rateio/acerto/empréstimo/consolidação/
    conta compartilhada — não quebra dado de terceiro). Deleção ordenada child→parent (transferências
    → transações → parcelas → faturas → parcelamentos → cartões → recorrentes/subcats → usuário via
    cascade). **`FinancialEventLog` anonimizado** (CriadoPor→vazio, retido); **`AdminAuditLog`
    preservado** (sem FK, sobrevive). Descoberta-chave: cartão/transação-de-cartão têm `CriadoPor`
    **Guid solto (sem FK)** → apagar só o usuário deixaria órfãos → deleção explícita.
  - **Job `PurgaExclusaoExpiradaJob`** (Hangfire, 4h UTC): purga automática de carência vencida, pula
    contas com vínculo. Registrado no Program.cs.
  - Endpoints: `GET .../exportar`, `POST .../marcar-exclusao|cancelar-exclusao|purgar`. +14 testes.
- **Front (DS):** `AdminLgpdPage` — tabela + Exportar (baixa JSON) + Marcar exclusão (PontesDialog) +
  Cancelar + **Purgar (PontesModal com confirmação forte: digitar o e-mail)**. Self-guard (sem
  marcar/purgar na própria linha). Item "LGPD" na lateral, rota `/admin/lgpd`; `adminService` +
  tipos + `ACAO_LABEL`. +4 testes.
- **Testes:** back **491/491** (+14), front **357/357** (+4). Lint/build limpos.
- **Hardening mantido:** `purgar`/`lgpd`/`marcar-exclusao` só no chunk lazy `AdminApp`, **zero no
  bundle comum** (conferido no dist).
- **Validado ao vivo E2E (Postgres real, usuário descartável — regra de não-testar-em-dado-real):**
  registrar → aprovar → criar conta+cartão+transação(fatura) → marcar → **purgar (204, sem erro de
  FK)**. SQL confirmou: usuário/conta/cartão/transações/faturas todos apagados, **`Conta` removida
  por cascade**, auditoria da purga preservada (Acao=8). Ordem de deleção validada contra os FKs
  Restrict reais (InMemory não força cascade — só o live prova). Usuários de teste limpos do dev.

**✅ Resolvido (2026-09-12):** o store **Marco Civil (RegistroAcesso + captura de IP no login)** foi
entregue — ver o bloco no topo. A purga LGPD preserva `RegistroAcesso` por não haver FK.

**Estado do admin:** A · B · C · D ✅ — **admin do beta completo.**

**Próxima ação (a decidir com o Gustavo):** admin fechado. Opções: (1) **testes de integração do
admin** via HTTP real (P1 no ROADMAP — WebApplicationFactory, cobre A/B/C/D); (2) **store Marco Civil**
(P1, pré-produção); (3) sair do admin pra P1 de produto (conferência de caixa / upgrade .NET 10,
prazo 10/11/2026). App rodando (Postgres + API :5293 + front pendente de subir).

---

**(2026-09-10) Admin Módulo D — auditoria ✅ (branch `feature/admin-beta-gate`, commit `df26a39`). Validado ao vivo.**
Fecha o admin com rastreabilidade. (Escolhido no lugar do C: C é o mais perigoso, precisa do store
Marco Civil antes e não trava beta; D é só leitura, risco baixo, valor de segurança alto.)
- **Backend:** `AdminAuditLog` (append-only) + enum `AcaoAdmin` + migration `AddAdminAuditLog`
  (aplicada no dev). Snapshot denormalizado (e-mail do admin + descrição do alvo) — legível sozinho,
  sobrevive à exclusão do usuário; sem FK/cascade. `AdminAuditService` (Registrar atômico com a ação
  + ListarAsync 200 recentes). **Toda ação de admin** (aprovar/recusar/bloquear/reativar/forçar-reset)
  grava rastro com o e-mail do admin (do claim). `GET /admin/auditoria`. +2 testes.
- **Front (DS):** `AdminAuditoriaPage` (tabela só-leitura: quando/admin/ação/alvo/detalhe); item
  "Auditoria" na lateral, rota `/admin/auditoria`; `AcaoAdmin`/`ACAO_LABEL`. +2 testes.
- **Validado ao vivo:** bloquear+reativar um seed → 2 registros na auditoria (recente primeiro, com
  e-mail do admin snapshot + alvo + timestamp).
- Hardening mantido (endpoints só no chunk lazy). Back **477/477** (+2), front **353/353** (+2).

**Estado do admin:** Módulos A (fila), B (usuários), D (auditoria) ✅. **Falta só o C (LGPD).**

**Próxima ação (a decidir):** o admin está "bom o bastante" pro beta. Opções: (1) **Módulo C — LGPD**
(exportar + exclusão 2 estágios + store Marco Civil — o mais sensível, não trava beta); (2) **testes
de integração do admin** (P1 — cobrir A/B/D via HTTP real, WebApplicationFactory); (3) **sair do admin**
pra um P1 do produto (conferência de caixa / upgrade .NET 10, prazo 10/11/2026). Perguntar ao Gustavo.

---

**(2026-09-10) Admin Módulo B — gestão de usuários ✅ (branch `feature/admin-beta-gate`, commit `87266ce`). Validado ao vivo.**
- **Backend** (`AdminUsuarioService`+`AdminController`): `ListarUsuariosAsync(busca?)`; `Bloquear`
  (Ativo→Bloqueado; **não bloqueia a si mesmo → 403** §0.6; só Ativo→409); `Reativar`
  (Bloqueado→Ativo); `ForcarResetSenha` (dispara o fluxo de reset existente; só Ativo). Endpoints
  `GET /admin/usuarios`, `PATCH .../bloquear|reativar`, `POST .../forcar-reset`. +9 testes.
- **Front** (DS): `AdminUsuariosPage` — tabela (nome/e-mail/situação badge/último acesso) + ações
  por status (Ativo→Forçar reset+Bloquear; Bloqueado→Reativar), confirmação `PontesDialog`, busca
  client-side. **Não mostra "Bloquear" na própria linha do admin.** Item "Usuários" na lateral,
  rota `/admin/usuarios`, `STATUS_LABEL`/`STATUS_TONE`. +4 testes.
- **Validado ao vivo:** listar todos; bloquear (dialog→Bloqueado badge+toast) → reativar; self-guard
  confirmado (admin logado sem "Bloquear"); seed de dev restaurado. O estado `Bloqueado` já barra no
  login (gate de Status existente, mensagem "conta bloqueada").
- Hardening mantido: endpoints `/admin/*` só no chunk lazy, **zero no bundle comum** (conferido no dist).
- Back **475/475** (+9), front **351/351** (+4), lint/build limpos.

**Próxima ação:** **Módulo C — ferramentas LGPD** (`docs/features/admin/spec.md` §5, ⚠️ sensível):
exportar dados de um usuário (JSON) + exclusão em 2 estágios (soft `MarcadoParaExclusao` → carência
30d → hard delete via job Hangfire), com **retenção obrigatória Marco Civil** (registros de acesso 6
meses num store separado — ver item P2 no ROADMAP) e `FinancialEventLog` anonimizado. Confirmação
forte (digitar e-mail). Admin não apaga a si. É o mais delicado — mais teste. Depois: D (auditoria).

---

**(2026-09-10) Painel admin: mesma cara do app (sidebar+navbar) + hardening de front ✅ (branch `feature/admin-beta-gate`, commits `75c027d`→`087e253`).**
Resolvido + retrabalhado conforme revisão do Gustavo. **Validado ao vivo.**
- **Mesma estrutura do app, menus de admin:** `AdminLayout` reusa o shell do `DefaultLayout`
  (sidebar lateral + navbar superior). Menus na lateral: **Fila de aprovação** (`/admin/pendentes`)
  e **Métricas** (`/admin/metricas`); `/admin` redireciona. `AdminPage` virou 2 telas
  (`AdminPendentesPage`, `AdminMetricasPage`).
- **Reuso por parâmetro (sem `if isAdmin` em componente compartilhado):** `Sidebar` aceita `nav`
  (+`homePath`); `Navbar` aceita `showFinance`/`title`/`homeLabel`/`homePath` e ações opcionais.
  Default = comportamento do usuário (app dele inalterado). Só DS existente — nada novo no DS.
- **Hardening de front (defesa em profundidade; backend = fronteira real):**
  - `AdminRoute` lê `currentUser.isAdmin` (do `/auth/me`), **não importa `adminService`** → decide
    antes de montar; não-admin → redirect `/` sem mensagem (genérico). `UsuarioDto`/`AuthContext`
    ganharam `IsAdmin`/`isAdmin`.
  - **Lazy load** — `AdminApp` em chunk separado; comum não baixa o JS do painel.
  - **Bundle comum blindado:** conferido no `dist` — só sobrou `path:"/admin/*"` + `isAdmin`
    (irredutível: router precisa do path). **Zero endpoint/tela/menu/título** de admin no bundle
    comum (antes vazava o `adminService` inteiro). Source maps já off.
- **Validado ao vivo:** painel com sidebar+navbar iguais ao app (Fila/Métricas na lateral, troca
  funcionando, sem Nova transação); comum em `/admin` → dashboard sem vazar; comum não baixa o painel.
- Back **466/466** (+1), front **347/347**, lint/build limpos.

**⚠️ Pendência de UX (não bloqueia):** entrada do painel ainda é **só por URL** (`/admin`) — não há
link. Com `isAdmin` já no `/auth/me`, dá pra pôr um item "Painel Admin" na sidebar **só pra admin**
(condicionado a `currentUser.isAdmin`), sem vazar pro comum. Gustavo decide se quer (opção A) ou
mantém só-URL (opção B). Anotar no ROADMAP.

**Próxima ação:** **Módulo B — gestão de usuários** (`docs/features/admin/spec.md` §4): listar todos
os usuários (nome/e-mail/status/último acesso) + **bloquear/reativar** (→ estado `Bloqueado`, surge
na UI) + **forçar reset de senha** (dispara fluxo existente). Admin não age sobre si (§0.6). Endpoints
`GET /admin/usuarios`, `PATCH /admin/usuarios/{id}/bloquear|reativar`, `POST .../forcar-reset`.
Depois: C (LGPD) → D (auditoria).

---

**(2026-09-09, noite) Admin Módulo A — fila de aprovação do beta ✅ (branch `feature/admin-beta-gate`, commit `038d522`).**
O gate do beta está de pé. Decisão do Gustavo: fazer o certo sem dívida técnica — `StatusUsuario`
(enum) **substituiu** o `bool Ativo` (opção A, não manter campo redundante). Ver
[[feedback_sem_divida_tecnica]].
- **`StatusUsuario`** {AguardandoAprovacao, Ativo, Recusado, Bloqueado, MarcadoParaExclusao} — fonte
  única da verdade sobre "pode usar o sistema?". `Usuario`: removido `Ativo`, entra `Status` +
  `AprovadoPor`/`AprovadoEm`/`UltimoAcessoEm`. Migration `AddStatusUsuario` **preserva dados**
  (Ativo=true→Ativo, false→Bloqueado).
- **Cadastro nasce pendente e SEM sessão** — `RegisterAsync` não emite JWT/refresh; `AuthController`
  responde 201 sem cookie. Login/refresh/reset barram quem não é `Ativo`, com mensagem por estado.
  Grava `UltimoAcessoEm`.
- **Admin:** `AdminUsuarioService` + endpoints `GET /admin/pendentes`, `POST /admin/usuarios/{id}/
  aprovar|recusar`, `GET /admin/metricas`. Policy IsAdmin já revalida no banco.
- **Front (DS):** `RegisterPage` mostra "cadastro enviado, aguarde aprovação" (não loga);
  `AuthContext.register` devolve a mensagem e não cria sessão (campo `ativo` morto removido);
  `/admin` com aba Pendentes (PontesTable + aprovar/recusar via PontesDialog) + Métricas (StatCards);
  `adminService` + tipos.
- Testes: back **465/465** (+10), front **345/345** (+4). Lint/build limpos.
- **Migration `AddStatusUsuario` APLICADA no Postgres de dev ✅** (subi a API no fim da sessão):
  colunas `Status` (int, default 0), `AprovadoEm`, `AprovadoPor`, `UltimoAcessoEm` conferidas no
  banco; coluna `Ativo` removida (conversão preservou dados). **App no ar agora:** Postgres +
  API :5293 (health 200) + front :5173. Obs de dev: `dotnet run --no-launch-profile` sobe na
  **:5000**; pra bater com o front use `ASPNETCORE_URLS=http://localhost:5293`.

- **Verificado ao vivo ✅ (2026-09-09):** cadastro `teste.gate.beta@example.com` → tela "Cadastro
  enviado, aguardando aprovação" (não logou) → tentar logar barrou com "Sua conta está aguardando
  aprovação" (inline vermelho) → em `/admin` (logado como admin) o cadastro apareceu na fila
  Pendentes com Aprovar/Recusar. Fluxo do gate funcionando ponta a ponta.
  - _Setup de dev pro teste:_ `solo@controle.test` promovido a admin via UPDATE direto no banco
    (`IsAdmin=true`) — via oficial de bootstrap (spec §0.1), é seed puro de dev. A conta
    `teste.gate.beta@example.com` ficou pendente no banco (inofensiva; dá pra aprovar/recusar/apagar).

**Achados da revisão do Gustavo (catalogados no ROADMAP como 🟠 P1 — fazer na PRÓXIMA rodada, antes de B/C/D):**
1. **Separar `AdminLayout`** — hoje `/admin` está dentro do `DefaultLayout` (aparece com sidebar de
   Transações/Importar + "Nova transação"). Errado: admin precisa de chrome próprio, isolado.
2. **Hardening de segurança do front** (defesa em profundidade — Gustavo quer "extremamente exigente"):
   `AdminRoute` que barra antes de montar; lazy load do chunk admin (comum nunca baixa o JS);
   404 genérico pra não-admin; source maps OFF em produção. NÃO fazer teatro (ofuscar rota/endpoint).
   Backend continua a fronteira real; isso é camada extra. Detalhe no ROADMAP.

**Próxima ação:** próxima rodada começa por (1) `AdminLayout` separado + (2) hardening de front
(gate na rota + lazy load + 404), depois **Módulo B** (gestão de usuários: bloquear/reativar/forçar
reset — surge o estado `Bloqueado` na UI) → C (LGPD) → D (auditoria). Ver `docs/features/admin/spec.md`
§9 e o item admin no ROADMAP.

---

**(2026-09-09, fim da tarde) Feedback de erro no front — rede de segurança + regra oficial ✅ (branch `feature/admin-beta-gate`).**
Gustavo cobrou: erro tem que aparecer pro usuário (campo vermelho + notificação). Feito (caminho C
aprovado por ele):
- **A — rede de segurança global** (`2136ae8`): interceptor do axios extrai mensagem amigável de
  qualquer erro !=401 e dispara evento `apiError`; `DefaultLayout` mostra toast. Nenhum erro de
  backend passa silencioso. Request pode optar `skipErrorToast` quando trata no campo.
- **B — form de referência** (`bd6e8d6`): `NewContaDialog` deixa a rede global mostrar o erro (não
  duplica toast), mantém modal aberto pra retry. `ContaForm` já validava por campo.
- **Regra oficial documentada** em `docs/REGRAS_CAMPOS.md`: checklist de campo, tabela de limites,
  "mostrar erro ao usuário", e **inline × toast (quando usar cada um, sem duplicar)** (`25b512c`,
  `ee136dd`). Linkado em CLAUDE.md + STANDARDS.md → toda sessão futura segue.
- **Auditoria ao vivo:** 5 forms testados (Login, Nova transação, Nova conta, Categoria,
  Transferência) — TODOS mostram campo vermelho + mensagem inline. Validação por campo já é bem
  adotada no app; não estava quebrada. O "erro só depois do login" que o Gustavo viu não reproduziu
  (provável cache/HMR; refresh forçado resolve).
- Testes 341/341 front, 455/455 back. App rodando (Postgres+API 5293+web 5173).

**Próxima ação:** rollout opcional — padronizar os demais forms pra `skipErrorToast` onde já mostram
inline (evitar toast duplicado num 400). NÃO urgente: nenhum form está quebrado. Depois disso, voltar
ao Módulo A do admin (fila de aprovação) — o gate do beta.

**(2026-09-09, tarde) Hardening de validação de input ✅ (branch `feature/admin-beta-gate`).**
Pedido do Gustavo ("evitar caracteres infinitos, coisas que quebram o sistema"). Achado real: só
10/52 DTOs tinham validação. Adicionado `[MaxLength]`/`[Required]`/`[EmailAddress]`/`[Range]` em
todos os DTOs de entrada + **limite global de body no Kestrel (10 MB)** + **cap de 128 nas senhas**
(senha gigante = DoS no Argon2). `[ApiController]` barra com 400 automático — verificado ao vivo
(nome 300 chars → 400, email inválido → 400). Build 0 warning, 455/455. Commit `c77e4b8`.
App rodando: Postgres + API (5293) + frontend (5173). **Lista de segurança (feito × falta) no chat.**

**(2026-09-09) Admin passo 1 — núcleo de segurança da flag IsAdmin ✅ (branch `feature/admin-beta-gate`).**
Primeiro código do admin. Backend + testes, build 0 warning, **455/455**.
- `Usuario.IsAdmin` (default false, migration `AddIsAdminUsuario`) — nunca setável por endpoint/DTO.
- `AdminAuthorizationHandler` + policy `"IsAdmin"`: revalida a flag no banco a cada request (defense
  in depth, não confia só no JWT). `AdminController` `GET /api/v1/admin/me` sob a policy.
- `AdminSeeder`: concede IsAdmin via env var `ADMIN_EMAILS` (só concede, nunca revoga; no-op sem a
  var). Roda no boot. `.env.example` documenta. **Gustavo precisa pôr `ADMIN_EMAILS=gut.n.pontes@gmail.com`
  no `.env` local** e (re)subir a API depois de cadastrar esse e-mail pra virar admin.
- Testes (+9): escalação de privilégio (não-admin/desativado/sem-claim/inexistente não autoriza),
  cadastro nasce não-admin, seeder concede só listado/case-insensitive/no-op sem env.
- ⚠️ Migration criada mas **não aplicada no Postgres** (Docker Desktop estava desligado) — NÃO é
  estado quebrado: modelo/migration/testes consistentes, e `Program.cs` roda `MigrateAsync` no boot,
  então aplica sozinha quando subir a API. Commit `2e5a5d3`.

**Próxima ação:** Módulo A — fila de aprovação (abre o beta). `Usuario.Status` (AguardandoAprovacao/
Ativo/Recusado/Bloqueado/MarcadoParaExclusao) reconciliando com o `Ativo` atual; cadastro nasce
AguardandoAprovacao; login barra não-Ativo; endpoints admin de aprovar/recusar + métricas. Ver
`docs/features/admin/spec.md` §3.

---

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
  `docs/features/reconciliacao/spec.md` escrita, **não implementada ainda**: saldo declarado ×
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

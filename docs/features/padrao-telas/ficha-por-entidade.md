---
owner: Gustavo
last_reviewed: 2026-09-28
status: RASCUNHO — aguardando aprovação do Gustavo
---

# Ficha por entidade — o que mostrar em cada posição

Aplica as regras de [`plano.md`](plano.md) → "Padrão geral: não é só tabela" a cada coisa que aparece no app. Depois de aprovada, vira regra da skill `pontes-telas`: tela nova nasce daqui, sem rodada de ajuste.

Montada a partir dos DTOs do back (`ControleFinanceiro.Api/DTOs/**`), dos types do front (`src/types/**`), das telas atuais e da auditoria de 2026-09-28. Onde a ficha pede algo que o DTO não tem, está escrito **precisa de campo novo**. Caminhos em "Hoje diverge em" são relativos a `controle-financeiro.web/src/pages/`, salvo indicação.

## Regras que valem pra todas as fichas

- **Teto do item:** título + 1 linha de meta (máx. 3 fatos, separados por " · ") + 1 valor + 1 status + 1 progresso. O resto vai pro detalhe.
- **"Normal não se anuncia":** tipo, frequência ou finalidade que é o caso comum não aparece (ex.: "Mensal", "Compra parcelada"). Só a exceção, e como **texto na meta**, nunca badge colorido.
- **Status:** 1 badge só, e só fora do normal. Concorda em gênero com o item ("Paga", "Atrasada"). Se couber mais de um, vale o que pede ação primeiro: Atrasado > Estourado > Pendente > Parcial > Pausado > Previsto > os finais (Pago, Concluído, Encerrado, Cancelado, Recusado, Expirado).
- **Dinheiro:** `formatMoney`. Entrada "+" em verde; saída "−" na cor do texto; **vermelho só pra problema** (saldo negativo, Atrasado, Estourado). É o que Transações, Contas Fixas e Dashboard já fazem.
- **Data:** na coleção, relativa quando o prazo está a até 7 dias ("vence em 3 dias"), senão dd/mm. No detalhe, sempre absoluta.
- **Entidade sem página de detalhe** (Transação, Transferência, Conta, Meta, Limite, Conta fixa): "Só no detalhe" = fica no formulário de edição (modal). Não criar página nova só pra isso.
- **Família:** nunca "deve" nem "Atrasado". Usar "a acertar", "a receber", "quitado" ([visão §7.5](../familia/visao.md)). O sistema sabe o peso, não o valor: renda de outro membro nunca aparece (visão §8).

## Resumo

| Entidade | Coleção | Onde aparece hoje |
|---|---|---|
| Transação | `table` | `/transactions` (`TransactionTable`); Dashboard (`TxRow`); linhas da fatura em Cartões |
| Transferência | `list` | `/transferencias` |
| Conta (bancária/carteira) | `cards` | `/accounts` (`AccountsPage`); Dashboard (`AccountTile`); `Bancos/BancosPage.tsx` (sem rota) |
| Cartão de crédito | fora do molde (mestre-detalhe) | `/credit-cards`; Dashboard (`CartaoTile`) |
| Fatura | fora do molde (painel do cartão) | `/credit-cards`, painel do cartão escolhido |
| Parcelamento | `list` | `/credit-cards/parcelamentos` (+ `/:id`) |
| Parcela | `list` (dentro do detalhe) | detalhe do parcelamento; linhas da fatura; detalhe do empréstimo |
| Conta fixa (Recorrente) | `list` | `/assinaturas` (`RecorrentesPage`); previsão de fatura em Cartões |
| Empréstimo | `list` | `/emprestimos` (+ `/:id`) |
| Meta | `cards` | `/metas` |
| Limite (orçamento) | `cards` | `/limites`; Dashboard (`OrcamentoCard`) |
| Categoria / subcategoria | fora do molde (árvore) | `/categories` |
| Banco | fora do molde (só identidade) | selo em Contas, Cartões e Empréstimos; seletor do formulário de conta |
| Família (o grupo) | `cards` | `/familias` |
| Membro | `list` (seção do detalhe) | `/familias/:id`, card Membros |
| Convite | `list` (enviados) + caixa de pendências (recebidos) | `/familias/:id` (enviados); `/familias` (recebidos) |
| Acerto | `list` (aba do detalhe) | `/familias/:id`, aba Acerto de contas |
| Despesa compartilhada | `list` (aba do detalhe) + caixa de pendências | `/familias/:id`, aba Despesas; ⋮ de Transações (compartilhar) |
| Dependente | `list` (aba do detalhe) | `/familias/:id`, aba Dependentes; ⋮ de Transações (atribuir) |

---

## Finanças

### Transação

| Posição | O que vai |
|---|---|
| Coleção | `table`: volume alto, paginada no servidor, e a pessoa compara 4 colunas entre linhas (data, categoria, conta/cartão, valor) |
| Identidade | ícone de entrada ou saída (o mesmo em Transações e no Dashboard) |
| Título | `Descricao` + marca discreta de origem quando o sistema gerou: conta fixa (`RecorrenteOrigemId`), parcela (`ParcelamentoId`/`ParcelaTransacaoId`), pagamento de fatura (`EhPagamentoFatura`) |
| Meta | colunas: data · categoria · conta ou cartão (`ContaNome ?? CartaoCreditoNome`). O `TransacaoDto` não traz o nome da categoria (o front resolve pelo `CategoriaId`; o Dashboard já recebe `Categoria` pronto) |
| Valor principal | `Valor` à direita, "+" entrada / "−" saída |
| Status | **Previsto** (NOVO, `StatusTransacao=0`) · **Cancelado** (`StatusTransacao=2`). Executado = sem badge |
| Progresso | — |
| Ações do ⋮ | Editar · Compartilhar com família · Atribuir a dependente · Definir divisão (as 3 só em despesa) · Excluir |
| Resumo do topo | Saldo total · Entrou · Saiu · Sobrou no mês (`TransacaoStatsDto`: `EntradasCaixa`, `SaidasCaixa`, `SaldoPeriodo`). 4 números, sem subtítulo |
| Só no detalhe | meio de pagamento, hora, subcategoria, fatura, "usado como crédito" |
| Nunca mostrar | — (dado só do dono). Valores respeitam o olhinho global |

**Hoje diverge em:** `Transactions/TransactionsPage.tsx:256` h1; `:268` subtítulo "Soma de todas as contas"; `:383` contador "N lançamentos"; `Transactions/components/TransactionTable/TransactionTable.tsx:352,394` coluna Pagamento (vai pro detalhe); `:389` categoria como badge (é texto); `:134-143` ícones soltos quando a tela é larga, em vez de ⋮; `:360-368` só trata Previsto, Cancelado aparece como normal; `:381` usa TrendingUp/Down e `Dashboard/DashboardPage.tsx:391` usa ArrowUpRight/DownLeft pro mesmo item; `DashboardPage.tsx:399-400` meio de pagamento como badge; `src/types/Transaction.ts` tem `parcelas`, `numeroParcela`, `efetivado`, que o DTO não manda.

### Transferência

| Posição | O que vai |
|---|---|
| Coleção | `list`: 1 valor por item, histórico longo paginado |
| Identidade | ícone ArrowLeftRight |
| Título | `Descricao`; vazia → "`ContaOrigemNome` → `ContaDestinoNome`" |
| Meta | `ContaOrigemNome` → `ContaDestinoNome` · data |
| Valor principal | `Valor`, sem sinal, cor do texto (não é entrada nem saída) |
| Status | — (não existe estado) |
| Progresso | — |
| Ações do ⋮ | Excluir (o back não tem editar) |
| Resumo do topo | nenhum (`TransferenciaStatsDto` só tem total movimentado e contador; não responde "como estou?") |
| Só no detalhe | — (sem detalhe; a linha não abre nada) |
| Nunca mostrar | — |

**Hoje diverge em:** `Transferencias/TransferenciasPage.tsx:205-207` origem e destino como badges vermelho/verde (a cor sugere saída/entrada; vira texto na meta); `:203` fallback "Transferência" em vez de "Origem → Destino". O resto já segue (é a referência da fase 1).

### Conta (bancária/carteira)

| Posição | O que vai |
|---|---|
| Coleção | `cards`: poucas, e o saldo de cada uma é o que importa |
| Identidade | logo do banco (`PontesBankBadge`); carteira = ícone Wallet. **Precisa de campo novo:** `ContaDto` não traz `BancoLogoUrl`/`BancoCor` (o `SaldoContaDto` do Dashboard e o `CartaoCreditoDto` trazem); hoje a tela baixa a lista de bancos só pra achar o logo |
| Título | `Nome` |
| Meta | `BancoNome` · `TipoDescricao` (texto) |
| Valor principal | `SaldoAtual` em destaque, com olhinho; negativo em vermelho |
| Status | — (conta não tem estado) |
| Progresso | — |
| Ações do ⋮ | Editar · Excluir (a confirmação avisa que as transações da conta são apagadas junto: o back apaga de vez, `ContaService.cs:135`). Carteira: sem ⋮ (o back recusa editar e excluir) |
| Resumo do topo | Saldo total (1 número) |
| Só no detalhe | agência e número da conta |
| Nunca mostrar | agência/número na coleção |

**Hoje diverge em:** `Accounts/AccountsPage.tsx:101` h1 "Bancos" (o menu diz Contas); `:109` "Nova Conta" (maiúscula); `:116` StatCard "Contas Bancárias" (contador) e `:117` "Carteira Física" (repete o card da carteira); `:121-138` carteira em bloco especial com texto explicativo (`:127-133`); `:170` tipo como badge; `:181-188` agência/número no card; `:193-208` ícones soltos; `:231` a confirmação não avisa das transações.

### Cartão de crédito

| Posição | O que vai |
|---|---|
| Coleção | fora do molde (exceção aprovada): grade de "cartões físicos"; escolher um abre o painel da fatura embaixo |
| Identidade | o próprio cartão: cor do banco (`BancoCor`), bandeira e "•••• `UltimosDigitos`" |
| Título | `Nome` |
| Meta | `BancoNome` · prazo que pede ação: "vence em N dias" (≤5) > "fecha em N dias" (≤5) > "vence dia X" |
| Valor principal | `LimiteDisponivel` ("Disponível") |
| Status | — (a listagem só devolve cartão ativo) |
| Progresso | `LimiteUsado` de `Limite` + %, tom de aviso acima de 80% |
| Ações do ⋮ | Editar · Remover (confirma avisando que as compras do cartão somem do extrato, `CartaoCreditoService.cs:141-151`) |
| Resumo do topo | Disponível (soma) · Usado de limite total. 2 números |
| Só no detalhe | faturas (ver Fatura), conta que paga (`ContaNome`), débito/pré-pago |
| Nunca mostrar | — (o número completo nem existe; só os 4 finais) |

**Hoje diverge em:** `CreditCards/CreditCardsPage.tsx:717-723` cabeçalho próprio e "Novo Cartão" (maiúscula); `:729-730` contador "Cartões" no resumo; `:642-645` ícones soltos em vez de ⋮; `:680` barra própria em vez de `PontesProgress`; `:699` rótulo "Faturas / Em foco" em todo cartão; `:752-756` vazio com texto explicativo e sem botão; `:981-988` remover sem `tone="danger"`; Dashboard `CartaoTile` mostra só o fechamento (aqui a regra é o prazo que pede ação).

### Fatura

| Posição | O que vai |
|---|---|
| Coleção | fora do molde: 1 fatura por vez no painel do cartão, navegando mês a mês. Dentro dela, `list` da linha do tempo: compra ("descrição" · data · categoria · valor), parcela ("descrição (2/10)", leva ao parcelamento), pagamento ("Pagamento · Pix" · data · "− valor") |
| Identidade | — (o cartão em cima já identifica) |
| Título | "Fatura de outubro" (mês do fechamento) |
| Meta | "fecha 05/10 · vence 12/10" (relativa se ≤7 dias) |
| Valor principal | `ValorRestante` se > 0, senão `ValorTotal` |
| Status | aberta ou fechada em dia = sem badge. **Atrasado** (`Vencida`) · **Parcial** (fechada, `ValorPago` > 0 e ainda resta) · **Pago** (fechada, restante 0) · **Previsto** (NOVO: ciclo que ainda não começou, ou projeção das contas fixas) |
| Progresso | "Pago R$ X de R$ Y", só quando `ValorPago` > 0 e ainda resta |
| Ações do ⋮ | é detalhe: botão **Pagar** visível no topo da fatura (some em Previsto e em ciclo futuro) |
| Resumo do topo | — (usa o do Cartão) |
| Só no detalhe | hora de cada lançamento, período início–fechamento, data do pagamento total |
| Nunca mostrar | — |

**Hoje diverge em:** `CreditCards/CreditCardsPage.tsx:130,821` badge "Aberta" em fatura normal; `:131` "Fechada" como badge; `:822` "Vencida" (vocabulário: Atrasada); `:133` "Futura" e `:820` "Prevista" (dois nomes pra mesma ideia → Prevista); `:571,591,602` hora em toda linha (meta com 3-4 fatos); `:609-617` "Total pago" repete o que `:828` e a barra `:838-841` já dizem; `src/types/Fatura.ts` tem `status`/`statusDescricao`, que o `FaturaDto` não manda.

### Parcelamento

| Posição | O que vai |
|---|---|
| Coleção | `list` (aba Parcelamentos dentro de Cartões) + `PontesSegmented` **Ativos \| Encerrados** |
| Identidade | ícone Layers |
| Título | `Descricao` |
| Meta | `CartaoCreditoNome` · "próxima: fatura de outubro" (`ProximaParcela.FaturaMesReferencia`) · tipo só se não for compra parcelada ("PIX Crédito") |
| Valor principal | `ValorComJuros ?? ValorOriginal` (o total da compra: é por ele que a pessoa reconhece) |
| Status | **Cancelado** (`Ativo=false`) · **Pago** (ativo e `ValorRestante` = 0). Em andamento = sem badge |
| Progresso | `ParcelasPagas` de `QuantidadeParcelas` ("4 de 12") |
| Ações do ⋮ | Cancelar parcelamento (ver Decisão 5) |
| Resumo do topo | Restante a pagar (`TotalRestante`), cor do texto. 1 número |
| Só no detalhe | valor pago, restante, juros (`TaxaJuroMensal`), data da compra, parcelas, data e motivo do cancelamento |
| Nunca mostrar | — |

Filtro "Encerrados" (pagos + cancelados) **precisa de filtro novo no back**: o `ativo` de hoje só separa os cancelados.

**Hoje diverge em:** `Parcelamentos/index.tsx:184-190` cabeçalho próprio e "Novo Parcelamento"; `:193-194` StatCard "Ativos" (contador), hints explicativos e "A pagar" em vermelho; `:200` "N registrados"; `:226` "12× · 3/12 pago" repete o progresso; `:235-246` rodapé com 2 fatos a mais; nome do cartão não aparece; `:250-253` botão "Detalhes" em vez de linha clicável; sem Ativos \| Encerrados; `Parcelamentos/[id].tsx:144` h1; `:126` tipo 2 (Recorrente) aparece como "PIX Crédito"; `:167` "Restante" em vermelho.

### Parcela (de parcelamento e de empréstimo)

| Posição | O que vai |
|---|---|
| Coleção | `list` dentro do detalhe do pai, sem paginação (poucas) |
| Identidade | — (o número basta) |
| Título | "Parcela 3 de 12" (`Numero` de `QuantidadeTotal`) |
| Meta | cartão: "fatura de outubro · vence 12/10" (`FaturaMesReferencia`, `FaturaDataVencimento`). Empréstimo: "vence 12/10" (`DataVencimento`) |
| Valor principal | cartão: `ValorComJuros ?? Valor`. Empréstimo: `ValorComMulta ?? ValorComJuros ?? Valor` |
| Status | a vencer = sem badge. **Pago** · **Cancelado**. Empréstimo também: **Atrasado** (`Atrasada`) · **Parcial** (`ValorPago` > 0 e menor que o devido) · **Pendente** (NOVO: pagamento esperando o credor aprovar). Cartão: parcela em fatura já coberta pelo pagamento **precisa de campo novo**: o DTO copia o status cru (`ParcelamentoService.cs:570`), então ela aparece "Pendente" com "Pagar", embora a regra `RegrasFinanceiras.ParcelaQuitadaPelaFatura` a trate como paga (reconferir e catalogar) |
| Progresso | — (o do pai) |
| Ações do ⋮ | cartão: Pagar antecipado (só a vencer). Empréstimo: nenhuma por linha (pagamentos pelo topo do detalhe) |
| Resumo do topo | — |
| Só no detalhe | taxa, IOF, data em que foi paga (`PagoEm`), data e motivo do cancelamento |
| Nunca mostrar | — |

**Hoje diverge em:** `Parcelamentos/[id].tsx:30,212` badge "Pendente" amarelo em toda parcela normal; `:188` contador "Parcelas (N)"; `:205` número pelo índice (`i+1`), não por `Numero`; `:218-222` "Pagar" como botão solto; `Emprestimos/EmprestimoDetalhePage.tsx:188-194` mostra "Pendente" (`StatusDescricao`) até em parcela atrasada ou parcial (só a cor muda); `:164` contador "Parcelas (N)".

### Conta fixa (Recorrente)

| Posição | O que vai |
|---|---|
| Coleção | `list` + `PontesSegmented` Ativas \| Encerradas (referência da fase 1) |
| Identidade | ícone de entrada ou saída (o mesmo da Transação) |
| Título | `Descricao` |
| Meta | frequência só se não for mensal (`FrequenciaDescricao`) · conta ou cartão (`ContaNome ?? CartaoCreditoNome`) · próxima cobrança (`DataProximaGeracao`, relativa se ≤7 dias) |
| Valor principal | `Valor`, "+" / "−" |
| Status | **Pausado** · **Cancelado** · **Encerrado** (`Situacao`). Ativa = sem badge |
| Progresso | — |
| Ações do ⋮ | Editar próxima ocorrência · Pausar ou Retomar · Cancelar conta fixa · Excluir |
| Resumo do topo | Custo mensal (`CustoMensalDespesas`, contexto "R$ X por ano") · Próximos 30 dias (`Proximas30Dias`) |
| Só no detalhe | categoria, dia, início e fim, motivo do cancelamento |
| Nunca mostrar | — |

**Hoje diverge em:** `Recorrentes/RecorrentesPage.tsx:602` frequência como badge colorido em todo item (inclusive Mensal); `:603` categoria como badge; `:606-613` 2ª e 3ª linhas (próxima cobrança, motivo) além da meta; `:512-513` contador "ativas" no resumo; `:524-545` faixa "Próximas cobranças" repete itens da coleção (Decisão 3).

### Empréstimo

| Posição | O que vai |
|---|---|
| Coleção | `list` + `PontesSegmented` para direção (Tudo \| A receber \| A pagar) e situação (Decisão 2) |
| Identidade | logo do banco (`BancoLogoUrl`, `BancoCor`) ou avatar com as iniciais da pessoa |
| Título | `Descricao` |
| Meta | pessoa ou banco (`BancoNome ?? ContraparteNome ?? Pessoa`) · "10x" ou "à vista" · vencimento (`DataVencimento`, relativa se ≤7 dias) |
| Valor principal | `ValorRestante`: "+" a receber (verde), "−" a pagar (cor do texto). A direção vive no sinal, não em badge |
| Status | **Atrasado** (`Vencido`) · **Pendente** (NOVO: convite de vínculo esperando aceite, ou pagamento esperando sua aprovação: `ValorPendente` > 0 e `SouCredor`) · **Pago** (`Quitado`) · arquivado/consolidado: Decisão 2. Vinculado = normal, sem badge |
| Progresso | `ValorPago` de `ValorTotal` (`PercentualPago`) |
| Ações do ⋮ | Registrar pagamento · Marcar como quitado (credor) · Vincular a uma pessoa (sem vínculo) · Histórico de pagamentos (vinculado) · Arquivar ou Desarquivar · Remover |
| Resumo do topo | A receber · A pagar · Atrasado a receber (`TotalAReceberVencido`) |
| Só no detalhe | juros e multa (`TaxaJuroMensal`, `PercentualMultaAtraso`, `ValorComJuros`, `ValorComMulta`), observação, parcelas, data de início, origem, valor recusado |
| Nunca mostrar | — |

**Hoje diverge em:** `Emprestimos/EmprestimosPage.tsx:33` h1; `:59` "Vencido" (vocabulário: Atrasado); `:63-64` contador "Ativos" no resumo; `:153-204` `<table>`; `:185-189` badge "A receber / A pagar" em todo item; `:194` "a pagar" em vermelho; `:132-140` toggle "Arquivados"; `Emprestimos/EmprestimosLabItemParts.tsx:11` "Quitado" (→ Pago), `:12` "Vencido" (→ Atrasado), `:13-15` "Vinculado" em item normal, `:17,20` "Convite pendente" / "Aguardando sua aprovação" (→ Pendente); `Emprestimos/EmprestimoDetalhePage.tsx:75` h1, `:113` "Restante" em vermelho.

### Meta

| Posição | O que vai |
|---|---|
| Coleção | `cards` |
| Identidade | ícone Target (o DTO não tem ícone por meta) |
| Título | `Nome` |
| Meta | prazo (`DataLimite`: "faltam 40 dias" ou "até dez/2026"; sem prazo = nada) |
| Valor principal | `ValorAtual` em destaque |
| Status | **Concluído** (NOVO, `Concluida`) · **Atrasado** (prazo passou e não concluiu) |
| Progresso | barra + "de R$ `ValorAlvo`" + % (`PercentualConcluido`) |
| Ações do ⋮ | Contribuir (1º; some se concluída) · Editar · Excluir (ver Decisão 6) |
| Resumo do topo | Guardado, com contexto "de R$ alvo total · 40%". 1 número |
| Só no detalhe | `Descricao`, quanto falta, data absoluta, criada em |
| Nunca mostrar | — |

**Hoje diverge em:** `Metas/MetasPage.tsx:205` h1; `:231-237` contadores "metas" e "concluídas"; `:393` descrição no card; `:398` "Concluída" (termo novo a aprovar); `:401-406` ícones soltos; `:425-441` "Faltam R$" + prazo relativo e `:449-451` prazo absoluto de novo; `:447,459` emojis; `:453-460` botão Contribuir fora do ⋮.

### Limite (orçamento por categoria)

| Posição | O que vai |
|---|---|
| Coleção | `cards` do mês escolhido (navegação de mês única, `PontesMonthInput`) |
| Identidade | ícone genérico de categoria (Categoria não tem ícone); "Geral" com outro ícone |
| Título | `CategoriaNome ?? "Geral"` |
| Meta | "sobram R$ X" ou "R$ X acima" (`ValorRestante`) |
| Valor principal | `ValorGasto` |
| Status | **Estourado** (NOVO, `Ultrapassado`). Em alerta (`EmAlerta`) = sem badge, só a barra muda de tom |
| Progresso | barra (tom normal, aviso ou perigo) + "de R$ `ValorLimite`" + % (`PercentualConsumido`) |
| Ações do ⋮ | Editar · Excluir |
| Resumo do topo | Gasto, com contexto "de R$ orçado" (sem somar o "Geral" junto com as categorias) · em alerta · estourados |
| Só no detalhe | % de alerta (`PercentualAlerta`) |
| Nunca mostrar | — |

**Hoje diverge em:** `Limites/LimitesPage.tsx:216` h1 "Limites por Categoria"; `:224-240` 2 selects de período; `:244-245` o resumo soma "Geral" + categorias (conta em dobro); `:411-413` mês/ano em todo card (a página já filtra); `:416-427` "Ultrapassado" / "Em alerta" (vocabulário); `:443,453` gasto mostrado 2 vezes; `:466-468` "Alerta em X%" no card; `:428-433` ícones soltos.

### Categoria e subcategoria

| Posição | O que vai |
|---|---|
| Coleção | fora do molde (exceção aprovada): árvore categoria → subcategorias, em 2 seções (Minhas / Padrão) |
| Identidade | categoria: nenhuma (não tem ícone). Subcategoria: bolinha com `Cor` (`Icone` existe no DTO e não é usado) |
| Título | `Descricao` / `Nome` |
| Meta | finalidade só quando não é despesa ("Receita", "Ambas"), em texto |
| Valor principal | — |
| Status | — (padrão = cadeado, não badge) |
| Progresso | — |
| Ações do ⋮ | categoria: Nova subcategoria · Excluir (só pessoal). Subcategoria: Editar · Excluir (só pessoal). O back não tem editar categoria |
| Resumo do topo | nenhum |
| Só no detalhe | — |
| Nunca mostrar | — |

**Hoje diverge em:** `Categories/CategoriesPage.tsx:205` h1; `:208` "Nova Categoria"; `:158` finalidade como badge colorido em toda linha; `:159` contador "N sub"; `:217,237` subtítulos explicativos; `:219,239` contadores por seção; `:178` hint "Clique no + pra adicionar"; `:162-171,184-191` ícones soltos.

### Banco

| Posição | O que vai |
|---|---|
| Coleção | fora do molde: não tem tela pra pessoa (catálogo do sistema; só admin grava, `BancosController.cs`). Aparece como **identidade** de Conta, Cartão e Empréstimo e no seletor do formulário de conta |
| Identidade | `PontesBankBadge` com `LogoUrl` + `Cor` (sem logo: iniciais de `NomeFantasia`) |
| Título | `NomeFantasia` (no seletor) |
| Meta | `CodigoBanco`, só no seletor, pra separar nomes parecidos |
| Valor principal | — |
| Status | — |
| Progresso | — |
| Ações do ⋮ | — |
| Resumo do topo | — |
| Só no detalhe | razão social, tipo |
| Nunca mostrar | — |

**Hoje diverge em:** `Bancos/BancosPage.tsx` é uma segunda tela de contas sem rota (só `src/test/pages/BancosPage.test.tsx` usa): código morto; `Accounts/AccountsPage.tsx:160` usa `nomeFantasia` e `Dashboard/DashboardPage.tsx:355` usa `bancoNome` pro mesmo selo.

---

## Família

### Família (o grupo)

| Posição | O que vai |
|---|---|
| Coleção | `cards` (poucas por pessoa); clicar abre o detalhe |
| Identidade | ícone Users |
| Título | `Nome` |
| Meta | "N membros" (`TotalMembros`) · seu papel ("Admin" via `EhAdmin`; o rótulo "Cônjuge" **precisa de campo novo**, hoje exige abrir o detalhe) |
| Valor principal | seu saldo do mês: "a receber R$ X" / "a acertar R$ X" / "quitado". **Precisa de campo novo** (endpoint de resumo; hoje são 2 chamadas por família, `FamiliasPage.tsx:60-72`) |
| Status | — |
| Progresso | — |
| Ações do ⋮ | nenhuma no card (Sair e Dissolver ficam no ⋮ do detalhe, com contexto) |
| Resumo do topo | `/familias`: nenhum; em cima dos cards, caixa de pendências (convites recebidos). Detalhe: Total do mês (`BalancoFamiliaDto.Total`) · Sua cota · Seu saldo (a receber / a acertar) |
| Só no detalhe | modo de divisão, limite de aprovação, membros, balanço por pessoa (bloco próprio: pagou · cota · saldo) |
| Nunca mostrar | renda de outro membro; contas, cartões e saldo pessoal de outro membro (visão §8) |

**Hoje diverge em:** `Familia/FamiliasPage.tsx:140` h1; `:142` "Nova Família" com ícone Users; `:191` badge "Admin" (papel não é status; vai pra meta); `:195-205` pilha de avatares + nomes; `:209` modo de divisão no card; `:69-71` erro vira dado falso ("Igualitário", "Sem despesas no mês"); `Familia/FamiliaDetalhe.tsx:486` h2 próprio; `:487` papel como badge; `:492` Dissolver solto no topo; `:571` hint "equilíbrio do mês"; `:579-583` balanço em texto corrido; `:132-140` preso ao mês atual.

### Membro

| Posição | O que vai |
|---|---|
| Coleção | `list`, seção Membros do detalhe, sem paginação |
| Identidade | avatar com iniciais |
| Título | `NomeUsuario` ("você" na própria linha) |
| Meta | rótulo (`Papel`: "Cônjuge") · permissão só quando é Admin ou Dependente (`PapelPermissao`) |
| Valor principal | nenhum (o saldo de cada um fica no bloco Balanço). Na própria linha, a própria renda com olhinho |
| Status | — |
| Progresso | — |
| Ações do ⋮ | própria linha: Definir minha renda · Sair da família. Admin, em outro membro: Editar rótulo · Mudar permissão (endpoints existem, tela não: 2.3) · Remover membro. Esconde o que o papel não permite |
| Resumo do topo | — |
| Só no detalhe | não há detalhe de membro: "desde" (`EntrouEm`) e e-mail ficam fora da linha (e-mail: Decisão 4) |
| Nunca mostrar | `RendaMensal` de outro membro (nem o valor, nem "tem/não tem"; o PR 0 tira do back); e-mail de outro membro pra quem não é Admin (Decisão 4; o back manda pra todos, `FamiliaService.cs:83`) |

**Hoje diverge em:** `Familia/FamiliaDetalhe.tsx:519` e-mail + "desde" na linha; `:520` renda de todos pra todos; `:516` rótulo como badge; `:524-526` "Definir renda" em todos os membros (o back só deixa a própria); `:527-537` ícones soltos (lixeira pra "Sair", que não apaga nada); `src/types/Familia.ts` sem `papelPermissao` (o DTO tem).

### Convite

| Posição | O que vai |
|---|---|
| Coleção | enviados: `list` (seção Convites dentro de Membros, só Admin). Recebidos: **caixa de pendências** (exceção aprovada: Aceitar/Recusar visíveis) no topo de `/familias` |
| Identidade | ícone Mail |
| Título | enviado: `EmailConvidado`. Recebido: `NomeFamilia` |
| Meta | "como `Papel`" · "expira em N dias" (`ExpiraEm`). Recebido: quem convidou **precisa de campo novo** (o DTO não traz) |
| Valor principal | — |
| Status | **Expirado** (NOVO: `ExpiraEm` passou e o status ainda é Pendente; o back só marca Expirado quando alguém tenta aceitar, `ConviteService.cs:137-139`). Pendente = normal (a seção já diz) |
| Progresso | — |
| Ações do ⋮ | enviado: Revogar (confirma). Recebido: Aceitar · Recusar (confirma), visíveis |
| Resumo do topo | — |
| Só no detalhe | data de criação, permissão (`PapelPermissao`) |
| Nunca mostrar | `Token` e e-mail do convidado pra quem não é Admin (P3 do plano; o back manda pra todos, `FamiliaService.cs:90`) |

**Hoje diverge em:** `Familia/FamiliaDetalhe.tsx:551` "e-mail — papel" em texto solto, sem prazo; `:553` revogar sem confirmação, ícone solto; `Familia/FamiliasPage.tsx:158-159` Aceitar/Recusar sem trava de clique duplo e Recusar sem confirmação; `src/types/Familia.ts` sem `papelPermissao`.

### Acerto

| Posição | O que vai |
|---|---|
| Coleção | `list`, aba Acertos do detalhe, do mês escolhido |
| Identidade | ícone de seta (de → para) |
| Título | "`DeNome` → `ParaNome`" ("Você" no lugar do próprio nome) |
| Meta | referente a (`Mes`/`Ano`) · registrado em (`CriadoEm`) |
| Valor principal | `Valor`, cor do texto, sem sinal |
| Status | — (a lista só traz ativos; mostrar **Cancelado** exige filtro novo no back) |
| Progresso | — |
| Ações do ⋮ | Cancelar acerto (confirma), só pra quem é parte (De/Para). Quem registrou sem ser parte **precisa de campo novo** (`CriadoPor` não vem no DTO) |
| Resumo do topo | — (o Balanço do detalhe responde) |
| Só no detalhe | `Observacao` |
| Nunca mostrar | `Observacao` pra quem não é parte do acerto (visão §8: comprovante só pros envolvidos; o DTO manda pra todos) |

**Hoje diverge em:** `Familia/FamiliaDetalhe.tsx:741` observação na linha; `:746-748` cancelar com ícone de lixeira solto e visível pra qualquer membro (o back recusa terceiros); `:740` nomes sem "Você".

### Despesa compartilhada

| Posição | O que vai |
|---|---|
| Coleção | `list`, aba Despesas do detalhe, do mês escolhido. As que esperam **sua** aprovação sobem pra caixa de pendências (Aprovar/Recusar visíveis) |
| Identidade | avatar com iniciais de quem pagou |
| Título | `Descricao` |
| Meta | "pago por `PagadorNome`" ("você") · `CategoriaNome` · data |
| Valor principal | `Valor`, cor do texto. "Sua parte" **precisa de campo novo** |
| Status | **Pendente** (NOVO: esperando aprovação) · **Recusado** (NOVO, `Rejeitada`). Aprovada ou sem aprovação = sem badge |
| Progresso | — |
| Ações do ⋮ | Atribuir responsável · Atribuir a dependente · Definir divisão · Parar de compartilhar (endpoint existe, tela não). Esconde o que o papel não permite |
| Resumo do topo | — (o Balanço do detalhe) |
| Só no detalhe | responsável (`ResponsavelNome`), quem aprovou (`AprovadoPorNome`), divisão |
| Nunca mostrar | conta ou cartão que quem pagou usou (visão §8; o DTO já não manda: manter) |

**Hoje diverge em:** `Familia/FamiliaDetalhe.tsx:664-669` tudo numa linha de texto corrido; `:48` badge "Aprovada" em item normal; `:49` "Rejeitada" (→ Recusada); `:668` responsável como badge; `:685-692` seletor de responsável dentro de toda linha; `:675-682` Aprovar/Rejeitar como ícones soltos na lista; categoria não aparece.

### Dependente

| Posição | O que vai |
|---|---|
| Coleção | `list`, aba Dependentes do detalhe |
| Identidade | ícone pelo tipo (criança, idoso, pet, outro) |
| Título | `Nome` |
| Meta | tipo (texto) · idade (calculada de `DataNascimento`) |
| Valor principal | gasto do mês **precisa de campo novo** na listagem (hoje só `GET .../gastos`, um por dependente) |
| Status | — (a lista só traz ativos) |
| Progresso | — |
| Ações do ⋮ | Editar · Remover dependente (confirma; o back inativa) |
| Resumo do topo | — |
| Só no detalhe | apelido, data de nascimento |
| Nunca mostrar | data de nascimento completa na linha (só a idade) |

**Hoje diverge em:** `Familia/FamiliaDetalhe.tsx:714` tipo como badge; `:712` apelido na linha; `:718-723` ícones soltos (lixeira pra "Inativar"); `:703` vazio em texto, sem botão.

---

## Decisões para o Gustavo

1. **Termos novos de status.** As regras não cobrem 6 situações: **Previsto** (transação futura, fatura de ciclo futuro), **Pendente** (esperando resposta de alguém: aprovação de despesa, convite de empréstimo, pagamento a aprovar), **Recusado** (despesa rejeitada), **Concluído** (meta batida), **Estourado** (limite ultrapassado), **Expirado** (convite vencido). *Recomendo aprovar os 6.* Se quiser a lista menor: Concluído vira Encerrado e Expirado vira Encerrado (sobram 4).
2. **Empréstimos: o toggle "Arquivados" vira `Ativos | Encerrados`?** (o plano já pedia essa decisão). *Recomendo sim:* Encerrados = pagos + arquivados + consolidados; "Arquivar" continua no ⋮ pra encerrar um que não foi pago (badge **Encerrado**). Precisa de filtro no back (hoje é `incluirArquivados`).
3. **Contas Fixas: tirar a faixa "Próximas cobranças"?** Ela repete itens da coleção e é montada só com a página carregada (bug em `RecorrentesPage.tsx:256`). *Recomendo tirar:* a linha já diz "próxima em 3 dias" e o resumo já tem "Próximos 30 dias". Alternativa: manter, com dado vindo do servidor.
4. **E-mail dos outros membros e dos convidados: quem vê?** Hoje todos veem (tela e API). *Recomendo só Admin* (cada um vê o próprio); os demais veem nome + rótulo. Vale pro back também, como a renda no PR 0.
5. **Parcelamento: "Cancelar" no ⋮ da lista?** A lista tirou o cancelar de propósito (`Parcelamentos/index.tsx:254-255`: "cancelava às cegas"), mas a regra pede ⋮ em toda linha. *Recomendo ⋮ com "Cancelar parcelamento"* e uma confirmação que mostra "4 pagas · 8 serão canceladas · R$ 2.400 voltam ao limite" (tudo já vem no DTO). Resolve o "às cegas" sem abrir exceção.
6. **Meta: "Contribuir" como botão visível no card ou 1º item do ⋮?** A regra só abre exceção pra caixa de pendências. *Recomendo 1º item do ⋮*, por consistência: se Contribuir ganha botão, Pagar parcela e Registrar pagamento vão pedir o mesmo.

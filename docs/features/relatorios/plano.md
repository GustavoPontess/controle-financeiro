# Relatórios: plano da tela final

> Pedido do Gustavo (2026-10-28): "a gente precisa melhorar essa tela, colocar bons gráficos; aqueles insights que colocamos jogados pelo app, centralizar eles na tela de relatórios". É PLANO, não construção. Pesquisa: código atual, docs internos, concorrentes (Monarch, YNAB, Copilot, Rocket Money, Mobills, Organizze, Itaú, Nubank, Yodlee) e dataviz (Few, Tufte, FT Visual Vocabulary, Datawrapper). Desenho da tela: artefato "Relatórios do Pontes" (link no STATE.md).

> **Estado em 2026-11-02** (o que já está na main, além do plano abaixo): linha do tempo de janeiro a dezembro no bloco de cima (é também o seletor de mês); seletores Ano e Período com o **"Ano completo"** (`GET /relatorios/ano`: ano somado contra o planejado, categorias contra o mesmo período do ano anterior e o limite do ano, ritmo do ano, contas fixas e parcelas do ano, reserva pelo gasto médio do ano); "Baixar" = o relatório em PDF (impressão do navegador); categorias numa lista só com normal e limite na linha, todas elas (as 5 maiores com cor, o resto em "Mais N categorias", sempre por último) e o orçamento em tom claro da cor (o que passou em tom escuro). PRs #393, #402 a #405 e #409. Decisões do Gustavo que valem pra frente: a tela é igual em todo período (nada aparece ou some ao trocar de mês, fora o que é só de mês no "Ano completo"); nada repetido em dois lugares; barras com pontas arredondadas.

Relatórios continua sendo o **check-up do mês** (a camada 3 de `docs/features/respostas/visao.md`): a soma das respostas das outras telas. Cada conta mora onde já mora; Relatórios só **agrega** no servidor e mostra. Fora: Sankey (decisão pendente, ver §8), calendário de gastos, chips de tema, comparar com período livre, relatório salvo, compartilhar imagem.

## 1. O que a tela responde, nessa ordem

1. **Como foi o mês?** (entrou, saiu, sobrou; fechou?)
2. **O que vale olhar agora?** (sinais do mês + o que falta pra o app responder melhor)
3. **Vai dar?** (só no mês atual: já saiu, ainda vem, livre)
4. **Pra onde foi? Estou acima do normal em alguma coisa?**
5. **Dá pra cortar onde?**
6. **Quanto da renda já tem dono antes do mês começar? E quanto sobra por mês?**
7. **Como estou comparado aos últimos meses?**
8. **Quanto tempo o que eu tenho dura?**
9. **Quero os dados** (exportar)

Regras que valem pra tudo: a frase vem pronta do servidor (`RespostaDto`: tom + texto + ações), o front nunca calcula nem fração nem tom; todo número passa pelas regras únicas (`RegrasFinanceiras`, `GastosPorCategoriaDoMesAsync`, `RendaService.EhRenda`, `ParcelasPorMesAsync`, `FaturasAPagarNoMesAsync`, `PrevistosDoMesAsync`); cor e tamanho só por tokens `--v2-*`; gráfico em SVG próprio em `src/componentes` no molde do `GraficoLinha`, com lista sr-only, rótulo direto e toque de 44px; PT-BR simples, sem travessão, sem subtítulo explicativo. Desktop primeiro dentro do PR, 375px conferido antes do PR fechar (a main vai pra produção).

## 2. A tela final, seção por seção

### 2.1 Topo
`NavegadorMes` à esquerda; "Exportar lançamentos do mês (CSV)" à direita (celular: ícone com aria-label). Sem título decorativo. Espaço Pessoal/Família é o do layout, não filtro da tela.
Novo: `NavegadorMes` ganha prop `ate` (último mês navegável = mês atual; seta pra frente desabilita). Back: `GET /relatorios/check-up` recusa mês futuro contra `HorarioBrasil.Hoje()` (400, defesa em profundidade).

### 2.2 Resumo do mês ("Como foi o mês?") · P0
A `Resposta` do check-up como manchete. Abaixo, três números grandes: Entrou, Saiu, Sobrou (com "% do que entrou"). Cada número com etiqueta de variação contra o mês anterior ("12% a menos que set/26"), cor pela direção, sem sinal +/−. Rótulos "até agora" no mês atual (já existe). O Comprometido sai daqui e ganha seção própria (2.7).
Frase (`CheckUpService.Responder`) com três ajustes: (a) "Sem categoria" (Guid.Empty) acima de 30% do saiu → "R$ X do mês ainda sem categoria." + ação **Classificar** (Transações filtrada); (b) saiu ≥ 30% e ≥ R$ 50 acima do `gastoNormal` → "Saiu X% a mais que o normal dos últimos meses." antes da frase da categoria (mesma régua; custo zero, o número já existe); (c) nada lançado → tom neutro com "Nova transação" e "Importar extrato".
Novo no back: `VariacaoEntrou/Saiu/Sobrou` (a série MesAMes já tem os dois meses). P2: renda fixa × variável e "o que ainda entra de renda" sob o Entrou.
Celular: frase em largura cheia; Entrou e Saiu lado a lado, Sobrou em linha própria.

### 2.3 O que vale olhar ("O que o app tem pra me avisar?") · P0 (Seus dados) / P1 (agregados)
Lista de 0 a 6 cartões, cada um uma `Resposta` (variante nova `compacta`): ícone por origem, frase do servidor, UMA ação que leva à tela dona. Ordem do servidor: primeiro **Seus dados** (os outros números dependem deles), depois por tom (alerta > negativo > neutro > positivo) e, dentro do tom, por valor em reais (`Peso`). Lista vazia: a seção some. Mês passado: só o que vale pro mês navegado; o que é "de hoje" (empréstimo em 30 dias, metas, renda não dita) marcado `EhDeHoje` no DTO e só no mês atual.

**Seus dados** (três, saem do próprio `CheckUpDto` com dados já carregados):
- "37 lançamentos sem categoria (R$ 4.312)" → Classificar
- "Você ainda não disse quanto espera receber" → Dizer a renda (/orcamento)
- "Nenhuma conta fixa cadastrada." → Cadastrar conta fixa (só quando o mês tem gasto)

**Sinais de resposta** (só agregação, endpoint próprio `GET /relatorios/sinais`, chamado em paralelo com o check-up):
- categorias em "passou" ou "vai-passar" (até 3 + "e mais N") → Ver o planejado
- "as metas juntas cabem?" só quando NÃO cabem → Ver metas
- empréstimo que vence em 30 dias e o saldo não cobre → Ver empréstimos
- conta fixa que ficou sem limite no cartão (chave `CobrancaSemLimite` do mês) → Ver contas fixas
- "a ser alocado" negativo → Ver o orçamento
- fatura atrasada "R$ X" (tom alerta) → Ver cartões

Dedupe: o que a manchete já disse não entra de novo (por chave, coberto por teste).
Novo no back: `CheckUpDto.Sinais` + `QuantidadeSemCategoriaDoMesAsync` (pequeno, em `RegrasFinanceiras`); `SinaisDoMesService` que SÓ chama os services que já respondem (`OrcamentoService.DoMesAsync` uma vez, envelopando a frase string da categoria em `RespostaDto` com Tom = situação; `ViabilidadeMetaService.DasMetasAsync`; `ProximosEmprestimosService`; `FaturasAPagarNoMesAsync`; `NotificacaoService` pela chave). Devolve `List<SinalDto(Chave, Origem, Peso, EhDeHoje, Resposta)>`.

### 2.4 Vai dar? (só no mês atual) · P1
`UsoDaRenda` na variante nova **`compacta`**: topo ("x% usado", recebeu), barra empilhada por categoria (`--v2-serie-1..5`, "ainda vem" listrado, marca "sua renda"), legenda Já saiu e a linha Livre ou Passou. SEM faturas a pagar, SEM parcelas futuras (moram em 2.7) e SEM a frase (manchete e sinais já respondem). O Início continua com a completa (`visao.md:48`). Mês passado: a seção não aparece.
Dados: `GET /dinheiro-do-mes` existente. Cor por categoria igual à do "Pra onde foi" (mesmos ids, mesma ordem).
P2: linha "Ritmo" (gasto até hoje × gasto típico até o mesmo dia), frase do servidor.

### 2.5 Pra onde foi ("e estou acima do normal?") · P0
Componente novo **`GraficoBarrasComparacao`** (SVG/CSS próprio): barras horizontais ordenadas pelo gasto, valor e % do saiu direto na barra, pedaço listrado do previsto no fim (padrão `fracaoAVir`), **um traço vertical no ponto do "normal"** (bullet do Few: passou do traço = acima, tom alerta se ≥ 30% e ≥ R$ 50; abaixo = positivo). Rótulo curto à direita: "+32% do normal", "Novo neste mês", "Sem meses pra comparar". Até 6 categorias + "Outras" (cinza-2). **"Sem categoria" fora do ranking**, em `--v2-serie-cinza`, última linha com "N lançamentos sem categoria" e ação Classificar; se for a maior fatia, a frase do servidor acima do gráfico. Clique na categoria abre Transações filtrada por categoria e mês (nunca página de detalhe).
Por que barras e não pizza: pizza mostra só proporção e não marca o normal (Monzo, Revolut e Simplifi apanham por isso; FT Visual Vocabulary).
Novo no back: `Previsto` por categoria (já vem e é descartado), `SemCategoria { Valor, Quantidade }` fora da lista. P2 (desktop): segundo traço "planejado" quando a categoria tem limite.
Celular: uma coluna, nome em cima, barra em largura cheia, valor à direita; linha inteira com 44px.

### 2.6 Dá pra cortar onde? · P1 (v1) / P2 (v2)
Frase do servidor + lista curta (até 3) do que mais passou do normal: "R$ X a mais que o normal", "ainda vem R$ Y" quando há previsto, ações **Ver lançamentos** e **Pôr um planejado**. Versão 1 (sem o dado "essencial"): categorias acima do normal ordenadas pelo a-mais + conta fixa que começou no mês ("Conta fixa nova: Streaming X, R$ 59,90", por `Recorrente.DataInicio`). Ignora Sem categoria. Nada acima do normal: uma linha positiva. Sem histórico: some. Versão 2 (com `Categoria.Essencial`, migration + seed + edição em Categorias): prioriza não essenciais e a frase vira "se cortar metade de X e Y, sobram R$ Z por mês".
Novo no back: `CorteDto(Resposta, Itens[Categoria, Valor, Normal, AMais])` no `CheckUpService`.

### 2.7 Comprometido pro futuro (e a folga por mês) · P1
Número grande "% da renda" com **bullet** único (faixas pelos tokens novos `--v2-faixa-1..3`, limites 40/60 vêm no DTO) e frase do servidor. Abaixo, **"Folga por mês: R$ X"** (renda esperada − contas fixas − gasto normal − parcelas; já existe em `ViabilidadeDasMetasDto.Folga`), com ação Ver metas quando há meta. Linhas abertas no desktop: "Contas fixas por mês: R$ X" com as 5 maiores (+ "e mais N", link /contas-fixas); "Parcelas: R$ Y neste mês" + próximos 3 meses + "depois, até mês/ano" + linha positiva quando uma parcela acaba no mês que vem; "Faturas a pagar este mês" à parte (total, pago, restante, atrasada em alerta; lado do caixa, nunca soma no gasto); "As metas pedem R$ Z por mês" (fora do %, link /metas). Sem renda: "Sem renda" + Dizer a renda (mês passado: "Sem renda em setembro", sem ação). Sem conta fixa nem parcelamento: 0% com "Nenhuma conta fixa cadastrada." + ação, nunca a frase some. Mês passado: etiqueta "contas fixas de hoje" (v1); v2 usa `ObterStatsAsync` com mês.
Novo no back: 5 maiores contas fixas, `ParcelasFuturas`, `ParcelaQueAcaba`, `Faturas`, `FolgaPorMes`, `MetasPedemPorMes`, `FaixasComprometido`, frase quando comprometido é 0.
Celular: número + barra em largura cheia; cada grupo só com o total e o link pra tela dona (sem acordeão).

### 2.8 Mês a mês · P0
Componente novo **`GraficoBarras`** (SVG próprio no molde do `GraficoLinha`): por mês, coluna Entrou (`--v2-positivo`) e Saiu (`--v2-texto-3`) pareadas, 3 linhas de grade com valor curto ("1,2 mil"), sobrou em texto abaixo com cor pelo sinal, mês escolhido destacado, dica por toque/hover, clique no mês navega pra ele. 12 meses no desktop. Etiqueta ao lado do título: "saiu 12% a menos que em setembro" (do servidor). Respeita o olho (`useHideBalance`). Lista sr-only. **Fecha a decisão pendente do ROADMAP (gráfico "comparar com o mês anterior") na opção (c)**.
Celular: 6 meses com "ver 12" (recorte de exibição), sem rolagem horizontal; valores só na dica.

### 2.9 Reserva · P1
Número grande "X meses" + "R$ Y nas contas ÷ R$ Z de gasto normal por mês", frase com tom (positivo ≥ 6, neutro 3 a 6, alerta < 3). **Caixinhas de meta ficam fora da reserva** e aparecem em "Guardado nas metas: R$ W" (link /metas). P2: `GraficoLinha` (existente) com o saldo no fim de cada um dos últimos 12 meses.
Correção verificada no back: `DinheiroGuardado` hoje soma caixinha de meta (`CheckUpService.cs:99`). Passa a usar `SaldoDisponivelAsync` em `RegrasFinanceiras` (Tipo != Caixinha, EncerradaEm == null), também no `ProximosEmprestimosService`. Unificar "gasto normal" num `GastoTipicoAsync` usado por CheckUp e ViabilidadeMeta (hoje são duas definições: uma com parcelas, outra sem).

### 2.10 Metas no mês · P2
Uma linha-resumo: "As metas pedem R$ X por mês · guardado em outubro R$ Y · folga R$ Z" com `BarraProgresso` recebendo `FracaoDaFolga` do servidor, ação Ver metas. Sem meta: não aparece.

### 2.11 Exportar · P2
"Exportar lançamentos do mês (CSV)" no topo (rótulo honesto: a base é a lista de lançamentos executados e não bate com o Saiu). Aposentar no ROADMAP os endpoints legados sem tela (`GET /relatorios` anual e `/relatorios/periodo`).

### 2.12 Relatórios da família (desenho, não construção) · P3
Mesma tela com o espaço Família: Pra onde foi da casa (pela parte gravada), "quem pagou × a parte de cada um" em barras por membro com copy de fato ("Ana pagou R$ 300 a mais; pra equilibrar outubro, Bruno passa R$ 300 pra Ana"; nunca deve/dívida/cobrar), contas fixas da casa × renda de quem liberou. Componentes recebem dados por props e não sabem do espaço. Só quando o Gustavo liberar a família (PR #336).

## 3. Insights centralizados

| Insight | Onde nasce | Como aparece em Relatórios |
|---|---|---|
| "Vai dar?" (renda do mês) | `DinheiroDoMesService`, Início (UsoDaRenda) | 2.4 no mês atual: UsoDaRenda `compacta`. O Início continua com a completa. |
| Limite por categoria ("vai passar", "passou") | `OrcamentoService.Responder`, Orçamento › Despesas | Sinal agregado (até 3 + "e mais N"), frase envelopada em RespostaDto. P2: traço "planejado" na barra. |
| "Toda a renda tem destino?" (a ser alocado) | `OrcamentoDoMesService` | Só quando negativo, como sinal. |
| "As metas juntas cabem?" | `ViabilidadeMetaService.DasMetasAsync`, Metas | Sinal só quando não cabem; "Folga por mês" em 2.7; linha 2.10. |
| "Essa meta cabe?" | `ViabilidadeMetaService`, formulário da meta | Não entra: resposta do momento da decisão. |
| Empréstimo que vence em 30 dias | `ProximosEmprestimosService`, Empréstimos | Sinal só no mês atual e só quando o saldo não cobre. |
| Aviso antes da compra | `AvisoDeCompraService`, formulário | Não entra: sem compra não há pergunta. |
| Limite 80% / passou (notificação) | `AlertaLimitesJob` + `NotificacaoService` | Não copia a notificação: o sinal nasce da mesma situação no `OrcamentoService` na hora. O sino segue como histórico. |
| Cobrança sem limite no cartão | `ExecutarRecorrentesJob` (`CobrancaSemLimite`) | Sinal pela chave única do mês. |
| Fatura atrasada | `FaturasAPagarNoMesAsync` (Atrasada) | Sinal de alerta + linha em alerta no Comprometido. |
| Check-up do mês | `CheckUpService` | Manchete; Responder passa a tratar Sem categoria, total acima do normal e comprometido 0. |
| Total do mês acima do normal | `CheckUpService` (gastoNormal já calculado) | Frase na manchete. Novo, custo zero. |
| Sem categoria (N lançamentos, R$ X) | Novo: `QuantidadeSemCategoriaDoMesAsync` | Primeiro sinal, última linha cinza do Pra onde foi, frase acima do gráfico quando é a maior fatia. |
| Renda não dita | `RendaService.ObterMesAsync.Previsto == 0` | Sinal "Seus dados" (Dizer a renda). |
| Nenhuma conta fixa cadastrada | `RecorrenteService.ObterStatsAsync.QtdTotal == 0` | Sinal "Seus dados" e frase do Comprometido em 0%. |
| Equilíbrio da família (pagou a mais) | `DespesaCompartilhadaService.ObterBalancoAsync` | Só no check-up da família (P3). |

## 4. Filtros e período
Só o `NavegadorMes` (com `ate` = mês atual), um mês por vez; Mês a mês e a linha da reserva mostram os 12 anteriores. Sem intervalo livre, sem "ano inteiro". Comparação: sempre contra o normal (média dos até 3 meses anteriores com gasto); o mês anterior aparece como etiqueta, sem seletor. Categoria: clique leva a **Transações filtrada no servidor pela URL** (`categoriaId`, `semCategoria`, `from`/`to`), com o filtro visível como chip removível; nunca filtro dentro de Relatórios. Olho de ocultar valores vale em todo número e gráfico.

## 5. Estados vazios e dados ruins
- Nada lançado no mês: manchete neutra com "Nova transação" e "Importar extrato"; as outras seções somem, menos Mês a mês se houver meses anteriores.
- Sem categoria grande (importação): primeiro sinal com contagem e valor; fora do ranking e em cinza; frase acima do gráfico quando é a maior fatia; ignorado em "cortar onde". A ação só existe depois de Transações ler o filtro pela URL (PR 3).
- Renda não dita: Entrou mostra o recebido; sinal "Dizer a renda" primeiro; Comprometido "Sem renda" + ação.
- Sem conta fixa nem parcelamento: Comprometido 0% com frase e ação.
- Sem histórico (primeiro mês): barras sem traço e sem rótulo de comparação; Reserva só com o dinheiro de hoje; "cortar onde" some; Mês a mês com um mês só.
- Mês passado: "Vai dar?" não aparece; sinais só do que vale pro mês (`EhDeHoje` false); "contas fixas de hoje" rotulado.
- Mês futuro: seta desabilitada; back recusa (400).
- Mais de 5 categorias: a 6ª em diante vira "Outras" em todos os gráficos, com os mesmos ids (categoria não muda de cor entre o UsoDaRenda e o Pra onde foi).

## 6. Biblioteca de gráficos
**Decisão: nenhum pacote npm.** Tudo em SVG/CSS próprio em `src/componentes`, no molde do `GraficoLinha`. Peças novas: `GraficoBarras` (colunas pareadas), `GraficoBarrasComparacao` (barras horizontais + previsto listrado + traço do normal), `Bullet` (uma medida contra faixas; tokens `--v2-faixa-1..3` nascem no mesmo PR, versão clara e escura). Tudo é geometria de retângulo com tokens.

Justificativa (conferida 2026-10-28): Recharts 3.10.1 custa 150 kB gz e 11 deps (redux inteiro); Nivo parado desde 2025-05 com 14 deps; Chart.js e ECharts em canvas (cor não vem de var CSS, acessibilidade por DOM perdida); `echarts-for-react` teve versões maliciosas em 2026-05 (Mini Shai-Hulud, também o ecossistema @antv); `d3-sankey` depende de d3-array 1-2 e d3-shape ^1, sem publicação desde 2022. Se o Sankey entrar (§8), ou é SVG próprio (fluxo de 2 colunas é geometria simples) ou `d3-hierarchy` (0 deps, Bostock) só pro cálculo, com a justificativa no PR.

Checklist de todo gráfico novo (vai no teste do componente): cor + rótulo (nunca só cor), lista sr-only equivalente, rótulo direto em vez de legenda, alvo de toque de 44px, dica por toque que fecha ao tocar fora, valor curto no eixo, tokens `--v2-*` (nunca hex), respeita `useHideBalance`, cabe em 375px sem rolagem horizontal. A paleta de séries atual (`--v2-serie-1..5`) passou no validador de daltonismo do skill de dataviz (pior par série-4/série-5 no tritan: ΔE 6,8, que só vale com rótulo direto, que a regra acima já exige); o cinza é neutro de propósito (Sem categoria/Outras) e nunca conta como série.

## 7. Fora do escopo
Sankey/treemap/pizza e qualquer biblioteca (Sankey: decisão em §8); calendário de gastos por dia; chips de tema, seletor "comparar com", acordeão; relatórios salvos, intervalo livre, por meio de pagamento, por conta/cartão, por subcategoria (P3); Summary do Monarch (maior lançamento, quantidade) e sinal "compra grande" (Yodlee): vistos, P3; gasto por estabelecimento (não existe Merchant); conversa/IA e modo "juntar mais" (camada 5); resumo compartilhável; sinais novos como notificação (o job é a camada 4); repetir o Início com outra base (saldo total, Entrou/Saiu de caixa, contas, cartões, recentes); mexer em Transações além de ler o filtro pela URL; família além do desenho.

## 8. Decisões pra pedir ao Gustavo (uma por vez, na ordem em que travam)
1. ✅ **Caixinha de meta conta na reserva? NÃO** (decidido pelo Gustavo, 2026-10-28): dinheiro já com destino; a Reserva usa só as contas e mostra "Guardado nas metas" à parte. Destrava o PR 1.
2. ✅ **"Gasto normal" inclui parcelas? SIM** (decidido pelo Gustavo, 2026-10-28). Conferido no código antes: não há bug de parcela virando previsto. A parcela entra como GASTO no mês em que vence (`GastosPorCategoriaDoMesAsync`), nunca como previsto; o "ainda vem" só tem lançamento em previsão (conta fixa). O "meta cabe?" tira as parcelas PASSADAS do normal só porque soma à parte as parcelas FUTURAS (média do prazo da meta), que é mais certo: parcela que acaba deixa de pesar e compra nova já pesa. Por isso o `GastoTipicoAsync` único devolve as duas partes (dia a dia + parcelas): Relatórios mostra o total como "gasto normal"; Metas segue com dia a dia + parcelas futuras, sem contar duas vezes. Destrava o PR 10.
   **Achado no caminho (Gustavo, 2026-10-28), P2:** a folga é a MÉDIA do prazo da meta; com parcela que acaba no meio (geladeira até dezembro, meta até junho), a média (R$ 900) acerta o total mas promete nos primeiros meses o que não cabe (de verdade: R$ 700 até dezembro, R$ 1.000 depois). Correção no servidor: quando parcela acaba dentro do prazo, a resposta fala a folga em DEGRAUS ("Até dezembro sobram R$ 700 por mês; com a geladeira paga, de janeiro em diante, R$ 1.000. Guardando assim, você chega em junho."). Vale pro "essa meta cabe?", "as metas juntas cabem?" e a "Folga por mês" de Relatórios (mostra a do mês + o próximo degrau). `ParcelasPorMesAsync` já dá as parcelas mês a mês. Entra no PR 10. ✅ **Adiantado em 2026-10-29** (`fix/folga-meta-em-degraus`): o "essa meta cabe?" e o "as metas juntas cabem?" já falam em degraus (`ViabilidadeMetaService.Degraus`/`DegrausTexto`); falta só a "Folga por mês" de Relatórios usar o mesmo.
3. ✅ **Sankey: ENTRA, depois do básico** (Gustavo, 2026-10-28: "depois ou agora não me importa"; desenho de exemplo mostrado no chat). Só no computador, SVG próprio, sem pacote. Formato: fontes de renda → Renda do mês → categorias + "Sobrou". Mês que passou da renda: faixa "Passou da renda" (senão não fecha). Como o Monarch (abas Category / Group / Both / Share), com seletor de visão: v1 **Por categoria**; v2 **Categoria › Subcategoria** (3 colunas, precisa da subcategoria no gasto do mês, que hoje não existe em `GastosPorCategoriaDoMesAsync`); P3 **Por pessoa** no espaço da família. Entra no PR 13 (P2).
4. ✅ **Essencial por categoria: DEPOIS do básico** (Gustavo, 2026-10-28). O "cortar onde" v1 olha o que passou do normal; `Categoria.Essencial` (coluna + padrão marcadas + interruptor em Categorias) e o "cortar onde" v2 ficam no PR 14 (P2).

**Todas as decisões tomadas: o plano está pronto pra construir a partir do PR 1.**

## 9. Etapas em PRs pequenos (cada um com o seu 375px e o seu estado no DemoSeeder)
1. **PR 1 (back, correções):** `SaldoDisponivelAsync` no CheckUp e no ProximosEmprestimos; `Responder` trata Sem categoria > 30%, total acima do normal, nada lançado, comprometido 0 por falta de cadastro; `CheckUpDto` ganha Previsto por categoria, `SemCategoria`, as três variações e `Sinais` de "Seus dados"; recusa mês futuro. Testes do `CheckUpService`.
2. **PR 2 (back, performance):** consulta agregada de 12 meses em `RegrasFinanceiras` no lugar das 12 chamadas a `ObterMesAsync` + 12 a `GastosPorCategoriaDoMesAsync` (hoje ~40 consultas por abertura); teste comparando com o caminho antigo; medir na conta demo (meta < 1 s). **Antes de qualquer seção nova.**
3. **PR 3 (front + back pequeno, pré-requisito dos links):** Transações lê `categoriaId`, `semCategoria`, `from`, `to` da URL, aplica no filtro do servidor e mostra chip removível; seletor de categoria no filtro; back ganha `semCategoria=true`. Fecha o item do ROADMAP "Ver lançamentos da categoria".
4. **PR 4 (front):** `GraficoBarras` trocando o Mês a mês feito à mão (6 meses no celular); etiquetas de variação no resumo; Comprometido vira seção própria; `NavegadorMes` com `ate`; "Seus dados" com `Resposta` compacta. DemoSeeder ganha bloco de Relatórios (Sem categoria grande, sem renda).
5. **PR 5 (front):** `GraficoBarrasComparacao` no Pra onde foi; Sem categoria em cinza fora do ranking; clique → Transações filtrada; frase acima do gráfico. DemoSeeder: categoria acima do normal e categoria nova.
6. **PR 6 (back + front):** `SinaisDoMesService` + `GET /relatorios/sinais` (limites, metas, empréstimos, cobrança sem limite, a ser alocado, fatura atrasada) com Peso, EhDeHoje e dedupe. Testes por fonte e de ordem.
7. **PR 7 (front + back pequeno):** `UsoDaRenda` variante `compacta` com teste; Relatórios chama `/dinheiro-do-mes` só no mês atual; tokens `--v2-faixa-1..3` + `Bullet` no Comprometido.
8. **PR 8 (back + front):** Comprometido completo (5 maiores contas fixas, parcelas futuras, parcela que acaba, faturas à parte, metas pedem, Folga por mês). DemoSeeder: fatura atrasada e parcela terminando.
9. **PR 9 (back + front):** "Dá pra cortar onde?" versão 1.
10. **PR 10 (back):** `GastoTipicoAsync` único (depois da decisão 2); "Guardado nas metas" na Reserva; `FracaoDaFolga` e a linha "Metas no mês".
11. **PR 11 (front):** varredura final de celular (ajuste fino; cada componente já saiu cabendo em 375px).
12. **PR 12 (docs):** visao.md e CONVENCOES atualizados; aposentar endpoints legados no ROADMAP; rótulo do CSV; fechar a decisão do gráfico "comparar com o mês anterior" na opção (c).
13. **PR 13 (P2):** Ritmo do mês; linha de saldo 12 meses na Reserva; `ObterStatsAsync` por mês; traço "planejado" no desktop; renda fixa × variável; Sankey se decidido (decisão 3).
14. **PR 14 (P2, depende da decisão 4):** `Categoria.Essencial` e "cortar onde" versão 2.
15. **Depois (P3, com liberação da família):** Relatórios da família com as mesmas peças.

## 10. Riscos
- **Custo de abertura:** check-up + sinais + dinheiro-do-mes. O PR 2 entra antes das seções e o `SinaisDoMesService` não recalcula o que o check-up já tem; cada PR mede na conta demo.
- **Rótulos iguais com bases diferentes:** Entrou/Saiu do Início (caixa) ≠ de Relatórios (renda EhRenda × gasto com parcela e parte da família) ≠ CSV (só Executado). Nunca os dois na mesma tela; CSV rotulado "lançamentos".
- **Repetição:** UsoDaRenda compacta é o único pedaço do Início que repete, por decisão da visão; faturas e parcelas futuras só no Comprometido.
- **Frase duplicada** entre manchete e sinais: dedupe por chave, coberto por teste.
- **Duas definições de "gasto normal"** até o PR 10: Reserva e "metas cabem?" podem discordar.
- **Links mortos:** nenhum link pra Transações entra antes do PR 3.
- **Mês passado × dados de hoje:** `EhDeHoje` decide esconder ou rotular.
- **Lista de sinais parecendo bronca:** teto de 6, frase de fato + ação, "Seus dados" sempre com a ação que arruma o dado.
- **Só 5 séries de cor:** "Outras" a partir da 6ª com os mesmos ids em todos os gráficos; "Sem categoria" sempre cinza.
- **Gráfico à mão sem acessibilidade:** sr-only, cor + rótulo, 44px, `useHideBalance` e 375px no teste de cada componente.

using ControleFinanceiro.Api.DTOs.DinheiroDoMes;

namespace ControleFinanceiro.Api.DTOs.Relatorios;

/// <summary>
/// O check-up do mês (Relatórios no v2; docs/features/relatorios/plano.md): a soma das respostas das outras telas.
/// Tudo calculado no servidor pelas regras únicas (gasto do mês, renda, contas fixas, parcelas, saldos); a tela só mostra.
/// </summary>
public record CheckUpDto(
    int Ano,
    int Mes,
    // Mês em andamento: os números são "até agora".
    bool MesAtual,
    // Renda que entrou no mês (RendaService.EhRenda).
    decimal Entrou,
    // O que a pessoa gastou no mês (efetivado; a parte dela no que dividiu; parcela do mês).
    decimal Saiu,
    decimal Sobrou,
    // Sobrou ÷ Entrou, em %. Null sem renda no mês.
    decimal? PercentualQueSobrou,
    // Contra o mês anterior, em % (null quando o mês anterior foi zero).
    decimal? VariacaoEntrou,
    decimal? VariacaoSaiu,
    // O que sobrou no mês anterior (pra "set/26 sobrou R$ X").
    decimal SobrouMesAnterior,
    // Contas fixas a pagar, por mês (o mesmo número da tela Contas fixas).
    decimal ContasFixasPorMes,
    // Parcelas de compras parceladas que caem no mês.
    decimal ParcelasDoMes,
    // (Contas fixas + parcelas) ÷ renda do mês (a maior entre esperada e recebida), em %. Null sem renda.
    decimal? PercentualComprometido,
    // Todas as categorias do mês (sem "Sem categoria", que vem à parte), as maiores primeiro.
    List<CategoriaDoCheckUpDto> PraOndeFoi,
    // O gasto do mês sem categoria (importação de extrato), fora do ranking. Null quando não há.
    SemCategoriaDto? SemCategoria,
    List<MesDoCheckUpDto> MesAMes,
    // Dinheiro hoje nas contas abertas, SEM as caixinhas das metas (decisão do Gustavo, 2026-10-28).
    decimal DinheiroGuardado,
    // O que está nas caixinhas das metas (aparece à parte, fora da reserva).
    decimal GuardadoNasMetas,
    // Gasto de um mês normal (média dos meses anteriores que tiveram gasto, até 3; com as parcelas).
    decimal? GastoNormal,
    // Quantos meses do gasto normal o dinheiro de hoje cobre. Null sem gasto normal.
    decimal? MesesDeReserva,
    RespostaDto? RespostaReserva,
    ComprometidoDto Comprometido,
    // "Dá pra cortar onde?" (null sem meses anteriores pra comparar).
    CorteDto? Corte,
    // "Seus dados": o que falta pro app responder melhor (sem categoria, renda não dita, nenhuma conta fixa).
    List<SinalDto> Sinais,
    RespostaDto Resposta);

/// <summary>Uma categoria do mês, com o normal dela (média dos meses anteriores), o que ainda vem e quanto veio acima ou abaixo.</summary>
public record CategoriaDoCheckUpDto(Guid? CategoriaId, string Nome, decimal Valor, decimal PercentualDoGasto, decimal? Normal,
    decimal? VariacaoPercentual, decimal Previsto = 0m);

/// <summary>O gasto do mês sem categoria: quanto e em quantos lançamentos.</summary>
public record SemCategoriaDto(decimal Valor, decimal PercentualDoGasto, int Quantidade);

/// <summary>
/// O "Ano completo" de Relatórios: o ano somado, de janeiro até <c>AteMes</c> (o mês de hoje no ano atual, dezembro nos
/// passados). <c>Meses</c> vai sempre de janeiro a dezembro: os que ainda não chegaram vêm zerados, só com o planejado. Os totais contra o planejado (a soma dos meses), os meses da linha do tempo e as categorias somadas, cada
/// uma contra o normal (o mesmo período do ano anterior) e o limite do ano (a soma do limite vigente em cada mês).
/// <c>PrimeiroAno</c>: o do primeiro lançamento da pessoa (o seletor de ano vai dele até o atual).
/// Etapa 2 (2026-11-02): <c>Ritmo</c> (médias por mês e, no ano atual, quanto o ano fecha sobrando), <c>Comprometido</c>
/// (contas fixas e parcelas do ano) e <c>Reserva</c> (o dinheiro de hoje contra o gasto médio por mês do ano).
/// </summary>
public record AnoDoCheckUpDto(int Ano, int AteMes, bool AnoAtual, decimal Entrou, decimal Saiu, decimal Sobrou, decimal Investido,
    decimal RendaEsperada, decimal DespesasPlanejadas, decimal InvestimentosPlanejados,
    List<MesDoCheckUpDto> Meses, List<CategoriaDoAnoDto> Categorias, SemCategoriaDto? SemCategoria, int PrimeiroAno,
    RitmoDoAnoDto? Ritmo = null, ComprometidoDoAnoDto? Comprometido = null, ReservaDoAnoDto? Reserva = null);

/// <summary>O ritmo do ano: a média por mês dos meses FECHADOS com movimento (o mês em andamento puxaria a média pra baixo;
/// sem mês fechado, os meses com movimento) e, só no ano atual, quanto o ano fecha sobrando se continuar assim (o que sobrou
/// nos meses fechados + a média de sobra vezes os meses que faltam, contando o atual). Null sem movimento no ano.</summary>
public record RitmoDoAnoDto(int MesesNaMedia, decimal EntrouPorMes, decimal SaiuPorMes, decimal SobrouPorMes, decimal? FechaOAnoCom);

/// <summary>Contas fixas e parcelas no ano: o que já foi pago de conta fixa (as ocorrências efetivadas até hoje), as parcelas
/// que caíram nos meses até hoje e, no ano atual, as que ainda caem até dezembro; e quanto isso é do que entrou (null sem renda).</summary>
public record ComprometidoDoAnoDto(decimal ContasFixas, decimal Parcelas, decimal ParcelasAteDezembro, decimal? PercentualDoQueEntrou);

/// <summary>A reserva olhando o ano: o dinheiro de hoje nas contas (sem as caixinhas das metas) dividido pelo gasto médio
/// por mês do ano (o mesmo do ritmo). Null sem gasto no ano.</summary>
public record ReservaDoAnoDto(decimal DinheiroGuardado, decimal GuardadoNasMetas, decimal? GastoMedioPorMes, decimal? MesesDeReserva, RespostaDto? Resposta);

/// <summary>Uma categoria no ano: o que saiu, a parte do gasto, o normal (o mesmo período do ano anterior: 0 = nova no ano; null sem nada
/// lá), a variação contra ele e o limite do ano (null sem limite).</summary>
public record CategoriaDoAnoDto(Guid CategoriaId, string Nome, decimal Valor, decimal PercentualDoGasto, decimal? Normal,
    decimal? VariacaoPercentual, decimal? Limite);

/// <summary>Um mês da linha do tempo de Relatórios: receita, despesa e investimentos, cada um com o realizado e o
/// planejado (como a planilha do Gustavo: cor forte é o que aconteceu, cor clara é o orçado). <c>Investido</c> = aportes
/// menos resgates efetivados (fora do Saiu: investir não é gasto). <c>RendaEsperada</c> = a renda prevista do mês;
/// <c>DespesasPlanejadas</c> = a soma dos limites por categoria; <c>InvestimentosPlanejados</c> = a soma das fontes de
/// investimento planejadas.</summary>
public record MesDoCheckUpDto(int Ano, int Mes, decimal Entrou, decimal Saiu, decimal Sobrou, decimal Investido = 0m,
    decimal RendaEsperada = 0m, decimal DespesasPlanejadas = 0m, decimal InvestimentosPlanejados = 0m);

/// <summary>
/// "Quanto da renda já tem dono antes do mês começar?": as contas fixas que mais pesam, as parcelas dos próximos meses,
/// a parcela que acaba logo, as faturas a pagar no mês (lado do caixa, nunca somam no gasto), a folga por mês e o que as
/// metas pedem. <c>FaixaAtencao</c>/<c>FaixaAlerta</c>: os limites do bullet (40% e 60%).
/// </summary>
public record ComprometidoDto(
    List<ContaFixaDoCheckUpDto> MaioresContasFixas,
    int TotalContasFixas,
    List<ParcelasNoMesDto> ParcelasProximosMeses,
    int? ParcelasAteAno,
    int? ParcelasAteMes,
    ParcelaQueAcabaDto? ParcelaQueAcaba,
    List<FaturaDoCheckUpDto> Faturas,
    decimal? FolgaPorMes,
    decimal MetasPedemPorMes,
    decimal FaixaAtencao,
    decimal FaixaAlerta,
    RespostaDto? Resposta);

public record ContaFixaDoCheckUpDto(Guid Id, string Descricao, decimal PorMes);

public record ParcelasNoMesDto(int Ano, int Mes, decimal Valor);

/// <summary>A compra parcelada que termina no mês seguinte: "a parcela de X acaba em novembro: R$ Y a menos todo mês".</summary>
public record ParcelaQueAcabaDto(string Descricao, int Ano, int Mes, decimal PorMes);

public record FaturaDoCheckUpDto(Guid CartaoId, string Cartao, DateTime Vencimento, decimal Total, decimal Pago, decimal Restante, bool Atrasada);

/// <summary>"Dá pra cortar onde?": a frase e as categorias que mais passaram do normal (até 3) + conta fixa que começou no mês.</summary>
public record CorteDto(RespostaDto Resposta, List<ItemDeCorteDto> Itens);

/// <summary>Uma linha do corte. <c>Tipo</c>: "categoria" (passou do normal) ou "conta-fixa" (começou no mês).</summary>
public record ItemDeCorteDto(string Tipo, Guid? Id, string Nome, decimal Valor, decimal? Normal, decimal AMais, decimal Previsto);

/// <summary>
/// Um aviso do "O que vale olhar". <c>Origem</c>: "dados" (o que falta pro app responder melhor), "limite", "metas",
/// "emprestimo", "conta-fixa", "orcamento", "fatura". <c>Peso</c>: o valor em reais em jogo (ordena dentro do tom).
/// <c>EhDeHoje</c>: vale pro hoje, não pro mês navegado (só aparece no mês atual).
/// </summary>
public record SinalDto(string Chave, string Origem, decimal Peso, bool EhDeHoje, RespostaDto Resposta);

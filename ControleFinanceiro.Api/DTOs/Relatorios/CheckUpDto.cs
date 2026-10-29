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
    // As categorias do mês (sem "Sem categoria", que vem à parte), as maiores primeiro; passando de 6, "Outras".
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

/// <summary>Um mês da série: o que entrou (renda), o que saiu (gasto) e o que sobrou.</summary>
public record MesDoCheckUpDto(int Ano, int Mes, decimal Entrou, decimal Saiu, decimal Sobrou);

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

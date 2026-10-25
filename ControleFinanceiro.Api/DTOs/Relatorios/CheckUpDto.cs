using ControleFinanceiro.Api.DTOs.DinheiroDoMes;

namespace ControleFinanceiro.Api.DTOs.Relatorios;

/// <summary>
/// O check-up do mês (Relatórios no v2; docs/features/respostas/visao.md, camada 3): a soma das respostas das outras
/// telas. Tudo calculado no servidor pelas regras únicas (gasto do mês, renda, contas fixas, parcelas, saldos).
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
    // Contas fixas a pagar, por mês (o mesmo número da tela Contas fixas).
    decimal ContasFixasPorMes,
    // Parcelas de compras parceladas que caem no mês.
    decimal ParcelasDoMes,
    // (Contas fixas + parcelas) ÷ renda do mês (a maior entre esperada e recebida), em %. Null sem renda.
    decimal? PercentualComprometido,
    List<CategoriaDoCheckUpDto> PraOndeFoi,
    List<MesDoCheckUpDto> MesAMes,
    // Dinheiro hoje nas contas e caixinhas.
    decimal DinheiroGuardado,
    // Gasto de um mês normal (média dos meses anteriores que tiveram gasto, até 3).
    decimal? GastoNormal,
    // Quantos meses do gasto normal o dinheiro de hoje cobre. Null sem gasto normal.
    decimal? MesesDeReserva,
    RespostaDto Resposta);

/// <summary>Uma categoria do mês, com o normal dela (média dos meses anteriores) e quanto veio acima ou abaixo.</summary>
public record CategoriaDoCheckUpDto(Guid? CategoriaId, string Nome, decimal Valor, decimal PercentualDoGasto, decimal? Normal, decimal? VariacaoPercentual);

/// <summary>Um mês da série: o que entrou (renda), o que saiu (gasto) e o que sobrou.</summary>
public record MesDoCheckUpDto(int Ano, int Mes, decimal Entrou, decimal Saiu, decimal Sobrou);

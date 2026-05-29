namespace ControleFinanceiro.Api.DTOs.Parcelamento;

/// <summary>
/// Agregados de parcelamentos para os KPIs do topo da tela /parcelamentos.
/// Calculado no banco — exato pra qualquer volume.
/// </summary>
public class ParcelamentoStatsDto
{
    /// <summary>Quantidade de parcelamentos ativos.</summary>
    public int Ativos { get; init; }

    /// <summary>Soma do valor restante dos parcelamentos ativos.</summary>
    public decimal TotalRestante { get; init; }

    /// <summary>Quantidade total de parcelamentos (ativos + cancelados/quitados).</summary>
    public int QtdTotal { get; init; }
}

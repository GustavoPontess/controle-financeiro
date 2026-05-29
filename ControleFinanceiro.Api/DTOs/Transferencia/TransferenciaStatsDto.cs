namespace ControleFinanceiro.Api.DTOs.Transferencia;

/// <summary>
/// Agregados de transferências para os KPIs do topo da tela /transferencias.
/// Calculado no banco — exato pra qualquer volume.
/// </summary>
public class TransferenciaStatsDto
{
    /// <summary>Soma do valor movimentado em transferências no filtro.</summary>
    public decimal TotalMovimentado { get; init; }

    /// <summary>Quantidade total de transferências no filtro.</summary>
    public int QtdTotal { get; init; }
}

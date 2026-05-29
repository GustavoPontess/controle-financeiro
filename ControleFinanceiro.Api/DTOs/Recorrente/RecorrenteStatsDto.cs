namespace ControleFinanceiro.Api.DTOs.Recorrente;

/// <summary>
/// Agregados de recorrentes (assinaturas) para os KPIs do topo da tela /recorrentes.
/// Calculado no banco — exato pra qualquer volume.
/// </summary>
public class RecorrenteStatsDto
{
    /// <summary>Quantidade de recorrentes ativos.</summary>
    public int Ativas { get; init; }

    /// <summary>Soma do valor mensal das despesas mensais ativas (frequencia=2, tipo=1).</summary>
    public decimal CustoMensalDespesas { get; init; }

    /// <summary>Quantidade de recorrentes ativos com `dataProximaGeracao` nos próximos 30 dias.</summary>
    public int Proximas30Dias { get; init; }

    /// <summary>Quantidade total de recorrentes (ativos + cancelados).</summary>
    public int QtdTotal { get; init; }
}

namespace ControleFinanceiro.Api.DTOs.Recorrente;

/// <summary>
/// Agregados de recorrentes (assinaturas) para os KPIs do topo da tela /recorrentes.
/// Calculado no banco — exato pra qualquer volume.
/// </summary>
public class RecorrenteStatsDto
{
    /// <summary>Quantidade de recorrentes ativos.</summary>
    public int Ativas { get; init; }

    /// <summary>Custo MÉDIO por mês das despesas ativas de todas as frequências (= anual ÷ 12): semanal
    /// conta 52× no ano, mensal 12×, anual 1×.</summary>
    public decimal CustoMensalDespesas { get; init; }

    /// <summary>Custo por ano das despesas ativas de todas as frequências (semanal × 52 + mensal × 12 + anual).</summary>
    public decimal CustoAnualDespesas { get; init; }

    /// <summary>Quantidade de contas fixas ativas com cobrança prevista nos próximos 30 dias (de hoje a hoje+30).</summary>
    public int Proximas30Dias { get; init; }

    /// <summary>Quantidade total de recorrentes (ativos + cancelados).</summary>
    public int QtdTotal { get; init; }
}

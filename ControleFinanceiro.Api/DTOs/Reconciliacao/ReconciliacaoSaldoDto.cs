namespace ControleFinanceiro.Api.DTOs.Reconciliacao;

/// <summary>Um marco de reconciliação de uma conta (resposta).</summary>
public class ReconciliacaoSaldoDto
{
    public Guid Id { get; init; }
    public Guid ContaId { get; init; }
    public DateTime DataHora { get; init; }
    public decimal SaldoDeclarado { get; init; }
    public decimal SaldoCalculado { get; init; }
    /// <summary>Declarado − Calculado no momento da conferência. 0 = bateu.</summary>
    public decimal Diferenca { get; init; }
    /// <summary>1 = Baseline, 2 = Verificacao.</summary>
    public int Tipo { get; init; }
    /// <summary>Houve lançamento de ajuste pra fechar a diferença.</summary>
    public bool TemAjuste { get; init; }
    public string? Observacao { get; init; }
    public DateTime CriadoEm { get; init; }
}

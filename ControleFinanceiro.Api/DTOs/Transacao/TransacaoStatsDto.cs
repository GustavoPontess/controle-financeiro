namespace ControleFinanceiro.Api.DTOs.Transacao;

/// <summary>
/// Agregados de transações para os KPIs do topo da tela /transactions.
/// Calculado direto no banco (Sum/Count), exato pra qualquer volume.
/// </summary>
public class TransacaoStatsDto
{
    /// <summary>Soma das receitas (tipo=2, Executado, !transferência, !pgto fatura, !saldo inicial).</summary>
    public decimal Entradas { get; init; }

    /// <summary>Soma das despesas (tipo=1, mesmas exclusões de receita).</summary>
    public decimal Saidas { get; init; }

    /// <summary>Saldo do período: entradas - saídas, considerando apenas transações que afetam saldo (não usadoComoCredito).</summary>
    public decimal SaldoPeriodo { get; init; }

    /// <summary>Total de transações no filtro.</summary>
    public int QtdTransacoes { get; init; }
}

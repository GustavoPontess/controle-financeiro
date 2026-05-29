namespace ControleFinanceiro.Api.DTOs.Transacao;

/// <summary>
/// Agregados de transações para os KPIs do topo da tela /transactions.
/// Calculado direto no banco (Sum/Count), exato pra qualquer volume.
/// </summary>
public class TransacaoStatsDto
{
    /// <summary>Soma das receitas (tipo=2, Executado, !transferência, !pgto fatura, !saldo inicial). Inclui receita feita via crédito.</summary>
    public decimal Entradas { get; init; }

    /// <summary>Soma das despesas (tipo=1, mesmas exclusões de receita). Inclui despesa registrada no crédito.</summary>
    public decimal Saidas { get; init; }

    /// <summary>Entradas que de fato moveram caixa (exclui UsadoComoCredito). Usado nos cards visíveis.</summary>
    public decimal EntradasCaixa { get; init; }

    /// <summary>Saídas que de fato moveram caixa (exclui UsadoComoCredito). Usado nos cards visíveis.</summary>
    public decimal SaidasCaixa { get; init; }

    /// <summary>Saldo do período: entradas - saídas, considerando apenas transações que afetam saldo (não usadoComoCredito). = EntradasCaixa - SaidasCaixa.</summary>
    public decimal SaldoPeriodo { get; init; }

    /// <summary>Total de transações no filtro.</summary>
    public int QtdTransacoes { get; init; }
}

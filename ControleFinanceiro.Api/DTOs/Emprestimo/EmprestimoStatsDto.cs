namespace ControleFinanceiro.Api.DTOs.Emprestimo;

/// <summary>
/// Agregados de empréstimos para os KPIs do topo da tela /emprestimos.
/// Calculado no banco — exato pra qualquer volume.
/// </summary>
public class EmprestimoStatsDto
{
    /// <summary>Soma do valor restante dos empréstimos ATIVOS do tipo "Emprestei" (tipo=1).</summary>
    public decimal TotalAReceber { get; init; }

    /// <summary>Soma do valor restante dos empréstimos ATIVOS do tipo "Peguei" (tipo=2).</summary>
    public decimal TotalAPagar { get; init; }

    /// <summary>Fatia vencida do TotalAReceber — À vista com DataVencimento passada, ou parcelas
    /// Pendente com DataVencimento passada (soma ValorComMulta se já tiver snapshot, senão
    /// ValorComJuros/Valor). Não recalcula a multa na hora (isso só acontece ao abrir "Ver
    /// parcelas") — pode subestimar levemente se a parcela nunca foi aberta desde que venceu.</summary>
    public decimal TotalAReceberVencido { get; init; }

    /// <summary>Quantidade de empréstimos em andamento (não quitados, não soft-deleted).</summary>
    public int Ativos { get; init; }

    /// <summary>Quantidade total de empréstimos (ativos + quitados, exclui soft-deleted).</summary>
    public int QtdTotal { get; init; }
}

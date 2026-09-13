namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Um dos empréstimos originais incluídos numa EmprestimoConsolidacaoProposta. Join table —
/// existe pra permitir N:N (uma proposta cobre vários empréstimos), nunca editada depois de
/// criada (a proposta é imutável até ser respondida).
/// </summary>
public class EmprestimoConsolidacaoItem
{
    public Guid Id { get; set; }

    public Guid PropostaId { get; set; }
    public EmprestimoConsolidacaoProposta Proposta { get; set; } = null!;

    public Guid EmprestimoOriginalId { get; set; }
    public Emprestimo EmprestimoOriginal { get; set; } = null!;

    /// <summary>Restante (ValorTotal - ValorPago) daquele empréstimo no momento da proposta —
    /// só pra auditoria/exibição, não usado como fonte de verdade no aceite.</summary>
    public decimal ValorRestanteSnapshot { get; set; }
}

namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// Forma de pagamento combinada de um empréstimo.
/// Spec: docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md.
/// </summary>
public enum FormaPagamentoEmprestimo
{
    /// <summary>Padrão atual — ValorTotal único, sem parcelas, pagamentos avulsos.</summary>
    AVista = 1,

    /// <summary>Gera N EmprestimoParcela na criação, com vencimento mensal fixo.</summary>
    Parcelado = 2,
}

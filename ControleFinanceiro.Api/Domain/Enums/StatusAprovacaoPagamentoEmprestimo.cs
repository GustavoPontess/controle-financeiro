namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// Estado de aprovação de uma solicitação de pagamento de empréstimo.
/// Spec: docs/features/emprestimo-compartilhado/pagamento-aprovacao.md.
/// </summary>
public enum StatusAprovacaoPagamentoEmprestimo
{
    /// <summary>Devedor solicitou, aguardando avaliação do credor. Não conta em ValorPago.</summary>
    Pendente = 1,

    /// <summary>Credor aprovou. ValorPago já foi avançado.</summary>
    Aprovada = 2,

    /// <summary>Credor rejeitou. ValorPago não muda.</summary>
    Rejeitada = 3,
}

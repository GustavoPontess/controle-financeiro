namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// Estado de aprovação de uma despesa compartilhada com a família (Feature 2.4).
/// Só é relevante quando <c>Transacao.FamiliaId != null</c>.
/// Spec: docs/features/familia/aprovacao-despesa.md.
/// </summary>
public enum StatusAprovacaoDespesa
{
    /// <summary>Default: despesa pessoal, ou compartilhada abaixo do limite / família sem limite. Conta no balanço.</summary>
    NaoRequerida = 0,

    /// <summary>Compartilhada com valor ≥ limite da família, aguardando aval de outro membro. NÃO conta no balanço.</summary>
    Pendente = 1,

    /// <summary>Um membro (≠ criador) aprovou. Conta no balanço.</summary>
    Aprovada = 2,

    /// <summary>Um membro (≠ criador) rejeitou. NÃO conta no balanço (segue visível no feed).</summary>
    Rejeitada = 3,
}

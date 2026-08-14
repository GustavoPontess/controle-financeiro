namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// Estado de uma proposta de consolidação de empréstimos (credor junta N empréstimos ativos da
/// mesma contraparte num plano novo renegociado). Espelha o padrão de vínculo bilateral — credor
/// propõe, devedor aceita/recusa, nada muda até o aceite.
/// Spec: docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md § "Unificar/consolidar".
/// </summary>
public enum StatusConsolidacaoEmprestimo
{
    Pendente = 1,
    Aceita = 2,
    Recusada = 3,

    /// <summary>Credor desistiu antes do devedor responder.</summary>
    Cancelada = 4,
}

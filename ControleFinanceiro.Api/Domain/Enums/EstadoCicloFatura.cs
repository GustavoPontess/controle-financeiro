namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// Dimensão "ciclo" da fatura. Independente de pagamento e atraso.
/// Spec: ARQUITETURA_PARCELAMENTO.md § "ENUMS NOVOS E MODIFICADOS".
/// </summary>
public enum EstadoCicloFatura
{
    /// <summary>Aceita novas transações.</summary>
    Aberta = 0,

    /// <summary>Não aceita mais transações; aguarda pagamento.</summary>
    Fechada = 1,
}

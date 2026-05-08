namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// Tipo do Parcelamento. Diferencia compra parcelada normal (sem juros),
/// PIX no crédito (com juros + IOF) e parcelamento gerado por Recorrente.
/// Spec: ARQUITETURA_PARCELAMENTO.md § "ENUMS NOVOS E MODIFICADOS".
/// </summary>
public enum TipoParcelamento
{
    /// <summary>Compra normal parcelada (sem juros).</summary>
    CompraParcelada = 0,

    /// <summary>PIX no crédito (com juros + IOF).</summary>
    PIXCredito = 1,

    /// <summary>Vinculado a uma Recorrente.</summary>
    Recorrente = 2,
}

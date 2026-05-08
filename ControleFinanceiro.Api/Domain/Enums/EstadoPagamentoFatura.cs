namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// Dimensão "pagamento" da fatura. Independente de ciclo e atraso.
/// Spec: ARQUITETURA_PARCELAMENTO.md § "ENUMS NOVOS E MODIFICADOS".
/// </summary>
public enum EstadoPagamentoFatura
{
    /// <summary>Nenhum pagamento registrado.</summary>
    NaoPago = 0,

    /// <summary>ValorPago > 0 e &lt; ValorTotal.</summary>
    Parcial = 1,

    /// <summary>ValorPago &gt;= ValorTotal.</summary>
    Pago = 2,
}

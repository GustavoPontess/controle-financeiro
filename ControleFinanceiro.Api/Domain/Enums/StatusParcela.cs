namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// Estado mínimo de uma ParcelaTransacao. A fatura agrega para cobrança;
/// a parcela existe pra suportar antecipação individual e cancelamento granular.
/// Spec: ARQUITETURA_PARCELAMENTO.md § "ENUMS NOVOS E MODIFICADOS".
/// </summary>
public enum StatusParcela
{
    /// <summary>Aguardando vencimento ou pagamento.</summary>
    Pendente = 0,

    /// <summary>Paga (antecipadamente ou via fatura).</summary>
    Paga = 1,

    /// <summary>Cancelada (parcelamento todo cancelado ou parcela individual cancelada).</summary>
    Cancelada = 2,
}

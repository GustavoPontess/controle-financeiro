using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Parcelamento;

namespace ControleFinanceiro.Api.DTOs.ParcelaTransacao;

/// <summary>
/// Payload para antecipar o pagamento de uma parcela individual.
/// Spec: ARQUITETURA_PARCELAMENTO.md § "Fluxo 2: Pagar Parcela Antecipada".
/// </summary>
public class PagarParcelaDto
{
    /// <summary>Conta bancária de onde sai o dinheiro.</summary>
    public Guid ContaPagamentoId { get; set; }

    /// <summary>Data do pagamento (null = UtcNow).</summary>
    public DateTime? DataPagamento { get; set; }

    /// <summary>
    /// Chave de idempotência — obrigatória para evitar duplicação em retry.
    /// Use UUID v4 por chamada; reutilize o mesmo UUID em retry do mesmo pagamento.
    /// </summary>
    public string IdempotencyKey { get; set; } = string.Empty;
}

/// <summary>Resumo da fatura após pagamento de parcela.</summary>
public class FaturaAtualizadaDto
{
    public Guid Id { get; set; }

    /// <summary>Estado de pagamento recalculado (NaoPago / Parcial / Pago).</summary>
    public EstadoPagamentoFatura EstadoPagamento { get; set; }

    /// <summary>Total acumulado de pagamentos nesta fatura.</summary>
    public decimal ValorPago { get; set; }

    /// <summary>Soma de todas as parcelas + transações à vista nesta fatura.</summary>
    public decimal ValorTotal { get; set; }

    /// <summary>ValorTotal - ValorPago (sempre >= 0).</summary>
    public decimal ValorRestante { get; set; }
}

/// <summary>Resultado de <c>ParcelaTransacaoService.PagarAntecipadoAsync</c>.</summary>
public class PagarParcelaResultadoDto
{
    public Guid ParcelaId { get; set; }
    public StatusParcela Status { get; set; }
    public DateTime PagoEm { get; set; }

    /// <summary>Estado atualizado da fatura à qual esta parcela pertencia.</summary>
    public FaturaAtualizadaDto FaturaAtualizada { get; set; } = null!;

    /// <summary>Snapshot do limite do cartão após liberação desta parcela.</summary>
    public LimiteSnapshotDto NovoLimite { get; set; } = null!;
}

using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Parcelamento;

namespace ControleFinanceiro.Api.DTOs.ParcelaTransacao;

/// <summary>
/// Payload para cancelar uma parcela individual (não cancela o parcelamento inteiro).
/// Spec: ARQUITETURA_PARCELAMENTO.md § "Fluxo 4: Cancelar Parcela Individual".
/// </summary>
public class CancelarParcelaDto
{
    /// <summary>Motivo do cancelamento (obrigatório, máx 400 chars).</summary>
    [Required]
    [MaxLength(400)]
    public string Motivo { get; set; } = string.Empty;

    /// <summary>
    /// Chave de idempotência — obrigatória para evitar duplicação em retry.
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string IdempotencyKey { get; set; } = string.Empty;
}

/// <summary>Resultado de <c>ParcelaTransacaoService.CancelarAsync</c>.</summary>
public class CancelarParcelaResultadoDto
{
    public Guid ParcelaId { get; set; }
    public StatusParcela Status { get; set; }
    public DateTime CanceladoEm { get; set; }
    public string Motivo { get; set; } = string.Empty;

    /// <summary>Snapshot do limite do cartão após liberação desta parcela.</summary>
    public LimiteSnapshotDto NovoLimite { get; set; } = null!;
}

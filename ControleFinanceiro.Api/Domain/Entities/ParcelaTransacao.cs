using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Unidade individual de dívida dentro de um Parcelamento. Tem estado mínimo
/// (Pendente|Paga|Cancelada) pra permitir antecipação e cancelamento granular.
/// A Fatura agrega para cobrança; a parcela existe pra UX estilo Nubank.
/// Spec: ARQUITETURA_PARCELAMENTO.md § "ParcelaTransacao".
/// </summary>
public class ParcelaTransacao
{
    public Guid Id { get; set; }

    [Required]
    public Guid ParcelamentoId { get; set; }
    public Parcelamento? Parcelamento { get; set; }

    /// <summary>Número desta parcela (1, 2, 3, ...).</summary>
    [Range(1, 36)]
    public int Numero { get; set; }

    /// <summary>Total de parcelas no parcelamento (snapshot pra UX).</summary>
    [Range(2, 36)]
    public int QuantidadeTotal { get; set; }

    [Required]
    public DateTime DataVencimento { get; set; }

    /// <summary>Valor base da parcela (sem juros).</summary>
    [Range(0.01, double.MaxValue)]
    public decimal Valor { get; set; }

    /// <summary>Valor com juros (PIX Crédito). Null se sem juros.</summary>
    public decimal? ValorComJuros { get; set; }

    /// <summary>Taxa aplicada nesta parcela (PIX Crédito). Null se sem juros.</summary>
    public decimal? TaxaJuro { get; set; }

    /// <summary>IOF desta parcela (PIX Crédito). Null se não aplicável.</summary>
    public decimal? IOF { get; set; }

    /// <summary>Fatura à qual a parcela pertence (mês de vencimento).</summary>
    [Required]
    public Guid FaturaId { get; set; }
    public Fatura? Fatura { get; set; }

    [Required]
    public StatusParcela Status { get; set; } = StatusParcela.Pendente;

    public DateTime? PagoEm { get; set; }

    public DateTime? CanceladoEm { get; set; }

    [MaxLength(400)]
    public string? MotivoCancelamento { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    /// <summary>UsuarioId (convenção do projeto: CriadoPor = UsuarioId).</summary>
    [Required]
    public Guid CriadoPor { get; set; }
}

using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Parcelamento;

/// <summary>
/// Payload de criação de um parcelamento (CompraParcelada ou PIXCredito).
/// Spec: ARQUITETURA_PARCELAMENTO.md § "Fluxo 1: Criar Parcelamento".
/// </summary>
public class CriarParcelamentoDto
{
    [Required]
    [MaxLength(400)]
    public string Descricao { get; set; } = string.Empty;

    /// <summary>Valor total (sem juros). Range 0.01 a inf.</summary>
    [Range(0.01, double.MaxValue)]
    public decimal Valor { get; set; }

    [Required]
    public TipoParcelamento Tipo { get; set; }

    [Required]
    public Guid CartaoCreditoId { get; set; }

    [Required]
    public DateTime DataCompra { get; set; }

    [Range(2, 36)]
    public int Parcelas { get; set; }

    /// <summary>
    /// Mês (yyyy-MM) em que cai a primeira parcela. Ex: "2026-07".
    /// Não pode ser anterior ao mês atual.
    /// </summary>
    [Required]
    [RegularExpression(@"^\d{4}-(0[1-9]|1[0-2])$", ErrorMessage = "Formato deve ser yyyy-MM.")]
    public string PrimeiraParcelaMes { get; set; } = string.Empty;

    public Guid? CategoriaId { get; set; }

    /// <summary>Taxa mensal em % (apenas PIXCredito). Range 1.99 a 11.99.</summary>
    public decimal? TaxaJuroMensal { get; set; }

    /// <summary>UUID gerado no cliente para idempotência. Obrigatório.</summary>
    [Required]
    [MaxLength(100)]
    public string IdempotencyKey { get; set; } = string.Empty;
}

/// <summary>Payload de cancelamento de parcelamento (soft delete).</summary>
public class CancelarParcelamentoDto
{
    [Required]
    [MaxLength(400)]
    public string Motivo { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string IdempotencyKey { get; set; } = string.Empty;
}

/// <summary>
/// Resposta do cancelamento — informa quantas parcelas foram canceladas,
/// quantas estavam pagas (preservadas) e o novo limite do cartão.
/// </summary>
public class CancelamentoResultadoDto
{
    public Guid ParcelamentoId { get; set; }
    public int Canceladas { get; set; }
    public int JaPagas { get; set; }

    /// <summary>True se houver parcelas pagas — UI sugere transação de estorno.</summary>
    public bool RequerEstorno { get; set; }

    public LimiteSnapshotDto NovoLimite { get; set; } = new();
}

/// <summary>Snapshot de limite de um cartão (espelha LimiteCalculatorService.LimiteSnapshot).</summary>
public class LimiteSnapshotDto
{
    public Guid CartaoId { get; set; }
    public decimal LimiteTotal { get; set; }
    public decimal LimiteBloqueado { get; set; }
    public decimal LimiteDisponivel { get; set; }
    public decimal ExposicaoFuturaPrevisao { get; set; }
}

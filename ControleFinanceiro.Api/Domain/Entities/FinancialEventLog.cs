using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Audit log append-only de eventos financeiros (mudanças de saldo, limite,
/// estado de fatura, parcelamento, recorrente, transação).
/// NÃO é event sourcing — é audit trail que vive ao lado do estado mutável.
/// Spec: ARQUITETURA_PARCELAMENTO.md § "FinancialEventLog (NOVA)".
/// </summary>
/// <remarks>
/// Tabela cresce indefinidamente — particionar por mês quando passar de ~10M linhas.
/// Idempotência: serviços DEVEM gravar idempotencyKey dentro de PayloadJson e
/// consultar ele antes de iniciar transação financeira.
/// </remarks>
public class FinancialEventLog
{
    public Guid Id { get; set; }

    /// <summary>UsuarioId dono dos dados (convenção do projeto: CriadoPor = UsuarioId).</summary>
    [Required]
    public Guid CriadoPor { get; set; }

    [Required]
    public FinancialEventType Tipo { get; set; }

    /// <summary>Nome da entidade afetada ("Fatura", "Parcelamento", "ParcelaTransacao", "CartaoCredito", "Conta").</summary>
    [Required]
    [MaxLength(64)]
    public string EntidadeAfetada { get; set; } = string.Empty;

    [Required]
    public Guid EntidadeId { get; set; }

    /// <summary>Estado antes da mudança (saldo, limite, etc), quando aplicável.</summary>
    public decimal? ValorAntes { get; set; }

    /// <summary>Estado depois da mudança.</summary>
    public decimal? ValorDepois { get; set; }

    /// <summary>Snapshot adicional em JSON (idempotencyKey, payloads complexos).</summary>
    public string? PayloadJson { get; set; }

    /// <summary>Agrupa eventos da mesma operação (1 pagamento → N eventos).</summary>
    [Required]
    public Guid CorrelationId { get; set; }

    /// <summary>"UserClick", "Job:FecharFaturas", "Job:MarcarAtrasadas", "Job:ExpandirRecorrentes", "API".</summary>
    [Required]
    [MaxLength(64)]
    public string OrigemAcao { get; set; } = string.Empty;

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}

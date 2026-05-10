using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;


namespace ControleFinanceiro.Api.Domain.Entities;

public class Transacao
{
    public Guid Id { get; set; }

    [Required]
    [MaxLength(400)]
    public string Descricao { get; set; } = string.Empty;

    [Range(0.01, double.MaxValue)]
    public decimal Valor { get; set; }

    [Required]
    public TipoTransacao Tipo { get; set; }

    public Guid? CategoriaId { get; set; }
    public Categoria? Categoria { get; set; }

    public Guid? ContaId { get; set; }
    public Conta? Conta { get; set; }

    public Guid? CartaoCreditoId { get; set; }
    public CartaoCredito? CartaoCredito { get; set; }

    public bool UsadoComoCredito { get; set; }

    public MeioPagamento? MeioPagamento { get; set; }

    // Fatura à qual esta transação de cartão de crédito pertence
    public Guid? FaturaId { get; set; }
    public Fatura? Fatura { get; set; }

    public Guid CriadoPor { get; set; }

    [Required]
    public DateTime Data { get; set; }

    public Guid? RecorrenteOrigemId { get; set; }

    // ── Novos vínculos ao sistema de Parcelamento (ARQUITETURA_PARCELAMENTO.md § "Transacao (Mudanças)") ──

    /// <summary>Vincula esta Transacao ao Parcelamento que a originou (se aplicável).</summary>
    public Guid? ParcelamentoId { get; set; }
    public Parcelamento? Parcelamento { get; set; }

    /// <summary>Vincula esta Transacao à parcela específica (se aplicável).</summary>
    public Guid? ParcelaTransacaoId { get; set; }
    public ParcelaTransacao? ParcelaTransacao { get; set; }

    // ── Status, soft delete e marcador de pagamento de fatura ──

    /// <summary>Diferencia previsão (Recorrente futura), executada (real) e cancelada.</summary>
    public StatusTransacao StatusTransacao { get; set; } = StatusTransacao.Executado;

    /// <summary>true se esta Transacao representa o pagamento de uma Fatura (rota especial — ponte conta↔cartão).</summary>
    public bool EhPagamentoFatura { get; set; }

    /// <summary>Quando EhPagamentoFatura=true, qual Fatura foi quitada.</summary>
    public Guid? FaturaPagaId { get; set; }
    public Fatura? FaturaPaga { get; set; }

    /// <summary>Soft delete: true=ativa, false=cancelada (preserva histórico).</summary>
    public bool Ativo { get; set; } = true;

    public DateTime? CanceladoEm { get; set; }

    [MaxLength(400)]
    public string? MotivoCancelamento { get; set; }

    /// <summary>Timestamp de criação (auditoria).</summary>
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
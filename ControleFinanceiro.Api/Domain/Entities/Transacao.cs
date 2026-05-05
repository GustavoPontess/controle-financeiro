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

    // Parcelamento: null = à vista
    public int? Parcelas { get; set; }
    public int? NumeroParcela { get; set; }
    public Guid? TransacaoOrigemId { get; set; }

    public Guid CriadoPor { get; set; }

    [Required]
    public DateTime Data { get; set; }

    public Guid? RecorrenteOrigemId { get; set; }
}
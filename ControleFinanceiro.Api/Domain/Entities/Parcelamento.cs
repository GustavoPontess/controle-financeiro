using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Agrupador de uma compra parcelada, PIX no crédito ou recorrente.
/// Spec: ARQUITETURA_PARCELAMENTO.md § "Parcelamento".
/// Hard delete proibido — use soft delete (Ativo=false + MotivoCancelamento + CanceladoEm).
/// </summary>
public class Parcelamento
{
    public Guid Id { get; set; }

    /// <summary>UsuarioId (convenção do projeto: CriadoPor = UsuarioId).</summary>
    [Required]
    public Guid CriadoPor { get; set; }

    [Required]
    public TipoParcelamento Tipo { get; set; }

    [Required]
    [MaxLength(400)]
    public string Descricao { get; set; } = string.Empty;

    [Required]
    public DateTime DataCompra { get; set; }

    [Range(0.01, double.MaxValue)]
    public decimal ValorTotal { get; set; }

    /// <summary>Total com juros (PIX Crédito). Null em CompraParcelada sem juros.</summary>
    public decimal? ValorComJuros { get; set; }

    [Range(2, 36)]
    public int QuantidadeParcelas { get; set; }

    /// <summary>
    /// Parcelas pagas ANTES de o parcelamento entrar no app (compra em andamento: "estou na 3 de 7" → 2).
    /// Não viram ParcelaTransacao — as faturas delas são de antes do app e já foram pagas; só as que
    /// faltam (Numero = ParcelasPagasAntes+1 … QuantidadeParcelas) são registradas e bloqueiam limite.
    /// </summary>
    [Range(0, 35)]
    public int ParcelasPagasAntes { get; set; }

    /// <summary>Taxa mensal (PIX Crédito). Null se sem juros.</summary>
    public decimal? TaxaJuroMensal { get; set; }

    /// <summary>
    /// Cartão usado (todo Parcelamento atualmente consome limite — ContaId não suportado no MVP).
    /// </summary>
    [Required]
    public Guid CartaoCreditoId { get; set; }
    public CartaoCredito? CartaoCredito { get; set; }

    public Guid? CategoriaId { get; set; }
    public Categoria? Categoria { get; set; }

    /// <summary>Soft delete: true=ativo, false=cancelado.</summary>
    public bool Ativo { get; set; } = true;

    public DateTime? CanceladoEm { get; set; }

    [MaxLength(400)]
    public string? MotivoCancelamento { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    /// <summary>Navegação para as parcelas geradas.</summary>
    public ICollection<ParcelaTransacao> Parcelas { get; set; } = new List<ParcelaTransacao>();
}

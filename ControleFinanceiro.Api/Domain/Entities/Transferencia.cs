using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.Domain.Entities;

public class Transferencia
{
    public Guid Id { get; set; }

    [Required]
    public Guid ContaOrigemId { get; set; }
    public Conta? ContaOrigem { get; set; }

    [Required]
    public Guid ContaDestinoId { get; set; }
    public Conta? ContaDestino { get; set; }

    [Range(0.01, double.MaxValue)]
    public decimal Valor { get; set; }

    [Required]
    public DateTime Data { get; set; }

    [MaxLength(400)]
    public string Descricao { get; set; } = string.Empty;

    public Guid CriadoPor { get; set; }

    public Guid TransacaoOrigemId { get; set; }
    public Guid TransacaoDestinoId { get; set; }
}

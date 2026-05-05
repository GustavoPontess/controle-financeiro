using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

public class Recorrente
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

    [Required]
    public Guid ContaId { get; set; }
    public Conta? Conta { get; set; }

    [Required]
    public FrequenciaRecorrencia Frequencia { get; set; }

    public int Dia { get; set; }

    [Required]
    public DateTime DataInicio { get; set; }

    public DateTime? DataFim { get; set; }

    public bool Ativo { get; set; } = true;

    public Guid CriadoPor { get; set; }

    public DateTime? DataProximaGeracao { get; set; }
}

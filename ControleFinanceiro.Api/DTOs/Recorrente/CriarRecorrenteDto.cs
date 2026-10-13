using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Recorrente;

public class CriarRecorrenteDto
{
    [Required]
    [MaxLength(400)]
    public string Descricao { get; set; } = string.Empty;

    [Range(0.01, double.MaxValue)]
    public decimal Valor { get; set; }

    [Required]
    public int Tipo { get; set; }

    public Guid? CategoriaId { get; set; }

    public Guid? ContaId { get; set; }

    public Guid? CartaoCreditoId { get; set; }

    [Required]
    public int Frequencia { get; set; }

    [Range(1, 31)]
    public int Dia { get; set; }

    [Required]
    public DateTime DataInicio { get; set; }

    public DateTime? DataFim { get; set; }
}

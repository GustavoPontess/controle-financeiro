using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Recorrente;

public class CancelarRecorrenteDto
{
    [Required]
    [MaxLength(400)]
    public string Motivo { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? IdempotencyKey { get; set; }
}

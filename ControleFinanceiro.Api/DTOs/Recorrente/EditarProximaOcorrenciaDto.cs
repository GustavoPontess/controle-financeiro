using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Recorrente;

public class EditarProximaOcorrenciaDto
{
    public decimal? Valor { get; set; }

    [MaxLength(400)]
    public string? Descricao { get; set; }
    public Guid? CategoriaId { get; set; }
}

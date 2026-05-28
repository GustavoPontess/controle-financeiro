namespace ControleFinanceiro.Api.DTOs.Recorrente;

public class EditarProximaOcorrenciaDto
{
    public decimal? Valor { get; set; }
    public string? Descricao { get; set; }
    public Guid? CategoriaId { get; set; }
}

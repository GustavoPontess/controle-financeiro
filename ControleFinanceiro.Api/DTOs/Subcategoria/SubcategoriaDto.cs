namespace ControleFinanceiro.Api.DTOs.Subcategoria;

public class SubcategoriaDto
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string? Icone { get; set; }
    public string? Cor { get; set; }
    public Guid CategoriaId { get; set; }
    public bool IsPadrao { get; set; }
}

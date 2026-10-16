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

/// <summary>O que usa a subcategoria: lançamentos vivos e contas fixas.</summary>
public class UsoSubcategoriaDto
{
    public int Lancamentos { get; set; }
    public int ContasFixas { get; set; }
}

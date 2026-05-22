using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Subcategoria;

public class CriarSubcategoriaDto
{
    [Required]
    [MaxLength(120)]
    public string Nome { get; set; } = string.Empty;

    [MaxLength(60)]
    public string? Icone { get; set; }

    [MaxLength(20)]
    public string? Cor { get; set; }

    [Required]
    public Guid CategoriaId { get; set; }
}

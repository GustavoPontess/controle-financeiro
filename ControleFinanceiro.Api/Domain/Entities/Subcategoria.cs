using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Issue #83 — granularidade abaixo de Categoria (ex: "Mercado" → "Hortifruti",
/// "Açougue"). Sempre pertence a uma Categoria. UsuarioId null = padrão (todos
/// veem, ninguém deleta); guid = subcategoria pessoal do usuário.
/// </summary>
public class Subcategoria
{
    public Guid Id { get; set; }

    [Required]
    [MaxLength(120)]
    public string Nome { get; set; } = string.Empty;

    /// <summary>Nome do ícone (lucide-react) escolhido no front. Opcional.</summary>
    [MaxLength(60)]
    public string? Icone { get; set; }

    /// <summary>Cor hex (#RRGGBB) pra UI. Opcional.</summary>
    [MaxLength(20)]
    public string? Cor { get; set; }

    [Required]
    public Guid CategoriaId { get; set; }
    public Categoria? Categoria { get; set; }

    // null = padrão; guid = subcategoria pessoal do usuário
    public Guid? UsuarioId { get; set; }
}

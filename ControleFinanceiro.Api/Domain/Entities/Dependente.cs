using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Entidade financeira sem login: registra gastos de alguém que não usa o app
/// (filho pequeno, idoso sob cuidado, pet). Rótulo de atribuição, não é Usuário.
/// </summary>
public class Dependente
{
    public Guid Id { get; set; }

    public Guid FamiliaId { get; set; }
    public Familia? Familia { get; set; }

    [Required]
    [MaxLength(120)]
    public string Nome { get; set; } = string.Empty;

    [MaxLength(60)]
    public string? Apelido { get; set; }

    public DateTime? DataNascimento { get; set; }

    public TipoDependente Tipo { get; set; } = TipoDependente.Outro;

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    public bool Ativo { get; set; } = true;
}

using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

public class Banco
{
    public Guid Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Nome { get; set; } = string.Empty;

    [MaxLength(200)]
    public string NomeFantasia { get; set; } = string.Empty;

    [MaxLength(200)]
    public string RazaoSocial { get; set; } = string.Empty;

    [MaxLength(10)]
    public string? CodigoBanco { get; set; }

    [Required]
    public TipoBanco Tipo { get; set; }

    public bool Ativo { get; set; } = true;

    [MaxLength(500)]
    public string? LogoUrl { get; set; }

    [MaxLength(7)]
    public string? Cor { get; set; }

    public ICollection<Conta> Contas { get; set; } = new List<Conta>();
}

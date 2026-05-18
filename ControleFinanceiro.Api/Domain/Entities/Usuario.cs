using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.Domain.Entities;

public class Usuario
{
    public Guid Id { get; set; }

    [Required]
    [EmailAddress]
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Nome { get; set; } = string.Empty;

    public DateTime? DataNascimento { get; set; }

    public bool Ativo { get; set; } = true;

    /// <summary>Issue #29 — true depois que o usuário concluiu (ou pulou) o
    /// onboarding guiado. Evita reexibir o fluxo de primeiros passos.</summary>
    public bool OnboardingConcluido { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;

    public Guid? RelacionamentoId { get; set; }
    public Relacionamento? Relacionamento { get; set; }

    // Navigation properties
    public ICollection<Conta> Contas { get; set; } = new List<Conta>();
    public ICollection<CompartilhamentoConta> CompartilhamentosContas { get; set; } = new List<CompartilhamentoConta>();
}

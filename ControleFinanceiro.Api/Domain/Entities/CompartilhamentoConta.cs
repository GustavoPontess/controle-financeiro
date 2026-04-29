using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.Domain.Entities;

public class CompartilhamentoConta
{
    public Guid Id { get; set; }

    [Required]
    public Guid ContaId { get; set; }
    public Conta? Conta { get; set; }

    [Required]
    public Guid UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }

    public bool PermissaoLeitura { get; set; } = true;

    public bool PermissaoEscrita { get; set; } = false;

    public DateTime DataCompartilhamento { get; set; } = DateTime.UtcNow;

    [Required]
    public Guid CriadoPor { get; set; }

    public Guid? RelacionamentoId { get; set; }
    public Relacionamento? Relacionamento { get; set; }
}

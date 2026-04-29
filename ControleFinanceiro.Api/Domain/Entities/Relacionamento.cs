using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

public class Relacionamento
{
    public Guid Id { get; set; }

    [Required]
    public Guid UsuarioId1 { get; set; }
    public Usuario? Usuario1 { get; set; }

    [Required]
    public Guid UsuarioId2 { get; set; }
    public Usuario? Usuario2 { get; set; }

    [Required]
    public StatusRelacionamento Status { get; set; } = StatusRelacionamento.Pendente;

    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;

    public Guid CriadoPor { get; set; }

    // Navigation
    public ICollection<CompartilhamentoConta> CompartilhamentosContas { get; set; } = new List<CompartilhamentoConta>();
}

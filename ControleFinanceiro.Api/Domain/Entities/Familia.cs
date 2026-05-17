using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.Domain.Entities;

public class Familia
{
    public Guid Id { get; set; }

    [Required]
    [MaxLength(120)]
    public string Nome { get; set; } = string.Empty;

    public Guid CriadoPorUsuarioId { get; set; }
    public Usuario? CriadoPor { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    public bool Ativa { get; set; } = true;

    public ICollection<MembroFamilia> Membros { get; set; } = new List<MembroFamilia>();
    public ICollection<ConviteFamilia> Convites { get; set; } = new List<ConviteFamilia>();
}

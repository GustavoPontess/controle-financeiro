using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.Domain.Entities;

public class MembroFamilia
{
    public Guid Id { get; set; }

    public Guid FamiliaId { get; set; }
    public Familia? Familia { get; set; }

    public Guid UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }

    /// <summary>Rótulo editável da relação do membro com a família (texto livre).</summary>
    [Required]
    [MaxLength(60)]
    public string Papel { get; set; } = string.Empty;

    /// <summary>Issue #25 — renda mensal do membro, usada no rateio proporcional.
    /// Null = não informada.</summary>
    public decimal? RendaMensal { get; set; }

    public DateTime EntrouEm { get; set; } = DateTime.UtcNow;

    public bool Ativo { get; set; } = true;
}

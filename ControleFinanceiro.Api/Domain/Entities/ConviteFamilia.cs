using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

public class ConviteFamilia
{
    public Guid Id { get; set; }

    public Guid FamiliaId { get; set; }
    public Familia? Familia { get; set; }

    [Required]
    [EmailAddress]
    [MaxLength(256)]
    public string EmailConvidado { get; set; } = string.Empty;

    [Required]
    [MaxLength(60)]
    public string Papel { get; set; } = string.Empty;

    /// <summary>Feature 2.3 — papel de permissão que o convidado terá ao aceitar (Membro|Dependente).</summary>
    public PapelFamilia PapelPermissao { get; set; } = PapelFamilia.Membro;

    [Required]
    [MaxLength(64)]
    public string Token { get; set; } = string.Empty;

    public StatusConvite Status { get; set; } = StatusConvite.Pendente;

    public DateTime ExpiraEm { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    public Guid CriadoPorUsuarioId { get; set; }
    public Usuario? CriadoPor { get; set; }
}

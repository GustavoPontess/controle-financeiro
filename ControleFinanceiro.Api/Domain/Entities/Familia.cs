using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

public class Familia
{
    public Guid Id { get; set; }

    [Required]
    [MaxLength(120)]
    public string Nome { get; set; } = string.Empty;

    public Guid CriadoPorUsuarioId { get; set; }
    public Usuario? CriadoPor { get; set; }

    /// <summary>Issue #25 — modo de rateio aplicado às despesas compartilhadas
    /// que não definem um override próprio.</summary>
    public ModoRateio ModoRateioPadrao { get; set; } = ModoRateio.Igualitario;

    /// <summary>Feature 2.4 — despesa compartilhada com valor ≥ este limite exige
    /// aprovação de outro membro. Null = aprovação desligada (compartilhar é direto).</summary>
    public decimal? LimiteAprovacao { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    public bool Ativa { get; set; } = true;

    public ICollection<MembroFamilia> Membros { get; set; } = new List<MembroFamilia>();
    public ICollection<ConviteFamilia> Convites { get; set; } = new List<ConviteFamilia>();
}

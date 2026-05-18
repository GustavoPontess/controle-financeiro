using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>Issue #26 — registro interno de que um membro pagou a outro o que
/// devia dentro da família. Não mexe no saldo de contas bancárias reais.</summary>
public class AcertoContas
{
    public Guid Id { get; set; }

    public Guid FamiliaId { get; set; }
    public Familia? Familia { get; set; }

    /// <summary>Quem pagou (devedor).</summary>
    public Guid DeUsuarioId { get; set; }
    public Usuario? DeUsuario { get; set; }

    /// <summary>Quem recebeu (credor).</summary>
    public Guid ParaUsuarioId { get; set; }
    public Usuario? ParaUsuario { get; set; }

    [Range(0.01, double.MaxValue)]
    public decimal Valor { get; set; }

    public int Mes { get; set; }
    public int Ano { get; set; }

    [MaxLength(400)]
    public string? Observacao { get; set; }

    public Guid CriadoPor { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    /// <summary>Soft delete: cancelar o acerto preserva o histórico.</summary>
    public bool Ativo { get; set; } = true;
}

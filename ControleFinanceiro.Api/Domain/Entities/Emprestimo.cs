using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

public class Emprestimo
{
    public Guid Id { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public string Pessoa { get; set; } = string.Empty;
    public decimal ValorTotal { get; set; }
    public decimal ValorPago { get; set; } = 0;
    public TipoEmprestimo Tipo { get; set; }
    public DateTime DataInicio { get; set; }
    public DateTime? DataVencimento { get; set; }
    public bool Quitado { get; set; } = false;
    public string? Observacao { get; set; }
    public Guid CriadoPor { get; set; }

    /// <summary>Soft delete — nunca _context.Remove() (CLAUDE.md).</summary>
    public bool Ativo { get; set; } = true;

    // Vínculo bilateral (docs/features/emprestimo-compartilhado/spec.md).
    // Só setado no aceite explícito — antes disso é null, mesmo padrão de MembroFamilia.UsuarioId.
    public Guid? ContraparteUsuarioId { get; set; }
    public Usuario? ContraparteUsuario { get; set; }
    public StatusVinculoEmprestimo StatusVinculo { get; set; } = StatusVinculoEmprestimo.SemVinculo;
    public string? EmailContraparte { get; set; }
    public string? ConviteTokenHash { get; set; }
    public DateTime? ConviteExpiraEm { get; set; }
    public DateTime? VinculoRespondidoEm { get; set; }
}

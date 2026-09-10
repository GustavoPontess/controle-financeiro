using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Registro append-only de uma ação de admin (Módulo D — spec `docs/features/admin/spec.md` §6).
/// Rastreabilidade de app de dinheiro: quem fez, o quê, sobre quem, quando. NUNCA é editado/apagado
/// pela aplicação.
///
/// Campos são **snapshot denormalizado** de propósito (e-mail do admin e descrição do alvo gravados
/// no momento da ação): a auditoria tem que sobreviver a rename/exclusão do usuário e ser legível
/// sozinha, sem depender de JOIN com registros que podem sumir. Por isso o vínculo com o usuário é
/// só um <see cref="AdminUsuarioId"/> solto (sem FK/cascade) — apagar um usuário não apaga o rastro.
/// </summary>
public class AdminAuditLog
{
    public Guid Id { get; set; }

    /// <summary>Admin que executou a ação.</summary>
    public Guid AdminUsuarioId { get; set; }

    /// <summary>E-mail do admin no momento da ação (snapshot, não some se o admin for alterado).</summary>
    [Required]
    [MaxLength(255)]
    public string AdminEmail { get; set; } = string.Empty;

    public AcaoAdmin Acao { get; set; }

    /// <summary>Tipo do alvo (ex.: "Usuario"). Curto.</summary>
    [MaxLength(60)]
    public string? AlvoTipo { get; set; }

    /// <summary>Id do alvo (ex.: usuário aprovado/bloqueado). Null se a ação não tem alvo.</summary>
    public Guid? AlvoId { get; set; }

    /// <summary>Descrição legível do alvo (snapshot — ex.: e-mail do usuário afetado).</summary>
    [MaxLength(255)]
    public string? AlvoDescricao { get; set; }

    /// <summary>Detalhe livre opcional (contexto extra da ação).</summary>
    [MaxLength(1000)]
    public string? Detalhe { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}

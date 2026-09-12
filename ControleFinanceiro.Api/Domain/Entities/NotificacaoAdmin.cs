using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Notificação do painel admin — stream SEPARADO do financeiro (`Notificacao`). NÃO misturar: o sino
/// do admin lê só daqui, o do usuário só de lá.
///
/// É <b>global</b> ao painel (qualquer admin vê; não pertence a um usuário) — por isso não tem
/// `UsuarioId`/FK. O read-state (<see cref="Lida"/>) também é global; o beta tem ~1 admin, então basta.
/// </summary>
public class NotificacaoAdmin
{
    public Guid Id { get; set; }

    public TipoNotificacaoAdmin Tipo { get; set; }

    [Required]
    [MaxLength(160)]
    public string Titulo { get; set; } = string.Empty;

    [MaxLength(500)]
    public string Mensagem { get; set; } = string.Empty;

    /// <summary>Rota relativa do painel aberta ao clicar (ex.: /admin/pendentes).</summary>
    [MaxLength(200)]
    public string? LinkRelativo { get; set; }

    public bool Lida { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}

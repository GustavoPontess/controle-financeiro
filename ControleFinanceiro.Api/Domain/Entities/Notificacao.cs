using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>Issue #30 — notificação in-app entregue a um usuário.</summary>
public class Notificacao
{
    public Guid Id { get; set; }

    public Guid UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }

    public TipoNotificacao Tipo { get; set; }

    [Required]
    [MaxLength(160)]
    public string Titulo { get; set; } = string.Empty;

    [MaxLength(500)]
    public string Mensagem { get; set; } = string.Empty;

    /// <summary>Rota relativa do app aberta ao clicar na notificação.</summary>
    [MaxLength(200)]
    public string? LinkRelativo { get; set; }

    public bool Lida { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}

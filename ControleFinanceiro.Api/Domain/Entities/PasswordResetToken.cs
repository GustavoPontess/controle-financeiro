namespace ControleFinanceiro.Api.Domain.Entities;

public class PasswordResetToken
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }

    /// <summary>Token opaco de uso único (SHA-256 hex).</summary>
    public string Token { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }
    public bool Usado { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    // Nav
    public Usuario Usuario { get; set; } = null!;
}

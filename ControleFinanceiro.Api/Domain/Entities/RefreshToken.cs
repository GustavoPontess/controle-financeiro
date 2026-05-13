namespace ControleFinanceiro.Api.Domain.Entities;

public class RefreshToken
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }

    /// <summary>Token opaco (SHA-256 hex de 64 bytes aleatórios).</summary>
    public string Token { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }
    public bool Revogado { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    // Nav
    public Usuario Usuario { get; set; } = null!;
}

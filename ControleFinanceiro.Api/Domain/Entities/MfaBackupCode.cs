namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Código de recuperação de MFA — gerado em lote (10) na ativação, mostrado ao usuário
/// UMA vez em texto claro. Cada um usa uma vez só (marca <see cref="Usado"/>), pra quando
/// o usuário perde acesso ao app autenticador. Guarda só o hash (mesmo padrão de
/// <see cref="RefreshToken"/>/<see cref="PasswordResetToken"/>) — vazamento do banco não dá
/// código utilizável.
/// </summary>
public class MfaBackupCode
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }

    /// <summary>Hash SHA-256 (hex) do código — o bruto só existe na tela de ativação.</summary>
    public string CodigoHash { get; set; } = string.Empty;

    public bool Usado { get; set; }
    public DateTime? UsadoEm { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    // Nav
    public Usuario Usuario { get; set; } = null!;
}

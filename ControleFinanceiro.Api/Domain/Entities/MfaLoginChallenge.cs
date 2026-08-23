namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Ponte entre o passo 1 (email+senha corretos) e o passo 2 (código MFA) do login quando o
/// usuário tem MFA ativo. <c>LoginAsync</c> NUNCA emite JWT direto pra quem tem MFA — só depois
/// de <c>MfaService.VerificarAsync</c> confirmar o código contra o challenge certo. TTL curto
/// (5min); token opaco, só o hash fica no banco (mesmo padrão dos outros tokens da API).
/// </summary>
public class MfaLoginChallenge
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }

    /// <summary>Hash SHA-256 (hex) do token opaco — o bruto vai só na resposta do passo 1.</summary>
    public string TokenHash { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    // Nav
    public Usuario Usuario { get; set; } = null!;
}

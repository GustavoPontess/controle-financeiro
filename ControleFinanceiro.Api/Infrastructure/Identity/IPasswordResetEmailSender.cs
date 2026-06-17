namespace ControleFinanceiro.Api.Infrastructure.Identity;

/// <summary>
/// Envia o e-mail de recuperação de senha contendo o token de reset.
/// O token NUNCA é devolvido na resposta HTTP de <c>/forgot-password</c> (isso permitiria
/// account takeover): ele só chega ao usuário legítimo por este canal de e-mail.
/// </summary>
public interface IPasswordResetEmailSender
{
    Task EnviarAsync(string email, string token, DateTime expiresAt, CancellationToken ct = default);
}

using Microsoft.Extensions.Hosting;

namespace ControleFinanceiro.Api.Infrastructure.Identity;

/// <summary>
/// Implementação stub até existir SMTP real. Em <c>Development</c> loga o token para o fluxo
/// de dev/QA continuar funcionando sem caixa de e-mail. Fora de Development o token NUNCA é
/// logado (segredo em log é proibido) — registra apenas que o envio foi disparado.
/// </summary>
public class LoggingPasswordResetEmailSender : IPasswordResetEmailSender
{
    private readonly ILogger<LoggingPasswordResetEmailSender> _logger;
    private readonly IHostEnvironment _env;

    public LoggingPasswordResetEmailSender(
        ILogger<LoggingPasswordResetEmailSender> logger,
        IHostEnvironment env)
    {
        _logger = logger;
        _env = env;
    }

    public Task EnviarAsync(string email, string token, DateTime expiresAt, CancellationToken ct = default)
    {
        if (_env.IsDevelopment())
        {
            _logger.LogWarning(
                "[DEV] Token de reset para {Email}: {Token} (expira {ExpiresAt:u}). Em produção iria por e-mail.",
                email, token, expiresAt);
        }
        else
        {
            // Sem token e sem e-mail no log: nada que sirva de oráculo ou vaze segredo.
            _logger.LogInformation("E-mail de reset de senha disparado (token omitido do log).");
        }

        return Task.CompletedTask;
    }
}

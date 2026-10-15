using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure.Identity;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace ControleFinanceiro.Api.Infrastructure.Email;

/// <summary>
/// Envio de e-mail de verdade por SMTP (MailKit) — o mesmo código serve pro Mailpit local e pro provedor de
/// produção. Implementa os dois canais (reset de senha e e-mails da conta). O log registra só que foi
/// enviado e o assunto: nunca o destinatário, o token ou o código (segredo/PII em log é proibido).
/// </summary>
public sealed class SmtpEmailSender : IPasswordResetEmailSender, IContaEmailSender
{
    private readonly SmtpOpcoes _opcoes;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(SmtpOpcoes opcoes, ILogger<SmtpEmailSender> logger)
    {
        _opcoes = opcoes;
        _logger = logger;
    }

    public Task EnviarAsync(string email, string token, DateTime expiresAt, CancellationToken ct = default) =>
        EnviarAsync(email, ModelosEmail.ResetSenha(_opcoes.AppUrl, token, expiresAt), ct);

    public Task EnviarCodigoAsync(string email, string codigo, TipoOtpEmail finalidade, DateTime expiraEm, CancellationToken ct = default) =>
        EnviarAsync(email, ModelosEmail.CodigoOtp(codigo, finalidade, expiraEm), ct);

    public Task EnviarAvisoExclusaoAsync(string email, DateTime marcadoEm, int diasCarencia, CancellationToken ct = default) =>
        EnviarAsync(email, ModelosEmail.AvisoExclusao(_opcoes.AppUrl, marcadoEm, diasCarencia), ct);

    private async Task EnviarAsync(string para, MensagemEmail m, CancellationToken ct)
    {
        var msg = new MimeMessage();
        msg.From.Add(MailboxAddress.Parse(_opcoes.Remetente));
        msg.To.Add(MailboxAddress.Parse(para));
        msg.Subject = m.Assunto;
        msg.Body = new BodyBuilder { TextBody = m.Texto, HtmlBody = m.Html }.ToMessageBody();

        var seguranca = _opcoes.Seguranca switch
        {
            "starttls" => SecureSocketOptions.StartTls,
            "ssl" => SecureSocketOptions.SslOnConnect,
            "none" => SecureSocketOptions.None,
            _ => SecureSocketOptions.StartTlsWhenAvailable,
        };

        using var cliente = new SmtpClient();
        await cliente.ConnectAsync(_opcoes.Host, _opcoes.Porta, seguranca, ct);
        if (_opcoes.Usuario is not null)
            await cliente.AuthenticateAsync(_opcoes.Usuario, _opcoes.Senha ?? string.Empty, ct);
        await cliente.SendAsync(msg, ct);
        await cliente.DisconnectAsync(true, ct);

        _logger.LogInformation("E-mail enviado por SMTP: {Assunto}", m.Assunto.Split(':')[0]);
    }
}

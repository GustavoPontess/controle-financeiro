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

    // De quem cada e-mail sai: recuperar senha e código são automáticos; o aviso de exclusão da conta é alerta
    // de segurança (a pessoa precisa reconhecer se não foi ela).
    public Task EnviarAsync(string email, string token, DateTime expiresAt, CancellationToken ct = default) =>
        EnviarAsync(email, ModelosEmail.ResetSenha(_opcoes.AppUrl, email, token, expiresAt), TipoRemetente.Automatico, ct);

    public Task EnviarCodigoAsync(string email, string codigo, TipoOtpEmail finalidade, DateTime expiraEm, CancellationToken ct = default) =>
        EnviarAsync(email, ModelosEmail.CodigoOtp(email, codigo, finalidade, expiraEm), TipoRemetente.Automatico, ct);

    public Task EnviarAvisoExclusaoAsync(string email, DateTime marcadoEm, int diasCarencia, CancellationToken ct = default) =>
        EnviarAsync(email, ModelosEmail.AvisoExclusao(_opcoes.AppUrl, email, marcadoEm, diasCarencia), TipoRemetente.Seguranca, ct);

    /// <summary>O logo dos e-mails (PNG embutido no assembly), anexado inline com o Content-ID do layout.</summary>
    private static readonly Lazy<byte[]> Logo = new(() =>
    {
        using var s = typeof(SmtpEmailSender).Assembly.GetManifestResourceStream("ControleFinanceiro.Api.Infrastructure.Email.logo-pontes.png")
            ?? throw new InvalidOperationException("Logo do e-mail não está embutido no assembly.");
        using var ms = new MemoryStream();
        s.CopyTo(ms);
        return ms.ToArray();
    });

    /// <summary>A mensagem pronta (remetente do tipo, Reply-To quando há, corpo com o logo inline).</summary>
    public static MimeMessage Montar(SmtpOpcoes opcoes, string para, MensagemEmail m, TipoRemetente tipo)
    {
        var msg = new MimeMessage();
        msg.From.Add(MailboxAddress.Parse(opcoes.RemetenteDe(tipo)));
        if (opcoes.ResponderDe(tipo) is { } responder)
            msg.ReplyTo.Add(MailboxAddress.Parse(responder));
        msg.To.Add(MailboxAddress.Parse(para));
        msg.Subject = m.Assunto;
        var corpo = new BodyBuilder { TextBody = m.Texto, HtmlBody = m.Html };
        var logo = corpo.LinkedResources.Add("logo-pontes.png", Logo.Value, new ContentType("image", "png"));
        logo.ContentId = ModelosEmail.CidLogo;
        msg.Body = corpo.ToMessageBody();
        return msg;
    }

    private async Task EnviarAsync(string para, MensagemEmail m, TipoRemetente tipo, CancellationToken ct)
    {
        var msg = Montar(_opcoes, para, m, tipo);

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

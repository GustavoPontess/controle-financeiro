using ControleFinanceiro.Api.Infrastructure.Email;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// De quem cada e-mail sai (decisão do Gustavo, 24/10/2026): automáticos de naoresponda@, alertas de segurança de
/// seguranca@, avisos do produto de pontes@ com Reply-To numa caixa que recebe. Sem as variáveis novas, tudo cai
/// no SMTP_FROM (dev com Mailpit continua igual).
/// </summary>
public class SmtpRemetentesTests
{
    private static Func<string, string?> Env(Dictionary<string, string> valores) =>
        nome => valores.TryGetValue(nome, out var v) ? v : null;

    private static readonly Dictionary<string, string> Producao = new()
    {
        ["SMTP_HOST"] = "smtp.resend.com",
        ["SMTP_PORT"] = "587",
        ["SMTP_SECURITY"] = "starttls",
        ["SMTP_USER"] = "resend",
        ["SMTP_PASS"] = "re_falsa",
        ["SMTP_FROM"] = "Pontes Finanças <naoresponda@pontesdev.com.br>",
        ["SMTP_FROM_SEGURANCA"] = "Pontes Finanças <seguranca@pontesdev.com.br>",
        ["SMTP_FROM_PRODUTO"] = "Pontes Finanças <pontes@pontesdev.com.br>",
        ["SMTP_REPLY_TO_PRODUTO"] = "responde@exemplo.com",
    };

    private static readonly MensagemEmail Mensagem = new("Pontes: teste", "texto", "<p>html</p>");

    [Fact]
    public void Ler_Producao_UmRemetentePorTipo()
    {
        var o = SmtpOpcoes.Ler(Env(Producao));

        Assert.True(o.Ativo);
        Assert.Equal("starttls", o.Seguranca);
        Assert.Equal("Pontes Finanças <naoresponda@pontesdev.com.br>", o.RemetenteDe(TipoRemetente.Automatico));
        Assert.Equal("Pontes Finanças <seguranca@pontesdev.com.br>", o.RemetenteDe(TipoRemetente.Seguranca));
        Assert.Equal("Pontes Finanças <pontes@pontesdev.com.br>", o.RemetenteDe(TipoRemetente.Produto));
        Assert.Null(o.ResponderDe(TipoRemetente.Automatico));
        Assert.Null(o.ResponderDe(TipoRemetente.Seguranca));
        Assert.Equal("responde@exemplo.com", o.ResponderDe(TipoRemetente.Produto));
    }

    [Fact]
    public void Ler_SoComSmtpFrom_TudoSaiDele()
    {
        var o = SmtpOpcoes.Ler(Env(new() { ["SMTP_HOST"] = "localhost", ["SMTP_FROM"] = "Pontes Finanças <dev@localhost>" }));

        Assert.All(Enum.GetValues<TipoRemetente>(), t => Assert.Equal("Pontes Finanças <dev@localhost>", o.RemetenteDe(t)));
        Assert.Null(o.ResponderDe(TipoRemetente.Produto));
    }

    [Theory]
    [InlineData(TipoRemetente.Automatico, "naoresponda@pontesdev.com.br", null)]
    [InlineData(TipoRemetente.Seguranca, "seguranca@pontesdev.com.br", null)]
    [InlineData(TipoRemetente.Produto, "pontes@pontesdev.com.br", "responde@exemplo.com")]
    public void Montar_RemetenteEReplyToDoTipo(TipoRemetente tipo, string de, string? responder)
    {
        var msg = SmtpEmailSender.Montar(SmtpOpcoes.Ler(Env(Producao)), "ana@teste.com", Mensagem, tipo);

        Assert.Equal(de, Assert.Single(msg.From.Mailboxes).Address);
        Assert.Equal("Pontes Finanças", Assert.Single(msg.From.Mailboxes).Name);
        Assert.Equal("ana@teste.com", Assert.Single(msg.To.Mailboxes).Address);
        if (responder is null) Assert.Empty(msg.ReplyTo);
        else Assert.Equal(responder, Assert.Single(msg.ReplyTo.Mailboxes).Address);
        Assert.Equal("Pontes: teste", msg.Subject);
    }
}

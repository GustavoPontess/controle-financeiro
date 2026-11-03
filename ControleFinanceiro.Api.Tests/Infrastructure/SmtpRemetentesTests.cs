using ControleFinanceiro.Api.Infrastructure.Email;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// De quem cada e-mail sai (decisão do Gustavo, 24/10/2026): automáticos de naoresponda@, alertas de segurança de
/// seguranca@, avisos do produto de pontes@. Nenhum leva Reply-To (2026-11-02: o domínio recebe pelo Email Routing da Cloudflare, a
/// resposta vai pro remetente). Sem as variáveis novas, tudo cai no SMTP_FROM (dev com Mailpit continua igual).
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
        ["SMTP_FROM"] = "Pontes <naoresponda@pontesdev.com.br>",
        ["SMTP_FROM_SEGURANCA"] = "Pontes <seguranca@pontesdev.com.br>",
        ["SMTP_FROM_PRODUTO"] = "Pontes <pontes@pontesdev.com.br>",
    };

    private static readonly MensagemEmail Mensagem = new("Pontes: teste", "texto", "<p>html</p>");

    [Fact]
    public void Ler_Producao_UmRemetentePorTipo()
    {
        var o = SmtpOpcoes.Ler(Env(Producao));

        Assert.True(o.Ativo);
        Assert.Equal("starttls", o.Seguranca);
        Assert.Equal("Pontes <naoresponda@pontesdev.com.br>", o.RemetenteDe(TipoRemetente.Automatico));
        Assert.Equal("Pontes <seguranca@pontesdev.com.br>", o.RemetenteDe(TipoRemetente.Seguranca));
        Assert.Equal("Pontes <pontes@pontesdev.com.br>", o.RemetenteDe(TipoRemetente.Produto));
    }

    [Fact]
    public void Ler_SoComSmtpFrom_TudoSaiDele()
    {
        var o = SmtpOpcoes.Ler(Env(new() { ["SMTP_HOST"] = "localhost", ["SMTP_FROM"] = "Pontes <dev@localhost>" }));

        Assert.All(Enum.GetValues<TipoRemetente>(), t => Assert.Equal("Pontes <dev@localhost>", o.RemetenteDe(t)));
    }

    [Theory]
    [InlineData(TipoRemetente.Automatico, "naoresponda@pontesdev.com.br")]
    [InlineData(TipoRemetente.Seguranca, "seguranca@pontesdev.com.br")]
    [InlineData(TipoRemetente.Produto, "pontes@pontesdev.com.br")]
    public void Montar_RemetenteDoTipo_SemReplyTo(TipoRemetente tipo, string de)
    {
        var msg = SmtpEmailSender.Montar(SmtpOpcoes.Ler(Env(Producao)), "ana@teste.com", Mensagem, tipo);

        Assert.Equal(de, Assert.Single(msg.From.Mailboxes).Address);
        Assert.Equal("Pontes", Assert.Single(msg.From.Mailboxes).Name);
        Assert.Equal("ana@teste.com", Assert.Single(msg.To.Mailboxes).Address);
        Assert.Empty(msg.ReplyTo);
        Assert.Equal("Pontes: teste", msg.Subject);
    }
}

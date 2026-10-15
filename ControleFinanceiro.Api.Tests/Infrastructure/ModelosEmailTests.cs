using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure.Email;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Os e-mails do Pontes sem SMTP: o de reset leva o token (escapado) no link da tela de redefinir do front,
/// o de código mostra o código, o de exclusão leva pro login — e tudo que vem de fora entra escapado no HTML.
/// </summary>
public class ModelosEmailTests
{
    private static readonly DateTime Expira = new(2026, 10, 15, 21, 30, 0, DateTimeKind.Utc);

    [Fact]
    public void ResetSenha_LinkDaTelaDoFront_ComTokenEscapado()
    {
        var m = ModelosEmail.ResetSenha("http://localhost:5174/", "ab+c/d=", Expira);

        const string link = "http://localhost:5174/redefinir-senha?token=ab%2Bc%2Fd%3D";
        Assert.Contains(link, m.Texto);
        Assert.Contains(link, m.Html);
        Assert.Contains("1 hora", m.Texto);
        Assert.DoesNotContain("ab+c/d=", m.Html); // nunca o token cru no HTML
        Assert.StartsWith("Pontes", m.Assunto);
    }

    [Fact]
    public void CodigoOtp_MostraOCodigo_EDizPraQue()
    {
        var m = ModelosEmail.CodigoOtp("482913", TipoOtpEmail.ExcluirConta, Expira);

        Assert.Contains("482913", m.Assunto);
        Assert.Contains("482913", m.Texto);
        Assert.Contains("482913", m.Html);
        Assert.Contains("exclusão da sua conta", m.Texto);
    }

    [Fact]
    public void AvisoExclusao_LevaProLogin_EDizOPrazo()
    {
        var m = ModelosEmail.AvisoExclusao("https://app.pontes.test", Expira, 30);

        Assert.Contains("https://app.pontes.test/entrar", m.Texto);
        Assert.Contains("30 dias", m.Texto);
        Assert.Contains("https://app.pontes.test/entrar", m.Html);
    }

    [Fact]
    public void Html_EscapaOQueVemDeFora()
    {
        var m = ModelosEmail.CodigoOtp("<b>x</b>", TipoOtpEmail.ExcluirConta, Expira);

        Assert.DoesNotContain("<b>x</b>", m.Html);
        Assert.Contains("&lt;b&gt;x&lt;/b&gt;", m.Html);
    }

    [Fact]
    public void Opcoes_SemHost_FicaNoStub_EComHost_LeTudo()
    {
        var vazio = SmtpOpcoes.Ler(_ => null);
        Assert.False(vazio.Ativo);
        Assert.Equal(587, vazio.Porta);
        Assert.Equal(SmtpOpcoes.AppUrlPadrao, vazio.AppUrl);

        var env = new Dictionary<string, string?>
        {
            ["SMTP_HOST"] = "localhost", ["SMTP_PORT"] = "1025", ["SMTP_SECURITY"] = "NONE",
            ["SMTP_FROM"] = "Pontes <oi@pontes.test>", ["APP_URL"] = "https://app.pontes.test/",
        };
        var o = SmtpOpcoes.Ler(k => env.GetValueOrDefault(k));
        Assert.True(o.Ativo);
        Assert.Equal(1025, o.Porta);
        Assert.Equal("none", o.Seguranca);
        Assert.Null(o.Usuario);
        Assert.Equal("https://app.pontes.test", o.AppUrl); // sem a barra do fim
    }
}

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
        var m = ModelosEmail.ResetSenha("http://localhost:5174/", "ana@teste.com", "ab+c/d=", Expira);

        const string link = "http://localhost:5174/redefinir-senha#token=ab%2Bc%2Fd%3D";
        Assert.Contains(link, m.Texto);
        Assert.Contains(link, m.Html);
        Assert.Contains("só funciona uma vez", m.Texto);
        Assert.DoesNotContain("ab+c/d=", m.Html); // nunca o token cru no HTML
        Assert.Contains("Pontes", m.Assunto);
        // Diz PRA QUAL conta é (quem tem mais de um e-mail reconhece; golpe genérico não sabe).
        Assert.Contains("an•••@teste.com", m.Texto);
        Assert.Contains("an•••@teste.com", m.Html);
        // Escondido como o olho fechado do app: o endereço inteiro nunca aparece.
        Assert.DoesNotContain("ana@teste.com", m.Texto);
        Assert.DoesNotContain("ana@teste.com", m.Html);
    }

    [Fact]
    public void ResetSenha_TemONaoFuiEu_QueCancelaOLink()
    {
        var m = ModelosEmail.ResetSenha("http://localhost:5174/", "ana@teste.com", "ab+c/d=", Expira);

        Assert.Contains("http://localhost:5174/nao-pedi-senha#token=ab%2Bc%2Fd%3D", m.Html);
        Assert.Contains("http://localhost:5174/nao-pedi-senha#token=ab%2Bc%2Fd%3D", m.Texto);
        Assert.Contains("Não fui eu, cancelar este link", m.Html);
    }

    [Fact]
    public void Layout_TemLogoEmbutido_Previa_ERodapeAntiGolpe()
    {
        var m = ModelosEmail.ResetSenha("http://localhost:5174", "ana@teste.com", "tok", Expira);

        Assert.Contains($"src=\"cid:{ModelosEmail.CidLogo}\"", m.Html);
        Assert.Contains("alt=\"Pontes\"", m.Html);
        Assert.Contains("Use o link em até 1 hora", m.Html); // prévia da caixa de entrada
        Assert.Contains("nunca pede sua senha", m.Html);
        Assert.Contains("nunca pede sua senha", m.Texto);
    }

    [Fact]
    public void CodigoOtp_MostraOCodigo_EDizPraQue()
    {
        var m = ModelosEmail.CodigoOtp("ana@teste.com", "482913", TipoOtpEmail.ExcluirConta, Expira);

        Assert.Contains("482913", m.Assunto);
        Assert.Contains("482913", m.Texto);
        Assert.Contains("482913", m.Html);
        Assert.Contains("exclusão da sua conta", m.Texto);
    }

    [Fact]
    public void AvisoExclusao_LevaProLogin_EDizOPrazo()
    {
        var m = ModelosEmail.AvisoExclusao("https://app.pontes.test", "ana@teste.com", Expira, 30);

        Assert.Contains("https://app.pontes.test/entrar", m.Texto);
        Assert.Contains("30 dias", m.Texto);
        Assert.Contains("https://app.pontes.test/entrar", m.Html);
    }

    [Fact]
    public void PedidoRecebido_LevaConfirmarENaoFuiEu_ComOTokenEscapado()
    {
        var m = ModelosEmail.PedidoRecebido("https://app.pontes.test/", "ana@teste.com", "ab+c/d=", Expira);

        Assert.Contains("pedido", m.Assunto);
        Assert.Contains("an•••@teste.com", m.Texto);
        Assert.Contains("an•••@teste.com", m.Html);
        Assert.DoesNotContain("ana@teste.com", m.Html);
        Assert.Contains("https://app.pontes.test/confirmar-email#token=ab%2Bc%2Fd%3D", m.Html);
        Assert.Contains("https://app.pontes.test/nao-fui-eu#token=ab%2Bc%2Fd%3D", m.Html);
        Assert.Contains("https://app.pontes.test/nao-fui-eu#token=ab%2Bc%2Fd%3D", m.Texto);
        Assert.DoesNotContain("ab+c/d=", m.Html); // nunca o token cru
        Assert.Contains("Confirmar meu e-mail", m.Html);
        Assert.Contains("Não fui eu", m.Html);
        Assert.DoesNotContain("—", m.Texto);
        Assert.DoesNotContain("—", m.Html);
    }

    [Fact]
    public void Empresa_SemCnpj_SoMostraOQueEVerdade()
    {
        var e = new Empresa("Pontes", null, null, null, null, "app.pontes.test");

        var linhas = DadosEmpresa.Linhas(e, 2026);

        Assert.Equal(new[] { "© 2026 Pontes", "app.pontes.test" }, linhas);
    }

    [Fact]
    public void Empresa_ComCnpj_MostraRazaoSocialCnpjEnderecoEContato()
    {
        var e = new Empresa("Pontes", "Pontes Tecnologia Ltda.", "12.345.678/0001-90", "Rua A, 1 · Centro · BH/MG", "oi@pontes.test", "app.pontes.test");

        var linhas = DadosEmpresa.Linhas(e, 2026);

        Assert.Equal(new[]
        {
            "© 2026 Pontes Tecnologia Ltda. · CNPJ 12.345.678/0001-90",
            "Rua A, 1 · Centro · BH/MG",
            "oi@pontes.test · app.pontes.test",
        }, linhas);
    }

    [Fact]
    public void Rodape_LevaOsDadosDaEmpresa_NoTextoENoHtml()
    {
        var m = ModelosEmail.PedidoRecebido("http://localhost:5174", "ana@teste.com", "tok", Expira);

        Assert.Contains(DadosEmpresa.Atual.Site, m.Texto);
        Assert.Contains(DadosEmpresa.Atual.Site, m.Html);
        Assert.Contains(DadosEmpresa.Atual.Cnpj!, m.Html);
        Assert.Contains(DadosEmpresa.Atual.Endereco!, m.Html);
    }

    [Fact]
    public void ExclusaoCancelada_AvisaEDizOQueFazerSeNaoFoiVoce()
    {
        var m = ModelosEmail.ExclusaoCancelada("https://app.pontes.test", "ana@teste.com", Expira);

        Assert.Contains("an•••@teste.com", m.Texto);
        Assert.Contains("Troque a senha", m.Texto);
        Assert.Contains("https://app.pontes.test/entrar", m.Html);
    }

    [Fact]
    public void ContaApagada_SemLink_ERodapeNaoDizQueAContaExiste()
    {
        var m = ModelosEmail.ContaApagada("ana@teste.com", Expira);

        Assert.Contains("foi apagada", m.Assunto);
        Assert.DoesNotContain("<a href", m.Html);
        Assert.Contains("foi apagada", m.Html);
        Assert.DoesNotContain("porque existe uma conta", m.Html);
        Assert.DoesNotContain("porque existe uma conta", m.Texto);
    }

    [Fact]
    public void Html_EscapaOQueVemDeFora()
    {
        var m = ModelosEmail.CodigoOtp("x@<i>y</i>.com", "<b>x</b>", TipoOtpEmail.ExcluirConta, Expira);

        Assert.DoesNotContain("<b>x</b>", m.Html);
        Assert.Contains("&lt;b&gt;x&lt;/b&gt;", m.Html);
        Assert.DoesNotContain("<i>y</i>", m.Html);
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

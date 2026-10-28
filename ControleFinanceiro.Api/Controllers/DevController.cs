using System.Net;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure.Email;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControleFinanceiro.Api.Controllers;

/// <summary>
/// SÓ EM DEVELOPMENT: ferramentas de quem desenvolve. Em qualquer outro ambiente tudo aqui responde 404.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[ApiExplorerSettings(IgnoreApi = true)]
public class DevController : ControllerBase
{
    private readonly IHostEnvironment _env;

    public DevController(IHostEnvironment env) => _env = env;

    /// <summary>
    /// Todos os e-mails do Pontes numa página só, montados pelos modelos de verdade (ModelosEmail) com dados de exemplo.
    /// E-mail novo entra na lista abaixo. Abrir: http://localhost:5174/api/v1/dev/emails
    /// </summary>
    [HttpGet("emails")]
    [AllowAnonymous]
    public IActionResult Emails()
    {
        if (!_env.IsDevelopment()) return NotFound();

        const string app = "http://localhost:5174";
        const string email = "gustavo@gmail.com";
        var agora = DateTime.UtcNow;
        var emails = new (string Quando, MensagemEmail M)[]
        {
            ("Pedir acesso: logo depois do cadastro", ModelosEmail.PedidoRecebido(app, email, "exemplo", agora.AddDays(7))),
            ("Admin aprovou o pedido", ModelosEmail.AcessoLiberado(app, email)),
            ("Esqueci a senha, ou o Admin forçou a troca", ModelosEmail.ResetSenha(app, email, "exemplo", agora.AddHours(1))),
            ("Código pra excluir a conta", ModelosEmail.CodigoOtp(email, "482913", TipoOtpEmail.ExcluirConta, agora.AddMinutes(10))),
            ("Conta marcada pra exclusão", ModelosEmail.AvisoExclusao(app, email, agora, 30)),
            ("Exclusão cancelada (entrou na carência, ou o Admin cancelou)", ModelosEmail.ExclusaoCancelada(app, email, agora)),
            ("Conta apagada de vez (fim dos 30 dias, ou pelo Admin)", ModelosEmail.ContaApagada(email, agora)),
        };

        var logo = "data:image/png;base64," + Convert.ToBase64String(Logo());
        var cartoes = string.Concat(emails.Select(e =>
            "<section><p class=\"quando\">" + WebUtility.HtmlEncode(e.Quando) + "</p>" +
            "<p class=\"assunto\">Assunto: <b>" + WebUtility.HtmlEncode(e.M.Assunto) + "</b></p>" +
            "<iframe loading=\"lazy\" srcdoc=\"" + WebUtility.HtmlEncode(e.M.Html.Replace($"cid:{ModelosEmail.CidLogo}", logo)) + "\"></iframe></section>"));

        var html =
            "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><title>E-mails do Pontes</title><style>" +
            "body{margin:0;padding:24px;background:#efe6de;font-family:system-ui,sans-serif;color:#22160f}" +
            "h1{font-size:22px;margin:0 0 4px}.sub{margin:0 0 20px;color:#7a6557;font-size:14px}" +
            ".grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(560px,1fr));gap:20px}" +
            "section{background:#fff;border-radius:16px;padding:14px}.quando{margin:0;font-weight:700}" +
            ".assunto{margin:4px 0 10px;font-size:13px;color:#7a6557}" +
            "iframe{width:100%;height:760px;border:0;border-radius:10px}" +
            "</style></head><body><h1>E-mails do Pontes</h1>" +
            $"<p class=\"sub\">{emails.Length} e-mails, montados pelos modelos de verdade com dados de exemplo. Só existe em desenvolvimento.</p>" +
            "<div class=\"grade\">" + cartoes + "</div></body></html>";
        // A API inteira sai com CSP "default-src 'none'" (só JSON). Esta página (só em desenvolvimento) precisa de
        // estilo inline, a logo em data: e os e-mails em iframe srcdoc, que herda esta mesma regra.
        Response.Headers["Content-Security-Policy"] =
            "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
            "img-src data:; frame-src 'self' about:; frame-ancestors 'self'; base-uri 'none'";
        Response.Headers["X-Frame-Options"] = "SAMEORIGIN";
        return Content(html, "text/html; charset=utf-8");
    }

    private static byte[] Logo()
    {
        using var s = typeof(ModelosEmail).Assembly.GetManifestResourceStream("ControleFinanceiro.Api.Infrastructure.Email.logo-pontes.png")!;
        using var ms = new MemoryStream();
        s.CopyTo(ms);
        return ms.ToArray();
    }
}

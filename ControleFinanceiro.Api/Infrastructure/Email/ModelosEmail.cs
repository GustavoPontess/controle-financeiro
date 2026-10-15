using System.Net;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Infrastructure.Email;

/// <summary>Assunto + texto puro + HTML de um e-mail, prontos pra enviar.</summary>
public sealed record MensagemEmail(string Assunto, string Texto, string Html);

/// <summary>
/// Os e-mails que o Pontes manda, em português e sem depender de SMTP (testáveis). Tudo que vem de fora
/// (token, código) entra escapado no HTML; datas em horário de Brasília. Nenhum e-mail pede senha nem traz
/// link pra outro lugar que não o próprio app.
/// </summary>
public static class ModelosEmail
{
    private static readonly TimeZoneInfo Brasilia = Fuso();

    /// <summary>Recuperar senha: o link leva pra tela de redefinir do front com o token bruto na query.</summary>
    public static MensagemEmail ResetSenha(string appUrl, string token, DateTime expiraEmUtc)
    {
        var link = $"{appUrl.TrimEnd('/')}/redefinir-senha?token={Uri.EscapeDataString(token)}";
        var validade = $"O link vale até {Hora(expiraEmUtc)} (1 hora). Se você não pediu, ignore este e-mail — sua senha continua a mesma.";
        return new MensagemEmail(
            "Pontes — criar uma senha nova",
            $"Alguém pediu pra criar uma senha nova na sua conta do Pontes.\n\nAbra este link pra escolher a senha:\n{link}\n\n{validade}",
            Html("Criar uma senha nova", "Alguém pediu pra criar uma senha nova na sua conta do Pontes.", Botao(link, "Escolher a senha nova"), validade, link));
    }

    /// <summary>Código OTP de uma ação sensível (hoje: excluir a conta).</summary>
    public static MensagemEmail CodigoOtp(string codigo, TipoOtpEmail finalidade, DateTime expiraEmUtc)
    {
        var acao = finalidade switch
        {
            TipoOtpEmail.ExcluirConta => "confirmar a exclusão da sua conta",
            _ => "confirmar uma ação na sua conta",
        };
        var validade = $"O código vale até {Hora(expiraEmUtc)}. Se não foi você, troque sua senha — alguém pode estar com acesso à sua conta.";
        var destaque = $"<p style=\"margin:20px 0;font-size:32px;font-weight:700;letter-spacing:6px;font-family:ui-monospace,Menlo,Consolas,monospace\">{WebUtility.HtmlEncode(codigo)}</p>";
        return new MensagemEmail(
            $"Pontes — seu código: {codigo}",
            $"Use este código pra {acao}:\n\n{codigo}\n\n{validade}",
            Html("Seu código de confirmação", $"Use este código pra {acao}:", destaque, validade, null));
    }

    /// <summary>Aviso fora do app de que a conta foi marcada pra exclusão (a pessoa ainda pode reagir).</summary>
    public static MensagemEmail AvisoExclusao(string appUrl, DateTime marcadoEmUtc, int diasCarencia)
    {
        var link = $"{appUrl.TrimEnd('/')}/entrar";
        var corpo = $"Sua conta do Pontes foi marcada pra exclusão em {Hora(marcadoEmUtc)}. Em {diasCarencia} dias os dados são apagados de vez.";
        var reagir = "Se foi você, não precisa fazer nada. Se NÃO foi você, entre no app antes do prazo: a conta é reativada e você deve trocar a senha.";
        return new MensagemEmail(
            "Pontes — sua conta foi marcada pra exclusão",
            $"{corpo}\n\n{reagir}\n\n{link}",
            Html("Conta marcada pra exclusão", corpo, Botao(link, "Entrar e reativar"), reagir, link));
    }

    private static string Hora(DateTime utc)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Brasilia);
        return local.ToString("dd/MM/yyyy 'às' HH:mm") + " (horário de Brasília)";
    }

    private static TimeZoneInfo Fuso()
    {
        foreach (var id in new[] { "America/Sao_Paulo", "E. South America Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); } catch (TimeZoneNotFoundException) { } catch (InvalidTimeZoneException) { }
        }
        return TimeZoneInfo.Utc;
    }

    private static string Botao(string link, string rotulo) =>
        $"<p style=\"margin:24px 0\"><a href=\"{WebUtility.HtmlEncode(link)}\" style=\"display:inline-block;padding:12px 20px;border-radius:10px;background:#15161A;color:#FFFFFF;font-weight:600;text-decoration:none\">{WebUtility.HtmlEncode(rotulo)}</a></p>";

    /// <summary>Layout único: cartão branco, título, texto, miolo (botão ou código) e o rodapé com a validade.</summary>
    private static string Html(string titulo, string texto, string miolo, string rodape, string? linkTexto) =>
        "<!doctype html><html lang=\"pt-BR\"><body style=\"margin:0;padding:24px;background:#F5F5F3;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#15161A\">" +
        "<div style=\"max-width:520px;margin:0 auto;padding:28px;border-radius:16px;background:#FFFFFF\">" +
        "<p style=\"margin:0 0 20px;font-size:20px;font-weight:700\">Pontes</p>" +
        $"<h1 style=\"margin:0 0 12px;font-size:22px\">{WebUtility.HtmlEncode(titulo)}</h1>" +
        $"<p style=\"margin:0;font-size:15px;line-height:1.5\">{WebUtility.HtmlEncode(texto)}</p>" +
        miolo +
        $"<p style=\"margin:0;font-size:13px;line-height:1.5;color:#65686F\">{WebUtility.HtmlEncode(rodape)}</p>" +
        (linkTexto is null ? "" : $"<p style=\"margin:16px 0 0;font-size:12px;color:#9C9FA7;word-break:break-all\">Se o botão não abrir, copie este endereço: {WebUtility.HtmlEncode(linkTexto)}</p>") +
        "</div></body></html>";
}

using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Infrastructure.Email;

/// <summary>Assunto + texto puro + HTML de um e-mail, prontos pra enviar.</summary>
public sealed record MensagemEmail(string Assunto, string Texto, string Html);

/// <summary>
/// Os e-mails que o Pontes manda, em português e sem depender de SMTP (testáveis). Mesmo layout pros três:
/// logo (imagem embutida <see cref="CidLogo"/>, sem depender de servidor de imagem), título, texto que diz
/// PRA QUAL CONTA é o e-mail, a ação (botão ou código), a validade, o "não foi você?" e o rodapé anti-golpe.
/// Tudo que vem de fora (e-mail, token, código) entra escapado no HTML; datas em horário de Brasília.
/// Nenhum e-mail pede senha nem traz link pra outro lugar que não o próprio app. Layout em tabela (o que
/// Gmail, Outlook e Apple Mail renderizam igual) e só CSS inline.
/// </summary>
public static class ModelosEmail
{
    /// <summary>Content-ID do logo embutido — o <see cref="SmtpEmailSender"/> anexa o PNG com este id.</summary>
    public const string CidLogo = "logo-pontes";

    private static readonly TimeZoneInfo Brasilia = Fuso();

    /// <summary>Recuperar senha: o link leva pra tela de redefinir do front com o token bruto na query.</summary>
    public static MensagemEmail ResetSenha(string appUrl, string email, string token, DateTime expiraEmUtc)
    {
        var link = $"{appUrl.TrimEnd('/')}/redefinir-senha?token={Uri.EscapeDataString(token)}";
        var texto = $"Recebemos um pedido pra criar uma senha nova na conta do Pontes Finanças de {email}.";
        var validade = $"O link vale até {Hora(expiraEmUtc)} e só funciona uma vez.";
        const string naoFoi = "Não foi você? É só ignorar este e-mail: sua senha continua a mesma e ninguém entra sem este link.";
        return new MensagemEmail(
            "Redefinir sua senha do Pontes Finanças",
            $"{texto}\n\nCriar senha nova: {link}\n\n{validade}\n\n{naoFoi}{RodapeTexto(email)}",
            Html(
                previa: "Use o link em até 1 hora. Se não foi você, ignore.",
                titulo: "Redefinir sua senha",
                texto: texto,
                miolo: Botao(link, "Criar senha nova"),
                validade: validade,
                naoFoi: naoFoi,
                linkReserva: link,
                email: email));
    }

    /// <summary>Código OTP de uma ação sensível (hoje: excluir a conta).</summary>
    public static MensagemEmail CodigoOtp(string email, string codigo, TipoOtpEmail finalidade, DateTime expiraEmUtc)
    {
        var acao = finalidade switch
        {
            TipoOtpEmail.ExcluirConta => "confirmar a exclusão da sua conta",
            _ => "confirmar uma ação na sua conta",
        };
        var texto = $"Use este código pra {acao} ({email}).";
        var validade = $"O código vale até {Hora(expiraEmUtc)}. Não passe pra ninguém, nem pra quem diz ser do Pontes Finanças.";
        const string naoFoi = "Não foi você? Troque sua senha agora: alguém pode estar com acesso à sua conta.";
        var miolo =
            "<tr><td style=\"padding:24px 0 8px\">" +
            "<div style=\"display:inline-block;padding:14px 22px;border-radius:12px;background:#F5F5F3;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#15161A\">" +
            Esc(codigo) + "</div></td></tr>";
        return new MensagemEmail(
            $"Seu código do Pontes Finanças: {codigo}",
            $"{texto}\n\n{codigo}\n\n{validade}\n\n{naoFoi}{RodapeTexto(email)}",
            Html(
                previa: $"Código {codigo}. Vale por pouco tempo.",
                titulo: "Seu código de confirmação",
                texto: texto,
                miolo: miolo,
                validade: validade,
                naoFoi: naoFoi,
                linkReserva: null,
                email: email));
    }

    /// <summary>Aviso fora do app de que a conta foi marcada pra exclusão (a pessoa ainda pode reagir).</summary>
    public static MensagemEmail AvisoExclusao(string appUrl, string email, DateTime marcadoEmUtc, int diasCarencia)
    {
        var link = $"{appUrl.TrimEnd('/')}/entrar";
        var texto = $"A conta do Pontes Finanças de {email} foi marcada pra exclusão em {Hora(marcadoEmUtc)}.";
        var validade = $"Daqui a {diasCarencia} dias os dados são apagados de vez. Até lá, entrar na conta cancela a exclusão.";
        const string naoFoi = "Foi você? Não precisa fazer nada. Não foi? Entre antes do prazo e troque sua senha.";
        return new MensagemEmail(
            "Sua conta do Pontes Finanças foi marcada pra exclusão",
            $"{texto}\n\n{validade}\n\n{naoFoi}\n\nEntrar: {link}{RodapeTexto(email)}",
            Html(
                previa: $"Os dados são apagados em {diasCarencia} dias. Ainda dá pra voltar atrás.",
                titulo: "Conta marcada pra exclusão",
                texto: texto,
                miolo: Botao(link, "Entrar e manter minha conta"),
                validade: validade,
                naoFoi: naoFoi,
                linkReserva: link,
                email: email));
    }

    /// <summary>Escapa só o que quebra HTML (texto e atributo entre aspas). Acento fica como está — o
    /// WebUtility.HtmlEncode viraria "até" em "at&amp;#233;" e incharia o e-mail sem ganho nenhum.</summary>
    private static string Esc(string s) => s
        .Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;").Replace("'", "&#39;");

    private static string RodapeTexto(string email) =>
        $"\n\nO Pontes Finanças nunca pede sua senha por e-mail, mensagem ou telefone.\nVocê recebeu este e-mail porque existe uma conta do Pontes Finanças com o endereço {email}.";

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
        "<tr><td style=\"padding:24px 0 8px\">" +
        $"<a href=\"{Esc(link)}\" style=\"display:inline-block;padding:14px 24px;border-radius:12px;background:#15161A;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none\">{Esc(rotulo)}</a>" +
        "</td></tr>";

    /// <summary>
    /// Layout único. <paramref name="previa"/> é o texto que aparece ao lado do assunto na caixa de entrada
    /// (escondido no corpo); <paramref name="miolo"/> já vem como linha de tabela (botão ou código).
    /// </summary>
    private static string Html(string previa, string titulo, string texto, string miolo, string validade, string naoFoi, string? linkReserva, string email)
    {
        string E(string t) => Esc(t);
        const string fonte = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
        return
            "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
            "<meta name=\"color-scheme\" content=\"light\"><meta name=\"supported-color-schemes\" content=\"light\"></head>" +
            $"<body style=\"margin:0;padding:0;background:#F5F5F3;font-family:{fonte};color:#15161A\">" +
            $"<div style=\"display:none;max-height:0;overflow:hidden;opacity:0\">{E(previa)}</div>" +
            "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#F5F5F3\"><tr><td align=\"center\" style=\"padding:32px 16px\">" +
            "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:520px\">" +
            // Logo
            $"<tr><td style=\"padding:0 4px 20px\"><img src=\"cid:{CidLogo}\" width=\"104\" height=\"30\" alt=\"Pontes\" style=\"display:block;border:0;width:104px;height:auto\"></td></tr>" +
            // Cartão
            "<tr><td style=\"padding:32px 28px;border-radius:20px;background:#FFFFFF\">" +
            "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">" +
            $"<tr><td style=\"padding:0 0 12px;font-size:24px;font-weight:700;letter-spacing:-0.02em\">{E(titulo)}</td></tr>" +
            $"<tr><td style=\"font-size:15px;line-height:1.6;color:#3A3C42\">{E(texto)}</td></tr>" +
            miolo +
            $"<tr><td style=\"padding:12px 0 0;font-size:13px;line-height:1.6;color:#65686F\">{E(validade)}</td></tr>" +
            "<tr><td style=\"padding:20px 0 0\"><div style=\"height:1px;background:#E7E7E3;line-height:1px;font-size:1px\">&nbsp;</div></td></tr>" +
            $"<tr><td style=\"padding:16px 0 0;font-size:13px;line-height:1.6;color:#65686F\">{E(naoFoi)}</td></tr>" +
            (linkReserva is null ? "" :
                $"<tr><td style=\"padding:16px 0 0;font-size:12px;line-height:1.5;color:#9C9FA7\">Se o botão não abrir, copie este endereço no navegador:<br><span style=\"word-break:break-all;color:#65686F\">{E(linkReserva)}</span></td></tr>") +
            "</table></td></tr>" +
            // Rodapé
            "<tr><td style=\"padding:20px 8px 0;font-size:12px;line-height:1.6;color:#9C9FA7\">" +
            "<strong style=\"color:#65686F\">O Pontes Finanças nunca pede sua senha</strong> por e-mail, mensagem ou telefone.<br>" +
            $"Você recebeu este e-mail porque existe uma conta do Pontes Finanças com o endereço {E(email)}.<br>" +
            "Pontes Finanças · um produto Pontes Dev</td></tr>" +
            "</table></td></tr></table></body></html>";
    }
}

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
    // Todo link com código secreto leva o código depois do "#": essa parte nunca sai do navegador (nenhum servidor, proxy
    // ou log recebe). A tela lê e tira da barra de endereço (useTokenDoLink no front).
    public static MensagemEmail ResetSenha(string appUrl, string email, string token, DateTime expiraEmUtc)
    {
        email = Escondido(email);
        var link = $"{appUrl.TrimEnd('/')}/redefinir-senha#token={Uri.EscapeDataString(token)}";
        var texto = $"Recebemos um pedido pra criar uma senha nova na conta do Pontes de {email}.";
        var validade = $"O link vale até {Hora(expiraEmUtc)} e só funciona uma vez.";
        const string naoFoi = "Não foi você? Alguém digitou o seu e-mail no \"Esqueci a senha\", mas ninguém entra sem este link. Cancele o link no botão abaixo e ele para de valer. Sua senha continua a mesma.";
        var cancelar = $"{appUrl.TrimEnd('/')}/nao-pedi-senha#token={Uri.EscapeDataString(token)}";
        return new MensagemEmail(
            "Redefinir sua senha do Pontes",
            $"{texto}\n\nCriar senha nova: {link}\n\n{validade}\n\n{naoFoi}\nNão fui eu: {cancelar}{RodapeTexto(email)}",
            Html(
                previa: "Use o link em até 1 hora. Não foi você? Cancele o link.",
                titulo: "Redefinir sua senha",
                texto: texto,
                miolo: Botao(link, "Criar senha nova"),
                validade: validade,
                naoFoi: naoFoi,
                linkReserva: link,
                email: email,
                acaoNaoFoi: BotaoDiscreto(cancelar, "Não fui eu, cancelar este link")));
    }

    /// <summary>Código OTP de uma ação sensível (hoje: excluir a conta).</summary>
    public static MensagemEmail CodigoOtp(string email, string codigo, TipoOtpEmail finalidade, DateTime expiraEmUtc)
    {
        email = Escondido(email);
        var acao = finalidade switch
        {
            TipoOtpEmail.ExcluirConta => "confirmar a exclusão da sua conta",
            _ => "confirmar uma ação na sua conta",
        };
        var texto = $"Use este código pra {acao} ({email}).";
        var validade = $"O código vale até {Hora(expiraEmUtc)}. Não passe pra ninguém, nem pra quem diz ser do Pontes.";
        const string naoFoi = "Não foi você? Troque sua senha agora: alguém pode estar com acesso à sua conta.";
        var miolo =
            "<tr><td style=\"padding:24px 0 8px\">" +
            "<div style=\"display:inline-block;padding:14px 22px;border-radius:16px;background:#fff1e7;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#22160f\">" +
            Esc(codigo) + "</div></td></tr>";
        return new MensagemEmail(
            $"Seu código do Pontes: {codigo}",
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

    /// <summary>
    /// Pedido de acesso aprovado no Admin: a pessoa já pode entrar. É o e-mail que a tela "Pedido enviado" promete
    /// ("Você recebe um e-mail quando o acesso for liberado"). Sem dado nenhum além do próprio e-mail dela.
    /// </summary>
    public static MensagemEmail AcessoLiberado(string appUrl, string email)
    {
        email = Escondido(email);
        var link = $"{appUrl.TrimEnd('/')}/entrar";
        const string texto = "Seu pedido de acesso ao Pontes foi aprovado. Já dá pra entrar com o e-mail e a senha que você cadastrou.";
        const string validade = "Na primeira entrada, o Pontes sugere ligar a verificação em duas etapas. Leva um minuto e protege a sua conta.";
        const string naoFoi = "Não pediu acesso ao Pontes? Pode ignorar este e-mail. Ninguém entra sem a senha.";
        return new MensagemEmail(
            "Seu acesso ao Pontes foi liberado",
            $"{texto}\n\n{validade}\n\nEntrar: {link}\n\n{naoFoi}{RodapeTexto(email)}",
            Html(
                previa: "Seu pedido foi aprovado. Já dá pra entrar.",
                titulo: "Seu acesso foi liberado",
                texto: texto,
                miolo: Botao(link, "Entrar no Pontes"),
                validade: validade,
                naoFoi: naoFoi,
                linkReserva: link,
                email: email));
    }

    /// <summary>
    /// Pedido de acesso recebido (beta fechado). O cadastro não prova que o e-mail é de quem pediu, então o e-mail leva
    /// as duas saídas do dono da caixa: "Confirmar meu e-mail" (o pedido segue pra aprovação) e "Não fui eu" (apaga o
    /// pedido e os dados). Os links abrem uma página com o botão: nada acontece só de abrir (leitor de e-mail e antivírus
    /// abrem links sozinhos).
    /// </summary>
    public static MensagemEmail PedidoRecebido(string appUrl, string email, string token, DateTime expiraEmUtc)
    {
        email = Escondido(email);
        var raiz = appUrl.TrimEnd('/');
        var t = Uri.EscapeDataString(token);
        var confirmar = $"{raiz}/confirmar-email#token={t}";
        var naoFuiEu = $"{raiz}/nao-fui-eu#token={t}";
        var texto = $"Recebemos o seu pedido de acesso ao Pontes com o e-mail {email}. Confirme que o e-mail é seu pra o pedido seguir pra aprovação.";
        var validade = $"O link vale até {Hora(expiraEmUtc)}. Sem confirmação, o pedido é apagado nesse dia. Depois de aprovado, você recebe outro e-mail.";
        const string naoFoi = "Não pediu acesso ao Pontes? Alguém pode ter usado o seu e-mail. Toque em \"Não fui eu\" e o pedido é apagado, com os dados que vieram com ele.";
        // "Não fui eu" fica LONGE do botão de confirmar (embaixo da linha, junto do texto de quem não pediu), pra
        // ninguém apagar o próprio pedido sem querer.
        var acaoNaoFui = BotaoDiscreto(naoFuiEu, "Não fui eu, apagar este pedido");
        return new MensagemEmail(
            "Confirme seu pedido de acesso ao Pontes",
            $"{texto}\n\nConfirmar meu e-mail: {confirmar}\n\n{validade}\n\n{naoFoi}\nNão fui eu: {naoFuiEu}{RodapeTexto(email)}",
            Html(
                previa: "Confirme que o e-mail é seu. Não pediu? Apague o pedido.",
                titulo: "Confirme seu e-mail",
                texto: texto,
                miolo: Botao(confirmar, "Confirmar meu e-mail"),
                validade: validade,
                naoFoi: naoFoi,
                linkReserva: confirmar,
                email: email,
                acaoNaoFoi: acaoNaoFui));
    }

    /// <summary>Aviso fora do app de que a conta foi marcada pra exclusão (a pessoa ainda pode reagir).</summary>
    public static MensagemEmail AvisoExclusao(string appUrl, string email, DateTime marcadoEmUtc, int diasCarencia)
    {
        email = Escondido(email);
        var link = $"{appUrl.TrimEnd('/')}/entrar";
        var texto = $"A conta do Pontes de {email} foi marcada pra exclusão em {Hora(marcadoEmUtc)}.";
        var validade = $"Daqui a {diasCarencia} dias os dados são apagados de vez. Até lá, entrar na conta cancela a exclusão.";
        const string naoFoi = "Foi você? Não precisa fazer nada. Não foi? Entre antes do prazo e troque sua senha.";
        return new MensagemEmail(
            "Sua conta do Pontes foi marcada pra exclusão",
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

    /// <summary>
    /// O e-mail da pessoa aparece escondido, igual ao olho fechado do app (gu•••@gmail.com): quem tem a caixa sabe
    /// que é dela, e um e-mail encaminhado ou visto por cima do ombro não entrega o endereço inteiro.
    /// </summary>
    private static string Escondido(string email) => ControleFinanceiro.Api.Services.RosterService.MascararEmail(email);

    /// <summary>
    /// A exclusão da conta foi cancelada (a pessoa entrou de novo na carência, ou o admin cancelou). Serve de alerta: se
    /// não foi ela, alguém entrou com a senha dela.
    /// </summary>
    public static MensagemEmail ExclusaoCancelada(string appUrl, string email, DateTime quandoUtc)
    {
        email = Escondido(email);
        var link = $"{appUrl.TrimEnd('/')}/entrar";
        var texto = $"A exclusão da conta do Pontes de {email} foi cancelada em {Hora(quandoUtc)}. A conta e os dados continuam como estavam.";
        const string validade = "Se ainda quiser sair do Pontes, é só pedir a exclusão de novo em Configurações.";
        const string naoFoi = "Não foi você? Alguém entrou na sua conta com a sua senha. Troque a senha agora e ligue a verificação em duas etapas.";
        return new MensagemEmail(
            "Sua conta do Pontes continua ativa",
            $"{texto}\n\n{validade}\n\n{naoFoi}\n\nEntrar: {link}{RodapeTexto(email)}",
            Html(
                previa: "A exclusão foi cancelada. Se não foi você, troque a senha.",
                titulo: "Sua conta continua no Pontes",
                texto: texto,
                miolo: Botao(link, "Entrar no Pontes"),
                validade: validade,
                naoFoi: naoFoi,
                linkReserva: link,
                email: email));
    }

    /// <summary>
    /// Senha errada várias vezes seguidas (5 em 24 h, <c>TentativasLogin</c>): avisa o dono, no máximo 1 por dia. Quem
    /// tentou não fica sabendo (a tela dele é igual). Não diz o IP nem o lugar: só o que a pessoa precisa pra agir.
    /// </summary>
    public static MensagemEmail TentativasLogin(string appUrl, string email, int falhas, DateTime quandoUtc)
    {
        email = Escondido(email);
        var link = $"{appUrl.TrimEnd('/')}/entrar";
        var texto = $"A senha da conta do Pontes de {email} foi digitada errado {falhas} vezes seguidas, a última em {Hora(quandoUtc)}. Ninguém entrou.";
        const string validade = "Se foi você, pode ignorar este e-mail. Mandamos no máximo um aviso destes por dia.";
        const string naoFoi = "Não foi você? A conta continua protegida. Pra ficar ainda mais segura, entre, troque a senha em Configurações e ligue a verificação em duas etapas.";
        return new MensagemEmail(
            "Alguém tentou entrar na sua conta do Pontes",
            $"{texto}\n\n{validade}\n\n{naoFoi}\n\nEntrar: {link}{RodapeTexto(email)}",
            Html(
                previa: "A senha foi digitada errado várias vezes. Ninguém entrou.",
                titulo: "Alguém tentou entrar na sua conta",
                texto: texto,
                miolo: Botao(link, "Entrar e trocar a senha"),
                validade: validade,
                naoFoi: naoFoi,
                linkReserva: link,
                email: email));
    }

    /// <summary>
    /// A conta foi apagada de vez (fim da carência ou pelo admin, LGPD): confirma que os dados saíram. Sem link: a conta
    /// já não existe.
    /// </summary>
    public static MensagemEmail ContaApagada(string email, DateTime quandoUtc)
    {
        email = Escondido(email);
        var texto = $"A conta do Pontes de {email} foi apagada em {Hora(quandoUtc)}, com os seus dados, como foi pedido.";
        const string validade = "Se um dia quiser voltar, é só pedir acesso de novo com este e-mail.";
        const string naoFoi = "Não pediu isso? A exclusão foi pedida de dentro da sua conta e avisada por e-mail 30 dias atrás. Se não foi você, alguém tinha a sua senha: troque ela nos outros serviços onde usa a mesma.";
        return new MensagemEmail(
            "Sua conta do Pontes foi apagada",
            $"{texto}\n\n{validade}\n\n{naoFoi}{RodapeTexto(email, apagada: true)}",
            Html(
                previa: "Os seus dados foram apagados.",
                titulo: "Sua conta foi apagada",
                texto: texto,
                miolo: "",
                validade: validade,
                naoFoi: naoFoi,
                linkReserva: null,
                email: email,
                apagada: true));
    }

    /// <summary>Escapa só o que quebra HTML (texto e atributo entre aspas). Acento fica como está — o
    /// WebUtility.HtmlEncode viraria "até" em "at&amp;#233;" e incharia o e-mail sem ganho nenhum.</summary>
    private static string Esc(string s) => s
        .Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;").Replace("'", "&#39;");

    private static string RodapeTexto(string email, bool apagada = false) =>
        $"\n\nO Pontes nunca pede sua senha por e-mail, mensagem ou telefone.\n{Porque(email, apagada)}." +
        "\n\n" + string.Join("\n", Empresa());

    /// <summary>Linhas da empresa no rodapé (dados em <see cref="DadosEmpresa"/>).</summary>
    private static IReadOnlyList<string> Empresa() => DadosEmpresa.Linhas(DadosEmpresa.Atual, HorarioBrasil.Hoje().Year);

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

    /// <summary>Botão secundário (contorno, cinza) do "Não fui eu": fica longe do botão principal, embaixo da linha.</summary>
    private static string BotaoDiscreto(string link, string rotulo) =>
        "<tr><td style=\"padding:12px 0 0\">" +
        $"<a href=\"{Esc(link)}\" style=\"display:inline-block;padding:10px 18px;border-radius:999px;border:1px solid #e9d6c8;color:#7a6557;font-size:13px;font-weight:700;text-decoration:none\">{Esc(rotulo)}</a></td></tr>";

    private static string Botao(string link, string rotulo) =>
        "<tr><td style=\"padding:24px 0 8px\">" +
        $"<a href=\"{Esc(link)}\" style=\"display:inline-block;padding:15px 28px;border-radius:999px;background:#ff6a1f;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none\">{Esc(rotulo)}</a>" +
        "</td></tr>";

    /// <summary>
    /// Layout único. <paramref name="previa"/> é o texto que aparece ao lado do assunto na caixa de entrada
    /// (escondido no corpo); <paramref name="miolo"/> já vem como linha de tabela (botão ou código).
    /// </summary>
    /// <summary>Por que a pessoa recebeu o e-mail. Depois de apagada, a conta já não existe.</summary>
    private static string Porque(string email, bool apagada) => apagada
        ? $"Você recebeu este e-mail porque a conta do Pontes com o endereço {email} foi apagada"
        : $"Você recebeu este e-mail porque existe uma conta do Pontes com o endereço {email}";

    private static string Html(string previa, string titulo, string texto, string miolo, string validade, string naoFoi, string? linkReserva, string email, string acaoNaoFoi = "", bool apagada = false)
    {
        string E(string t) => Esc(t);
        const string fonte = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
        return
            "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
            "<meta name=\"color-scheme\" content=\"light\"><meta name=\"supported-color-schemes\" content=\"light\">" +
            "<link href=\"https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap\" rel=\"stylesheet\"></head>" +
            $"<body style=\"margin:0;padding:0;background:#fffaf6;font-family:{fonte};color:#22160f\">" +
            $"<div style=\"display:none;max-height:0;overflow:hidden;opacity:0\">{E(previa)}</div>" +
            "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#fffaf6\"><tr><td align=\"center\" style=\"padding:32px 16px\">" +
            "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:520px\">" +
            // Logo
            $"<tr><td style=\"padding:0 4px 20px\"><img src=\"cid:{CidLogo}\" width=\"138\" height=\"42\" alt=\"Pontes\" style=\"display:block;border:0;width:138px;height:auto\"></td></tr>" +
            // Cartão
            "<tr><td style=\"padding:32px 28px;border-radius:28px;background:#FFFFFF\">" +
            "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">" +
            $"<tr><td style=\"padding:0 0 12px;font-size:26px;font-weight:800;letter-spacing:-0.03em\">{E(titulo)}</td></tr>" +
            $"<tr><td style=\"font-size:15px;line-height:1.6;color:#4a3528\">{E(texto)}</td></tr>" +
            miolo +
            $"<tr><td style=\"padding:12px 0 0;font-size:13px;line-height:1.6;color:#7a6557\">{E(validade)}</td></tr>" +
            "<tr><td style=\"padding:20px 0 0\"><div style=\"height:1px;background:#f1e3d8;line-height:1px;font-size:1px\">&nbsp;</div></td></tr>" +
            $"<tr><td style=\"padding:16px 0 0;font-size:13px;line-height:1.6;color:#7a6557\">{E(naoFoi)}</td></tr>" +
            acaoNaoFoi +
            (linkReserva is null ? "" :
                $"<tr><td style=\"padding:16px 0 0;font-size:12px;line-height:1.5;color:#a8958a\">Se o botão não abrir, copie este endereço no navegador:<br><span style=\"word-break:break-all;color:#7a6557\">{E(linkReserva)}</span></td></tr>") +
            "</table></td></tr>" +
            // Rodapé
            "<tr><td style=\"padding:20px 8px 0;font-size:12px;line-height:1.6;color:#a8958a\">" +
            "<strong style=\"color:#7a6557\">O Pontes nunca pede sua senha</strong> por e-mail, mensagem ou telefone.<br>" +
            $"{E(Porque(email, apagada))}.<br>" +
            "Pontes · o dinheiro da casa</td></tr>" +
            // Dados da empresa (DadosEmpresa), separados por uma linha fina, como o rodapé do site.
            "<tr><td style=\"padding:14px 8px 0\"><div style=\"height:1px;background:#f1e3d8;line-height:1px;font-size:1px\">&nbsp;</div></td></tr>" +
            "<tr><td style=\"padding:12px 8px 0;font-size:11px;line-height:1.6;color:#a8958a\">" +
            string.Join("<br>", Empresa().Select(E)) + "</td></tr>" +
            "</table></td></tr></table></body></html>";
    }
}

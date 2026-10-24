namespace ControleFinanceiro.Api.Infrastructure.Email;

/// <summary>
/// Configuração do envio de e-mail, lida do ambiente (<c>.env</c>). Sem <c>SMTP_HOST</c> o envio fica no stub
/// de log (dev/CI sem caixa de e-mail). Em dev o Mailpit do <c>docker-compose.yml</c> recebe tudo em
/// <c>localhost:1025</c> e mostra em <c>http://localhost:8025</c>; em produção qualquer provedor com SMTP
/// (Resend, Brevo, SES…) entra só trocando estas variáveis.
/// </summary>
public sealed record SmtpOpcoes(
    string? Host,
    int Porta,
    string? Usuario,
    string? Senha,
    string Remetente,
    // auto (STARTTLS se o servidor oferecer — Mailpit não), starttls, ssl ou none.
    string Seguranca,
    // Raiz do front (links dos e-mails), sem barra no fim.
    string AppUrl)
{
    public const string RemetentePadrao = "Pontes Finanças <nao-responda@localhost>";
    public const string AppUrlPadrao = "http://localhost:5174";

    public bool Ativo => !string.IsNullOrWhiteSpace(Host);

    public static SmtpOpcoes Ler() => Ler(Environment.GetEnvironmentVariable);

    public static SmtpOpcoes Ler(Func<string, string?> env)
    {
        var porta = int.TryParse(env("SMTP_PORT"), out var p) && p > 0 ? p : 587;
        var seguranca = (env("SMTP_SECURITY") ?? "auto").Trim().ToLowerInvariant();
        if (seguranca is not ("auto" or "starttls" or "ssl" or "none")) seguranca = "auto";
        return new SmtpOpcoes(
            Host: Vazio(env("SMTP_HOST")),
            Porta: porta,
            Usuario: Vazio(env("SMTP_USER")),
            Senha: Vazio(env("SMTP_PASS")),
            Remetente: Vazio(env("SMTP_FROM")) ?? RemetentePadrao,
            Seguranca: seguranca,
            AppUrl: (Vazio(env("APP_URL")) ?? AppUrlPadrao).TrimEnd('/'));
    }

    private static string? Vazio(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}

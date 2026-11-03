namespace ControleFinanceiro.Api.Infrastructure.Email;

/// <summary>De quem o e-mail sai. Cada tipo tem o seu remetente (decisão do Gustavo, 24/10/2026).</summary>
public enum TipoRemetente
{
    /// <summary>Automáticos: recuperar senha, código de confirmação. Ninguém responde (naoresponda@ não existe na caixa: resposta é recusada).</summary>
    Automatico,
    /// <summary>Alertas de segurança da conta (exclusão marcada, senha trocada, login novo, 2FA).</summary>
    Seguranca,
    /// <summary>Avisos do produto (nenhum e-mail usa ainda); a resposta chega no próprio remetente, que recebe.</summary>
    Produto,
}

/// <summary>
/// Configuração do envio de e-mail, lida do ambiente (<c>.env</c> em dev; secrets do Kamal em produção). Sem
/// <c>SMTP_HOST</c> o envio fica no stub de log (dev/CI sem caixa de e-mail). Em dev o Mailpit do
/// <c>docker-compose.yml</c> recebe tudo em <c>localhost:1025</c> e mostra em <c>http://localhost:8025</c>; em
/// produção o Resend (<c>smtp.resend.com</c>, usuário <c>resend</c>, senha = chave da API).
/// Remetentes: <c>SMTP_FROM</c> (automáticos), <c>SMTP_FROM_SEGURANCA</c> e <c>SMTP_FROM_PRODUTO</c>; os que faltam
/// caem no <c>SMTP_FROM</c>. Sem Reply-To: o domínio recebe (Email Routing da Cloudflare → Gmail da PontesDev), a resposta vai pro remetente.
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
    string AppUrl,
    string RemetenteSeguranca,
    string RemetenteProduto)
{
    public const string RemetentePadrao = "Pontes <nao-responda@localhost>";
    public const string AppUrlPadrao = "http://localhost:5174";

    public bool Ativo => !string.IsNullOrWhiteSpace(Host);

    /// <summary>O remetente daquele tipo de e-mail.</summary>
    public string RemetenteDe(TipoRemetente tipo) => tipo switch
    {
        TipoRemetente.Seguranca => RemetenteSeguranca,
        TipoRemetente.Produto => RemetenteProduto,
        _ => Remetente,
    };

    public static SmtpOpcoes Ler() => Ler(Environment.GetEnvironmentVariable);

    public static SmtpOpcoes Ler(Func<string, string?> env)
    {
        var porta = int.TryParse(env("SMTP_PORT"), out var p) && p > 0 ? p : 587;
        var seguranca = (env("SMTP_SECURITY") ?? "auto").Trim().ToLowerInvariant();
        if (seguranca is not ("auto" or "starttls" or "ssl" or "none")) seguranca = "auto";
        var remetente = Vazio(env("SMTP_FROM")) ?? RemetentePadrao;
        return new SmtpOpcoes(
            Host: Vazio(env("SMTP_HOST")),
            Porta: porta,
            Usuario: Vazio(env("SMTP_USER")),
            Senha: Vazio(env("SMTP_PASS")),
            Remetente: remetente,
            Seguranca: seguranca,
            AppUrl: (Vazio(env("APP_URL")) ?? AppUrlPadrao).TrimEnd('/'),
            RemetenteSeguranca: Vazio(env("SMTP_FROM_SEGURANCA")) ?? remetente,
            RemetenteProduto: Vazio(env("SMTP_FROM_PRODUTO")) ?? remetente);
    }

    private static string? Vazio(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}

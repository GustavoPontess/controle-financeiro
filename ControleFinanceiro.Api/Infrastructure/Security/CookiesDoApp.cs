namespace ControleFinanceiro.Api.Infrastructure.Security;

/// <summary>
/// Nome e opções de TODO cookie do app num lugar só (2026-10-31, ROADMAP "cookie tossing").
/// Em HTTPS (produção) o nome ganha o prefixo <c>__Host-</c>: o navegador só aceita esse cookie vindo deste host,
/// com Secure, Path=/ e sem Domain. Sem ele, quem controlasse outro site do mesmo domínio (pontesdev.com.br, o site
/// do estúdio) plantava cookies com Domain=pontesdev.com.br (sessão, CSRF, refresh + conta ativa) e a pessoa passava
/// a operar logada na conta do atacante. Em HTTPS o cookie sem prefixo nunca é lido.
/// Em HTTPS o Path é sempre "/", exigência do <c>__Host-</c>: refresh e cookies de aparelho também vão em toda
/// requisição ao host (antes só no Path do auth), troca consciente pela garantia de que ninguém os planta.
/// Em HTTP (dev no localhost, testes) tudo fica como antes: nome puro (o prefixo exige origem segura e o navegador
/// recusaria) e o Path que o chamador der. Seguem httpOnly (menos o CSRF, que o front lê) e SameSite=Strict.
/// </summary>
public static class CookiesDoApp
{
    public const string PrefixoHost = "__Host-";

    public const string Jwt = "jwt";
    /// <summary>Cookie do double-submit (o front lê e manda no header de mesmo nome).</summary>
    public const string Csrf = "X-CSRF-Token";
    public const string ContaAtiva = "active_acct";
    /// <summary>Refresh de cada conta conectada: <c>rt_&lt;slot&gt;</c>.</summary>
    public const string PrefixoRefresh = "rt_";
    /// <summary>Dispositivo confiável do MFA ("lembrar este dispositivo").</summary>
    public const string DispositivoConfiavel = "td";
    /// <summary>Id do navegador pro roster (contas lembradas no login).</summary>
    public const string Navegador = "rd";

    /// <summary>Nome do cookie como vai pro navegador: com <c>__Host-</c> em HTTPS, puro em HTTP.</summary>
    public static string Nome(HttpRequest request, string nome) => request.IsHttps ? PrefixoHost + nome : nome;

    /// <param name="pathEmHttp">Path só em HTTP (dev); em HTTPS é sempre "/".</param>
    public static CookieOptions Opcoes(HttpRequest request, bool httpOnly = true, DateTimeOffset? expira = null, string pathEmHttp = "/") => new()
    {
        HttpOnly = httpOnly,
        Secure = request.IsHttps,
        SameSite = SameSiteMode.Strict,
        Path = request.IsHttps ? "/" : pathEmHttp,
        Expires = expira,
    };
}

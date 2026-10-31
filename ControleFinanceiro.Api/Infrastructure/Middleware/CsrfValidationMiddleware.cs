using ControleFinanceiro.Api.Infrastructure.Security;

namespace ControleFinanceiro.Api.Infrastructure.Middleware;

public class CsrfValidationMiddleware
{
    private readonly RequestDelegate _next;

    public CsrfValidationMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, CsrfTokenService csrfTokenService)
    {
        // Skip CSRF para endpoints públicos
        if (IsPublicEndpoint(context.Request.Path))
        {
            await _next(context);
            return;
        }

        // Validar CSRF apenas para métodos que modificam dados
        if (IsUnsafeMethod(context.Request.Method))
        {
            // Cookie __Host-X-CSRF-Token em HTTPS (CookiesDoApp): um par plantado por outro site do domínio não conta.
            var headerToken = context.Request.Headers["X-CSRF-Token"].FirstOrDefault();
            if (string.IsNullOrEmpty(headerToken)
                || !context.Request.Cookies.TryGetValue(CookiesDoApp.Nome(context.Request, CookiesDoApp.Csrf), out var cookieToken))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { message = "CSRF token missing" });
                return;
            }

            if (!csrfTokenService.ValidateToken(headerToken, cookieToken))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { message = "CSRF token invalid" });
                return;
            }
        }

        await _next(context);
    }

    private static bool IsPublicEndpoint(PathString path)
    {
        var pathValue = path.Value ?? string.Empty;
        return pathValue.Contains("/auth/login", StringComparison.OrdinalIgnoreCase) ||
               pathValue.Contains("/auth/register", StringComparison.OrdinalIgnoreCase) ||
               pathValue.Contains("/auth/forgot-password", StringComparison.OrdinalIgnoreCase) ||
               pathValue.Contains("/auth/reset-password", StringComparison.OrdinalIgnoreCase) ||
               // Links do e-mail de "pedido recebido" (confirmar e-mail / não fui eu): quem abre não tem sessão nem
               // cookie CSRF. Como o reset de senha: o segredo é o token de uso único do e-mail (forjar exige ter ele).
               pathValue.Contains("/auth/cadastro/confirmar-email", StringComparison.OrdinalIgnoreCase) ||
               pathValue.Contains("/auth/cadastro/nao-fui-eu", StringComparison.OrdinalIgnoreCase) ||
               // Passo 2 do login com MFA — ainda não há sessão nem cookie CSRF (o passo 1 não
               // emite sessão pra quem tem MFA), então é público igual ao /auth/login. Protegido
               // pelo challenge de uso único + TTL curto + rate-limit por IP (auth-mfa).
               pathValue.Contains("/auth/mfa/verificar-login", StringComparison.OrdinalIgnoreCase) ||
               // Reativar conta na carência: o usuário NÃO está logado (não há sessão nem cookie CSRF).
               // Público como o login; protegido por senha + rate-limit por IP (auth-login).
               pathValue.Contains("/auth/conta/reativar", StringComparison.OrdinalIgnoreCase) ||
               // Roster / chooser pré-login: sem sessão nem cookie CSRF. Autenticado só pelo cookie
               // opaco de device `rd` com SameSite=Strict — que NÃO vai em request cross-site, então
               // já é imune a CSRF (um DELETE forjado de outro site não carrega o cookie → no-op).
               pathValue.Contains("/auth/roster", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsUnsafeMethod(string method)
    {
        return method switch
        {
            "POST" or "PUT" or "DELETE" or "PATCH" => true,
            _ => false
        };
    }
}

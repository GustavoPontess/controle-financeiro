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
            var headerToken = context.Request.Headers["X-CSRF-Token"].FirstOrDefault();
            if (string.IsNullOrEmpty(headerToken) || !context.Request.Cookies.TryGetValue("X-CSRF-Token", out var cookieToken))
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
               // Passo 2 do login com MFA — ainda não há sessão nem cookie CSRF (o passo 1 não
               // emite sessão pra quem tem MFA), então é público igual ao /auth/login. Protegido
               // pelo challenge de uso único + TTL curto + rate-limit por IP (auth-mfa).
               pathValue.Contains("/auth/mfa/verificar-login", StringComparison.OrdinalIgnoreCase) ||
               // Reativar conta na carência: o usuário NÃO está logado (não há sessão nem cookie CSRF).
               // Público como o login; protegido por senha + rate-limit por IP (auth-login).
               pathValue.Contains("/auth/conta/reativar", StringComparison.OrdinalIgnoreCase);
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

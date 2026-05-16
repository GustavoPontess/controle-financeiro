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
               pathValue.Contains("/auth/reset-password", StringComparison.OrdinalIgnoreCase);
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

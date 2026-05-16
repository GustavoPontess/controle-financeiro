using ControleFinanceiro.Api.Infrastructure.Security;

namespace ControleFinanceiro.Api.Infrastructure.Middleware;

public class CsrfValidationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly CsrfTokenService _csrfTokenService;

    public CsrfValidationMiddleware(RequestDelegate next, CsrfTokenService csrfTokenService)
    {
        _next = next;
        _csrfTokenService = csrfTokenService;
    }

    public async Task InvokeAsync(HttpContext context)
    {
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

            if (!_csrfTokenService.ValidateToken(headerToken, cookieToken))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { message = "CSRF token invalid" });
                return;
            }
        }

        await _next(context);
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

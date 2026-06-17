namespace ControleFinanceiro.Api.Infrastructure.Middleware;

/// <summary>
/// Adiciona headers de segurança em TODA resposta (defesa em profundidade):
/// nosniff, anti-clickjacking (X-Frame-Options + frame-ancestors), Referrer-Policy,
/// Permissions-Policy, HSTS (só sob HTTPS) e Content-Security-Policy.
///
/// CSP **estrita** para a API (JSON não carrega recurso nenhum: <c>default-src 'none'</c>);
/// **relaxada** apenas nas páginas HTML que dependem de script/estilo inline — Swagger (dev)
/// e o dashboard do Hangfire — que de outra forma quebrariam.
/// </summary>
public sealed class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next) => _next = next;

    public Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;

        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "no-referrer";
        headers["Permissions-Policy"] =
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()";

        // HSTS só faz sentido sob HTTPS (em HTTP é ignorado/contraproducente).
        if (context.Request.IsHttps)
            headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";

        var path = context.Request.Path;
        var paginaHtmlComInline =
            path.StartsWithSegments("/swagger") || path.StartsWithSegments("/hangfire");

        headers["Content-Security-Policy"] = paginaHtmlComInline
            ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'none'; base-uri 'none'"
            : "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";

        return _next(context);
    }
}

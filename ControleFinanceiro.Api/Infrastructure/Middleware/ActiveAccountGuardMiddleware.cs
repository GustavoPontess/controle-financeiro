using System.Security.Claims;

namespace ControleFinanceiro.Api.Infrastructure.Middleware;

/// <summary>
/// Guarda multi-aba (multi-conta). O cookie <c>jwt</c> é único por origem e compartilhado entre as
/// abas, então depois de uma troca de conta numa aba, uma aba ANTIGA continuaria escrevendo como a
/// conta NOVA achando que ainda é a antiga — risco de gravar transação/valor na CONTA ERRADA (grave
/// num app de dinheiro). Cada aba manda o header <c>X-Active-Account</c> com a conta que ELA acredita
/// estar ativa; se não bater com o dono do <c>jwt</c> (a conta realmente ativa), a request mutante é
/// barrada com 409 e o front avisa/recarrega. Só vale para métodos que mudam dados e FORA dos
/// endpoints de auth (onde a conta ativa legitimamente muda — login/switch/refresh/logout).
/// Sem o header (cliente antigo) o guard é no-op — não quebra nada.
/// </summary>
public class ActiveAccountGuardMiddleware
{
    private readonly RequestDelegate _next;

    public ActiveAccountGuardMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        if (DeveChecar(context))
        {
            var header = context.Request.Headers["X-Active-Account"].FirstOrDefault();
            var jwtSub = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (!string.IsNullOrEmpty(header) && !string.IsNullOrEmpty(jwtSub)
                && !string.Equals(header, jwtSub, StringComparison.OrdinalIgnoreCase))
            {
                context.Response.StatusCode = StatusCodes.Status409Conflict;
                await context.Response.WriteAsJsonAsync(new
                {
                    code = "conta_desatualizada",
                    message = "A conta ativa mudou em outra aba. Recarregue a página para continuar.",
                });
                return;
            }
        }

        await _next(context);
    }

    private static bool DeveChecar(HttpContext ctx)
    {
        if (ctx.User?.Identity?.IsAuthenticated != true) return false;

        var metodo = ctx.Request.Method;
        if (metodo is not ("POST" or "PUT" or "DELETE" or "PATCH")) return false;

        // Endpoints de auth mudam a conta ativa de propósito (login/switch/refresh/logout) — a
        // divergência ali é esperada, não é aba defasada.
        var path = ctx.Request.Path.Value ?? string.Empty;
        return !path.Contains("/auth/", StringComparison.OrdinalIgnoreCase);
    }
}

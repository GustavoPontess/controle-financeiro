using System.Security.Claims;
using Hangfire.Dashboard;

namespace ControleFinanceiro.Api.Infrastructure;

/// <summary>
/// Protege o dashboard do Hangfire (/hangfire): exige usuário autenticado E presente na
/// allowlist de admin (env var <c>HANGFIRE_ADMIN_EMAILS</c>, e-mails separados por vírgula).
/// O sistema não tem papel "admin" global (só <c>PapelFamilia</c>, que é por família) — antes
/// desta allowlist, qualquer JWT válido (de qualquer usuário/testador) acessava o dashboard.
/// Sem a env var definida, o dashboard fica bloqueado por padrão (fail-closed).
/// </summary>
public class HangfireDashboardAuthFilter : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var httpContext = context.GetHttpContext();
        if (httpContext.User.Identity?.IsAuthenticated != true) return false;

        var email = httpContext.User.FindFirstValue(ClaimTypes.Email);
        if (string.IsNullOrEmpty(email)) return false;

        var allowlist = (Environment.GetEnvironmentVariable("HANGFIRE_ADMIN_EMAILS") ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return allowlist.Contains(email, StringComparer.OrdinalIgnoreCase);
    }
}

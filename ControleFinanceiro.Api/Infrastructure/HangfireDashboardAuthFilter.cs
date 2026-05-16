using Hangfire.Dashboard;

namespace ControleFinanceiro.Api.Infrastructure;

/// <summary>
/// Protege o dashboard do Hangfire (/hangfire): exige usuário autenticado.
/// O sistema ainda não tem papéis (admin), então qualquer usuário com JWT
/// válido acessa. Restringir a um papel admin fica para quando papéis
/// existirem (Bloco C — Família).
/// </summary>
public class HangfireDashboardAuthFilter : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var httpContext = context.GetHttpContext();
        return httpContext.User.Identity?.IsAuthenticated == true;
    }
}

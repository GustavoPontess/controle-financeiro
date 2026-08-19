using System.Security.Claims;
using ControleFinanceiro.Api.Infrastructure;
using Hangfire;
using Hangfire.AspNetCore;
using Hangfire.Dashboard;
using Hangfire.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

public class HangfireDashboardAuthFilterTests
{
    /// <summary>Storage falso — o filtro sob teste nunca toca em storage, só existe pro construtor do
    /// <see cref="AspNetCoreDashboardContext"/> exigir uma instância (evita precisar de Hangfire.Current global).</summary>
    private class FakeJobStorage : JobStorage
    {
        public override IMonitoringApi GetMonitoringApi() => throw new NotSupportedException();
        public override IStorageConnection GetConnection() => throw new NotSupportedException();
    }

    private static DashboardContext BuildContext(string? email, string allowlistEnv)
    {
        Environment.SetEnvironmentVariable("HANGFIRE_ADMIN_EMAILS", allowlistEnv);

        var httpContext = new DefaultHttpContext { RequestServices = new ServiceCollection().BuildServiceProvider() };
        if (email != null)
        {
            var claims = new[] { new Claim(ClaimTypes.Email, email) };
            httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Test"));
        }

        return new AspNetCoreDashboardContext(new FakeJobStorage(), new DashboardOptions(), httpContext);
    }

    [Fact]
    public void NaoAutenticado_NaoAutoriza()
    {
        var ctx = BuildContext(email: null, allowlistEnv: "admin@pontes.app");
        Assert.False(new HangfireDashboardAuthFilter().Authorize(ctx));
    }

    [Fact]
    public void Autenticado_MasForaDaAllowlist_NaoAutoriza()
    {
        var ctx = BuildContext(email: "testador@beta.com", allowlistEnv: "admin@pontes.app");
        Assert.False(new HangfireDashboardAuthFilter().Authorize(ctx));
    }

    [Fact]
    public void Autenticado_NaAllowlist_Autoriza()
    {
        var ctx = BuildContext(email: "admin@pontes.app", allowlistEnv: "outro@x.com,admin@pontes.app");
        Assert.True(new HangfireDashboardAuthFilter().Authorize(ctx));
    }

    [Fact]
    public void Autenticado_ComparacaoDeEmailIgnoraMaiusculas()
    {
        var ctx = BuildContext(email: "Admin@Pontes.App", allowlistEnv: "admin@pontes.app");
        Assert.True(new HangfireDashboardAuthFilter().Authorize(ctx));
    }

    [Fact]
    public void AllowlistVazia_NaoAutorizaNinguem_FailClosed()
    {
        var ctx = BuildContext(email: "qualquer@x.com", allowlistEnv: "");
        Assert.False(new HangfireDashboardAuthFilter().Authorize(ctx));
    }
}

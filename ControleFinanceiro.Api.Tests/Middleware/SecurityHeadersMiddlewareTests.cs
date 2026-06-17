using ControleFinanceiro.Api.Infrastructure.Middleware;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Middleware;

public class SecurityHeadersMiddlewareTests
{
    private static async Task<HttpContext> Invoke(string path, bool https = false)
    {
        var ctx = new DefaultHttpContext();
        ctx.Request.Path = path;
        if (https) { ctx.Request.Scheme = "https"; ctx.Request.Host = new HostString("app"); }

        var mw = new SecurityHeadersMiddleware(_ => Task.CompletedTask);
        await mw.InvokeAsync(ctx);
        return ctx;
    }

    [Fact]
    public async Task Aplica_headers_base_em_toda_resposta()
    {
        var ctx = await Invoke("/api/v1/transacoes");

        Assert.Equal("nosniff", ctx.Response.Headers["X-Content-Type-Options"]);
        Assert.Equal("DENY", ctx.Response.Headers["X-Frame-Options"]);
        Assert.Equal("no-referrer", ctx.Response.Headers["Referrer-Policy"]);
        Assert.False(string.IsNullOrEmpty(ctx.Response.Headers["Permissions-Policy"]));
    }

    [Fact]
    public async Task ApiJson_recebe_CSP_estrita()
    {
        var ctx = await Invoke("/api/v1/transacoes");
        Assert.Equal("default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
            ctx.Response.Headers["Content-Security-Policy"]);
    }

    [Theory]
    [InlineData("/swagger/index.html")]
    [InlineData("/hangfire")]
    public async Task PaginasComInline_recebem_CSP_relaxada(string path)
    {
        var ctx = await Invoke(path);
        var csp = ctx.Response.Headers["Content-Security-Policy"].ToString();
        Assert.Contains("'unsafe-inline'", csp);
        Assert.Contains("frame-ancestors 'none'", csp); // ainda sem framing externo
    }

    [Fact]
    public async Task HSTS_apenas_sob_https()
    {
        var http = await Invoke("/api/v1/x", https: false);
        Assert.False(http.Response.Headers.ContainsKey("Strict-Transport-Security"));

        var https = await Invoke("/api/v1/x", https: true);
        Assert.Contains("max-age=", https.Response.Headers["Strict-Transport-Security"].ToString());
    }
}

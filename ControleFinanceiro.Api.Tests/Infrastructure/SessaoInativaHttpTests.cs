using System.Net;
using System.Net.Http.Json;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using ControleFinanceiro.Api.Services;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Sair por inatividade pela API: o <c>/auth/me</c> diz à tela o limite (só sem "Manter-me conectado") e o refresh
/// de uma sessão parada responde 401 com o code <c>SESSAO_INATIVA</c>, que o front usa pro aviso na tela de entrar.
/// </summary>
[Collection("PasswordHasherEnv")]
public class SessaoInativaHttpTests : IClassFixture<CustomWebApplicationFactory>
{
    private const string Senha = "SenhaForte!2026";
    private readonly CustomWebApplicationFactory _factory;

    public SessaoInativaHttpTests(CustomWebApplicationFactory factory) => _factory = factory;

    private Usuario SeedUsuario(string email)
    {
        using var scope = _factory.CreateScopeComBanco();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var u = new Usuario { Id = Guid.NewGuid(), Email = email, Nome = "User Inativo", PasswordHash = PasswordHasher.HashPassword(Senha), Status = StatusUsuario.Ativo, CriadoEm = DateTime.UtcNow };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u;
    }

    // Client com cookie jar (um navegador) já logado; devolve o CSRF pra escrita.
    private async Task<(HttpClient Client, string Csrf)> EntrarAsync(string email, bool manterConectado)
    {
        var client = _factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = Senha, manterConectado });
        resp.EnsureSuccessStatusCode();
        var csrf = resp.Headers.GetValues("Set-Cookie").Where(c => c.StartsWith("X-CSRF-Token=", StringComparison.Ordinal))
            .Select(c => Uri.UnescapeDataString(c["X-CSRF-Token=".Length..].Split(';')[0])).Last(v => v != "");
        return (client, csrf);
    }

    private async Task<int?> LimiteNoMeAsync(HttpClient client)
    {
        var me = await client.GetFromJsonAsync<Dictionary<string, object?>>("/api/v1/auth/me");
        var valor = me!["sairPorInatividadeMinutos"];
        return valor is null ? null : int.Parse(valor.ToString()!);
    }

    [Fact]
    public async Task Me_semManterConectado_mandaOLimite_comManterConectado_mandaNull()
    {
        SeedUsuario("me-padrao@test.com");
        SeedUsuario("me-lembrado@test.com");
        var (padrao, _) = await EntrarAsync("me-padrao@test.com", manterConectado: false);
        var (lembrado, _) = await EntrarAsync("me-lembrado@test.com", manterConectado: true);

        Assert.Equal(SessaoInativa.Minutos, await LimiteNoMeAsync(padrao));
        Assert.Null(await LimiteNoMeAsync(lembrado));
    }

    [Fact]
    public async Task Refresh_deSessaoParada_responde401ComCodeSessaoInativa()
    {
        var u = SeedUsuario("refresh-parado@test.com");
        var (client, csrf) = await EntrarAsync("refresh-parado@test.com", manterConectado: false);
        using (var scope = _factory.CreateScopeComBanco())
        {
            var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var rt = ctx.RefreshTokens.Single(r => r.UsuarioId == u.Id && !r.Revogado);
            rt.CriadoEm = DateTime.UtcNow.AddHours(-2);
            ctx.SaveChanges();
        }

        var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        req.Headers.Add("X-CSRF-Token", csrf);
        var resp = await client.SendAsync(req);

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
        Assert.Equal("SESSAO_INATIVA", (await resp.Content.ReadFromJsonAsync<ErrorResponseDto>())!.Code);
    }
}

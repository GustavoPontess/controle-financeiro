using System.Net;
using System.Net.Http.Json;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Testes HTTP de integração da API (pipeline real: versionamento, roteamento, CSRF, JWT cookie,
/// middlewares, GlobalExceptionHandler). Complementa os testes unitários de service — cobre a camada
/// que só era validada à mão no pentest. Banco InMemory via CustomWebApplicationFactory.
/// </summary>
public class AuthHttpTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public AuthHttpTests(CustomWebApplicationFactory factory) => _factory = factory;

    private Usuario SeedUsuario(string email, string senha, StatusUsuario status = StatusUsuario.Ativo)
    {
        using var scope = _factory.CreateScopeComBanco();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var u = new Usuario
        {
            Id = Guid.NewGuid(),
            Email = email.ToLower(),
            Nome = "User HTTP",
            PasswordHash = PasswordHasher.HashPassword(senha),
            Status = status,
            CriadoEm = DateTime.UtcNow,
        };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u;
    }

    [Fact]
    public async Task Me_semSessao_retorna401()
    {
        var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Login_credenciaisInvalidas_retorna401()
    {
        var client = _factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/v1/auth/login",
            new { email = "naoexiste@test.com", password = "SenhaErrada!2026" });
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task EndpointMutante_semCsrf_retorna403()
    {
        // /auth/logout é POST e NÃO é público → o CsrfValidationMiddleware exige o header. Sem ele: 403.
        var client = _factory.CreateClient();
        var resp = await client.PostAsync("/api/v1/auth/logout", content: null);
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task Login_valido_setaCookies_e_Me_retornaOUsuario()
    {
        SeedUsuario("http-ok@test.com", "SenhaForte!2026");
        var client = _factory.CreateClient(); // HandleCookies=true por padrão → guarda os cookies do login

        var login = await client.PostAsJsonAsync("/api/v1/auth/login",
            new { email = "http-ok@test.com", password = "SenhaForte!2026" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.Contains(login.Headers, h => h.Key == "Set-Cookie"); // jwt/refresh/csrf setados

        // Com o cookie jwt guardado, /auth/me autentica e devolve o usuário.
        var me = await client.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        var dto = await me.Content.ReadFromJsonAsync<MeDto>();
        Assert.Equal("http-ok@test.com", dto!.Email);
    }

    private sealed class MeDto
    {
        public string Email { get; set; } = "";
        public string Nome { get; set; } = "";
    }
}

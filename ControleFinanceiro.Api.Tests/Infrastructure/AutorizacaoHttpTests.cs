using System.Net;
using System.Net.Http.Json;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Testes HTTP de integração (pipeline real) da autorização do fix P0: FallbackPolicy
/// (RequireAuthenticatedUser) no Program.cs + BancosController virando [Authorize] com
/// POST/PUT/DELETE restritos à policy de admin. Complementa AuthHttpTests. Banco InMemory via
/// CustomWebApplicationFactory.
/// </summary>
// Mesma razão do [Collection] em AuthHttpTests: login faz seed+verify de senha lendo a env var
// global PASSWORD_PEPPER — sem serializar com PasswordHasherTests (que liga/desliga o pepper),
// um login pode cair na janela errada e dar 401 intermitente.
[Collection("PasswordHasherEnv")]
public class AutorizacaoHttpTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public AutorizacaoHttpTests(CustomWebApplicationFactory factory) => _factory = factory;

    private Usuario SeedUsuario(string email, string senha, bool isAdmin = false)
    {
        using var scope = _factory.CreateScopeComBanco();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var u = new Usuario
        {
            Id = Guid.NewGuid(),
            Email = email.ToLower(),
            Nome = "User Autorizacao HTTP",
            PasswordHash = PasswordHasher.HashPassword(senha),
            Status = StatusUsuario.Ativo,
            IsAdmin = isAdmin,
            CriadoEm = DateTime.UtcNow,
        };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u;
    }

    // Loga um NOVO client (cookie container próprio) e devolve (client, csrf). Mesmo padrão de
    // AuthHttpTests.LoginClientAsync.
    private async Task<(HttpClient Client, string Csrf)> LoginClientAsync(string email, string senha)
    {
        var client = _factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = senha });
        resp.EnsureSuccessStatusCode();
        return (client, ExtrairCsrf(resp));
    }

    // Mesmo helper de AuthHttpTests: pega o ÚLTIMO Set-Cookie de X-CSRF-Token (o login frio emite
    // um Set-Cookie de limpeza antes do de login).
    private static string ExtrairCsrf(HttpResponseMessage resp)
    {
        string valor = "";
        foreach (var sc in resp.Headers.GetValues("Set-Cookie"))
        {
            if (sc.StartsWith("X-CSRF-Token=", StringComparison.Ordinal))
                valor = Uri.UnescapeDataString(sc.Substring("X-CSRF-Token=".Length).Split(';')[0]);
        }
        return valor;
    }

    [Fact]
    public async Task Health_Anonimo_Retorna200()
    {
        // /health é AllowAnonymous de propósito (probe de liveness) — isento da FallbackPolicy.
        var client = _factory.CreateClient();
        var resp = await client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task GetBancos_Anonimo_Retorna401()
    {
        // BancosController virou [Authorize] (antes GET era público). GET é método seguro — não
        // passa pelo CsrfValidationMiddleware — então o 401 vem direto da FallbackPolicy.
        var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/v1/bancos");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task PostBancos_Anonimo_SemCsrf_Retorna403_CsrfRodaAntesDaAutenticacao()
    {
        // Achado ao escrever a suíte: o CsrfValidationMiddleware roda ANTES de
        // UseAuthentication/UseAuthorization no Program.cs. Um POST anônimo sem o par CSRF nunca
        // chega no gate de autenticação — cai primeiro no 403 do CSRF ("CSRF token missing").
        // Documentado aqui para não confundir com o 403 de AUTORIZAÇÃO (usuário logado sem a
        // policy de admin) do teste PostBancos_UsuarioComum_Retorna403 abaixo — mesmo código HTTP,
        // motivos diferentes.
        var client = _factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/v1/bancos", new { nome = "Banco X", tipo = 0 });
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task PostBancos_Anonimo_ComCsrfValido_Retorna401()
    {
        // Contorna o gate de CSRF com um par header/cookie que só precisa bater entre si (double
        // -submit não valida sessão — CsrfTokenService.ValidateToken só compara os dois lados).
        // Sem cookie jwt, a request agora chega no gate de autenticação de verdade: a
        // FallbackPolicy (RequireAuthenticatedUser) barra com 401 — prova que é a policy global
        // (não a ausência de CSRF) que protege o endpoint contra anônimo.
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        const string csrf = "csrf-fixo-de-teste";
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/bancos")
        {
            Content = JsonContent.Create(new { nome = "Banco X", tipo = 0 }),
        };
        req.Headers.Add("Cookie", $"X-CSRF-Token={csrf}");
        req.Headers.Add("X-CSRF-Token", csrf);

        var resp = await client.SendAsync(req);

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task PostBancos_UsuarioComum_Retorna403()
    {
        // Cross-check da policy de admin: usuário AUTENTICADO mas sem IsAdmin não pode escrever
        // no catálogo global de bancos.
        SeedUsuario("comum-bancos@test.com", "SenhaForte!2026");
        var (client, csrf) = await LoginClientAsync("comum-bancos@test.com", "SenhaForte!2026");

        var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/bancos")
        {
            Content = JsonContent.Create(new { nome = "Banco X", tipo = 0 }),
        };
        req.Headers.Add("X-CSRF-Token", csrf);

        var resp = await client.SendAsync(req);

        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task GetBancos_UsuarioLogado_Retorna200()
    {
        // Leitura do catálogo global continua liberada pra qualquer usuário autenticado (não
        // precisa ser admin) — só a escrita é restrita.
        SeedUsuario("logado-bancos@test.com", "SenhaForte!2026");
        var (client, _) = await LoginClientAsync("logado-bancos@test.com", "SenhaForte!2026");

        var resp = await client.GetAsync("/api/v1/bancos");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task Login_CredencialErrada_ContinuaAcessivelAnonimo_Retorna401DoController()
    {
        // A FallbackPolicy global não pode bloquear /auth/login (AllowAnonymous + isento de CSRF).
        // O 401 aqui tem que vir do AuthController/AuthService (credencial errada), não de um
        // bloqueio de autorização antes de chegar no controller — por isso confere o corpo JSON
        // do GlobalExceptionHandlerMiddleware, que um challenge puro de autorização não teria.
        var client = _factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/v1/auth/login",
            new { email = "nao-existe-autorizacao-http@test.com", password = "SenhaErrada!2026" });

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
        // O corpo vem serializado pelo GlobalExceptionHandlerMiddleware (JSON, acentos
        // escapados \uXXXX) — confere o code e o trecho ASCII da mensagem de domínio, não um
        // corpo vazio de challenge de autorização.
        var body = await resp.Content.ReadAsStringAsync();
        Assert.Contains("\"code\":\"UNAUTHORIZED\"", body);
        Assert.Contains("Email ou senha", body);
    }
}

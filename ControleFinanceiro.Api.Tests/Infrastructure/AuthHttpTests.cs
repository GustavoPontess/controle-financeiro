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

    private Usuario SeedUsuario(string email, string senha, StatusUsuario status = StatusUsuario.Ativo, bool mfaAtivo = false)
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
            MfaAtivo = mfaAtivo,
            CriadoEm = DateTime.UtcNow,
        };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u;
    }

    // Loga um NOVO client (cookie container próprio = sessão independente) e devolve (client, csrf).
    private async Task<(HttpClient Client, string Csrf)> LoginClientAsync(string email, string senha)
    {
        var client = _factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = senha });
        resp.EnsureSuccessStatusCode();
        return (client, ExtrairCsrf(resp));
    }

    // O X-CSRF-Token chega URL-encodado no Set-Cookie; o header do double-submit tem que bater com o
    // valor decodificado (o servidor decoda o cookie). Igual ao que o front faz (decodeURIComponent).
    private static string ExtrairCsrf(HttpResponseMessage resp)
    {
        foreach (var sc in resp.Headers.GetValues("Set-Cookie"))
        {
            if (sc.StartsWith("X-CSRF-Token=", StringComparison.Ordinal))
                return Uri.UnescapeDataString(sc.Substring("X-CSRF-Token=".Length).Split(';')[0]);
        }
        return "";
    }

    private static HttpRequestMessage Post(string url, string csrf, Guid? activeAccount = null)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Add("X-CSRF-Token", csrf);
        if (activeAccount.HasValue)
            req.Headers.Add("X-Active-Account", activeAccount.Value.ToString());
        return req;
    }

    [Fact]
    public async Task Login_comMfaAtivo_naoEmiteSessao_pedeSegundoFator()
    {
        SeedUsuario("mfa-http@test.com", "SenhaForte!2026", mfaAtivo: true);
        var client = _factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/v1/auth/login",
            new { email = "mfa-http@test.com", password = "SenhaForte!2026" });

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<MfaLoginDto>();
        Assert.True(body!.MfaRequerido);                 // pede o 2º fator
        Assert.False(resp.Headers.Contains("Set-Cookie")); // NÃO emitiu sessão
    }

    [Fact]
    public async Task RevogarSessao_deOutroUsuario_retorna404_antiIDOR()
    {
        SeedUsuario("idor-a@test.com", "SenhaForte!2026");
        SeedUsuario("idor-b@test.com", "SenhaForte!2026");
        var (clientA, _) = await LoginClientAsync("idor-a@test.com", "SenhaForte!2026");
        var (clientB, csrfB) = await LoginClientAsync("idor-b@test.com", "SenhaForte!2026");

        var sessoesA = await clientA.GetFromJsonAsync<List<SessaoLite>>("/api/v1/auth/sessions");
        var sessaoDeA = sessoesA!.Single().Id;

        // B tenta revogar a sessão de A → 404 (RevogarSessaoAsync filtra por UsuarioId).
        var resp = await clientB.SendAsync(Post($"/api/v1/auth/sessions/{sessaoDeA}/revogar", csrfB));
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);

        // A continua logada (nada foi revogado).
        Assert.Equal(HttpStatusCode.OK, (await clientA.GetAsync("/api/v1/auth/me")).StatusCode);
    }

    [Fact]
    public async Task RevogarSessao_derrubaOOutroDispositivo_naHora()
    {
        SeedUsuario("revoke-http@test.com", "SenhaForte!2026");
        var (clientA, _) = await LoginClientAsync("revoke-http@test.com", "SenhaForte!2026");
        var (clientB, csrfB) = await LoginClientAsync("revoke-http@test.com", "SenhaForte!2026");

        Assert.Equal(HttpStatusCode.OK, (await clientA.GetAsync("/api/v1/auth/me")).StatusCode);

        // Da B, acha a sessão A (a não-atual sob a ótica de B) e revoga.
        var sessoes = await clientB.GetFromJsonAsync<List<SessaoLite>>("/api/v1/auth/sessions");
        var sessaoA = sessoes!.First(s => !s.Atual).Id;
        var revoke = await clientB.SendAsync(Post($"/api/v1/auth/sessions/{sessaoA}/revogar", csrfB));
        Assert.Equal(HttpStatusCode.NoContent, revoke.StatusCode);

        // A cai NA HORA (jwt ainda dentro dos 15min) — OnTokenValidated rejeita a sessão morta.
        Assert.Equal(HttpStatusCode.Unauthorized, (await clientA.GetAsync("/api/v1/auth/me")).StatusCode);
        // B segue viva (revogação por-sessão, não global).
        Assert.Equal(HttpStatusCode.OK, (await clientB.GetAsync("/api/v1/auth/me")).StatusCode);
    }

    [Fact]
    public async Task RequestMutante_deAbaDefasada_retorna409()
    {
        SeedUsuario("guard-http@test.com", "SenhaForte!2026");
        var (client, csrf) = await LoginClientAsync("guard-http@test.com", "SenhaForte!2026");

        // Aba "defasada": manda X-Active-Account de OUTRA conta numa escrita fora de /auth → 409.
        var resp = await client.SendAsync(Post("/api/v1/transacoes", csrf, activeAccount: Guid.NewGuid()));
        Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
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
    public async Task Importacao_preview_rotaVersionada_existe_e_exigeAutenticacao()
    {
        // Regressão do bug em que [ApiController]/[Route]/[Authorize] estavam na classe do form
        // (PreviewUploadForm) e NÃO no ImportacaoController: a rota resolvia em "/preview" e o
        // endpoint ficava sem [Authorize]. Agora os atributos estão no controller → a rota é
        // "/api/v1/importacao/preview" (front bate com isso) e o [Authorize] gateia.
        SeedUsuario("import-http@test.com", "SenhaForte!2026");
        var (client, csrf) = await LoginClientAsync("import-http@test.com", "SenhaForte!2026");

        // POST autenticado (CSRF ok) sem multipart → chega no controller e cai em 400/415
        // (model/content-type). Não pode ser 404 (rota certa) nem 401 (logado passou).
        var resp = await client.SendAsync(Post("/api/v1/importacao/preview", csrf));
        Assert.NotEqual(HttpStatusCode.NotFound, resp.StatusCode);
        Assert.NotEqual(HttpStatusCode.Unauthorized, resp.StatusCode);
        Assert.True(
            resp.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.UnsupportedMediaType,
            $"esperado 400/415 (chegou no controller), veio {(int)resp.StatusCode}");
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

    private sealed class MfaLoginDto
    {
        public bool MfaRequerido { get; set; }
    }

    private sealed class SessaoLite
    {
        public Guid Id { get; set; }
        public bool Atual { get; set; }
    }
}

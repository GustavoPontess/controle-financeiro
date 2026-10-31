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
/// Cookie tossing (ROADMAP P1, 2026-10-31): em HTTPS todo cookie do app tem o prefixo <c>__Host-</c> (Secure, Path=/,
/// sem Domain) e o cookie sem prefixo — o que outro site do mesmo domínio conseguiria plantar com
/// Domain=pontesdev.com.br — nunca é lido: nem sessão (jwt), nem CSRF, nem refresh + conta ativa.
/// Os clients aqui falam com https://localhost (Request.IsHttps = true, como atrás do proxy de produção) e sem
/// cookie jar: cada request leva exatamente os cookies que o teste monta.
/// </summary>
// Login lê PASSWORD_PEPPER (env global): mesma coleção do AuthHttpTests pra não cruzar com o PasswordHasherTests.
[Collection("PasswordHasherEnv")]
public class CookiesHostPrefixHttpTests : IClassFixture<CustomWebApplicationFactory>
{
    private const string Senha = "SenhaForte!2026";
    private readonly CustomWebApplicationFactory _factory;

    public CookiesHostPrefixHttpTests(CustomWebApplicationFactory factory) => _factory = factory;

    private Usuario SeedUsuario(string email)
    {
        using var scope = _factory.CreateScopeComBanco();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var u = new Usuario
        {
            Id = Guid.NewGuid(),
            Email = email,
            Nome = "User Cookies",
            PasswordHash = PasswordHasher.HashPassword(Senha),
            Status = StatusUsuario.Ativo,
            CriadoEm = DateTime.UtcNow,
        };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u;
    }

    private HttpClient Client(bool https = true) => _factory.CreateClient(new WebApplicationFactoryClientOptions
    {
        BaseAddress = new Uri(https ? "https://localhost" : "http://localhost"),
        HandleCookies = false,
    });

    private async Task<HttpResponseMessage> LoginAsync(string email, bool https = true, string? cookies = null)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/login")
        {
            Content = JsonContent.Create(new { email, password = Senha, manterConectado = true }),
        };
        if (cookies != null) req.Headers.Add("Cookie", cookies);
        var resp = await Client(https).SendAsync(req);
        resp.EnsureSuccessStatusCode();
        return resp;
    }

    // Set-Cookie que GRAVAM (com valor); os de limpeza (valor vazio, expires em 1970) ficam de fora.
    private static List<(string Nome, string Valor, string Atributos)> CookiesGravados(HttpResponseMessage resp) =>
        CookiesDaResposta(resp).Where(c => c.Valor != "").ToList();

    private static List<(string Nome, string Valor, string Atributos)> CookiesDaResposta(HttpResponseMessage resp)
    {
        var lista = new List<(string, string, string)>();
        if (!resp.Headers.TryGetValues("Set-Cookie", out var setCookies)) return lista;
        foreach (var sc in setCookies)
        {
            var nome = sc[..sc.IndexOf('=')];
            var resto = sc[(nome.Length + 1)..];
            var fim = resto.IndexOf(';');
            lista.Add((nome, Uri.UnescapeDataString(fim < 0 ? resto : resto[..fim]), (fim < 0 ? "" : resto[fim..]).ToLowerInvariant()));
        }
        return lista;
    }

    private static string Valor(HttpResponseMessage resp, string nome) => CookiesGravados(resp).Last(c => c.Nome == nome).Valor;

    [Fact]
    public async Task Login_emHttps_todoCookieGravadoTemPrefixoHost_SecurePathRaizSemDomain()
    {
        SeedUsuario("host-prefixo@test.com");
        var resp = await LoginAsync("host-prefixo@test.com");
        var gravados = CookiesGravados(resp);

        // Sessão, CSRF, conta ativa, refresh da conta e o id do navegador (manter conectado) saem todos com __Host-.
        foreach (var esperado in new[] { "__Host-jwt", "__Host-X-CSRF-Token", "__Host-active_acct", "__Host-rd" })
            Assert.Contains(gravados, c => c.Nome == esperado);
        Assert.Contains(gravados, c => c.Nome.StartsWith("__Host-rt_", StringComparison.Ordinal));

        Assert.All(gravados, c =>
        {
            Assert.StartsWith("__Host-", c.Nome);
            Assert.Contains("; secure", c.Atributos);
            Assert.Contains("; path=/;", c.Atributos + ";");
            Assert.DoesNotContain("domain=", c.Atributos);
        });
    }

    [Fact]
    public async Task Login_emHttp_devNoLocalhost_mantemNomesSemPrefixo()
    {
        // O prefixo exige origem segura: no dev (http://localhost) o navegador recusaria. Lá fica tudo como antes:
        // nome puro, jwt e CSRF em "/", os de auth só no Path do auth.
        SeedUsuario("http-dev@test.com");
        var gravados = CookiesGravados(await LoginAsync("http-dev@test.com", https: false));

        Assert.Contains(gravados, c => c.Nome == "jwt" && c.Atributos.Contains("path=/;"));
        Assert.Contains(gravados, c => c.Nome == "X-CSRF-Token" && c.Atributos.Contains("path=/;"));
        Assert.Contains(gravados, c => c.Nome == "active_acct" && c.Atributos.Contains("path=/api/v1/auth"));
        Assert.Contains(gravados, c => c.Nome.StartsWith("rt_", StringComparison.Ordinal) && c.Atributos.Contains("path=/api/v1/auth"));
        Assert.DoesNotContain(gravados, c => c.Nome.StartsWith("__Host-", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Https_jwtSemPrefixo_eIgnorado_soOComPrefixoAutentica()
    {
        SeedUsuario("jwt-plantado@test.com");
        var jwt = Valor(await LoginAsync("jwt-plantado@test.com"), "__Host-jwt");

        var plantado = new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me");
        plantado.Headers.Add("Cookie", $"jwt={jwt}");
        Assert.Equal(HttpStatusCode.Unauthorized, (await Client().SendAsync(plantado)).StatusCode);

        var legitimo = new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me");
        legitimo.Headers.Add("Cookie", $"__Host-jwt={jwt}");
        Assert.Equal(HttpStatusCode.OK, (await Client().SendAsync(legitimo)).StatusCode);
    }

    [Fact]
    public async Task Https_csrfSemPrefixo_naoVale_noDoubleSubmit()
    {
        SeedUsuario("csrf-plantado@test.com");
        var login = await LoginAsync("csrf-plantado@test.com");
        var jwt = Valor(login, "__Host-jwt");
        const string csrf = "csrf-escolhido-pelo-atacante";

        var plantado = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/logout");
        plantado.Headers.Add("Cookie", $"__Host-jwt={jwt}; X-CSRF-Token={csrf}");
        plantado.Headers.Add("X-CSRF-Token", csrf);
        Assert.Equal(HttpStatusCode.Forbidden, (await Client().SendAsync(plantado)).StatusCode);

        var real = Valor(login, "__Host-X-CSRF-Token");
        var legitimo = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/logout");
        legitimo.Headers.Add("Cookie", $"__Host-jwt={jwt}; __Host-X-CSRF-Token={real}");
        legitimo.Headers.Add("X-CSRF-Token", real);
        Assert.NotEqual(HttpStatusCode.Forbidden, (await Client().SendAsync(legitimo)).StatusCode);
    }

    [Fact]
    public async Task Https_refreshComContaAtivaERefreshDoAtacanteSemPrefixo_naoLogaNaContaDele()
    {
        // O ataque que sobrava só com o jwt protegido: plantar active_acct + rt_<slot> da conta do atacante
        // (antes no Path do auth, sem prefixo possível) e esperar o front da vítima chamar /refresh.
        var atacante = SeedUsuario("atacante-refresh@test.com");
        var loginAtacante = await LoginAsync("atacante-refresh@test.com");
        var (slot, refresh) = CookiesGravados(loginAtacante).Select(c => (c.Nome, c.Valor))
            .Last(c => c.Nome.StartsWith("__Host-rt_", StringComparison.Ordinal));
        var slotSemPrefixo = slot["__Host-".Length..];

        // Navegador da vítima: par CSRF dela (válido, __Host-) + os dois cookies plantados sem prefixo.
        SeedUsuario("vitima-refresh@test.com");
        var csrfVitima = Valor(await LoginAsync("vitima-refresh@test.com"), "__Host-X-CSRF-Token");
        var plantado = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        plantado.Headers.Add("Cookie", $"active_acct={atacante.Id}; {slotSemPrefixo}={refresh}; __Host-X-CSRF-Token={csrfVitima}");
        plantado.Headers.Add("X-CSRF-Token", csrfVitima);
        var resp = await Client().SendAsync(plantado);
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
        Assert.DoesNotContain(CookiesGravados(resp), c => c.Nome == "__Host-jwt");

        // Controle: os mesmos valores com o prefixo (só este host grava) renovam normalmente.
        var legitimo = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        legitimo.Headers.Add("Cookie", $"__Host-active_acct={atacante.Id}; {slot}={refresh}; __Host-X-CSRF-Token={csrfVitima}");
        legitimo.Headers.Add("X-CSRF-Token", csrfVitima);
        Assert.Equal(HttpStatusCode.OK, (await Client().SendAsync(legitimo)).StatusCode);
    }

    [Fact]
    public async Task Https_login_apagaCookiesSemPrefixoQueSobraramDoModeloAntigo()
    {
        // Quem estava logado antes do deploy ainda tem jwt/CSRF em "/" e o resto no Path do auth.
        SeedUsuario("transicao@test.com");
        var resp = await LoginAsync("transicao@test.com", cookies: "jwt=velho; X-CSRF-Token=velho; active_acct=velho; rt_0123456789abcdef=velho; td=velho");
        var limpezas = CookiesDaResposta(resp).Where(c => c.Valor == "").ToList();

        Assert.Contains(limpezas, c => c.Nome == "jwt" && c.Atributos.Contains("path=/;") && c.Atributos.Contains("expires=thu, 01 jan 1970"));
        Assert.Contains(limpezas, c => c.Nome == "X-CSRF-Token" && c.Atributos.Contains("path=/;"));
        Assert.Contains(limpezas, c => c.Nome == "rt_0123456789abcdef" && c.Atributos.Contains("path=/api/v1/auth"));
        Assert.Contains(limpezas, c => c.Nome == "active_acct" && c.Atributos.Contains("path=/api/v1/auth"));
        Assert.Contains(limpezas, c => c.Nome == "td" && c.Atributos.Contains("path=/api/v1/auth"));
    }

    // Trava: cookie com nome escrito na mão (ou gravado sem passar por CookiesDoApp) não ganha o __Host- em produção.
    private static readonly System.Text.RegularExpressions.Regex CookieNaMao =
        new(@"Cookies\s*(\.(Append|Delete|TryGetValue|ContainsKey)\(\s*""|\[\s*"")");

    [Fact]
    public void CodigoDaApi_soGravaELeCookiePeloCookiesDoApp()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "controle-financeiro.sln")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        var api = Path.Combine(dir!.FullName, "ControleFinanceiro.Api");
        var sep = Path.DirectorySeparatorChar;
        var linhas = Directory.EnumerateFiles(api, "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Contains($"{sep}bin{sep}") && !f.Contains($"{sep}obj{sep}"))
            .SelectMany(f => File.ReadLines(f).Select((linha, i) => (Arquivo: Path.GetRelativePath(api, f), Linha: i + 1, Texto: linha.Trim())))
            .Where(l => !l.Texto.StartsWith("//"))
            .ToList();

        var achados = linhas
            .Where(l => CookieNaMao.IsMatch(l.Texto) || (l.Texto.Contains("Cookies.Append(") && !l.Texto.Contains("NomeCookie(nome)")))
            .Select(l => $"{l.Arquivo}:{l.Linha}: {l.Texto}")
            .ToList();

        Assert.True(achados.Count == 0,
            "Cookie só pelo CookiesDoApp (AuthController.GravarCookie/LerCookie/DeleteCookie), senão fica sem __Host- em produção:\n"
            + string.Join("\n", achados));
    }

    [Fact]
    public void PoliticaDePrivacidade_listaTodoCookieDoApp()
    {
        // Transparência (LGPD + guia de cookies da ANPD): cookie novo no CookiesDoApp entra na /privacidade (telas/Legal.tsx).
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "controle-financeiro.sln")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        var politica = File.ReadAllText(Path.Combine(dir!.FullName, "controle-financeiro.web", "src", "telas", "Legal.tsx"));

        var cookies = typeof(ControleFinanceiro.Api.Infrastructure.Security.CookiesDoApp)
            .GetFields(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static)
            .Where(f => f.IsLiteral && f.Name != nameof(ControleFinanceiro.Api.Infrastructure.Security.CookiesDoApp.PrefixoHost))
            .Select(f => (string)f.GetRawConstantValue()!)
            .Append(AparelhoConhecido.Cookie);

        Assert.All(cookies, c => Assert.Contains("__Host-" + c, politica));
    }

    [Fact]
    public async Task Http_refresh_naoApagaNada_doDevQueContinuaComoAntes()
    {
        // A limpeza da transição é só de HTTPS: no dev os cookies são os mesmos de sempre, nada a apagar.
        var usuario = SeedUsuario("http-transicao@test.com");
        var login = await LoginAsync("http-transicao@test.com", https: false);
        var (slot, refresh) = CookiesGravados(login).Select(c => (c.Nome, c.Valor)).Last(c => c.Nome.StartsWith("rt_", StringComparison.Ordinal));
        var csrf = Valor(login, "X-CSRF-Token");

        var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        req.Headers.Add("Cookie", $"active_acct={usuario.Id}; {slot}={refresh}; X-CSRF-Token={csrf}");
        req.Headers.Add("X-CSRF-Token", csrf);
        var resp = await Client(https: false).SendAsync(req);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        Assert.DoesNotContain(CookiesDaResposta(resp), c => c.Valor == "");
    }
}

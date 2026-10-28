using System.Net;
using System.Net.Http.Json;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Testes HTTP de integração da API (pipeline real: versionamento, roteamento, CSRF, JWT cookie,
/// middlewares, GlobalExceptionHandler). Complementa os testes unitários de service — cobre a camada
/// que só era validada à mão no pentest. Banco InMemory via CustomWebApplicationFactory.
/// </summary>
// Cada login faz seed (PasswordHasher.HashPassword) + verify (VerifyPassword), e ambos leem a env
// var global PASSWORD_PEPPER. Sem esta coleção, a classe rodava em paralelo com PasswordHasherTests
// (que liga/desliga PASSWORD_PEPPER): um seed caía na janela com pepper ligado e o verify seguinte,
// já sem pepper, recusava a senha certa → 401 intermitente em LoginClientAsync sob carga da suíte
// completa. [Collection] serializa com o togglador; IClassFixture continua valendo (fixture por
// classe é ortogonal à coleção).
[Collection("PasswordHasherEnv")]
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
    // Pega o ÚLTIMO Set-Cookie de X-CSRF-Token da resposta, não o primeiro: o login frio agora emite
    // um Set-Cookie de LIMPEZA (delete, valor vazio) antes do de login (RevogarSessoesAnterioresAsync
    // → ClearAllSessions() roda antes de SetLoggedInCookies) — duas ocorrências do mesmo cookie na
    // mesma resposta. Isso é inofensivo pra qualquer cookie jar de verdade (navegador ou
    // HttpClient/CookieContainer): processam os Set-Cookie em ordem e o último pro mesmo
    // nome+path "vence" no armazenamento. Pegar o primeiro aqui pegaria o cookie já apagado.
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

    private static HttpRequestMessage Post(string url, string csrf, Guid? activeAccount = null)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Add("X-CSRF-Token", csrf);
        if (activeAccount.HasValue)
            req.Headers.Add("X-Active-Account", activeAccount.Value.ToString());
        return req;
    }

    // Extrai os cookies rt_* (um por conta parqueada) do Set-Cookie de uma resposta de login —
    // usado pra simular, num client SEM cookie jar, alguém que "herdou" só o refresh cru de uma
    // conta parqueada por outra pessoa no mesmo navegador (sem jwt válido junto).
    private static Dictionary<string, string> ExtrairCookiesPorPrefixo(HttpResponseMessage resp, string prefixo)
    {
        var result = new Dictionary<string, string>();
        if (!resp.Headers.TryGetValues("Set-Cookie", out var cookies)) return result;
        foreach (var sc in cookies)
        {
            var nome = sc.Split('=')[0];
            if (nome.StartsWith(prefixo, StringComparison.Ordinal))
                result[nome] = sc.Substring(nome.Length + 1).Split(';')[0];
        }
        return result;
    }

    // Monta um client NOVO (sem cookie jar compartilhado) carregando só o cookie rt_<slot> cru de
    // uma conta + um par CSRF válido (double-submit não é atado à sessão — só compara os dois
    // lados), e tenta /auth/switch pra essa conta. Devolve o status: prova se o refresh daquele
    // slot ainda é aceito pelo servidor (ou já foi revogado).
    private async Task<HttpStatusCode> SwitchComRefreshCru(Guid accountId, string cookieNome, string cookieValor)
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        const string csrf = "csrf-fixo-de-teste";
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/switch")
        {
            Content = JsonContent.Create(new { accountId }),
        };
        req.Headers.Add("Cookie", $"{cookieNome}={cookieValor}; X-CSRF-Token={csrf}");
        req.Headers.Add("X-CSRF-Token", csrf);
        var resp = await client.SendAsync(req);
        return resp.StatusCode;
    }

    private const string UaNavegador = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TesteHttp/1.0";

    // POST /auth/refresh "cru" (client sem cookie jar) como um navegador faria: active_acct + o rt_<slot>
    // informado + par CSRF, de um dispositivo (User-Agent + IP) escolhido. O TestServer não tem IP de
    // conexão; o IP entra pelo X-Forwarded-For, que o ForwardedHeaders aceita de QUALQUER peer porque o
    // Program.cs limpa KnownProxies — exatamente o limite documentado em SEGURANCA_BEST_PRACTICES §9.
    private async Task<HttpResponseMessage> RefreshCru(Guid accountId, KeyValuePair<string, string> rt, string ip)
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        const string csrf = "csrf-fixo-de-teste";
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        req.Headers.Add("Cookie", $"active_acct={accountId}; {rt.Key}={rt.Value}; X-CSRF-Token={csrf}");
        req.Headers.Add("X-CSRF-Token", csrf);
        req.Headers.Add("X-Forwarded-For", ip);
        req.Headers.UserAgent.ParseAdd(UaNavegador);
        return await client.SendAsync(req);
    }

    [Fact]
    public async Task Refresh_reapresentadoEmCorrida_mesmoDispositivo_retorna401RefreshEmCorrida_eSessaoSegueViva()
    {
        // Duas abas restauradas depois do jwt vencer, cada uma com o seu single-flight: as duas mandam o
        // MESMO refresh. A que perde precisa de um 401 DISTINGUÍVEL (o front refaz a request com os
        // cookies da vencedora) — com o 401 genérico ela ia pro login e, relogando, derrubava a outra.
        var usuario = SeedUsuario("corrida-refresh@test.com", "SenhaForte!2026");
        var login = await _factory.CreateClient().PostAsJsonAsync("/api/v1/auth/login",
            new { email = "corrida-refresh@test.com", password = "SenhaForte!2026" });
        login.EnsureSuccessStatusCode();
        var rtLogin = ExtrairCookiesPorPrefixo(login, "rt_").Single();

        var vencedora = await RefreshCru(usuario.Id, rtLogin, "203.0.113.10");
        Assert.Equal(HttpStatusCode.OK, vencedora.StatusCode);
        var rtNovo = ExtrairCookiesPorPrefixo(vencedora, "rt_").Single();

        var perdedora = await RefreshCru(usuario.Id, rtLogin, "203.0.113.10");
        Assert.Equal(HttpStatusCode.Unauthorized, perdedora.StatusCode);
        var erro = await perdedora.Content.ReadFromJsonAsync<ErrorResponseDto>();
        Assert.Equal("REFRESH_EM_CORRIDA", erro!.Code);

        // Nada foi revogado: o refresh que a vencedora entregou segue renovando.
        Assert.Equal(HttpStatusCode.OK, (await RefreshCru(usuario.Id, rtNovo, "203.0.113.10")).StatusCode);
    }

    [Fact]
    public async Task Refresh_reapresentadoDeOutroIp_retorna401Generico_eDerrubaAFamilia()
    {
        // Fora da tolerância (aqui: outro IP, ainda dentro dos 30s) o comportamento estrito não mudou:
        // 401 genérico UNAUTHORIZED (o front manda pro login) e a família inteira revogada.
        var usuario = SeedUsuario("corrida-outroip@test.com", "SenhaForte!2026");
        var login = await _factory.CreateClient().PostAsJsonAsync("/api/v1/auth/login",
            new { email = "corrida-outroip@test.com", password = "SenhaForte!2026" });
        login.EnsureSuccessStatusCode();
        var rtLogin = ExtrairCookiesPorPrefixo(login, "rt_").Single();

        var legitimo = await RefreshCru(usuario.Id, rtLogin, "203.0.113.10");
        Assert.Equal(HttpStatusCode.OK, legitimo.StatusCode);
        var rtNovo = ExtrairCookiesPorPrefixo(legitimo, "rt_").Single();

        var replay = await RefreshCru(usuario.Id, rtLogin, "198.51.100.77");
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);
        var erro = await replay.Content.ReadFromJsonAsync<ErrorResponseDto>();
        Assert.Equal("UNAUTHORIZED", erro!.Code);

        Assert.Equal(HttpStatusCode.Unauthorized, (await RefreshCru(usuario.Id, rtNovo, "203.0.113.10")).StatusCode);
    }

    [Fact]
    public async Task Login_emEspera_responde429_comRetryAfter_igualComOuSemConta()
    {
        SeedUsuario("espera-http@test.com", "SenhaForte!2026");
        using (var scope = _factory.CreateScopeComBanco())
        {
            var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            foreach (var email in new[] { "espera-http@test.com", "espera-ninguem@test.com" })
                ctx.TentativasLogin.Add(new TentativaLogin
                {
                    Id = Guid.NewGuid(), ChaveEmail = TentativasLogin.ChaveDoEmail(email), Falhas = 7, UltimaFalhaEm = DateTime.UtcNow,
                });
            ctx.SaveChanges();
        }
        var client = _factory.CreateClient();

        var comConta = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = "espera-http@test.com", password = "SenhaForte!2026" });
        var semConta = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = "espera-ninguem@test.com", password = "SenhaForte!2026" });

        foreach (var resp in new[] { comConta, semConta })
        {
            Assert.Equal(HttpStatusCode.TooManyRequests, resp.StatusCode);
            Assert.True(resp.Headers.RetryAfter?.Delta?.TotalSeconds is > 0 and <= 4);
            Assert.Contains("MUITAS_TENTATIVAS", await resp.Content.ReadAsStringAsync());
        }
    }

    [Fact]
    public async Task Verificacao_semAsChaves_ficaDesligada()
    {
        var resp = await _factory.CreateClient().GetAsync("/api/v1/auth/verificacao");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        Assert.Contains("\"chaveDoSite\":null", await resp.Content.ReadAsStringAsync());
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
    public async Task LoginFrio_revogaContasParqueadasAnteriores_fechaVazamentoMultiConta()
    {
        // Regressão do vazamento multi-conta em navegador compartilhado: login "frio" (sem sessão
        // ativa) tinha que revogar as contas parqueadas de quem usou o dispositivo antes, senão o
        // próximo usuário conseguia acessá-las pelo switcher (cookie rt_ ainda válido).
        var usuarioA = SeedUsuario("multiconta-a@test.com", "SenhaForte!2026");
        var usuarioB = SeedUsuario("multiconta-b@test.com", "SenhaForte!2026");
        SeedUsuario("multiconta-c@test.com", "SenhaForte!2026");

        // Um único client = um navegador (cookie jar compartilhado entre as duas chamadas de login).
        var navegador = _factory.CreateClient();

        // 1) Login frio como A: parqueia rt_A.
        var loginA = await navegador.PostAsJsonAsync("/api/v1/auth/login",
            new { email = "multiconta-a@test.com", password = "SenhaForte!2026" });
        loginA.EnsureSuccessStatusCode();
        var rtA = ExtrairCookiesPorPrefixo(loginA, "rt_").Single();

        // 2) Adiciona B pelo endpoint DEDICADO /auth/add-account ([Authorize] + CSRF): parqueia B
        // SEM revogar A. Agora o jar tem rt_A + rt_B (duas contas) — a pré-condição do vazamento.
        var csrfA = ExtrairCsrf(loginA);
        var addB = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/add-account")
        {
            Content = JsonContent.Create(new { email = "multiconta-b@test.com", password = "SenhaForte!2026" }),
        };
        addB.Headers.Add("X-CSRF-Token", csrfA);
        var loginB = await navegador.SendAsync(addB);
        loginB.EnsureSuccessStatusCode();
        var rtB = ExtrairCookiesPorPrefixo(loginB, "rt_").Single();
        Assert.NotEqual(rtA.Key, rtB.Key);

        // 3) "Outra pessoa, mesmo navegador": monta uma request de login FRIO (sem jwt/active_acct)
        // carregando só os cookies rt_A e rt_B crus — User.Identity.IsAuthenticated é false, então
        // o servidor trata como login frio.
        var estranhoNoNavegador = _factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        var loginC = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/login")
        {
            Content = JsonContent.Create(new { email = "multiconta-c@test.com", password = "SenhaForte!2026" }),
        };
        loginC.Headers.Add("Cookie", $"{rtA.Key}={rtA.Value}; {rtB.Key}={rtB.Value}");
        var respC = await estranhoNoNavegador.SendAsync(loginC);
        Assert.Equal(HttpStatusCode.OK, respC.StatusCode); // login de C funciona normalmente

        // 4) Prova do fix: o login frio de C revogou as sessões de A e B no banco. Trocar pra
        // qualquer uma delas com o refresh antigo agora dá 401 (fechou o furo).
        Assert.Equal(HttpStatusCode.Unauthorized, await SwitchComRefreshCru(usuarioA.Id, rtA.Key, rtA.Value));
        Assert.Equal(HttpStatusCode.Unauthorized, await SwitchComRefreshCru(usuarioB.Id, rtB.Key, rtB.Value));
    }

    [Fact]
    public async Task LogoutAll_revogaTodasAsContasParqueadasNoNavegador()
    {
        var usuarioA = SeedUsuario("logoutall-a@test.com", "SenhaForte!2026");
        var usuarioB = SeedUsuario("logoutall-b@test.com", "SenhaForte!2026");

        var navegador = _factory.CreateClient();
        var loginA = await navegador.PostAsJsonAsync("/api/v1/auth/login",
            new { email = "logoutall-a@test.com", password = "SenhaForte!2026" });
        loginA.EnsureSuccessStatusCode();
        var rtA = ExtrairCookiesPorPrefixo(loginA, "rt_").Single();

        // Adiciona B via /auth/add-account (autenticado como A + CSRF) → jar fica com rt_A + rt_B.
        var addB = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/add-account")
        {
            Content = JsonContent.Create(new { email = "logoutall-b@test.com", password = "SenhaForte!2026" }),
        };
        addB.Headers.Add("X-CSRF-Token", ExtrairCsrf(loginA));
        var loginB = await navegador.SendAsync(addB);
        loginB.EnsureSuccessStatusCode();
        var rtB = ExtrairCookiesPorPrefixo(loginB, "rt_").Single();
        var csrfAtual = ExtrairCsrf(loginB); // csrf reemitido no add-account, ainda no jar do navegador

        // "Sair" (logout-all) no mesmo navegador — tem que matar as duas contas parqueadas.
        var logoutAll = await navegador.SendAsync(Post("/api/v1/auth/logout-all", csrfAtual));
        Assert.Equal(HttpStatusCode.NoContent, logoutAll.StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, await SwitchComRefreshCru(usuarioA.Id, rtA.Key, rtA.Value));
        Assert.Equal(HttpStatusCode.Unauthorized, await SwitchComRefreshCru(usuarioB.Id, rtB.Key, rtB.Value));
    }

    [Fact]
    public async Task LoginPelaTela_comSessaoAnteriorVivaNoNavegador_revogaAContaAntiga_P1()
    {
        // Regressão do P1 (achado do auditor): A loga e NÃO clica "Sair" (jwt de A segue vivo no
        // jar). B loga PELA TELA DE LOGIN no mesmo navegador. Antes, o jwt de A vivo fazia o servidor
        // tratar como "adicionar conta" e NÃO revogar A → A seguia acessível (o furo demonstrado).
        // Agora /auth/login SEMPRE começa limpo → A é revogada mesmo com a sessão dela viva.
        var usuarioA = SeedUsuario("p1-a@test.com", "SenhaForte!2026");
        SeedUsuario("p1-b@test.com", "SenhaForte!2026");

        var navegador = _factory.CreateClient();
        var loginA = await navegador.PostAsJsonAsync("/api/v1/auth/login",
            new { email = "p1-a@test.com", password = "SenhaForte!2026" });
        loginA.EnsureSuccessStatusCode();
        var rtA = ExtrairCookiesPorPrefixo(loginA, "rt_").Single();

        // B loga pela tela (mesmo navegador, jwt de A ainda no jar).
        var loginB = await navegador.PostAsJsonAsync("/api/v1/auth/login",
            new { email = "p1-b@test.com", password = "SenhaForte!2026" });
        loginB.EnsureSuccessStatusCode();

        // A foi revogada no login de B (não virou "adicionar conta"): switch pra A dá 401.
        Assert.Equal(HttpStatusCode.Unauthorized, await SwitchComRefreshCru(usuarioA.Id, rtA.Key, rtA.Value));
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

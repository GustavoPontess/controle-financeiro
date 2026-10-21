using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Pipeline HTTP real do GET /dashboard — o CONTRATO JSON que o front lê depois da reforma do Dashboard:
/// transação recente com <c>data</c> ("yyyy-MM-dd", date puro) e <c>hora</c> ("HH:mm:ss" ou null) separadas
/// + as flags de transferência/pagamento de fatura, <c>tipoDescricao</c> legível, <c>ultimosDigitos</c> do cartão
/// e "Sem categoria" nos maiores gastos. Também cobre mês/ano inválido (400, nunca 500), anônimo (401) e o
/// isolamento entre usuários. Só leitura (GET) e sem id de recurso na rota, então 404/403 (IDOR) não se aplicam:
/// o dono vem do token. Banco InMemory via CustomWebApplicationFactory.
/// </summary>
// Mesma razão do [Collection] em AuthHttpTests: o login lê a env var global PASSWORD_PEPPER.
[Collection("PasswordHasherEnv")]
public class DashboardHttpTests : IClassFixture<CustomWebApplicationFactory>
{
    private const string Senha = "SenhaForte!2026";
    private readonly CustomWebApplicationFactory _factory;

    public DashboardHttpTests(CustomWebApplicationFactory factory) => _factory = factory;

    private Guid SeedUsuario(string email)
    {
        using var scope = _factory.CreateScopeComBanco();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var usuario = new Usuario
        {
            Id = Guid.NewGuid(),
            Email = email.ToLower(),
            Nome = "User Dashboard HTTP",
            PasswordHash = PasswordHasher.HashPassword(Senha),
            Status = StatusUsuario.Ativo,
            CriadoEm = DateTime.UtcNow,
        };
        ctx.Usuarios.Add(usuario);
        ctx.SaveChanges();
        return usuario.Id;
    }

    // Mesmo padrão de ContasHttpTests/AutorizacaoHttpTests: client próprio (cookie container) logado de verdade.
    private async Task<HttpClient> LoginClientAsync(string email)
    {
        var client = _factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = Senha });
        resp.EnsureSuccessStatusCode();
        return client;
    }

    private static DateOnly Hoje => HorarioBrasil.Hoje();

    // "yyyy-MM-dd": o formato do date puro no JSON (e o que o front parseia sem fuso).
    private static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);

    // Conta poupança + cartão final 1234 + 3 lançamentos de ontem: um pix (transferência, COM hora), o
    // pagamento de uma fatura (sem hora) e uma despesa comum sem categoria (sem hora). Devolve o dia deles.
    private DateOnly SeedCenario(Guid usuarioId)
    {
        using var scope = _factory.CreateScopeComBanco();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var dia = Hoje.AddDays(-1);
        var conta = new Conta
        {
            Id = Guid.NewGuid(), Nome = "Poupança Itaú", Tipo = TipoConta.ContaPoupanca,
            UsuarioIdProprietario = usuarioId,
        };
        ctx.Contas.Add(conta);
        ctx.CartoesCredito.Add(new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = "Nubank", UltimosDigitos = "1234", TemCredito = true, LimiteTotal = 5000m,
            CriadoPor = usuarioId, Ativo = true,
        });
        Transacao Despesa(string descricao, decimal valor, Action<Transacao> ajusta)
        {
            var t = new Transacao
            {
                Id = Guid.NewGuid(), Descricao = descricao, Valor = valor, Tipo = TipoTransacao.Despesa,
                ContaId = conta.Id, CriadoPor = usuarioId, Data = dia,
            };
            ajusta(t);
            return t;
        }
        ctx.Transacoes.AddRange(
            Despesa("pix pra Maria", 150m, t => { t.Hora = new TimeOnly(14, 30, 15); t.EhTransferencia = true; }),
            Despesa("fatura do cartão", 800m, t => t.EhPagamentoFatura = true),
            Despesa("padaria", 20m, _ => { }));
        ctx.SaveChanges();
        return dia;
    }

    private static JsonElement Recente(JsonElement json, string descricao) =>
        json.GetProperty("transacoesRecentes").EnumerateArray()
            .Single(t => t.GetProperty("descricao").GetString() == descricao);

    [Fact]
    public async Task Obter_Anonimo_Retorna401()
    {
        // GET é método seguro — não passa pelo CsrfValidationMiddleware —, então o 401 vem direto da FallbackPolicy.
        var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/v1/dashboard");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Obter_Logado_Retorna200ComOContratoQueOFrontLe()
    {
        const string email = "dashboard-contrato@test.com";
        var usuarioId = SeedUsuario(email);
        var dia = SeedCenario(usuarioId);
        var client = await LoginClientAsync(email);

        var resp = await client.GetAsync($"/api/v1/dashboard?ano={dia.Year}&mes={dia.Month}");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();

        // Recentes: dia e hora SEPARADOS ("yyyy-MM-dd" e "HH:mm:ss"), sem timestamp único (que deslocava +3h no front).
        var pix = Recente(json, "pix pra Maria");
        Assert.Equal(Iso(dia), pix.GetProperty("data").GetString());
        Assert.Equal("14:30:15", pix.GetProperty("hora").GetString());
        Assert.True(pix.GetProperty("ehTransferencia").GetBoolean());
        Assert.False(pix.GetProperty("ehPagamentoFatura").GetBoolean());

        var fatura = Recente(json, "fatura do cartão");
        Assert.Equal(Iso(dia), fatura.GetProperty("data").GetString());
        Assert.Equal(JsonValueKind.Null, fatura.GetProperty("hora").ValueKind); // sem hora: null, não "00:00:00"
        Assert.True(fatura.GetProperty("ehPagamentoFatura").GetBoolean());
        Assert.False(fatura.GetProperty("ehTransferencia").GetBoolean());

        var padaria = Recente(json, "padaria");
        Assert.False(padaria.GetProperty("ehTransferencia").GetBoolean());
        Assert.False(padaria.GetProperty("ehPagamentoFatura").GetBoolean());

        // Contas: o tipo vem por extenso, não o nome cru do enum ("ContaPoupanca").
        var contaDoResumo = Assert.Single(json.GetProperty("saldoContas").EnumerateArray());
        Assert.Equal("Conta Poupança", contaDoResumo.GetProperty("tipoDescricao").GetString());
        Assert.Equal((int)TipoConta.ContaPoupanca, contaDoResumo.GetProperty("tipo").GetInt32());

        // Cartões: os últimos dígitos distinguem cartões de mesmo nome.
        var cartao = Assert.Single(json.GetProperty("cartoesResumo").EnumerateArray());
        Assert.Equal("Nubank", cartao.GetProperty("nome").GetString());
        Assert.Equal("1234", cartao.GetProperty("ultimosDigitos").GetString());

        // Maiores gastos: só a padaria é saída de caixa (pix é transferência, fatura é pagamento) e não tem categoria.
        var fatia = Assert.Single(json.GetProperty("topCategorias").EnumerateArray());
        Assert.Equal("Sem categoria", fatia.GetProperty("descricao").GetString());
        Assert.Equal(20m, fatia.GetProperty("valor").GetDecimal());
        Assert.Equal(100m, fatia.GetProperty("percentual").GetDecimal());
        Assert.Equal(20m, json.GetProperty("saidasCaixa").GetDecimal());

        // Saldo das contas: 0 - 150 - 800 - 20 (tudo move dinheiro, até a transferência e o pagamento de fatura).
        Assert.Equal(-970m, json.GetProperty("saldoTotal").GetDecimal());
        // O valor de saldoMesAnterior depende de "ontem" cair ou não no mês passado (hoje ser dia 1) — aqui só o tipo.
        Assert.Equal(JsonValueKind.Number, json.GetProperty("saldoMesAnterior").ValueKind);
        Assert.Equal(6, json.GetProperty("evolucaoSaldo").GetArrayLength());
    }

    [Fact]
    public async Task Obter_SemParametros_UsaOMesCorrente()
    {
        const string email = "dashboard-sem-parametros@test.com";
        SeedUsuario(email);
        var client = await LoginClientAsync(email);

        var resp = await client.GetAsync("/api/v1/dashboard");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(6, json.GetProperty("evolucaoSaldo").GetArrayLength());
    }

    [Theory]
    [InlineData("ano=2026&mes=13")]
    [InlineData("ano=2026&mes=0")]
    [InlineData("ano=2026&mes=-1")]
    [InlineData("ano=0&mes=5")]
    [InlineData("ano=10000&mes=1")]
    [InlineData("ano=1&mes=1")]
    [InlineData("ano=9999&mes=12")]
    [InlineData("ano=abc&mes=5")]
    public async Task Obter_AnoOuMesInvalido_Retorna400_NuncaUm500(string query)
    {
        var email = $"dashboard-invalido-{Guid.NewGuid():N}@test.com";
        SeedUsuario(email);
        var client = await LoginClientAsync(email);

        var resp = await client.GetAsync($"/api/v1/dashboard?{query}");

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Obter_NaoMostraDadosDeOutroUsuario()
    {
        // O dono vem do token, não da rota: outro usuário logado vê o PRÓPRIO resumo (vazio), nunca o do dono.
        var dono = SeedUsuario("dashboard-dono@test.com");
        var dia = SeedCenario(dono);
        const string emailOutro = "dashboard-outro@test.com";
        SeedUsuario(emailOutro);
        var client = await LoginClientAsync(emailOutro);

        var resp = await client.GetAsync($"/api/v1/dashboard?ano={dia.Year}&mes={dia.Month}");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, json.GetProperty("transacoesRecentes").GetArrayLength());
        Assert.Equal(0, json.GetProperty("saldoContas").GetArrayLength());
        Assert.Equal(0, json.GetProperty("cartoesResumo").GetArrayLength());
        Assert.Equal(0, json.GetProperty("topCategorias").GetArrayLength());
        Assert.Equal(0m, json.GetProperty("saldoTotal").GetDecimal());
    }
}

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Pipeline HTTP real do POST /contas com saldo inicial + DATA de abertura (DataSaldoInicial):
/// prova que o campo do DTO chega do JSON ao service (o front manda "YYYY-MM-DD"), que a transação
/// EhSaldoInicial é gravada no DIA escolhido (Data = DateOnly, Hora = null), que data futura vira 400 sem gravar nada e
/// que sem login é 401. Create não recebe id de recurso, então 404/403 (IDOR) não se aplicam aqui.
/// Também cobre o PUT /contas/{id}/saldo-inicial (edição do ponto de partida pela Reconciliação):
/// 204 + transação alterada no banco + evento financeiro, 400 (valor zero/negativo/ausente, data futura),
/// 404 pra conta de outro usuário (IDOR, idêntico ao de conta inexistente) e 401 anônimo.
/// Banco InMemory via CustomWebApplicationFactory.
/// </summary>
// Mesma razão do [Collection] em AuthHttpTests: o login lê a env var global PASSWORD_PEPPER.
[Collection("PasswordHasherEnv")]
public class ContasHttpTests : IClassFixture<CustomWebApplicationFactory>
{
    private const string Senha = "SenhaForte!2026";
    private readonly CustomWebApplicationFactory _factory;

    public ContasHttpTests(CustomWebApplicationFactory factory) => _factory = factory;

    private Guid SeedUsuario(string email)
    {
        using var scope = _factory.CreateScopeComBanco();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var usuario = new Usuario
        {
            Id = Guid.NewGuid(),
            Email = email.ToLower(),
            Nome = "User Contas HTTP",
            PasswordHash = PasswordHasher.HashPassword(Senha),
            Status = StatusUsuario.Ativo,
            CriadoEm = DateTime.UtcNow,
        };
        ctx.Usuarios.Add(usuario);
        ctx.SaveChanges();
        return usuario.Id;
    }

    // Mesmo padrão de AutorizacaoHttpTests/FaturaPagarHttpTests: client próprio (cookie container) + CSRF do login.
    private async Task<(HttpClient Client, string Csrf)> LoginClientAsync(string email)
    {
        var client = _factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = Senha });
        resp.EnsureSuccessStatusCode();
        string csrf = "";
        foreach (var sc in resp.Headers.GetValues("Set-Cookie"))
        {
            if (sc.StartsWith("X-CSRF-Token=", StringComparison.Ordinal))
                csrf = Uri.UnescapeDataString(sc.Substring("X-CSRF-Token=".Length).Split(';')[0]);
        }
        return (client, csrf);
    }

    private static HttpRequestMessage CriarContaRequest(object body, string csrf)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/contas") { Content = JsonContent.Create(body) };
        req.Headers.Add("X-CSRF-Token", csrf);
        return req;
    }

    // Transacao.Data é DateOnly (o DIA, sem fuso) e Hora é TimeOnly? (null = sem hora).
    private static DateOnly Hoje => DateOnly.FromDateTime(DateTime.UtcNow);

    // "YYYY-MM-DD" é exatamente o que o ContaForm do front envia em dataSaldoInicial (e em `data` do PUT).
    private static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);

    private List<Transacao> SaldosIniciaisDoUsuario(Guid usuarioId)
    {
        using var scope = _factory.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return ctx.Transacoes.AsNoTracking()
            .Where(t => t.EhSaldoInicial && t.CriadoPor == usuarioId)
            .ToList();
    }

    private int ContasDoUsuario(Guid usuarioId)
    {
        using var scope = _factory.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return ctx.Contas.Count(c => c.UsuarioIdProprietario == usuarioId);
    }

    [Fact]
    public async Task Criar_ComDataSaldoInicialRetroativa_Retorna201_EGravaTransacaoNaqueleDiaSemHora()
    {
        const string email = "contas-data-retroativa@test.com";
        var usuarioId = SeedUsuario(email);
        var (client, csrf) = await LoginClientAsync(email);
        var dia = Hoje.AddDays(-20);

        var resp = await client.SendAsync(CriarContaRequest(
            new { nome = "Conta Retroativa", tipo = (int)TipoConta.ContaCorrente, saldoInicial = 500m, dataSaldoInicial = Iso(dia) },
            csrf));

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var saldos = SaldosIniciaisDoUsuario(usuarioId);
        var saldoInicial = Assert.Single(saldos);
        Assert.Equal(dia, saldoInicial.Data); // o dia informado, não "agora"
        Assert.Null(saldoInicial.Hora); // saldo inicial é datado, sem hora
        Assert.Equal(500m, saldoInicial.Valor);
        // O saldo devolvido já reflete o lançamento (lido do banco pela mesma regra da listagem).
        var corpo = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(500m, corpo.GetProperty("saldoAtual").GetDecimal());
    }

    [Fact]
    public async Task Criar_SemDataSaldoInicial_GravaTransacaoHojeSemHora()
    {
        const string email = "contas-sem-data@test.com";
        var usuarioId = SeedUsuario(email);
        var (client, csrf) = await LoginClientAsync(email);

        var antes = Hoje;
        var resp = await client.SendAsync(CriarContaRequest(
            new { nome = "Conta Sem Data", tipo = (int)TipoConta.ContaCorrente, saldoInicial = 300m },
            csrf));
        var depois = Hoje;

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var saldoInicial = Assert.Single(SaldosIniciaisDoUsuario(usuarioId));
        Assert.InRange(saldoInicial.Data, antes, depois);
        Assert.Null(saldoInicial.Hora);
    }

    [Fact]
    public async Task Criar_ComDataSaldoInicialFutura_Retorna400_ENaoGravaNada()
    {
        const string email = "contas-data-futura@test.com";
        var usuarioId = SeedUsuario(email);
        var (client, csrf) = await LoginClientAsync(email);

        var resp = await client.SendAsync(CriarContaRequest(
            new
            {
                nome = "Conta Futura", tipo = (int)TipoConta.ContaCorrente, saldoInicial = 500m,
                dataSaldoInicial = Iso(Hoje.AddDays(2)),
            },
            csrf));

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var corpo = await resp.Content.ReadAsStringAsync();
        Assert.Contains("\"code\":\"VALIDATION_ERROR\"", corpo);
        Assert.Contains("futura", corpo);
        Assert.Empty(SaldosIniciaisDoUsuario(usuarioId));
        Assert.Equal(0, ContasDoUsuario(usuarioId));
    }

    // ------------------------------------------------------------------ PUT /contas/{id}/saldo-inicial

    // Conta do usuário já com a transação de saldo inicial (ou sem ela, se valor == null).
    private Guid SeedContaComSaldoInicial(Guid usuarioId, decimal? valor, DateOnly data, TimeOnly? hora = null)
    {
        using var scope = _factory.CreateScopeComBanco();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var conta = new Conta
        {
            Id = Guid.NewGuid(), Nome = "Conta Saldo Inicial", Tipo = TipoConta.ContaCorrente,
            UsuarioIdProprietario = usuarioId,
        };
        ctx.Contas.Add(conta);
        if (valor.HasValue)
        {
            ctx.Transacoes.Add(new Transacao
            {
                Id = Guid.NewGuid(), Descricao = "Saldo Inicial", Valor = valor.Value, Tipo = TipoTransacao.Receita,
                ContaId = conta.Id, CriadoPor = usuarioId, Data = data, Hora = hora, EhSaldoInicial = true,
            });
        }
        ctx.SaveChanges();
        return conta.Id;
    }

    private static HttpRequestMessage SaldoInicialRequest(Guid contaId, object body, string csrf)
    {
        var req = new HttpRequestMessage(HttpMethod.Put, $"/api/v1/contas/{contaId}/saldo-inicial")
        {
            Content = JsonContent.Create(body),
        };
        req.Headers.Add("X-CSRF-Token", csrf);
        return req;
    }

    private List<FinancialEventLog> EventosDoUsuario(Guid usuarioId)
    {
        using var scope = _factory.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return ctx.FinancialEventLogs.AsNoTracking().Where(e => e.CriadoPor == usuarioId).ToList();
    }

    [Fact]
    public async Task AtualizarSaldoInicial_Valido_Retorna204_EAlteraATransacaoNoBanco()
    {
        const string email = "contas-si-ok@test.com";
        var usuarioId = SeedUsuario(email);
        // Saldo inicial de partida COM hora (15:30) de propósito: editar pelo endpoint tem que limpar (Hora = null).
        var contaId = SeedContaComSaldoInicial(usuarioId, 1000m, Hoje.AddDays(-5), new TimeOnly(15, 30));
        var (client, csrf) = await LoginClientAsync(email);
        var novoDia = Hoje.AddDays(-15);

        var resp = await client.SendAsync(SaldoInicialRequest(contaId, new { valor = 2345.67m, data = Iso(novoDia) }, csrf));

        Assert.Equal(HttpStatusCode.NoContent, resp.StatusCode);
        var saldoInicial = Assert.Single(SaldosIniciaisDoUsuario(usuarioId)); // atualizou a existente, não duplicou
        Assert.Equal(2345.67m, saldoInicial.Valor);
        Assert.Equal(novoDia, saldoInicial.Data); // o dia informado
        Assert.Null(saldoInicial.Hora);
        // O saldo da conta (regra única) já reflete o novo ponto de partida.
        var conta = await client.GetFromJsonAsync<JsonElement>($"/api/v1/contas/{contaId}");
        Assert.Equal(2345.67m, conta.GetProperty("saldoAtual").GetDecimal());
        // Mudou dinheiro → ficou no log de eventos financeiros, com antes/depois.
        var evento = Assert.Single(EventosDoUsuario(usuarioId));
        Assert.Equal(FinancialEventType.TransacaoAtualizada, evento.Tipo);
        Assert.Equal(1000m, evento.ValorAntes);
        Assert.Equal(2345.67m, evento.ValorDepois);
    }

    [Fact]
    public async Task AtualizarSaldoInicial_SemData_MantemADataAtual()
    {
        const string email = "contas-si-sem-data@test.com";
        var usuarioId = SeedUsuario(email);
        var dataOriginal = Hoje.AddDays(-8);
        var contaId = SeedContaComSaldoInicial(usuarioId, 300m, dataOriginal);
        var (client, csrf) = await LoginClientAsync(email);

        var resp = await client.SendAsync(SaldoInicialRequest(contaId, new { valor = 450m }, csrf));

        Assert.Equal(HttpStatusCode.NoContent, resp.StatusCode);
        var saldoInicial = Assert.Single(SaldosIniciaisDoUsuario(usuarioId));
        Assert.Equal(450m, saldoInicial.Valor);
        Assert.Equal(dataOriginal, saldoInicial.Data);
    }

    [Fact]
    public async Task AtualizarSaldoInicial_ContaSemSaldoInicial_Retorna204_ECriaATransacao()
    {
        const string email = "contas-si-cria@test.com";
        var usuarioId = SeedUsuario(email);
        var contaId = SeedContaComSaldoInicial(usuarioId, valor: null, Hoje);
        Assert.Empty(SaldosIniciaisDoUsuario(usuarioId));
        var (client, csrf) = await LoginClientAsync(email);
        var dia = Hoje.AddDays(-3);

        var resp = await client.SendAsync(SaldoInicialRequest(contaId, new { valor = 800m, data = Iso(dia) }, csrf));

        Assert.Equal(HttpStatusCode.NoContent, resp.StatusCode);
        var criada = Assert.Single(SaldosIniciaisDoUsuario(usuarioId));
        Assert.Equal(contaId, criada.ContaId);
        Assert.Equal(800m, criada.Valor);
        Assert.Equal(dia, criada.Data);
        Assert.Null(criada.Hora);
        Assert.Equal(TipoTransacao.Receita, criada.Tipo);
        var evento = Assert.Single(EventosDoUsuario(usuarioId));
        Assert.Equal(FinancialEventType.TransacaoCriada, evento.Tipo);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-50)]
    public async Task AtualizarSaldoInicial_ValorZeroOuNegativo_Retorna400_ENaoAltera(int valor)
    {
        var email = $"contas-si-valor-{(valor < 0 ? "negativo" : "zero")}@test.com";
        var usuarioId = SeedUsuario(email);
        var dataOriginal = Hoje.AddDays(-5);
        var contaId = SeedContaComSaldoInicial(usuarioId, 1000m, dataOriginal);
        var (client, csrf) = await LoginClientAsync(email);

        var resp = await client.SendAsync(SaldoInicialRequest(contaId, new { valor, data = Iso(Hoje.AddDays(-2)) }, csrf));

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Contains("\"code\":\"VALIDATION_ERROR\"", await resp.Content.ReadAsStringAsync());
        var saldoInicial = Assert.Single(SaldosIniciaisDoUsuario(usuarioId));
        Assert.Equal(1000m, saldoInicial.Valor);
        Assert.Equal(dataOriginal, saldoInicial.Data);
        Assert.Empty(EventosDoUsuario(usuarioId));
    }

    [Fact]
    public async Task AtualizarSaldoInicial_SemValorNoCorpo_Retorna400_ENaoAltera()
    {
        // Valor ausente vira 0 (decimal default) → mesma recusa de "maior que zero".
        const string email = "contas-si-sem-valor@test.com";
        var usuarioId = SeedUsuario(email);
        var contaId = SeedContaComSaldoInicial(usuarioId, 1000m, Hoje.AddDays(-5));
        var (client, csrf) = await LoginClientAsync(email);

        var resp = await client.SendAsync(SaldoInicialRequest(contaId, new { data = Iso(Hoje.AddDays(-2)) }, csrf));

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Equal(1000m, Assert.Single(SaldosIniciaisDoUsuario(usuarioId)).Valor);
    }

    [Fact]
    public async Task AtualizarSaldoInicial_DataFutura_Retorna400_ENaoAltera()
    {
        const string email = "contas-si-data-futura@test.com";
        var usuarioId = SeedUsuario(email);
        var dataOriginal = Hoje.AddDays(-5);
        var contaId = SeedContaComSaldoInicial(usuarioId, 1000m, dataOriginal);
        var (client, csrf) = await LoginClientAsync(email);

        var resp = await client.SendAsync(SaldoInicialRequest(contaId, new { valor = 2000m, data = Iso(Hoje.AddDays(2)) }, csrf));

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var corpo = await resp.Content.ReadAsStringAsync();
        Assert.Contains("\"code\":\"VALIDATION_ERROR\"", corpo);
        Assert.Contains("futura", corpo);
        var saldoInicial = Assert.Single(SaldosIniciaisDoUsuario(usuarioId));
        Assert.Equal(1000m, saldoInicial.Valor); // nem o valor mudou
        Assert.Equal(dataOriginal, saldoInicial.Data);
        Assert.Empty(EventosDoUsuario(usuarioId));
    }

    [Fact]
    public async Task AtualizarSaldoInicial_ContaDeOutroUsuario_Retorna404IgualAInexistente_ENaoAltera()
    {
        // IDOR: o atacante conhece o id da conta de outro usuário. 404 idêntico ao de id inexistente
        // (não confirma que o id existe) e o saldo inicial do dono fica intacto.
        var emailDono = "contas-si-dono@test.com";
        var donoId = SeedUsuario(emailDono);
        var dataDono = Hoje.AddDays(-5);
        var contaDoDono = SeedContaComSaldoInicial(donoId, 1000m, dataDono);
        const string emailAtacante = "contas-si-atacante@test.com";
        var atacanteId = SeedUsuario(emailAtacante);
        var (client, csrf) = await LoginClientAsync(emailAtacante);
        var corpo = new { valor = 99999m, data = Iso(Hoje.AddDays(-1)) };

        var deOutro = await client.SendAsync(SaldoInicialRequest(contaDoDono, corpo, csrf));
        var inexistente = await client.SendAsync(SaldoInicialRequest(Guid.NewGuid(), corpo, csrf));

        Assert.Equal(HttpStatusCode.NotFound, deOutro.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, inexistente.StatusCode);
        Assert.Equal(await inexistente.Content.ReadAsStringAsync(), await deOutro.Content.ReadAsStringAsync());
        var saldoDono = Assert.Single(SaldosIniciaisDoUsuario(donoId));
        Assert.Equal(1000m, saldoDono.Valor);
        Assert.Equal(dataDono, saldoDono.Data);
        Assert.Empty(SaldosIniciaisDoUsuario(atacanteId)); // nada criado pro atacante também
        Assert.Empty(EventosDoUsuario(donoId));
        Assert.Empty(EventosDoUsuario(atacanteId));
    }

    [Fact]
    public async Task AtualizarSaldoInicial_Anonimo_Retorna401_ENaoAltera()
    {
        // Sem login a FallbackPolicy barra antes do controller. Cookie + header de CSRF coerentes pra o 401
        // vir da autorização (e não do CsrfValidationMiddleware), como em Criar_Anonimo.
        const string email = "contas-si-anonimo@test.com";
        var usuarioId = SeedUsuario(email);
        var contaId = SeedContaComSaldoInicial(usuarioId, 1000m, Hoje.AddDays(-5));
        var client = _factory.CreateClient();
        const string csrf = "csrf-anonimo-saldo-inicial";
        var req = SaldoInicialRequest(contaId, new { valor = 5m, data = Iso(Hoje) }, csrf);
        req.Headers.Add("Cookie", $"X-CSRF-Token={csrf}");

        var resp = await client.SendAsync(req);

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
        Assert.Equal(1000m, Assert.Single(SaldosIniciaisDoUsuario(usuarioId)).Valor);
    }

    [Fact]
    public async Task Criar_Anonimo_Retorna401_ENaoGravaNada()
    {
        // Sem login a FallbackPolicy barra antes do controller. Manda cookie+header de CSRF coerentes
        // pra o 401 vir da autorização (e não do CsrfValidationMiddleware), como em AutorizacaoHttpTests.
        var client = _factory.CreateClient();
        const string csrf = "csrf-anonimo-contas";
        var req = CriarContaRequest(
            new { nome = "Conta Anonima", tipo = (int)TipoConta.ContaCorrente, saldoInicial = 500m, dataSaldoInicial = Iso(Hoje) },
            csrf);
        req.Headers.Add("Cookie", $"X-CSRF-Token={csrf}");

        var resp = await client.SendAsync(req);

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    // ------------------------------------------------------------------ GET /contas (TipoDescricao)

    // O controller usa TipoContaExtensions.Descricao() — a mesma fonte do Dashboard (era uma cópia local).
    [Theory]
    [InlineData(TipoConta.ContaCorrente, "Conta Corrente")]
    [InlineData(TipoConta.ContaPoupanca, "Conta Poupança")]
    [InlineData(TipoConta.Dinheiro, "Dinheiro")]
    public async Task Listar_RetornaTipoDescricaoLegivel(TipoConta tipo, string esperado)
    {
        var email = $"contas-tipo-{(int)tipo}@test.com";
        var usuarioId = SeedUsuario(email);
        var contaId = Guid.NewGuid();
        using (var scope = _factory.CreateScopeComBanco())
        {
            var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            ctx.Contas.Add(new Conta { Id = contaId, Nome = "Conta do tipo", Tipo = tipo, UsuarioIdProprietario = usuarioId });
            ctx.SaveChanges();
        }
        var (client, _) = await LoginClientAsync(email);

        var contas = await client.GetFromJsonAsync<JsonElement>("/api/v1/contas");

        var conta = contas.EnumerateArray().Single(c => c.GetProperty("id").GetGuid() == contaId);
        Assert.Equal(esperado, conta.GetProperty("tipoDescricao").GetString()); // não o nome cru do enum ("ContaCorrente")
        Assert.Equal((int)tipo, conta.GetProperty("tipo").GetInt32());
    }
}

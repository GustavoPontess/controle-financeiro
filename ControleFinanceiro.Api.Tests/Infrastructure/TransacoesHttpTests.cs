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
/// Pipeline HTTP real de /transacoes depois da separação Data (DateOnly) + Hora (TimeOnly?):
/// prova o ROUND-TRIP pelo JSON ("yyyy-MM-dd" + "HH:mm:ss", sem 'Z', sem deslocar +3h — o bug que
/// motivou a mudança), a Hora nula, a edição (trocar/limpar a hora), os filtros from/to como DateOnly,
/// a ordenação intradia (dia + hora), 400 (data futura / formato inválido), 401 anônimo e 404 de IDOR
/// (conta/transação de outro usuário — a API responde 404 e não 403 pra não confirmar a existência).
/// Banco InMemory via CustomWebApplicationFactory.
/// </summary>
// Mesma razão do [Collection] em AuthHttpTests: o login lê a env var global PASSWORD_PEPPER.
[Collection("PasswordHasherEnv")]
public class TransacoesHttpTests : IClassFixture<CustomWebApplicationFactory>
{
    private const string Senha = "SenhaForte!2026";
    private readonly CustomWebApplicationFactory _factory;

    public TransacoesHttpTests(CustomWebApplicationFactory factory) => _factory = factory;

    private static DateOnly Hoje => HorarioBrasil.Hoje();

    // "yyyy-MM-dd" é exatamente o que o front envia em `data` (e filtra em from/to).
    private static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);

    private Guid SeedUsuario(string email)
    {
        using var scope = _factory.CreateScopeComBanco();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var usuario = new Usuario
        {
            Id = Guid.NewGuid(),
            Email = email.ToLower(),
            Nome = "User Transacoes HTTP",
            PasswordHash = PasswordHasher.HashPassword(Senha),
            Status = StatusUsuario.Ativo,
            CriadoEm = DateTime.UtcNow,
        };
        ctx.Usuarios.Add(usuario);
        ctx.SaveChanges();
        return usuario.Id;
    }

    private Guid SeedConta(Guid usuarioId)
    {
        using var scope = _factory.CreateScopeComBanco();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var conta = new Conta
        {
            Id = Guid.NewGuid(), Nome = "Conta Corrente", Tipo = TipoConta.ContaCorrente,
            UsuarioIdProprietario = usuarioId,
        };
        ctx.Contas.Add(conta);
        ctx.SaveChanges();
        return conta.Id;
    }

    // Categoria global (UsuarioId nulo): qualquer usuário pode usar. O PUT sempre revalida a categoria.
    private Guid SeedCategoriaDespesa()
    {
        using var scope = _factory.CreateScopeComBanco();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var categoria = new Categoria
        {
            Id = Guid.NewGuid(), Descricao = "Alimentação", Finalidade = Finalidade.Despesa, UsuarioId = null,
        };
        ctx.Categorias.Add(categoria);
        ctx.SaveChanges();
        return categoria.Id;
    }

    private Guid SeedTransacao(
        Guid usuarioId, Guid contaId, DateOnly data, TimeOnly? hora, decimal valor = 10m,
        TipoTransacao tipo = TipoTransacao.Despesa)
    {
        using var scope = _factory.CreateScopeComBanco();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var transacao = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Lançamento seed", Valor = valor, Tipo = tipo,
            ContaId = contaId, CriadoPor = usuarioId, Data = data, Hora = hora,
        };
        ctx.Transacoes.Add(transacao);
        ctx.SaveChanges();
        return transacao.Id;
    }

    // Lê direto do banco, sem passar pelo JSON — o "outro lado" do round-trip.
    private Transacao? NoBanco(Guid id)
    {
        using var scope = _factory.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return ctx.Transacoes.AsNoTracking().IgnoreQueryFilters().FirstOrDefault(t => t.Id == id);
    }

    private int TransacoesDaConta(Guid contaId)
    {
        using var scope = _factory.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return ctx.Transacoes.IgnoreQueryFilters().Count(t => t.ContaId == contaId);
    }

    // Mesmo padrão de AutorizacaoHttpTests/ContasHttpTests: client próprio (cookie container) + CSRF do login.
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

    private static HttpRequestMessage Req(HttpMethod metodo, string url, string csrf, object? corpo = null)
    {
        var req = new HttpRequestMessage(metodo, url);
        if (corpo != null) req.Content = JsonContent.Create(corpo);
        req.Headers.Add("X-CSRF-Token", csrf);
        return req;
    }

    private static Dictionary<string, object?> CorpoDeDespesa(Guid contaId, string data, string? hora) => new()
    {
        ["descricao"] = "Mercado",
        ["valor"] = 42.5m,
        ["tipo"] = (int)TipoTransacao.Despesa,
        ["contaId"] = contaId,
        ["data"] = data,
        ["hora"] = hora,
    };

    private static List<Guid> IdsDaPagina(JsonElement pagina) =>
        pagina.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("id").GetGuid()).ToList();

    // ------------------------------------------------------------------ POST — round-trip Data/Hora

    [Fact]
    public async Task Criar_ComDataEHora_Retorna201_EDataEHoraVoltamIdenticosSemShift()
    {
        const string email = "transacoes-roundtrip@test.com";
        var usuarioId = SeedUsuario(email);
        var contaId = SeedConta(usuarioId);
        var (client, csrf) = await LoginClientAsync(email);
        // 23:30 de propósito: qualquer deslocamento de fuso (+3h/-3h) viraria o DIA — era o bug do timestamp único.
        var dia = Hoje.AddDays(-30);

        var resp = await client.SendAsync(Req(HttpMethod.Post, "/api/v1/transacoes", csrf,
            CorpoDeDespesa(contaId, Iso(dia), "23:30:00")));

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var criada = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var id = criada.GetProperty("id").GetGuid();
        // Resposta do POST: strings puras, sem 'T', sem 'Z', sem offset.
        Assert.Equal(Iso(dia), criada.GetProperty("data").GetString());
        Assert.Equal("23:30:00", criada.GetProperty("hora").GetString());

        // Banco: os dois campos gravados exatamente como enviados.
        var doBanco = NoBanco(id)!;
        Assert.Equal(dia, doBanco.Data);
        Assert.Equal(new TimeOnly(23, 30, 0), doBanco.Hora);

        // GET por id e listagem: o mesmo valor de volta.
        var porId = await client.GetFromJsonAsync<JsonElement>($"/api/v1/transacoes/{id}");
        Assert.Equal(Iso(dia), porId.GetProperty("data").GetString());
        Assert.Equal("23:30:00", porId.GetProperty("hora").GetString());

        var lista = await client.GetFromJsonAsync<JsonElement>($"/api/v1/transacoes?contaId={contaId}");
        var item = lista.GetProperty("items").EnumerateArray().Single(i => i.GetProperty("id").GetGuid() == id);
        Assert.Equal(Iso(dia), item.GetProperty("data").GetString());
        Assert.Equal("23:30:00", item.GetProperty("hora").GetString());
    }

    [Fact]
    public async Task Criar_SemHora_Retorna201_EHoraVoltaNula()
    {
        const string email = "transacoes-sem-hora@test.com";
        var usuarioId = SeedUsuario(email);
        var contaId = SeedConta(usuarioId);
        var (client, csrf) = await LoginClientAsync(email);
        var dia = Hoje.AddDays(-10);

        var resp = await client.SendAsync(Req(HttpMethod.Post, "/api/v1/transacoes", csrf,
            CorpoDeDespesa(contaId, Iso(dia), hora: null)));

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var criada = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(Iso(dia), criada.GetProperty("data").GetString());
        Assert.Equal(JsonValueKind.Null, criada.GetProperty("hora").ValueKind); // null = SEM hora
        var doBanco = NoBanco(criada.GetProperty("id").GetGuid())!;
        Assert.Equal(dia, doBanco.Data);
        Assert.Null(doBanco.Hora);
    }

    // ------------------------------------------------------------------ PUT — trocar / limpar a hora

    [Fact]
    public async Task Atualizar_TrocaDataEHora_E_LimpaAHoraQuandoOmitida()
    {
        const string email = "transacoes-atualizar@test.com";
        var usuarioId = SeedUsuario(email);
        var contaId = SeedConta(usuarioId);
        var categoriaId = SeedCategoriaDespesa();
        var id = SeedTransacao(usuarioId, contaId, Hoje.AddDays(-9), new TimeOnly(8, 15));
        var (client, csrf) = await LoginClientAsync(email);
        var novoDia = Hoje.AddDays(-4);

        // 1) troca dia e hora
        var corpo = CorpoDeDespesa(contaId, Iso(novoDia), "17:05:00");
        corpo["categoriaId"] = categoriaId;
        var resp1 = await client.SendAsync(Req(HttpMethod.Put, $"/api/v1/transacoes/{id}", csrf, corpo));

        // A edição completa devolve 200 com o resultado (o próprio lançamento, ou o registro que o substituiu).
        Assert.Equal(HttpStatusCode.OK, resp1.StatusCode);
        Assert.Contains("\"tipo\":\"transacao\"", await resp1.Content.ReadAsStringAsync());
        var apos1 = NoBanco(id)!;
        Assert.Equal(novoDia, apos1.Data);
        Assert.Equal(new TimeOnly(17, 5, 0), apos1.Hora);

        // 2) sem hora no corpo → a hora é LIMPA (null), o dia continua
        var corpoSemHora = CorpoDeDespesa(contaId, Iso(novoDia), hora: null);
        corpoSemHora["categoriaId"] = categoriaId;
        var resp2 = await client.SendAsync(Req(HttpMethod.Put, $"/api/v1/transacoes/{id}", csrf, corpoSemHora));

        Assert.Equal(HttpStatusCode.OK, resp2.StatusCode);
        var apos2 = NoBanco(id)!;
        Assert.Equal(novoDia, apos2.Data);
        Assert.Null(apos2.Hora);
    }

    // ------------------------------------------------------------------ GET — filtros from/to e ordem

    [Fact]
    public async Task Listar_FiltraPorIntervaloDeDatas_FromInclusivo_ToExclusivo()
    {
        const string email = "transacoes-filtro-data@test.com";
        var usuarioId = SeedUsuario(email);
        var contaId = SeedConta(usuarioId);
        var d1 = Hoje.AddDays(-20);
        var d2 = Hoje.AddDays(-10);
        var d3 = Hoje.AddDays(-5);
        var id1 = SeedTransacao(usuarioId, contaId, d1, new TimeOnly(9, 0));
        var id2 = SeedTransacao(usuarioId, contaId, d2, new TimeOnly(23, 59));
        var id3 = SeedTransacao(usuarioId, contaId, d3, hora: null);
        var (client, _) = await LoginClientAsync(email);

        // [d2, d3): d2 entra (from inclusivo, mesmo às 23:59), d3 NÃO entra (to exclusivo), d1 fica de fora.
        var pagina = await client.GetFromJsonAsync<JsonElement>($"/api/v1/transacoes?from={Iso(d2)}&to={Iso(d3)}");
        Assert.Equal([id2], IdsDaPagina(pagina));
        Assert.Equal(1, pagina.GetProperty("total").GetInt32());

        // Só from: d2 e d3. Só to: d1 e d2 (to é exclusivo, então d3 sai).
        var apenasFrom = await client.GetFromJsonAsync<JsonElement>($"/api/v1/transacoes?from={Iso(d2)}");
        Assert.Equal(new[] { id2, id3 }.OrderBy(x => x), IdsDaPagina(apenasFrom).OrderBy(x => x));
        var apenasTo = await client.GetFromJsonAsync<JsonElement>($"/api/v1/transacoes?to={Iso(d3)}");
        Assert.Equal(new[] { id1, id2 }.OrderBy(x => x), IdsDaPagina(apenasTo).OrderBy(x => x));
    }

    [Fact]
    public async Task Stats_FiltraPorIntervaloDeDatas()
    {
        const string email = "transacoes-stats-data@test.com";
        var usuarioId = SeedUsuario(email);
        var contaId = SeedConta(usuarioId);
        var d1 = Hoje.AddDays(-20);
        var d2 = Hoje.AddDays(-10);
        var d3 = Hoje.AddDays(-5);
        SeedTransacao(usuarioId, contaId, d1, new TimeOnly(9, 0), valor: 100m, tipo: TipoTransacao.Despesa);
        SeedTransacao(usuarioId, contaId, d2, new TimeOnly(23, 59), valor: 30m, tipo: TipoTransacao.Despesa);
        SeedTransacao(usuarioId, contaId, d2, hora: null, valor: 500m, tipo: TipoTransacao.Receita);
        SeedTransacao(usuarioId, contaId, d3, hora: null, valor: 7m, tipo: TipoTransacao.Despesa);
        var (client, _) = await LoginClientAsync(email);

        var stats = await client.GetFromJsonAsync<JsonElement>($"/api/v1/transacoes/stats?from={Iso(d2)}&to={Iso(d3)}");

        Assert.Equal(2, stats.GetProperty("qtdTransacoes").GetInt32()); // só as duas de d2
        Assert.Equal(500m, stats.GetProperty("entradas").GetDecimal());
        Assert.Equal(30m, stats.GetProperty("saidas").GetDecimal());
    }

    [Fact]
    public async Task Listar_OrdenaPorDiaEHora_MaisRecentePrimeiro_EAscendenteInverte()
    {
        const string email = "transacoes-ordem-hora@test.com";
        var usuarioId = SeedUsuario(email);
        var contaId = SeedConta(usuarioId);
        var dia = Hoje.AddDays(-6);
        // Mesmo dia, horas diferentes (inseridas fora de ordem) + um lançamento de véspera às 23:00.
        var cedo = SeedTransacao(usuarioId, contaId, dia, new TimeOnly(8, 0));
        var tarde = SeedTransacao(usuarioId, contaId, dia, new TimeOnly(18, 30));
        var vespera = SeedTransacao(usuarioId, contaId, dia.AddDays(-1), new TimeOnly(23, 0));
        var (client, _) = await LoginClientAsync(email);

        var desc = await client.GetFromJsonAsync<JsonElement>("/api/v1/transacoes");
        Assert.Equal([tarde, cedo, vespera], IdsDaPagina(desc)); // dia desc; no mesmo dia, hora desc

        var asc = await client.GetFromJsonAsync<JsonElement>("/api/v1/transacoes?ordenacao=data_asc");
        Assert.Equal([vespera, cedo, tarde], IdsDaPagina(asc));
    }

    // ------------------------------------------------------------------ 400

    [Fact]
    public async Task Criar_DataFuturaEmLancamentoEfetivado_Retorna400_ENaoGrava()
    {
        const string email = "transacoes-data-futura@test.com";
        var usuarioId = SeedUsuario(email);
        var contaId = SeedConta(usuarioId);
        var (client, csrf) = await LoginClientAsync(email);

        var resp = await client.SendAsync(Req(HttpMethod.Post, "/api/v1/transacoes", csrf,
            CorpoDeDespesa(contaId, Iso(Hoje.AddDays(3)), "10:00:00")));

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var corpo = await resp.Content.ReadAsStringAsync();
        Assert.Contains("\"code\":\"VALIDATION_ERROR\"", corpo);
        Assert.Contains("futura", corpo);
        Assert.Equal(0, TransacoesDaConta(contaId));
    }

    [Theory]
    [InlineData("data", "28/09/2026")]   // formato BR — o contrato é yyyy-MM-dd
    [InlineData("data", "2026-02-30")]   // dia que não existe
    [InlineData("hora", "25:61:00")]     // hora fora da faixa
    [InlineData("hora", "abc")]
    public async Task Criar_DataOuHoraInvalida_Retorna400_ENaoGrava(string campo, string valorInvalido)
    {
        var email = $"transacoes-formato-{campo}-{Math.Abs(valorInvalido.GetHashCode())}@test.com";
        var usuarioId = SeedUsuario(email);
        var contaId = SeedConta(usuarioId);
        var (client, csrf) = await LoginClientAsync(email);
        var corpo = CorpoDeDespesa(contaId, Iso(Hoje.AddDays(-2)), "10:00:00");
        corpo[campo] = valorInvalido;

        var resp = await client.SendAsync(Req(HttpMethod.Post, "/api/v1/transacoes", csrf, corpo));

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Equal(0, TransacoesDaConta(contaId));
    }

    // ------------------------------------------------------------------ 401

    [Fact]
    public async Task Criar_Anonimo_Retorna401_ENaoGrava()
    {
        // Sem login a FallbackPolicy barra antes do controller. Cookie + header de CSRF coerentes pra o 401
        // vir da autorização (e não do CsrfValidationMiddleware), como em ContasHttpTests.
        const string email = "transacoes-anonimo@test.com";
        var usuarioId = SeedUsuario(email);
        var contaId = SeedConta(usuarioId);
        var client = _factory.CreateClient();
        const string csrf = "csrf-anonimo-transacoes";
        var req = Req(HttpMethod.Post, "/api/v1/transacoes", csrf,
            CorpoDeDespesa(contaId, Iso(Hoje.AddDays(-1)), "10:00:00"));
        req.Headers.Add("Cookie", $"X-CSRF-Token={csrf}");

        var resp = await client.SendAsync(req);

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
        Assert.Equal(0, TransacoesDaConta(contaId));
    }

    [Fact]
    public async Task Listar_Anonimo_Retorna401()
    {
        var resp = await _factory.CreateClient().GetAsync("/api/v1/transacoes");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    // ------------------------------------------------------------------ 404 (IDOR)

    [Fact]
    public async Task Criar_EmContaDeOutroUsuario_Retorna404_ENaoGrava()
    {
        // IDOR: o atacante conhece o id da conta de outro usuário. 404 (não confirma que o id existe).
        var donoId = SeedUsuario("transacoes-idor-criar-dono@test.com");
        var contaDoDono = SeedConta(donoId);
        const string emailAtacante = "transacoes-idor-criar-atacante@test.com";
        SeedUsuario(emailAtacante);
        var (client, csrf) = await LoginClientAsync(emailAtacante);

        var resp = await client.SendAsync(Req(HttpMethod.Post, "/api/v1/transacoes", csrf,
            CorpoDeDespesa(contaDoDono, Iso(Hoje.AddDays(-1)), "10:00:00")));

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
        Assert.Equal(0, TransacoesDaConta(contaDoDono));
    }

    [Fact]
    public async Task TransacaoDeOutroUsuario_BuscarAtualizarDeletar_Retornam404_ENadaMuda()
    {
        var donoId = SeedUsuario("transacoes-idor-dono@test.com");
        var contaDoDono = SeedConta(donoId);
        var diaOriginal = Hoje.AddDays(-5);
        var horaOriginal = new TimeOnly(14, 20);
        var idDoDono = SeedTransacao(donoId, contaDoDono, diaOriginal, horaOriginal, valor: 80m);
        var categoriaId = SeedCategoriaDespesa();
        const string emailAtacante = "transacoes-idor-atacante@test.com";
        SeedUsuario(emailAtacante);
        var (client, csrf) = await LoginClientAsync(emailAtacante);

        var buscar = await client.GetAsync($"/api/v1/transacoes/{idDoDono}");
        var corpoPut = CorpoDeDespesa(contaDoDono, Iso(Hoje.AddDays(-1)), "01:00:00");
        corpoPut["categoriaId"] = categoriaId;
        var atualizar = await client.SendAsync(Req(HttpMethod.Put, $"/api/v1/transacoes/{idDoDono}", csrf, corpoPut));
        var deletar = await client.SendAsync(Req(HttpMethod.Delete, $"/api/v1/transacoes/{idDoDono}", csrf));

        Assert.Equal(HttpStatusCode.NotFound, buscar.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, atualizar.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, deletar.StatusCode);
        // Nada mudou: nem dia/hora, nem valor, nem foi cancelada.
        var intacta = NoBanco(idDoDono)!;
        Assert.Equal(diaOriginal, intacta.Data);
        Assert.Equal(horaOriginal, intacta.Hora);
        Assert.Equal(80m, intacta.Valor);
        Assert.True(intacta.Ativo);
    }

    // ------------------------------------------------------------------ conta + cartão (Fase 0)
    // Antes, com conta E cartão no corpo só a conta era conferida: o lançamento era gravado ligado ao
    // cartão de outro usuário e aparecia na lista do dono do cartão.

    private Guid SeedCartao(Guid usuarioId)
    {
        using var scope = _factory.CreateScopeComBanco();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = "Cartão", CriadoPor = usuarioId, Ativo = true, TemCredito = true,
            LimiteTotal = 5000m, DiaFechamento = 10, DiaVencimento = 20,
        };
        ctx.CartoesCredito.Add(cartao);
        ctx.SaveChanges();
        return cartao.Id;
    }

    private int TransacoesDoCartao(Guid cartaoId)
    {
        using var scope = _factory.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return ctx.Transacoes.IgnoreQueryFilters().Count(t => t.CartaoCreditoId == cartaoId);
    }

    [Fact]
    public async Task Criar_ComMinhaContaECartaoDeOutroUsuario_Retorna400_ENadaApareceProDonoDoCartao()
    {
        const string emailDono = "transacoes-cartao-dono@test.com";
        var donoId = SeedUsuario(emailDono);
        var cartaoDoDono = SeedCartao(donoId);
        const string emailAtacante = "transacoes-cartao-atacante@test.com";
        var atacanteId = SeedUsuario(emailAtacante);
        var contaDoAtacante = SeedConta(atacanteId);
        var (client, csrf) = await LoginClientAsync(emailAtacante);

        var corpo = CorpoDeDespesa(contaDoAtacante, Iso(Hoje.AddDays(-1)), "10:00:00");
        corpo["cartaoCreditoId"] = cartaoDoDono;
        corpo["usadoComoCredito"] = false;
        var resp = await client.SendAsync(Req(HttpMethod.Post, "/api/v1/transacoes", csrf, corpo));

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Equal(0, TransacoesDoCartao(cartaoDoDono));
        Assert.Equal(0, TransacoesDaConta(contaDoAtacante));
        // O dono do cartão não vê nada na lista dele.
        var (clientDono, _) = await LoginClientAsync(emailDono);
        var lista = await clientDono.GetFromJsonAsync<JsonElement>("/api/v1/transacoes");
        Assert.Empty(IdsDaPagina(lista));
    }

    [Fact]
    public async Task Criar_ComContaECartaoDoProprioUsuario_Retorna400()
    {
        // Lançamento é de uma conta OU de um cartão, mesmo sendo os dois do próprio usuário.
        const string email = "transacoes-conta-e-cartao@test.com";
        var usuarioId = SeedUsuario(email);
        var contaId = SeedConta(usuarioId);
        var cartaoId = SeedCartao(usuarioId);
        var (client, csrf) = await LoginClientAsync(email);

        var corpo = CorpoDeDespesa(contaId, Iso(Hoje.AddDays(-1)), "10:00:00");
        corpo["cartaoCreditoId"] = cartaoId;
        corpo["usadoComoCredito"] = true;
        var resp = await client.SendAsync(Req(HttpMethod.Post, "/api/v1/transacoes", csrf, corpo));

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Equal(0, TransacoesDaConta(contaId));
        Assert.Equal(0, TransacoesDoCartao(cartaoId));
    }

    [Fact]
    public async Task Criar_SoNoCartaoDeOutroUsuario_Retorna404_ENaoGrava()
    {
        var donoId = SeedUsuario("transacoes-so-cartao-dono@test.com");
        var cartaoDoDono = SeedCartao(donoId);
        const string emailAtacante = "transacoes-so-cartao-atacante@test.com";
        SeedUsuario(emailAtacante);
        var (client, csrf) = await LoginClientAsync(emailAtacante);

        var resp = await client.SendAsync(Req(HttpMethod.Post, "/api/v1/transacoes", csrf, new Dictionary<string, object?>
        {
            ["descricao"] = "Mercado", ["valor"] = 42.5m, ["tipo"] = (int)TipoTransacao.Despesa,
            ["cartaoCreditoId"] = cartaoDoDono, ["usadoComoCredito"] = true, ["data"] = Iso(Hoje.AddDays(-1)),
        }));

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
        Assert.Equal(0, TransacoesDoCartao(cartaoDoDono));
    }

    [Fact]
    public async Task Criar_CreditoEmContaSemCartao_Retorna400_ENaoGrava()
    {
        // Em conta, "crédito" tirava o lançamento do Entrou/Saiu sem ele estar em fatura nenhuma.
        const string email = "transacoes-credito-em-conta@test.com";
        var usuarioId = SeedUsuario(email);
        var contaId = SeedConta(usuarioId);
        var (client, csrf) = await LoginClientAsync(email);

        var corpo = CorpoDeDespesa(contaId, Iso(Hoje.AddDays(-1)), "10:00:00");
        corpo["usadoComoCredito"] = true;
        var resp = await client.SendAsync(Req(HttpMethod.Post, "/api/v1/transacoes", csrf, corpo));

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Equal(0, TransacoesDaConta(contaId));
    }
}

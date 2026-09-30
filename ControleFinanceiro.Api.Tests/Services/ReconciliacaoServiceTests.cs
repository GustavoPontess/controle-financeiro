using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Reconciliacao;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Reconciliação (marco de saldo): saldo calculado até uma data+hora, criação de marco (baseline /
/// verificação) com lançamento de ajuste, idempotência, listagem e remoção. Dinheiro + IDOR: cada
/// operação tem teste de isolamento por usuário.
/// </summary>
public class ReconciliacaoServiceTests
{
    // Ponto de referência fixo — nada depende do "agora" nem do dia da semana.
    private static readonly DateTime T0 = new(2026, 9, 1, 12, 0, 0);

    private const int Baseline = (int)TipoMarcoReconciliacao.Baseline;
    private const int Verificacao = (int)TipoMarcoReconciliacao.Verificacao;

    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    /// <summary>
    /// Contexto sobre um banco InMemory NOMEADO e compartilhável (mesmo root) — pra simular duas
    /// requisições em conexões diferentes batendo no mesmo banco (testes de corrida).
    /// </summary>
    private static AppDbContext CreateContext(InMemoryDatabaseRoot root, string nome, IInterceptor? interceptor = null)
    {
        var builder = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(nome, root)
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning));
        if (interceptor != null)
            builder.AddInterceptors(interceptor);
        return new AppDbContext(builder.Options);
    }

    /// <summary>
    /// Simula a corrida que o InMemory não reproduz sozinho (não tem índice único): no SaveChanges do
    /// marco (o que grava o <see cref="RegistroIdempotencia"/>), roda antes a requisição "gêmea" (em outro
    /// contexto, que termina primeiro) e aí lança a exceção que o Postgres daria pra requisição perdedora.
    /// </summary>
    private sealed class SimulaCorridaNoMarco : SaveChangesInterceptor
    {
        public Func<Task<Exception>>? Concorrente { get; set; }

        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            var gravaChave = eventData.Context!.ChangeTracker.Entries<RegistroIdempotencia>()
                .Any(e => e.State == EntityState.Added);
            if (gravaChave && Concorrente != null)
            {
                var disparar = Concorrente;
                Concorrente = null; // só a 1ª tentativa perde a corrida
                throw await disparar();
            }
            return result;
        }
    }

    /// <summary>Violação de índice único do Postgres (23505) embrulhada como o EF a entrega.</summary>
    private static DbUpdateException ViolacaoDeUnicidade() =>
        new("duplicate key",
            new PostgresException("duplicate key value violates unique constraint", "ERROR", "ERROR",
                PostgresErrorCodes.UniqueViolation));

    private static ReconciliacaoService CriarService(AppDbContext ctx) =>
        new(ctx, TestHelpers.EventLog(ctx));

    private static Conta NovaConta(AppDbContext ctx, Guid usuarioId, string nome = "Conta Corrente")
    {
        var conta = new Conta
        {
            Id = Guid.NewGuid(),
            Nome = nome,
            Tipo = TipoConta.ContaCorrente,
            UsuarioIdProprietario = usuarioId,
        };
        ctx.Contas.Add(conta);
        ctx.SaveChanges();
        return conta;
    }

    private static (AppDbContext ctx, ReconciliacaoService service, Guid usuarioId, Conta conta) Seed()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        return (ctx, CriarService(ctx), usuarioId, conta);
    }

    private static async Task<Transacao> AddTransacao(
        AppDbContext ctx, Guid contaId, TipoTransacao tipo, decimal valor, DateTime data,
        StatusTransacao status = StatusTransacao.Executado, bool ativo = true)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(),
            Descricao = "Lançamento de teste",
            Valor = valor,
            Tipo = tipo,
            ContaId = contaId,
            Data = data,
            StatusTransacao = status,
            Ativo = ativo,
        };
        ctx.Transacoes.Add(t);
        await ctx.SaveChangesAsync();
        return t;
    }

    /// <summary>Lançamento de saldo inicial como o <c>ContaService.CriarAsync</c> grava (Receita, EhSaldoInicial).</summary>
    private static async Task<Transacao> AddSaldoInicial(
        AppDbContext ctx, Guid contaId, decimal valor, DateTime data, bool ativo = true)
    {
        var t = await AddTransacao(ctx, contaId, TipoTransacao.Receita, valor, data, ativo: ativo);
        t.Descricao = "Saldo Inicial";
        t.EhSaldoInicial = true;
        await ctx.SaveChangesAsync();
        return t;
    }

    private static CriarMarcoReconciliacaoDto Dto(
        Guid contaId, decimal declarado, int tipo = Verificacao, DateTime? dataHora = null,
        string? resolucao = null, string? observacao = null) => new()
    {
        ContaId = contaId,
        DataHora = dataHora ?? T0,
        SaldoDeclarado = declarado,
        Tipo = tipo,
        Resolucao = resolucao,
        Observacao = observacao,
    };

    private static ReconciliacaoSaldo NovoMarco(
        Guid usuarioId, Guid contaId, DateTime dataHora, bool ativo = true, DateTime? criadoEm = null) => new()
    {
        Id = Guid.NewGuid(),
        ContaId = contaId,
        UsuarioId = usuarioId,
        DataHora = dataHora,
        SaldoDeclarado = 100m,
        SaldoCalculado = 100m,
        Diferenca = 0m,
        Tipo = TipoMarcoReconciliacao.Verificacao,
        CriadoEm = criadoEm ?? DateTime.UtcNow,
        Ativo = ativo,
    };

    /// <summary>Idempotency-Key nova (o front gera um UUID por tentativa).</summary>
    private static string Chave() => Guid.NewGuid().ToString();

    /// <summary>Lançamentos de ajuste no banco. IgnoreQueryFilters: o filtro global de Transacao
    /// esconde as canceladas, e aqui queremos ver também as linhas canceladas.</summary>
    private static Task<List<Transacao>> Ajustes(AppDbContext ctx) =>
        ctx.Transacoes.IgnoreQueryFilters().Where(t => t.EhAjusteReconciliacao).ToListAsync();

    /// <summary>Ids dos eventos financeiros já gravados — pra isolar depois só os eventos de uma operação.</summary>
    private static async Task<HashSet<Guid>> IdsDeEventos(AppDbContext ctx) =>
        (await ctx.FinancialEventLogs.AsNoTracking().Select(l => l.Id).ToListAsync()).ToHashSet();

    /// <summary>Eventos gravados DEPOIS do snapshot <paramref name="idsAntes"/>.</summary>
    private static async Task<List<FinancialEventLog>> EventosNovos(AppDbContext ctx, HashSet<Guid> idsAntes) =>
        (await ctx.FinancialEventLogs.AsNoTracking().ToListAsync()).Where(l => !idsAntes.Contains(l.Id)).ToList();

    // ── CalcularSaldoAteAsync ────────────────────────────────────────────────

    [Fact]
    public async Task CalcularSaldoAte_SomaReceitasMenosDespesas()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 1000m, T0.AddDays(-3));
        await AddTransacao(ctx, conta.Id, TipoTransacao.Despesa, 300m, T0.AddDays(-2));
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 50.25m, T0.AddDays(-1));

        var saldo = await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0);

        Assert.Equal(750.25m, saldo);
    }

    [Fact]
    public async Task CalcularSaldoAte_ContaSemTransacoes_RetornaZero()
    {
        var (_, service, usuarioId, conta) = Seed();

        var saldo = await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0);

        Assert.Equal(0m, saldo);
    }

    [Fact]
    public async Task CalcularSaldoAte_SoDespesas_RetornaNegativo()
    {
        // Conta no cheque especial: saldo negativo é legítimo e não pode virar zero/erro.
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Despesa, 80m, T0.AddDays(-1));

        var saldo = await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0);

        Assert.Equal(-80m, saldo);
    }

    [Fact]
    public async Task CalcularSaldoAte_IgnoraPrevisao()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 500m, T0.AddDays(-1));
        await AddTransacao(ctx, conta.Id, TipoTransacao.Despesa, 200m, T0.AddDays(-1), StatusTransacao.Previsao);

        var saldo = await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0);

        Assert.Equal(500m, saldo);
    }

    [Fact]
    public async Task CalcularSaldoAte_IgnoraCanceladaPorSoftDeleteEPorStatus()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 500m, T0.AddDays(-1));
        await AddTransacao(ctx, conta.Id, TipoTransacao.Despesa, 200m, T0.AddDays(-1), ativo: false);
        await AddTransacao(ctx, conta.Id, TipoTransacao.Despesa, 100m, T0.AddDays(-1), StatusTransacao.Cancelado);

        var saldo = await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0);

        Assert.Equal(500m, saldo);
    }

    [Fact]
    public async Task CalcularSaldoAte_IgnoraTransacaoPosteriorADataHora()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 500m, T0.AddDays(-1));
        await AddTransacao(ctx, conta.Id, TipoTransacao.Despesa, 200m, T0.AddMinutes(1));

        var saldo = await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0);

        Assert.Equal(500m, saldo);
    }

    [Fact]
    public async Task CalcularSaldoAte_LimiteEInclusivo_TransacaoExatamenteNaDataHoraEntra()
    {
        // O ajuste de um marco nasce com Data == DataHora do marco: se o limite fosse exclusivo,
        // o saldo nunca bateria com o declarado.
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 500m, T0);

        var saldo = await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0);

        Assert.Equal(500m, saldo);
    }

    [Fact]
    public async Task CalcularSaldoAte_IgnoraTransacaoDeOutraConta()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var outraConta = NovaConta(ctx, usuarioId, "Poupança");
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 500m, T0.AddDays(-1));
        await AddTransacao(ctx, outraConta.Id, TipoTransacao.Receita, 9000m, T0.AddDays(-1));

        var saldo = await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0);

        Assert.Equal(500m, saldo);
    }

    [Fact]
    public async Task CalcularSaldoAte_IncluiAjusteAnterior()
    {
        // O ajuste corrige o saldo — precisa contar na soma (senão um 2º marco reajustaria a mesma diferença).
        var (ctx, service, usuarioId, conta) = Seed();
        var ajuste = await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 120m, T0.AddDays(-1));
        ajuste.EhAjusteReconciliacao = true;
        await ctx.SaveChangesAsync();

        var saldo = await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0);

        Assert.Equal(120m, saldo);
    }

    [Fact]
    public async Task CalcularSaldoAte_ContaDeOutroUsuario_LancaKeyNotFoundException()
    {
        var (ctx, service, _, contaVitima) = Seed();
        await AddTransacao(ctx, contaVitima.Id, TipoTransacao.Receita, 500m, T0.AddDays(-1));

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.CalcularSaldoAteAsync(Guid.NewGuid(), contaVitima.Id, T0));
    }

    [Fact]
    public async Task CalcularSaldoAte_ContaInexistente_LancaKeyNotFoundException()
    {
        var (_, service, usuarioId, _) = Seed();

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.CalcularSaldoAteAsync(usuarioId, Guid.NewGuid(), T0));
    }

    // ── CriarMarcoAsync — baseline ───────────────────────────────────────────

    [Fact]
    public async Task CriarMarco_BaselineDeclaradoMaior_CriaAjusteReceita_ESaldoPassaABater()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 1000m, T0.AddDays(-2));
        await AddTransacao(ctx, conta.Id, TipoTransacao.Despesa, 300m, T0.AddDays(-1)); // calculado = 700

        var dto = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 1000m, Baseline), Chave());

        // Falta dinheiro no app (declarado > calculado) → ajuste entra como Receita da diferença.
        var ajuste = Assert.Single(await Ajustes(ctx));
        Assert.True(ajuste.EhAjusteReconciliacao);
        Assert.Equal(300m, ajuste.Valor);
        Assert.Equal(TipoTransacao.Receita, ajuste.Tipo);
        Assert.Equal(conta.Id, ajuste.ContaId);
        Assert.Equal(StatusTransacao.Executado, ajuste.StatusTransacao);
        Assert.True(ajuste.Ativo);
        Assert.Equal(T0, ajuste.Data);
        Assert.Equal(usuarioId, ajuste.CriadoPor);
        Assert.Null(ajuste.CategoriaId);

        var marco = await ctx.ReconciliacoesSaldo.AsNoTracking().SingleAsync();
        Assert.Equal(dto.Id, marco.Id);
        Assert.Equal(TipoMarcoReconciliacao.Baseline, marco.Tipo);
        Assert.Equal(1000m, marco.SaldoDeclarado);
        Assert.Equal(700m, marco.SaldoCalculado);
        Assert.Equal(300m, marco.Diferenca);
        Assert.Equal(ajuste.Id, marco.AjusteTransacaoId);
        Assert.True(marco.Ativo);

        Assert.Equal(300m, dto.Diferenca);
        Assert.Equal(700m, dto.SaldoCalculado);
        Assert.True(dto.TemAjuste);
        Assert.Equal(Baseline, dto.Tipo);

        // O objetivo de tudo: o saldo calculado agora bate com o declarado.
        Assert.Equal(1000m, await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0));
    }

    [Fact]
    public async Task CriarMarco_BaselineDeclaradoMenor_CriaAjusteDespesa_ESaldoPassaABater()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 700m, T0.AddDays(-1)); // calculado = 700

        var dto = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 500m, Baseline), Chave());

        // Sobra dinheiro no app (declarado < calculado) → ajuste entra como Despesa do módulo da diferença.
        var ajuste = Assert.Single(await Ajustes(ctx));
        Assert.Equal(200m, ajuste.Valor);
        Assert.Equal(TipoTransacao.Despesa, ajuste.Tipo);
        Assert.Equal(-200m, dto.Diferenca);
        Assert.True(dto.TemAjuste);
        Assert.Equal(500m, await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0));
    }

    [Fact]
    public async Task CriarMarco_BaselineEmContaVazia_SaldoInicialDeclaradoViraAjusteReceita()
    {
        // Caso mais comum do 1º marco: conta nova, usuário diz "tenho 1.234,56 aí".
        var (ctx, service, usuarioId, conta) = Seed();

        var dto = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 1234.56m, Baseline), Chave());

        var ajuste = Assert.Single(await Ajustes(ctx));
        Assert.Equal(1234.56m, ajuste.Valor);
        Assert.Equal(TipoTransacao.Receita, ajuste.Tipo);
        Assert.Equal(0m, dto.SaldoCalculado);
        Assert.Equal(1234.56m, await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0));
    }

    [Fact]
    public async Task CriarMarco_BaselineDeclaradoNegativo_CriaAjusteDespesa()
    {
        // Saldo real negativo (cheque especial) é um valor declarado válido.
        var (ctx, service, usuarioId, conta) = Seed();

        await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, -50m, Baseline), Chave());

        var ajuste = Assert.Single(await Ajustes(ctx));
        Assert.Equal(50m, ajuste.Valor); // Valor do lançamento nunca é negativo
        Assert.Equal(TipoTransacao.Despesa, ajuste.Tipo);
        Assert.Equal(-50m, await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0));
    }

    [Fact]
    public async Task CriarMarco_ConsideraSoOQueCompoeSaldoAteADataDoMarco()
    {
        // Previsão, cancelada e lançamento posterior à data do marco não entram no "calculado".
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 1000m, T0.AddDays(-1));
        await AddTransacao(ctx, conta.Id, TipoTransacao.Despesa, 400m, T0.AddDays(-1), StatusTransacao.Previsao);
        await AddTransacao(ctx, conta.Id, TipoTransacao.Despesa, 300m, T0.AddDays(-1), ativo: false);
        await AddTransacao(ctx, conta.Id, TipoTransacao.Despesa, 200m, T0.AddDays(1));

        var dto = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 1000m, Baseline), Chave());

        Assert.Equal(1000m, dto.SaldoCalculado);
        Assert.Equal(0m, dto.Diferenca);
        Assert.False(dto.TemAjuste);
        Assert.Empty(await Ajustes(ctx));
    }

    [Fact]
    public async Task CriarMarco_SegundoMarcoCalculaSobreOAjusteDoPrimeiro_NaoReajustaADiferencaAntiga()
    {
        var (ctx, service, usuarioId, conta) = Seed();

        // Baseline: conta vazia, declara 1000 → ajuste de +1000 em T0.
        await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 1000m, Baseline, T0), Chave());
        // Depois disso a pessoa gasta 100 (lançamento normal).
        await AddTransacao(ctx, conta.Id, TipoTransacao.Despesa, 100m, T0.AddDays(1));

        // Verificação uma semana depois: extrato diz 850; o app calcula 1000 - 100 = 900.
        var dto = await service.CriarMarcoAsync(
            usuarioId, Dto(conta.Id, 850m, Verificacao, T0.AddDays(7), resolucao: "ajustar"), Chave());

        Assert.Equal(900m, dto.SaldoCalculado);
        Assert.Equal(-50m, dto.Diferenca);
        var ajustes = await Ajustes(ctx);
        Assert.Equal(2, ajustes.Count);
        Assert.Contains(ajustes, a => a.Tipo == TipoTransacao.Despesa && a.Valor == 50m);
        Assert.Equal(850m, await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0.AddDays(7)));
    }

    // ── CriarMarcoAsync — verificação ────────────────────────────────────────

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("manual")]
    public async Task CriarMarco_VerificacaoComDiferencaSemResolucaoAjustar_NaoCriaAjuste_MasRegistraADiferenca(string? resolucao)
    {
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 700m, T0.AddDays(-1));

        var dto = await service.CriarMarcoAsync(
            usuarioId, Dto(conta.Id, 1000m, Verificacao, resolucao: resolucao), Chave());

        Assert.Empty(await Ajustes(ctx));
        Assert.False(dto.TemAjuste);
        var marco = await ctx.ReconciliacoesSaldo.AsNoTracking().SingleAsync();
        Assert.Null(marco.AjusteTransacaoId);
        Assert.Equal(TipoMarcoReconciliacao.Verificacao, marco.Tipo);
        Assert.Equal(700m, marco.SaldoCalculado);
        Assert.Equal(300m, marco.Diferenca); // a diferença fica registrada mesmo sem ajuste
        // O saldo NÃO foi tocado: quem resolve é o usuário, lançando o que faltou.
        Assert.Equal(700m, await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0));
    }

    [Fact]
    public async Task CriarMarco_VerificacaoComResolucaoAjustar_CriaAjusteIgualAoBaseline()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 700m, T0.AddDays(-1));

        var dto = await service.CriarMarcoAsync(
            usuarioId, Dto(conta.Id, 1000m, Verificacao, resolucao: "ajustar"), Chave());

        var ajuste = Assert.Single(await Ajustes(ctx));
        Assert.Equal(300m, ajuste.Valor);
        Assert.Equal(TipoTransacao.Receita, ajuste.Tipo);
        Assert.True(ajuste.EhAjusteReconciliacao);
        Assert.Equal(StatusTransacao.Executado, ajuste.StatusTransacao);
        Assert.True(dto.TemAjuste);
        var marco = await ctx.ReconciliacoesSaldo.AsNoTracking().SingleAsync();
        Assert.Equal(ajuste.Id, marco.AjusteTransacaoId);
        Assert.Equal(1000m, await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0));
    }

    [Fact]
    public async Task CriarMarco_VerificacaoComResolucaoAjustar_DeclaradoMenor_CriaAjusteDespesa()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 700m, T0.AddDays(-1));

        await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 650m, Verificacao, resolucao: "ajustar"), Chave());

        var ajuste = Assert.Single(await Ajustes(ctx));
        Assert.Equal(50m, ajuste.Valor);
        Assert.Equal(TipoTransacao.Despesa, ajuste.Tipo);
        Assert.Equal(650m, await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0));
    }

    // ── CriarMarcoAsync — diferença zero ─────────────────────────────────────

    [Theory]
    [InlineData(Baseline, null)]
    [InlineData(Verificacao, null)]
    [InlineData(Verificacao, "ajustar")]
    public async Task CriarMarco_DiferencaZero_NaoCriaAjuste(int tipo, string? resolucao)
    {
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 700m, T0.AddDays(-1));

        var dto = await service.CriarMarcoAsync(
            usuarioId, Dto(conta.Id, 700m, tipo, resolucao: resolucao), Chave());

        Assert.Empty(await Ajustes(ctx));
        Assert.Equal(0m, dto.Diferenca);
        Assert.False(dto.TemAjuste);
        var marco = await ctx.ReconciliacoesSaldo.AsNoTracking().SingleAsync();
        Assert.Null(marco.AjusteTransacaoId);
        Assert.Equal(0m, marco.Diferenca);
        // O marco (a trilha de "conferi e bateu") existe mesmo sem ajuste.
        Assert.Equal(700m, marco.SaldoDeclarado);
        Assert.Equal(700m, marco.SaldoCalculado);
    }

    // ── CriarMarcoAsync — campos do marco ────────────────────────────────────

    [Fact]
    public async Task CriarMarco_GravaDonoDataETrimaObservacao()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var dataHora = new DateTime(2026, 8, 15, 9, 30, 0);

        var dto = await service.CriarMarcoAsync(
            usuarioId, Dto(conta.Id, 0m, Verificacao, dataHora, observacao: "  conferido no app do banco  "), Chave());

        var marco = await ctx.ReconciliacoesSaldo.AsNoTracking().SingleAsync();
        Assert.Equal(usuarioId, marco.UsuarioId);
        Assert.Equal(conta.Id, marco.ContaId);
        Assert.Equal(dataHora, marco.DataHora);
        Assert.Equal("conferido no app do banco", marco.Observacao);
        Assert.Equal("conferido no app do banco", dto.Observacao);
        Assert.Equal(dataHora, dto.DataHora);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task CriarMarco_ObservacaoVaziaOuSoEspacos_GravaNull(string? observacao)
    {
        var (ctx, service, usuarioId, conta) = Seed();

        await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 0m, observacao: observacao), Chave());

        Assert.Null((await ctx.ReconciliacoesSaldo.AsNoTracking().SingleAsync()).Observacao);
    }

    // ── CriarMarcoAsync — auditoria ──────────────────────────────────────────

    [Fact]
    public async Task CriarMarco_ComAjuste_RegistraEventoDoAjusteEDoMarcoNoMesmoCorrelationId()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 700m, T0.AddDays(-1));

        var dto = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 1000m, Baseline), Chave());

        var ajuste = Assert.Single(await Ajustes(ctx));
        var logs = await ctx.FinancialEventLogs.AsNoTracking().ToListAsync();
        var logAjuste = Assert.Single(logs, l => l.Tipo == FinancialEventType.TransacaoCriada);
        var logMarco = Assert.Single(logs, l => l.Tipo == FinancialEventType.ReconciliacaoRegistrada);
        Assert.Equal("Transacao", logAjuste.EntidadeAfetada);
        Assert.Equal(ajuste.Id, logAjuste.EntidadeId);
        Assert.Equal(700m, logAjuste.ValorAntes);
        Assert.Equal(1000m, logAjuste.ValorDepois);
        Assert.Equal("ReconciliacaoSaldo", logMarco.EntidadeAfetada);
        Assert.Equal(dto.Id, logMarco.EntidadeId);
        Assert.Equal(usuarioId, logMarco.CriadoPor);
        Assert.Equal(logAjuste.CorrelationId, logMarco.CorrelationId);
    }

    [Fact]
    public async Task CriarMarco_SemAjuste_RegistraSoOEventoDoMarco()
    {
        var (ctx, service, usuarioId, conta) = Seed();

        await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 0m), Chave());

        var log = Assert.Single(await ctx.FinancialEventLogs.AsNoTracking().ToListAsync());
        Assert.Equal(FinancialEventType.ReconciliacaoRegistrada, log.Tipo);
    }

    // ── CriarMarcoAsync — idempotência ───────────────────────────────────────

    [Fact]
    public async Task CriarMarco_MesmaChaveDuasVezes_CriaUmMarcoEUmAjusteSo_ReplayDevolveOMesmo()
    {
        // O bug evitado: duplo clique / retry de rede criava 2 marcos e 2 ajustes (saldo dobrado).
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 700m, T0.AddDays(-1));
        var chave = Chave();
        var dto = Dto(conta.Id, 1000m, Baseline);

        var primeiro = await service.CriarMarcoAsync(usuarioId, dto, chave);
        var segundo = await service.CriarMarcoAsync(usuarioId, dto, chave);

        Assert.Equal(primeiro.Id, segundo.Id); // replay devolve o MESMO marco
        Assert.Equal(primeiro.Diferenca, segundo.Diferenca);
        Assert.Equal(primeiro.TemAjuste, segundo.TemAjuste);
        Assert.Single(await ctx.ReconciliacoesSaldo.ToListAsync());
        Assert.Single(await Ajustes(ctx));
        Assert.Equal(1000m, await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0)); // não virou 1300

        var registro = Assert.Single(await ctx.RegistrosIdempotencia.AsNoTracking().ToListAsync());
        Assert.Equal(chave, registro.Chave);
        Assert.Equal(usuarioId, registro.UsuarioId);
        Assert.Equal(primeiro.Id, registro.ReferenciaId);

        // Replay não audita de novo: os eventos são os do 1º pedido.
        Assert.Single(await ctx.FinancialEventLogs.Where(l => l.Tipo == FinancialEventType.ReconciliacaoRegistrada).ToListAsync());
        Assert.Single(await ctx.FinancialEventLogs.Where(l => l.Tipo == FinancialEventType.TransacaoCriada).ToListAsync());
    }

    [Fact]
    public async Task CriarMarco_MesmaChaveSemAjuste_TambemFazReplay()
    {
        // Marco sem ajuste (diferença zero) também é idempotente — o replay não depende de haver ajuste.
        var (ctx, service, usuarioId, conta) = Seed();
        var chave = Chave();
        var dto = Dto(conta.Id, 0m);

        var primeiro = await service.CriarMarcoAsync(usuarioId, dto, chave);
        var segundo = await service.CriarMarcoAsync(usuarioId, dto, chave);

        Assert.Equal(primeiro.Id, segundo.Id);
        Assert.Single(await ctx.ReconciliacoesSaldo.ToListAsync());
    }

    [Fact]
    public async Task CriarMarco_ChavesDiferentes_SaoDoisMarcos_SegundoNaoReajusta()
    {
        // Chaves novas = pedidos novos. O 2º já enxerga o ajuste do 1º (diferença 0), então não duplica o ajuste.
        var (ctx, service, usuarioId, conta) = Seed();
        var dto = Dto(conta.Id, 500m, Baseline);

        var primeiro = await service.CriarMarcoAsync(usuarioId, dto, Chave());
        var segundo = await service.CriarMarcoAsync(usuarioId, dto, Chave());

        Assert.NotEqual(primeiro.Id, segundo.Id);
        Assert.Equal(2, await ctx.ReconciliacoesSaldo.CountAsync());
        Assert.True(primeiro.TemAjuste);
        Assert.False(segundo.TemAjuste);
        Assert.Equal(0m, segundo.Diferenca);
        Assert.Single(await Ajustes(ctx));
        Assert.Equal(500m, await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0));
    }

    [Fact]
    public async Task CriarMarco_MesmaChaveDeOutroUsuario_NaoColide_CadaUmTemSeuMarco()
    {
        // A chave é única POR usuário: o replay de um nunca devolve (nem vaza) o marco do outro.
        var (ctx, service, usuarioA, contaA) = Seed();
        var usuarioB = Guid.NewGuid();
        var contaB = NovaConta(ctx, usuarioB, "Conta do B");
        var chave = Chave();

        var marcoA = await service.CriarMarcoAsync(usuarioA, Dto(contaA.Id, 100m, Baseline), chave);
        var marcoB = await service.CriarMarcoAsync(usuarioB, Dto(contaB.Id, 200m, Baseline), chave);

        Assert.NotEqual(marcoA.Id, marcoB.Id);
        Assert.Equal(contaB.Id, marcoB.ContaId);
        Assert.Equal(200m, marcoB.SaldoDeclarado);
        Assert.Equal(2, await ctx.ReconciliacoesSaldo.CountAsync());
        Assert.Equal(2, await ctx.RegistrosIdempotencia.CountAsync());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task CriarMarco_ChaveVaziaOuNula_LancaArgumentException_SemGravarNada(string? chave)
    {
        var (ctx, service, usuarioId, conta) = Seed();

        await Assert.ThrowsAsync<ArgumentException>(
            () => service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 100m, Baseline), chave!));

        Assert.Empty(await ctx.ReconciliacoesSaldo.ToListAsync());
        Assert.Empty(await Ajustes(ctx));
        Assert.Empty(await ctx.RegistrosIdempotencia.ToListAsync());
    }

    [Fact]
    public async Task CriarMarco_ChaveMaiorQueOLimite_LancaArgumentException()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var chaveLonga = new string('a', RegistroIdempotencia.ChaveMaxLength + 1);

        await Assert.ThrowsAsync<ArgumentException>(
            () => service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 100m, Baseline), chaveLonga));

        Assert.Empty(await ctx.ReconciliacoesSaldo.ToListAsync());
    }

    [Fact]
    public async Task CriarMarco_ChaveNoLimiteExato_Aceita()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var chaveNoLimite = new string('a', RegistroIdempotencia.ChaveMaxLength);

        await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 100m, Baseline), chaveNoLimite);

        Assert.Single(await ctx.ReconciliacoesSaldo.ToListAsync());
    }

    // ── CriarMarcoAsync — validação e isolamento ─────────────────────────────

    [Theory]
    [InlineData(99)]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task CriarMarco_TipoInvalido_LancaArgumentException_SemGravarNemGastarAChave(int tipoInvalido)
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var chave = Chave();

        await Assert.ThrowsAsync<ArgumentException>(
            () => service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 100m, tipoInvalido), chave));

        Assert.Empty(await ctx.ReconciliacoesSaldo.ToListAsync());
        Assert.Empty(await Ajustes(ctx));
        // Tentativa que falhou antes de gravar não gasta a chave: o retry corrigido com a MESMA chave passa.
        Assert.Empty(await ctx.RegistrosIdempotencia.ToListAsync());
        var ok = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 100m, Baseline), chave);
        Assert.NotEqual(Guid.Empty, ok.Id);
    }

    [Fact]
    public async Task CriarMarco_ContaDeOutroUsuario_LancaKeyNotFoundException_SemAjustarSaldoAlheio()
    {
        // IDOR: o atacante usa o id da conta da vítima. 404 igual a inexistente; nada gravado.
        var (ctx, service, vitimaId, contaVitima) = Seed();
        await AddTransacao(ctx, contaVitima.Id, TipoTransacao.Receita, 700m, T0.AddDays(-1));
        var atacanteId = Guid.NewGuid();

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.CriarMarcoAsync(atacanteId, Dto(contaVitima.Id, 99999m, Baseline), Chave()));

        Assert.Empty(await ctx.ReconciliacoesSaldo.ToListAsync());
        Assert.Empty(await Ajustes(ctx));
        Assert.Empty(await ctx.RegistrosIdempotencia.ToListAsync());
        Assert.Equal(700m, await service.CalcularSaldoAteAsync(vitimaId, contaVitima.Id, T0));
    }

    [Fact]
    public async Task CriarMarco_ContaInexistente_LancaKeyNotFoundException()
    {
        var (ctx, service, usuarioId, _) = Seed();

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.CriarMarcoAsync(usuarioId, Dto(Guid.NewGuid(), 100m, Baseline), Chave()));

        Assert.Empty(await ctx.ReconciliacoesSaldo.ToListAsync());
    }

    // ── ListarAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task Listar_OrdenaPorDataHoraDescendente()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var antigo = NovoMarco(usuarioId, conta.Id, T0.AddDays(-2));
        var recente = NovoMarco(usuarioId, conta.Id, T0);
        var meio = NovoMarco(usuarioId, conta.Id, T0.AddDays(-1));
        ctx.ReconciliacoesSaldo.AddRange(antigo, recente, meio);
        await ctx.SaveChangesAsync();

        var lista = await service.ListarAsync(usuarioId, conta.Id);

        Assert.Equal(new[] { recente.Id, meio.Id, antigo.Id }, lista.Select(m => m.Id).ToArray());
    }

    [Fact]
    public async Task Listar_MesmaDataHora_DesempataPeloMaisRecentementeCriado()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var criadoPrimeiro = NovoMarco(usuarioId, conta.Id, T0, criadoEm: new DateTime(2026, 9, 1, 10, 0, 0));
        var criadoDepois = NovoMarco(usuarioId, conta.Id, T0, criadoEm: new DateTime(2026, 9, 1, 11, 0, 0));
        ctx.ReconciliacoesSaldo.AddRange(criadoPrimeiro, criadoDepois);
        await ctx.SaveChangesAsync();

        var lista = await service.ListarAsync(usuarioId, conta.Id);

        Assert.Equal(new[] { criadoDepois.Id, criadoPrimeiro.Id }, lista.Select(m => m.Id).ToArray());
    }

    [Fact]
    public async Task Listar_NaoRetornaMarcoInativo()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var ativo = NovoMarco(usuarioId, conta.Id, T0);
        var removido = NovoMarco(usuarioId, conta.Id, T0.AddDays(1), ativo: false);
        ctx.ReconciliacoesSaldo.AddRange(ativo, removido);
        await ctx.SaveChangesAsync();

        var lista = await service.ListarAsync(usuarioId, conta.Id);

        Assert.Equal(ativo.Id, Assert.Single(lista).Id);
    }

    [Fact]
    public async Task Listar_NaoRetornaMarcoDeOutraContaDoMesmoUsuario()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var outraConta = NovaConta(ctx, usuarioId, "Poupança");
        var daConta = NovoMarco(usuarioId, conta.Id, T0);
        var daOutra = NovoMarco(usuarioId, outraConta.Id, T0);
        ctx.ReconciliacoesSaldo.AddRange(daConta, daOutra);
        await ctx.SaveChangesAsync();

        var lista = await service.ListarAsync(usuarioId, conta.Id);

        Assert.Equal(daConta.Id, Assert.Single(lista).Id);
    }

    [Fact]
    public async Task Listar_NaoRetornaMarcoDeOutroUsuario()
    {
        // Defesa em profundidade: mesmo que exista um marco de outro UsuarioId apontando pra esta conta.
        var (ctx, service, usuarioId, conta) = Seed();
        var meu = NovoMarco(usuarioId, conta.Id, T0);
        var alheio = NovoMarco(Guid.NewGuid(), conta.Id, T0.AddDays(1));
        ctx.ReconciliacoesSaldo.AddRange(meu, alheio);
        await ctx.SaveChangesAsync();

        var lista = await service.ListarAsync(usuarioId, conta.Id);

        Assert.Equal(meu.Id, Assert.Single(lista).Id);
    }

    [Fact]
    public async Task Listar_ContaSemMarcos_RetornaListaVazia()
    {
        var (_, service, usuarioId, conta) = Seed();

        var lista = await service.ListarAsync(usuarioId, conta.Id);

        Assert.Empty(lista);
    }

    [Fact]
    public async Task Listar_MapeiaOsCamposDoMarcoCriadoPeloService()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 700m, T0.AddDays(-1));
        var criado = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 1000m, Baseline, observacao: "abertura"), Chave());

        var item = Assert.Single(await service.ListarAsync(usuarioId, conta.Id));

        Assert.Equal(criado.Id, item.Id);
        Assert.Equal(conta.Id, item.ContaId);
        Assert.Equal(T0, item.DataHora);
        Assert.Equal(1000m, item.SaldoDeclarado);
        Assert.Equal(700m, item.SaldoCalculado);
        Assert.Equal(300m, item.Diferenca);
        Assert.Equal(Baseline, item.Tipo);
        Assert.True(item.TemAjuste);
        Assert.Equal("abertura", item.Observacao);
    }

    [Fact]
    public async Task Listar_ContaDeOutroUsuario_LancaKeyNotFoundException()
    {
        var (ctx, service, vitimaId, contaVitima) = Seed();
        ctx.ReconciliacoesSaldo.Add(NovoMarco(vitimaId, contaVitima.Id, T0));
        await ctx.SaveChangesAsync();

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.ListarAsync(Guid.NewGuid(), contaVitima.Id));
    }

    [Fact]
    public async Task Listar_ContaInexistente_LancaKeyNotFoundException()
    {
        var (_, service, usuarioId, _) = Seed();

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.ListarAsync(usuarioId, Guid.NewGuid()));
    }

    // ── RemoverAsync ─────────────────────────────────────────────────────────

    [Fact]
    public async Task Remover_MarcoComAjuste_InativaOMarcoECancelaOAjuste_ESaldoVoltaAoAnterior()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 700m, T0.AddDays(-1));
        var criado = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 1000m, Baseline), Chave());
        Assert.Equal(1000m, await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0));

        await service.RemoverAsync(usuarioId, criado.Id);

        var marco = await ctx.ReconciliacoesSaldo.AsNoTracking().SingleAsync(m => m.Id == criado.Id);
        Assert.False(marco.Ativo); // soft delete: a linha continua existindo
        var ajuste = Assert.Single(await Ajustes(ctx));
        Assert.False(ajuste.Ativo);
        Assert.NotNull(ajuste.CanceladoEm);
        Assert.False(string.IsNullOrWhiteSpace(ajuste.MotivoCancelamento));
        // Desfazer a conferência desfaz a correção: o saldo volta ao que era antes do marco.
        Assert.Equal(700m, await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0));
        Assert.Empty(await service.ListarAsync(usuarioId, conta.Id));
    }

    [Fact]
    public async Task Remover_NaoCancelaOutrasTransacoesDaConta()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var normal = await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 700m, T0.AddDays(-1));
        var criado = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 1000m, Baseline), Chave());

        await service.RemoverAsync(usuarioId, criado.Id);

        var normalDb = await ctx.Transacoes.AsNoTracking().SingleAsync(t => t.Id == normal.Id);
        Assert.True(normalDb.Ativo);
        Assert.Null(normalDb.CanceladoEm);
    }

    [Fact]
    public async Task Remover_MarcoSemAjuste_SoInativaOMarco_SemTocarEmTransacoes()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var normal = await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 700m, T0.AddDays(-1));
        var criado = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 700m), Chave()); // bateu, sem ajuste

        await service.RemoverAsync(usuarioId, criado.Id);

        Assert.False((await ctx.ReconciliacoesSaldo.AsNoTracking().SingleAsync()).Ativo);
        Assert.True((await ctx.Transacoes.AsNoTracking().SingleAsync(t => t.Id == normal.Id)).Ativo);
        Assert.Empty(await Ajustes(ctx));
    }

    [Fact]
    public async Task Remover_RegistraEventoDeRemocao()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var criado = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 100m, Baseline), Chave());

        await service.RemoverAsync(usuarioId, criado.Id);

        var log = Assert.Single(await ctx.FinancialEventLogs.AsNoTracking()
            .Where(l => l.Tipo == FinancialEventType.ReconciliacaoRemovida).ToListAsync());
        Assert.Equal("ReconciliacaoSaldo", log.EntidadeAfetada);
        Assert.Equal(criado.Id, log.EntidadeId);
        Assert.Equal(usuarioId, log.CriadoPor);
    }

    [Fact]
    public async Task Remover_MarcoDeOutroUsuario_LancaKeyNotFoundException_SemDesfazerNada()
    {
        // IDOR: o atacante não pode apagar o marco da vítima nem cancelar o ajuste (= mexer no saldo dela).
        var (ctx, service, vitimaId, conta) = Seed();
        var criado = await service.CriarMarcoAsync(vitimaId, Dto(conta.Id, 1000m, Baseline), Chave());
        var atacanteId = Guid.NewGuid();

        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.RemoverAsync(atacanteId, criado.Id));

        Assert.True((await ctx.ReconciliacoesSaldo.AsNoTracking().SingleAsync()).Ativo);
        Assert.True(Assert.Single(await Ajustes(ctx)).Ativo);
        Assert.Equal(1000m, await service.CalcularSaldoAteAsync(vitimaId, conta.Id, T0));
        Assert.Empty(await ctx.FinancialEventLogs.Where(l => l.Tipo == FinancialEventType.ReconciliacaoRemovida
                                                              || l.Tipo == FinancialEventType.TransacaoCancelada).ToListAsync());
    }

    [Fact]
    public async Task Remover_MarcoInexistente_LancaKeyNotFoundException()
    {
        var (_, service, usuarioId, _) = Seed();

        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.RemoverAsync(usuarioId, Guid.NewGuid()));
    }

    [Fact]
    public async Task Remover_MarcoJaInativo_LancaKeyNotFoundException_SemAuditarDeNovo()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var criado = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 1000m, Baseline), Chave());
        await service.RemoverAsync(usuarioId, criado.Id);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.RemoverAsync(usuarioId, criado.Id));

        Assert.Single(await ctx.FinancialEventLogs
            .Where(l => l.Tipo == FinancialEventType.ReconciliacaoRemovida).ToListAsync());
    }

    [Fact]
    public async Task Remover_AjusteVinculadoJaCancelado_NaoQuebra_InativaOMarcoMesmoAssim()
    {
        // Robustez: o marco aponta pra um ajuste que já foi cancelado (o filtro global o esconde da
        // busca do service) → a remoção do marco segue, sem exceção nem "recancelar" o ajuste.
        var (ctx, service, usuarioId, conta) = Seed();
        var ajuste = await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 10m, T0, ativo: false);
        ajuste.EhAjusteReconciliacao = true;
        ajuste.CanceladoEm = new DateTime(2026, 8, 1);
        var marco = NovoMarco(usuarioId, conta.Id, T0);
        marco.AjusteTransacaoId = ajuste.Id;
        ctx.ReconciliacoesSaldo.Add(marco);
        await ctx.SaveChangesAsync();

        await service.RemoverAsync(usuarioId, marco.Id);

        Assert.False((await ctx.ReconciliacoesSaldo.AsNoTracking().SingleAsync()).Ativo);
        var ajusteDb = Assert.Single(await Ajustes(ctx));
        Assert.Equal(new DateTime(2026, 8, 1), ajusteDb.CanceladoEm); // não foi re-cancelado
        // Sem cancelamento novo, não há evento de cancelamento: só o do marco.
        var log = Assert.Single(await ctx.FinancialEventLogs.AsNoTracking().ToListAsync());
        Assert.Equal(FinancialEventType.ReconciliacaoRemovida, log.Tipo);
    }

    [Fact]
    public async Task Remover_DepoisDeRemover_PodeCriarNovoMarcoComNovaChave_EAjusteNovo()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var primeiro = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 1000m, Baseline), Chave());
        await service.RemoverAsync(usuarioId, primeiro.Id);

        var segundo = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 800m, Baseline), Chave());

        Assert.NotEqual(primeiro.Id, segundo.Id);
        Assert.Equal(0m, segundo.SaldoCalculado); // o ajuste cancelado não conta
        Assert.Equal(800m, segundo.Diferenca);
        Assert.Equal(800m, await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0));
        Assert.Equal(segundo.Id, Assert.Single(await service.ListarAsync(usuarioId, conta.Id)).Id);
        Assert.Equal(2, (await Ajustes(ctx)).Count); // 1 cancelado + 1 ativo
    }

    // ── CriarMarcoAsync — replay x dados divergentes (409) ───────────────────

    [Fact]
    public async Task CriarMarco_MesmaChaveEMesmosDados_InstanciasDistintas_NaoLanca_DevolveOOriginal()
    {
        // O cliente real reenvia um corpo NOVO (mesmos valores, outro objeto) — o replay não pode depender
        // de ser a mesma instância do DTO.
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 700m, T0.AddDays(-1));
        var chave = Chave();

        var primeiro = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 1000m, Baseline, T0), chave);
        var segundo = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 1000m, Baseline, T0), chave);

        Assert.Equal(primeiro.Id, segundo.Id);
        Assert.Single(await ctx.ReconciliacoesSaldo.ToListAsync());
        Assert.Single(await Ajustes(ctx));
    }

    [Theory]
    [InlineData("conta")]
    [InlineData("saldo")]
    [InlineData("dataHora")]
    [InlineData("tipo")]
    public async Task CriarMarco_MesmaChaveComOutrosDados_LancaInvalidOperation_SemCriarNemAuditarNada(string campoDivergente)
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var outraConta = NovaConta(ctx, usuarioId, "Poupança");
        var chave = Chave();
        var original = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 1000m, Baseline, T0), chave);
        var eventosAntes = await ctx.FinancialEventLogs.CountAsync();

        var divergente = campoDivergente switch
        {
            "conta" => Dto(outraConta.Id, 1000m, Baseline, T0),
            "saldo" => Dto(conta.Id, 1000.01m, Baseline, T0),
            "dataHora" => Dto(conta.Id, 1000m, Baseline, T0.AddMinutes(1)),
            "tipo" => Dto(conta.Id, 1000m, Verificacao, T0),
            _ => throw new ArgumentOutOfRangeException(nameof(campoDivergente)),
        };

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CriarMarcoAsync(usuarioId, divergente, chave));

        Assert.Contains("Idempotency-Key já usada com outros dados", ex.Message);
        // Estado intacto: continua só o marco original, o ajuste dele e a chave dele.
        Assert.Equal(original.Id, Assert.Single(await ctx.ReconciliacoesSaldo.ToListAsync()).Id);
        Assert.Single(await Ajustes(ctx));
        Assert.Equal(original.Id, Assert.Single(await ctx.RegistrosIdempotencia.ToListAsync()).ReferenciaId);
        Assert.Equal(eventosAntes, await ctx.FinancialEventLogs.CountAsync());
        Assert.Equal(0m, await service.CalcularSaldoAteAsync(usuarioId, outraConta.Id, T0));
        Assert.Equal(1000m, await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0));
    }

    [Fact]
    public async Task CriarMarco_MesmaChaveComOutrosDados_MarcoSemAjuste_TambemLancaInvalidOperation()
    {
        // O 409 não depende de o marco original ter ajuste.
        var (ctx, service, usuarioId, conta) = Seed();
        var chave = Chave();
        await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 0m), chave); // bateu, sem ajuste

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 5m), chave));

        Assert.Single(await ctx.ReconciliacoesSaldo.ToListAsync());
        Assert.Empty(await Ajustes(ctx));
    }

    // ── CriarMarcoAsync — corrida entre requisições simultâneas ──────────────

    [Fact]
    public async Task CriarMarco_CorridaMesmaChave_ViolacaoDoIndiceUnico_ViraReplayDoMarcoVencedor()
    {
        // Duplo clique em paralelo: as duas passam pela consulta de replay (nenhuma gravou ainda); a
        // gêmea commita primeiro e a nossa estoura o índice único (23505) → devolve o marco dela (e não 500).
        var root = new InMemoryDatabaseRoot();
        var nome = Guid.NewGuid().ToString();
        var corrida = new SimulaCorridaNoMarco();
        var ctx = CreateContext(root, nome, corrida);
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 700m, T0.AddDays(-1));
        var service = CriarService(ctx);
        var chave = Chave();

        ReconciliacaoSaldoDto? marcoDaGemea = null;
        corrida.Concorrente = async () =>
        {
            await using var outraConexao = CreateContext(root, nome);
            marcoDaGemea = await CriarService(outraConexao).CriarMarcoAsync(usuarioId, Dto(conta.Id, 1000m, Baseline), chave);
            return ViolacaoDeUnicidade();
        };

        var resultado = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 1000m, Baseline), chave);

        Assert.NotNull(marcoDaGemea);
        Assert.Equal(marcoDaGemea!.Id, resultado.Id);
        Assert.True(resultado.TemAjuste);
        // Nada duplicado: SaveChanges da perdedora não persistiu marco, ajuste, chave nem eventos.
        await using var leitura = CreateContext(root, nome);
        Assert.Equal(marcoDaGemea.Id, Assert.Single(await leitura.ReconciliacoesSaldo.ToListAsync()).Id);
        Assert.Single(await Ajustes(leitura));
        Assert.Single(await leitura.RegistrosIdempotencia.ToListAsync());
        Assert.Single(await leitura.FinancialEventLogs.Where(l => l.Tipo == FinancialEventType.ReconciliacaoRegistrada).ToListAsync());
        Assert.Equal(1000m, await CriarService(leitura).CalcularSaldoAteAsync(usuarioId, conta.Id, T0)); // não 1300
        // O contexto da perdedora ficou utilizável (sem entidades "fantasma" rastreadas).
        Assert.Equal(1000m, await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0));
    }

    [Fact]
    public async Task CriarMarco_CorridaMesmaChave_ConflitoDeConcorrencia_ViraReplayDoMarcoVencedor()
    {
        var root = new InMemoryDatabaseRoot();
        var nome = Guid.NewGuid().ToString();
        var corrida = new SimulaCorridaNoMarco();
        var ctx = CreateContext(root, nome, corrida);
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var service = CriarService(ctx);
        var chave = Chave();

        ReconciliacaoSaldoDto? marcoDaGemea = null;
        corrida.Concorrente = async () =>
        {
            await using var outraConexao = CreateContext(root, nome);
            marcoDaGemea = await CriarService(outraConexao).CriarMarcoAsync(usuarioId, Dto(conta.Id, 500m, Baseline), chave);
            return new DbUpdateConcurrencyException("The database operation was expected to affect 1 row(s).");
        };

        var resultado = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 500m, Baseline), chave);

        Assert.Equal(marcoDaGemea!.Id, resultado.Id);
        await using var leitura = CreateContext(root, nome);
        Assert.Single(await leitura.ReconciliacoesSaldo.ToListAsync());
        Assert.Single(await Ajustes(leitura));
    }

    [Fact]
    public async Task CriarMarco_CorridaMesmaChaveComOutrosDados_Lanca409_NaoViraReplay()
    {
        // A comparação de dados vale também no caminho da corrida (dentro do catch): a gêmea com a mesma
        // chave commitou 500; a nossa pedia 700 → 409, não o marco dela devolvido como se fosse o nosso.
        var root = new InMemoryDatabaseRoot();
        var nome = Guid.NewGuid().ToString();
        var corrida = new SimulaCorridaNoMarco();
        var ctx = CreateContext(root, nome, corrida);
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var service = CriarService(ctx);
        var chave = Chave();

        corrida.Concorrente = async () =>
        {
            await using var outraConexao = CreateContext(root, nome);
            await CriarService(outraConexao).CriarMarcoAsync(usuarioId, Dto(conta.Id, 500m, Baseline), chave);
            return ViolacaoDeUnicidade();
        };

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 700m, Baseline), chave));

        Assert.Contains("Idempotency-Key já usada com outros dados", ex.Message);
        await using var leitura = CreateContext(root, nome);
        var marco = Assert.Single(await leitura.ReconciliacoesSaldo.ToListAsync());
        Assert.Equal(500m, marco.SaldoDeclarado); // só o da gêmea
        Assert.Equal(500m, await CriarService(leitura).CalcularSaldoAteAsync(usuarioId, conta.Id, T0));
    }

    [Fact]
    public async Task CriarMarco_ViolacaoDeUnicidadeSemVencedor_PropagaAExcecaoOriginal_NaoEngole()
    {
        // 23505 mas não existe marco vencedor pra essa chave (ex.: outra constraint): não dá pra fingir
        // replay — a exceção original sobe e nada é persistido.
        var root = new InMemoryDatabaseRoot();
        var nome = Guid.NewGuid().ToString();
        var corrida = new SimulaCorridaNoMarco();
        var ctx = CreateContext(root, nome, corrida);
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var service = CriarService(ctx);
        corrida.Concorrente = () => Task.FromResult<Exception>(ViolacaoDeUnicidade());

        await Assert.ThrowsAsync<DbUpdateException>(
            () => service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 500m, Baseline), Chave()));

        await using var leitura = CreateContext(root, nome);
        Assert.Empty(await leitura.ReconciliacoesSaldo.ToListAsync());
        Assert.Empty(await Ajustes(leitura));
        Assert.Empty(await leitura.RegistrosIdempotencia.ToListAsync());
    }

    [Fact]
    public async Task CriarMarco_DbUpdateExceptionQueNaoEUnicidade_PropagaMesmoComMarcoNoBanco()
    {
        // O catch só traduz unicidade/concorrência. Um DbUpdateException qualquer (FK, tamanho de coluna...)
        // não pode virar "replay" — mesmo que exista um marco com a mesma chave.
        var root = new InMemoryDatabaseRoot();
        var nome = Guid.NewGuid().ToString();
        var corrida = new SimulaCorridaNoMarco();
        var ctx = CreateContext(root, nome, corrida);
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var service = CriarService(ctx);
        var chave = Chave();
        corrida.Concorrente = async () =>
        {
            await using var outraConexao = CreateContext(root, nome);
            await CriarService(outraConexao).CriarMarcoAsync(usuarioId, Dto(conta.Id, 500m, Baseline), chave);
            return new DbUpdateException("violação de outra natureza", new InvalidOperationException("outra"));
        };

        await Assert.ThrowsAsync<DbUpdateException>(
            () => service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 500m, Baseline), chave));
    }

    // ── CriarMarcoAsync — validação de faixa, data e observação ──────────────

    private const decimal TetoSaldo = 1_000_000_000m;

    [Theory]
    [InlineData(1)]
    [InlineData(-1)]
    public async Task CriarMarco_SaldoExatamenteNoTeto_Aceita_InclusiveNegativo(int sinal)
    {
        // Conta no vermelho até o teto também é um saldo declarado válido.
        var (ctx, service, usuarioId, conta) = Seed();
        var declarado = sinal * TetoSaldo;

        var dto = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, declarado, Baseline), Chave());

        Assert.Equal(declarado, dto.SaldoDeclarado);
        Assert.Equal(TetoSaldo, Assert.Single(await Ajustes(ctx)).Valor);
        Assert.Equal(declarado, await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(-1)]
    public async Task CriarMarco_SaldoUmCentavoAcimaDoTeto_LancaArgumentException_SemGravarNemGastarAChave(int sinal)
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var chave = Chave();
        var declarado = sinal * (TetoSaldo + 0.01m);

        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => service.CriarMarcoAsync(usuarioId, Dto(conta.Id, declarado, Baseline), chave));

        Assert.Contains("Saldo declarado fora da faixa aceita", ex.Message);
        Assert.Empty(await ctx.ReconciliacoesSaldo.ToListAsync());
        Assert.Empty(await Ajustes(ctx));
        Assert.Empty(await ctx.RegistrosIdempotencia.ToListAsync());
        Assert.Empty(await ctx.FinancialEventLogs.ToListAsync());
    }

    [Theory]
    [InlineData(0)]        // agora
    [InlineData(-1440)]    // ontem
    [InlineData(1435)]     // amanhã, 5 min antes do fim da tolerância de 1 dia
    public async Task CriarMarco_DataHoraAteATolerancia_Aceita(double minutosRelativosAAgora)
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var dataHora = DateTime.UtcNow.AddMinutes(minutosRelativosAAgora);

        var dto = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 0m, dataHora: dataHora), Chave());

        Assert.Equal(dataHora, dto.DataHora);
        Assert.Single(await ctx.ReconciliacoesSaldo.ToListAsync());
    }

    [Theory]
    [InlineData(1445)]     // 5 min além da tolerância de 1 dia
    [InlineData(2880)]     // +2 dias
    public async Task CriarMarco_DataHoraFuturaAlemDaTolerancia_LancaArgumentException_SemGravarNemGastarAChave(double minutosRelativosAAgora)
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var chave = Chave();
        var dataHora = DateTime.UtcNow.AddMinutes(minutosRelativosAAgora);

        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 100m, Baseline, dataHora), chave));

        Assert.Contains("A data do marco não pode ser futura", ex.Message);
        Assert.Empty(await ctx.ReconciliacoesSaldo.ToListAsync());
        Assert.Empty(await Ajustes(ctx)); // sem ajuste datado no futuro
        Assert.Empty(await ctx.RegistrosIdempotencia.ToListAsync());
    }

    [Fact]
    public async Task CriarMarco_Observacao400Chars_Aceita()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var noLimite = new string('x', 400);

        var dto = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 0m, observacao: noLimite), Chave());

        Assert.Equal(400, dto.Observacao!.Length);
        Assert.Equal(noLimite, (await ctx.ReconciliacoesSaldo.AsNoTracking().SingleAsync()).Observacao);
    }

    [Fact]
    public async Task CriarMarco_Observacao401Chars_LancaArgumentException_SemGravarNemGastarAChave()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var chave = Chave();

        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 100m, Baseline, observacao: new string('x', 401)), chave));

        Assert.Contains("Observação aceita no máximo 400 caracteres", ex.Message);
        Assert.Empty(await ctx.ReconciliacoesSaldo.ToListAsync());
        Assert.Empty(await Ajustes(ctx));
        Assert.Empty(await ctx.RegistrosIdempotencia.ToListAsync());
    }

    [Fact]
    public async Task CriarMarco_ObservacaoConta400AposOTrim_EspacosNasPontasNaoContam()
    {
        // O limite vale pro texto já trimado: 400 úteis + espaços em volta passa e é gravado trimado.
        var (ctx, service, usuarioId, conta) = Seed();
        var util = new string('x', 400);

        await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 0m, observacao: $"     {util}     "), Chave());

        Assert.Equal(util, (await ctx.ReconciliacoesSaldo.AsNoTracking().SingleAsync()).Observacao);
    }

    [Fact]
    public async Task CriarMarco_Observacao401AposOTrim_Rejeita()
    {
        var (ctx, service, usuarioId, conta) = Seed();

        await Assert.ThrowsAsync<ArgumentException>(
            () => service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 0m, observacao: $"  {new string('x', 401)}  "), Chave()));

        Assert.Empty(await ctx.ReconciliacoesSaldo.ToListAsync());
    }

    [Fact]
    public async Task CriarMarco_ObservacaoSoEspacosMesmoLonga_ViraNull_ENaoLancaErro()
    {
        var (ctx, service, usuarioId, conta) = Seed();

        await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 0m, observacao: new string(' ', 500)), Chave());

        Assert.Null((await ctx.ReconciliacoesSaldo.AsNoTracking().SingleAsync()).Observacao);
    }

    [Fact]
    public async Task CriarMarco_ValidacaoFalhaNaoGastaAChave_RetryCorrigidoComAMesmaChavePassa()
    {
        // Mesma garantia do tipo inválido, agora pra faixa/data/observação: a tentativa rejeitada não deixa
        // RegistroIdempotencia, então o usuário corrige o campo e reenvia com a MESMA chave sem tomar 409.
        var (ctx, service, usuarioId, conta) = Seed();
        var chave = Chave();
        await Assert.ThrowsAsync<ArgumentException>(
            () => service.CriarMarcoAsync(usuarioId, Dto(conta.Id, TetoSaldo + 1m, Baseline), chave));

        var ok = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 100m, Baseline), chave);

        Assert.NotEqual(Guid.Empty, ok.Id);
        Assert.Equal(100m, ok.SaldoDeclarado);
        Assert.Single(await ctx.RegistrosIdempotencia.ToListAsync());
    }

    // ── RemoverAsync — auditoria do delta de saldo ───────────────────────────

    [Theory]
    [InlineData(1000, 300)]  // declarado > calculado(700): ajuste Receita de 300
    [InlineData(500, 200)]   // declarado < calculado(700): ajuste Despesa de 200
    public async Task Remover_MarcoComAjuste_EmiteCancelamentoDoAjusteEDaRemocaoDoMarco_NoMesmoCorrelationId(
        int declarado, int valorDoAjuste)
    {
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 700m, T0.AddDays(-1));
        var criado = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, declarado, Baseline), Chave());
        var ajuste = Assert.Single(await Ajustes(ctx));
        var idsAntes = await IdsDeEventos(ctx);

        await service.RemoverAsync(usuarioId, criado.Id);

        // Exatamente DOIS eventos novos: o do ajuste cancelado e o do marco removido.
        var novos = await EventosNovos(ctx, idsAntes);
        Assert.Equal(2, novos.Count);
        var cancelamento = Assert.Single(novos, l => l.Tipo == FinancialEventType.TransacaoCancelada);
        var remocao = Assert.Single(novos, l => l.Tipo == FinancialEventType.ReconciliacaoRemovida);

        Assert.Equal("Transacao", cancelamento.EntidadeAfetada);
        Assert.Equal(ajuste.Id, cancelamento.EntidadeId);
        Assert.Equal((decimal)valorDoAjuste, ajuste.Valor);
        Assert.Equal((decimal)valorDoAjuste, cancelamento.ValorAntes); // valor do ajuste (sempre positivo)
        Assert.Equal(0m, cancelamento.ValorDepois);
        Assert.Equal(usuarioId, cancelamento.CriadoPor);

        Assert.Equal("ReconciliacaoSaldo", remocao.EntidadeAfetada);
        Assert.Equal(criado.Id, remocao.EntidadeId);
        Assert.Equal((decimal)declarado, remocao.ValorAntes);  // SaldoDeclarado
        Assert.Equal(700m, remocao.ValorDepois);                // SaldoCalculado de então
        Assert.Equal(usuarioId, remocao.CriadoPor);

        // Mesma operação = mesmo correlation id (e diferente do da criação do marco).
        Assert.Equal(cancelamento.CorrelationId, remocao.CorrelationId);
        var correlationDaCriacao = (await ctx.FinancialEventLogs.AsNoTracking()
            .Where(l => l.Tipo == FinancialEventType.ReconciliacaoRegistrada).SingleAsync()).CorrelationId;
        Assert.NotEqual(correlationDaCriacao, remocao.CorrelationId);
    }

    [Fact]
    public async Task Remover_MarcoSemAjuste_EmiteSoOEventoDeRemocao_SemCancelamento()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 700m, T0.AddDays(-1));
        var criado = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 700m), Chave()); // bateu, sem ajuste
        var idsAntes = await IdsDeEventos(ctx);

        await service.RemoverAsync(usuarioId, criado.Id);

        var evento = Assert.Single(await EventosNovos(ctx, idsAntes));
        Assert.Equal(FinancialEventType.ReconciliacaoRemovida, evento.Tipo);
        Assert.Equal(criado.Id, evento.EntidadeId);
        Assert.Equal(700m, evento.ValorAntes);   // SaldoDeclarado
        Assert.Equal(700m, evento.ValorDepois);  // SaldoCalculado — sem ajuste, nada mudou no saldo
        Assert.Empty(await ctx.FinancialEventLogs.Where(l => l.Tipo == FinancialEventType.TransacaoCancelada).ToListAsync());
    }

    [Fact]
    public async Task Remover_MarcoVerificacaoNaoResolvido_EmiteSoOEventoDeRemocao()
    {
        // Verificação com diferença e sem "ajustar": marco com Diferenca != 0 mas SEM ajuste — não há o que cancelar.
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 700m, T0.AddDays(-1));
        var criado = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 1000m, Verificacao), Chave());
        var idsAntes = await IdsDeEventos(ctx);

        await service.RemoverAsync(usuarioId, criado.Id);

        var evento = Assert.Single(await EventosNovos(ctx, idsAntes));
        Assert.Equal(FinancialEventType.ReconciliacaoRemovida, evento.Tipo);
        Assert.Equal(1000m, evento.ValorAntes);
        Assert.Equal(700m, evento.ValorDepois);
        Assert.Equal(700m, await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0)); // saldo intocado
    }

    // ── ListarAsync — baseline DERIVADO do saldo inicial da conta ────────────

    [Fact]
    public async Task Listar_ContaComSaldoInicialESemMarcos_ExpoeOSaldoInicialComoBaselineDerivado()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var dataInicial = T0.AddDays(-30);
        var inicial = await AddSaldoInicial(ctx, conta.Id, 1500.75m, dataInicial);

        var lista = await service.ListarAsync(usuarioId, conta.Id);

        var item = Assert.Single(lista);
        Assert.True(item.Derivado);
        Assert.Equal(Baseline, item.Tipo);
        Assert.Equal(inicial.Id, item.Id); // o id é o da transação de saldo inicial
        Assert.Equal(conta.Id, item.ContaId);
        Assert.Equal(dataInicial, item.DataHora);
        Assert.Equal(1500.75m, item.SaldoDeclarado);
        Assert.Equal(1500.75m, item.SaldoCalculado);
        Assert.Equal(0m, item.Diferenca);
        Assert.False(item.TemAjuste);
        Assert.Equal("Saldo inicial da conta", item.Observacao);
        Assert.Equal(inicial.CriadoEm, item.CriadoEm);
    }

    [Fact]
    public async Task Listar_BaselineDerivado_ESinteticoNaoGravaMarcoNemAuditaNada()
    {
        // Listar é leitura: o derivado existe só na resposta — não vira linha em ReconciliacoesSaldo.
        var (ctx, service, usuarioId, conta) = Seed();
        await AddSaldoInicial(ctx, conta.Id, 1000m, T0.AddDays(-30));

        var primeira = await service.ListarAsync(usuarioId, conta.Id);
        var segunda = await service.ListarAsync(usuarioId, conta.Id);

        Assert.Equal(primeira.Single().Id, segunda.Single().Id); // estável entre chamadas
        Assert.Empty(await ctx.ReconciliacoesSaldo.ToListAsync());
        Assert.Empty(await ctx.FinancialEventLogs.ToListAsync());
        Assert.Empty(await ctx.RegistrosIdempotencia.ToListAsync());
    }

    [Fact]
    public async Task Listar_SaldoInicialMaisVerificacaoReal_RetornaOsDois_DerivadoESoOBaseline()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var inicial = await AddSaldoInicial(ctx, conta.Id, 1500m, T0.AddDays(-30));
        var real = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 1500m, Verificacao, T0), Chave());

        var lista = await service.ListarAsync(usuarioId, conta.Id);

        Assert.Equal(2, lista.Count);
        var derivado = Assert.Single(lista, m => m.Derivado);
        var marcoReal = Assert.Single(lista, m => !m.Derivado);
        Assert.Equal(inicial.Id, derivado.Id);
        Assert.Equal(Baseline, derivado.Tipo);
        Assert.Equal(1500m, derivado.SaldoDeclarado);
        Assert.Equal(real.Id, marcoReal.Id);
        Assert.Equal(Verificacao, marcoReal.Tipo);
        Assert.False(marcoReal.Derivado);
    }

    [Fact]
    public async Task Listar_ComDerivado_OrdenaTudoPorDataHoraDescendente()
    {
        // O derivado entra no MEIO da ordenação pela data dele, não fica sempre no fim nem no começo.
        var (ctx, service, usuarioId, conta) = Seed();
        var inicial = await AddSaldoInicial(ctx, conta.Id, 1000m, T0.AddDays(-30));
        var maisRecente = NovoMarco(usuarioId, conta.Id, T0);
        var maisAntigo = NovoMarco(usuarioId, conta.Id, T0.AddDays(-60)); // verificação anterior ao saldo inicial
        ctx.ReconciliacoesSaldo.AddRange(maisAntigo, maisRecente);
        await ctx.SaveChangesAsync();

        var lista = await service.ListarAsync(usuarioId, conta.Id);

        Assert.Equal(new[] { maisRecente.Id, inicial.Id, maisAntigo.Id }, lista.Select(m => m.Id).ToArray());
    }

    [Theory]
    [InlineData(1000)] // bate com o saldo inicial → baseline real sem ajuste
    [InlineData(1500)] // diferente → baseline real com ajuste
    public async Task Listar_ComBaselineReal_NaoAdicionaODerivado_OMarcoRealManda(int declarado)
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var inicial = await AddSaldoInicial(ctx, conta.Id, 1000m, T0.AddDays(-10));
        var real = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, declarado, Baseline, T0), Chave());

        var lista = await service.ListarAsync(usuarioId, conta.Id);

        var item = Assert.Single(lista);
        Assert.Equal(real.Id, item.Id);
        Assert.False(item.Derivado);
        Assert.Equal(Baseline, item.Tipo);
        Assert.DoesNotContain(lista, m => m.Derivado);
        Assert.DoesNotContain(lista, m => m.Id == inicial.Id);
    }

    [Fact]
    public async Task Listar_BaselineRealRemovido_OSaldoInicialVoltaComoDerivado()
    {
        // Só baseline ATIVO suprime o derivado: removendo o real, o ponto de partida volta a ser o saldo inicial.
        var (ctx, service, usuarioId, conta) = Seed();
        var inicial = await AddSaldoInicial(ctx, conta.Id, 1000m, T0.AddDays(-10));
        var real = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 1500m, Baseline, T0), Chave());
        Assert.False(Assert.Single(await service.ListarAsync(usuarioId, conta.Id)).Derivado);

        await service.RemoverAsync(usuarioId, real.Id);

        var item = Assert.Single(await service.ListarAsync(usuarioId, conta.Id));
        Assert.True(item.Derivado);
        Assert.Equal(inicial.Id, item.Id);
    }

    [Fact]
    public async Task Listar_BaselineRealDeOutraContaDoMesmoUsuario_NaoSuprimeODerivadoDestaConta()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var outraConta = NovaConta(ctx, usuarioId, "Poupança");
        var inicial = await AddSaldoInicial(ctx, conta.Id, 1000m, T0.AddDays(-10));
        await service.CriarMarcoAsync(usuarioId, Dto(outraConta.Id, 50m, Baseline, T0), Chave());

        var lista = await service.ListarAsync(usuarioId, conta.Id);

        var item = Assert.Single(lista);
        Assert.True(item.Derivado);
        Assert.Equal(inicial.Id, item.Id);
    }

    [Fact]
    public async Task Listar_ContaSemSaldoInicialESemMarcos_RetornaVazia_TransacaoComumNaoViraDerivado()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        await AddTransacao(ctx, conta.Id, TipoTransacao.Receita, 500m, T0.AddDays(-5)); // receita comum, não é saldo inicial

        var lista = await service.ListarAsync(usuarioId, conta.Id);

        Assert.Empty(lista);
    }

    [Fact]
    public async Task Listar_VerificacaoRealSemSaldoInicial_RetornaSoOReal_SemDerivado()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var real = await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 0m, Verificacao, T0), Chave());

        var lista = await service.ListarAsync(usuarioId, conta.Id);

        var item = Assert.Single(lista);
        Assert.Equal(real.Id, item.Id);
        Assert.False(item.Derivado);
    }

    [Fact]
    public async Task Listar_SaldoInicialCancelado_NaoViraDerivado()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        await AddSaldoInicial(ctx, conta.Id, 1000m, T0.AddDays(-30), ativo: false);

        var lista = await service.ListarAsync(usuarioId, conta.Id);

        Assert.Empty(lista);
    }

    [Fact]
    public async Task Listar_MaisDeUmSaldoInicial_UsaOMaisAntigoPorData()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var maisNovo = await AddSaldoInicial(ctx, conta.Id, 999m, T0.AddDays(-5));
        var maisAntigo = await AddSaldoInicial(ctx, conta.Id, 1000m, T0.AddDays(-30));

        var lista = await service.ListarAsync(usuarioId, conta.Id);

        var item = Assert.Single(lista); // um derivado só
        Assert.Equal(maisAntigo.Id, item.Id);
        Assert.Equal(1000m, item.SaldoDeclarado);
        Assert.NotEqual(maisNovo.Id, item.Id);
    }

    [Fact]
    public async Task Listar_SaldoInicialDeOutraContaOuUsuario_NaoViraBaselineDerivadoNaMinhaLista()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var minhaOutraConta = NovaConta(ctx, usuarioId, "Poupança");
        var outroUsuarioId = Guid.NewGuid();
        var contaAlheia = NovaConta(ctx, outroUsuarioId, "Conta alheia");
        await AddSaldoInicial(ctx, minhaOutraConta.Id, 111m, T0.AddDays(-5));
        await AddSaldoInicial(ctx, contaAlheia.Id, 222m, T0.AddDays(-5));

        var lista = await service.ListarAsync(usuarioId, conta.Id);

        Assert.Empty(lista); // a minha conta não tem saldo inicial; os outros dois não vazam pra cá

        // E cada conta enxerga só o seu próprio saldo inicial.
        var daOutra = Assert.Single(await service.ListarAsync(usuarioId, minhaOutraConta.Id));
        Assert.Equal(111m, daOutra.SaldoDeclarado);
        Assert.Equal(minhaOutraConta.Id, daOutra.ContaId);
        var daAlheia = Assert.Single(await service.ListarAsync(outroUsuarioId, contaAlheia.Id));
        Assert.Equal(222m, daAlheia.SaldoDeclarado);
    }

    [Fact]
    public async Task Listar_ContaDeOutroUsuarioComSaldoInicial_LancaKeyNotFound_SemVazarODerivado()
    {
        // IDOR: o atacante lista a conta da vítima; o saldo inicial (dado sensível) não pode voltar.
        var (ctx, service, _, contaVitima) = Seed();
        await AddSaldoInicial(ctx, contaVitima.Id, 50000m, T0.AddDays(-30));

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.ListarAsync(Guid.NewGuid(), contaVitima.Id));
    }

    [Fact]
    public async Task Remover_ComOIdDoBaselineDerivado_LancaKeyNotFound_ENaoCancelaOSaldoInicial()
    {
        // O derivado reaproveita o id da transação de saldo inicial. Mandar esse id pra remover o "marco"
        // não pode cancelar o saldo inicial da conta (mudaria o saldo) — o derivado não é removível.
        var (ctx, service, usuarioId, conta) = Seed();
        var inicial = await AddSaldoInicial(ctx, conta.Id, 1000m, T0.AddDays(-30));
        var derivado = Assert.Single(await service.ListarAsync(usuarioId, conta.Id));
        Assert.Equal(inicial.Id, derivado.Id);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.RemoverAsync(usuarioId, derivado.Id));

        var inicialDb = await ctx.Transacoes.AsNoTracking().SingleAsync(t => t.Id == inicial.Id);
        Assert.True(inicialDb.Ativo);
        Assert.Null(inicialDb.CanceladoEm);
        Assert.Equal(1000m, await service.CalcularSaldoAteAsync(usuarioId, conta.Id, T0));
        Assert.Empty(await ctx.FinancialEventLogs.ToListAsync());
    }

    [Fact]
    public async Task Listar_MarcosReaisSempreTemDerivadoFalso()
    {
        var (ctx, service, usuarioId, conta) = Seed();
        var inicial = await AddSaldoInicial(ctx, conta.Id, 1000m, T0.AddDays(-30));
        ctx.ReconciliacoesSaldo.Add(NovoMarco(usuarioId, conta.Id, T0)); // real semeado direto
        await ctx.SaveChangesAsync();
        await service.CriarMarcoAsync(usuarioId, Dto(conta.Id, 1000m, Verificacao, T0.AddDays(-1)), Chave()); // real via service

        var lista = await service.ListarAsync(usuarioId, conta.Id);

        Assert.Equal(3, lista.Count); // 2 reais + o derivado
        Assert.Equal(inicial.Id, Assert.Single(lista, m => m.Derivado).Id);
        var reais = lista.Where(m => m.Id != inicial.Id).ToList();
        Assert.Equal(2, reais.Count);
        Assert.All(reais, m => Assert.False(m.Derivado));
    }
}

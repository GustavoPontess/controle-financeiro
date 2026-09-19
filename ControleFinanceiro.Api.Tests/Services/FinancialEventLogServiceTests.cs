using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class FinancialEventLogServiceTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    // ── Registrar ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Registrar_DadosValidos_CriaLogComCamposCorretos()
    {
        var ctx = CreateContext();
        var svc = new FinancialEventLogService(ctx);
        var usuarioId = Guid.NewGuid();
        var entidadeId = Guid.NewGuid();
        var correlationId = Guid.NewGuid();
        var antes = DateTime.UtcNow;

        var log = svc.Registrar(
            usuarioId,
            FinancialEventType.LimiteBloqueado,
            "CartaoCredito",
            entidadeId,
            correlationId,
            "UserClick",
            valorAntes: 1000m,
            valorDepois: 700m);
        await ctx.SaveChangesAsync();

        var depois = DateTime.UtcNow;

        Assert.NotEqual(Guid.Empty, log.Id);
        Assert.Equal(usuarioId, log.CriadoPor);
        Assert.Equal(FinancialEventType.LimiteBloqueado, log.Tipo);
        Assert.Equal("CartaoCredito", log.EntidadeAfetada);
        Assert.Equal(entidadeId, log.EntidadeId);
        Assert.Equal(correlationId, log.CorrelationId);
        Assert.Equal("UserClick", log.OrigemAcao);
        Assert.Equal(1000m, log.ValorAntes);
        Assert.Equal(700m, log.ValorDepois);
        Assert.Null(log.PayloadJson);
        Assert.InRange(log.CriadoEm, antes.AddSeconds(-1), depois.AddSeconds(1));

        var doBanco = await ctx.FinancialEventLogs.SingleAsync();
        Assert.Equal(log.Id, doBanco.Id);
    }

    [Fact]
    public async Task Registrar_NaoChamaSaveChanges_LogNaoPersisteAteCallerSalvar()
    {
        var ctx = CreateContext();
        var svc = new FinancialEventLogService(ctx);

        svc.Registrar(
            Guid.NewGuid(),
            FinancialEventType.FaturaFechada,
            "Fatura",
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Job:FecharFaturas");

        // Doc do service: "Não chama SaveChanges — o caller deve fazer SaveChangesAsync".
        Assert.Equal(0, await ctx.FinancialEventLogs.CountAsync());

        await ctx.SaveChangesAsync();

        Assert.Equal(1, await ctx.FinancialEventLogs.CountAsync());
    }

    [Fact]
    public async Task Registrar_ValorAntesEValorDepoisOmitidos_FicamNull()
    {
        var ctx = CreateContext();
        var svc = new FinancialEventLogService(ctx);

        var log = svc.Registrar(
            Guid.NewGuid(),
            FinancialEventType.TransacaoCriada,
            "Transacao",
            Guid.NewGuid(),
            Guid.NewGuid(),
            "API");
        await ctx.SaveChangesAsync();

        Assert.Null(log.ValorAntes);
        Assert.Null(log.ValorDepois);
    }

    [Fact]
    public async Task Registrar_ComPayload_SerializaEmJson()
    {
        var ctx = CreateContext();
        var svc = new FinancialEventLogService(ctx);
        var idempotencyKey = "abc-123";

        var log = svc.Registrar(
            Guid.NewGuid(),
            FinancialEventType.ParcelamentoCriado,
            "Parcelamento",
            Guid.NewGuid(),
            Guid.NewGuid(),
            "API",
            payload: new { idempotencyKey, numeroParcelas = 3 });
        await ctx.SaveChangesAsync();

        Assert.NotNull(log.PayloadJson);
        Assert.Contains("\"idempotencyKey\":\"abc-123\"", log.PayloadJson);
        Assert.Contains("\"numeroParcelas\":3", log.PayloadJson);
    }

    [Fact]
    public async Task Registrar_PayloadNull_PayloadJsonFicaNull()
    {
        var ctx = CreateContext();
        var svc = new FinancialEventLogService(ctx);

        var log = svc.Registrar(
            Guid.NewGuid(),
            FinancialEventType.RecorrenteCriada,
            "Recorrente",
            Guid.NewGuid(),
            Guid.NewGuid(),
            "API",
            payload: null);
        await ctx.SaveChangesAsync();

        Assert.Null(log.PayloadJson);
    }

    [Fact]
    public async Task Registrar_ChamadasMultiplas_GeramLogsIndependentesComMesmoCorrelationId()
    {
        var ctx = CreateContext();
        var svc = new FinancialEventLogService(ctx);
        var usuarioId = Guid.NewGuid();
        var correlationId = Guid.NewGuid();

        var log1 = svc.Registrar(usuarioId, FinancialEventType.ParcelaPaga, "ParcelaTransacao", Guid.NewGuid(), correlationId, "API");
        var log2 = svc.Registrar(usuarioId, FinancialEventType.LimiteLiberado, "CartaoCredito", Guid.NewGuid(), correlationId, "API");
        await ctx.SaveChangesAsync();

        Assert.NotEqual(log1.Id, log2.Id);
        Assert.Equal(2, await ctx.FinancialEventLogs.CountAsync(e => e.CorrelationId == correlationId));
    }

    // ── BuscarPorIdempotencyKeyAsync ─────────────────────────────────────────

    [Fact]
    public async Task BuscarPorIdempotencyKeyAsync_ChaveExistente_RetornaLog()
    {
        var ctx = CreateContext();
        var svc = new FinancialEventLogService(ctx);
        var usuarioId = Guid.NewGuid();
        const string key = "idem-existente";

        ctx.FinancialEventLogs.Add(new FinancialEventLog
        {
            Id = Guid.NewGuid(),
            CriadoPor = usuarioId,
            Tipo = FinancialEventType.ParcelamentoCriado,
            EntidadeAfetada = "Parcelamento",
            EntidadeId = Guid.NewGuid(),
            CorrelationId = Guid.NewGuid(),
            OrigemAcao = "API",
            PayloadJson = $"{{\"idempotencyKey\":\"{key}\"}}",
            CriadoEm = DateTime.UtcNow,
        });
        await ctx.SaveChangesAsync();

        var resultado = await svc.BuscarPorIdempotencyKeyAsync(usuarioId, key);

        Assert.NotNull(resultado);
        Assert.Contains(key, resultado!.PayloadJson);
    }

    [Fact]
    public async Task BuscarPorIdempotencyKeyAsync_ChaveInexistente_RetornaNull()
    {
        var ctx = CreateContext();
        var svc = new FinancialEventLogService(ctx);

        var resultado = await svc.BuscarPorIdempotencyKeyAsync(Guid.NewGuid(), "nao-existe");

        Assert.Null(resultado);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task BuscarPorIdempotencyKeyAsync_ChaveVaziaOuNula_RetornaNullSemConsultar(string? key)
    {
        var ctx = CreateContext();
        var svc = new FinancialEventLogService(ctx);

        var resultado = await svc.BuscarPorIdempotencyKeyAsync(Guid.NewGuid(), key!);

        Assert.Null(resultado);
    }

    [Fact]
    public async Task BuscarPorIdempotencyKeyAsync_ChaveDeOutroUsuario_NaoRetornaLogAlheio()
    {
        // Isolamento multi-tenant: o log existe, mas pertence a outro usuário.
        var ctx = CreateContext();
        var svc = new FinancialEventLogService(ctx);
        var dono = Guid.NewGuid();
        var outroUsuario = Guid.NewGuid();
        const string key = "idem-de-outro-usuario";

        ctx.FinancialEventLogs.Add(new FinancialEventLog
        {
            Id = Guid.NewGuid(),
            CriadoPor = dono,
            Tipo = FinancialEventType.ParcelamentoCriado,
            EntidadeAfetada = "Parcelamento",
            EntidadeId = Guid.NewGuid(),
            CorrelationId = Guid.NewGuid(),
            OrigemAcao = "API",
            PayloadJson = $"{{\"idempotencyKey\":\"{key}\"}}",
            CriadoEm = DateTime.UtcNow,
        });
        await ctx.SaveChangesAsync();

        var resultado = await svc.BuscarPorIdempotencyKeyAsync(outroUsuario, key);

        Assert.Null(resultado);
    }

    [Fact]
    public async Task BuscarPorIdempotencyKeyAsync_LogForaDaJanelaPadrao_RetornaNull()
    {
        var ctx = CreateContext();
        var svc = new FinancialEventLogService(ctx);
        var usuarioId = Guid.NewGuid();
        const string key = "idem-antigo";

        ctx.FinancialEventLogs.Add(new FinancialEventLog
        {
            Id = Guid.NewGuid(),
            CriadoPor = usuarioId,
            Tipo = FinancialEventType.ParcelamentoCriado,
            EntidadeAfetada = "Parcelamento",
            EntidadeId = Guid.NewGuid(),
            CorrelationId = Guid.NewGuid(),
            OrigemAcao = "API",
            PayloadJson = $"{{\"idempotencyKey\":\"{key}\"}}",
            CriadoEm = DateTime.UtcNow.AddHours(-25), // janela padrão é 24h
        });
        await ctx.SaveChangesAsync();

        var resultado = await svc.BuscarPorIdempotencyKeyAsync(usuarioId, key);

        Assert.Null(resultado);
    }

    [Fact]
    public async Task BuscarPorIdempotencyKeyAsync_JanelaCustomizada_RespeitaLimite()
    {
        var ctx = CreateContext();
        var svc = new FinancialEventLogService(ctx);
        var usuarioId = Guid.NewGuid();
        const string key = "idem-janela-curta";

        ctx.FinancialEventLogs.Add(new FinancialEventLog
        {
            Id = Guid.NewGuid(),
            CriadoPor = usuarioId,
            Tipo = FinancialEventType.ParcelamentoCriado,
            EntidadeAfetada = "Parcelamento",
            EntidadeId = Guid.NewGuid(),
            CorrelationId = Guid.NewGuid(),
            OrigemAcao = "API",
            PayloadJson = $"{{\"idempotencyKey\":\"{key}\"}}",
            CriadoEm = DateTime.UtcNow.AddMinutes(-10),
        });
        await ctx.SaveChangesAsync();

        // Fora de uma janela de 5 minutos.
        var forDaJanela = await svc.BuscarPorIdempotencyKeyAsync(usuarioId, key, TimeSpan.FromMinutes(5));
        Assert.Null(forDaJanela);

        // Dentro de uma janela de 30 minutos.
        var dentroDaJanela = await svc.BuscarPorIdempotencyKeyAsync(usuarioId, key, TimeSpan.FromMinutes(30));
        Assert.NotNull(dentroDaJanela);
    }

    [Fact]
    public async Task BuscarPorIdempotencyKeyAsync_ChavePrefixoDeOutraChave_NaoDaFalsoPositivo()
    {
        // "abc" não pode casar com um log gravado com idempotencyKey "abcdef" —
        // o needle de busca inclui a aspa de fechamento como delimitador.
        var ctx = CreateContext();
        var svc = new FinancialEventLogService(ctx);
        var usuarioId = Guid.NewGuid();

        ctx.FinancialEventLogs.Add(new FinancialEventLog
        {
            Id = Guid.NewGuid(),
            CriadoPor = usuarioId,
            Tipo = FinancialEventType.ParcelamentoCriado,
            EntidadeAfetada = "Parcelamento",
            EntidadeId = Guid.NewGuid(),
            CorrelationId = Guid.NewGuid(),
            OrigemAcao = "API",
            PayloadJson = "{\"idempotencyKey\":\"abcdef\"}",
            CriadoEm = DateTime.UtcNow,
        });
        await ctx.SaveChangesAsync();

        var resultado = await svc.BuscarPorIdempotencyKeyAsync(usuarioId, "abc");

        Assert.Null(resultado);
    }

    [Fact]
    public async Task BuscarPorIdempotencyKeyAsync_MultiplosLogsComMesmaChave_RetornaOMaisRecente()
    {
        var ctx = CreateContext();
        var svc = new FinancialEventLogService(ctx);
        var usuarioId = Guid.NewGuid();
        const string key = "idem-replay";
        var entidadeAntigaId = Guid.NewGuid();
        var entidadeRecenteId = Guid.NewGuid();

        ctx.FinancialEventLogs.AddRange(
            new FinancialEventLog
            {
                Id = Guid.NewGuid(),
                CriadoPor = usuarioId,
                Tipo = FinancialEventType.ParcelamentoCriado,
                EntidadeAfetada = "Parcelamento",
                EntidadeId = entidadeAntigaId,
                CorrelationId = Guid.NewGuid(),
                OrigemAcao = "API",
                PayloadJson = $"{{\"idempotencyKey\":\"{key}\"}}",
                CriadoEm = DateTime.UtcNow.AddMinutes(-10),
            },
            new FinancialEventLog
            {
                Id = Guid.NewGuid(),
                CriadoPor = usuarioId,
                Tipo = FinancialEventType.ParcelamentoCriado,
                EntidadeAfetada = "Parcelamento",
                EntidadeId = entidadeRecenteId,
                CorrelationId = Guid.NewGuid(),
                OrigemAcao = "API",
                PayloadJson = $"{{\"idempotencyKey\":\"{key}\"}}",
                CriadoEm = DateTime.UtcNow.AddMinutes(-1),
            });
        await ctx.SaveChangesAsync();

        var resultado = await svc.BuscarPorIdempotencyKeyAsync(usuarioId, key);

        Assert.NotNull(resultado);
        Assert.Equal(entidadeRecenteId, resultado!.EntidadeId);
    }

    [Fact]
    public async Task BuscarPorIdempotencyKeyAsync_PayloadJsonNull_NaoQuebraEIgnoraLog()
    {
        var ctx = CreateContext();
        var svc = new FinancialEventLogService(ctx);
        var usuarioId = Guid.NewGuid();

        ctx.FinancialEventLogs.Add(new FinancialEventLog
        {
            Id = Guid.NewGuid(),
            CriadoPor = usuarioId,
            Tipo = FinancialEventType.TransacaoCriada,
            EntidadeAfetada = "Transacao",
            EntidadeId = Guid.NewGuid(),
            CorrelationId = Guid.NewGuid(),
            OrigemAcao = "API",
            PayloadJson = null,
            CriadoEm = DateTime.UtcNow,
        });
        await ctx.SaveChangesAsync();

        var resultado = await svc.BuscarPorIdempotencyKeyAsync(usuarioId, "qualquer-chave");

        Assert.Null(resultado);
    }
}

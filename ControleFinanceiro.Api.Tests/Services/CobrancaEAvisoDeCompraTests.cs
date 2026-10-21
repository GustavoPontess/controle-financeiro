using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Jobs;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Decisão do Gustavo (2026-10-19): (1) a conta fixa no cartão só é cobrada se o limite cobre; a que não cabe fica
/// prevista, a pessoa é avisada (uma vez) e o app tenta de novo todo dia; (2) antes de salvar uma compra, o app avisa
/// se ela tira o dinheiro (limite no cartão, saldo na conta) das contas fixas dos próximos 30 dias.
/// </summary>
public class CobrancaEAvisoDeCompraTests
{
    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    private sealed record Cenario(AppDbContext Ctx, Guid U, Guid CartaoId, Guid ContaId, Guid RecorrenteId);

    private static Cenario Build(decimal limite)
    {
        var ctx = CreateContext();
        var u = Guid.NewGuid();
        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = "Nubank", TemCredito = true, LimiteTotal = limite,
            DiaFechamento = 10, DiaVencimento = 17, CriadoPor = u, Ativo = true,
        };
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Itaú", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = u };
        var rec = new Recorrente
        {
            Id = Guid.NewGuid(), Descricao = "Assinaturas", Valor = 1, Tipo = TipoTransacao.Despesa, CartaoCreditoId = cartao.Id,
            Frequencia = FrequenciaRecorrencia.Mensal, Dia = 1, DataInicio = DateTime.UtcNow.AddMonths(-1), CriadoPor = u,
            DataProximaGeracao = DateTime.UtcNow.AddMonths(2),
        };
        ctx.CartoesCredito.Add(cartao);
        ctx.Contas.Add(conta);
        ctx.Recorrentes.Add(rec);
        ctx.SaveChanges();
        return new Cenario(ctx, u, cartao.Id, conta.Id, rec.Id);
    }

    private static Transacao Lancar(Cenario c, string descricao, decimal valor, DateOnly data, StatusTransacao status,
        bool noCartao = true, bool daContaFixa = true, TipoTransacao tipo = TipoTransacao.Despesa)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = descricao, Valor = valor, Tipo = tipo, Data = data, StatusTransacao = status,
            CartaoCreditoId = noCartao ? c.CartaoId : null, UsadoComoCredito = noCartao, ContaId = noCartao ? null : c.ContaId,
            RecorrenteOrigemId = daContaFixa ? c.RecorrenteId : null, CriadoPor = c.U,
        };
        c.Ctx.Transacoes.Add(t);
        c.Ctx.SaveChanges();
        return t;
    }

    private static ExecutarRecorrentesJob Job(AppDbContext ctx) =>
        new(ctx, new NotificacaoService(ctx, NullLogger<NotificacaoService>.Instance));

    private static DateOnly Hoje => HorarioBrasil.Hoje();

    private static string SemNbsp(string s) => s.Replace(' ', ' ');

    // ── (1) cobrança da conta fixa no cartão ───────────────────────────────

    [Fact]
    public async Task SemLimite_NaoCobra_AvisaUmaVez_ECobraQuandoOLimiteVolta()
    {
        var c = Build(limite: 100m);
        var compra = Lancar(c, "Mercado", 80m, Hoje.AddDays(-3), StatusTransacao.Executado, daContaFixa: false);
        var netflix = Lancar(c, "Netflix", 55.90m, Hoje.AddDays(-1), StatusTransacao.Previsao);

        await Job(c.Ctx).ExecuteAsync();
        await Job(c.Ctx).ExecuteAsync(); // tenta de novo no outro dia: segue sem limite, sem aviso repetido

        Assert.Equal(StatusTransacao.Previsao, (await c.Ctx.Transacoes.AsNoTracking().SingleAsync(t => t.Id == netflix.Id)).StatusTransacao);
        var aviso = Assert.Single(await c.Ctx.Notificacoes.ToListAsync());
        Assert.Equal((c.U, TipoNotificacao.CobrancaSemLimite, ExecutarRecorrentesJob.ChaveSemLimite(netflix.Id)), (aviso.UsuarioId, aviso.Tipo, aviso.Chave));
        Assert.Equal("Netflix não passou no Nubank", aviso.Titulo);
        Assert.Equal("A cobrança de Netflix (R$ 55,90) no Nubank não passou: falta limite (disponível R$ 20,00). " +
                     "Quando a fatura for paga e o limite voltar, o app cobra de novo.", SemNbsp(aviso.Mensagem));

        // O limite voltou (aqui: a compra saiu): a próxima rodada cobra.
        (await c.Ctx.Transacoes.SingleAsync(t => t.Id == compra.Id)).Ativo = false;
        await c.Ctx.SaveChangesAsync();
        await Job(c.Ctx).ExecuteAsync();
        Assert.Equal(StatusTransacao.Executado, (await c.Ctx.Transacoes.AsNoTracking().SingleAsync(t => t.Id == netflix.Id)).StatusTransacao);
    }

    [Fact]
    public async Task PoucoLimite_PassaAMaisAntiga_EAOutraFica()
    {
        var c = Build(limite: 100m);
        var primeira = Lancar(c, "Academia", 60m, Hoje.AddDays(-2), StatusTransacao.Previsao);
        var segunda = Lancar(c, "Streaming", 60m, Hoje.AddDays(-1), StatusTransacao.Previsao);
        var naConta = Lancar(c, "Luz", 500m, Hoje.AddDays(-1), StatusTransacao.Previsao, noCartao: false);

        await Job(c.Ctx).ExecuteAsync();

        var status = await c.Ctx.Transacoes.AsNoTracking().ToDictionaryAsync(t => t.Id, t => t.StatusTransacao);
        Assert.Equal(StatusTransacao.Executado, status[primeira.Id]);
        Assert.Equal(StatusTransacao.Previsao, status[segunda.Id]);
        Assert.Equal(StatusTransacao.Executado, status[naConta.Id]); // na conta não tem limite: passa
    }

    [Fact]
    public async Task ContaFixaVencida_GeradaAoAbrirALista_TambemRespeitaOLimite()
    {
        var c = Build(limite: 100m);
        var rec = await c.Ctx.Recorrentes.SingleAsync();
        // Conta fixa de R$ 80 com cobranças vencidas por gerar (abrir a lista gera as que venceram).
        rec.Valor = 80m;
        rec.Descricao = "Streaming";
        rec.DataInicio = HorarioBrasil.HojeData().AddMonths(-2);
        rec.Dia = rec.DataInicio.Day;
        rec.DataProximaGeracao = rec.DataInicio;
        await c.Ctx.SaveChangesAsync();

        await new RecorrenteService(c.Ctx, new FaturaService(c.Ctx), new FinancialEventLogService(c.Ctx)).GerarPendentesAsync(c.U);

        var geradas = await c.Ctx.Transacoes.AsNoTracking().Where(t => t.RecorrenteOrigemId == rec.Id).ToListAsync();
        Assert.True(geradas.Count >= 2);
        Assert.Equal(1, geradas.Count(t => t.StatusTransacao == StatusTransacao.Executado)); // só uma de 80 cabe em 100
        Assert.All(geradas.Where(t => t.StatusTransacao != StatusTransacao.Executado),
            t => Assert.Equal(StatusTransacao.Previsao, t.StatusTransacao));
    }

    // ── (2) aviso antes de salvar a compra ─────────────────────────────────

    private static readonly DateOnly Dia19 = new(2026, 10, 19);

    private static Task<DTOs.Transacao.AvisoDeCompraDto?> Avisar(Cenario c, decimal valor, bool noCartao = true) =>
        new AvisoDeCompraService(c.Ctx).AvisarAsync(c.U, valor, noCartao ? null : c.ContaId, noCartao ? c.CartaoId : null, Dia19);

    [Fact]
    public async Task Cartao_FaltaLimiteProQueVem_NaoCabe_OuFolga()
    {
        var c = Build(limite: 1_000m);
        Lancar(c, "Netflix", 55.90m, new DateOnly(2026, 10, 25), StatusTransacao.Previsao);
        Lancar(c, "Spotify", 21.90m, new DateOnly(2026, 11, 2), StatusTransacao.Previsao);
        Lancar(c, "Depois de 30 dias", 999m, new DateOnly(2026, 12, 1), StatusTransacao.Previsao);

        var aperta = await Avisar(c, 980m); // sobram 20: nem Netflix nem Spotify passam
        Assert.Equal(("alerta", "Se fizer essa compra, falta limite no cartão Nubank pra:", "Limite disponível hoje: R$ 1.000,00."),
            (aperta!.Tom, aperta.Texto, SemNbsp(aperta.Detalhe)));
        Assert.Equal(new[] { ("Netflix", new DateOnly(2026, 10, 25), 55.90m), ("Spotify", new DateOnly(2026, 11, 2), 21.90m) },
            aperta.Itens.Select(i => (i.Descricao, i.Data, i.Valor)));
        Assert.All(aperta.Itens, i => Assert.NotNull(i.ContaFixaId)); // a linha leva pra conta fixa (pausar/cancelar)

        var naoCabe = await Avisar(c, 1_001m);
        Assert.Equal(("negativo", "Não cabe no limite do cartão Nubank.", "Limite disponível hoje: R$ 1.000,00."),
            (naoCabe!.Tom, naoCabe.Texto, SemNbsp(naoCabe.Detalhe)));
        Assert.Empty(naoCabe.Itens);

        Assert.Null(await Avisar(c, 900m)); // sobram 100: cabem as duas
    }

    [Fact]
    public async Task Conta_FaltaSaldoProQueVem_ContandoOQueEntraAntes()
    {
        var c = Build(limite: 1_000m);
        Lancar(c, "Salário de setembro", 1_000m, new DateOnly(2026, 9, 30), StatusTransacao.Executado, noCartao: false, daContaFixa: false, tipo: TipoTransacao.Receita);
        Lancar(c, "Aluguel", 1_500m, new DateOnly(2026, 11, 5), StatusTransacao.Previsao, noCartao: false);

        var aperta = await Avisar(c, 300m, noCartao: false);
        Assert.Equal(("alerta", "Se fizer essa compra, falta saldo na conta Itaú pra:", "Saldo da conta hoje: R$ 1.000,00."),
            (aperta!.Tom, aperta.Texto, SemNbsp(aperta.Detalhe)));
        Assert.Equal("Aluguel", Assert.Single(aperta.Itens).Descricao);

        // O salário previsto entra antes do aluguel: aí cabe.
        Lancar(c, "Salário", 3_000m, new DateOnly(2026, 11, 5), StatusTransacao.Previsao, noCartao: false, daContaFixa: false, tipo: TipoTransacao.Receita);
        Assert.Null(await Avisar(c, 300m, noCartao: false));
    }

    [Fact]
    public async Task CartaoOuContaDeOutraPessoa_404()
    {
        var c = Build(limite: 1_000m);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            new AvisoDeCompraService(c.Ctx).AvisarAsync(Guid.NewGuid(), 10m, null, c.CartaoId, Dia19));
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            new AvisoDeCompraService(c.Ctx).AvisarAsync(Guid.NewGuid(), 10m, c.ContaId, null, Dia19));
    }
}

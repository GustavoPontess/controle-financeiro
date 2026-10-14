using System.Text.Json;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.CartaoCredito;
using ControleFinanceiro.Api.DTOs.Fatura;
using ControleFinanceiro.Api.DTOs.Parcelamento;
using ControleFinanceiro.Api.DTOs.ParcelaTransacao;
using ControleFinanceiro.Api.DTOs.Recorrente;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Jobs;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Regra ÚNICA de limite do cartão (<see cref="RegrasFinanceiras.LimitesUsadosDosCartoesAsync"/>), como no
/// banco: comprou, o usado sobe; pagou a fatura (mesmo em parte), o usado desce na medida do pago; compra
/// parcelada bloqueia todas as parcelas não pagas. Antes eram duas regras: o card da tela de cartões
/// mostrava "Disponível R$ 5.000 de R$ 5.000" com R$ 1.500 em parcelamentos (ignorava parcela e subtraía
/// o ValorPago inteiro) e o LimiteCalculator não soltava nada com pagamento parcial.
/// </summary>
public class LimiteCartaoRegraUnicaTests
{
    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(
                Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    private sealed record Cenario(Guid UsuarioId, Guid CartaoId, Guid ContaId);

    /// <summary>Cartão de R$ 5.000 (fecha dia 10, vence dia 20) + conta com saldo folgado pra pagar.</summary>
    private static async Task<Cenario> SeedAsync(AppDbContext ctx, decimal limite = 5_000)
    {
        var usuarioId = Guid.NewGuid();
        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = "Nubank", TemCredito = true, LimiteTotal = limite,
            DiaFechamento = 10, DiaVencimento = 20, CriadoPor = usuarioId, Ativo = true,
        };
        var conta = new Conta
        {
            Id = Guid.NewGuid(), Nome = "Conta", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuarioId,
        };
        ctx.CartoesCredito.Add(cartao);
        ctx.Contas.Add(conta);
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Salário", Valor = 100_000, Tipo = TipoTransacao.Receita,
            ContaId = conta.Id, Data = DateOnly.FromDateTime(DateTime.UtcNow), CriadoPor = usuarioId,
        });
        await ctx.SaveChangesAsync();
        return new Cenario(usuarioId, cartao.Id, conta.Id);
    }

    /// <summary>Compra à vista no crédito pelo caminho real (a fatura do ciclo nasce/é achada no service).</summary>
    private static Task<Transacao> ComprarAsync(
        AppDbContext ctx, Cenario c, decimal valor, StatusTransacao status = StatusTransacao.Executado) =>
        new TransacaoService(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx)).CriarTransacaoAsync(new Transacao
        {
            Descricao = "Compra", Valor = valor, Tipo = TipoTransacao.Despesa, CartaoCreditoId = c.CartaoId,
            UsadoComoCredito = true, MeioPagamento = MeioPagamento.Credito, StatusTransacao = status,
            Data = DateOnly.FromDateTime(DateTime.UtcNow),
        }, c.UsuarioId);

    private static ParcelamentoService Parcelamentos(AppDbContext ctx) =>
        new(ctx, new FinancialEventLogService(ctx), new LimiteCalculatorService(ctx), new FaturaService(ctx));

    private static Task<ParcelamentoDetalheDto> ParcelarAsync(AppDbContext ctx, Cenario c, decimal valor, int parcelas) =>
        Parcelamentos(ctx).CriarAsync(new CriarParcelamentoDto
        {
            Descricao = "Geladeira", Valor = valor, Tipo = TipoParcelamento.CompraParcelada,
            CartaoCreditoId = c.CartaoId, DataCompra = DateTime.UtcNow.Date, Parcelas = parcelas,
            // 1ª parcela na fatura em que a compra cai (regra do #275) — "o mês de hoje" é recusado
            // quando o dia de hoje já passou do fechamento.
            PrimeiraParcelaMes = TestHelpers.MesDaFatura(DateTime.UtcNow, 10),
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, c.UsuarioId);

    private static Task PagarFaturaAsync(AppDbContext ctx, Cenario c, Guid faturaId, decimal valor) =>
        new FaturaService(ctx).PagarFaturaAsync(faturaId,
            new PagarFaturaDto { ContaId = c.ContaId, Valor = valor, DataPagamento = DateTime.UtcNow }, c.UsuarioId,
            Guid.NewGuid().ToString());

    private static Task<LimiteCalculatorService.LimiteSnapshot> LimiteAsync(AppDbContext ctx, Cenario c) =>
        new LimiteCalculatorService(ctx).CalcularAsync(c.CartaoId, c.UsuarioId);

    private static async Task<decimal> UsadoAsync(AppDbContext ctx, Cenario c) =>
        (await LimiteAsync(ctx, c)).LimiteBloqueado;

    /// <summary>O card como a tela de cartões recebe (listagem).</summary>
    private static async Task<CartaoCreditoDto> CardAsync(AppDbContext ctx, Cenario c) =>
        (await new CartaoCreditoService(ctx).ListarAsync(c.UsuarioId)).Single(x => x.Id == c.CartaoId);

    /// <summary>Calculadora, card da listagem e card do detalhe dão o MESMO usado/disponível.</summary>
    private static async Task AssertMesmoNumeroEmTodosOsPontosAsync(AppDbContext ctx, Cenario c, decimal usado)
    {
        var snap = await LimiteAsync(ctx, c);
        var card = await CardAsync(ctx, c);
        var detalhe = (await new CartaoCreditoService(ctx).BuscarPorIdAsync(c.CartaoId, c.UsuarioId))!;

        Assert.Equal(usado, snap.LimiteBloqueado);
        Assert.Equal(snap.LimiteTotal - usado, snap.LimiteDisponivel);
        Assert.Equal(snap.LimiteBloqueado, card.LimiteUsado);
        Assert.Equal(snap.LimiteDisponivel, card.LimiteDisponivel);
        Assert.Equal(snap.LimiteBloqueado, detalhe.LimiteUsado);
        Assert.Equal(snap.LimiteDisponivel, detalhe.LimiteDisponivel);
    }

    // ══ Comprou → usado sobe; pagou → usado desce na medida do pago ════════════

    [Fact]
    public async Task CompraAVista_UsadoSobeEDisponivelDesce()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx);
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 0m);

        await ComprarAsync(ctx, c, 300m);

        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 300m);
        Assert.Equal(4_700m, (await CardAsync(ctx, c)).LimiteDisponivel);
    }

    [Fact]
    public async Task PagamentoParcial_UsadoCaiSoOPago()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx);
        var compra = await ComprarAsync(ctx, c, 1_000m);

        await PagarFaturaAsync(ctx, c, compra.FaturaId!.Value, 400m);

        // Antes o LimiteCalculator só soltava com a fatura Pago: seguia 1.000 usado depois de pagar 400.
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 600m);

        await PagarFaturaAsync(ctx, c, compra.FaturaId!.Value, 600m);
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 0m);
    }

    [Fact]
    public async Task Parcelado3x_BloqueiaAsTresParcelas_InclusiveAsDeFaturasFuturas()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx);

        var p = await ParcelarAsync(ctx, c, 1_500m, 3);

        // O cenário visto na tela: R$ 1.500 parcelados e o card dizia "Disponível R$ 5.000 de R$ 5.000".
        Assert.Equal(3, p.Parcelas.Select(x => x.FaturaId).Distinct().Count());
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 1_500m);
        Assert.Equal(3_500m, (await CardAsync(ctx, c)).LimiteDisponivel);
    }

    [Fact]
    public async Task PagarAFaturaQueTemAParcela_LiberaAParteQuePagou()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx);
        var p = await ParcelarAsync(ctx, c, 1_500m, 3); // 3 × 500
        var primeira = p.Parcelas.Single(x => x.Numero == 1);
        var faturaDaPrimeira = primeira.FaturaId;

        await PagarFaturaAsync(ctx, c, faturaDaPrimeira, 200m);
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 1_300m);

        await PagarFaturaAsync(ctx, c, faturaDaPrimeira, 300m);

        // A parcela 1/3 segue Pendente no banco (pagar a fatura só soma ValorPago), mas a fatura está
        // coberta: não bloqueia mais. Antes o LimiteCalculator seguia bloqueando os 1.500.
        Assert.Equal(StatusParcela.Pendente,
            (await ctx.ParcelasTransacao.AsNoTracking().SingleAsync(x => x.Id == primeira.Id)).Status);
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 1_000m);
    }

    [Fact]
    public async Task ParcelaCancelada_Libera_EParcelamentoCanceladoLiberaTudo()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx);
        var p = await ParcelarAsync(ctx, c, 1_500m, 3);
        var parcelas = new ParcelaTransacaoService(ctx, new FinancialEventLogService(ctx), new LimiteCalculatorService(ctx));

        var resultado = await parcelas.CancelarAsync(p.Parcelas.Single(x => x.Numero == 3).Id,
            new CancelarParcelaDto { Motivo = "Devolvido", IdempotencyKey = Guid.NewGuid().ToString() }, c.UsuarioId);

        Assert.Equal(1_000m, resultado.NovoLimite.LimiteBloqueado);
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 1_000m);

        var cancelamento = await Parcelamentos(ctx).CancelarAsync(p.Id,
            new CancelarParcelamentoDto { Motivo = "Desisti", IdempotencyKey = Guid.NewGuid().ToString() }, c.UsuarioId);

        Assert.Equal(0m, cancelamento.NovoLimite.LimiteBloqueado);
        Assert.Equal(5_000m, cancelamento.NovoLimite.LimiteDisponivel);
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 0m);
    }

    [Fact]
    public async Task Previsao_NaoBloqueiaLimite_ApareceSoComoExposicaoFutura()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx);
        await ComprarAsync(ctx, c, 100m);
        await ComprarAsync(ctx, c, 250m, StatusTransacao.Previsao); // ex.: assinatura prevista no cartão

        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 100m);
        Assert.Equal(250m, (await LimiteAsync(ctx, c)).ExposicaoFuturaPrevisao);
    }

    [Fact]
    public async Task FaturaComExcessoPago_NaoLiberaOLimiteDasOutras()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx);
        var hoje = DateTime.UtcNow.Date;
        // A: cobra 300 e tem 500 pagos (pagou tudo e uma compra foi excluída depois) → sobra crédito de 200.
        // B: cobra 400, nada pago.
        var a = new Fatura
        {
            Id = Guid.NewGuid(), CartaoCreditoId = c.CartaoId, CriadoPor = c.UsuarioId, ValorPago = 500,
            DataInicio = hoje.AddMonths(-2), DataFechamento = hoje.AddMonths(-1), DataVencimento = hoje.AddDays(-20),
            EstadoCiclo = EstadoCicloFatura.Fechada, EstadoPagamento = EstadoPagamentoFatura.Pago,
        };
        var b = new Fatura
        {
            Id = Guid.NewGuid(), CartaoCreditoId = c.CartaoId, CriadoPor = c.UsuarioId,
            DataInicio = hoje.AddMonths(-1), DataFechamento = hoje.AddDays(5), DataVencimento = hoje.AddDays(15),
        };
        Transacao Compra(Fatura f, decimal valor) => new()
        {
            Id = Guid.NewGuid(), Descricao = "Compra", Valor = valor, Tipo = TipoTransacao.Despesa,
            CartaoCreditoId = c.CartaoId, FaturaId = f.Id, UsadoComoCredito = true, Data = DateOnly.FromDateTime(f.DataInicio),
            CriadoPor = c.UsuarioId,
        };
        ctx.Faturas.AddRange(a, b);
        ctx.Transacoes.AddRange(Compra(a, 300), Compra(b, 400));
        await ctx.SaveChangesAsync();

        // 400, não 200: o crédito de A não paga a compra de B.
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 400m);
    }

    [Fact]
    public async Task Estouro_DisponivelFicaNegativo_EmTodosOsPontos()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx, limite: 1_000);

        await ComprarAsync(ctx, c, 1_200m); // compra à vista não passa pela trava de limite

        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 1_200m);
        Assert.Equal(-200m, (await CardAsync(ctx, c)).LimiteDisponivel);
    }

    // ══ Mesmo número que o total da fatura ═══════════════════════════════════

    [Fact]
    public async Task CenarioMisto_MesmoNumeroNaCalculadoraNoCard_EBateComORegraDoTotalDaFatura()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx);
        var compra = await ComprarAsync(ctx, c, 300m);
        await ComprarAsync(ctx, c, 50m, StatusTransacao.Previsao);
        var p = await ParcelarAsync(ctx, c, 1_200m, 3); // 3 × 400
        await PagarFaturaAsync(ctx, c, compra.FaturaId!.Value, 200m);
        await new ParcelaTransacaoService(ctx, new FinancialEventLogService(ctx), new LimiteCalculatorService(ctx))
            .CancelarAsync(p.Parcelas.Single(x => x.Numero == 2).Id,
                new CancelarParcelaDto { Motivo = "Devolvido", IdempotencyKey = Guid.NewGuid().ToString() }, c.UsuarioId);

        // Prova que as somas em SQL espelham a regra em C# do total da fatura (ValorTotalFatura), só sem
        // a previsão: por fatura, total efetivado − pago, com piso 0.
        var faturas = await ctx.Faturas
            .Include(f => f.Transacoes).Include(f => f.ParcelasTransacao)
            .AsNoTracking()
            .Where(f => f.CartaoCreditoId == c.CartaoId)
            .ToListAsync();
        var esperado = faturas.Sum(f => Math.Max(0m,
            RegrasFinanceiras.ValorTotalFatura(
                f.Transacoes.Where(t => t.StatusTransacao == StatusTransacao.Executado), f.ParcelasTransacao)
            - f.ValorPago));

        // 300 à vista + 3 × 400 − 200 pagos − 400 da parcela cancelada; a previsão de 50 fica fora.
        Assert.Equal(900m, esperado);
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, esperado);
        // A versão em C# pra fatura carregada (usada pela trilha de auditoria) dá o mesmo número do SQL.
        Assert.Equal(esperado, faturas.Sum(RegrasFinanceiras.LimiteUsadoDaFatura));
    }

    // ══ Recorrente no cartão ═════════════════════════════════════════════════

    private static RecorrenteService Recorrentes(AppDbContext ctx) =>
        new(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx));

    /// <summary>Recorrente mensal de R$ 80 no cartão pelo caminho real (modal de nova transação, modo recorrente).</summary>
    private static Task CriarRecorrenteNoCartaoAsync(AppDbContext ctx, Cenario c, DateTime inicio) =>
        Recorrentes(ctx).CriarAsync(new CriarRecorrenteDto
        {
            Descricao = "Streaming", Valor = 80, Tipo = (int)TipoTransacao.Despesa, CartaoCreditoId = c.CartaoId,
            Frequencia = (int)FrequenciaRecorrencia.Mensal, Dia = inicio.Day, DataInicio = inicio,
        }, c.UsuarioId);

    /// <summary>Paga o restante de toda fatura do cartão que ainda deve (o usuário quitou tudo).</summary>
    private static async Task QuitarTodasAsFaturasAsync(AppDbContext ctx, Cenario c)
    {
        var faturas = await ctx.Faturas.AsNoTracking()
            .Include(f => f.Transacoes).Include(f => f.ParcelasTransacao)
            .Where(f => f.CartaoCreditoId == c.CartaoId)
            .ToListAsync();
        foreach (var f in faturas)
        {
            var restante = RegrasFinanceiras.ValorRestanteFatura(f);
            if (restante > 0)
                await PagarFaturaAsync(ctx, c, f.Id, restante);
        }
    }

    [Fact]
    public async Task RecorrenteCriadaPeloApp_EfetivadaPeloJob_UsaLimite_EPagarAFaturaLibera()
    {
        // O revisor achou: CriarAsync gravava as 3 primeiras ocorrências SEM UsadoComoCredito. Efetivada
        // pelo job, a compra ficava fora das duas consultas da regra — usado 0 com R$ 80 comprados.
        var ctx = CreateContext();
        var c = await SeedAsync(ctx);
        var hoje = DateTime.UtcNow.Date;

        await CriarRecorrenteNoCartaoAsync(ctx, c, hoje);
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 0m); // só previsão: ainda não usa limite
        Assert.Equal(240m, (await LimiteAsync(ctx, c)).ExposicaoFuturaPrevisao);

        await new ExecutarRecorrentesJob(ctx).ExecuteAsync();

        var executada = await ctx.Transacoes.AsNoTracking()
            .SingleAsync(t => t.Descricao == "Streaming" && t.StatusTransacao == StatusTransacao.Executado);
        Assert.True(executada.UsadoComoCredito);
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 80m);
        Assert.Equal(160m, (await LimiteAsync(ctx, c)).ExposicaoFuturaPrevisao);

        // Entra no total da fatura (dá pra pagar) e pagar solta o limite.
        var fatura = await ctx.Faturas.AsNoTracking()
            .Include(f => f.Transacoes).Include(f => f.ParcelasTransacao)
            .SingleAsync(f => f.Id == executada.FaturaId);
        Assert.Equal(80m, RegrasFinanceiras.ValorRestanteFatura(fatura));
        await PagarFaturaAsync(ctx, c, fatura.Id, 80m);
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 0m);
    }

    [Fact]
    public async Task RecorrenteComInicioNoPassado_ListagemLancaNaFaturaDoPeriodo_QuitarTudoLiberaTudo()
    {
        // O revisor achou: com início há mais de 3 meses, GerarPendentesAsync (roda em todo GET /recorrentes)
        // lançava as ocorrências vencidas no cartão SEM fatura — pagar todas as faturas deixava 320 presos.
        var ctx = CreateContext();
        var c = await SeedAsync(ctx);
        var hoje = DateTime.UtcNow.Date;

        await CriarRecorrenteNoCartaoAsync(ctx, c, hoje.AddMonths(-6)); // previsões de -6 a -4 meses
        await Recorrentes(ctx).GerarPendentesAsync(c.UsuarioId);       // efetivadas de -3 meses a hoje
        await new ExecutarRecorrentesJob(ctx).ExecuteAsync();           // efetiva as previsões vencidas

        var ocorrencias = await ctx.Transacoes.AsNoTracking().Where(t => t.Descricao == "Streaming").ToListAsync();
        Assert.Equal(7, ocorrencias.Count);
        Assert.All(ocorrencias, t =>
        {
            Assert.Equal(StatusTransacao.Executado, t.StatusTransacao);
            Assert.NotNull(t.FaturaId);
            Assert.True(t.UsadoComoCredito);
        });
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 560m);

        await QuitarTodasAsFaturasAsync(ctx, c);

        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 0m);
    }

    [Fact]
    public async Task OcorrenciaAntigaSemFatura_BloqueiaAteOJobPorNaFatura_DepoisPagarLibera()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx);
        var outro = await SeedAsync(ctx);
        var hoje = DateTime.UtcNow.Date;
        var recorrenteId = Guid.NewGuid();

        // Fatura do ciclo passado já quitada: cobrou 100 e recebeu 100.
        var dataPassada = hoje.AddMonths(-1);
        var (inicio, fechamento) = FaturaService.CalcularPeriodo(dataPassada, 10);
        var quitada = new Fatura
        {
            Id = Guid.NewGuid(), CartaoCreditoId = c.CartaoId, CriadoPor = c.UsuarioId, ValorPago = 100,
            DataInicio = inicio, DataFechamento = fechamento, DataVencimento = FaturaService.CalcularVencimento(fechamento, 20),
            EstadoCiclo = EstadoCicloFatura.Fechada, EstadoPagamento = EstadoPagamentoFatura.Pago,
        };
        ctx.Faturas.Add(quitada);
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Compra", Valor = 100, Tipo = TipoTransacao.Despesa,
            CartaoCreditoId = c.CartaoId, FaturaId = quitada.Id, UsadoComoCredito = true, Data = DateOnly.FromDateTime(dataPassada),
            CriadoPor = c.UsuarioId,
        });

        // Ocorrências como GerarPendentesAsync gravava antes da correção: efetivadas, no cartão, sem fatura.
        Transacao SemFatura(Guid cartaoId, DateTime data) => new()
        {
            Id = Guid.NewGuid(), Descricao = "Streaming", Valor = 80, Tipo = TipoTransacao.Despesa,
            CartaoCreditoId = cartaoId, Data = DateOnly.FromDateTime(data), CriadoPor = c.UsuarioId, RecorrenteOrigemId = recorrenteId,
        };
        var doCiclo = SemFatura(c.CartaoId, hoje);
        var daQuitada = SemFatura(c.CartaoId, dataPassada);
        var noCartaoAlheio = SemFatura(outro.CartaoId, hoje); // cartão de outro usuário gravado antes da checagem
        ctx.Transacoes.AddRange(doCiclo, daQuitada, noCartaoAlheio);
        // Débito com o cartão (tem conta): saiu da conta, não do limite. Previsão sem fatura: não foi cobrada.
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Padaria", Valor = 70, Tipo = TipoTransacao.Despesa,
            ContaId = c.ContaId, CartaoCreditoId = c.CartaoId, Data = DateOnly.FromDateTime(hoje), CriadoPor = c.UsuarioId,
        });
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Previsto", Valor = 60, Tipo = TipoTransacao.Despesa,
            CartaoCreditoId = c.CartaoId, StatusTransacao = StatusTransacao.Previsao, Data = DateOnly.FromDateTime(hoje.AddDays(5)),
            CriadoPor = c.UsuarioId,
        });
        await ctx.SaveChangesAsync();

        // Rede de segurança: nenhuma fatura cobra as duas ocorrências do cartão, então seguem usando limite.
        // A do cartão alheio não entra em nenhum dos dois (dono do lançamento ≠ dono do cartão).
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 160m);
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, outro, 0m);

        await new ExpandirRecorrentesJob(ctx, new FaturaService(ctx), new RecorrenteService(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx)), NullLogger<ExpandirRecorrentesJob>.Instance)
            .ExecuteAsync();

        var depois = await ctx.Transacoes.AsNoTracking()
            .Where(t => t.RecorrenteOrigemId == recorrenteId)
            .ToDictionaryAsync(t => t.Id);
        // Do ciclo: entrou na fatura do período como compra no crédito — cobrada, então pagar libera.
        Assert.NotNull(depois[doCiclo.Id].FaturaId);
        Assert.True(depois[doCiclo.Id].UsadoComoCredito);
        // Do ciclo quitado: entra na fatura dela fora do total (foi dada por paga sem ela) e para de
        // segurar limite — cobrar deixaria restante numa fatura Pago, que não aceita mais pagamento.
        Assert.Equal(quitada.Id, depois[daQuitada.Id].FaturaId);
        Assert.False(depois[daQuitada.Id].UsadoComoCredito);
        // Cartão de outro usuário: o job não mexe (nem cria fatura no cartão alheio).
        Assert.Null(depois[noCartaoAlheio.Id].FaturaId);
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 80m);

        await PagarFaturaAsync(ctx, c, depois[doCiclo.Id].FaturaId!.Value, 80m);
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 0m);
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, outro, 0m);
    }

    // ══ Trilha de auditoria do limite (FinancialEventLog) ════════════════════

    /// <summary>Eventos LimiteLiberado do cartão, com o payload já lido.</summary>
    private static async Task<List<(FinancialEventLog Log, JsonElement Payload)>> LimiteLiberadoAsync(
        AppDbContext ctx, Cenario c) =>
        (await ctx.FinancialEventLogs.AsNoTracking()
            .Where(e => e.Tipo == FinancialEventType.LimiteLiberado && e.EntidadeId == c.CartaoId)
            .ToListAsync())
        .Select(e => (e, JsonDocument.Parse(e.PayloadJson!).RootElement))
        .ToList();

    private static decimal Delta(JsonElement payload) => payload.GetProperty("delta").GetDecimal();

    /// <summary>
    /// Parcelado 2 × 200. A fatura da 1ª (F1) cobra 300 (parcela + compra de 100) com 250 pagos → segura 50;
    /// a da 2ª segura 200. Cartão: 250 usados.
    /// </summary>
    private static async Task<(ParcelamentoDetalheDto Parcelamento, Guid F1)> ParceladoComFaturaPagaEmParteAsync(
        AppDbContext ctx, Cenario c)
    {
        var p = await ParcelarAsync(ctx, c, 400m, 2);
        var f1 = p.Parcelas.Single(x => x.Numero == 1).FaturaId;
        var inicioF1 = (await ctx.Faturas.AsNoTracking().SingleAsync(f => f.Id == f1)).DataInicio;
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Mercado", Valor = 100, Tipo = TipoTransacao.Despesa,
            CartaoCreditoId = c.CartaoId, FaturaId = f1, UsadoComoCredito = true, Data = DateOnly.FromDateTime(inicioF1), CriadoPor = c.UsuarioId,
        });
        await ctx.SaveChangesAsync();
        await PagarFaturaAsync(ctx, c, f1, 250m);
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 250m);
        return (p, f1);
    }

    [Fact]
    public async Task CancelarParcela_FaturaPagaEmParte_TrilhaRegistraSoOQueOLimiteSoltou()
    {
        // O revisor achou: o log gravava delta = −200 (a parcela inteira), mas a fatura só segurava 50.
        var ctx = CreateContext();
        var c = await SeedAsync(ctx);
        var (p, f1) = await ParceladoComFaturaPagaEmParteAsync(ctx, c);
        var primeira = p.Parcelas.Single(x => x.Numero == 1);

        var resultado = await new ParcelaTransacaoService(ctx, new FinancialEventLogService(ctx), new LimiteCalculatorService(ctx))
            .CancelarAsync(primeira.Id,
                new CancelarParcelaDto { Motivo = "Devolvido", IdempotencyKey = Guid.NewGuid().ToString() }, c.UsuarioId);

        var (log, payload) = Assert.Single(await LimiteLiberadoAsync(ctx, c), e => e.Payload.TryGetProperty("parcelaId", out _));
        Assert.Equal(250m, log.ValorAntes);
        Assert.Equal(200m, log.ValorDepois);
        Assert.Equal(-50m, Delta(payload));
        Assert.Equal(f1, payload.GetProperty("faturaId").GetGuid());
        Assert.Equal(200m, payload.GetProperty("valorParcela").GetDecimal()); // o teto fica registrado à parte
        // O "depois" da trilha é o limite que todo mundo mostra agora.
        Assert.Equal(log.ValorDepois, resultado.NovoLimite.LimiteBloqueado);
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 200m);
    }

    [Fact]
    public async Task CancelarParcelamento_TrilhaRegistraSoOQueOLimiteSoltou_NaoOValorDasParcelas()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx);
        var (p, _) = await ParceladoComFaturaPagaEmParteAsync(ctx, c);

        var resultado = await Parcelamentos(ctx).CancelarAsync(p.Id,
            new CancelarParcelamentoDto { Motivo = "Desisti", IdempotencyKey = Guid.NewGuid().ToString() }, c.UsuarioId);

        // 400 em parcelas canceladas, mas só 250 estavam presos (F1 já tinha 250 pagos de 300).
        var (log, payload) = Assert.Single(await LimiteLiberadoAsync(ctx, c),
            e => e.Payload.TryGetProperty("valorParcelasCanceladas", out _));
        Assert.Equal(250m, log.ValorAntes);
        Assert.Equal(0m, log.ValorDepois);
        Assert.Equal(-250m, Delta(payload));
        Assert.Equal(400m, payload.GetProperty("valorParcelasCanceladas").GetDecimal());
        Assert.Equal(log.ValorDepois, resultado.NovoLimite.LimiteBloqueado);
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 0m);
    }

    [Fact]
    public async Task PagarFatura_TrilhaRegistraOLimiteSolto_APartePagaDaPrevisaoNaoSolta()
    {
        // Antes pagar fatura não gravava evento de limite nenhum, mas o usado cai a cada pagamento.
        var ctx = CreateContext();
        var c = await SeedAsync(ctx);
        var compra = await ComprarAsync(ctx, c, 100m);
        await ComprarAsync(ctx, c, 50m, StatusTransacao.Previsao); // mesma fatura; cobra mas não usa limite
        var faturaId = compra.FaturaId!.Value;

        await PagarFaturaAsync(ctx, c, faturaId, 30m);
        await PagarFaturaAsync(ctx, c, faturaId, 120m); // quita os 150 da fatura

        var eventos = (await LimiteLiberadoAsync(ctx, c)).OrderByDescending(e => e.Log.ValorAntes).ToList();
        Assert.Equal(2, eventos.Count);
        Assert.Equal((100m, 70m, -30m), (eventos[0].Log.ValorAntes!.Value, eventos[0].Log.ValorDepois!.Value, Delta(eventos[0].Payload)));
        // 120 pagos, mas só 70 estavam presos: os 50 que cobrem a previsão não soltam nada.
        Assert.Equal((70m, 0m, -70m), (eventos[1].Log.ValorAntes!.Value, eventos[1].Log.ValorDepois!.Value, Delta(eventos[1].Payload)));
        Assert.All(eventos, e => Assert.Equal(faturaId, e.Payload.GetProperty("faturaId").GetGuid()));
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 0m);
    }

    [Fact]
    public async Task PagarParcelaAntecipada_ComPrevisaoNaFatura_TrilhaRegistraSoOQueOLimiteSoltou()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx);
        var p = await ParcelarAsync(ctx, c, 400m, 2); // 2 × 200
        var primeira = p.Parcelas.Single(x => x.Numero == 1);
        var inicioF1 = (await ctx.Faturas.AsNoTracking().SingleAsync(f => f.Id == primeira.FaturaId)).DataInicio;
        // Previsão de 100 na mesma fatura: F1 cobra 300 (200 efetivados).
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Assinatura", Valor = 100, Tipo = TipoTransacao.Despesa,
            CartaoCreditoId = c.CartaoId, FaturaId = primeira.FaturaId, UsadoComoCredito = true,
            StatusTransacao = StatusTransacao.Previsao, Data = DateOnly.FromDateTime(inicioF1), CriadoPor = c.UsuarioId,
        });
        await ctx.SaveChangesAsync();
        await PagarFaturaAsync(ctx, c, primeira.FaturaId, 50m); // F1 segura 150; cartão 350

        await new ParcelaTransacaoService(ctx, new FinancialEventLogService(ctx), new LimiteCalculatorService(ctx))
            .PagarAntecipadoAsync(primeira.Id,
                new PagarParcelaDto { ContaPagamentoId = c.ContaId, IdempotencyKey = Guid.NewGuid().ToString() }, c.UsuarioId);

        // Restante 250 ≥ 200 → aceita. Pago 250 ≥ efetivado 200: a fatura solta os 150 que segurava, não 200.
        var (log, payload) = Assert.Single(await LimiteLiberadoAsync(ctx, c), e => e.Payload.TryGetProperty("parcelaId", out _));
        Assert.Equal(350m, log.ValorAntes);
        Assert.Equal(200m, log.ValorDepois);
        Assert.Equal(-150m, Delta(payload));
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 200m);
    }

    // ══ Consumidores e isolamento ════════════════════════════════════════════

    [Fact]
    public async Task TravaDeCompraParcelada_UsaORegraNova_PagamentoParcialAbreEspaco()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx);
        var compra = await ComprarAsync(ctx, c, 4_000m);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => ParcelarAsync(ctx, c, 2_000m, 2));
        Assert.Contains("Limite insuficiente", ex.Message);

        // Pagou 1.500 da fatura: disponível 2.500 → o parcelamento de 2.000 passa (antes seguia recusado
        // até a fatura inteira ser paga).
        await PagarFaturaAsync(ctx, c, compra.FaturaId!.Value, 1_500m);
        await ParcelarAsync(ctx, c, 2_000m, 2);

        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 4_500m);
    }

    [Fact]
    public async Task Isolamento_CartaoEComprasDeOutroUsuario_NaoEntram()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx);
        var outro = await SeedAsync(ctx);
        await ComprarAsync(ctx, c, 100m);
        await ComprarAsync(ctx, outro, 900m);
        // Lançamento de outro usuário apontando pro MEU cartão, fora de fatura (id de cartão alheio que
        // escapou numa escrita): não mexe no meu limite.
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Intruso", Valor = 700, Tipo = TipoTransacao.Despesa,
            CartaoCreditoId = c.CartaoId, Data = DateOnly.FromDateTime(DateTime.UtcNow), CriadoPor = outro.UsuarioId,
        });
        await ctx.SaveChangesAsync();

        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 100m);
        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, outro, 900m);

        // Id de cartão alheio pedido com o meu usuário: a calculadora recusa, a regra soma zero e a
        // listagem não mostra.
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => new LimiteCalculatorService(ctx).CalcularAsync(outro.CartaoId, c.UsuarioId));
        Assert.Equal(0m, await RegrasFinanceiras.LimiteUsadoDoCartaoAsync(ctx, outro.CartaoId, c.UsuarioId));
        Assert.DoesNotContain(await new CartaoCreditoService(ctx).ListarAsync(c.UsuarioId), x => x.Id == outro.CartaoId);
        Assert.Null(await new CartaoCreditoService(ctx).BuscarPorIdAsync(outro.CartaoId, c.UsuarioId));
    }

    [Fact]
    public async Task CartaoSemCredito_SemLimiteUsadoNemDisponivel()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        ctx.CartoesCredito.Add(new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = "Débito", TemCredito = false, TemDebito = true, CriadoPor = usuarioId, Ativo = true,
        });
        await ctx.SaveChangesAsync();

        var card = Assert.Single(await new CartaoCreditoService(ctx).ListarAsync(usuarioId));

        Assert.Null(card.LimiteUsado);
        Assert.Null(card.LimiteDisponivel);
    }

    // ══ SQL ═══════════════════════════════════════════════════════════════════

    [Fact]
    public void ConsultasDeLimite_NoPostgres_SomamNoSql()
    {
        // Só monta o SQL (ToQueryString não abre conexão): prova que as consultas traduzem no Npgsql (sem
        // avaliação no cliente) e que a soma é do banco, não do histórico carregado em memória.
        using var ctx = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=naoconecta;Username=x;Password=x")
            .Options);
        var ids = new[] { Guid.NewGuid() };

        var porFatura = RegrasFinanceiras.ConsultaLimitePorFatura(ctx, ids, Guid.NewGuid()).ToQueryString();
        var semFatura = RegrasFinanceiras.ConsultaComprasSemFatura(ctx, ids, Guid.NewGuid()).ToQueryString();

        Assert.Contains("SUM(", porFatura, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("\"ValorPago\"", porFatura);
        Assert.Contains("\"StatusTransacao\"", porFatura);
        Assert.Contains("\"ValorComJuros\"", porFatura);
        Assert.Contains("\"CriadoPor\"", porFatura);
        Assert.Contains("GROUP BY", semFatura, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("SUM(", semFatura, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("\"CriadoPor\"", semFatura);
    }
}

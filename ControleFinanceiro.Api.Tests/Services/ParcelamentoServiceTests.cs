using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Parcelamento;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;
using System.Linq;

namespace ControleFinanceiro.Api.Tests.Services;

public class ParcelamentoServiceTests
{
    private static AppDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static void SetupTestData(AppDbContext context, Guid usuarioId, Guid cartaoId)
    {
        var cartao = new CartaoCredito
        {
            Id = cartaoId,
            Nome = "Test Card",
            TemCredito = true,
            LimiteTotal = 10000,
            DiaFechamento = 10,
            DiaVencimento = 20,
            CriadoPor = usuarioId,
            Ativo = true
        };
        context.CartoesCredito.Add(cartao);

        var categoria = new Categoria
        {
            Id = Guid.NewGuid(),
            Descricao = "Teste",
            Finalidade = Finalidade.Despesa
        };
        context.Categorias.Add(categoria);

        context.SaveChanges();
    }

    [Fact]
    public async Task CriarAsync_CriaParcelamentoComParcelas()
    {
        // Arrange
        var usuarioId = Guid.NewGuid();
        var cartaoId = Guid.NewGuid();
        var context = CreateInMemoryContext();
        SetupTestData(context, usuarioId, cartaoId);

        var dto = new CriarParcelamentoDto
        {
            Descricao = "Test Parcelamento",
            Valor = 300,
            Tipo = TipoParcelamento.CompraParcelada,
            CartaoCreditoId = cartaoId,
            DataCompra = HorarioBrasil.HojeData(),
            Parcelas = 3,
            PrimeiraParcelaMes = TestHelpers.MesDaFatura(DateTime.UtcNow, 10),
            CategoriaId = context.Categorias.First().Id,
            IdempotencyKey = Guid.NewGuid().ToString()
        };

        var limiteService = new LimiteCalculatorService(context);
        var eventLogService = new FinancialEventLogService(context);
        var faturaService = new FaturaService(context);
        var service = new ParcelamentoService(context, eventLogService, limiteService, faturaService);

        // Act
        var resultado = await service.CriarAsync(dto, usuarioId);

        // Assert
        Assert.NotNull(resultado);
        Assert.Equal(3, resultado.Parcelas.Count);
        Assert.All(resultado.Parcelas, p =>
        {
            Assert.Equal(StatusParcela.Pendente, p.Status);
            Assert.True(p.Numero > 0);
            Assert.True(p.Numero <= 3);
        });
    }

    [Fact]
    public async Task CriarAsync_ValidaValorMinimo()
    {
        // Arrange
        var usuarioId = Guid.NewGuid();
        var cartaoId = Guid.NewGuid();
        var context = CreateInMemoryContext();
        SetupTestData(context, usuarioId, cartaoId);

        var dto = new CriarParcelamentoDto
        {
            Descricao = "Test",
            Valor = 0,
            Tipo = TipoParcelamento.CompraParcelada,
            CartaoCreditoId = cartaoId,
            DataCompra = HorarioBrasil.HojeData(),
            Parcelas = 3,
            PrimeiraParcelaMes = TestHelpers.MesDaFatura(DateTime.UtcNow, 10),
            IdempotencyKey = Guid.NewGuid().ToString()
        };

        var limiteService = new LimiteCalculatorService(context);
        var eventLogService = new FinancialEventLogService(context);
        var faturaService = new FaturaService(context);
        var service = new ParcelamentoService(context, eventLogService, limiteService, faturaService);

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CriarAsync(dto, usuarioId));
    }

    [Fact]
    public async Task CriarAsync_ValidaQuantidadeParcelas()
    {
        // Arrange
        var usuarioId = Guid.NewGuid();
        var cartaoId = Guid.NewGuid();
        var context = CreateInMemoryContext();
        SetupTestData(context, usuarioId, cartaoId);

        var dto = new CriarParcelamentoDto
        {
            Descricao = "Test",
            Valor = 100,
            Tipo = TipoParcelamento.CompraParcelada,
            CartaoCreditoId = cartaoId,
            DataCompra = HorarioBrasil.HojeData(),
            Parcelas = 1,
            PrimeiraParcelaMes = TestHelpers.MesDaFatura(DateTime.UtcNow, 10),
            IdempotencyKey = Guid.NewGuid().ToString()
        };

        var limiteService = new LimiteCalculatorService(context);
        var eventLogService = new FinancialEventLogService(context);
        var faturaService = new FaturaService(context);
        var service = new ParcelamentoService(context, eventLogService, limiteService, faturaService);

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CriarAsync(dto, usuarioId));
    }

    [Fact]
    public async Task CancelarAsync_MarcaParcelamentoInativo()
    {
        // Arrange
        var usuarioId = Guid.NewGuid();
        var cartaoId = Guid.NewGuid();
        var context = CreateInMemoryContext();
        SetupTestData(context, usuarioId, cartaoId);

        // Criar parcelamento
        var dto = new CriarParcelamentoDto
        {
            Descricao = "Test",
            Valor = 300,
            Tipo = TipoParcelamento.CompraParcelada,
            CartaoCreditoId = cartaoId,
            DataCompra = HorarioBrasil.HojeData(),
            Parcelas = 3,
            PrimeiraParcelaMes = TestHelpers.MesDaFatura(DateTime.UtcNow, 10),
            CategoriaId = context.Categorias.First().Id,
            IdempotencyKey = Guid.NewGuid().ToString()
        };

        var limiteService = new LimiteCalculatorService(context);
        var eventLogService = new FinancialEventLogService(context);
        var faturaService = new FaturaService(context);
        var service = new ParcelamentoService(context, eventLogService, limiteService, faturaService);

        var criado = await service.CriarAsync(dto, usuarioId);

        // Act - Cancelar
        var cancelDto = new CancelarParcelamentoDto
        {
            Motivo = "Teste",
            IdempotencyKey = Guid.NewGuid().ToString()
        };
        var resultado = await service.CancelarAsync(criado.Id, cancelDto, usuarioId);

        // Assert
        Assert.NotNull(resultado);
        var parcelamentoAtualizado = await context.Parcelamentos.FindAsync(criado.Id);
        Assert.False(parcelamentoAtualizado!.Ativo);
        Assert.Equal("Teste", parcelamentoAtualizado.MotivoCancelamento);
    }

    [Fact]
    public async Task ObterDetalhe_ParcelamentoCancelado_RestanteNaoContaParcelaCancelada()
    {
        var usuarioId = Guid.NewGuid();
        var cartaoId = Guid.NewGuid();
        var context = CreateInMemoryContext();
        SetupTestData(context, usuarioId, cartaoId);
        var service = new ParcelamentoService(context, new FinancialEventLogService(context),
            new LimiteCalculatorService(context), new FaturaService(context));

        var criado = await service.CriarAsync(new CriarParcelamentoDto
        {
            Descricao = "Livro", Valor = 200, Tipo = TipoParcelamento.CompraParcelada, CartaoCreditoId = cartaoId,
            DataCompra = HorarioBrasil.HojeData(), Parcelas = 2, PrimeiraParcelaMes = TestHelpers.MesDaFatura(DateTime.UtcNow, 10),
            CategoriaId = context.Categorias.First().Id, IdempotencyKey = Guid.NewGuid().ToString(),
        }, usuarioId);
        // Parcela 1 paga (antecipada); a 2 é cancelada junto com o parcelamento.
        var p1 = context.ParcelasTransacao.Single(p => p.ParcelamentoId == criado.Id && p.Numero == 1);
        p1.Status = StatusParcela.Paga;
        await context.SaveChangesAsync();
        await service.CancelarAsync(criado.Id, new CancelarParcelamentoDto
        {
            Motivo = "Devolvido", IdempotencyKey = Guid.NewGuid().ToString(),
        }, usuarioId);

        var detalhe = await service.ObterDetalheAsync(criado.Id, usuarioId);

        Assert.False(detalhe.Ativo);
        Assert.Equal(100m, detalhe.ValorPago);
        // Antes: total − pago = 100 — a parcela cancelada aparecia como "a pagar".
        Assert.Equal(0m, detalhe.ValorRestante);
    }

    [Fact]
    public async Task ListarAsync_RetornaParcelamentosDoUsuario()
    {
        // Arrange
        var usuarioId = Guid.NewGuid();
        var outroUsuarioId = Guid.NewGuid();
        var cartaoId = Guid.NewGuid();
        var context = CreateInMemoryContext();
        SetupTestData(context, usuarioId, cartaoId);

        var parcelamento = new Parcelamento
        {
            Id = Guid.NewGuid(),
            CartaoCreditoId = cartaoId,
            Ativo = true,
            CriadoPor = usuarioId,
            CriadoEm = DateTime.UtcNow,
            Tipo = TipoParcelamento.CompraParcelada
        };
        context.Parcelamentos.Add(parcelamento);

        var parcelamentoOutroUsuario = new Parcelamento
        {
            Id = Guid.NewGuid(),
            CartaoCreditoId = cartaoId,
            Ativo = true,
            CriadoPor = outroUsuarioId,
            CriadoEm = DateTime.UtcNow,
            Tipo = TipoParcelamento.CompraParcelada
        };
        context.Parcelamentos.Add(parcelamentoOutroUsuario);
        await context.SaveChangesAsync();

        var limiteService = new LimiteCalculatorService(context);
        var eventLogService = new FinancialEventLogService(context);
        var faturaService = new FaturaService(context);
        var service = new ParcelamentoService(context, eventLogService, limiteService, faturaService);

        // Act
        var resultado = await service.ListarAsync(usuarioId, true);

        // Assert
        Assert.Single(resultado.Items);
        Assert.Equal(parcelamento.Id, resultado.Items.First().Id);
    }

    // ══ Primeira parcela = mês em que FECHA a fatura (rótulo da tela Cartões) ════════════
    //
    // Bug (dogfooding 2026-09-28): a parcela ganhava o DIA DA COMPRA no mês escolhido e a fatura saía do
    // ciclo dessa data. Cartão que fecha dia 10, compra 28/09, "primeira parcela: outubro" → parcela em
    // 28/10 → fatura que fecha 10/11 (Novembro na tela Cartões); a mesma escolha com compra no dia 5
    // caía em outubro. "Hoje" vem de um relógio fixo: o piso da 1ª parcela também depende da fatura
    // aberta hoje, e os cenários precisam ser os mesmos em qualquer dia em que a suíte rodar.

    private sealed record Ctx(AppDbContext Db, ParcelamentoService Service, Guid UsuarioId, CartaoCredito Cartao);

    /// <summary>Relógio parado num instante UTC — o "hoje" do service nos testes.</summary>
    private sealed class RelogioFixo(DateTime agoraUtc) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(DateTime.SpecifyKind(agoraUtc, DateTimeKind.Utc));
    }

    /// <param name="hoje">Dia de "hoje" (meio-dia UTC = o mesmo dia em todo o Brasil).</param>
    private static Task<Ctx> CriarCtxAsync(int? diaFechamento, int? diaVencimento, DateTime hoje) =>
        CriarCtxNoInstanteAsync(diaFechamento, diaVencimento, hoje.Date.AddHours(12));

    private static async Task<Ctx> CriarCtxNoInstanteAsync(int? diaFechamento, int? diaVencimento, DateTime agoraUtc)
    {
        var db = CreateInMemoryContext();
        var usuarioId = Guid.NewGuid();
        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = "Cartão", TemCredito = true, LimiteTotal = 100_000,
            DiaFechamento = diaFechamento, DiaVencimento = diaVencimento, CriadoPor = usuarioId, Ativo = true,
        };
        db.CartoesCredito.Add(cartao);
        await db.SaveChangesAsync();
        var service = new ParcelamentoService(
            db, new FinancialEventLogService(db), new LimiteCalculatorService(db), new FaturaService(db),
            new RelogioFixo(agoraUtc));
        return new Ctx(db, service, usuarioId, cartao);
    }

    private static Task<ParcelamentoDetalheDto> CriarAsync(
        Ctx c, DateTime dataCompra, string primeiraParcelaMes, int parcelas = 3,
        TipoParcelamento tipo = TipoParcelamento.CompraParcelada, decimal? taxa = null, decimal valor = 900,
        int jaPagas = 0) =>
        c.Service.CriarAsync(new CriarParcelamentoDto
        {
            Descricao = "Geladeira", Valor = valor, Tipo = tipo, CartaoCreditoId = c.Cartao.Id,
            DataCompra = dataCompra, Parcelas = parcelas, PrimeiraParcelaMes = primeiraParcelaMes,
            ParcelasJaPagas = jaPagas, TaxaJuroMensal = taxa, IdempotencyKey = Guid.NewGuid().ToString(),
        }, c.UsuarioId);

    private static async Task<List<Fatura>> FaturasDasParcelasAsync(Ctx c, ParcelamentoDetalheDto p)
    {
        var faturas = new List<Fatura>();
        foreach (var parcela in p.Parcelas.OrderBy(x => x.Numero))
            faturas.Add(await c.Db.Faturas.AsNoTracking().SingleAsync(f => f.Id == parcela.FaturaId));
        return faturas;
    }

    [Theory]
    [InlineData(5)]  // antes do fechamento: a compra cai na fatura de setembro
    [InlineData(10)] // no dia do fechamento: já é a fatura de outubro
    [InlineData(28)] // depois do fechamento: fatura de outubro (o caso do bug)
    public async Task CriarAsync_MesmoMesEscolhido_CaiSempreNaFaturaQueFechaNesseMes_EmFaturasConsecutivas(int diaCompra)
    {
        // Compra de hoje (a fatura aberta hoje é a da compra — o piso é o mesmo).
        var c = await CriarCtxAsync(diaFechamento: 10, diaVencimento: 20, hoje: new DateTime(2025, 9, diaCompra));

        var p = await CriarAsync(c, new DateTime(2025, 9, diaCompra), "2025-10", parcelas: 3);

        var faturas = await FaturasDasParcelasAsync(c, p);
        Assert.Equal(new[] { new DateTime(2025, 10, 10), new DateTime(2025, 11, 10), new DateTime(2025, 12, 10) },
            faturas.Select(f => f.DataFechamento));
        Assert.Equal(new[] { new DateTime(2025, 9, 10), new DateTime(2025, 10, 10), new DateTime(2025, 11, 10) },
            faturas.Select(f => f.DataInicio));
        Assert.Equal(3, faturas.Select(f => f.Id).Distinct().Count());
        // Vencimento da parcela = vencimento real da fatura (dia 20), não o dia da compra.
        Assert.Equal(new[] { new DateTime(2025, 10, 20), new DateTime(2025, 11, 20), new DateTime(2025, 12, 20) },
            p.Parcelas.OrderBy(x => x.Numero).Select(x => x.DataVencimento));
        Assert.All(p.Parcelas, x =>
        {
            var f = faturas.Single(f => f.Id == x.FaturaId);
            Assert.Equal(f.DataFechamento, x.FaturaMesReferencia);
            Assert.Equal(f.DataVencimento, x.FaturaDataVencimento);
        });
    }

    [Fact]
    public async Task CriarAsync_VencimentoNoMesSeguinteAoFechamento_ParcelaVenceNoVencimentoRealDaFatura()
    {
        // Fecha dia 28, vence dia 5: a fatura "de setembro" fecha 28/09 e vence 05/10.
        var c = await CriarCtxAsync(diaFechamento: 28, diaVencimento: 5, hoje: new DateTime(2025, 9, 15));

        var p = await CriarAsync(c, new DateTime(2025, 9, 15), "2025-09", parcelas: 2);

        var faturas = await FaturasDasParcelasAsync(c, p);
        Assert.Equal(new DateTime(2025, 9, 28), faturas[0].DataFechamento);
        Assert.Equal(new DateTime(2025, 10, 28), faturas[1].DataFechamento);
        var parcelas = p.Parcelas.OrderBy(x => x.Numero).ToList();
        Assert.Equal(FaturaService.CalcularVencimento(new DateTime(2025, 9, 28), 5), parcelas[0].DataVencimento);
        Assert.Equal(new DateTime(2025, 10, 5), parcelas[0].DataVencimento);
        Assert.Equal(new DateTime(2025, 11, 5), parcelas[1].DataVencimento);
    }

    [Fact]
    public async Task CriarAsync_FaturaJaExistente_UsaAMesmaEOVencimentoGravadoNela()
    {
        // Fatura de outubro já existe (ex.: o dia de vencimento do cartão mudou depois): a parcela entra
        // nela e vence quando ELA vence — o que a tela Cartões mostra.
        var c = await CriarCtxAsync(diaFechamento: 10, diaVencimento: 20, hoje: new DateTime(2025, 9, 28));
        var existente = new Fatura
        {
            Id = Guid.NewGuid(), CartaoCreditoId = c.Cartao.Id, CriadoPor = c.UsuarioId,
            DataInicio = new DateTime(2025, 9, 10), DataFechamento = new DateTime(2025, 10, 10),
            DataVencimento = new DateTime(2025, 10, 17),
            EstadoCiclo = EstadoCicloFatura.Aberta, EstadoPagamento = EstadoPagamentoFatura.NaoPago,
        };
        c.Db.Faturas.Add(existente);
        await c.Db.SaveChangesAsync();

        var p = await CriarAsync(c, new DateTime(2025, 9, 28), "2025-10", parcelas: 2);

        var primeira = p.Parcelas.Single(x => x.Numero == 1);
        Assert.Equal(existente.Id, primeira.FaturaId);
        Assert.Equal(new DateTime(2025, 10, 17), primeira.DataVencimento);
        Assert.Equal(1, await c.Db.Faturas.CountAsync(f => f.DataFechamento == new DateTime(2025, 10, 10)));
    }

    [Fact]
    public async Task CriarAsync_PrimeiraParcelaAntesDaFaturaDaCompra_Recusa_SemGravarNada()
    {
        // Compra 28/09 com fechamento dia 10 cai na fatura de outubro: setembro já fechou antes da compra.
        var c = await CriarCtxAsync(diaFechamento: 10, diaVencimento: 20, hoje: new DateTime(2025, 9, 28));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => CriarAsync(c, new DateTime(2025, 9, 28), "2025-09"));

        Assert.Contains("outubro de 2025", ex.Message);
        Assert.Empty(c.Db.Parcelamentos);
        Assert.Empty(c.Db.ParcelasTransacao);
        Assert.Empty(c.Db.Faturas);
    }

    [Theory]
    [InlineData("2026-07")] // fatura da compra (fechou 10/07, venceu 20/07)
    [InlineData("2026-09")] // fechou 10/09 e venceu 20/09 — a última antes da aberta
    public async Task CriarAsync_CompraRetroativa_PrimeiraParcelaEmFaturaQueJaVenceu_Recusa_SemGravarNada(string mes)
    {
        // Hoje 28/09/2026, compra de 15/06/2026. A fatura da compra (julho) e as seguintes até setembro já
        // VENCERAM: parcela nova nelas nasceria Pendente numa fatura vencida (juros + multa do
        // FaturaAtrasoJob) ou já paga (restante volta a aparecer e o pagamento passa a ser recusado).
        var c = await CriarCtxAsync(diaFechamento: 10, diaVencimento: 20, hoje: new DateTime(2026, 9, 28));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => CriarAsync(c, new DateTime(2026, 6, 15), mes, parcelas: 12));

        Assert.Contains("outubro de 2026: as anteriores já venceram", ex.Message);
        Assert.Empty(c.Db.Parcelamentos);
        Assert.Empty(c.Db.ParcelasTransacao);
        Assert.Empty(c.Db.Faturas);
    }

    [Fact]
    public async Task CriarAsync_CompraRetroativa_ComecaNaFaturaAbertaHoje()
    {
        var c = await CriarCtxAsync(diaFechamento: 10, diaVencimento: 20, hoje: new DateTime(2026, 9, 28));

        var p = await CriarAsync(c, new DateTime(2026, 6, 15), "2026-10", parcelas: 2);

        var faturas = await FaturasDasParcelasAsync(c, p);
        Assert.Equal(new DateTime(2026, 10, 10), faturas[0].DataFechamento);
        Assert.Equal(new DateTime(2026, 11, 10), faturas[1].DataFechamento);
        Assert.Equal(new DateTime(2026, 10, 20), p.Parcelas.Single(x => x.Numero == 1).DataVencimento);
    }

    [Fact]
    public async Task CriarAsync_NoiteDaVesperaDoFechamento_NoBrasil_AceitaAFaturaQueAindaEstaAberta()
    {
        // 02:30 UTC de 10/10 = 23:30 de 09/10 em Brasília: pra quem usa, a fatura de outubro (fecha 10/10)
        // ainda está aberta, e é o que o form sugere. Com o dia UTC (10/10) o back recusaria.
        var c = await CriarCtxNoInstanteAsync(diaFechamento: 10, diaVencimento: 20,
            agoraUtc: new DateTime(2026, 10, 10, 2, 30, 0));

        var p = await CriarAsync(c, new DateTime(2026, 10, 9), "2026-10", parcelas: 2);

        var faturas = await FaturasDasParcelasAsync(c, p);
        Assert.Equal(new DateTime(2026, 10, 10), faturas[0].DataFechamento);
    }

    [Fact]
    public async Task CriarAsync_FaturaQueFechouHojeMasNaoVenceu_AceitaAPrimeiraParcela()
    {
        // 06:00 UTC de 10/10 = já é dia 10 em todo o Brasil: a fatura de outubro FECHOU hoje, mas só vence
        // 20/10 — e a compra de 09/10 caiu nela. É nela que o banco cobra a 1ª parcela; travar na aberta
        // (novembro) era o bug de "uma fatura depois" voltando pela porta dos fundos.
        var c = await CriarCtxNoInstanteAsync(diaFechamento: 10, diaVencimento: 20,
            agoraUtc: new DateTime(2026, 10, 10, 6, 0, 0));

        var p = await CriarAsync(c, new DateTime(2026, 10, 9), "2026-10", parcelas: 2);

        var faturas = await FaturasDasParcelasAsync(c, p);
        Assert.Equal(new DateTime(2026, 10, 10), faturas[0].DataFechamento);
    }

    [Fact]
    public async Task CriarAsync_CompraAntesDoFechamentoLancadaDepois_CaiNaFaturaFechadaAindaNaoVencida()
    {
        // Fecha dia 25, vence dia 5. Compra 24/09 lançada 28/09: a fatura de setembro fechou 25/09 mas só
        // vence 05/10 — o banco cobra a 1ª parcela nela.
        var c = await CriarCtxAsync(diaFechamento: 25, diaVencimento: 5, hoje: new DateTime(2026, 9, 28));

        var p = await CriarAsync(c, new DateTime(2026, 9, 24), "2026-09", parcelas: 2);

        var faturas = await FaturasDasParcelasAsync(c, p);
        Assert.Equal(new DateTime(2026, 9, 25), faturas[0].DataFechamento);
        Assert.Equal(new DateTime(2026, 10, 5), p.Parcelas.Single(x => x.Numero == 1).DataVencimento);
    }

    [Fact]
    public async Task CriarAsync_FaturaAnteriorJaVenceu_Recusa()
    {
        // Fecha dia 25, vence dia 5. Hoje 06/10: a fatura de setembro (fechou 25/09) venceu ontem — a 1ª
        // parcela de uma compra de 24/09 vai pra de outubro.
        var c = await CriarCtxAsync(diaFechamento: 25, diaVencimento: 5, hoje: new DateTime(2026, 10, 6));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => CriarAsync(c, new DateTime(2026, 9, 24), "2026-09", parcelas: 2));

        Assert.Contains("outubro de 2026: as anteriores já venceram", ex.Message);
    }

    [Fact]
    public async Task CriarAsync_PrimeiraParcelaNaFaturaDaCompraAntesDoFechamento_Aceita()
    {
        // Compra 05/09 (antes do fechamento dia 10) ainda cai na fatura de setembro: é a mais cedo aceita.
        var c = await CriarCtxAsync(diaFechamento: 10, diaVencimento: 20, hoje: new DateTime(2025, 9, 5));

        var p = await CriarAsync(c, new DateTime(2025, 9, 5), "2025-09", parcelas: 2);

        var faturas = await FaturasDasParcelasAsync(c, p);
        Assert.Equal(new DateTime(2025, 9, 10), faturas[0].DataFechamento);
        Assert.Equal(new DateTime(2025, 9, 20), p.Parcelas.Single(x => x.Numero == 1).DataVencimento);
    }

    [Fact]
    public async Task CriarAsync_CartaoSemDiaFechamento_FaturaDoMesCalendario()
    {
        var c = await CriarCtxAsync(diaFechamento: null, diaVencimento: 10, hoje: new DateTime(2025, 9, 28));

        var p = await CriarAsync(c, new DateTime(2025, 9, 28), "2025-09", parcelas: 2);

        var faturas = await FaturasDasParcelasAsync(c, p);
        Assert.Equal(new DateTime(2025, 9, 1), faturas[0].DataInicio);
        Assert.Equal(new DateTime(2025, 9, 30), faturas[0].DataFechamento);
        Assert.Equal(new DateTime(2025, 10, 31), faturas[1].DataFechamento);
        Assert.Equal(new DateTime(2025, 10, 10), p.Parcelas.Single(x => x.Numero == 1).DataVencimento);

        // Agosto fechou antes da compra de setembro.
        await Assert.ThrowsAsync<InvalidOperationException>(() => CriarAsync(c, new DateTime(2025, 9, 28), "2025-08"));
    }

    [Fact]
    public async Task CriarAsync_DiaFechamento31EmMesCurto_FechaNoUltimoDiaDoMes()
    {
        var c = await CriarCtxAsync(diaFechamento: 31, diaVencimento: 10, hoje: new DateTime(2025, 1, 15));

        var p = await CriarAsync(c, new DateTime(2025, 1, 15), "2025-02", parcelas: 2);

        var faturas = await FaturasDasParcelasAsync(c, p);
        Assert.Equal(new DateTime(2025, 1, 31), faturas[0].DataInicio);
        Assert.Equal(new DateTime(2025, 2, 28), faturas[0].DataFechamento);
        Assert.Equal(new DateTime(2025, 2, 28), faturas[1].DataInicio);
        Assert.Equal(new DateTime(2025, 3, 31), faturas[1].DataFechamento);
        var parcelas = p.Parcelas.OrderBy(x => x.Numero).ToList();
        Assert.Equal(new DateTime(2025, 3, 10), parcelas[0].DataVencimento);
        Assert.Equal(new DateTime(2025, 4, 10), parcelas[1].DataVencimento);
    }

    [Fact]
    public async Task CriarAsync_PIXCredito_MesmaRegraDeFatura_JurosInalterados()
    {
        var c = await CriarCtxAsync(diaFechamento: 10, diaVencimento: 20, hoje: new DateTime(2025, 9, 28));

        var p = await CriarAsync(c, new DateTime(2025, 9, 28), "2025-10", parcelas: 3,
            tipo: TipoParcelamento.PIXCredito, taxa: 2.5m, valor: 1000);

        // Juros simples: 1000 × 2,5% × 3 = 75 — não dependem da data de vencimento.
        Assert.Equal(1075m, p.ValorComJuros);
        Assert.Equal(1075m, p.Parcelas.Sum(x => x.ValorComJuros));
        var faturas = await FaturasDasParcelasAsync(c, p);
        Assert.Equal(new[] { new DateTime(2025, 10, 10), new DateTime(2025, 11, 10), new DateTime(2025, 12, 10) },
            faturas.Select(f => f.DataFechamento));
        Assert.Equal(new DateTime(2025, 10, 20), p.Parcelas.Single(x => x.Numero == 1).DataVencimento);
    }

    [Fact]
    public async Task ListarEDetalhe_ProximaParcela_TrazFaturaPeloFechamentoEVencimentoReal()
    {
        // Parcela antiga (antes da regra) guarda o dia da compra como DataVencimento: a tela usa a fatura.
        var c = await CriarCtxAsync(diaFechamento: 10, diaVencimento: 20, hoje: new DateTime(2025, 9, 28));
        var fatura = new Fatura
        {
            Id = Guid.NewGuid(), CartaoCreditoId = c.Cartao.Id, CriadoPor = c.UsuarioId,
            DataInicio = new DateTime(2025, 9, 10), DataFechamento = new DateTime(2025, 10, 10),
            DataVencimento = new DateTime(2025, 10, 20),
            EstadoCiclo = EstadoCicloFatura.Aberta, EstadoPagamento = EstadoPagamentoFatura.NaoPago,
        };
        var parcelamento = new Parcelamento
        {
            Id = Guid.NewGuid(), CriadoPor = c.UsuarioId, Tipo = TipoParcelamento.CompraParcelada, Descricao = "TV",
            DataCompra = new DateTime(2025, 9, 28), ValorTotal = 100, QuantidadeParcelas = 1,
            CartaoCreditoId = c.Cartao.Id, Ativo = true, CriadoEm = DateTime.UtcNow,
        };
        c.Db.Faturas.Add(fatura);
        c.Db.Parcelamentos.Add(parcelamento);
        c.Db.ParcelasTransacao.Add(new ParcelaTransacao
        {
            Id = Guid.NewGuid(), ParcelamentoId = parcelamento.Id, Numero = 1, QuantidadeTotal = 1,
            DataVencimento = new DateTime(2025, 9, 28), Valor = 100, FaturaId = fatura.Id,
            Status = StatusParcela.Pendente, CriadoPor = c.UsuarioId, CriadoEm = DateTime.UtcNow,
        });
        await c.Db.SaveChangesAsync();

        var lista = await c.Service.ListarAsync(c.UsuarioId);
        var detalhe = await c.Service.ObterDetalheAsync(parcelamento.Id, c.UsuarioId);

        var proxima = lista.Items.Single().ProximaParcela!;
        Assert.Equal(new DateTime(2025, 10, 10), proxima.FaturaMesReferencia);
        Assert.Equal(new DateTime(2025, 10, 20), proxima.FaturaDataVencimento);
        Assert.Equal(new DateTime(2025, 10, 10), detalhe.ProximaParcela!.FaturaMesReferencia);
        var parcela = detalhe.Parcelas.Single();
        Assert.Equal(new DateTime(2025, 10, 10), parcela.FaturaMesReferencia);
        Assert.Equal(new DateTime(2025, 10, 20), parcela.FaturaDataVencimento);
    }

    // ══ Compra em andamento: "estou na parcela 3 de 7" ══════════════════════════════════
    //
    // Dogfood 2026-10-09: parcelamento já no meio não entrava — a 1ª parcela caía numa fatura vencida e
    // o service recusava, então o jeito era registrar "parcelas 3 a 7 de 7" como uma compra nova de 5×.
    // Cartão como o Nubank (fecha dia 1, vence dia 8); hoje 12/10/2026 → a anterior (fechou 01/10)
    // venceu dia 8, a 1ª não vencida é a aberta, de novembro.

    private static Task<Ctx> CtxNubankAsync() =>
        CriarCtxAsync(diaFechamento: 1, diaVencimento: 8, hoje: new DateTime(2026, 10, 12));

    [Fact]
    public async Task CriarAsync_CompraEmAndamento_RegistraSoAsQueFaltam_ComONumeroCerto_EBloqueiaSoORestante()
    {
        var c = await CtxNubankAsync();

        // Compra 15/08 → 1ª na fatura de setembro; 2 pagas (set, out) → a próxima (3ª) vai em novembro.
        var p = await CriarAsync(c, new DateTime(2026, 8, 15), "2026-09", parcelas: 7, valor: 700, jaPagas: 2);

        Assert.Equal(new[] { 3, 4, 5, 6, 7 }, p.Parcelas.Select(x => x.Numero));
        Assert.All(p.Parcelas, x => Assert.Equal(7, x.QuantidadeTotal));
        Assert.All(p.Parcelas, x => Assert.Equal(StatusParcela.Pendente, x.Status));
        var faturas = await FaturasDasParcelasAsync(c, p);
        Assert.Equal(new[]
        {
            new DateTime(2026, 11, 1), new DateTime(2026, 12, 1), new DateTime(2027, 1, 1),
            new DateTime(2027, 2, 1), new DateTime(2027, 3, 1),
        }, faturas.Select(f => f.DataFechamento));
        // Nenhuma fatura de antes do app nasce (set/out já foram pagas no banco).
        Assert.Equal(5, await c.Db.Faturas.CountAsync());

        Assert.Equal(7, p.QuantidadeParcelas);
        Assert.Equal(2, p.ParcelasPagas);
        Assert.Equal(2, p.ParcelasPagasAntes);
        Assert.Equal(200m, p.ValorPagoAntes);
        Assert.Equal(200m, p.ValorPago);
        Assert.Equal(500m, p.ValorRestante);
        Assert.Equal(3, p.ProximaParcela!.Numero);
        Assert.Equal(700m, p.ValorOriginal);

        // Limite: só os 500 que faltam — as já pagas soltaram o limite delas no banco.
        var limite = await new LimiteCalculatorService(c.Db).CalcularAsync(c.Cartao.Id, c.UsuarioId);
        Assert.Equal(500m, limite.LimiteBloqueado);
        var bloqueio = await c.Db.FinancialEventLogs.SingleAsync(e => e.Tipo == FinancialEventType.LimiteBloqueado);
        Assert.Equal(500m, bloqueio.ValorDepois - bloqueio.ValorAntes);

        // Card da lista e KPI do topo contam do mesmo jeito.
        var item = (await c.Service.ListarAsync(c.UsuarioId)).Items.Single();
        Assert.Equal(2, item.ParcelasPagas);
        Assert.Equal(500m, item.ValorRestante);
        Assert.Equal(500m, (await c.Service.ObterStatsAsync(c.UsuarioId)).TotalRestante);
    }

    [Fact]
    public async Task CriarAsync_CompraEmAndamento_LimiteCobreSoORestante_Aceita()
    {
        // Limite 600, compra de 700 com 2 de 7 pagas: no banco ocupa só 500 — tem que caber.
        var c = await CtxNubankAsync();
        c.Cartao.LimiteTotal = 600;
        await c.Db.SaveChangesAsync();

        var p = await CriarAsync(c, new DateTime(2026, 8, 15), "2026-09", parcelas: 7, valor: 700, jaPagas: 2);

        Assert.Equal(500m, p.ValorRestante);
        var limite = await new LimiteCalculatorService(c.Db).CalcularAsync(c.Cartao.Id, c.UsuarioId);
        Assert.Equal(100m, limite.LimiteDisponivel);
    }

    [Fact]
    public async Task CriarAsync_CompraEmAndamento_CentavosDoRateio_PagoAntesMaisRestanteFechaOTotal()
    {
        var c = await CtxNubankAsync();

        // 1000 em 3× = 333,33 + 333,33 + 333,34 (o resto vai na última, que é registrada).
        var p = await CriarAsync(c, new DateTime(2026, 9, 15), "2026-10", parcelas: 3, valor: 1000, jaPagas: 1);

        Assert.Equal(new[] { 333.33m, 333.34m }, p.Parcelas.OrderBy(x => x.Numero).Select(x => x.Valor));
        Assert.Equal(333.33m, p.ValorPagoAntes);
        Assert.Equal(1000m, p.ValorPago + p.ValorRestante);
    }

    [Fact]
    public async Task CriarAsync_CompraEmAndamento_PIXCredito_JurosDaCompraInteira_PagoAntesComJuros()
    {
        var c = await CtxNubankAsync();

        // Juros simples da compra inteira: 1000 × 2,5% × 3 = 75 → 1075 = 358,33 + 358,33 + 358,34.
        var p = await CriarAsync(c, new DateTime(2026, 9, 15), "2026-10", parcelas: 3,
            tipo: TipoParcelamento.PIXCredito, taxa: 2.5m, valor: 1000, jaPagas: 1);

        Assert.Equal(1075m, p.ValorComJuros);
        Assert.Equal(358.33m, p.ValorPagoAntes);
        Assert.Equal(716.67m, p.ValorRestante);
        var limite = await new LimiteCalculatorService(c.Db).CalcularAsync(c.Cartao.Id, c.UsuarioId);
        Assert.Equal(716.67m, limite.LimiteBloqueado);
    }

    [Theory]
    [InlineData(7)]  // todas pagas: não sobra nada pra registrar
    [InlineData(-1)]
    public async Task CriarAsync_ParcelasJaPagasForaDaFaixa_Recusa_SemGravarNada(int jaPagas)
    {
        var c = await CtxNubankAsync();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => CriarAsync(c, new DateTime(2026, 8, 15), "2026-09", parcelas: 7, jaPagas: jaPagas));

        Assert.Contains("precisa sobrar pelo menos uma", ex.Message);
        Assert.Empty(c.Db.Parcelamentos);
        Assert.Empty(c.Db.ParcelasTransacao);
        Assert.Empty(c.Db.Faturas);
    }

    [Fact]
    public async Task CriarAsync_CompraEmAndamento_ProximaNumaFaturaQueJaVenceu_Recusa()
    {
        var c = await CtxNubankAsync();

        // Compra 15/07 (fatura de agosto) + 2 pagas → próxima em outubro, que venceu dia 8.
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => CriarAsync(c, new DateTime(2026, 7, 15), "2026-08", parcelas: 7, jaPagas: 2));

        Assert.Equal("A próxima parcela não pode ser antes da fatura de novembro de 2026: as anteriores já venceram.", ex.Message);
        Assert.Empty(c.Db.Parcelamentos);
    }

    [Fact]
    public async Task CriarAsync_CompraEmAndamento_PagasNaoCabemDesdeACompra_Recusa()
    {
        var c = await CtxNubankAsync();

        // Compra 05/10 cai na fatura de novembro: 2 já pagas exigiriam a 1ª em setembro, antes da compra.
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => CriarAsync(c, new DateTime(2026, 10, 5), "2026-09", parcelas: 7, jaPagas: 2));

        Assert.Equal("A próxima parcela não pode ser antes da fatura de janeiro de 2027: com 2 já pagas, " +
                     "a primeira cairia antes da fatura da compra.", ex.Message);
        Assert.Empty(c.Db.Parcelamentos);
    }

    [Fact]
    public async Task CriarAsync_CompraEmAndamento_ProximaDepoisDaFaturaAberta_Recusa()
    {
        var c = await CtxNubankAsync();

        // Próxima em dezembro → a 2ª (já paga) seria a de novembro, que nem fechou.
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => CriarAsync(c, new DateTime(2026, 8, 15), "2026-10", parcelas: 7, jaPagas: 2));

        Assert.Contains("não pode passar da fatura de novembro de 2026", ex.Message);
        Assert.Empty(c.Db.Parcelamentos);
    }

    [Fact]
    public async Task CriarAsync_CompraNova_SemTeto_PodeComecarDepoisDaFaturaAberta()
    {
        // O teto é só da compra em andamento: compra nova pode jogar a 1ª pra frente (ex.: carência).
        var c = await CtxNubankAsync();

        var p = await CriarAsync(c, new DateTime(2026, 10, 12), "2027-01", parcelas: 2);

        Assert.Equal(new[] { 1, 2 }, p.Parcelas.Select(x => x.Numero));
        Assert.Equal(0, p.ParcelasPagasAntes);
        Assert.Equal(0m, p.ValorPagoAntes);
    }

    [Fact]
    public async Task CancelarAsync_CompraEmAndamento_AsPagasAntesContamComoJaPagas_ERequeremEstorno()
    {
        var c = await CtxNubankAsync();
        var p = await CriarAsync(c, new DateTime(2026, 8, 15), "2026-09", parcelas: 7, valor: 700, jaPagas: 2);

        var r = await c.Service.CancelarAsync(p.Id,
            new CancelarParcelamentoDto { Motivo = "Devolvi", IdempotencyKey = Guid.NewGuid().ToString() }, c.UsuarioId);

        Assert.Equal(5, r.Canceladas);
        Assert.Equal(2, r.JaPagas);
        Assert.True(r.RequerEstorno);
        Assert.Equal(0m, r.NovoLimite.LimiteBloqueado);
        Assert.Equal(0m, (await c.Service.ObterStatsAsync(c.UsuarioId)).TotalRestante);
    }
}

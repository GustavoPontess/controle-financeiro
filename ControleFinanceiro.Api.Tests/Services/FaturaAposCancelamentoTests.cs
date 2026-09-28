using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Fatura;
using ControleFinanceiro.Api.DTOs.Parcelamento;
using ControleFinanceiro.Api.DTOs.ParcelaTransacao;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Jobs;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Fatura depois de cancelamento — dois furos do revisor na regra única de total:
/// (1) o total caía mas ninguém recalculava o EstadoPagamento: pagar R$ 100 de 300 e cancelar a
/// parcela de 200 deixava a fatura Parcial com restante 0 pra sempre — limite das compras à vista
/// preso, job de atraso cobrando juros de fatura coberta, "Vencida" na tela, pagamento recusado;
/// (2) parcela quitada pelo pagamento da FATURA segue Pendente, e cancelar o parcelamento a tirava do
/// total — o dinheiro pago sumia sem sinalizar estorno.
/// Revisão da correção: "quitada pela fatura" olha a COBERTURA real (ValorPago ≥ total), não o rótulo
/// Pago — parcela que caiu numa fatura já Pago não foi paga; a do ciclo aberto coberto (Parcial com
/// restante 0) foi. E o fechamento pelo job registra a quitação no audit log como o cancelamento.
/// </summary>
public class FaturaAposCancelamentoTests
{
    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(
                Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    private sealed record Cenario(
        Guid UsuarioId, Guid CartaoId, Guid ContaId, Guid FaturaId, Guid FaturaSeguinteId,
        Guid ParcelamentoId, Guid ParcelaNaFaturaId);

    private const int DiaFechamento = 10;
    private const int DiaVencimento = 20;

    /// <summary>
    /// Fatura F = compra à vista A (100) + parcela 1/2 (200) → total 300; fatura seguinte G = parcela
    /// 2/2 (200). <paramref name="cicloFechado"/>: F fechou há 20 dias e venceu há 10; senão F é o ciclo
    /// ABERTO de hoje, com as mesmas datas que ObterOuCriarFaturaAsync calcula (a próxima compra cai nela).
    /// </summary>
    private static async Task<Cenario> SeedAsync(AppDbContext ctx, bool cicloFechado)
    {
        var usuarioId = Guid.NewGuid();
        var hoje = DateTime.UtcNow.Date;
        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = "Cartão", TemCredito = true, LimiteTotal = 10_000,
            DiaFechamento = DiaFechamento, DiaVencimento = DiaVencimento, CriadoPor = usuarioId, Ativo = true,
        };
        var conta = new Conta
        {
            Id = Guid.NewGuid(), Nome = "Conta", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuarioId,
        };

        var (inicio, fechamento) = cicloFechado
            ? (hoje.AddDays(-50), hoje.AddDays(-20))
            : FaturaService.CalcularPeriodo(hoje, DiaFechamento);
        var vencimento = cicloFechado ? hoje.AddDays(-10) : FaturaService.CalcularVencimento(fechamento, DiaVencimento);

        var fatura = new Fatura
        {
            Id = Guid.NewGuid(), CartaoCreditoId = cartao.Id, CriadoPor = usuarioId,
            DataInicio = inicio, DataFechamento = fechamento, DataVencimento = vencimento,
            EstadoCiclo = cicloFechado ? EstadoCicloFatura.Fechada : EstadoCicloFatura.Aberta,
            EstadoPagamento = EstadoPagamentoFatura.NaoPago,
        };
        var seguinte = new Fatura
        {
            Id = Guid.NewGuid(), CartaoCreditoId = cartao.Id, CriadoPor = usuarioId,
            DataInicio = fechamento, DataFechamento = fechamento.AddMonths(1), DataVencimento = vencimento.AddMonths(1),
            EstadoCiclo = EstadoCicloFatura.Aberta, EstadoPagamento = EstadoPagamentoFatura.NaoPago,
        };
        var parcelamento = new Parcelamento
        {
            Id = Guid.NewGuid(), CriadoPor = usuarioId, Tipo = TipoParcelamento.CompraParcelada, Descricao = "TV",
            DataCompra = inicio.AddDays(1), ValorTotal = 400, QuantidadeParcelas = 2, CartaoCreditoId = cartao.Id,
            Ativo = true,
        };
        ParcelaTransacao Parcela(int numero, Fatura f) => new()
        {
            Id = Guid.NewGuid(), ParcelamentoId = parcelamento.Id, Numero = numero, QuantidadeTotal = 2,
            DataVencimento = f.DataVencimento, Valor = 200, FaturaId = f.Id,
            Status = StatusParcela.Pendente, CriadoPor = usuarioId,
        };
        var p1 = Parcela(1, fatura);

        ctx.CartoesCredito.Add(cartao);
        ctx.Contas.Add(conta);
        ctx.Faturas.AddRange(fatura, seguinte);
        ctx.Parcelamentos.Add(parcelamento);
        ctx.ParcelasTransacao.AddRange(p1, Parcela(2, seguinte));
        ctx.Transacoes.AddRange(
            new Transacao
            {
                Id = Guid.NewGuid(), Descricao = "Mercado", Valor = 100, Tipo = TipoTransacao.Despesa,
                CartaoCreditoId = cartao.Id, FaturaId = fatura.Id, UsadoComoCredito = true,
                MeioPagamento = MeioPagamento.Credito, Data = inicio.AddDays(1), CriadoPor = usuarioId,
            },
            new Transacao
            {
                Id = Guid.NewGuid(), Descricao = "Salário", Valor = 10_000, Tipo = TipoTransacao.Receita,
                ContaId = conta.Id, Data = hoje, CriadoPor = usuarioId,
            });
        await ctx.SaveChangesAsync();

        return new Cenario(usuarioId, cartao.Id, conta.Id, fatura.Id, seguinte.Id, parcelamento.Id, p1.Id);
    }

    private static ParcelaTransacaoService Parcelas(AppDbContext ctx) =>
        new(ctx, new FinancialEventLogService(ctx), new LimiteCalculatorService(ctx));

    private static ParcelamentoService Parcelamentos(AppDbContext ctx) =>
        new(ctx, new FinancialEventLogService(ctx), new LimiteCalculatorService(ctx), new FaturaService(ctx));

    private static Task PagarFaturaAsync(AppDbContext ctx, Cenario c, decimal valor) =>
        new FaturaService(ctx).PagarFaturaAsync(c.FaturaId,
            new PagarFaturaDto { ContaId = c.ContaId, Valor = valor, DataPagamento = DateTime.UtcNow }, c.UsuarioId,
            Guid.NewGuid().ToString());

    private static Task CancelarParcelaAsync(AppDbContext ctx, Cenario c) =>
        Parcelas(ctx).CancelarAsync(c.ParcelaNaFaturaId, new CancelarParcelaDto
        {
            Motivo = "Devolvido",
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, c.UsuarioId);

    private static Task<Fatura> FaturaAsync(AppDbContext ctx, Guid id) =>
        ctx.Faturas.AsNoTracking().SingleAsync(f => f.Id == id);

    private static async Task<FaturaDto> DtoAsync(AppDbContext ctx, Cenario c, Guid faturaId) =>
        (await new FaturaService(ctx).ListarPorCartaoAsync(c.CartaoId, c.UsuarioId)).Single(f => f.Id == faturaId);

    private static async Task<decimal> BloqueadoAsync(AppDbContext ctx, Cenario c) =>
        (await new LimiteCalculatorService(ctx).CalcularAsync(c.CartaoId, c.UsuarioId)).LimiteBloqueado;

    // ══ Achado 1 — estado de pagamento depois que o total cai ══════════════════

    [Fact]
    public async Task PagarParcial_CancelarParcela_FaturaFechadaViraPago_LiberaLimite_EAtrasoNaoCobra()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx, cicloFechado: true);
        Assert.Equal(500m, await BloqueadoAsync(ctx, c)); // 100 à vista + 2 × 200

        await PagarFaturaAsync(ctx, c, 100m);
        Assert.Equal(EstadoPagamentoFatura.Parcial, (await FaturaAsync(ctx, c.FaturaId)).EstadoPagamento);

        await CancelarParcelaAsync(ctx, c);

        var fatura = await FaturaAsync(ctx, c.FaturaId);
        Assert.Equal(EstadoPagamentoFatura.Pago, fatura.EstadoPagamento);
        Assert.NotNull(fatura.DataPagamentoTotal);
        // Só a parcela 2/2 segue bloqueada: os 100 à vista soltaram (antes ficavam presos pra sempre).
        Assert.Equal(200m, await BloqueadoAsync(ctx, c));
        Assert.Contains(await ctx.FinancialEventLogs.AsNoTracking().ToListAsync(),
            e => e.Tipo == FinancialEventType.FaturaPagaTotal && e.EntidadeId == c.FaturaId);

        await new FaturaAtrasoJob(ctx).ExecuteAsync();

        var depoisDoJob = await FaturaAsync(ctx, c.FaturaId);
        Assert.False(depoisDoJob.EstaAtrasada);
        Assert.Equal(0m, depoisDoJob.JurosDeMora);
        Assert.Equal(0m, depoisDoJob.Multa);
        var dto = await DtoAsync(ctx, c, c.FaturaId);
        Assert.Equal(100m, dto.ValorTotal);
        Assert.Equal(0m, dto.ValorRestante);
        Assert.False(dto.Vencida);
    }

    [Fact]
    public async Task FaturaAtrasada_JurosEMultaSobreORestante_ESaiDoAtrasoQuandoCancelamentoCobre()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx, cicloFechado: true);
        await PagarFaturaAsync(ctx, c, 100m);

        await new FaturaAtrasoJob(ctx).ExecuteAsync();

        var atrasada = await FaturaAsync(ctx, c.FaturaId);
        Assert.True(atrasada.EstaAtrasada);
        Assert.Equal(2.00m, atrasada.JurosDeMora); // 1% × 1 mês × 200 restantes (não × 300 de total)
        Assert.Equal(4.00m, atrasada.Multa);       // 2% × 200
        Assert.True((await DtoAsync(ctx, c, c.FaturaId)).Vencida);

        await CancelarParcelaAsync(ctx, c);

        var coberta = await FaturaAsync(ctx, c.FaturaId);
        Assert.False(coberta.EstaAtrasada);
        Assert.Equal(EstadoPagamentoFatura.Pago, coberta.EstadoPagamento);
        Assert.False((await DtoAsync(ctx, c, c.FaturaId)).Vencida);
    }

    [Fact]
    public async Task CancelarParcela_CicloAberto_FicaParcialSemRestante_EAProximaCompraSeguePagavel()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx, cicloFechado: false);
        await PagarFaturaAsync(ctx, c, 100m);

        await CancelarParcelaAsync(ctx, c);

        // Decisão: com o ciclo aberto NÃO vira Pago (travaria a próxima compra) — segura até fechar.
        var fatura = await FaturaAsync(ctx, c.FaturaId);
        Assert.Equal(EstadoPagamentoFatura.Parcial, fatura.EstadoPagamento);
        Assert.Equal(0m, (await DtoAsync(ctx, c, c.FaturaId)).ValorRestante);

        await new TransacaoService(ctx, new FaturaService(ctx)).CriarTransacaoAsync(new Transacao
        {
            Descricao = "Farmácia", Valor = 50, Tipo = TipoTransacao.Despesa, CartaoCreditoId = c.CartaoId,
            UsadoComoCredito = true, MeioPagamento = MeioPagamento.Credito, Data = DateTime.UtcNow.Date,
        }, c.UsuarioId);

        var comCompra = await DtoAsync(ctx, c, c.FaturaId);
        Assert.Equal(150m, comCompra.ValorTotal);  // a compra caiu nesta fatura
        Assert.Equal(50m, comCompra.ValorRestante);
        // Compra nova bloqueia: F cobra 150 com 100 pagos (50) + parcela 2/2 (200). Os 100 à vista já pagos
        // não seguram mais limite — o usado segue o pago, não o rótulo (antes: 350 até a fatura virar Pago).
        Assert.Equal(250m, await BloqueadoAsync(ctx, c));
        await PagarFaturaAsync(ctx, c, 50m);               // e é pagável (Pago recusaria: "já foi paga")
        Assert.Equal(EstadoPagamentoFatura.Pago, (await FaturaAsync(ctx, c.FaturaId)).EstadoPagamento);
    }

    [Fact]
    public async Task FechamentoDoCiclo_FaturaCobertaPorCancelamentoComCicloAberto_ViraPago()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx, cicloFechado: false);
        await PagarFaturaAsync(ctx, c, 100m);
        await CancelarParcelaAsync(ctx, c);
        // Só a parcela 2/2: F está coberta (100 cobrados, 100 pagos) mesmo seguindo Parcial até o fechamento
        // (antes os 100 à vista ficavam presos até o job marcar Pago).
        Assert.Equal(200m, await BloqueadoAsync(ctx, c));

        // O tempo passa: chega o dia do fechamento.
        var aFechar = await ctx.Faturas.SingleAsync(f => f.Id == c.FaturaId);
        aFechar.DataFechamento = DateTime.UtcNow.Date;
        await ctx.SaveChangesAsync();

        await new FaturaFechamentoJob(ctx, new FinancialEventLogService(ctx)).ExecuteAsync();

        var fechada = await FaturaAsync(ctx, c.FaturaId);
        Assert.Equal(EstadoCicloFatura.Fechada, fechada.EstadoCiclo);
        Assert.Equal(EstadoPagamentoFatura.Pago, fechada.EstadoPagamento);
        Assert.NotNull(fechada.DataPagamentoTotal);
        Assert.Equal(200m, await BloqueadoAsync(ctx, c));
        // Virar Pago soltou limite: fica no audit log igual ao caminho do cancelamento (antes o job não
        // registrava nada). O cancelamento com o ciclo aberto não registrou — a fatura seguia Parcial.
        var quitacao = Assert.Single(await ctx.FinancialEventLogs.AsNoTracking()
            .Where(e => e.Tipo == FinancialEventType.FaturaPagaTotal && e.EntidadeId == c.FaturaId)
            .ToListAsync());
        Assert.Equal("Job:FecharFaturas", quitacao.OrigemAcao);
        Assert.Equal(c.UsuarioId, quitacao.CriadoPor);
        Assert.Equal(100m, quitacao.ValorDepois);
        Assert.Contains("FechamentoComRestanteZero", quitacao.PayloadJson);
        // A seguinte (ciclo futuro, sem pagamento) não é tocada.
        var seguinte = await FaturaAsync(ctx, c.FaturaSeguinteId);
        Assert.Equal(EstadoCicloFatura.Aberta, seguinte.EstadoCiclo);
        Assert.Equal(EstadoPagamentoFatura.NaoPago, seguinte.EstadoPagamento);
    }

    [Fact]
    public async Task CancelarParcelamentoInteiro_FaturaZeradaSemPagamento_NaoViraVencidaNemAtrasada()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx, cicloFechado: true);

        await Parcelamentos(ctx).CancelarAsync(c.ParcelamentoId, new CancelarParcelamentoDto
        {
            Motivo = "Compra desfeita",
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, c.UsuarioId);

        // O tempo passa: a fatura seguinte (só com a parcela cancelada) fecha e vence.
        var hoje = DateTime.UtcNow.Date;
        var seguinte = await ctx.Faturas.SingleAsync(f => f.Id == c.FaturaSeguinteId);
        seguinte.DataFechamento = hoje.AddDays(-15);
        seguinte.DataVencimento = hoje.AddDays(-5);
        await ctx.SaveChangesAsync();

        await new FaturaFechamentoJob(ctx, new FinancialEventLogService(ctx)).ExecuteAsync();
        await new FaturaAtrasoJob(ctx).ExecuteAsync();

        var zerada = await FaturaAsync(ctx, c.FaturaSeguinteId);
        Assert.Equal(EstadoCicloFatura.Fechada, zerada.EstadoCiclo);
        Assert.Equal(EstadoPagamentoFatura.NaoPago, zerada.EstadoPagamento); // nada foi pago: não vira Pago
        Assert.False(zerada.EstaAtrasada);
        Assert.Equal(0m, zerada.JurosDeMora);
        var dto = await DtoAsync(ctx, c, c.FaturaSeguinteId);
        Assert.Equal(0m, dto.ValorTotal);
        Assert.Equal(0m, dto.ValorRestante);
        Assert.False(dto.Vencida);

        // A fatura F ainda deve os 100 à vista: essa sim atrasa, com juros sobre o restante.
        var f = await FaturaAsync(ctx, c.FaturaId);
        Assert.True(f.EstaAtrasada);
        Assert.Equal(1.00m, f.JurosDeMora);
        Assert.True((await DtoAsync(ctx, c, c.FaturaId)).Vencida);
    }

    [Theory]
    [InlineData(EstadoCicloFatura.Fechada, EstadoPagamentoFatura.Parcial, 100, 100, EstadoPagamentoFatura.Pago)]
    [InlineData(EstadoCicloFatura.Fechada, EstadoPagamentoFatura.Parcial, 150, 100, EstadoPagamentoFatura.Pago)]    // pago a mais: crédito, mas quitada
    [InlineData(EstadoCicloFatura.Aberta, EstadoPagamentoFatura.Parcial, 100, 100, EstadoPagamentoFatura.Parcial)]  // ciclo aberto segura até fechar
    [InlineData(EstadoCicloFatura.Fechada, EstadoPagamentoFatura.Parcial, 50, 100, EstadoPagamentoFatura.Parcial)]  // ainda resta
    [InlineData(EstadoCicloFatura.Fechada, EstadoPagamentoFatura.NaoPago, 0, 0, EstadoPagamentoFatura.NaoPago)]     // zerada sem pagamento
    [InlineData(EstadoCicloFatura.Fechada, EstadoPagamentoFatura.NaoPago, 0, 100, EstadoPagamentoFatura.NaoPago)]
    public void ReconciliarEstadoPagamento_SoAvancaQuandoNadaResta(
        EstadoCicloFatura ciclo, EstadoPagamentoFatura estado, int valorPago, int total, EstadoPagamentoFatura esperado)
    {
        var fatura = new Fatura { EstadoCiclo = ciclo, EstadoPagamento = estado, ValorPago = valorPago, EstaAtrasada = true };
        if (total > 0)
            fatura.Transacoes.Add(new Transacao
            {
                Descricao = "compra", Valor = total, Tipo = TipoTransacao.Despesa, UsadoComoCredito = true, Ativo = true,
            });

        var virouPago = RegrasFinanceiras.ReconciliarEstadoPagamento(fatura, DateTime.UtcNow);

        Assert.Equal(esperado, fatura.EstadoPagamento);
        Assert.Equal(esperado == EstadoPagamentoFatura.Pago, virouPago);
        Assert.Equal(valorPago < total, fatura.EstaAtrasada); // sai do atraso só quando nada resta
    }

    // ══ Achado 2 — parcela quitada pelo pagamento da fatura ════════════════════

    [Fact]
    public async Task CancelarParcelamento_ParcelaQuitadaPeloPagamentoDaFatura_ContaComoPagaERequerEstorno()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx, cicloFechado: true);
        await PagarFaturaAsync(ctx, c, 300m); // quita F inteira; a parcela 1/2 segue "Pendente" no banco
        Assert.Equal(StatusParcela.Pendente,
            (await ctx.ParcelasTransacao.AsNoTracking().SingleAsync(p => p.Id == c.ParcelaNaFaturaId)).Status);

        var cancelar = new CancelarParcelamentoDto { Motivo = "Devolvido", IdempotencyKey = Guid.NewGuid().ToString() };
        var resultado = await Parcelamentos(ctx).CancelarAsync(c.ParcelamentoId, cancelar, c.UsuarioId);

        Assert.Equal(1, resultado.Canceladas); // só a 2/2, ainda devida
        Assert.Equal(1, resultado.JaPagas);    // a 1/2 foi paga pela fatura
        Assert.True(resultado.RequerEstorno);  // antes: false — os R$ 200 pagos sumiam

        var parcela = await ctx.ParcelasTransacao.AsNoTracking().SingleAsync(p => p.Id == c.ParcelaNaFaturaId);
        Assert.Equal(StatusParcela.Paga, parcela.Status);
        Assert.NotNull(parcela.PagoEm);

        // F segue devendo o que foi pago (300 = 300 pagos); antes caía pra 100 com 300 pagos.
        var f = await DtoAsync(ctx, c, c.FaturaId);
        Assert.Equal(300m, f.ValorTotal);
        Assert.Equal(300m, f.ValorPago);
        Assert.Equal(EstadoPagamentoFatura.Pago, (EstadoPagamentoFatura)f.EstadoPagamento);
        Assert.Equal(0m, (await DtoAsync(ctx, c, c.FaturaSeguinteId)).ValorTotal);

        // Replay idempotente devolve o mesmo (conta pelo Status gravado).
        var replay = await Parcelamentos(ctx).CancelarAsync(c.ParcelamentoId, cancelar, c.UsuarioId);
        Assert.Equal(1, replay.JaPagas);
        Assert.True(replay.RequerEstorno);
    }

    [Fact]
    public async Task CancelarParcelaIndividual_QuitadaPeloPagamentoDaFatura_Recusa()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx, cicloFechado: true);
        await PagarFaturaAsync(ctx, c, 300m);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => CancelarParcelaAsync(ctx, c));

        Assert.Contains("já foi paga", ex.Message);
        var parcela = await ctx.ParcelasTransacao.AsNoTracking().SingleAsync(p => p.Id == c.ParcelaNaFaturaId);
        Assert.Equal(StatusParcela.Pendente, parcela.Status);
        Assert.Equal(300m, (await DtoAsync(ctx, c, c.FaturaId)).ValorTotal);
    }

    [Fact]
    public async Task ParcelaQuitadaPelaFatura_SemOTotalDaFaturaCarregado_FalhaAltoEmVezDeResponder()
    {
        // Banco com nome fixo pra abrir contextos NOVOS (nada rastreado): no mesmo contexto do seed a
        // navegação viria preenchida pelo fixup e esconderia o Include que faltou.
        var opcoes = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(
                Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        Cenario c;
        await using (var seed = new AppDbContext(opcoes))
        {
            c = await SeedAsync(seed, cicloFechado: true);
            await PagarFaturaAsync(seed, c, 300m); // F coberta: a parcela 1/2 foi paga pela fatura
        }

        await using (var ctx = new AppDbContext(opcoes))
        {
            var semFatura = await ctx.ParcelasTransacao.SingleAsync(p => p.Id == c.ParcelaNaFaturaId);
            Assert.Throws<InvalidOperationException>(() => RegrasFinanceiras.ParcelaQuitadaPelaFatura(ctx, semFatura));
        }
        await using (var ctx = new AppDbContext(opcoes))
        {
            // Fatura sem Transacoes/ParcelasTransacao: o total sairia menor e a parcela pareceria quitada.
            var semTotal = await ctx.ParcelasTransacao.Include(p => p.Fatura)
                .SingleAsync(p => p.Id == c.ParcelaNaFaturaId);
            Assert.Throws<InvalidOperationException>(() => RegrasFinanceiras.ParcelaQuitadaPelaFatura(ctx, semTotal));
        }
        await using (var ctx = new AppDbContext(opcoes))
        {
            var completa = await ctx.ParcelasTransacao
                .Include(p => p.Fatura).ThenInclude(f => f!.Transacoes)
                .Include(p => p.Fatura).ThenInclude(f => f!.ParcelasTransacao)
                .SingleAsync(p => p.Id == c.ParcelaNaFaturaId);
            Assert.True(RegrasFinanceiras.ParcelaQuitadaPelaFatura(ctx, completa));

            completa.Status = StatusParcela.Paga; // Paga de verdade não é "quitada pela fatura"
            Assert.False(RegrasFinanceiras.ParcelaQuitadaPelaFatura(ctx, completa));
        }
    }

    [Theory]
    [InlineData(EstadoPagamentoFatura.Pago, 300, 300, true)]
    [InlineData(EstadoPagamentoFatura.Pago, 300, 500, false)]   // compra nova caiu na fatura Pago: não foi paga
    [InlineData(EstadoPagamentoFatura.Parcial, 150, 150, true)] // ciclo aberto coberto após cancelamento
    [InlineData(EstadoPagamentoFatura.Parcial, 150, 350, false)]
    [InlineData(EstadoPagamentoFatura.Parcial, 150, 100, true)] // pago a mais: coberta (o excedente é crédito)
    [InlineData(EstadoPagamentoFatura.NaoPago, 0, 0, false)]    // zerada sem pagamento: nada foi pago
    public void FaturaCobertaPeloPagamento_OlhaACoberturaReal_NaoORotulo(
        EstadoPagamentoFatura estado, int valorPago, int total, bool esperado)
    {
        var fatura = new Fatura { EstadoPagamento = estado, ValorPago = valorPago };
        if (total > 0)
            fatura.Transacoes.Add(new Transacao
            {
                Descricao = "compra", Valor = total, Tipo = TipoTransacao.Despesa, UsadoComoCredito = true, Ativo = true,
            });

        Assert.Equal(esperado, RegrasFinanceiras.FaturaCobertaPeloPagamento(fatura));
    }

    // ══ Revisão das correções — cobertura real, não o rótulo Pago ══════════════

    /// <summary>
    /// Compra parcelada em 2× com a 1ª parcela no ciclo de HOJE: cai na fatura aberta F do cenário
    /// <c>cicloFechado: false</c> (mesmo cálculo de período de <c>ObterOuCriarFaturaAsync</c>).
    /// </summary>
    private static Task<ParcelamentoDetalheDto> CriarParcelamentoNoCicloDeHojeAsync(
        AppDbContext ctx, Cenario c, string descricao, decimal valor)
    {
        var hoje = DateTime.UtcNow.Date;
        return Parcelamentos(ctx).CriarAsync(new CriarParcelamentoDto
        {
            Descricao = descricao, Valor = valor, Tipo = TipoParcelamento.CompraParcelada,
            CartaoCreditoId = c.CartaoId, DataCompra = hoje, Parcelas = 2,
            PrimeiraParcelaMes = hoje.ToString("yyyy-MM", System.Globalization.CultureInfo.InvariantCulture),
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, c.UsuarioId);
    }

    private static Guid PrimeiraParcela(ParcelamentoDetalheDto p) => p.Parcelas.Single(x => x.Numero == 1).Id;

    [Fact]
    public async Task CancelarParcelamento_CaiuEmFaturaJaPaga_ParcelaNaoPagaViraCancelada_SemEstorno()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx, cicloFechado: false);
        await PagarFaturaAsync(ctx, c, 300m); // F quitada: Pago

        var sofa = await CriarParcelamentoNoCicloDeHojeAsync(ctx, c, "Sofá", 400m); // 2 × 200, a 1/2 em F
        var comSofa = await DtoAsync(ctx, c, c.FaturaId);
        Assert.Equal(500m, comSofa.ValorTotal);
        Assert.Equal(200m, comSofa.ValorRestante);
        // Causa raiz (ROADMAP): a cobrança nova não reabre o estado — F segue Pago devendo 200.
        Assert.Equal(EstadoPagamentoFatura.Pago, (EstadoPagamentoFatura)comSofa.EstadoPagamento);

        var resultado = await Parcelamentos(ctx).CancelarAsync(sofa.Id, new CancelarParcelamentoDto
        {
            Motivo = "Desisti", IdempotencyKey = Guid.NewGuid().ToString(),
        }, c.UsuarioId);

        // Antes: a 1/2 contava como "quitada pela fatura" só por F ser Pago — virava Paga com PagoEm falso,
        // sinalizava estorno de dinheiro que nunca saiu e F ficava devendo 200 sem poder ser paga.
        Assert.Equal(2, resultado.Canceladas);
        Assert.Equal(0, resultado.JaPagas);
        Assert.False(resultado.RequerEstorno);
        var parcela = await ctx.ParcelasTransacao.AsNoTracking().SingleAsync(p => p.Id == PrimeiraParcela(sofa));
        Assert.Equal(StatusParcela.Cancelada, parcela.Status);
        Assert.Null(parcela.PagoEm);

        var depois = await DtoAsync(ctx, c, c.FaturaId);
        Assert.Equal(300m, depois.ValorTotal);
        Assert.Equal(300m, depois.ValorPago);
        Assert.Equal(0m, depois.ValorRestante);
        Assert.Equal(EstadoPagamentoFatura.Pago, (EstadoPagamentoFatura)depois.EstadoPagamento);
        // A TV 1/2 volta a estar coberta: segue Pendente (paga pela fatura), não foi tocada.
        Assert.Equal(StatusParcela.Pendente,
            (await ctx.ParcelasTransacao.AsNoTracking().SingleAsync(p => p.Id == c.ParcelaNaFaturaId)).Status);
    }

    [Fact]
    public async Task CancelarParcelaIndividual_CaiuEmFaturaJaPaga_Cancela()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx, cicloFechado: false);
        await PagarFaturaAsync(ctx, c, 300m);
        var sofa = await CriarParcelamentoNoCicloDeHojeAsync(ctx, c, "Sofá", 400m);

        // Antes: recusava ("a fatura desta parcela já foi paga") e F ficava devendo 200 pra sempre.
        await Parcelas(ctx).CancelarAsync(PrimeiraParcela(sofa), new CancelarParcelaDto
        {
            Motivo = "Devolvido", IdempotencyKey = Guid.NewGuid().ToString(),
        }, c.UsuarioId);

        Assert.Equal(StatusParcela.Cancelada,
            (await ctx.ParcelasTransacao.AsNoTracking().SingleAsync(p => p.Id == PrimeiraParcela(sofa))).Status);
        var f = await DtoAsync(ctx, c, c.FaturaId);
        Assert.Equal(300m, f.ValorTotal);
        Assert.Equal(0m, f.ValorRestante);
    }

    [Fact]
    public async Task CicloAbertoCoberto_PagarAntecipadoRecusa_ECancelarOutroParcelamentoSinalizaEstorno()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx, cicloFechado: false);
        var fone = await CriarParcelamentoNoCicloDeHojeAsync(ctx, c, "Fone", 100m); // 2 × 50, a 1/2 em F
        await PagarFaturaAsync(ctx, c, 150m);  // F: 100 à vista + TV 200 + fone 50 = 350 → Parcial
        await CancelarParcelaAsync(ctx, c);    // TV 1/2 sai: total 150 = pago 150

        var coberta = await DtoAsync(ctx, c, c.FaturaId);
        Assert.Equal(150m, coberta.ValorTotal);
        Assert.Equal(0m, coberta.ValorRestante);
        // Janela da decisão do ciclo aberto: coberta, mas Parcial até o fechamento.
        Assert.Equal(EstadoPagamentoFatura.Parcial, (EstadoPagamentoFatura)coberta.EstadoPagamento);

        // Pagar antecipado o fone 1/2, que o já pago cobre: antes debitava mais 50 (total 150, pago 200).
        var saldoAntes = (await RegrasFinanceiras.SaldoDaContaAsync(ctx, c.ContaId, c.UsuarioId)).Saldo;
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Parcelas(ctx).PagarAntecipadoAsync(PrimeiraParcela(fone), new PagarParcelaDto
            {
                ContaPagamentoId = c.ContaId, IdempotencyKey = Guid.NewGuid().ToString(),
            }, c.UsuarioId));
        Assert.Contains("coberta", ex.Message);
        Assert.Equal(saldoAntes, (await RegrasFinanceiras.SaldoDaContaAsync(ctx, c.ContaId, c.UsuarioId)).Saldo);
        Assert.Equal(150m, (await FaturaAsync(ctx, c.FaturaId)).ValorPago);

        // Cancelar o parcelamento do fone: a 1/2 já foi paga pela fatura. Antes virava Cancelada — total
        // 100 com 150 pagos, requerEstorno=false, e os R$ 50 sumiam.
        var resultado = await Parcelamentos(ctx).CancelarAsync(fone.Id, new CancelarParcelamentoDto
        {
            Motivo = "Devolvido", IdempotencyKey = Guid.NewGuid().ToString(),
        }, c.UsuarioId);

        Assert.Equal(1, resultado.Canceladas); // só a 2/2, ainda devida
        Assert.Equal(1, resultado.JaPagas);
        Assert.True(resultado.RequerEstorno);
        var parcela = await ctx.ParcelasTransacao.AsNoTracking().SingleAsync(p => p.Id == PrimeiraParcela(fone));
        Assert.Equal(StatusParcela.Paga, parcela.Status);
        Assert.NotNull(parcela.PagoEm);
        var depois = await DtoAsync(ctx, c, c.FaturaId);
        Assert.Equal(150m, depois.ValorTotal);
        Assert.Equal(150m, depois.ValorPago);
    }

    [Fact]
    public async Task PagarAntecipado_PagamentoDaFaturaJaCobreParteDaParcela_Recusa()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx, cicloFechado: false);
        await PagarFaturaAsync(ctx, c, 150m); // 100 à vista + TV 200 = 300: resta 150, menos que a parcela

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Parcelas(ctx).PagarAntecipadoAsync(c.ParcelaNaFaturaId, new PagarParcelaDto
            {
                ContaPagamentoId = c.ContaId, IdempotencyKey = Guid.NewGuid().ToString(),
            }, c.UsuarioId));

        // Pagar os 200 inteiros deixaria 350 pagos numa fatura de 300: o que falta (150) vai pela fatura.
        Assert.Contains("resta", ex.Message);
        Assert.Equal(150m, (await FaturaAsync(ctx, c.FaturaId)).ValorPago);
        Assert.Equal(StatusParcela.Pendente,
            (await ctx.ParcelasTransacao.AsNoTracking().SingleAsync(p => p.Id == c.ParcelaNaFaturaId)).Status);
    }
}

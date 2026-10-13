using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Fatura;
using ControleFinanceiro.Api.DTOs.Parcelamento;
using ControleFinanceiro.Api.DTOs.ParcelaTransacao;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Estorno de pagamento de fatura (Fase 0, revisão do #288): antes um pagamento errado não tinha volta —
/// a tela de Transações bloqueia editar/excluir pagamento. O estorno devolve o dinheiro à conta, faz a
/// fatura voltar a dever, volta a ocupar o limite e registra no log; idempotente pela chave.
/// </summary>
public class EstornoPagamentoFaturaTests
{
    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    private static string Chave() => Guid.NewGuid().ToString();

    private sealed record Cenario(AppDbContext Ctx, FaturaService Svc, Guid Usuario, Guid ContaId, Guid CartaoId, Guid FaturaId);

    /// <summary>Fatura fechada com uma compra de <paramref name="compra"/> e uma conta com saldo.</summary>
    private static async Task<Cenario> CenarioAsync(decimal compra = 300m)
    {
        var ctx = CreateContext();
        var usuario = Guid.NewGuid();
        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = "Nubank", TemCredito = true, LimiteTotal = 5000, CriadoPor = usuario, Ativo = true,
        };
        var fatura = new Fatura
        {
            Id = Guid.NewGuid(), CartaoCreditoId = cartao.Id, CriadoPor = usuario,
            DataInicio = new DateTime(2025, 9, 1), DataFechamento = new DateTime(2025, 10, 1), DataVencimento = new DateTime(2025, 10, 8),
            EstadoCiclo = EstadoCicloFatura.Fechada, EstadoPagamento = EstadoPagamentoFatura.NaoPago,
        };
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Corrente", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuario };
        ctx.AddRange(cartao, fatura, conta,
            new Transacao
            {
                Id = Guid.NewGuid(), Descricao = "Compra", Valor = compra, Tipo = TipoTransacao.Despesa, CartaoCreditoId = cartao.Id,
                FaturaId = fatura.Id, UsadoComoCredito = true, Data = new DateOnly(2025, 9, 15), CriadoPor = usuario,
            },
            new Transacao
            {
                Id = Guid.NewGuid(), Descricao = "Salário", Valor = 1000m, Tipo = TipoTransacao.Receita, ContaId = conta.Id,
                Data = new DateOnly(2025, 10, 1), CriadoPor = usuario,
            });
        await ctx.SaveChangesAsync();
        return new Cenario(ctx, new FaturaService(ctx), usuario, conta.Id, cartao.Id, fatura.Id);
    }

    private static async Task<Guid> PagarAsync(Cenario c, decimal valor) =>
        (await c.Svc.PagarFaturaAsync(c.FaturaId, new PagarFaturaDto
        {
            ContaId = c.ContaId, Valor = valor, DataPagamento = new DateTime(2025, 10, 5),
        }, c.Usuario, Chave())).Id;

    private static async Task<decimal> SaldoAsync(Cenario c) =>
        (await RegrasFinanceiras.SaldoDaContaAsync(c.Ctx, c.ContaId, c.Usuario)).Saldo;

    private static Task<Fatura> FaturaAsync(Cenario c) =>
        c.Ctx.Faturas.AsNoTracking().SingleAsync(f => f.Id == c.FaturaId);

    [Fact]
    public async Task Estornar_PagamentoTotal_DinheiroVoltaFaturaVoltaADeverLimiteVoltaAOcupar_ELoga()
    {
        var c = await CenarioAsync();
        var pagamentoId = await PagarAsync(c, 300m);
        Assert.Equal(700m, await SaldoAsync(c));
        Assert.Equal(0m, (await new LimiteCalculatorService(c.Ctx).CalcularAsync(c.CartaoId, c.Usuario)).LimiteBloqueado);

        var r = await c.Svc.EstornarPagamentoAsync(pagamentoId, new EstornarPagamentoDto { Motivo = "Paguei duas vezes" }, c.Usuario, Chave());

        Assert.Equal((pagamentoId, c.FaturaId, 300m, 0m, 300m), (r.PagamentoId, r.FaturaId, r.ValorEstornado, r.ValorPagoFatura, r.RestanteFatura));
        Assert.Equal(1000m, await SaldoAsync(c));
        var fatura = await FaturaAsync(c);
        Assert.Equal((0m, EstadoPagamentoFatura.NaoPago, (DateTime?)null), (fatura.ValorPago, fatura.EstadoPagamento, fatura.DataPagamentoTotal));
        Assert.Equal(300m, (await new LimiteCalculatorService(c.Ctx).CalcularAsync(c.CartaoId, c.Usuario)).LimiteBloqueado);

        // O pagamento fica no banco, cancelado com o motivo (some das listas pelo filtro de Ativo).
        var pagamento = await c.Ctx.Transacoes.IgnoreQueryFilters().SingleAsync(t => t.Id == pagamentoId);
        Assert.False(pagamento.Ativo);
        Assert.Equal(StatusTransacao.Cancelado, pagamento.StatusTransacao);
        Assert.Equal("Estorno: Paguei duas vezes", pagamento.MotivoCancelamento);

        var estorno = await c.Ctx.FinancialEventLogs.SingleAsync(e => e.Tipo == FinancialEventType.FaturaPagamentoEstornado);
        Assert.Equal((300m, 0m), (estorno.ValorAntes, estorno.ValorDepois));
        var bloqueio = await c.Ctx.FinancialEventLogs.SingleAsync(e => e.Tipo == FinancialEventType.LimiteBloqueado);
        Assert.Equal(300m, bloqueio.ValorDepois - bloqueio.ValorAntes);
        Assert.Equal(estorno.CorrelationId, bloqueio.CorrelationId);
    }

    [Fact]
    public async Task Estornar_UmDeDoisPagamentos_FaturaFicaParcialComOOutro()
    {
        var c = await CenarioAsync();
        var primeiro = await PagarAsync(c, 100m);
        await PagarAsync(c, 200m);
        Assert.Equal(EstadoPagamentoFatura.Pago, (await FaturaAsync(c)).EstadoPagamento);

        var r = await c.Svc.EstornarPagamentoAsync(primeiro, new EstornarPagamentoDto(), c.Usuario, Chave());

        Assert.Equal((200m, 100m), (r.ValorPagoFatura, r.RestanteFatura));
        var fatura = await FaturaAsync(c);
        Assert.Equal((200m, EstadoPagamentoFatura.Parcial, (DateTime?)null), (fatura.ValorPago, fatura.EstadoPagamento, fatura.DataPagamentoTotal));
        Assert.Equal(800m, await SaldoAsync(c));
        Assert.Equal("Pagamento estornado",
            (await c.Ctx.Transacoes.IgnoreQueryFilters().SingleAsync(t => t.Id == primeiro)).MotivoCancelamento);
    }

    [Fact]
    public async Task Estornar_MesmaChaveDuasVezes_EstornaUmaVez_OutraChaveDepois_409()
    {
        var c = await CenarioAsync();
        var pagamentoId = await PagarAsync(c, 300m);
        var chave = Chave();

        var primeira = await c.Svc.EstornarPagamentoAsync(pagamentoId, new EstornarPagamentoDto(), c.Usuario, chave);
        var retry = await c.Svc.EstornarPagamentoAsync(pagamentoId, new EstornarPagamentoDto(), c.Usuario, chave);

        Assert.Equal(primeira.ValorPagoFatura, retry.ValorPagoFatura);
        Assert.Equal(0m, (await FaturaAsync(c)).ValorPago); // não baixou duas vezes (seria -300)
        Assert.Equal(1000m, await SaldoAsync(c));
        Assert.Single(c.Ctx.FinancialEventLogs.Where(e => e.Tipo == FinancialEventType.FaturaPagamentoEstornado));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => c.Svc.EstornarPagamentoAsync(pagamentoId, new EstornarPagamentoDto(), c.Usuario, Chave()));
        Assert.Equal("Este pagamento já foi estornado.", ex.Message);
    }

    [Fact]
    public async Task Estornar_ChaveJaUsadaEmOutroPagamento_409_NaoEstorna()
    {
        var c = await CenarioAsync();
        var a = await PagarAsync(c, 100m);
        var b = await PagarAsync(c, 200m);
        var chave = Chave();
        await c.Svc.EstornarPagamentoAsync(a, new EstornarPagamentoDto(), c.Usuario, chave);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => c.Svc.EstornarPagamentoAsync(b, new EstornarPagamentoDto(), c.Usuario, chave));

        Assert.Equal(200m, (await FaturaAsync(c)).ValorPago);
    }

    [Fact]
    public async Task Estornar_DeOutroUsuario_OuQueNaoEhPagamento_404IgualAInexistente()
    {
        var c = await CenarioAsync();
        var pagamentoId = await PagarAsync(c, 300m);
        var compra = await c.Ctx.Transacoes.SingleAsync(t => t.Descricao == "Compra");

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => c.Svc.EstornarPagamentoAsync(pagamentoId, new EstornarPagamentoDto(), Guid.NewGuid(), Chave()));
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => c.Svc.EstornarPagamentoAsync(compra.Id, new EstornarPagamentoDto(), c.Usuario, Chave()));
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => c.Svc.EstornarPagamentoAsync(Guid.NewGuid(), new EstornarPagamentoDto(), c.Usuario, Chave()));

        Assert.Equal(300m, (await FaturaAsync(c)).ValorPago);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task Estornar_SemChave_400_NaoEstorna(string? chave)
    {
        var c = await CenarioAsync();
        var pagamentoId = await PagarAsync(c, 300m);

        await Assert.ThrowsAsync<ArgumentException>(
            () => c.Svc.EstornarPagamentoAsync(pagamentoId, new EstornarPagamentoDto(), c.Usuario, chave));

        Assert.Equal(300m, (await FaturaAsync(c)).ValorPago);
    }

    // ── Pagamento de parcela antecipada ────────────────────────────────────────

    private sealed record CenarioParcela(AppDbContext Ctx, Guid Usuario, Guid ContaId, ParcelamentoDetalheDto Parcelamento, ParcelaTransacaoService Parcelas);

    private static async Task<CenarioParcela> ParcelamentoComContaAsync()
    {
        var ctx = CreateContext();
        var usuario = Guid.NewGuid();
        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = "Nubank", TemCredito = true, LimiteTotal = 10000, DiaFechamento = 10, DiaVencimento = 20,
            CriadoPor = usuario, Ativo = true,
        };
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Corrente", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuario };
        ctx.AddRange(cartao, conta, new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Salário", Valor = 1000m, Tipo = TipoTransacao.Receita, ContaId = conta.Id,
            Data = DateOnly.FromDateTime(DateTime.UtcNow), CriadoPor = usuario,
        });
        await ctx.SaveChangesAsync();
        var parcelamento = await new ParcelamentoService(ctx, new FinancialEventLogService(ctx), new LimiteCalculatorService(ctx), new FaturaService(ctx))
            .CriarAsync(new CriarParcelamentoDto
            {
                Descricao = "Fone", Valor = 200m, Tipo = TipoParcelamento.CompraParcelada, CartaoCreditoId = cartao.Id,
                DataCompra = DateTime.UtcNow.Date, Parcelas = 2, PrimeiraParcelaMes = TestHelpers.MesDaFatura(DateTime.UtcNow, 10),
                IdempotencyKey = Chave(),
            }, usuario);
        var parcelas = new ParcelaTransacaoService(ctx, new FinancialEventLogService(ctx), new LimiteCalculatorService(ctx));
        return new CenarioParcela(ctx, usuario, conta.Id, parcelamento, parcelas);
    }

    private static async Task<Guid> AnteciparPrimeiraAsync(CenarioParcela c)
    {
        var primeira = c.Parcelamento.Parcelas.Single(p => p.Numero == 1);
        await c.Parcelas.PagarAntecipadoAsync(primeira.Id,
            new PagarParcelaDto { ContaPagamentoId = c.ContaId, IdempotencyKey = Chave() }, c.Usuario);
        return (await c.Ctx.Transacoes.SingleAsync(t => t.ParcelaTransacaoId == primeira.Id && t.EhPagamentoFatura)).Id;
    }

    [Fact]
    public async Task Estornar_ParcelaAntecipada_ParcelaVoltaAPendente()
    {
        var c = await ParcelamentoComContaAsync();
        var pagamentoId = await AnteciparPrimeiraAsync(c);

        await new FaturaService(c.Ctx).EstornarPagamentoAsync(pagamentoId, new EstornarPagamentoDto(), c.Usuario, Chave());

        var parcela = await c.Ctx.ParcelasTransacao.AsNoTracking().SingleAsync(p => p.ParcelamentoId == c.Parcelamento.Id && p.Numero == 1);
        Assert.Equal((StatusParcela.Pendente, (DateTime?)null), (parcela.Status, parcela.PagoEm));
        var fatura = await c.Ctx.Faturas.AsNoTracking().SingleAsync(f => f.Id == parcela.FaturaId);
        Assert.Equal((0m, EstadoPagamentoFatura.NaoPago), (fatura.ValorPago, fatura.EstadoPagamento));
        Assert.Equal(1000m, (await RegrasFinanceiras.SaldoDaContaAsync(c.Ctx, c.ContaId, c.Usuario)).Saldo);
    }

    [Fact]
    public async Task Estornar_ParcelaDeParcelamentoCancelado_ParcelaViraCancelada_NaoVoltaACobrar()
    {
        // Reembolso de compra desfeita: a 1ª foi antecipada, o parcelamento foi cancelado (a paga fica,
        // pedindo estorno) e o banco devolveu. Voltar a Pendente cobraria de novo uma compra que não existe.
        var c = await ParcelamentoComContaAsync();
        var pagamentoId = await AnteciparPrimeiraAsync(c);
        await new ParcelamentoService(c.Ctx, new FinancialEventLogService(c.Ctx), new LimiteCalculatorService(c.Ctx), new FaturaService(c.Ctx))
            .CancelarAsync(c.Parcelamento.Id, new CancelarParcelamentoDto { Motivo = "Devolvi", IdempotencyKey = Chave() }, c.Usuario);

        await new FaturaService(c.Ctx).EstornarPagamentoAsync(pagamentoId, new EstornarPagamentoDto { Motivo = "Reembolso" }, c.Usuario, Chave());

        var parcela = await c.Ctx.ParcelasTransacao.AsNoTracking().SingleAsync(p => p.ParcelamentoId == c.Parcelamento.Id && p.Numero == 1);
        Assert.Equal(StatusParcela.Cancelada, parcela.Status);
        var fatura = await c.Ctx.Faturas.Include(f => f.Transacoes).Include(f => f.ParcelasTransacao).AsNoTracking()
            .SingleAsync(f => f.Id == parcela.FaturaId);
        Assert.Equal(0m, fatura.ValorPago);
        Assert.Equal(0m, RegrasFinanceiras.ValorRestanteFatura(fatura)); // nada a cobrar
        Assert.Equal(1000m, (await RegrasFinanceiras.SaldoDaContaAsync(c.Ctx, c.ContaId, c.Usuario)).Saldo);
        Assert.Single(c.Ctx.FinancialEventLogs.Where(e => e.Tipo == FinancialEventType.ParcelaCancelada && e.EntidadeId == parcela.Id));
    }
}

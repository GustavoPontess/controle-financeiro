using System.Security.Claims;
using ControleFinanceiro.Api.Controllers;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Conta;
using ControleFinanceiro.Api.DTOs.Fatura;
using ControleFinanceiro.Api.DTOs.Parcelamento;
using ControleFinanceiro.Api.DTOs.ParcelaTransacao;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Jobs;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Regras de dinheiro unificadas em <see cref="RegrasFinanceiras"/>:
/// (1) total/restante de fatura — parcela CANCELADA fica fora (antes 3 cópias a somavam, porque o
/// cancelamento mantém o FaturaId); (2) saldo de conta — uma regra só (Ativo + Executado), agregada
/// no banco, e o MESMO número em todo consumidor (contas, dashboard, resumo, pagamento de parcela).
/// </summary>
public class RegrasFinanceirasTests
{
    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(
                Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    // ══ Total da fatura — regra pura ══════════════════════════════════════════

    private static ParcelaTransacao Parcela(decimal valor, StatusParcela status, decimal? comJuros = null) => new()
    {
        Id = Guid.NewGuid(),
        ParcelamentoId = Guid.NewGuid(),
        Numero = 1,
        QuantidadeTotal = 2,
        DataVencimento = DateTime.UtcNow.Date,
        Valor = valor,
        ValorComJuros = comJuros,
        Status = status,
    };

    private static Transacao CompraCredito(decimal valor, bool ativo = true, bool usadoComoCredito = true) => new()
    {
        Id = Guid.NewGuid(),
        Descricao = "compra",
        Valor = valor,
        Tipo = TipoTransacao.Despesa,
        UsadoComoCredito = usadoComoCredito,
        Ativo = ativo,
        Data = DateOnly.FromDateTime(DateTime.UtcNow),
    };

    [Fact]
    public void ValorTotalFatura_ExcluiParcelaCancelada_MantemPendenteEPaga()
    {
        var total = RegrasFinanceiras.ValorTotalFatura(
            Array.Empty<Transacao>(),
            new[]
            {
                Parcela(300, StatusParcela.Pendente),
                Parcela(200, StatusParcela.Paga),      // paga antecipado: segue no total (ValorPago cobre)
                Parcela(900, StatusParcela.Cancelada), // cancelada: não é mais devida
            });

        Assert.Equal(500m, total);
    }

    [Fact]
    public void ValorTotalFatura_SoCreditoAVistaVivo_InativaENaoCreditoFicamFora()
    {
        var total = RegrasFinanceiras.ValorTotalFatura(
            new[]
            {
                CompraCredito(100),
                CompraCredito(50, ativo: false),              // soft-deletada
                CompraCredito(30, usadoComoCredito: false),   // não é compra no crédito
            },
            Array.Empty<ParcelaTransacao>());

        Assert.Equal(100m, total);
    }

    [Fact]
    public void ValorTotalFatura_ParcelaComJuros_UsaValorComJuros()
    {
        var total = RegrasFinanceiras.ValorTotalFatura(
            Array.Empty<Transacao>(),
            new[] { Parcela(100, StatusParcela.Pendente, comJuros: 112.5m) });

        Assert.Equal(112.5m, total);
    }

    [Theory]
    [InlineData(400, 100, 300)]
    [InlineData(400, 400, 0)]
    [InlineData(300, 400, 0)] // total caiu depois do pagamento (parcela cancelada) → sem restante negativo
    public void ValorRestanteFatura_NuncaNegativo(decimal total, decimal pago, decimal esperado)
    {
        Assert.Equal(esperado, RegrasFinanceiras.ValorRestanteFatura(total, pago));
    }

    // ══ Total da fatura — nos consumidores reais ══════════════════════════════

    private sealed record CenarioFatura(
        Guid UsuarioId, Guid CartaoId, Guid ContaId, Guid FaturaId,
        ParcelamentoDetalheDto P1, ParcelamentoDetalheDto P2);

    private static ParcelamentoService Parcelamentos(AppDbContext ctx) =>
        new(ctx, new FinancialEventLogService(ctx), new LimiteCalculatorService(ctx), new FaturaService(ctx));

    private static ParcelaTransacaoService Parcelas(AppDbContext ctx) =>
        new(ctx, new FinancialEventLogService(ctx), new LimiteCalculatorService(ctx));

    /// <summary>
    /// Fatura do mês com: compra à vista no crédito (100) + parcela 1 de P1 (2×300) + parcela 1 de
    /// P2 (2×500). Os dois parcelamentos começam na fatura aberta hoje → a 1ª parcela de ambos cai na MESMA
    /// fatura; a 2ª de ambos, na fatura seguinte. Conta com saldo folgado pra pagar.
    /// </summary>
    private static async Task<CenarioFatura> SeedFaturaAsync(AppDbContext ctx)
    {
        var usuarioId = Guid.NewGuid();
        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = "Cartão", TemCredito = true, LimiteTotal = 100_000,
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

        async Task<ParcelamentoDetalheDto> Criar(string descricao, decimal valor) =>
            await Parcelamentos(ctx).CriarAsync(new CriarParcelamentoDto
            {
                Descricao = descricao,
                Valor = valor,
                Tipo = TipoParcelamento.CompraParcelada,
                CartaoCreditoId = cartao.Id,
                DataCompra = DateTime.UtcNow.Date,
                Parcelas = 2,
                PrimeiraParcelaMes = TestHelpers.MesDaFatura(DateTime.UtcNow, cartao.DiaFechamento),
                IdempotencyKey = Guid.NewGuid().ToString(),
            }, usuarioId);

        var p1 = await Criar("Geladeira", 600);
        var p2 = await Criar("Sofá", 1000);
        var faturaId = p1.Parcelas.Single(p => p.Numero == 1).FaturaId;
        Assert.Equal(faturaId, p2.Parcelas.Single(p => p.Numero == 1).FaturaId);

        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Mercado", Valor = 100, Tipo = TipoTransacao.Despesa,
            CartaoCreditoId = cartao.Id, FaturaId = faturaId, UsadoComoCredito = true,
            MeioPagamento = MeioPagamento.Credito, Data = DateOnly.FromDateTime(DateTime.UtcNow), CriadoPor = usuarioId,
        });
        await ctx.SaveChangesAsync();

        return new CenarioFatura(usuarioId, cartao.Id, conta.Id, faturaId, p1, p2);
    }

    private static Task CancelarParcelaAsync(AppDbContext ctx, CenarioFatura c, Guid parcelaId) =>
        Parcelas(ctx).CancelarAsync(parcelaId, new CancelarParcelaDto
        {
            Motivo = "Devolvido",
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, c.UsuarioId);

    [Fact]
    public async Task Fatura_ParcelaCanceladaIndividualmente_SaiDoTotalEmTodosOsPontos()
    {
        var ctx = CreateContext();
        var c = await SeedFaturaAsync(ctx);
        await CancelarParcelaAsync(ctx, c, c.P2.Parcelas.Single(p => p.Numero == 1).Id);

        var faturaService = new FaturaService(ctx);
        var detalhe = await faturaService.DetalheAsync(c.FaturaId, c.UsuarioId);
        var daLista = (await faturaService.ListarPorCartaoAsync(c.CartaoId, c.UsuarioId)).Single(f => f.Id == c.FaturaId);
        var carregada = await ctx.Faturas
            .Include(f => f.Transacoes).Include(f => f.ParcelasTransacao)
            .AsNoTracking().SingleAsync(f => f.Id == c.FaturaId);

        // 100 (à vista) + 300 (P1 pendente). Os 500 da parcela cancelada de P2 não são mais devidos.
        Assert.Equal(400m, detalhe.ValorTotal);
        Assert.Equal(400m, detalhe.ValorRestante);
        Assert.Equal(400m, daLista.ValorTotal);
        Assert.Equal(400m, RegrasFinanceiras.ValorTotalFatura(carregada));
    }

    [Fact]
    public async Task DetalheDaFatura_ListaAsParcelasDoTotal_SomaDaListaBateComOTotal()
    {
        // Parcelas criadas pelo fluxo real (tela de Parcelamentos) entravam no total mas não na lista.
        var ctx = CreateContext();
        var c = await SeedFaturaAsync(ctx);
        var p2Parcela1 = c.P2.Parcelas.Single(p => p.Numero == 1).Id;
        await CancelarParcelaAsync(ctx, c, p2Parcela1);

        var detalhe = await new FaturaService(ctx).DetalheAsync(c.FaturaId, c.UsuarioId);

        // Só a 1ª de P1 (a 2ª cai na fatura seguinte; a 1ª de P2 foi cancelada).
        var parcela = Assert.Single(detalhe.Parcelas);
        Assert.Equal(c.P1.Parcelas.Single(p => p.Numero == 1).Id, parcela.Id);
        Assert.Equal("Geladeira", parcela.Descricao);
        Assert.Equal((1, 2), (parcela.Numero, parcela.QuantidadeTotal));
        Assert.Equal(c.P1.Id, parcela.ParcelamentoId);
        Assert.DoesNotContain(detalhe.Parcelas, p => p.Id == p2Parcela1);
        Assert.Equal(detalhe.ValorTotal, detalhe.Transacoes.Sum(t => t.Valor) + detalhe.Parcelas.Sum(p => p.Valor));
    }

    [Fact]
    public async Task ParcelamentoCancelado_ParcelasSaemDoTotalDeTodasAsFaturas()
    {
        var ctx = CreateContext();
        var c = await SeedFaturaAsync(ctx);

        await Parcelamentos(ctx).CancelarAsync(c.P2.Id, new CancelarParcelamentoDto
        {
            Motivo = "Compra desfeita",
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, c.UsuarioId);

        var faturas = await new FaturaService(ctx).ListarPorCartaoAsync(c.CartaoId, c.UsuarioId);
        var segundaFaturaId = c.P1.Parcelas.Single(p => p.Numero == 2).FaturaId;

        Assert.Equal(400m, faturas.Single(f => f.Id == c.FaturaId).ValorTotal);    // 100 + 300 (P1)
        Assert.Equal(300m, faturas.Single(f => f.Id == segundaFaturaId).ValorTotal); // só P1 nº 2
    }

    [Fact]
    public async Task PagarFatura_ComParcelaCancelada_QuitaPeloTotalSemACancelada()
    {
        var ctx = CreateContext();
        var c = await SeedFaturaAsync(ctx);
        await CancelarParcelaAsync(ctx, c, c.P2.Parcelas.Single(p => p.Numero == 1).Id);
        var faturaService = new FaturaService(ctx);

        // Restante é 400: cobrar a parcela cancelada (ex.: pagar 900) é recusado.
        await Assert.ThrowsAsync<ArgumentException>(() => faturaService.PagarFaturaAsync(c.FaturaId,
            new PagarFaturaDto { ContaId = c.ContaId, Valor = 401m, DataPagamento = DateTime.UtcNow }, c.UsuarioId,
            Guid.NewGuid().ToString()));

        await faturaService.PagarFaturaAsync(c.FaturaId,
            new PagarFaturaDto { ContaId = c.ContaId, Valor = 400m, DataPagamento = DateTime.UtcNow }, c.UsuarioId,
            Guid.NewGuid().ToString());

        var fatura = await ctx.Faturas.AsNoTracking().SingleAsync(f => f.Id == c.FaturaId);
        Assert.Equal(EstadoPagamentoFatura.Pago, fatura.EstadoPagamento);
    }

    [Fact]
    public async Task PagarParcelaAntecipada_FaturaComParcelaCancelada_TotalERestanteSemACancelada()
    {
        var ctx = CreateContext();
        var c = await SeedFaturaAsync(ctx);
        await CancelarParcelaAsync(ctx, c, c.P2.Parcelas.Single(p => p.Numero == 1).Id);

        var resultado = await Parcelas(ctx).PagarAntecipadoAsync(
            c.P1.Parcelas.Single(p => p.Numero == 1).Id,
            new PagarParcelaDto { ContaPagamentoId = c.ContaId, IdempotencyKey = Guid.NewGuid().ToString() },
            c.UsuarioId);

        // Total 400 (100 à vista + 300 P1), pagos 300 → falta 100 (antes: total 900, falta 600).
        Assert.Equal(400m, resultado.FaturaAtualizada.ValorTotal);
        Assert.Equal(300m, resultado.FaturaAtualizada.ValorPago);
        Assert.Equal(100m, resultado.FaturaAtualizada.ValorRestante);
        Assert.Equal(EstadoPagamentoFatura.Parcial, resultado.FaturaAtualizada.EstadoPagamento);
    }

    [Fact]
    public async Task FaturaAtrasoJob_JurosEMultaNaoIncidemSobreParcelaCancelada()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var hoje = DateTime.UtcNow.Date;
        var cartao = new CartaoCredito { Id = Guid.NewGuid(), Nome = "Cartão", TemCredito = true, CriadoPor = usuarioId, Ativo = true };
        var fatura = new Fatura
        {
            Id = Guid.NewGuid(), CartaoCreditoId = cartao.Id, CriadoPor = usuarioId,
            DataInicio = hoje.AddDays(-50), DataFechamento = hoje.AddDays(-20), DataVencimento = hoje.AddDays(-10),
            EstadoCiclo = EstadoCicloFatura.Fechada, EstadoPagamento = EstadoPagamentoFatura.NaoPago,
        };
        var parcelamento = new Parcelamento
        {
            Id = Guid.NewGuid(), CriadoPor = usuarioId, Tipo = TipoParcelamento.CompraParcelada, Descricao = "TV",
            DataCompra = hoje.AddDays(-40), ValorTotal = 1800, QuantidadeParcelas = 2, CartaoCreditoId = cartao.Id,
            Ativo = false,
        };
        ctx.CartoesCredito.Add(cartao);
        ctx.Faturas.Add(fatura);
        ctx.Parcelamentos.Add(parcelamento);
        ctx.ParcelasTransacao.Add(new ParcelaTransacao
        {
            Id = Guid.NewGuid(), ParcelamentoId = parcelamento.Id, Numero = 1, QuantidadeTotal = 2,
            DataVencimento = fatura.DataVencimento, Valor = 900, FaturaId = fatura.Id,
            Status = StatusParcela.Cancelada, CriadoPor = usuarioId,
        });
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Mercado", Valor = 100, Tipo = TipoTransacao.Despesa,
            CartaoCreditoId = cartao.Id, FaturaId = fatura.Id, UsadoComoCredito = true,
            Data = DateOnly.FromDateTime(hoje.AddDays(-30)), CriadoPor = usuarioId,
        });
        await ctx.SaveChangesAsync();

        await new FaturaAtrasoJob(ctx).ExecuteAsync();

        var depois = await ctx.Faturas.AsNoTracking().SingleAsync(f => f.Id == fatura.Id);
        Assert.True(depois.EstaAtrasada);
        Assert.Equal(1.00m, depois.JurosDeMora); // 1% × 1 mês × 100 (não × 1000)
        Assert.Equal(2.00m, depois.Multa);       // 2% × 100
    }

    // ══ Saldo de conta ═══════════════════════════════════════════════════════

    private sealed record CenarioSaldo(
        Guid UsuarioId, Guid ContaId, Guid OutraContaId, Guid UsuarioAlheioId, Guid ContaAlheiaId,
        List<Transacao> Lancamentos);

    /// <summary>
    /// Fixture com todo tipo de lançamento que já confundiu saldo:
    /// executado, previsão, soft-deletado, saldo inicial, transferência (saída e entrada),
    /// pagamento de fatura, compra no cartão (sem conta), outra conta do mesmo usuário e conta alheia.
    /// Saldo esperado da conta principal: 1000 − 300 + 5000 − 150 + 70 − 400 = 5220.
    /// </summary>
    private static async Task<CenarioSaldo> SeedSaldoAsync(AppDbContext ctx)
    {
        var usuarioId = Guid.NewGuid();
        var alheioId = Guid.NewGuid();
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Principal", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuarioId };
        var outra = new Conta { Id = Guid.NewGuid(), Nome = "Poupança", Tipo = TipoConta.ContaPoupanca, UsuarioIdProprietario = usuarioId };
        var alheia = new Conta { Id = Guid.NewGuid(), Nome = "De outro", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = alheioId };
        var cartao = new CartaoCredito { Id = Guid.NewGuid(), Nome = "Cartão", TemCredito = true, CriadoPor = usuarioId, Ativo = true };
        var data = new DateTime(2026, 5, 15);

        Transacao Tx(Guid contaId, TipoTransacao tipo, decimal valor,
            StatusTransacao status = StatusTransacao.Executado, bool ativo = true, Action<Transacao>? cfg = null)
        {
            var t = new Transacao
            {
                Id = Guid.NewGuid(), Descricao = "t", Valor = valor, Tipo = tipo, ContaId = contaId,
                Data = DateOnly.FromDateTime(data), StatusTransacao = status, Ativo = ativo, CriadoPor = usuarioId,
            };
            cfg?.Invoke(t);
            return t;
        }

        var lancamentos = new List<Transacao>
        {
            Tx(conta.Id, TipoTransacao.Receita, 1000),
            Tx(conta.Id, TipoTransacao.Despesa, 300),
            Tx(conta.Id, TipoTransacao.Receita, 500, StatusTransacao.Previsao),                 // previsão: fora
            Tx(conta.Id, TipoTransacao.Despesa, 200, StatusTransacao.Previsao),                 // previsão: fora
            Tx(conta.Id, TipoTransacao.Despesa, 999, StatusTransacao.Cancelado, ativo: false),  // excluída: fora
            Tx(conta.Id, TipoTransacao.Receita, 5000, cfg: t => t.EhSaldoInicial = true),        // move dinheiro: entra
            Tx(conta.Id, TipoTransacao.Despesa, 150, cfg: t => t.EhTransferencia = true),        // entra
            Tx(conta.Id, TipoTransacao.Receita, 70, cfg: t => t.EhTransferencia = true),         // entra
            Tx(conta.Id, TipoTransacao.Despesa, 400, cfg: t => t.EhPagamentoFatura = true),      // entra
            Tx(outra.Id, TipoTransacao.Receita, 10),
            Tx(alheia.Id, TipoTransacao.Receita, 777, cfg: t => t.CriadoPor = alheioId),
            new()
            {
                Id = Guid.NewGuid(), Descricao = "compra cartão", Valor = 60, Tipo = TipoTransacao.Despesa,
                CartaoCreditoId = cartao.Id, UsadoComoCredito = true, Data = DateOnly.FromDateTime(data), CriadoPor = usuarioId,
            },
        };

        ctx.Contas.AddRange(conta, outra, alheia);
        ctx.CartoesCredito.Add(cartao);
        ctx.Transacoes.AddRange(lancamentos);
        await ctx.SaveChangesAsync();

        return new CenarioSaldo(usuarioId, conta.Id, outra.Id, alheioId, alheia.Id, lancamentos);
    }

    /// <summary>
    /// A fórmula ANTIGA, como estava copiada no ContasController, DashboardService e
    /// ParcelaTransacaoService: soma em memória sobre o histórico da conta, Ativo + Executado.
    /// </summary>
    private static decimal FormulaAntiga(IEnumerable<Transacao> daConta) =>
        daConta.Where(t => t.Ativo && t.StatusTransacao == StatusTransacao.Executado && t.Tipo == TipoTransacao.Receita).Sum(t => t.Valor)
        - daConta.Where(t => t.Ativo && t.StatusTransacao == StatusTransacao.Executado && t.Tipo == TipoTransacao.Despesa).Sum(t => t.Valor);

    [Fact]
    public async Task SaldoAgregadoNoBanco_BateComAFormulaAntiga()
    {
        var ctx = CreateContext();
        var c = await SeedSaldoAsync(ctx);

        var saldos = await RegrasFinanceiras.SaldosDasContasAsync(ctx, new[] { c.ContaId, c.OutraContaId }, c.UsuarioId);
        var alheia = await RegrasFinanceiras.SaldoDaContaAsync(ctx, c.ContaAlheiaId, c.UsuarioAlheioId);

        Assert.Equal(5220m, saldos[c.ContaId].Saldo);
        Assert.Equal(FormulaAntiga(c.Lancamentos.Where(t => t.ContaId == c.ContaId)), saldos[c.ContaId].Saldo);
        Assert.Equal(FormulaAntiga(c.Lancamentos.Where(t => t.ContaId == c.OutraContaId)), saldos[c.OutraContaId].Saldo);
        Assert.Equal(FormulaAntiga(c.Lancamentos.Where(t => t.ContaId == c.ContaAlheiaId)), alheia.Saldo);
        Assert.Equal(6070m, saldos[c.ContaId].Receitas);
        Assert.Equal(850m, saldos[c.ContaId].Despesas);
    }

    [Fact]
    public async Task Saldo_IgualEmTodosOsPontosUnificados()
    {
        var ctx = CreateContext();
        var c = await SeedSaldoAsync(ctx);

        // 1. Regra única
        var regra = (await RegrasFinanceiras.SaldoDaContaAsync(ctx, c.ContaId, c.UsuarioId)).Saldo;

        // 2. Tela de contas (listagem e detalhe)
        var controller = new ContasController(new ContaService(ctx, new FinancialEventLogService(ctx)),
            new EncerramentoContaService(ctx, new TransferenciaService(ctx), new FinancialEventLogService(ctx)), new MetaService(ctx))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                        new[] { new Claim(ClaimTypes.NameIdentifier, c.UsuarioId.ToString()) }, "test")),
                },
            },
        };
        var lista = ((IEnumerable<ContaDto>)((OkObjectResult)await controller.Listar()).Value!).ToList();
        var detalhe = (ContaDto)((OkObjectResult)await controller.BuscarPorId(c.ContaId)).Value!;

        // 3. Dashboard
        var dashboard = await new DashboardService(ctx, new LimiteCalculatorService(ctx)).GetResumoAsync(c.UsuarioId, 2026, 5);

        // 4. Resumo por conta (/transacoes/resumo/{contaId})
        var resumo = await new TransacaoService(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx)).ObterResumoPorContaAsync(c.ContaId, c.UsuarioId);

        Assert.Equal(5220m, regra);
        Assert.Equal(regra, lista.Single(x => x.Id == c.ContaId).SaldoAtual);
        Assert.Equal(10m, lista.Single(x => x.Id == c.OutraContaId).SaldoAtual);
        Assert.DoesNotContain(lista, x => x.Id == c.ContaAlheiaId);
        Assert.Equal(regra, detalhe.SaldoAtual);
        Assert.Equal(regra, dashboard.SaldoContas.Single(x => x.Id == c.ContaId).Saldo);
        Assert.Equal(5230m, dashboard.SaldoTotal);
        // Resumo agora é o saldo REAL (antes somava previsão: 5520).
        Assert.Equal(regra, resumo.Saldo);
        Assert.Equal(6070m, resumo.TotalReceitas);
        Assert.Equal(850m, resumo.TotalDespesas);
    }

    [Theory]
    [InlineData(10440.00, false)] // parcela 5220,00 = saldo → paga
    [InlineData(10440.02, true)]  // parcela 5220,01 > saldo → recusa (com previsão no saldo passaria: 5520)
    public async Task PagarParcelaAntecipada_ValidaSaldoPelaRegraUnica(decimal valorParcelamento, bool deveRecusar)
    {
        var ctx = CreateContext();
        var c = await SeedSaldoAsync(ctx);
        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = "Crédito", TemCredito = true, LimiteTotal = 100_000,
            DiaFechamento = 10, DiaVencimento = 20, CriadoPor = c.UsuarioId, Ativo = true,
        };
        ctx.CartoesCredito.Add(cartao);
        await ctx.SaveChangesAsync();

        var parcelamento = await Parcelamentos(ctx).CriarAsync(new CriarParcelamentoDto
        {
            Descricao = "Notebook",
            Valor = valorParcelamento,
            Tipo = TipoParcelamento.CompraParcelada,
            CartaoCreditoId = cartao.Id,
            DataCompra = DateTime.UtcNow.Date,
            Parcelas = 2,
            PrimeiraParcelaMes = TestHelpers.MesDaFatura(DateTime.UtcNow, cartao.DiaFechamento),
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, c.UsuarioId);

        Task Pagar() => Parcelas(ctx).PagarAntecipadoAsync(
            parcelamento.Parcelas.Single(p => p.Numero == 1).Id,
            new PagarParcelaDto { ContaPagamentoId = c.ContaId, IdempotencyKey = Guid.NewGuid().ToString() },
            c.UsuarioId);

        if (deveRecusar)
        {
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(Pagar);
            Assert.Contains("Saldo insuficiente", ex.Message);
        }
        else
        {
            await Pagar();
            Assert.Equal(0m, (await RegrasFinanceiras.SaldoDaContaAsync(ctx, c.ContaId, c.UsuarioId)).Saldo);
        }
    }

    [Fact]
    public async Task Saldos_ContaDeOutroUsuarioOuSemLancamento_VoltaZero()
    {
        var ctx = CreateContext();
        var c = await SeedSaldoAsync(ctx);
        var vazia = new Conta { Id = Guid.NewGuid(), Nome = "Vazia", Tipo = TipoConta.Dinheiro, UsuarioIdProprietario = c.UsuarioId };
        ctx.Contas.Add(vazia);
        await ctx.SaveChangesAsync();

        // Id de conta alheia "vazando" de um chamador: soma zero em vez de expor o saldo de outro.
        var saldos = await RegrasFinanceiras.SaldosDasContasAsync(ctx, new[] { c.ContaAlheiaId, vazia.Id }, c.UsuarioId);

        Assert.Equal(0m, saldos[c.ContaAlheiaId].Saldo);
        Assert.Equal(0m, saldos[vazia.Id].Saldo);
    }

    [Fact]
    public async Task ListarContas_NaoCarregaHistoricoDeLancamentosEmMemoria()
    {
        var ctx = CreateContext();
        var c = await SeedSaldoAsync(ctx);

        var contas = await new ContaService(ctx, new FinancialEventLogService(ctx)).ListarAsync(c.UsuarioId);

        Assert.All(contas, conta => Assert.Empty(conta.Transacoes));
    }

    [Fact]
    public void ConsultaSaldos_NoPostgres_AgregaComSumEGroupByNoSql()
    {
        // Só monta o SQL (ToQueryString não abre conexão) — prova que a soma é do banco, não do C#.
        using var ctx = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=naoconecta;Username=x;Password=x")
            .Options);

        var sql = RegrasFinanceiras.ConsultaSaldosDasContas(ctx, new[] { Guid.NewGuid() }, Guid.NewGuid()).ToQueryString();

        Assert.Contains("GROUP BY", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("SUM(", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("\"StatusTransacao\"", sql);
        Assert.Contains("\"UsuarioIdProprietario\"", sql);
    }
}

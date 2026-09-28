using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.CartaoCredito;
using ControleFinanceiro.Api.DTOs.Fatura;
using ControleFinanceiro.Api.DTOs.Parcelamento;
using ControleFinanceiro.Api.DTOs.ParcelaTransacao;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
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
            ContaId = conta.Id, Data = DateTime.UtcNow.Date, CriadoPor = usuarioId,
        });
        await ctx.SaveChangesAsync();
        return new Cenario(usuarioId, cartao.Id, conta.Id);
    }

    /// <summary>Compra à vista no crédito pelo caminho real (a fatura do ciclo nasce/é achada no service).</summary>
    private static Task<Transacao> ComprarAsync(
        AppDbContext ctx, Cenario c, decimal valor, StatusTransacao status = StatusTransacao.Executado) =>
        new TransacaoService(ctx, new FaturaService(ctx)).CriarTransacaoAsync(new Transacao
        {
            Descricao = "Compra", Valor = valor, Tipo = TipoTransacao.Despesa, CartaoCreditoId = c.CartaoId,
            UsadoComoCredito = true, MeioPagamento = MeioPagamento.Credito, StatusTransacao = status,
            Data = DateTime.UtcNow.Date,
        }, c.UsuarioId);

    private static ParcelamentoService Parcelamentos(AppDbContext ctx) =>
        new(ctx, new FinancialEventLogService(ctx), new LimiteCalculatorService(ctx), new FaturaService(ctx));

    private static Task<ParcelamentoDetalheDto> ParcelarAsync(AppDbContext ctx, Cenario c, decimal valor, int parcelas) =>
        Parcelamentos(ctx).CriarAsync(new CriarParcelamentoDto
        {
            Descricao = "Geladeira", Valor = valor, Tipo = TipoParcelamento.CompraParcelada,
            CartaoCreditoId = c.CartaoId, DataCompra = DateTime.UtcNow.Date, Parcelas = parcelas,
            PrimeiraParcelaMes = DateTime.UtcNow.ToString("yyyy-MM", System.Globalization.CultureInfo.InvariantCulture),
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
            CartaoCreditoId = c.CartaoId, FaturaId = f.Id, UsadoComoCredito = true, Data = f.DataInicio,
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
    }

    // ══ Compra no cartão fora de fatura ═════════════════════════════════════

    [Fact]
    public async Task RecorrenteGeradaSemFatura_BloqueiaAParte_DebitoEPrevisaoSemFaturaNao()
    {
        var ctx = CreateContext();
        var c = await SeedAsync(ctx);
        var hoje = DateTime.UtcNow.Date;
        ctx.Recorrentes.Add(new Recorrente
        {
            Id = Guid.NewGuid(), Descricao = "Streaming", Valor = 80, Tipo = TipoTransacao.Despesa,
            CartaoCreditoId = c.CartaoId, Frequencia = FrequenciaRecorrencia.Mensal, Dia = hoje.Day,
            DataInicio = hoje, DataProximaGeracao = hoje, Ativo = true, CriadoPor = c.UsuarioId,
        });
        // Débito com o cartão (tem conta): saiu da conta, não do limite.
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Padaria", Valor = 70, Tipo = TipoTransacao.Despesa,
            ContaId = c.ContaId, CartaoCreditoId = c.CartaoId, Data = hoje, CriadoPor = c.UsuarioId,
        });
        // Previsão sem fatura: ainda não foi cobrada.
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Previsto", Valor = 60, Tipo = TipoTransacao.Despesa,
            CartaoCreditoId = c.CartaoId, StatusTransacao = StatusTransacao.Previsao, Data = hoje.AddDays(5),
            CriadoPor = c.UsuarioId,
        });
        await ctx.SaveChangesAsync();

        // Caminho real que grava compra no cartão sem FaturaId (achado registrado na regra).
        await new RecorrenteService(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx), new HttpContextAccessor())
            .GerarPendentesAsync(c.UsuarioId);
        var gerada = await ctx.Transacoes.AsNoTracking().SingleAsync(t => t.Descricao == "Streaming");
        Assert.Null(gerada.FaturaId);

        await AssertMesmoNumeroEmTodosOsPontosAsync(ctx, c, 80m);
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
            CartaoCreditoId = c.CartaoId, Data = DateTime.UtcNow.Date, CriadoPor = outro.UsuarioId,
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

using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class DashboardServiceTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static Transacao Tx(Guid contaId, TipoTransacao tipo, decimal valor, DateTime data,
        StatusTransacao status = StatusTransacao.Executado, bool ativo = true) => new()
    {
        Id = Guid.NewGuid(),
        Descricao = "t",
        Valor = valor,
        Tipo = tipo,
        ContaId = contaId,
        Data = DateOnly.FromDateTime(data),
        StatusTransacao = status,
        Ativo = ativo,
    };

    // ── Helpers da reforma do Dashboard ───────────────────────────────────────

    private static DashboardService Servico(AppDbContext ctx) => new(ctx, new LimiteCalculatorService(ctx));

    // "Hoje" do serviço = DateTime.UtcNow.Date (o mesmo relógio do DashboardService). Teste que depende do
    // relógio (recentes até hoje, "mês passado" do hero) monta as datas a partir daqui — nunca de data fixa —
    // e captura o valor UMA vez no começo (`var hoje = Hoje;`).
    private static DateOnly Hoje => DateOnly.FromDateTime(DateTime.UtcNow);
    private static DateOnly PrimeiroDoMes(DateOnly d) => new(d.Year, d.Month, 1);
    private static (int Ano, int Mes) MesDe(DateOnly d) => (d.Year, d.Month);

    private static Conta NovaConta(AppDbContext ctx, Guid usuarioId, string nome = "Conta",
        TipoConta tipo = TipoConta.ContaCorrente)
    {
        var conta = new Conta { Id = Guid.NewGuid(), Nome = nome, Tipo = tipo, UsuarioIdProprietario = usuarioId };
        ctx.Contas.Add(conta);
        return conta;
    }

    private static CartaoCredito NovoCartao(AppDbContext ctx, Guid usuarioId, string nome = "Cartão",
        string? ultimosDigitos = null, decimal limite = 5000m)
    {
        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = nome, UltimosDigitos = ultimosDigitos, TemCredito = true,
            LimiteTotal = limite, CriadoPor = usuarioId, Ativo = true,
        };
        ctx.CartoesCredito.Add(cartao);
        return cartao;
    }

    private static Categoria NovaCategoria(AppDbContext ctx, string descricao)
    {
        var categoria = new Categoria { Id = Guid.NewGuid(), Descricao = descricao, Finalidade = Finalidade.Despesa };
        ctx.Categorias.Add(categoria);
        return categoria;
    }

    // Lançamento Executado/Ativo (ou "de lugar nenhum", contaId null) num dia — o molde de partida; `ajusta`
    // muda o que o cenário precisa (status, flags, hora, cartão, categoria...).
    private static Transacao Mov(Guid? contaId, TipoTransacao tipo, decimal valor, DateOnly dia,
        string descricao = "t", Action<Transacao>? ajusta = null)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(),
            Descricao = descricao,
            Valor = valor,
            Tipo = tipo,
            ContaId = contaId,
            Data = dia,
            StatusTransacao = StatusTransacao.Executado,
            Ativo = true,
        };
        ajusta?.Invoke(t);
        return t;
    }

    // Despesa efetivada da conta numa categoria (null = sem categoria).
    private static Transacao Gasto(Guid contaId, decimal valor, Categoria? categoria, DateOnly dia,
        Action<Transacao>? ajusta = null) =>
        Mov(contaId, TipoTransacao.Despesa, valor, dia, categoria?.Descricao ?? "sem categoria", t =>
        {
            t.CategoriaId = categoria?.Id;
            ajusta?.Invoke(t);
        });

    [Fact]
    public async Task GetResumoAsync_SeparaOs6KpisPorStatusETipo()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Conta", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuarioId };
        ctx.Contas.Add(conta);
        var d = new DateTime(2026, 5, 15);
        ctx.Transacoes.AddRange(
            Tx(conta.Id, TipoTransacao.Receita, 1000, d, StatusTransacao.Executado),
            Tx(conta.Id, TipoTransacao.Receita, 400, d, StatusTransacao.Previsao),
            Tx(conta.Id, TipoTransacao.Despesa, 300, d, StatusTransacao.Executado),
            Tx(conta.Id, TipoTransacao.Despesa, 200, d, StatusTransacao.Previsao),
            Tx(conta.Id, TipoTransacao.Despesa, 999, d, StatusTransacao.Cancelado),
            Tx(conta.Id, TipoTransacao.Despesa, 50, d, StatusTransacao.Executado, ativo: false)
        );
        await ctx.SaveChangesAsync();

        var r = await new DashboardService(ctx, new LimiteCalculatorService(ctx)).GetResumoAsync(usuarioId, 2026, 5);

        Assert.Equal(1000m, r.Recebido);
        Assert.Equal(400m, r.AReceber);
        Assert.Equal(300m, r.Pago);
        Assert.Equal(200m, r.APagar);
        Assert.Equal(1400m, r.ReceitasMes);
        Assert.Equal(500m, r.DespesasMes);
    }

    [Fact]
    public async Task GetResumoAsync_KpisExcluemFlagsMasSaldoAsInclui()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Conta", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuarioId };
        ctx.Contas.Add(conta);
        var d = new DateTime(2026, 5, 15);

        Transacao Flag(TipoTransacao tipo, decimal valor, Action<Transacao> cfg)
        {
            var t = Tx(conta.Id, tipo, valor, d);
            cfg(t);
            return t;
        }

        ctx.Transacoes.AddRange(
            Tx(conta.Id, TipoTransacao.Receita, 1000, d),                         // receita real
            Tx(conta.Id, TipoTransacao.Despesa, 100, d),                          // despesa real
            Flag(TipoTransacao.Receita, 5000, t => t.EhSaldoInicial = true),      // saldo inicial
            Flag(TipoTransacao.Despesa, 200, t => t.EhTransferencia = true),      // transferência saída
            Flag(TipoTransacao.Despesa, 300, t => t.EhPagamentoFatura = true),    // pagamento fatura
            Flag(TipoTransacao.Receita, 132.50m, t => t.EhPixNoCredito = true),  // Pix no Crédito: o cartão põe…
            Flag(TipoTransacao.Despesa, 132.50m, t => t.EhPixNoCredito = true),  // …e o Pix tira
            Flag(TipoTransacao.Receita, 40, t => t.EhAjusteReconciliacao = true)  // ajuste de reconciliação
        );
        await ctx.SaveChangesAsync();

        var r = await new DashboardService(ctx, new LimiteCalculatorService(ctx)).GetResumoAsync(usuarioId, 2026, 5);

        // KPIs de P&L: só o que é receita/despesa real
        Assert.Equal(1000m, r.Recebido);
        Assert.Equal(100m, r.Pago);
        Assert.Equal(1000m, r.EntradasCaixa);
        Assert.Equal(100m, r.SaidasCaixa);
        // Saldo conta TODO movimento real: 1000 - 100 + 5000 - 200 - 300 + 132,50 - 132,50 + 40 = 5440
        Assert.Equal(5440m, r.SaldoTotal);
    }

    [Fact]
    public async Task GetResumoAsync_SaldoIgnoraCanceladas()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Conta", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuarioId };
        ctx.Contas.Add(conta);
        var d = new DateTime(2026, 5, 15);
        ctx.Transacoes.AddRange(
            Tx(conta.Id, TipoTransacao.Receita, 1000, d),
            Tx(conta.Id, TipoTransacao.Despesa, 400, d, ativo: false) // soft-deletada não conta no saldo
        );
        await ctx.SaveChangesAsync();

        var r = await new DashboardService(ctx, new LimiteCalculatorService(ctx)).GetResumoAsync(usuarioId, 2026, 5);

        Assert.Equal(1000m, r.SaldoTotal);
    }

    [Fact]
    public async Task GetResumoAsync_EvolucaoSaldoTem6Meses()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        ctx.Contas.Add(new Conta { Id = Guid.NewGuid(), Nome = "C", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuarioId });
        await ctx.SaveChangesAsync();

        var r = await new DashboardService(ctx, new LimiteCalculatorService(ctx)).GetResumoAsync(usuarioId, 2026, 5);

        Assert.Equal(6, r.EvolucaoSaldo.Count);
        Assert.Equal(5, r.EvolucaoSaldo[^1].Mes);
        Assert.Equal(2026, r.EvolucaoSaldo[^1].Ano);
    }

    [Fact]
    public async Task GetResumoAsync_SaldoAcumuladoCresceComReceitaExecutada()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "C", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuarioId };
        ctx.Contas.Add(conta);
        ctx.Transacoes.Add(Tx(conta.Id, TipoTransacao.Receita, 1000, new DateTime(2026, 3, 10)));
        await ctx.SaveChangesAsync();

        var r = await new DashboardService(ctx, new LimiteCalculatorService(ctx)).GetResumoAsync(usuarioId, 2026, 5);

        Assert.Equal(1000m, r.EvolucaoSaldo[^1].Saldo);
    }

    [Fact]
    public async Task GetResumoAsync_CalculaCaixaDoMesAnterior()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "C", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuarioId };
        ctx.Contas.Add(conta);
        // Mês atual (maio): só pra existir.
        ctx.Transacoes.Add(Tx(conta.Id, TipoTransacao.Receita, 1000, new DateTime(2026, 5, 10)));
        // Mês anterior (abril) — caixa: entradas 600, saídas 500. Previsão, cancelada e
        // inativa NÃO entram no caixa (só Executado/Ativo).
        ctx.Transacoes.AddRange(
            Tx(conta.Id, TipoTransacao.Receita, 600, new DateTime(2026, 4, 5), StatusTransacao.Executado),
            Tx(conta.Id, TipoTransacao.Receita, 200, new DateTime(2026, 4, 6), StatusTransacao.Previsao),
            Tx(conta.Id, TipoTransacao.Despesa, 500, new DateTime(2026, 4, 8), StatusTransacao.Executado),
            Tx(conta.Id, TipoTransacao.Despesa, 999, new DateTime(2026, 4, 9), StatusTransacao.Cancelado),
            Tx(conta.Id, TipoTransacao.Despesa, 50, new DateTime(2026, 4, 9), StatusTransacao.Executado, ativo: false));
        await ctx.SaveChangesAsync();

        var r = await new DashboardService(ctx, new LimiteCalculatorService(ctx)).GetResumoAsync(usuarioId, 2026, 5);

        Assert.Equal(600m, r.EntradasCaixaMesAnterior);  // só o Executado/Ativo
        Assert.Equal(500m, r.SaidasCaixaMesAnterior);
    }

    // ══ Item 1 — transação ligada a conta E a cartão não conta 2× ═════════════
    //
    // O serviço junta as transações pelos DOIS Includes (contas e cartões): um débito no cartão tem
    // ContaId + CartaoCreditoId e vinha pelos dois. O DistinctBy(Id) tira a duplicata.

    [Fact]
    public async Task GetResumoAsync_TransacaoLigadaAContaECartao_NaoContaEmDobroNosKpisCategoriasERecentes()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var cartao = NovoCartao(ctx, usuarioId);
        var mercado = NovaCategoria(ctx, "Mercado");
        var hoje = Hoje;
        var dia = hoje.AddDays(-1); // o mês pedido é o do próprio lançamento
        var ultimoDiaDoMesAnterior = PrimeiroDoMes(dia).AddDays(-1);
        ctx.Transacoes.AddRange(
            Mov(conta.Id, TipoTransacao.Despesa, 100, dia, "débito no cartão",
                t => { t.CartaoCreditoId = cartao.Id; t.CategoriaId = mercado.Id; }),
            Mov(conta.Id, TipoTransacao.Receita, 400, dia, "estorno no cartão", t => t.CartaoCreditoId = cartao.Id),
            Mov(conta.Id, TipoTransacao.Despesa, 40, ultimoDiaDoMesAnterior, "débito no cartão (mês passado)",
                t => t.CartaoCreditoId = cartao.Id));
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, dia.Year, dia.Month);

        // KPIs do mês: cada lançamento uma vez só.
        Assert.Equal(100m, r.Pago);
        Assert.Equal(100m, r.DespesasMes);
        Assert.Equal(100m, r.SaidasCaixa);
        Assert.Equal(400m, r.Recebido);
        Assert.Equal(400m, r.EntradasCaixa);
        Assert.Equal(300m, r.SaldoCaixaMes);
        Assert.Equal(40m, r.SaidasCaixaMesAnterior);
        // Maiores gastos: o mercado soma 100, não 200 (e 100% de um único grupo).
        var fatia = Assert.Single(r.TopCategorias);
        Assert.Equal("Mercado", fatia.Descricao);
        Assert.Equal(100m, fatia.Valor);
        Assert.Equal(100m, fatia.Percentual);
        // Recentes: 3 lançamentos distintos, não 6.
        Assert.Equal(3, r.TransacoesRecentes.Count);
        Assert.Equal(3, r.TransacoesRecentes.Select(t => t.Id).Distinct().Count());
        // O saldo (agregado no banco) sempre foi uma vez só — o resto do resumo tem que bater com ele.
        Assert.Equal(260m, r.SaldoTotal); // 400 - 100 - 40
    }

    [Fact]
    public async Task GetResumoAsync_TransacaoLigadaAContaECartao_SaldoMesAnteriorEEvolucaoContamUmaVez()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var cartao = NovoCartao(ctx, usuarioId);
        var hoje = Hoje;
        var inicioMes = PrimeiroDoMes(hoje);
        ctx.Transacoes.AddRange(
            Mov(conta.Id, TipoTransacao.Receita, 1000, inicioMes.AddMonths(-2).AddDays(4), "salário"),
            // débito no cartão: ligada à conta E ao cartão
            Mov(conta.Id, TipoTransacao.Despesa, 100, inicioMes.AddDays(-1), "débito no cartão (mês passado)",
                t => t.CartaoCreditoId = cartao.Id),
            Mov(conta.Id, TipoTransacao.Despesa, 30, inicioMes, "débito no cartão (mês corrente)",
                t => t.CartaoCreditoId = cartao.Id));
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, hoje.Year, hoje.Month);

        Assert.Equal(870m, r.SaldoTotal);                 // 1000 - 100 - 30
        Assert.Equal(900m, r.SaldoMesAnterior);           // 1000 - 100: com a duplicata sairia 800
        Assert.Equal(870m, r.EvolucaoSaldo[^1].Saldo);    // mês corrente = saldo de hoje (com a duplicata: 740)
        Assert.Equal(900m, r.EvolucaoSaldo[^2].Saldo);
        Assert.Equal(1000m, r.EvolucaoSaldo[^3].Saldo);
    }

    // ══ Item 2 — transações recentes ══════════════════════════════════════════

    [Fact]
    public async Task GetResumoAsync_RecentesIgnoramPrevisaoSaldoInicialDataFuturaECanceladas()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var hoje = Hoje;
        ctx.Transacoes.AddRange(
            // entram: efetivadas, vivas, até hoje (hoje inclusive)
            Mov(conta.Id, TipoTransacao.Despesa, 10, hoje, "feira de hoje"),
            Mov(conta.Id, TipoTransacao.Despesa, 11, hoje.AddDays(-1), "mercado"),
            Mov(conta.Id, TipoTransacao.Receita, 12, hoje.AddDays(-2), "salário"),
            // não entram
            Mov(conta.Id, TipoTransacao.Despesa, 20, hoje.AddDays(3), "previsão futura",
                t => t.StatusTransacao = StatusTransacao.Previsao),
            Mov(conta.Id, TipoTransacao.Despesa, 21, hoje.AddDays(-3), "previsão que não efetivou",
                t => t.StatusTransacao = StatusTransacao.Previsao),
            Mov(conta.Id, TipoTransacao.Despesa, 22, hoje.AddDays(1), "efetivada com data de amanhã"),
            Mov(conta.Id, TipoTransacao.Receita, 23, hoje.AddDays(-4), "saldo inicial", t => t.EhSaldoInicial = true),
            Mov(conta.Id, TipoTransacao.Despesa, 24, hoje.AddDays(-5), "cancelada",
                t => t.StatusTransacao = StatusTransacao.Cancelado),
            Mov(conta.Id, TipoTransacao.Despesa, 25, hoje.AddDays(-6), "soft-deletada", t => t.Ativo = false));
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, hoje.Year, hoje.Month);

        Assert.Equal(new[] { "feira de hoje", "mercado", "salário" }, r.TransacoesRecentes.Select(t => t.Descricao));
    }

    [Fact]
    public async Task GetResumoAsync_RecentesNaoSaoFuradosPorRecorrentesGeradasPraFrente()
    {
        // Regressão: o recorrente gera a previsão dos próximos meses. Ordenar só por data (desc) e pegar 7
        // enchia a lista com elas — as transações que de fato aconteceram sumiam do card.
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var hoje = Hoje;
        for (var i = 1; i <= 10; i++)
        {
            ctx.Transacoes.Add(Mov(conta.Id, TipoTransacao.Despesa, 50, hoje.AddDays(i), $"assinatura {i}",
                t => t.StatusTransacao = StatusTransacao.Previsao));
        }
        ctx.Transacoes.AddRange(
            Mov(conta.Id, TipoTransacao.Despesa, 30, hoje.AddDays(-1), "mercado"),
            Mov(conta.Id, TipoTransacao.Despesa, 12, hoje.AddDays(-2), "padaria"));
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, hoje.Year, hoje.Month);

        Assert.Equal(new[] { "mercado", "padaria" }, r.TransacoesRecentes.Select(t => t.Descricao));
    }

    [Fact]
    public async Task GetResumoAsync_RecentesOrdenamPorDiaDepoisHoraDepoisCriacao()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var hoje = Hoje;
        var criadoBase = new DateTime(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc);
        // O CriadoEm é montado CONTRA a ordem esperada (09:00 criada por último, 18:30 antes dela): se a hora
        // deixasse de desempatar, a criação reordenaria o dia e o teste pegaria.
        ctx.Transacoes.AddRange(
            // propositalmente fora de ordem
            Mov(conta.Id, TipoTransacao.Despesa, 1, hoje.AddDays(-2), "anteontem 23:59",
                t => { t.Hora = new TimeOnly(23, 59); t.CriadoEm = criadoBase.AddMinutes(20); }),
            Mov(conta.Id, TipoTransacao.Despesa, 1, hoje.AddDays(-1), "ontem 09:00",
                t => { t.Hora = new TimeOnly(9, 0); t.CriadoEm = criadoBase.AddMinutes(10); }),
            Mov(conta.Id, TipoTransacao.Despesa, 1, hoje, "hoje 00:01",
                t => { t.Hora = new TimeOnly(0, 1); t.CriadoEm = criadoBase; }),
            Mov(conta.Id, TipoTransacao.Despesa, 1, hoje.AddDays(-1), "ontem 18:30",
                t => { t.Hora = new TimeOnly(18, 30); t.CriadoEm = criadoBase.AddMinutes(1); }),
            // sem hora = 00:00 → empate com outro sem hora do mesmo dia desempata pela criação (mais nova primeiro)
            Mov(conta.Id, TipoTransacao.Despesa, 1, hoje.AddDays(-1), "ontem sem hora, criada antes",
                t => t.CriadoEm = criadoBase),
            Mov(conta.Id, TipoTransacao.Despesa, 1, hoje.AddDays(-1), "ontem sem hora, criada depois",
                t => t.CriadoEm = criadoBase.AddMinutes(5)));
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, hoje.Year, hoje.Month);

        Assert.Equal(
            new[]
            {
                "hoje 00:01",                       // o dia manda mais que a hora: hoje 00:01 vem antes de ontem 18:30
                "ontem 18:30",
                "ontem 09:00",
                "ontem sem hora, criada depois",
                "ontem sem hora, criada antes",
                "anteontem 23:59",
            },
            r.TransacoesRecentes.Select(t => t.Descricao));
    }

    [Fact]
    public async Task GetResumoAsync_RecentesTrazSoAsSeteMaisRecentes()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var hoje = Hoje;
        for (var i = 1; i <= 9; i++)
            ctx.Transacoes.Add(Mov(conta.Id, TipoTransacao.Despesa, 5, hoje.AddDays(-i), $"há {i}d"));
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, hoje.Year, hoje.Month);

        Assert.Equal(Enumerable.Range(1, 7).Select(i => $"há {i}d"), r.TransacoesRecentes.Select(t => t.Descricao));
    }

    [Fact]
    public async Task GetResumoAsync_RecentesMandamDataEHoraSeparadasEAsFlagsDeTransferenciaEPagamentoDeFatura()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var hoje = Hoje;
        var dia = hoje.AddDays(-1);
        ctx.Transacoes.AddRange(
            Mov(conta.Id, TipoTransacao.Despesa, 150, dia, "pix pra Maria",
                t => { t.Hora = new TimeOnly(14, 30, 15); t.EhTransferencia = true; }),
            Mov(conta.Id, TipoTransacao.Despesa, 800, dia.AddDays(-1), "fatura do cartão", t => t.EhPagamentoFatura = true),
            Mov(conta.Id, TipoTransacao.Despesa, 20, dia.AddDays(-2), "padaria"));
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, hoje.Year, hoje.Month);

        var transferencia = r.TransacoesRecentes[0];
        Assert.Equal(dia, transferencia.Data);                       // o dia, sem fuso
        Assert.Equal(new TimeOnly(14, 30, 15), transferencia.Hora);  // a hora, à parte
        Assert.True(transferencia.EhTransferencia);
        Assert.False(transferencia.EhPagamentoFatura);

        var pagamentoDeFatura = r.TransacoesRecentes[1];
        Assert.Equal(dia.AddDays(-1), pagamentoDeFatura.Data);
        Assert.Null(pagamentoDeFatura.Hora);                         // sem hora continua sem hora (não vira 00:00)
        Assert.True(pagamentoDeFatura.EhPagamentoFatura);
        Assert.False(pagamentoDeFatura.EhTransferencia);

        var comum = r.TransacoesRecentes[2];
        Assert.False(comum.EhTransferencia);
        Assert.False(comum.EhPagamentoFatura);
    }

    [Fact]
    public async Task GetResumoAsync_RecentesMostramONomeDaContaOuDoCartao()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId, "Nubank conta");
        var cartao = NovoCartao(ctx, usuarioId, "Nubank roxinho");
        var hoje = Hoje;
        ctx.Transacoes.AddRange(
            Mov(conta.Id, TipoTransacao.Despesa, 10, hoje.AddDays(-1), "débito na conta"),
            Mov(null, TipoTransacao.Despesa, 80, hoje.AddDays(-2), "cinema no crédito",
                t => { t.CartaoCreditoId = cartao.Id; t.UsadoComoCredito = true; }));
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, hoje.Year, hoje.Month);

        var naConta = Assert.Single(r.TransacoesRecentes, t => t.Descricao == "débito na conta");
        Assert.Equal("Nubank conta", naConta.Conta);
        Assert.Equal(conta.Id, naConta.ContaId);
        Assert.Null(naConta.CartaoCreditoId);

        var noCartao = Assert.Single(r.TransacoesRecentes, t => t.Descricao == "cinema no crédito");
        Assert.Equal("Nubank roxinho", noCartao.Conta);
        Assert.Null(noCartao.ContaId);
        Assert.Equal(cartao.Id, noCartao.CartaoCreditoId);
    }

    // ══ Item 3 — SaldoMesAnterior (saldo das contas no fim do mês PASSADO, relativo a hoje) ═══

    [Fact]
    public async Task GetResumoAsync_SaldoMesAnteriorNaoMudaQuandoPedeOutroMes()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var inicioMes = PrimeiroDoMes(Hoje);
        ctx.Transacoes.AddRange(
            Mov(conta.Id, TipoTransacao.Receita, 1000, inicioMes.AddMonths(-2).AddDays(9)),  // há 2 meses
            Mov(conta.Id, TipoTransacao.Despesa, 250, inicioMes.AddDays(-1)),                 // último dia do mês passado
            Mov(conta.Id, TipoTransacao.Receita, 400, inicioMes));                            // 1º dia do mês corrente: fora
        await ctx.SaveChangesAsync();
        var servico = Servico(ctx);

        // O hero mostra o saldo de HOJE, então compara sempre com o fim do mês passado de hoje — navegue pro
        // mês que for. (Antes vinha do penúltimo ponto do gráfico do mês navegado e mudava a cada clique.)
        foreach (var (ano, mes) in new[] { MesDe(inicioMes), MesDe(inicioMes.AddMonths(-3)), MesDe(inicioMes.AddMonths(2)) })
        {
            var r = await servico.GetResumoAsync(usuarioId, ano, mes);
            Assert.Equal(750m, r.SaldoMesAnterior); // 1000 - 250
        }
    }

    [Fact]
    public async Task GetResumoAsync_SaldoMesAnteriorSomaOMovimentoDasContasAnteriorAoMesCorrente()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var cartao = NovoCartao(ctx, usuarioId);
        var hoje = Hoje;
        var inicioMes = PrimeiroDoMes(hoje);
        var ultimoDiaDoMesPassado = inicioMes.AddDays(-1);
        ctx.Transacoes.AddRange(
            // contam: movem dinheiro das contas (Ativo + Executado, com conta)
            Mov(conta.Id, TipoTransacao.Receita, 1000, inicioMes.AddMonths(-2), "salário"),
            Mov(conta.Id, TipoTransacao.Despesa, 300, ultimoDiaDoMesPassado, "aluguel"),
            Mov(conta.Id, TipoTransacao.Receita, 500, inicioMes.AddMonths(-3), "saldo inicial", t => t.EhSaldoInicial = true),
            Mov(conta.Id, TipoTransacao.Despesa, 100, inicioMes.AddMonths(-1), "transferência", t => t.EhTransferencia = true),
            Mov(conta.Id, TipoTransacao.Despesa, 200, inicioMes.AddMonths(-1), "pagamento de fatura", t => t.EhPagamentoFatura = true),
            // não contam
            Mov(conta.Id, TipoTransacao.Receita, 9000, ultimoDiaDoMesPassado, "previsão",
                t => t.StatusTransacao = StatusTransacao.Previsao),
            Mov(conta.Id, TipoTransacao.Receita, 9001, ultimoDiaDoMesPassado, "cancelada",
                t => t.StatusTransacao = StatusTransacao.Cancelado),
            Mov(conta.Id, TipoTransacao.Receita, 9002, ultimoDiaDoMesPassado, "soft-deletada", t => t.Ativo = false),
            Mov(null, TipoTransacao.Despesa, 9003, ultimoDiaDoMesPassado, "compra só no cartão",
                t => { t.CartaoCreditoId = cartao.Id; t.UsadoComoCredito = true; }),
            Mov(conta.Id, TipoTransacao.Receita, 700, inicioMes, "1º dia do mês corrente"),
            Mov(conta.Id, TipoTransacao.Receita, 800, inicioMes.AddMonths(1), "mês que vem"));
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, hoje.Year, hoje.Month);

        // 1000 - 300 + 500 - 100 - 200
        Assert.Equal(900m, r.SaldoMesAnterior);
    }

    [Fact]
    public async Task GetResumoAsync_SaldoMesAnteriorTemAMesmaBaseDoSaldoTotal()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var cartao = NovoCartao(ctx, usuarioId);
        var hoje = Hoje;
        var inicioMes = PrimeiroDoMes(hoje);
        ctx.Transacoes.AddRange(
            Mov(conta.Id, TipoTransacao.Receita, 2000, inicioMes.AddMonths(-3), "saldo inicial", t => t.EhSaldoInicial = true),
            Mov(conta.Id, TipoTransacao.Receita, 1500, inicioMes.AddMonths(-1), "salário"),
            Mov(conta.Id, TipoTransacao.Despesa, 400, inicioMes.AddDays(-2), "transferência", t => t.EhTransferencia = true),
            Mov(conta.Id, TipoTransacao.Despesa, 350, inicioMes.AddDays(-1), "pagamento de fatura", t => t.EhPagamentoFatura = true),
            // fora das contas: nem saldo nem variação enxergam
            Mov(conta.Id, TipoTransacao.Despesa, 5000, inicioMes.AddDays(-1), "previsão",
                t => t.StatusTransacao = StatusTransacao.Previsao),
            Mov(conta.Id, TipoTransacao.Despesa, 6000, inicioMes.AddDays(-1), "cancelada",
                t => t.StatusTransacao = StatusTransacao.Cancelado),
            Mov(null, TipoTransacao.Despesa, 70, inicioMes.AddDays(-1), "compra só no cartão",
                t => t.CartaoCreditoId = cartao.Id));
        await ctx.SaveChangesAsync();

        // Só movimento anterior ao mês corrente: o saldo de hoje É o saldo do fim do mês passado.
        var antes = await Servico(ctx).GetResumoAsync(usuarioId, hoje.Year, hoje.Month);
        Assert.Equal(2750m, antes.SaldoTotal); // 2000 + 1500 - 400 - 350
        Assert.Equal(antes.SaldoTotal, antes.SaldoMesAnterior);

        // Movimento do mês corrente mexe no saldo de hoje e não no do fim do mês passado:
        // a diferença é exatamente a variação que o hero mostra.
        ctx.Transacoes.AddRange(
            Mov(conta.Id, TipoTransacao.Receita, 300, inicioMes, "freela"),
            Mov(conta.Id, TipoTransacao.Despesa, 100, inicioMes, "mercado"));
        await ctx.SaveChangesAsync();

        var depois = await Servico(ctx).GetResumoAsync(usuarioId, hoje.Year, hoje.Month);
        Assert.Equal(2950m, depois.SaldoTotal);
        Assert.Equal(2750m, depois.SaldoMesAnterior);
        Assert.Equal(200m, depois.SaldoTotal - depois.SaldoMesAnterior);
    }

    [Fact]
    public async Task GetResumoAsync_SaldoMesAnteriorEhZeroSeSoHaMovimentoNoMesCorrente()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var hoje = Hoje;
        ctx.Transacoes.Add(Mov(conta.Id, TipoTransacao.Receita, 300, PrimeiroDoMes(hoje)));
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, hoje.Year, hoje.Month);

        Assert.Equal(300m, r.SaldoTotal);
        Assert.Equal(0m, r.SaldoMesAnterior); // o hero não mostra variação: nada existia no fim do mês passado
    }

    // ══ Item 4 — evolução do saldo das contas ═════════════════════════════════

    [Fact]
    public async Task GetResumoAsync_EvolucaoSaldoAcumulaOSaldoDasContasAteOFimDeCadaMes()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var corrente = NovaConta(ctx, usuarioId, "Corrente");
        var poupanca = NovaConta(ctx, usuarioId, "Poupança", TipoConta.ContaPoupanca);
        ctx.Transacoes.AddRange(
            Mov(corrente.Id, TipoTransacao.Receita, 200, new DateOnly(2025, 11, 20)),   // antes da janela: já está em todos os pontos
            Mov(corrente.Id, TipoTransacao.Receita, 1000, new DateOnly(2025, 12, 31)),  // último dia do mês: entra em dez
            Mov(poupanca.Id, TipoTransacao.Despesa, 300, new DateOnly(2026, 2, 1)),     // 1º dia de fev: fora de jan, dentro de fev (soma as 2 contas)
            Mov(corrente.Id, TipoTransacao.Receita, 500, new DateOnly(2026, 5, 31)),    // último dia do mês pedido
            Mov(corrente.Id, TipoTransacao.Despesa, 999, new DateOnly(2026, 6, 1)));    // depois do mês pedido: fora de todos os pontos
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, 2026, 5);

        Assert.Equal(new[] { "dez/25", "jan/26", "fev/26", "mar/26", "abr/26", "mai/26" },
            r.EvolucaoSaldo.Select(p => p.Label));
        Assert.Equal(new[] { (2025, 12), (2026, 1), (2026, 2), (2026, 3), (2026, 4), (2026, 5) },
            r.EvolucaoSaldo.Select(p => (p.Ano, p.Mes)));
        Assert.Equal(new[] { 1200m, 1200m, 900m, 900m, 900m, 1400m }, r.EvolucaoSaldo.Select(p => p.Saldo));
    }

    [Fact]
    public async Task GetResumoAsync_EvolucaoSaldoIgnoraPrevisaoCanceladaEMovimentoSemConta()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var cartao = NovoCartao(ctx, usuarioId);
        ctx.Transacoes.AddRange(
            Mov(conta.Id, TipoTransacao.Receita, 1000, new DateOnly(2026, 3, 10)),
            Mov(conta.Id, TipoTransacao.Receita, 5000, new DateOnly(2026, 3, 11), "previsão",
                t => t.StatusTransacao = StatusTransacao.Previsao),
            Mov(conta.Id, TipoTransacao.Despesa, 6000, new DateOnly(2026, 3, 12), "cancelada",
                t => t.StatusTransacao = StatusTransacao.Cancelado),
            Mov(conta.Id, TipoTransacao.Despesa, 7000, new DateOnly(2026, 3, 13), "soft-deletada", t => t.Ativo = false),
            Mov(null, TipoTransacao.Despesa, 300, new DateOnly(2026, 3, 14), "compra no crédito",
                t => { t.CartaoCreditoId = cartao.Id; t.UsadoComoCredito = true; }),
            // regressão: lançamento só do cartão, sem conta, que NÃO é crédito — o gráfico antigo o descontava
            Mov(null, TipoTransacao.Despesa, 90, new DateOnly(2026, 3, 15), "cartão sem conta",
                t => t.CartaoCreditoId = cartao.Id));
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, 2026, 5);

        Assert.Equal(new[] { 0m, 0m, 0m, 1000m, 1000m, 1000m }, r.EvolucaoSaldo.Select(p => p.Saldo));
    }

    [Fact]
    public async Task GetResumoAsync_EvolucaoSaldoNoMesCorrenteTerminaNoSaldoTotal()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var corrente = NovaConta(ctx, usuarioId, "Corrente");
        var poupanca = NovaConta(ctx, usuarioId, "Poupança", TipoConta.ContaPoupanca);
        var cartao = NovoCartao(ctx, usuarioId);
        var hoje = Hoje;
        var inicioMes = PrimeiroDoMes(hoje);
        var diaNoMesPassado = inicioMes.AddMonths(-1).AddDays(3);
        ctx.Transacoes.AddRange(
            // movem dinheiro das contas — tudo até hoje
            Mov(corrente.Id, TipoTransacao.Receita, 2000, inicioMes.AddMonths(-4), "saldo inicial", t => t.EhSaldoInicial = true),
            Mov(corrente.Id, TipoTransacao.Receita, 3000, inicioMes.AddMonths(-1), "salário"),
            Mov(corrente.Id, TipoTransacao.Despesa, 500, diaNoMesPassado, "transferência pra poupança", t => t.EhTransferencia = true),
            Mov(poupanca.Id, TipoTransacao.Receita, 500, diaNoMesPassado, "transferência da corrente", t => t.EhTransferencia = true),
            Mov(corrente.Id, TipoTransacao.Despesa, 800, inicioMes, "pagamento de fatura", t => t.EhPagamentoFatura = true),
            Mov(corrente.Id, TipoTransacao.Despesa, 120, inicioMes, "mercado"),
            // fora da base das contas
            Mov(corrente.Id, TipoTransacao.Despesa, 5000, inicioMes, "previsão", t => t.StatusTransacao = StatusTransacao.Previsao),
            Mov(corrente.Id, TipoTransacao.Despesa, 6000, inicioMes, "cancelada", t => t.StatusTransacao = StatusTransacao.Cancelado),
            Mov(corrente.Id, TipoTransacao.Despesa, 7000, inicioMes, "soft-deletada", t => t.Ativo = false),
            Mov(null, TipoTransacao.Despesa, 300, inicioMes, "compra no crédito",
                t => { t.CartaoCreditoId = cartao.Id; t.UsadoComoCredito = true; }),
            Mov(null, TipoTransacao.Despesa, 90, inicioMes, "cartão sem conta", t => t.CartaoCreditoId = cartao.Id));
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, hoje.Year, hoje.Month);

        Assert.Equal(4080m, r.SaldoTotal);                  // 2000 + 3000 - 500 + 500 - 800 - 120
        Assert.Equal(r.SaldoTotal, r.EvolucaoSaldo[^1].Saldo);
        Assert.Equal(hoje.Month, r.EvolucaoSaldo[^1].Mes);
        Assert.Equal(hoje.Year, r.EvolucaoSaldo[^1].Ano);
        // No mês corrente, o penúltimo ponto É o "fim do mês passado" do hero: gráfico e variação falam o mesmo número.
        Assert.Equal(5000m, r.EvolucaoSaldo[^2].Saldo);
        Assert.Equal(r.EvolucaoSaldo[^2].Saldo, r.SaldoMesAnterior);
    }

    // ══ Item 5 — "Maiores gastos" (TopCategorias) ═════════════════════════════
    //
    // Base = as saídas de caixa do mês (a MESMA lista que soma SaidasCaixa), por categoria. Fatias somam
    // o "Saiu": sem categoria vira "Sem categoria"; acima de 5 grupos, top 4 + "Outros".

    [Fact]
    public async Task GetResumoAsync_TopCategoriasSomamExatamenteSaidasCaixaEOrdenamPorValor()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var mercado = NovaCategoria(ctx, "Mercado");
        var transporte = NovaCategoria(ctx, "Transporte");
        var lazer = NovaCategoria(ctx, "Lazer");
        var dia = new DateOnly(2026, 5, 15);
        ctx.Transacoes.AddRange(
            Gasto(conta.Id, 300, mercado, dia),
            Gasto(conta.Id, 200, mercado, dia.AddDays(3)),  // mesma categoria: agrupa
            Gasto(conta.Id, 250, transporte, dia),
            Gasto(conta.Id, 150, lazer, dia),
            Gasto(conta.Id, 100, null, dia));               // sem categoria
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, 2026, 5);

        Assert.Equal(1000m, r.SaidasCaixa);
        Assert.Equal(r.SaidasCaixa, r.TopCategorias.Sum(c => c.Valor)); // o donut soma o "Saiu"
        Assert.Equal(new[] { "Mercado", "Transporte", "Lazer", "Sem categoria" }, r.TopCategorias.Select(c => c.Descricao));
        Assert.Equal(new[] { 500m, 250m, 150m, 100m }, r.TopCategorias.Select(c => c.Valor));
        Assert.Equal(new[] { 50m, 25m, 15m, 10m }, r.TopCategorias.Select(c => c.Percentual));
    }

    [Fact]
    public async Task GetResumoAsync_TopCategoriasSemCategoriaViraUmGrupoProprio()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var dia = new DateOnly(2026, 5, 15);
        ctx.Transacoes.AddRange(
            Gasto(conta.Id, 70, null, dia),
            Gasto(conta.Id, 30, null, dia.AddDays(1)));
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, 2026, 5);

        // Antes o gasto sem categoria era descartado do donut (e o total não batia com o "Saiu").
        var fatia = Assert.Single(r.TopCategorias);
        Assert.Equal("Sem categoria", fatia.Descricao);
        Assert.Equal(100m, fatia.Valor);
        Assert.Equal(100m, fatia.Percentual);
    }

    [Fact]
    public async Task GetResumoAsync_TopCategoriasAteCincoGruposMostraTodosSemOutros()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var dia = new DateOnly(2026, 5, 15);
        var valores = new[] { ("Mercado", 500m), ("Moradia", 200m), ("Transporte", 150m), ("Lazer", 100m), ("Saúde", 50m) };
        foreach (var (nome, valor) in valores)
            ctx.Transacoes.Add(Gasto(conta.Id, valor, NovaCategoria(ctx, nome), dia));
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, 2026, 5);

        Assert.Equal(new[] { "Mercado", "Moradia", "Transporte", "Lazer", "Saúde" }, r.TopCategorias.Select(c => c.Descricao));
        Assert.DoesNotContain(r.TopCategorias, c => c.Descricao == "Outros");
        Assert.Equal(new[] { 50m, 20m, 15m, 10m, 5m }, r.TopCategorias.Select(c => c.Percentual));
        Assert.Equal(r.SaidasCaixa, r.TopCategorias.Sum(c => c.Valor));
    }

    [Fact]
    public async Task GetResumoAsync_TopCategoriasAcimaDeCincoGruposViraTop4MaisOutros()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var dia = new DateOnly(2026, 5, 15);
        var valores = new[]
        {
            ("Mercado", 400m), ("Moradia", 250m), ("Transporte", 150m), ("Lazer", 120m),
            ("Saúde", 40m), ("Pets", 25m), ("Presentes", 15m),
        };
        foreach (var (nome, valor) in valores)
            ctx.Transacoes.Add(Gasto(conta.Id, valor, NovaCategoria(ctx, nome), dia));
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, 2026, 5);

        Assert.Equal(1000m, r.SaidasCaixa);
        Assert.Equal(new[] { "Mercado", "Moradia", "Transporte", "Lazer", "Outros" }, r.TopCategorias.Select(c => c.Descricao));
        // "Outros" = a soma de TODO o resto (Saúde + Pets + Presentes), não só o 5º colocado.
        Assert.Equal(new[] { 400m, 250m, 150m, 120m, 80m }, r.TopCategorias.Select(c => c.Valor));
        Assert.Equal(new[] { 40m, 25m, 15m, 12m, 8m }, r.TopCategorias.Select(c => c.Percentual));
        Assert.Equal(r.SaidasCaixa, r.TopCategorias.Sum(c => c.Valor));
    }

    [Theory]
    [InlineData(5, false)] // até 5 grupos: todos aparecem
    [InlineData(6, true)]  // o 6º grupo já dispara o "Outros" (que junta o 5º e o 6º)
    [InlineData(12, true)]
    public async Task GetResumoAsync_TopCategoriasFechamEm5FatiasEOTotalNuncaSeParde(int qtdCategorias, bool temOutros)
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var dia = new DateOnly(2026, 5, 15);
        // Cat1 gasta o maior valor, Cat{n} o menor — valores todos distintos, sem empate na ordenação.
        for (var i = 1; i <= qtdCategorias; i++)
            ctx.Transacoes.Add(Gasto(conta.Id, (qtdCategorias - i + 1) * 100m, NovaCategoria(ctx, $"Cat{i}"), dia));
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, 2026, 5);

        Assert.Equal(Math.Min(qtdCategorias, 5), r.TopCategorias.Count);
        Assert.Equal(temOutros, r.TopCategorias.Any(c => c.Descricao == "Outros"));
        if (temOutros) Assert.Equal("Outros", r.TopCategorias[^1].Descricao);
        Assert.Equal(r.SaidasCaixa, r.TopCategorias.Sum(c => c.Valor));
        // Cada percentual é arredondado em 1 casa: a soma das fatias fica em ~100.
        Assert.InRange(r.TopCategorias.Sum(c => c.Percentual), 99.7m, 100.3m);
    }

    [Fact]
    public async Task GetResumoAsync_TopCategoriasIgnoramCreditoPrevisaoTransferenciaPagamentoDeFaturaSaldoInicialReceitaEOutrosMeses()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var cartao = NovoCartao(ctx, usuarioId);
        var mercado = NovaCategoria(ctx, "Mercado");
        var fora = NovaCategoria(ctx, "Não devia aparecer");
        var dia = new DateOnly(2026, 5, 15);
        ctx.Transacoes.AddRange(
            Gasto(conta.Id, 200, mercado, dia), // a única saída de caixa do mês
            // compra no crédito só sai do caixa quando a fatura é paga
            Gasto(conta.Id, 900, fora, dia, t => { t.ContaId = null; t.CartaoCreditoId = cartao.Id; t.UsadoComoCredito = true; }),
            Gasto(conta.Id, 901, fora, dia, t => t.StatusTransacao = StatusTransacao.Previsao),
            Gasto(conta.Id, 902, fora, dia, t => t.EhTransferencia = true),
            Gasto(conta.Id, 903, fora, dia, t => t.EhPagamentoFatura = true),
            Gasto(conta.Id, 904, fora, dia, t => t.EhSaldoInicial = true),
            Gasto(conta.Id, 905, fora, dia, t => t.StatusTransacao = StatusTransacao.Cancelado),
            Gasto(conta.Id, 906, fora, dia, t => t.Ativo = false),
            Gasto(conta.Id, 907, fora, new DateOnly(2026, 4, 30)),  // mês anterior
            Gasto(conta.Id, 908, fora, new DateOnly(2026, 6, 1)),   // mês seguinte
            // receita (mesmo com categoria) não é gasto
            Mov(conta.Id, TipoTransacao.Receita, 909, dia, "salário", t => t.CategoriaId = fora.Id));
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, 2026, 5);

        Assert.Equal(200m, r.SaidasCaixa);
        var fatia = Assert.Single(r.TopCategorias);
        Assert.Equal("Mercado", fatia.Descricao);
        Assert.Equal(200m, fatia.Valor);
        Assert.Equal(100m, fatia.Percentual);
    }

    [Fact]
    public async Task GetResumoAsync_TopCategoriasCalculamOPercentualSobreSaidasCaixaEPrevisaoNaoDilui()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var mercado = NovaCategoria(ctx, "Mercado");
        var lazer = NovaCategoria(ctx, "Lazer");
        var dia = new DateOnly(2026, 5, 15);
        ctx.Transacoes.AddRange(
            Gasto(conta.Id, 300, mercado, dia),
            Gasto(conta.Id, 100, lazer, dia),
            // previsão: entra em DespesasMes ("a pagar"), mas não saiu do caixa — não pode diluir as fatias
            Gasto(conta.Id, 600, null, dia, t => t.StatusTransacao = StatusTransacao.Previsao));
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, 2026, 5);

        Assert.Equal(1000m, r.DespesasMes);
        Assert.Equal(400m, r.SaidasCaixa);
        // 300/400 e 100/400 (e não 300/1000 e 100/1000): as fatias fecham em 100%
        Assert.Equal(new[] { 75m, 25m }, r.TopCategorias.Select(c => c.Percentual));
    }

    [Fact]
    public async Task GetResumoAsync_TopCategoriasSemSaidasNoMesVemVaziaSemQuebrar()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        ctx.Transacoes.Add(Mov(conta.Id, TipoTransacao.Receita, 1000, new DateOnly(2026, 5, 10)));
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, 2026, 5);

        Assert.Equal(0m, r.SaidasCaixa);
        Assert.Empty(r.TopCategorias); // sem saída não há o que dividir (nem divisão por zero)
    }

    // ══ Item 6 — TipoDescricao legível e últimos dígitos do cartão ════════════

    [Theory]
    [InlineData(TipoConta.ContaCorrente, "Conta Corrente")]
    [InlineData(TipoConta.ContaPoupanca, "Conta Poupança")]
    [InlineData(TipoConta.CartaoCredito, "Cartão de Crédito")]
    [InlineData(TipoConta.Dinheiro, "Dinheiro")]
    [InlineData(TipoConta.Emprestimo, "Empréstimo")]
    public async Task GetResumoAsync_SaldoContasTrazTipoDescricaoLegivel(TipoConta tipo, string esperado)
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        NovaConta(ctx, usuarioId, "Minha conta", tipo);
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, 2026, 5);

        var dto = Assert.Single(r.SaldoContas);
        Assert.Equal(esperado, dto.TipoDescricao); // não o nome cru do enum ("ContaCorrente")
        Assert.Equal((int)tipo, dto.Tipo);
    }

    [Fact]
    public void TipoContaDescricao_ValorForaDoEnum_CaiNoNomeCruEmVezDeQuebrar()
    {
        Assert.Equal("99", ((TipoConta)99).Descricao());
    }

    [Fact]
    public async Task GetResumoAsync_CartoesResumoTrazOsUltimosDigitos()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        NovoCartao(ctx, usuarioId, "Nubank", "1234", limite: 5000m);
        NovoCartao(ctx, usuarioId, "Inter", ultimosDigitos: null, limite: 3000m);
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, 2026, 5);

        Assert.Equal(2, r.CartoesResumo.Count);
        var nubank = Assert.Single(r.CartoesResumo, c => c.Nome == "Nubank");
        Assert.Equal("1234", nubank.UltimosDigitos);
        Assert.Equal(5000m, nubank.LimiteTotal);
        var inter = Assert.Single(r.CartoesResumo, c => c.Nome == "Inter");
        Assert.Null(inter.UltimosDigitos); // cartão sem os dígitos cadastrados: o front só omite o "•••• 1234"
    }

    // ══ Bordas gerais ═════════════════════════════════════════════════════════

    [Fact]
    public async Task GetResumoAsync_UsuarioSemNada_VoltaTudoVazioSemQuebrar()
    {
        var ctx = CreateContext();
        var hoje = Hoje;

        var r = await Servico(ctx).GetResumoAsync(Guid.NewGuid(), hoje.Year, hoje.Month);

        Assert.Equal(0m, r.SaldoTotal);
        Assert.Equal(0m, r.SaldoMesAnterior);
        Assert.Equal(0m, r.SaidasCaixa);
        Assert.Empty(r.TopCategorias);
        Assert.Empty(r.TransacoesRecentes);
        Assert.Empty(r.SaldoContas);
        Assert.Empty(r.CartoesResumo);
        Assert.Equal(6, r.EvolucaoSaldo.Count);
        Assert.All(r.EvolucaoSaldo, p => Assert.Equal(0m, p.Saldo));
    }

    [Fact]
    public async Task GetResumoAsync_NaoMisturaDadosDeOutroUsuario()
    {
        var ctx = CreateContext();
        var dono = Guid.NewGuid();
        var outro = Guid.NewGuid();
        var hoje = Hoje;
        var mercado = NovaCategoria(ctx, "Mercado");
        // conta e cartão de outra pessoa, cheios de movimento
        var contaAlheia = NovaConta(ctx, outro, "Conta alheia");
        NovoCartao(ctx, outro, "Cartão alheio", "9999");
        ctx.Transacoes.AddRange(
            Gasto(contaAlheia.Id, 500, mercado, hoje.AddDays(-1)),
            Mov(contaAlheia.Id, TipoTransacao.Receita, 900, hoje.AddDays(-40), "salário alheio"));
        // o dono tem só uma despesa
        var minha = NovaConta(ctx, dono, "Minha");
        ctx.Transacoes.Add(Mov(minha.Id, TipoTransacao.Despesa, 10, hoje.AddDays(-1), "minha despesa"));
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(dono, hoje.Year, hoje.Month);

        Assert.Equal(new[] { "minha despesa" }, r.TransacoesRecentes.Select(t => t.Descricao));
        Assert.Equal(new[] { "Minha" }, r.SaldoContas.Select(c => c.Nome));
        Assert.Equal(-10m, r.SaldoTotal);
        Assert.Equal(-10m, r.EvolucaoSaldo[^1].Saldo);
        Assert.Empty(r.CartoesResumo);
    }

    // ── Gasto no cartão do mês (à parte do caixa — decisão 2026-10-03) ────────

    private static Fatura NovaFatura(AppDbContext ctx, CartaoCredito cartao, Guid usuarioId, int ano, int mes)
    {
        var fechamento = new DateTime(ano, mes, 5);
        var fatura = new Fatura
        {
            Id = Guid.NewGuid(), CartaoCreditoId = cartao.Id, CriadoPor = usuarioId,
            DataInicio = fechamento.AddMonths(-1).AddDays(1), DataFechamento = fechamento,
            DataVencimento = fechamento.AddDays(10),
        };
        ctx.Faturas.Add(fatura);
        return fatura;
    }

    /// <summary>Parcelamento do fluxo novo: N parcelas em faturas consecutivas a partir de (ano, mes).</summary>
    private static Parcelamento NovoParcelamento(AppDbContext ctx, CartaoCredito cartao, Guid usuarioId,
        string descricao, decimal valorParcela, int parcelas, int ano, int mes, Categoria? categoria = null)
    {
        var parcelamento = new Parcelamento
        {
            Id = Guid.NewGuid(), CriadoPor = usuarioId, Descricao = descricao, DataCompra = new DateTime(ano, mes, 3),
            ValorTotal = valorParcela * parcelas, QuantidadeParcelas = parcelas, CartaoCreditoId = cartao.Id,
            CategoriaId = categoria?.Id, Ativo = true,
        };
        ctx.Parcelamentos.Add(parcelamento);
        for (var i = 0; i < parcelas; i++)
        {
            var mesDaParcela = new DateTime(ano, mes, 1).AddMonths(i);
            var fatura = NovaFatura(ctx, cartao, usuarioId, mesDaParcela.Year, mesDaParcela.Month);
            ctx.ParcelasTransacao.Add(new ParcelaTransacao
            {
                Id = Guid.NewGuid(), ParcelamentoId = parcelamento.Id, Numero = i + 1, QuantidadeTotal = parcelas,
                DataVencimento = fatura.DataVencimento, Valor = valorParcela, FaturaId = fatura.Id, CriadoPor = usuarioId,
            });
        }
        return parcelamento;
    }

    // Compra à vista no crédito (cartão, sem conta) num dia.
    private static Transacao CompraNoCredito(CartaoCredito cartao, decimal valor, DateOnly dia, string descricao,
        Categoria? categoria = null) =>
        Mov(null, TipoTransacao.Despesa, valor, dia, descricao, t =>
        {
            t.CartaoCreditoId = cartao.Id;
            t.UsadoComoCredito = true;
            t.MeioPagamento = MeioPagamento.Credito;
            t.CategoriaId = categoria?.Id;
        });

    [Fact]
    public async Task GetResumoAsync_CompraAVistaNoCredito_EntraNoGastoCartao_MasNaoNoSaiuNemNosMaioresGastos()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var cartao = NovoCartao(ctx, usuarioId, "Nubank");
        var vestuario = NovaCategoria(ctx, "Vestuário");
        ctx.Transacoes.Add(CompraNoCredito(cartao, 300m, new DateOnly(2026, 10, 2), "Tênis", vestuario));
        ctx.Transacoes.Add(Gasto(conta.Id, 50m, null, new DateOnly(2026, 10, 1)));
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, 2026, 10);

        Assert.Equal(300m, r.GastoCartaoMes);
        var compra = Assert.Single(r.ComprasCartaoMes);
        Assert.Equal("Tênis", compra.Descricao);
        Assert.Equal(300m, compra.Valor);
        Assert.Equal(new DateOnly(2026, 10, 2), compra.Data);
        Assert.Null(compra.Parcela);
        Assert.Null(compra.TotalParcelas);
        Assert.Equal("Nubank", compra.Cartao);
        Assert.Equal("Vestuário", compra.Categoria);
        // O caixa segue como estava: só os 50 da conta.
        Assert.Equal(50m, r.SaidasCaixa);
        Assert.DoesNotContain(r.TopCategorias, c => c.Descricao == "Vestuário");
    }

    [Fact]
    public async Task GetResumoAsync_Parcelamento_MostraSoAParcelaDoMesComONumero_NuncaOTotal()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var cartao = NovoCartao(ctx, usuarioId, "Nubank");
        var eletro = NovaCategoria(ctx, "Eletrônicos");
        NovoParcelamento(ctx, cartao, usuarioId, "TV", 200m, 10, 2026, 10, eletro);
        await ctx.SaveChangesAsync();

        var outubro = await Servico(ctx).GetResumoAsync(usuarioId, 2026, 10);
        var novembro = await Servico(ctx).GetResumoAsync(usuarioId, 2026, 11);

        var p1 = Assert.Single(outubro.ComprasCartaoMes);
        Assert.Equal(("TV", 200m, 1, 10), (p1.Descricao, p1.Valor, p1.Parcela!.Value, p1.TotalParcelas!.Value));
        Assert.Equal("Eletrônicos", p1.Categoria);
        Assert.Equal("Nubank", p1.Cartao);
        Assert.Equal(200m, outubro.GastoCartaoMes);
        var p2 = Assert.Single(novembro.ComprasCartaoMes);
        Assert.Equal(2, p2.Parcela);
        Assert.Equal(200m, novembro.GastoCartaoMes);
    }

    [Fact]
    public async Task GetResumoAsync_GastoCartao_ParcelaComJurosUsaOValorDevido_ECanceladaNaoEntra()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var cartao = NovoCartao(ctx, usuarioId);
        NovoParcelamento(ctx, cartao, usuarioId, "Pix no crédito", 100m, 2, 2026, 10);
        var cancelado = NovoParcelamento(ctx, cartao, usuarioId, "Cancelado", 80m, 2, 2026, 10);
        await ctx.SaveChangesAsync();
        var parcelaPix = await ctx.ParcelasTransacao.SingleAsync(p => p.Numero == 1 && p.Valor == 100m);
        parcelaPix.ValorComJuros = 112.5m;
        foreach (var p in ctx.ParcelasTransacao.Where(p => p.ParcelamentoId == cancelado.Id))
            p.Status = StatusParcela.Cancelada;
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, 2026, 10);

        var unica = Assert.Single(r.ComprasCartaoMes);
        Assert.Equal("Pix no crédito", unica.Descricao);
        Assert.Equal(112.5m, unica.Valor);
        Assert.Equal(112.5m, r.GastoCartaoMes);
    }

    [Fact]
    public async Task GetResumoAsync_GastoCartao_IgnoraOutroMesPagamentoDeFaturaEOutroUsuario()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var outro = Guid.NewGuid();
        var conta = NovaConta(ctx, usuarioId);
        var cartao = NovoCartao(ctx, usuarioId);
        var cartaoAlheio = NovoCartao(ctx, outro);
        ctx.Transacoes.Add(CompraNoCredito(cartao, 40m, new DateOnly(2026, 10, 9), "Do mês"));
        ctx.Transacoes.Add(CompraNoCredito(cartao, 70m, new DateOnly(2026, 9, 30), "Do mês passado"));
        ctx.Transacoes.Add(CompraNoCredito(cartaoAlheio, 999m, new DateOnly(2026, 10, 9), "Alheia"));
        NovoParcelamento(ctx, cartaoAlheio, outro, "Parcelado alheio", 500m, 2, 2026, 10);
        // Pagar a fatura tira dinheiro da conta, mas não é compra no cartão.
        ctx.Transacoes.Add(Mov(conta.Id, TipoTransacao.Despesa, 400m, new DateOnly(2026, 10, 10), "Pagamento fatura",
            t => { t.EhPagamentoFatura = true; t.CartaoCreditoId = cartao.Id; }));
        // Compra no crédito desativada (soft delete) também não.
        ctx.Transacoes.Add(CompraNoCredito(cartao, 15m, new DateOnly(2026, 10, 9), "Apagada"));
        await ctx.SaveChangesAsync();
        var apagada = await ctx.Transacoes.SingleAsync(t => t.Descricao == "Apagada");
        apagada.Ativo = false;
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, 2026, 10);

        var unica = Assert.Single(r.ComprasCartaoMes);
        Assert.Equal("Do mês", unica.Descricao);
        Assert.Equal(40m, r.GastoCartaoMes);
    }

    [Fact]
    public async Task GetResumoAsync_GastoCartao_OrdenaPelaDataDaCompraMaisRecentePrimeiro()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var cartao = NovoCartao(ctx, usuarioId);
        ctx.Transacoes.Add(CompraNoCredito(cartao, 10m, new DateOnly(2026, 10, 1), "Antiga"));
        ctx.Transacoes.Add(CompraNoCredito(cartao, 20m, new DateOnly(2026, 10, 20), "Recente"));
        NovoParcelamento(ctx, cartao, usuarioId, "Parcela", 30m, 3, 2026, 10); // compra em 03/10
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).GetResumoAsync(usuarioId, 2026, 10);

        Assert.Equal(new[] { "Recente", "Parcela", "Antiga" }, r.ComprasCartaoMes.Select(c => c.Descricao));
        Assert.Equal(60m, r.GastoCartaoMes);
    }
}

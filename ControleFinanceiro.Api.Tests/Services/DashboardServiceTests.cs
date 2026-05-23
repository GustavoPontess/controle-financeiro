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
        Data = data,
        StatusTransacao = status,
        Ativo = ativo,
    };

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

        var r = await new DashboardService(ctx).GetResumoAsync(usuarioId, 2026, 5);

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
            Flag(TipoTransacao.Despesa, 300, t => t.EhPagamentoFatura = true)     // pagamento fatura
        );
        await ctx.SaveChangesAsync();

        var r = await new DashboardService(ctx).GetResumoAsync(usuarioId, 2026, 5);

        // KPIs de P&L: só o que é receita/despesa real
        Assert.Equal(1000m, r.Recebido);
        Assert.Equal(100m, r.Pago);
        // Saldo conta TODO movimento real: 1000 - 100 + 5000 - 200 - 300 = 5400
        Assert.Equal(5400m, r.SaldoTotal);
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

        var r = await new DashboardService(ctx).GetResumoAsync(usuarioId, 2026, 5);

        Assert.Equal(1000m, r.SaldoTotal);
    }

    [Fact]
    public async Task GetResumoAsync_EvolucaoSaldoTem6Meses()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        ctx.Contas.Add(new Conta { Id = Guid.NewGuid(), Nome = "C", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuarioId });
        await ctx.SaveChangesAsync();

        var r = await new DashboardService(ctx).GetResumoAsync(usuarioId, 2026, 5);

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

        var r = await new DashboardService(ctx).GetResumoAsync(usuarioId, 2026, 5);

        Assert.Equal(1000m, r.EvolucaoSaldo[^1].Saldo);
    }
}

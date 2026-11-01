using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Write skew compra × pagamento (P2, 2026-11-01): mudar o que compõe o total da fatura grava a fatura junto, pra o
/// xmin dela conferir e mudar. O InMemory não tem xmin (o modelo Npgsql é conferido em AppDbContextModeloNpgsqlTests);
/// aqui se prova que a fatura entra no UPDATE quando deve, e só quando deve.
/// </summary>
public class FaturaTocadaPelaCompraTests
{
    private static (AppDbContext Ctx, Guid Usuario, Fatura Outubro, Fatura Novembro) Seed()
    {
        var ctx = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var usuario = Guid.NewGuid();
        var cartao = new CartaoCredito { Id = Guid.NewGuid(), Nome = "Nubank", TemCredito = true, LimiteTotal = 5000, CriadoPor = usuario, Ativo = true };
        Fatura Nova(int mes) => new()
        {
            Id = Guid.NewGuid(), CartaoCreditoId = cartao.Id, CriadoPor = usuario,
            DataInicio = new DateTime(2026, mes - 1, 1), DataFechamento = new DateTime(2026, mes, 1), DataVencimento = new DateTime(2026, mes, 8),
        };
        var (outubro, novembro) = (Nova(10), Nova(11));
        ctx.CartoesCredito.Add(cartao);
        ctx.Faturas.AddRange(outubro, novembro);
        ctx.SaveChanges();
        ctx.ChangeTracker.Clear(); // a fatura fora do contexto, como num pedido que só lança a compra
        return (ctx, usuario, outubro, novembro);
    }

    private static Transacao Compra(Guid usuario, Guid fatura, decimal valor = 100m) => new()
    {
        Id = Guid.NewGuid(), Descricao = "Mercado", Valor = valor, Tipo = TipoTransacao.Despesa, CriadoPor = usuario,
        Data = new DateOnly(2026, 10, 10), FaturaId = fatura, UsadoComoCredito = true,
    };

    /// <summary>Faturas que entram no UPDATE deste SaveChanges (o evento roda depois do override marcar).</summary>
    private static async Task<List<Guid>> FaturasGravadas(AppDbContext ctx, Action mudar)
    {
        var gravadas = new List<Guid>();
        void Anotar(object? _, SavingChangesEventArgs __) =>
            gravadas.AddRange(ctx.ChangeTracker.Entries<Fatura>().Where(e => e.State == EntityState.Modified).Select(e => e.Entity.Id));
        ctx.SavingChanges += Anotar;
        mudar();
        await ctx.SaveChangesAsync();
        ctx.SavingChanges -= Anotar;
        return gravadas;
    }

    [Fact]
    public async Task CompraNova_GravaAFatura_MesmoSemOPedidoTerLidoEla()
    {
        var (ctx, usuario, outubro, _) = Seed();
        var gravadas = await FaturasGravadas(ctx, () => ctx.Transacoes.Add(Compra(usuario, outubro.Id)));
        Assert.Equal(new[] { outubro.Id }, gravadas);
    }

    [Fact]
    public async Task CompraQueTrocaDeFatura_GravaAsDuas_EMudarValorOuExcluirGravaADela()
    {
        var (ctx, usuario, outubro, novembro) = Seed();
        var compra = Compra(usuario, outubro.Id);
        ctx.Transacoes.Add(compra);
        await ctx.SaveChangesAsync();

        Assert.Equal(new[] { outubro.Id, novembro.Id }.Order(), (await FaturasGravadas(ctx, () => compra.FaturaId = novembro.Id)).Order());
        Assert.Equal(new[] { novembro.Id }, await FaturasGravadas(ctx, () => compra.Valor = 150m));
        Assert.Equal(new[] { novembro.Id }, await FaturasGravadas(ctx, () => compra.Ativo = false)); // excluir é desativar
    }

    [Fact]
    public async Task MudarSoADescricaoDaCompra_NaoGravaAFatura()
    {
        var (ctx, usuario, outubro, _) = Seed();
        var compra = Compra(usuario, outubro.Id);
        ctx.Transacoes.Add(compra);
        await ctx.SaveChangesAsync();

        Assert.Empty(await FaturasGravadas(ctx, () => compra.Descricao = "Feira"));
    }

    [Fact]
    public async Task ParcelaCanceladaOuNova_GravaAFaturaDela()
    {
        var (ctx, usuario, outubro, _) = Seed();
        var parcela = new ParcelaTransacao
        {
            Id = Guid.NewGuid(), ParcelamentoId = Guid.NewGuid(), FaturaId = outubro.Id, Numero = 1, QuantidadeTotal = 1, DataVencimento = new DateTime(2026, 10, 8), Valor = 50m,
            Status = StatusParcela.Pendente, CriadoPor = usuario,
        };
        Assert.Equal(new[] { outubro.Id }, await FaturasGravadas(ctx, () => ctx.ParcelasTransacao.Add(parcela)));
        Assert.Equal(new[] { outubro.Id }, await FaturasGravadas(ctx, () => parcela.Status = StatusParcela.Cancelada));
    }

    [Fact]
    public async Task FaturaJaAlteradaNoPedido_NaoMudaNada_EOValorDelaFicaOQueOPedidoGravou()
    {
        var (ctx, usuario, outubro, _) = Seed();
        var fatura = await ctx.Faturas.SingleAsync(f => f.Id == outubro.Id);
        fatura.ValorPago = 30m;
        ctx.Transacoes.Add(Compra(usuario, outubro.Id));
        await ctx.SaveChangesAsync();

        ctx.ChangeTracker.Clear();
        Assert.Equal(30m, (await ctx.Faturas.SingleAsync(f => f.Id == outubro.Id)).ValorPago);
    }
}

using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// "Cartão (a detalhar)" (docs/features/cartao-credito/fatura-a-detalhar.md, decisão do Gustavo 2026-11-22): o que saiu
/// da conta pra pagar fatura já é gasto; as compras que estão no app ocupam o lugar delas e o resto fica "a detalhar".
/// </summary>
public class FaturaADetalharTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(
                Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static Guid SeedUsuario(AppDbContext ctx)
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = $"{Guid.NewGuid():N}@test.com", Nome = "User", PasswordHash = "x" };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u.Id;
    }

    private static Guid SeedFatura(AppDbContext ctx)
    {
        var f = new Fatura
        {
            Id = Guid.NewGuid(), CartaoCreditoId = Guid.NewGuid(), DataInicio = new DateTime(2026, 10, 1),
            DataFechamento = new DateTime(2026, 10, 31), DataVencimento = new DateTime(2026, 11, 8),
        };
        ctx.Faturas.Add(f);
        ctx.SaveChanges();
        return f.Id;
    }

    private static Guid Pagamento(AppDbContext ctx, Guid usuario, decimal valor, DateOnly data, Guid? faturaId = null,
        StatusTransacao status = StatusTransacao.Executado)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Pagamento de fatura", Valor = valor, Tipo = TipoTransacao.Despesa,
            ContaId = Guid.NewGuid(), EhPagamentoFatura = true, FaturaPagaId = faturaId, CriadoPor = usuario, Data = data,
            StatusTransacao = status, Ativo = true, CriadoEm = data.ToDateTime(TimeOnly.MinValue),
        };
        ctx.Transacoes.Add(t);
        ctx.SaveChanges();
        return t.Id;
    }

    private static void Compra(AppDbContext ctx, Guid usuario, Guid faturaId, decimal valor, DateOnly data, Guid? categoria = null)
    {
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Compra", Valor = valor, Tipo = TipoTransacao.Despesa, CartaoCreditoId = Guid.NewGuid(),
            FaturaId = faturaId, UsadoComoCredito = true, CategoriaId = categoria, CriadoPor = usuario, Data = data,
            StatusTransacao = StatusTransacao.Executado, Ativo = true,
        });
        ctx.SaveChanges();
    }

    private static async Task<decimal> ADetalhar(AppDbContext ctx, Guid u, int ano, int mes) =>
        (await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(ctx, u, ano, mes)).GetValueOrDefault(RegrasFinanceiras.CartaoADetalhar).Gasto;

    [Fact]
    public async Task SemFaturaNoApp_PagamentoContaInteiroNoMesDoPagamento()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        Pagamento(ctx, u, 3273.80m, new DateOnly(2026, 11, 9));

        Assert.Equal(3273.80m, await ADetalhar(ctx, u, 2026, 11));
        Assert.Equal(0m, await ADetalhar(ctx, u, 2026, 10));
    }

    [Fact]
    public async Task FaturaSemCompras_ContaInteiro()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var f = SeedFatura(ctx);
        Pagamento(ctx, u, 500m, new DateOnly(2026, 11, 9), f);

        Assert.Equal(500m, await ADetalhar(ctx, u, 2026, 11));
    }

    [Fact]
    public async Task DetalhadoEmParte_SoOQueFaltaFicaADetalhar_ECompraContaNoMesDela()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var cat = Guid.NewGuid();
        var f = SeedFatura(ctx);
        Compra(ctx, u, f, 1200m, new DateOnly(2026, 10, 15), cat);
        Pagamento(ctx, u, 3273.80m, new DateOnly(2026, 11, 9), f);

        Assert.Equal(2073.80m, await ADetalhar(ctx, u, 2026, 11));
        Assert.Equal(1200m, (await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(ctx, u, 2026, 10))[cat].Gasto);
    }

    [Fact]
    public async Task DetalhadoTudo_NadaEmDobro_CentavoQueSobraFicaVisivel()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var f = SeedFatura(ctx);
        Compra(ctx, u, f, 3000m, new DateOnly(2026, 10, 3));
        Compra(ctx, u, f, 273.77m, new DateOnly(2026, 10, 25));
        Pagamento(ctx, u, 3273.80m, new DateOnly(2026, 11, 9), f);

        Assert.Equal(0.03m, await ADetalhar(ctx, u, 2026, 11));
    }

    [Fact]
    public async Task DetalhadoAMais_NuncaNegativo()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var f = SeedFatura(ctx);
        Compra(ctx, u, f, 900m, new DateOnly(2026, 10, 3));
        Pagamento(ctx, u, 400m, new DateOnly(2026, 11, 9), f); // pagou só uma parte

        Assert.False((await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(ctx, u, 2026, 11)).ContainsKey(RegrasFinanceiras.CartaoADetalhar));
    }

    [Fact]
    public async Task DoisPagamentos_ComprasCobremPrimeiroOMaisAntigo()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var f = SeedFatura(ctx);
        Compra(ctx, u, f, 700m, new DateOnly(2026, 10, 3));
        Pagamento(ctx, u, 500m, new DateOnly(2026, 10, 28), f);   // coberto inteiro
        Pagamento(ctx, u, 1000m, new DateOnly(2026, 11, 9), f);   // 200 cobertos, 800 a detalhar

        Assert.Equal(0m, await ADetalhar(ctx, u, 2026, 10));
        Assert.Equal(800m, await ADetalhar(ctx, u, 2026, 11));
    }

    [Fact]
    public async Task PagamentoPrevistoOuExcluido_NaoConta()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        Pagamento(ctx, u, 300m, new DateOnly(2026, 11, 20), status: StatusTransacao.Previsao);
        var excluido = Pagamento(ctx, u, 200m, new DateOnly(2026, 11, 9));
        ctx.Transacoes.Find(excluido)!.Ativo = false;
        ctx.SaveChanges();

        Assert.Equal(0m, await ADetalhar(ctx, u, 2026, 11));
    }

    [Fact]
    public async Task PagamentoDeOutraPessoa_NaoConta()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var outro = SeedUsuario(ctx);
        Pagamento(ctx, outro, 300m, new DateOnly(2026, 11, 9));

        Assert.Equal(0m, await ADetalhar(ctx, u, 2026, 11));
    }

    [Fact]
    public void ChaveVirtual_TemNomeEPassaLongeDasCategorias()
    {
        Assert.Equal("Cartão (a detalhar)", RegrasFinanceiras.NomeDaChaveVirtual(RegrasFinanceiras.CartaoADetalhar));
        Assert.True(RegrasFinanceiras.EhChaveVirtual(RegrasFinanceiras.CartaoADetalhar));
        Assert.Null(RegrasFinanceiras.NomeDaChaveVirtual(Guid.NewGuid()));
    }
}

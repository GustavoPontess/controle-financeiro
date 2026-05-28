using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.CartaoCredito;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class CartaoCreditoServiceTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static CriarCartaoCreditoDto DtoValido() => new()
    {
        Nome = "Nubank",
        UltimosDigitos = "1234",
        Bandeira = BandeiraCartao.Mastercard,
        TemCredito = true,
        TemDebito = true,
        EhPrePago = false,
        Limite = 5000,
        DiaFechamento = 10,
        DiaVencimento = 17,
    };

    [Fact]
    public async Task CriarAsync_NomeVazio_LancaException()
    {
        var ctx = CreateContext();
        var svc = new CartaoCreditoService(ctx);
        var dto = DtoValido();
        dto.Nome = "   ";

        var ex = await Assert.ThrowsAsync<Exception>(() => svc.CriarAsync(dto, Guid.NewGuid()));
        Assert.Contains("Nome", ex.Message);
    }

    [Fact]
    public async Task CriarAsync_LimiteZero_TemCredito_LancaException()
    {
        var ctx = CreateContext();
        var svc = new CartaoCreditoService(ctx);
        var dto = DtoValido();
        dto.Limite = 0;

        var ex = await Assert.ThrowsAsync<Exception>(() => svc.CriarAsync(dto, Guid.NewGuid()));
        Assert.Contains("Limite", ex.Message);
    }

    [Fact]
    public async Task CriarAsync_LimiteNegativo_TemCredito_LancaException()
    {
        var ctx = CreateContext();
        var svc = new CartaoCreditoService(ctx);
        var dto = DtoValido();
        dto.Limite = -100;

        await Assert.ThrowsAsync<Exception>(() => svc.CriarAsync(dto, Guid.NewGuid()));
    }

    [Fact]
    public async Task CriarAsync_DiaFechamentoZero_LancaException()
    {
        var ctx = CreateContext();
        var svc = new CartaoCreditoService(ctx);
        var dto = DtoValido();
        dto.DiaFechamento = 0;

        var ex = await Assert.ThrowsAsync<Exception>(() => svc.CriarAsync(dto, Guid.NewGuid()));
        Assert.Contains("fechamento", ex.Message);
    }

    [Fact]
    public async Task CriarAsync_DiaFechamento29_LancaException()
    {
        var ctx = CreateContext();
        var svc = new CartaoCreditoService(ctx);
        var dto = DtoValido();
        dto.DiaFechamento = 29;

        await Assert.ThrowsAsync<Exception>(() => svc.CriarAsync(dto, Guid.NewGuid()));
    }

    [Fact]
    public async Task CriarAsync_DiaFechamentoNull_TemCredito_LancaException()
    {
        var ctx = CreateContext();
        var svc = new CartaoCreditoService(ctx);
        var dto = DtoValido();
        dto.DiaFechamento = null;

        await Assert.ThrowsAsync<Exception>(() => svc.CriarAsync(dto, Guid.NewGuid()));
    }

    [Fact]
    public async Task CriarAsync_DiaVencimento29_LancaException()
    {
        var ctx = CreateContext();
        var svc = new CartaoCreditoService(ctx);
        var dto = DtoValido();
        dto.DiaVencimento = 29;

        var ex = await Assert.ThrowsAsync<Exception>(() => svc.CriarAsync(dto, Guid.NewGuid()));
        Assert.Contains("vencimento", ex.Message);
    }

    [Fact]
    public async Task CriarAsync_SemCredito_IgnoraValidacoesDeCredito_CriaSucesso()
    {
        var ctx = CreateContext();
        var svc = new CartaoCreditoService(ctx);
        var usuarioId = Guid.NewGuid();
        var dto = new CriarCartaoCreditoDto
        {
            Nome = "Vale Refeição",
            UltimosDigitos = "5678",
            Bandeira = BandeiraCartao.Visa,
            TemCredito = false,
            TemDebito = true,
            EhPrePago = true,
        };

        var resultado = await svc.CriarAsync(dto, usuarioId);

        Assert.Equal("Vale Refeição", resultado.Nome);
        Assert.False(resultado.TemCredito);
    }

    [Fact]
    public async Task CriarAsync_DadosValidos_CriaSucesso()
    {
        var ctx = CreateContext();
        var svc = new CartaoCreditoService(ctx);
        var usuarioId = Guid.NewGuid();

        var resultado = await svc.CriarAsync(DtoValido(), usuarioId);

        Assert.Equal("Nubank", resultado.Nome);
        Assert.Equal(5000, resultado.Limite);
        Assert.Equal(10, resultado.DiaFechamento);
    }

    [Fact]
    public async Task DeletarAsync_SoftDelete_CartaoComprasInativosFaturasPagamentosPreservados()
    {
        var ctx = CreateContext();
        var svc = new CartaoCreditoService(ctx);
        var usuarioId = Guid.NewGuid();

        // Cartão + compra + fatura + pagamento (transação com FaturaPagaId).
        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = "Nubank", TemCredito = true, LimiteTotal = 5000,
            CriadoPor = usuarioId, Ativo = true,
        };
        var fatura = new Fatura
        {
            Id = Guid.NewGuid(), CartaoCreditoId = cartao.Id,
            DataInicio = DateTime.UtcNow.AddDays(-30), DataFechamento = DateTime.UtcNow,
            DataVencimento = DateTime.UtcNow.AddDays(7), CriadoPor = usuarioId,
        };
        var compra = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Compra X", Valor = 100, Tipo = TipoTransacao.Despesa,
            CartaoCreditoId = cartao.Id, FaturaId = fatura.Id, UsadoComoCredito = true,
            Data = DateTime.UtcNow, CriadoPor = usuarioId, Ativo = true,
        };
        var pagamento = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Pagamento fatura", Valor = 100, Tipo = TipoTransacao.Despesa,
            FaturaPagaId = fatura.Id, Data = DateTime.UtcNow, CriadoPor = usuarioId, Ativo = true,
        };
        ctx.CartoesCredito.Add(cartao);
        ctx.Faturas.Add(fatura);
        ctx.Transacoes.AddRange(compra, pagamento);
        await ctx.SaveChangesAsync();

        var ok = await svc.DeletarAsync(cartao.Id, usuarioId);

        Assert.True(ok);
        // Cartão e compras desativados (soft).
        var cartaoDb = await ctx.CartoesCredito.FindAsync(cartao.Id);
        Assert.NotNull(cartaoDb);
        Assert.False(cartaoDb!.Ativo);
        var compraDb = await ctx.Transacoes.FindAsync(compra.Id);
        Assert.NotNull(compraDb);
        Assert.False(compraDb!.Ativo);
        // Pagamento mantém Ativo + link com fatura (saída real de dinheiro preservada).
        var pagDb = await ctx.Transacoes.FindAsync(pagamento.Id);
        Assert.NotNull(pagDb);
        Assert.True(pagDb!.Ativo);
        Assert.Equal(fatura.Id, pagDb.FaturaPagaId);
        // Fatura intacta no DB.
        var faturaDb = await ctx.Faturas.FindAsync(fatura.Id);
        Assert.NotNull(faturaDb);
        // Listagem não mostra o cartão soft-deleted.
        var lista = await svc.ListarAsync(usuarioId);
        Assert.Empty(lista);
    }

    [Fact]
    public async Task AtualizarAsync_LimiteNegativo_LancaException()
    {
        var ctx = CreateContext();
        var svc = new CartaoCreditoService(ctx);
        var usuarioId = Guid.NewGuid();

        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(),
            Nome = "Existente",
            TemCredito = true,
            LimiteTotal = 1000,
            CriadoPor = usuarioId,
            Ativo = true,
        };
        ctx.CartoesCredito.Add(cartao);
        await ctx.SaveChangesAsync();

        var dto = DtoValido();
        dto.Limite = -500;

        await Assert.ThrowsAsync<Exception>(() => svc.AtualizarAsync(cartao.Id, dto, usuarioId));
    }
}

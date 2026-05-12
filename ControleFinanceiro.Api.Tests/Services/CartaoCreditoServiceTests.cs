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

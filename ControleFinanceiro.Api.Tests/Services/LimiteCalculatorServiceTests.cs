using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class LimiteCalculatorServiceTests
{
    private static AppDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task CalcularAsync_CartaoComParcelasPendentes_BloqueiaValor()
    {
        // Arrange
        var usuarioId = Guid.NewGuid();
        var cartaoId = Guid.NewGuid();
        var parcelamentoId = Guid.NewGuid();

        var context = CreateInMemoryContext();
        var cartao = new CartaoCredito
        {
            Id = cartaoId,
            Nome = "Test Card",
            TemCredito = true,
            LimiteTotal = 10000,
            CriadoPor = usuarioId,
            Ativo = true
        };
        context.CartoesCredito.Add(cartao);

        var parcelamento = new Parcelamento
        {
            Id = parcelamentoId,
            CartaoCreditoId = cartaoId,
            Ativo = true,
            CriadoPor = usuarioId,
            CriadoEm = DateTime.UtcNow,
            Tipo = TipoParcelamento.CompraParcelada
        };
        context.Parcelamentos.Add(parcelamento);

        var parcela = new ParcelaTransacao
        {
            Id = Guid.NewGuid(),
            ParcelamentoId = parcelamentoId,
            Status = StatusParcela.Pendente,
            Numero = 1,
            QuantidadeTotal = 3,
            Valor = 100,
            DataVencimento = DateTime.UtcNow.AddDays(30),
            FaturaId = Guid.NewGuid(),
            CriadoPor = usuarioId
        };
        context.ParcelasTransacao.Add(parcela);
        await context.SaveChangesAsync();

        var service = new LimiteCalculatorService(context);

        // Act
        var resultado = await service.CalcularAsync(cartaoId, usuarioId);

        // Assert
        Assert.Equal(cartaoId, resultado.CartaoId);
        Assert.Equal(10000, resultado.LimiteTotal);
        Assert.Equal(100, resultado.LimiteBloqueado);
        Assert.Equal(9900, resultado.LimiteDisponivel);
    }

    [Fact]
    public async Task CalcularAsync_CartaoNaoExiste_LancaException()
    {
        // Arrange
        var usuarioId = Guid.NewGuid();
        var cartaoId = Guid.NewGuid();

        var context = CreateInMemoryContext();
        var service = new LimiteCalculatorService(context);

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CalcularAsync(cartaoId, usuarioId));
    }

    [Fact]
    public async Task CalcularAsync_CartaoSemCredito_LancaException()
    {
        // Arrange
        var usuarioId = Guid.NewGuid();
        var cartaoId = Guid.NewGuid();

        var context = CreateInMemoryContext();
        var cartao = new CartaoCredito
        {
            Id = cartaoId,
            Nome = "Test Card",
            TemCredito = false,
            LimiteTotal = 10000,
            CriadoPor = usuarioId,
            Ativo = true
        };
        context.CartoesCredito.Add(cartao);
        await context.SaveChangesAsync();

        var service = new LimiteCalculatorService(context);

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CalcularAsync(cartaoId, usuarioId));
    }

    [Fact]
    public async Task CalcularAsync_ComTransacoesAVista_BloqueiaValor()
    {
        // Arrange
        var usuarioId = Guid.NewGuid();
        var cartaoId = Guid.NewGuid();
        var faturaId = Guid.NewGuid();

        var context = CreateInMemoryContext();
        var cartao = new CartaoCredito
        {
            Id = cartaoId,
            Nome = "Test Card",
            TemCredito = true,
            LimiteTotal = 10000,
            CriadoPor = usuarioId,
            Ativo = true
        };
        context.CartoesCredito.Add(cartao);

        var fatura = new Fatura
        {
            Id = faturaId,
            CartaoCreditoId = cartaoId,
            DataInicio = DateTime.UtcNow,
            DataFechamento = DateTime.UtcNow.AddDays(10),
            DataVencimento = DateTime.UtcNow.AddDays(20),
            EstadoPagamento = EstadoPagamentoFatura.NaoPago,
            CriadoPor = usuarioId
        };
        context.Faturas.Add(fatura);

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            CartaoCreditoId = cartaoId,
            FaturaId = faturaId,
            Descricao = "Test",
            Valor = 500,
            Tipo = TipoTransacao.Despesa,
            StatusTransacao = StatusTransacao.Executado,
            Ativo = true,
            CriadoPor = usuarioId,
            Data = DateTime.UtcNow,
            CriadoEm = DateTime.UtcNow,
            UsadoComoCredito = true
        };
        context.Transacoes.Add(transacao);
        await context.SaveChangesAsync();

        var service = new LimiteCalculatorService(context);

        // Act
        var resultado = await service.CalcularAsync(cartaoId, usuarioId);

        // Assert
        Assert.Equal(500, resultado.LimiteBloqueado);
        Assert.Equal(9500, resultado.LimiteDisponivel);
    }

    [Fact]
    public async Task CalcularTodosDoUsuarioAsync_RetornaSnapshots()
    {
        // Arrange
        var usuarioId = Guid.NewGuid();
        var cartao1Id = Guid.NewGuid();
        var cartao2Id = Guid.NewGuid();

        var context = CreateInMemoryContext();
        var cartao1 = new CartaoCredito
        {
            Id = cartao1Id,
            Nome = "Card 1",
            TemCredito = true,
            LimiteTotal = 5000,
            CriadoPor = usuarioId,
            Ativo = true
        };
        var cartao2 = new CartaoCredito
        {
            Id = cartao2Id,
            Nome = "Card 2",
            TemCredito = true,
            LimiteTotal = 8000,
            CriadoPor = usuarioId,
            Ativo = true
        };
        context.CartoesCredito.AddRange(cartao1, cartao2);
        await context.SaveChangesAsync();

        var service = new LimiteCalculatorService(context);

        // Act
        var resultados = await service.CalcularTodosDoUsuarioAsync(usuarioId);

        // Assert
        Assert.Equal(2, resultados.Count);
        Assert.Contains(resultados, r => r.CartaoId == cartao1Id && r.LimiteTotal == 5000);
        Assert.Contains(resultados, r => r.CartaoId == cartao2Id && r.LimiteTotal == 8000);
    }
}

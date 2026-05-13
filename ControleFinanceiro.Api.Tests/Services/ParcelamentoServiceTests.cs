using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Parcelamento;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;
using System.Linq;

namespace ControleFinanceiro.Api.Tests.Services;

public class ParcelamentoServiceTests
{
    private static AppDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static void SetupTestData(AppDbContext context, Guid usuarioId, Guid cartaoId)
    {
        var cartao = new CartaoCredito
        {
            Id = cartaoId,
            Nome = "Test Card",
            TemCredito = true,
            LimiteTotal = 10000,
            DiaFechamento = 10,
            DiaVencimento = 20,
            CriadoPor = usuarioId,
            Ativo = true
        };
        context.CartoesCredito.Add(cartao);

        var categoria = new Categoria
        {
            Id = Guid.NewGuid(),
            Descricao = "Teste",
            Finalidade = Finalidade.Despesa
        };
        context.Categorias.Add(categoria);

        context.SaveChanges();
    }

    [Fact]
    public async Task CriarAsync_CriaParcelamentoComParcelas()
    {
        // Arrange
        var usuarioId = Guid.NewGuid();
        var cartaoId = Guid.NewGuid();
        var context = CreateInMemoryContext();
        SetupTestData(context, usuarioId, cartaoId);

        var dto = new CriarParcelamentoDto
        {
            Descricao = "Test Parcelamento",
            Valor = 300,
            Tipo = TipoParcelamento.CompraParcelada,
            CartaoCreditoId = cartaoId,
            DataCompra = DateTime.UtcNow.Date,
            Parcelas = 3,
            PrimeiraParcelaMes = DateTime.UtcNow.ToString("yyyy-MM"),
            CategoriaId = context.Categorias.First().Id,
            IdempotencyKey = Guid.NewGuid().ToString()
        };

        var limiteService = new LimiteCalculatorService(context);
        var eventLogService = new FinancialEventLogService(context);
        var faturaService = new FaturaService(context);
        var service = new ParcelamentoService(context, eventLogService, limiteService, faturaService);

        // Act
        var resultado = await service.CriarAsync(dto, usuarioId);

        // Assert
        Assert.NotNull(resultado);
        Assert.Equal(3, resultado.Parcelas.Count);
        Assert.All(resultado.Parcelas, p =>
        {
            Assert.Equal(StatusParcela.Pendente, p.Status);
            Assert.True(p.Numero > 0);
            Assert.True(p.Numero <= 3);
        });
    }

    [Fact]
    public async Task CriarAsync_ValidaValorMinimo()
    {
        // Arrange
        var usuarioId = Guid.NewGuid();
        var cartaoId = Guid.NewGuid();
        var context = CreateInMemoryContext();
        SetupTestData(context, usuarioId, cartaoId);

        var dto = new CriarParcelamentoDto
        {
            Descricao = "Test",
            Valor = 0,
            Tipo = TipoParcelamento.CompraParcelada,
            CartaoCreditoId = cartaoId,
            DataCompra = DateTime.UtcNow.Date,
            Parcelas = 3,
            PrimeiraParcelaMes = DateTime.UtcNow.ToString("yyyy-MM"),
            IdempotencyKey = Guid.NewGuid().ToString()
        };

        var limiteService = new LimiteCalculatorService(context);
        var eventLogService = new FinancialEventLogService(context);
        var faturaService = new FaturaService(context);
        var service = new ParcelamentoService(context, eventLogService, limiteService, faturaService);

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CriarAsync(dto, usuarioId));
    }

    [Fact]
    public async Task CriarAsync_ValidaQuantidadeParcelas()
    {
        // Arrange
        var usuarioId = Guid.NewGuid();
        var cartaoId = Guid.NewGuid();
        var context = CreateInMemoryContext();
        SetupTestData(context, usuarioId, cartaoId);

        var dto = new CriarParcelamentoDto
        {
            Descricao = "Test",
            Valor = 100,
            Tipo = TipoParcelamento.CompraParcelada,
            CartaoCreditoId = cartaoId,
            DataCompra = DateTime.UtcNow.Date,
            Parcelas = 1,
            PrimeiraParcelaMes = DateTime.UtcNow.ToString("yyyy-MM"),
            IdempotencyKey = Guid.NewGuid().ToString()
        };

        var limiteService = new LimiteCalculatorService(context);
        var eventLogService = new FinancialEventLogService(context);
        var faturaService = new FaturaService(context);
        var service = new ParcelamentoService(context, eventLogService, limiteService, faturaService);

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CriarAsync(dto, usuarioId));
    }

    [Fact]
    public async Task CancelarAsync_MarcaParcelamentoInativo()
    {
        // Arrange
        var usuarioId = Guid.NewGuid();
        var cartaoId = Guid.NewGuid();
        var context = CreateInMemoryContext();
        SetupTestData(context, usuarioId, cartaoId);

        // Criar parcelamento
        var dto = new CriarParcelamentoDto
        {
            Descricao = "Test",
            Valor = 300,
            Tipo = TipoParcelamento.CompraParcelada,
            CartaoCreditoId = cartaoId,
            DataCompra = DateTime.UtcNow.Date,
            Parcelas = 3,
            PrimeiraParcelaMes = DateTime.UtcNow.ToString("yyyy-MM"),
            CategoriaId = context.Categorias.First().Id,
            IdempotencyKey = Guid.NewGuid().ToString()
        };

        var limiteService = new LimiteCalculatorService(context);
        var eventLogService = new FinancialEventLogService(context);
        var faturaService = new FaturaService(context);
        var service = new ParcelamentoService(context, eventLogService, limiteService, faturaService);

        var criado = await service.CriarAsync(dto, usuarioId);

        // Act - Cancelar
        var cancelDto = new CancelarParcelamentoDto
        {
            Motivo = "Teste",
            IdempotencyKey = Guid.NewGuid().ToString()
        };
        var resultado = await service.CancelarAsync(criado.Id, cancelDto, usuarioId);

        // Assert
        Assert.NotNull(resultado);
        var parcelamentoAtualizado = await context.Parcelamentos.FindAsync(criado.Id);
        Assert.False(parcelamentoAtualizado!.Ativo);
        Assert.Equal("Teste", parcelamentoAtualizado.MotivoCancelamento);
    }

    [Fact]
    public async Task ListarAsync_RetornaParcelamentosDoUsuario()
    {
        // Arrange
        var usuarioId = Guid.NewGuid();
        var outroUsuarioId = Guid.NewGuid();
        var cartaoId = Guid.NewGuid();
        var context = CreateInMemoryContext();
        SetupTestData(context, usuarioId, cartaoId);

        var parcelamento = new Parcelamento
        {
            Id = Guid.NewGuid(),
            CartaoCreditoId = cartaoId,
            Ativo = true,
            CriadoPor = usuarioId,
            CriadoEm = DateTime.UtcNow,
            Tipo = TipoParcelamento.CompraParcelada
        };
        context.Parcelamentos.Add(parcelamento);

        var parcelamentoOutroUsuario = new Parcelamento
        {
            Id = Guid.NewGuid(),
            CartaoCreditoId = cartaoId,
            Ativo = true,
            CriadoPor = outroUsuarioId,
            CriadoEm = DateTime.UtcNow,
            Tipo = TipoParcelamento.CompraParcelada
        };
        context.Parcelamentos.Add(parcelamentoOutroUsuario);
        await context.SaveChangesAsync();

        var limiteService = new LimiteCalculatorService(context);
        var eventLogService = new FinancialEventLogService(context);
        var faturaService = new FaturaService(context);
        var service = new ParcelamentoService(context, eventLogService, limiteService, faturaService);

        // Act
        var resultado = await service.ListarAsync(usuarioId, true);

        // Assert
        Assert.Single(resultado.Items);
        Assert.Equal(parcelamento.Id, resultado.Items.First().Id);
    }
}

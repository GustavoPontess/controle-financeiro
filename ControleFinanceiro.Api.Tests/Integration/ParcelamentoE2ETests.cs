using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Parcelamento;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using ControleFinanceiro.Api.Tests.Services;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Integration;

public class ParcelamentoE2ETests
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
    public async Task CriarParcelamento_E2E_CriaFaturasETransacoes()
    {
        // Arrange
        var usuarioId = Guid.NewGuid();
        var cartaoId = Guid.NewGuid();
        var context = CreateInMemoryContext();

        // Setup
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
            Descricao = "Categoria Teste",
            Finalidade = Finalidade.Despesa
        };
        context.Categorias.Add(categoria);
        await context.SaveChangesAsync();

        var dto = new CriarParcelamentoDto
        {
            Descricao = "Notebook Dell XPS",
            Valor = 6000,
            Tipo = TipoParcelamento.CompraParcelada,
            CartaoCreditoId = cartaoId,
            DataCompra = HorarioBrasil.HojeData(),
            Parcelas = 3,
            PrimeiraParcelaMes = TestHelpers.MesDaFatura(DateTime.UtcNow, cartao.DiaFechamento),
            CategoriaId = categoria.Id,
            IdempotencyKey = Guid.NewGuid().ToString()
        };

        var limiteService = new LimiteCalculatorService(context);
        var eventLogService = new FinancialEventLogService(context);
        var faturaService = new FaturaService(context);
        var service = new ParcelamentoService(context, eventLogService, limiteService, faturaService);

        // Act
        var resultado = await service.CriarAsync(dto, usuarioId);

        // Assert - Parcelamento
        Assert.NotNull(resultado);
        Assert.True(resultado.Ativo);
        Assert.Equal(dto.Descricao, resultado.Descricao);
        Assert.Equal(3, resultado.Parcelas.Count);

        // Assert - Parcelas
        foreach (var parcela in resultado.Parcelas)
        {
            Assert.NotEqual(Guid.Empty, parcela.Id);
            Assert.Equal(StatusParcela.Pendente, parcela.Status);
            Assert.True(parcela.Numero >= 1 && parcela.Numero <= 3);
        }

        // Assert - Financial Events
        var eventos = await context.FinancialEventLogs
            .Where(e => e.CriadoPor == usuarioId)
            .ToListAsync();
        Assert.NotEmpty(eventos);
        Assert.Contains(eventos, e => e.Tipo == FinancialEventType.ParcelamentoCriado);

        // Assert - Limite disponível após criar parcelamento
        var limite = await limiteService.CalcularAsync(cartaoId, usuarioId);
        Assert.Equal(6000, limite.LimiteBloqueado);
        Assert.Equal(4000, limite.LimiteDisponivel);
    }

    [Fact]
    public async Task CriarParcelamento_IdempotenciaFunciona_RetornaMesmoResultado()
    {
        // Arrange
        var usuarioId = Guid.NewGuid();
        var cartaoId = Guid.NewGuid();
        var idempotencyKey = Guid.NewGuid().ToString();
        var context = CreateInMemoryContext();

        // Setup
        var cartao = new CartaoCredito
        {
            Id = cartaoId,
            Nome = "Test Card",
            TemCredito = true,
            LimiteTotal = 10000,
            DiaFechamento = 10,
            DiaVencimento = 20,
            CriadoPor = usuarioId,
        };
        context.CartoesCredito.Add(cartao);

        var categoria = new Categoria
        {
            Id = Guid.NewGuid(),
            Descricao = "Teste",
            Finalidade = Finalidade.Despesa,
        };
        context.Categorias.Add(categoria);
        await context.SaveChangesAsync();

        var dto = new CriarParcelamentoDto
        {
            Descricao = "Produto A",
            Valor = 1000,
            Tipo = TipoParcelamento.CompraParcelada,
            CartaoCreditoId = cartaoId,
            DataCompra = HorarioBrasil.HojeData(),
            Parcelas = 2,
            PrimeiraParcelaMes = TestHelpers.MesDaFatura(DateTime.UtcNow, cartao.DiaFechamento),
            CategoriaId = categoria.Id,
            IdempotencyKey = idempotencyKey
        };

        var limiteService = new LimiteCalculatorService(context);
        var eventLogService = new FinancialEventLogService(context);
        var faturaService = new FaturaService(context);
        var service = new ParcelamentoService(context, eventLogService, limiteService, faturaService);

        // Act - Primeira chamada
        var resultado1 = await service.CriarAsync(dto, usuarioId);
        var parcelamentoId1 = resultado1.Id;

        // Act - Segunda chamada com mesmo IdempotencyKey
        var resultado2 = await service.CriarAsync(dto, usuarioId);
        var parcelamentoId2 = resultado2.Id;

        // Assert - IDs devem ser iguais (mesmo parcelamento)
        Assert.Equal(parcelamentoId1, parcelamentoId2);

        // Assert - Só um parcelamento deve existir
        var parcelamentos = await context.Parcelamentos
            .Where(p => p.CriadoPor == usuarioId)
            .ToListAsync();
        Assert.Single(parcelamentos);

        // Assert - Só dois eventos (não duplicados)
        var eventos = await context.FinancialEventLogs
            .Where(e => e.CriadoPor == usuarioId && e.Tipo == FinancialEventType.ParcelamentoCriado)
            .ToListAsync();
        Assert.Single(eventos);
    }

    [Fact]
    public async Task CancelarParcelamento_E2E_LiberaLimite()
    {
        // Arrange
        var usuarioId = Guid.NewGuid();
        var cartaoId = Guid.NewGuid();
        var context = CreateInMemoryContext();

        // Setup
        var cartao = new CartaoCredito
        {
            Id = cartaoId,
            Nome = "Test Card",
            TemCredito = true,
            LimiteTotal = 10000,
            DiaFechamento = 10,
            DiaVencimento = 20,
            CriadoPor = usuarioId,
        };
        context.CartoesCredito.Add(cartao);

        var categoria = new Categoria
        {
            Id = Guid.NewGuid(),
            Descricao = "Teste",
            Finalidade = Finalidade.Despesa,
        };
        context.Categorias.Add(categoria);
        await context.SaveChangesAsync();

        // Criar parcelamento
        var criarDto = new CriarParcelamentoDto
        {
            Descricao = "Produto B",
            Valor = 5000,
            Tipo = TipoParcelamento.CompraParcelada,
            CartaoCreditoId = cartaoId,
            DataCompra = HorarioBrasil.HojeData(),
            Parcelas = 2,
            PrimeiraParcelaMes = TestHelpers.MesDaFatura(DateTime.UtcNow, cartao.DiaFechamento),
            CategoriaId = categoria.Id,
            IdempotencyKey = Guid.NewGuid().ToString()
        };

        var limiteService = new LimiteCalculatorService(context);
        var eventLogService = new FinancialEventLogService(context);
        var faturaService = new FaturaService(context);
        var service = new ParcelamentoService(context, eventLogService, limiteService, faturaService);

        var parcelamento = await service.CriarAsync(criarDto, usuarioId);
        var limiteBloqueadoAntes = await limiteService.CalcularAsync(cartaoId, usuarioId);

        // Act - Cancelar
        var cancelDto = new CancelarParcelamentoDto
        {
            Motivo = "Não quero mais",
            IdempotencyKey = Guid.NewGuid().ToString()
        };
        await service.CancelarAsync(parcelamento.Id, cancelDto, usuarioId);

        // Assert
        var limiteDepois = await limiteService.CalcularAsync(cartaoId, usuarioId);
        Assert.Equal(5000, limiteBloqueadoAntes.LimiteBloqueado);
        Assert.Equal(0, limiteDepois.LimiteBloqueado);
        Assert.Equal(10000, limiteDepois.LimiteDisponivel);
    }
}

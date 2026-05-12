using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class TransacaoServiceTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static (AppDbContext ctx, TransacaoService svc) Build()
    {
        var ctx = CreateContext();
        var faturaService = new FaturaService(ctx);
        return (ctx, new TransacaoService(ctx, faturaService));
    }

    private static async Task<(Guid contaId, Guid usuarioId)> SeedConta(AppDbContext ctx)
    {
        var usuarioId = Guid.NewGuid();
        var conta = new Conta
        {
            Id = Guid.NewGuid(),
            Nome = "Conta Teste",
            UsuarioIdProprietario = usuarioId,
            Tipo = TipoConta.ContaCorrente,
        };
        ctx.Contas.Add(conta);
        await ctx.SaveChangesAsync();
        return (conta.Id, usuarioId);
    }

    [Fact]
    public async Task CriarTransacaoAsync_ValorZero_LancaException()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            Descricao = "Teste",
            Valor = 0,
            Tipo = TipoTransacao.Despesa,
            Data = DateTime.UtcNow,
        };

        var ex = await Assert.ThrowsAsync<Exception>(() => svc.CriarTransacaoAsync(transacao, usuarioId));
        Assert.Contains("positivo", ex.Message);
    }

    [Fact]
    public async Task CriarTransacaoAsync_ValorNegativo_LancaException()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            Descricao = "Teste",
            Valor = -10,
            Tipo = TipoTransacao.Despesa,
            Data = DateTime.UtcNow,
        };

        await Assert.ThrowsAsync<Exception>(() => svc.CriarTransacaoAsync(transacao, usuarioId));
    }

    [Fact]
    public async Task CriarTransacaoAsync_DataFutura_LancaException()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            Descricao = "Teste",
            Valor = 100,
            Tipo = TipoTransacao.Despesa,
            Data = DateTime.UtcNow.AddDays(1),
        };

        var ex = await Assert.ThrowsAsync<Exception>(() => svc.CriarTransacaoAsync(transacao, usuarioId));
        Assert.Contains("futura", ex.Message);
    }

    [Fact]
    public async Task CriarTransacaoAsync_ContaNaoEncontrada_LancaException()
    {
        var (_, svc) = Build();
        var usuarioId = Guid.NewGuid();

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = Guid.NewGuid(),
            Descricao = "Teste",
            Valor = 100,
            Tipo = TipoTransacao.Despesa,
            Data = DateTime.UtcNow,
        };

        await Assert.ThrowsAsync<Exception>(() => svc.CriarTransacaoAsync(transacao, usuarioId));
    }

    [Fact]
    public async Task CriarTransacaoAsync_SemContaNemCartao_LancaException()
    {
        var (_, svc) = Build();
        var usuarioId = Guid.NewGuid();

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            Descricao = "Teste",
            Valor = 100,
            Tipo = TipoTransacao.Despesa,
            Data = DateTime.UtcNow,
        };

        var ex = await Assert.ThrowsAsync<Exception>(() => svc.CriarTransacaoAsync(transacao, usuarioId));
        Assert.Contains("conta ou", ex.Message.ToLower());
    }

    [Fact]
    public async Task CriarTransacaoAsync_CategoriaIncompativelDespesa_LancaException()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var categoria = new Categoria
        {
            Id = Guid.NewGuid(),
            Descricao = "Salário",
            Finalidade = Finalidade.Receita,
            UsuarioId = usuarioId,
        };
        ctx.Categorias.Add(categoria);
        await ctx.SaveChangesAsync();

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            CategoriaId = categoria.Id,
            Descricao = "Teste",
            Valor = 100,
            Tipo = TipoTransacao.Despesa,
            Data = DateTime.UtcNow,
        };

        var ex = await Assert.ThrowsAsync<Exception>(() => svc.CriarTransacaoAsync(transacao, usuarioId));
        Assert.Contains("inválida", ex.Message);
    }

    [Fact]
    public async Task CriarTransacaoAsync_DadosValidos_PersisteSucesso()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            Descricao = "Supermercado",
            Valor = 150,
            Tipo = TipoTransacao.Despesa,
            Data = DateTime.UtcNow,
        };

        var resultado = await svc.CriarTransacaoAsync(transacao, usuarioId);

        Assert.Equal(transacao.Id, resultado.Id);
        Assert.Equal(usuarioId, resultado.CriadoPor);
        Assert.Equal(1, await ctx.Transacoes.CountAsync());
    }

    [Fact]
    public async Task AtualizarAsync_ValorNegativo_LancaException()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            Descricao = "Original",
            Valor = 100,
            Tipo = TipoTransacao.Despesa,
            Data = DateTime.UtcNow,
            CriadoPor = usuarioId,
        };
        ctx.Transacoes.Add(transacao);
        await ctx.SaveChangesAsync();

        var dados = new Transacao { Descricao = "Editada", Valor = -50, Tipo = TipoTransacao.Despesa, Data = DateTime.UtcNow };

        await Assert.ThrowsAsync<Exception>(() => svc.AtualizarAsync(transacao.Id, dados, usuarioId));
    }

    [Fact]
    public async Task AtualizarAsync_DataFutura_LancaException()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            Descricao = "Original",
            Valor = 100,
            Tipo = TipoTransacao.Despesa,
            Data = DateTime.UtcNow,
            CriadoPor = usuarioId,
        };
        ctx.Transacoes.Add(transacao);
        await ctx.SaveChangesAsync();

        var dados = new Transacao { Descricao = "Editada", Valor = 100, Tipo = TipoTransacao.Despesa, Data = DateTime.UtcNow.AddDays(5) };

        var ex = await Assert.ThrowsAsync<Exception>(() => svc.AtualizarAsync(transacao.Id, dados, usuarioId));
        Assert.Contains("futura", ex.Message);
    }
}

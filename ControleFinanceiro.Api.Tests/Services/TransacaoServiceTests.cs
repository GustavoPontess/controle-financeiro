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
    public async Task CriarTransacaoAsync_PrevisaoComDataFutura_PersisteSucesso()
    {
        // Previsão (ex.: salário do próximo mês) PODE ser futura — é o ponto dela.
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            Descricao = "Salário (previsto)",
            Valor = 5000,
            Tipo = TipoTransacao.Receita,
            StatusTransacao = StatusTransacao.Previsao,
            Data = DateTime.UtcNow.AddDays(15),
        };

        var resultado = await svc.CriarTransacaoAsync(transacao, usuarioId);

        Assert.Equal(StatusTransacao.Previsao, resultado.StatusTransacao);
        Assert.True(resultado.Data > DateTime.UtcNow);
    }

    [Fact]
    public async Task CriarTransacaoAsync_Efetivado_PersisteComoExecutado()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            Descricao = "Compra à vista",
            Valor = 100,
            Tipo = TipoTransacao.Despesa,
            StatusTransacao = StatusTransacao.Executado,
            Data = DateTime.UtcNow,
        };

        var resultado = await svc.CriarTransacaoAsync(transacao, usuarioId);

        Assert.Equal(StatusTransacao.Executado, resultado.StatusTransacao);
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

    [Fact]
    public async Task CriarTransacaoAsync_ComSubcategoriaValida_Persiste()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var cat = new Categoria { Id = Guid.NewGuid(), Descricao = "Alimentação", Finalidade = Finalidade.Despesa, UsuarioId = usuarioId };
        var sub = new Subcategoria { Id = Guid.NewGuid(), Nome = "Supermercado", CategoriaId = cat.Id, UsuarioId = usuarioId };
        ctx.Categorias.Add(cat);
        ctx.Subcategorias.Add(sub);
        await ctx.SaveChangesAsync();

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            CategoriaId = cat.Id,
            SubcategoriaId = sub.Id,
            Descricao = "Compra mercado",
            Valor = 142.30m,
            Tipo = TipoTransacao.Despesa,
            Data = DateTime.UtcNow,
        };

        var criada = await svc.CriarTransacaoAsync(transacao, usuarioId);

        Assert.Equal(sub.Id, criada.SubcategoriaId);
        Assert.Equal(sub.Id, (await ctx.Transacoes.FindAsync(criada.Id))!.SubcategoriaId);
    }

    [Fact]
    public async Task CriarTransacaoAsync_SubcategoriaDeOutraCategoria_Lanca()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var cat = new Categoria { Id = Guid.NewGuid(), Descricao = "Alimentação", Finalidade = Finalidade.Despesa, UsuarioId = usuarioId };
        var outraCat = new Categoria { Id = Guid.NewGuid(), Descricao = "Transporte", Finalidade = Finalidade.Despesa, UsuarioId = usuarioId };
        var subOutra = new Subcategoria { Id = Guid.NewGuid(), Nome = "Combustível", CategoriaId = outraCat.Id, UsuarioId = usuarioId };
        ctx.Categorias.AddRange(cat, outraCat);
        ctx.Subcategorias.Add(subOutra);
        await ctx.SaveChangesAsync();

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            CategoriaId = cat.Id,
            SubcategoriaId = subOutra.Id, // não pertence a cat
            Descricao = "Inconsistente",
            Valor = 50m,
            Tipo = TipoTransacao.Despesa,
            Data = DateTime.UtcNow,
        };

        var ex = await Assert.ThrowsAsync<Exception>(() => svc.CriarTransacaoAsync(transacao, usuarioId));
        Assert.Contains("pertence", ex.Message);
    }

    // ── Filtro tipo (#185 redesign) ─────────────────────────────────────────
    // Busca `q` usa EF.Functions.Like (relacional) e não roda no provider
    // InMemory — validada manualmente em Postgres. Aqui cobrimos só o filtro
    // de tipo, que é Where puro e roda em qualquer provider.

    [Fact]
    public async Task ListarAsync_FiltroTipo_RetornaSomenteDoTipo()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        ctx.Transacoes.AddRange(
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "Salário", Valor = 1000, Tipo = TipoTransacao.Receita, Data = DateTime.UtcNow.AddDays(-2) },
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "Mercado", Valor = 200, Tipo = TipoTransacao.Despesa, Data = DateTime.UtcNow.AddDays(-1) },
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "Uber", Valor = 30, Tipo = TipoTransacao.Despesa, Data = DateTime.UtcNow });
        await ctx.SaveChangesAsync();

        // tipo=1 (Despesa) → 2 itens
        var despesas = await svc.ListarAsync(usuarioId, tipo: 1);
        Assert.Equal(2, despesas.Total);
        Assert.All(despesas.Items, t => Assert.Equal(TipoTransacao.Despesa, t.Tipo));

        // tipo=2 (Receita) → 1 item
        var receitas = await svc.ListarAsync(usuarioId, tipo: 2);
        Assert.Equal(1, receitas.Total);
        Assert.Equal(TipoTransacao.Receita, receitas.Items.Single().Tipo);

        // sem tipo → todos
        var todos = await svc.ListarAsync(usuarioId);
        Assert.Equal(3, todos.Total);
    }
}

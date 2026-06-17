using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class SubcategoriaServiceTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static async Task<Categoria> SeedCategoria(AppDbContext ctx, Guid? usuarioId)
    {
        var cat = new Categoria { Id = Guid.NewGuid(), Descricao = "Mercado", Finalidade = Finalidade.Despesa, UsuarioId = usuarioId };
        ctx.Categorias.Add(cat);
        await ctx.SaveChangesAsync();
        return cat;
    }

    [Fact]
    public async Task CriarAsync_Valida_DefineIdEUsuario()
    {
        var ctx = CreateContext();
        var svc = new SubcategoriaService(ctx);
        var usuarioId = Guid.NewGuid();
        var cat = await SeedCategoria(ctx, usuarioId);

        var sub = await svc.CriarAsync(new Subcategoria { Nome = "Hortifruti", CategoriaId = cat.Id }, usuarioId);

        Assert.NotEqual(Guid.Empty, sub.Id);
        Assert.Equal(usuarioId, sub.UsuarioId);
        Assert.Equal(cat.Id, sub.CategoriaId);
        Assert.Single(ctx.Subcategorias);
    }

    [Fact]
    public async Task CriarAsync_NomeVazio_LancaArgumentException()
    {
        var ctx = CreateContext();
        var svc = new SubcategoriaService(ctx);
        var usuarioId = Guid.NewGuid();
        var cat = await SeedCategoria(ctx, usuarioId);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.CriarAsync(new Subcategoria { Nome = "  ", CategoriaId = cat.Id }, usuarioId));
    }

    [Fact]
    public async Task CriarAsync_CategoriaInexistente_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var svc = new SubcategoriaService(ctx);
        var usuarioId = Guid.NewGuid();

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            svc.CriarAsync(new Subcategoria { Nome = "Hortifruti", CategoriaId = Guid.NewGuid() }, usuarioId));
    }

    [Fact]
    public async Task CriarAsync_CategoriaDeOutroUsuario_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var svc = new SubcategoriaService(ctx);
        var dono = Guid.NewGuid();
        var outro = Guid.NewGuid();
        var cat = await SeedCategoria(ctx, dono);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            svc.CriarAsync(new Subcategoria { Nome = "Hortifruti", CategoriaId = cat.Id }, outro));
    }

    [Fact]
    public async Task ListarAsync_FiltraPorUsuarioECategoria()
    {
        var ctx = CreateContext();
        var svc = new SubcategoriaService(ctx);
        var usuarioId = Guid.NewGuid();
        var catA = await SeedCategoria(ctx, usuarioId);
        var catB = await SeedCategoria(ctx, usuarioId);

        await svc.CriarAsync(new Subcategoria { Nome = "Hortifruti", CategoriaId = catA.Id }, usuarioId);
        await svc.CriarAsync(new Subcategoria { Nome = "Açougue", CategoriaId = catA.Id }, usuarioId);
        await svc.CriarAsync(new Subcategoria { Nome = "Cinema", CategoriaId = catB.Id }, usuarioId);
        // de outro usuário — não deve aparecer
        await svc.CriarAsync(new Subcategoria { Nome = "Outro", CategoriaId = catA.Id }, usuarioId);

        var deOutro = Guid.NewGuid();
        var listaOutro = await svc.ListarAsync(deOutro, catA.Id);
        Assert.Empty(listaOutro);

        var listaCatA = await svc.ListarAsync(usuarioId, catA.Id);
        Assert.Equal(3, listaCatA.Count);

        var todas = await svc.ListarAsync(usuarioId);
        Assert.Equal(4, todas.Count);
    }

    [Fact]
    public async Task AtualizarAsync_AtualizaCampos()
    {
        var ctx = CreateContext();
        var svc = new SubcategoriaService(ctx);
        var usuarioId = Guid.NewGuid();
        var cat = await SeedCategoria(ctx, usuarioId);
        var sub = await svc.CriarAsync(new Subcategoria { Nome = "Hortifruti", CategoriaId = cat.Id }, usuarioId);

        var atualizada = await svc.AtualizarAsync(sub.Id, new Subcategoria { Nome = "Feira", Icone = "carrot", Cor = "#10B981" }, usuarioId);

        Assert.Equal("Feira", atualizada.Nome);
        Assert.Equal("carrot", atualizada.Icone);
        Assert.Equal("#10B981", atualizada.Cor);
    }

    [Fact]
    public async Task AtualizarAsync_OutroUsuario_LancaUnauthorized()
    {
        var ctx = CreateContext();
        var svc = new SubcategoriaService(ctx);
        var dono = Guid.NewGuid();
        var cat = await SeedCategoria(ctx, dono);
        var sub = await svc.CriarAsync(new Subcategoria { Nome = "Hortifruti", CategoriaId = cat.Id }, dono);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            svc.AtualizarAsync(sub.Id, new Subcategoria { Nome = "Feira" }, Guid.NewGuid()));
    }

    [Fact]
    public async Task DeletarAsync_RemoveDoUsuario()
    {
        var ctx = CreateContext();
        var svc = new SubcategoriaService(ctx);
        var usuarioId = Guid.NewGuid();
        var cat = await SeedCategoria(ctx, usuarioId);
        var sub = await svc.CriarAsync(new Subcategoria { Nome = "Hortifruti", CategoriaId = cat.Id }, usuarioId);

        await svc.DeletarAsync(sub.Id, usuarioId);

        Assert.Empty(ctx.Subcategorias);
    }

    [Fact]
    public async Task DeletarAsync_Padrao_LancaInvalidOperation()
    {
        var ctx = CreateContext();
        var svc = new SubcategoriaService(ctx);
        var cat = await SeedCategoria(ctx, null);
        // subcategoria padrão (UsuarioId null) inserida direto
        var sub = new Subcategoria { Id = Guid.NewGuid(), Nome = "Padrão", CategoriaId = cat.Id, UsuarioId = null };
        ctx.Subcategorias.Add(sub);
        await ctx.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.DeletarAsync(sub.Id, Guid.NewGuid()));
    }
}

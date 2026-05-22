using ControleFinanceiro.Api.Data;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class SubcategoriaSeederTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task Seed_PopulaSubcategoriasPadraoSobCategoriasPadrao()
    {
        var ctx = CreateContext();
        await CategoriaSeeder.SeedAsync(ctx);
        await SubcategoriaSeeder.SeedAsync(ctx);

        var subs = await ctx.Subcategorias.ToListAsync();
        Assert.NotEmpty(subs);
        Assert.All(subs, s => Assert.Null(s.UsuarioId)); // todas padrão

        // toda subcategoria aponta pra uma categoria padrão existente
        var catIds = await ctx.Categorias.Where(c => c.UsuarioId == null).Select(c => c.Id).ToListAsync();
        Assert.All(subs, s => Assert.Contains(s.CategoriaId, catIds));
    }

    [Fact]
    public async Task Seed_Idempotente_NaoDuplica()
    {
        var ctx = CreateContext();
        await CategoriaSeeder.SeedAsync(ctx);
        await SubcategoriaSeeder.SeedAsync(ctx);
        var primeira = await ctx.Subcategorias.CountAsync();

        await SubcategoriaSeeder.SeedAsync(ctx);
        var segunda = await ctx.Subcategorias.CountAsync();

        Assert.Equal(primeira, segunda);
    }
}

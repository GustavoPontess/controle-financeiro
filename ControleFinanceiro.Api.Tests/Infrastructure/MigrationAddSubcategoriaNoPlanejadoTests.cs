using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>Smoke da migration <c>AddSubcategoriaNoPlanejado</c> (2026-10-22): o planejado ganha a subcategoria
/// (anulável, cascata) e o índice único passa a incluir ela. Nada some.</summary>
public class MigrationAddSubcategoriaNoPlanejadoTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=unused").Options);

    [Fact]
    public void Migration_EstaRegistrada_DepoisDaRendaPrevista()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();
        var i = ids.FindIndex(id => id.EndsWith("_AddSubcategoriaNoPlanejado"));
        Assert.True(i > 0);
        Assert.EndsWith("_RendaPrevistaViraPlanejadoDeReceita", ids[i - 1]);
    }

    [Fact]
    public void Up_ColunaNula_ComCascata_EIndiceUnicoComASubcategoria()
    {
        var ops = new AddSubcategoriaNoPlanejado().UpOperations.ToList();
        var coluna = Assert.Single(ops.OfType<AddColumnOperation>());
        Assert.Equal(("Orcamentos", "SubcategoriaId", true), (coluna.Table, coluna.Name, coluna.IsNullable));
        Assert.Equal(ReferentialAction.Cascade, Assert.Single(ops.OfType<AddForeignKeyOperation>()).OnDelete);
        var unico = Assert.Single(ops.OfType<CreateIndexOperation>(), i => i.IsUnique);
        Assert.Equal(["UsuarioId", "CategoriaId", "SubcategoriaId", "Mes", "Ano"], unico.Columns);
        Assert.DoesNotContain(ops, o => o is DropColumnOperation or DropTableOperation or SqlOperation);
    }
}

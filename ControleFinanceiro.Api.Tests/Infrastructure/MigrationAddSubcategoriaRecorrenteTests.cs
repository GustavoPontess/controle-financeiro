using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>AddSubcategoriaRecorrente</c> (subcategoria na conta fixa, 2026-10-15), sem banco: só
/// ADICIONA a coluna anulável em "Assinaturas" (a tabela da conta fixa), o índice e a FK com SetNull (a
/// subcategoria pode sair, a conta fixa fica). As que já existem ficam sem subcategoria.
/// </summary>
public class MigrationAddSubcategoriaRecorrenteTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=unused")
            .Options);

    [Fact]
    public void Migration_EstaRegistrada_DepoisDaAddMeioPagamentoRecorrente()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();

        var i = ids.FindIndex(x => x.EndsWith("_AddSubcategoriaRecorrente"));
        Assert.True(i > 0);
        Assert.EndsWith("_AddMeioPagamentoRecorrente", ids[i - 1]);
    }

    [Fact]
    public void Up_AdicionaColunaAnulavel_Indice_EFkSetNull()
    {
        var ops = new AddSubcategoriaRecorrente().UpOperations.ToList();
        Assert.Equal(3, ops.Count);

        var coluna = Assert.IsType<AddColumnOperation>(ops[0]);
        Assert.Equal(("Assinaturas", "SubcategoriaId"), (coluna.Table, coluna.Name));
        Assert.True(coluna.IsNullable);

        var indice = Assert.IsType<CreateIndexOperation>(ops[1]);
        Assert.Equal("Assinaturas", indice.Table);

        var fk = Assert.IsType<AddForeignKeyOperation>(ops[2]);
        Assert.Equal(("Assinaturas", "Subcategorias"), (fk.Table, fk.PrincipalTable));
        Assert.Equal(ReferentialAction.SetNull, fk.OnDelete);
    }

    [Fact]
    public void Down_DesfazTudo()
    {
        var ops = new AddSubcategoriaRecorrente().DownOperations.ToList();
        Assert.IsType<DropForeignKeyOperation>(ops[0]);
        Assert.IsType<DropIndexOperation>(ops[1]);
        var drop = Assert.IsType<DropColumnOperation>(ops[2]);
        Assert.Equal(("Assinaturas", "SubcategoriaId"), (drop.Table, drop.Name));
    }
}

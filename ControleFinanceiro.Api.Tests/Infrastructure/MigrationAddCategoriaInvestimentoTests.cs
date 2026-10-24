using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>Smoke da migration <c>AddCategoriaInvestimento</c> (2026-10-22): a marca no lançamento e a categoria padrão
/// "Investimentos" com as subcategorias, só em banco que já tem as padrão (banco vazio fica pro seeder).</summary>
public class MigrationAddCategoriaInvestimentoTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=unused").Options);

    [Fact]
    public void Migration_EstaRegistrada_DepoisDaSubcategoriaNoPlanejado()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();
        var i = ids.FindIndex(id => id.EndsWith("_AddCategoriaInvestimento"));
        Assert.True(i > 0);
        Assert.EndsWith("_AddSubcategoriaNoPlanejado", ids[i - 1]);
    }

    [Fact]
    public void Up_MarcaNoLancamento_ECategoriaPadraoSoOndeJaTemAsPadrao()
    {
        var ops = new AddCategoriaInvestimento().UpOperations.ToList();
        var coluna = Assert.Single(ops.OfType<AddColumnOperation>());
        Assert.Equal(("Transacoes", "EhInvestimento", false), (coluna.Table, coluna.Name, coluna.IsNullable));
        var sql = string.Join("\n", ops.OfType<SqlOperation>().Select(o => o.Sql));
        Assert.Contains("'Investimentos', 4, NULL", sql);
        Assert.Contains("WHERE EXISTS (SELECT 1 FROM \"Categorias\" WHERE \"UsuarioId\" IS NULL)", sql); // banco vazio: o seeder cria
        Assert.Contains("'Tesouro Direto'", sql);
        Assert.DoesNotContain("DELETE", sql);
    }
}

using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>AddEncerradaEmConta</c> (encerrar conta, 2026-10-15), sem banco: só ADICIONA a coluna
/// anulável — as contas existentes ficam abertas (null). Nada existente muda.
/// </summary>
public class MigrationAddEncerradaEmContaTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=unused")
            .Options);

    [Fact]
    public void Migration_EstaRegistrada_DepoisDaContaTransacoesRestrict()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();

        var i = ids.FindIndex(x => x.EndsWith("_AddEncerradaEmConta"));
        Assert.True(i > 0);
        Assert.EndsWith("_ContaTransacoesRestrict", ids[i - 1]);
    }

    [Fact]
    public void Up_SoAdicionaAColunaAnulavel()
    {
        var ops = new AddEncerradaEmConta().UpOperations;

        var coluna = Assert.IsType<AddColumnOperation>(Assert.Single(ops));
        Assert.Equal(("Contas", "EncerradaEm"), (coluna.Table, coluna.Name));
        Assert.True(coluna.IsNullable);
    }

    [Fact]
    public void Down_SoRemoveAColuna()
    {
        var drop = Assert.IsType<DropColumnOperation>(Assert.Single(new AddEncerradaEmConta().DownOperations));
        Assert.Equal(("Contas", "EncerradaEm"), (drop.Table, drop.Name));
    }
}

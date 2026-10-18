using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>AddRendaFixaEsperada</c> (2026-10-18): a renda fixa DECLARADA entra em
/// <c>RendasPrevistas</c> (o previsto deixa de olhar contas fixas, que são contas a pagar). Só adiciona a coluna.
/// </summary>
public class MigrationAddRendaFixaEsperadaTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=unused").Options);

    [Fact]
    public void Migration_EstaRegistrada_DepoisDaRendaPrevista()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();
        var i = ids.FindIndex(id => id.EndsWith("_AddRendaFixaEsperada"));
        Assert.True(i > 0);
        Assert.EndsWith("_AddRendaPrevistaEVisibilidade", ids[i - 1]);
    }

    [Fact]
    public void Up_SoAdicionaAColuna_ComZeroPraQuemJaTinhaLinha()
    {
        var ops = new AddRendaFixaEsperada().UpOperations.ToList();
        var coluna = Assert.IsType<AddColumnOperation>(Assert.Single(ops));
        Assert.Equal("RendasPrevistas", coluna.Table);
        Assert.Equal("FixaEsperada", coluna.Name);
        Assert.Equal(0m, coluna.DefaultValue);
    }

    [Fact]
    public void Down_SoTiraAColuna()
    {
        var drop = Assert.IsType<DropColumnOperation>(Assert.Single(new AddRendaFixaEsperada().DownOperations));
        Assert.Equal("FixaEsperada", drop.Name);
    }
}

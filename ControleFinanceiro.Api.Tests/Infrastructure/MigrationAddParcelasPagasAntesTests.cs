using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>AddParcelasPagasAntes</c> (compra parcelada em andamento, 2026-10-12), sem banco: só
/// ADICIONA a coluna, NOT NULL com default 0 — os parcelamentos existentes viram "nenhuma paga antes de
/// registrar", que é o que eles são (todas as parcelas deles estão na tabela). Nada existente muda.
/// </summary>
public class MigrationAddParcelasPagasAntesTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=unused")
            .Options);

    [Fact]
    public void Migration_EstaRegistrada_EEhAMaisRecente()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();

        Assert.Equal("20261012171022_AddParcelasPagasAntes", ids[^1]); // nada gerado por cima sem querer
        Assert.Equal("20261005180232_MotorContaFixaP2", ids[^2]);
    }

    [Fact]
    public void Up_SoAdicionaAColuna_NaoNula_ComZeroNasExistentes()
    {
        var ops = new AddParcelasPagasAntes().UpOperations;

        var coluna = Assert.IsType<AddColumnOperation>(Assert.Single(ops));
        Assert.Equal(("Parcelamentos", "ParcelasPagasAntes"), (coluna.Table, coluna.Name));
        Assert.Equal(typeof(int), coluna.ClrType);
        Assert.False(coluna.IsNullable);
        Assert.Equal(0, coluna.DefaultValue);
    }

    [Fact]
    public void Down_SoRemoveAColuna()
    {
        var ops = new AddParcelasPagasAntes().DownOperations;

        var drop = Assert.IsType<DropColumnOperation>(Assert.Single(ops));
        Assert.Equal(("Parcelamentos", "ParcelasPagasAntes"), (drop.Table, drop.Name));
    }
}

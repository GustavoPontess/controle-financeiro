using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>AddEhPixNoCredito</c> (pernas do Pix no Crédito fora do resultado, 2026-10-12), sem
/// banco: só ADICIONA a marca, NOT NULL com default false — os lançamentos existentes seguem como estão (quem
/// já importou um extrato com Pix no Crédito precisa importar de novo pra marcar). Nada existente muda.
/// </summary>
public class MigrationAddEhPixNoCreditoTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=unused")
            .Options);

    [Fact]
    public void Migration_EstaRegistrada_LogoDepoisDeParcelasPagasAntes()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();

        // A mais recente agora é a ContaTransacoesRestrict (teste próprio); esta segue na ordem em que nasceu.
        var i = ids.IndexOf("20261012195743_AddEhPixNoCredito");
        Assert.True(i > 0);
        Assert.Equal("20261012171022_AddParcelasPagasAntes", ids[i - 1]);
    }

    [Fact]
    public void Up_SoAdicionaAMarca_NaoNula_FalseNasExistentes()
    {
        var ops = new AddEhPixNoCredito().UpOperations;

        var coluna = Assert.IsType<AddColumnOperation>(Assert.Single(ops));
        Assert.Equal(("Transacoes", "EhPixNoCredito"), (coluna.Table, coluna.Name));
        Assert.Equal(typeof(bool), coluna.ClrType);
        Assert.False(coluna.IsNullable);
        Assert.Equal(false, coluna.DefaultValue);
    }

    [Fact]
    public void Down_SoRemoveAMarca()
    {
        var ops = new AddEhPixNoCredito().DownOperations;

        var drop = Assert.IsType<DropColumnOperation>(Assert.Single(ops));
        Assert.Equal(("Transacoes", "EhPixNoCredito"), (drop.Table, drop.Name));
    }
}

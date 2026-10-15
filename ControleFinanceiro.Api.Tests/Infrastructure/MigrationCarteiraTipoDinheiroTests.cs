using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>CarteiraTipoDinheiro</c> (2026-10-15), sem banco: é SÓ um UPDATE de dado — a carteira
/// (IsCarteira) passa a Tipo = 4 (Dinheiro); nenhuma outra conta e nenhuma coluna mudam. Down não faz nada.
/// </summary>
public class MigrationCarteiraTipoDinheiroTests
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

        Assert.EndsWith("_CarteiraTipoDinheiro", ids[^1]); // nada gerado por cima sem querer
        Assert.EndsWith("_AddEncerradaEmConta", ids[^2]);
    }

    [Fact]
    public void Up_SoAtualizaOTipoDaCarteira()
    {
        var sql = Assert.IsType<SqlOperation>(Assert.Single(new CarteiraTipoDinheiro().UpOperations)).Sql;

        Assert.StartsWith("UPDATE \"Contas\" SET \"Tipo\" = 4", sql);
        Assert.Contains("WHERE \"IsCarteira\"", sql); // só a carteira; as outras contas ficam como estão
    }

    [Fact]
    public void Down_NaoFazNada()
    {
        Assert.Empty(new CarteiraTipoDinheiro().DownOperations);
    }
}

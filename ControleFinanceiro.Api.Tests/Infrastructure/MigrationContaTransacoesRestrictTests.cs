using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>ContaTransacoesRestrict</c> (2026-10-15), sem banco: só troca o comportamento do FK
/// Transacoes → Contas de Cascade pra Restrict (excluir conta apagava o histórico financeiro dela). Nenhuma
/// coluna, nenhum dado muda; o Down volta pro Cascade.
/// </summary>
public class MigrationContaTransacoesRestrictTests
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

        Assert.EndsWith("_ContaTransacoesRestrict", ids[^1]); // nada gerado por cima sem querer
        Assert.Equal("20261012195743_AddEhPixNoCredito", ids[^2]);
    }

    [Fact]
    public void Up_SoTrocaOFkDeTransacoesProRestrict()
    {
        var ops = new ContaTransacoesRestrict().UpOperations;

        Assert.Equal(2, ops.Count);
        var drop = Assert.IsType<DropForeignKeyOperation>(ops[0]);
        Assert.Equal(("Transacoes", "FK_Transacoes_Contas_ContaId"), (drop.Table, drop.Name));
        var add = Assert.IsType<AddForeignKeyOperation>(ops[1]);
        Assert.Equal(("Transacoes", "Contas"), (add.Table, add.PrincipalTable));
        Assert.Equal(ReferentialAction.Restrict, add.OnDelete);
    }

    [Fact]
    public void Down_VoltaProCascade()
    {
        var ops = new ContaTransacoesRestrict().DownOperations;

        var add = Assert.IsType<AddForeignKeyOperation>(ops[^1]);
        Assert.Equal(ReferentialAction.Cascade, add.OnDelete);
    }
}

using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>AddRateioCongelado</c> (2026-10-19): a parte de cada um fica gravada na despesa dividida
/// (<c>RateiosTransacao.Valor</c>) e quem sai da família leva a data (<c>MembrosFamilia.SaiuEm</c>). O que já estava
/// dividido ganha as partes pela regra que a tela mostrava, com o resto dos centavos em quem pagou.
/// </summary>
public class MigrationAddRateioCongeladoTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=unused").Options);

    [Fact]
    public void Migration_EstaRegistrada_EEhAMaisRecente()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();
        Assert.EndsWith("_AddRateioCongelado", ids[^1]); // nada gerado por cima sem querer
        Assert.EndsWith("_AddTransacaoEhEmprestimo", ids[^2]);
    }

    [Fact]
    public void Up_DuasColunas_EPreencheAsPartesDoQueJaEstavaDividido()
    {
        var ops = new AddRateioCongelado().UpOperations.ToList();
        var colunas = ops.OfType<AddColumnOperation>().Select(c => (c.Table, c.Name, c.IsNullable)).ToList();
        Assert.Contains(("RateiosTransacao", "Valor", false), colunas);
        Assert.Contains(("MembrosFamilia", "SaiuEm", true), colunas);
        var sql = Assert.Single(ops.OfType<SqlOperation>()).Sql;
        Assert.Contains("SET \"ModoRateio\" = f.\"ModoRateioPadrao\"", sql);
        Assert.Contains("INSERT INTO \"RateiosTransacao\"", sql);
        Assert.Contains("\"PapelPermissao\" <> 3", sql); // quem só vê fica fora
        Assert.Contains("NOT EXISTS (SELECT 1 FROM \"RateiosTransacao\"", sql); // não duplica "Do meu jeito"
        Assert.Contains("+ d.resto", sql); // centavos em quem pagou
        Assert.DoesNotContain(ops, o => o is DropColumnOperation or DropTableOperation);
    }
}

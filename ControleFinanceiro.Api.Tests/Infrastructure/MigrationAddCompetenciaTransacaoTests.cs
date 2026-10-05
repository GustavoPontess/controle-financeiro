using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>AddCompetenciaTransacao</c> (P1-1/P1-2 da revisão do motor de contas fixas, 2026-10-05),
/// sem banco: coluna anulável → backfill das vivas → índice único parcial, nessa ordem (o índice antes do backfill
/// deixaria passar dado torto; o backfill depois da coluna é óbvio). Não mexe no <c>xmin</c> (coluna de sistema).
/// O SQL do backfill foi conferido no Postgres local (dado de teste).
/// </summary>
public class MigrationAddCompetenciaTransacaoTests
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

        Assert.Equal("20261005170111_AddCompetenciaTransacao", ids[^1]); // nada gerado por cima sem querer
    }

    [Fact]
    public void Up_Coluna_DepoisBackfill_DepoisIndiceUnicoParcial_SemMexerNoXmin()
    {
        var ops = new AddCompetenciaTransacao().UpOperations;

        Assert.Equal(3, ops.Count);
        var add = Assert.IsType<AddColumnOperation>(ops[0]);
        Assert.Equal(("Transacoes", "Competencia"), (add.Table, add.Name));
        Assert.True(add.IsNullable);
        Assert.Equal(16, add.MaxLength);

        var sql = Assert.IsType<SqlOperation>(ops[1]).Sql;
        Assert.Contains("UPDATE \"Transacoes\"", sql);
        Assert.Contains("WHERE t.\"Ativo\"", sql);          // só as vivas
        Assert.Contains("e.rn = 1", sql);                    // período com 2 vivas: só uma ganha (o índice não quebra)
        Assert.Contains("'M' || to_char(t.\"Data\", 'YYYY-MM')", sql); // mesmo formato do AgendaRecorrente.Competencia

        var idx = Assert.IsType<CreateIndexOperation>(ops[2]);
        Assert.True(idx.IsUnique);
        Assert.Equal(new[] { "RecorrenteOrigemId", "Competencia" }, idx.Columns);
        Assert.Equal("\"Ativo\" AND \"Competencia\" IS NOT NULL", idx.Filter);

        Assert.DoesNotContain(ops, o => o is AddColumnOperation { Name: "xmin" });
    }

    [Fact]
    public void Down_TiraIndiceEColuna_SemMexerNoXmin()
    {
        var ops = new AddCompetenciaTransacao().DownOperations;

        Assert.Equal(2, ops.Count);
        Assert.IsType<DropIndexOperation>(ops[0]);
        var drop = Assert.IsType<DropColumnOperation>(ops[1]);
        Assert.Equal(("Transacoes", "Competencia"), (drop.Table, drop.Name));
    }
}

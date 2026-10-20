using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>AddAcertoLancamento</c> (passo 3 do espaço da família, 2026-10-19): o acerto ganha dia,
/// confirmação e os lançamentos de cada lado; a transação ganha <c>EhAcerto</c> (fora do resultado). Os acertos de
/// antes valiam na hora, então ficam confirmados.
/// </summary>
public class MigrationAddAcertoLancamentoTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=unused").Options);

    [Fact]
    public void Migration_EstaRegistrada_DepoisDaParteGravada()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();
        var i = ids.FindIndex(id => id.EndsWith("_AddAcertoLancamento"));
        Assert.True(i > 0);
        Assert.EndsWith("_AddRateioCongelado", ids[i - 1]);
    }

    [Fact]
    public void Up_ColunasNovas_SemXmin_EConfirmaOsAcertosDeAntes()
    {
        var ops = new AddAcertoLancamento().UpOperations.ToList();
        var colunas = ops.OfType<AddColumnOperation>().Select(c => (c.Table, c.Name)).ToList();
        Assert.Contains(("Transacoes", "EhAcerto"), colunas);
        Assert.Contains(("AcertosContas", "ConfirmadoEm"), colunas);
        Assert.Contains(("AcertosContas", "Data"), colunas);
        Assert.Contains(("AcertosContas", "TransacaoSaidaId"), colunas);
        Assert.Contains(("AcertosContas", "TransacaoEntradaId"), colunas);
        Assert.DoesNotContain(colunas, c => c.Name == "xmin"); // coluna de sistema do Postgres
        Assert.All(ops.OfType<AddForeignKeyOperation>(), fk => Assert.Equal(ReferentialAction.SetNull, fk.OnDelete));
        var sql = Assert.Single(ops.OfType<SqlOperation>()).Sql;
        Assert.Contains("SET \"ConfirmadoEm\" = \"CriadoEm\"", sql);
        Assert.DoesNotContain(ops, o => o is DropColumnOperation or DropTableOperation);
    }
}

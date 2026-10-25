using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>Smoke da migration <c>AddContaCartaoDaCasa</c> (passo 5 do espaço da família, 2026-10-19): conta e cartão
/// podem ser da casa (<c>FamiliaId</c> nulo, SetNull). Só colunas novas, nada do que existe muda.</summary>
public class MigrationAddContaCartaoDaCasaTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=unused").Options);

    [Fact]
    public void Migration_EstaRegistrada_DepoisDaContaFixaDaFamilia()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();
        var i = ids.FindIndex(id => id.EndsWith("_AddContaCartaoDaCasa"));
        Assert.True(i > 0);
        Assert.EndsWith("_AddRecorrenteFamilia", ids[i - 1]);
    }

    [Fact]
    public void Up_DuasColunasNulas_ComFkSetNull()
    {
        var ops = new AddContaCartaoDaCasa().UpOperations.ToList();
        var colunas = ops.OfType<AddColumnOperation>().Select(c => (c.Table, c.Name, c.IsNullable)).ToList();
        Assert.Equal(2, colunas.Count);
        Assert.Contains(("Contas", "FamiliaId", true), colunas);
        Assert.Contains(("CartoesCredito", "FamiliaId", true), colunas);
        Assert.All(ops.OfType<AddForeignKeyOperation>(), fk => Assert.Equal(ReferentialAction.SetNull, fk.OnDelete));
        Assert.DoesNotContain(ops, o => o is DropColumnOperation or DropTableOperation or SqlOperation);
    }
}

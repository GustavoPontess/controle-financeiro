using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>AddMetaConclusao</c> (2026-10-19): "Concluir e usar o dinheiro" grava quando a meta foi
/// concluída e quanto juntou. Duas colunas opcionais (meta existente fica não concluída), nada mais.
/// </summary>
public class MigrationAddMetaConclusaoTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=unused").Options);

    [Fact]
    public void Migration_EstaRegistrada_DepoisDaCaixinha()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();
        var i = ids.FindIndex(id => id.EndsWith("_AddMetaConclusao"));
        Assert.True(i > 0);
        Assert.EndsWith("_AddMetaCaixinha", ids[i - 1]);
    }

    [Fact]
    public void Up_SoDuasColunasNulasEmMetas()
    {
        var ops = new AddMetaConclusao().UpOperations.ToList();
        Assert.Equal(2, ops.Count);
        Assert.All(ops, o =>
        {
            var c = Assert.IsType<AddColumnOperation>(o);
            Assert.Equal("Metas", c.Table);
            Assert.True(c.IsNullable);
        });
        Assert.Equal(["ConcluidaEm", "ValorJuntado"], ops.Cast<AddColumnOperation>().Select(c => c.Name));
    }
}

using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>AddMetaCaixinha</c> (2026-10-19): cada meta ganha a conta-caixinha dela (<c>Metas.ContaId</c>,
/// FK Restrict, única) e um ícone; o contador solto <c>Metas.ValorAtual</c> sai (não tinha conta por trás; banco local e
/// CI sem metas com valor). Meta antiga fica com <c>ContaId</c> nulo e ganha a caixinha no primeiro guardar.
/// </summary>
public class MigrationAddMetaCaixinhaTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=unused").Options);

    [Fact]
    public void Migration_EstaRegistrada_DepoisDaFotoPerfil()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();
        var i = ids.FindIndex(id => id.EndsWith("_AddMetaCaixinha"));
        Assert.True(i > 0);
        Assert.EndsWith("_AddFotoPerfil", ids[i - 1]);
    }

    [Fact]
    public void Up_TiraOContador_PoeCaixinhaNulaEIcone_FkRestrictUnica()
    {
        var ops = new AddMetaCaixinha().UpOperations.ToList();
        Assert.Equal(("Metas", "ValorAtual"), (Assert.IsType<DropColumnOperation>(ops[0]).Table, ((DropColumnOperation)ops[0]).Name));
        var conta = ops.OfType<AddColumnOperation>().Single(c => c.Name == "ContaId");
        Assert.True(conta.IsNullable);
        Assert.Contains(ops.OfType<AddColumnOperation>(), c => c.Name == "Icone" && c.IsNullable);
        Assert.True(ops.OfType<CreateIndexOperation>().Single().IsUnique);
        Assert.Equal(ReferentialAction.Restrict, ops.OfType<AddForeignKeyOperation>().Single().OnDelete);
    }
}

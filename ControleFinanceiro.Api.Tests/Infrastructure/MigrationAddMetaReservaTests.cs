using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>AddMetaReserva</c> (2026-10-19): metas passam a ser reserva do saldo de contas reais
/// (<c>MetasReservas</c>, uma linha por meta e conta) e o contador solto <c>Metas.ValorAtual</c> sai (não tinha
/// conta por trás; banco local e CI sem metas com valor).
/// </summary>
public class MigrationAddMetaReservaTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=unused").Options);

    [Fact]
    public void Migration_EstaRegistrada_EEhAMaisRecente()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();
        Assert.EndsWith("_AddMetaReserva", ids[^1]); // nada gerado por cima sem querer
        Assert.EndsWith("_AddFotoPerfil", ids[^2]);
    }

    [Fact]
    public void Up_TiraOContador_CriaReservasComIndiceUnicoECascade()
    {
        var ops = new AddMetaReserva().UpOperations.ToList();
        var drop = Assert.IsType<DropColumnOperation>(ops[0]);
        Assert.Equal(("Metas", "ValorAtual"), (drop.Table, drop.Name));
        var tabela = Assert.IsType<CreateTableOperation>(ops[1]);
        Assert.Equal("MetasReservas", tabela.Name);
        Assert.All(tabela.ForeignKeys, fk => Assert.Equal(ReferentialAction.Cascade, fk.OnDelete));
        var unico = ops.OfType<CreateIndexOperation>().Single(i => i.IsUnique);
        Assert.Equal(new[] { "MetaId", "ContaId" }, unico.Columns);
    }
}

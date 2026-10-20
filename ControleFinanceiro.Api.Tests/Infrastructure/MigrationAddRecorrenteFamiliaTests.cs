using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>Smoke da migration <c>AddRecorrenteFamilia</c> (passo 4 do espaço da família, 2026-10-19): a conta fixa
/// pode ser da casa (<c>Assinaturas.FamiliaId</c>, SetNull). Coluna nova, nula, sem mexer no que existe.</summary>
public class MigrationAddRecorrenteFamiliaTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=unused").Options);

    [Fact]
    public void Migration_EstaRegistrada_EEhAMaisRecente()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();
        Assert.EndsWith("_AddRecorrenteFamilia", ids[^1]); // nada gerado por cima sem querer
        Assert.EndsWith("_AddAcertoLancamento", ids[^2]);
    }

    [Fact]
    public void Up_ColunaNula_ComFkSetNull()
    {
        var ops = new AddRecorrenteFamilia().UpOperations.ToList();
        var coluna = Assert.Single(ops.OfType<AddColumnOperation>());
        Assert.Equal(("Assinaturas", "FamiliaId", true), (coluna.Table, coluna.Name, coluna.IsNullable));
        Assert.Equal(ReferentialAction.SetNull, Assert.Single(ops.OfType<AddForeignKeyOperation>()).OnDelete);
        Assert.DoesNotContain(ops, o => o is DropColumnOperation or DropTableOperation or SqlOperation);
    }
}

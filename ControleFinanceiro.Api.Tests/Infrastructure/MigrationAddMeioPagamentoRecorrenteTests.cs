using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>AddMeioPagamentoRecorrente</c> (como a conta fixa é paga, 2026-10-15), sem banco: só
/// ADICIONA a coluna anulável em "Assinaturas" (a tabela da conta fixa). As que já existem ficam sem meio
/// (null) — nada existente muda.
/// </summary>
public class MigrationAddMeioPagamentoRecorrenteTests
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

        Assert.EndsWith("_AddMeioPagamentoRecorrente", ids[^1]); // nada gerado por cima sem querer
        Assert.EndsWith("_AddMfaConviteUsuario", ids[^2]);
    }

    [Fact]
    public void Up_SoAdicionaAColunaAnulavel()
    {
        var coluna = Assert.IsType<AddColumnOperation>(Assert.Single(new AddMeioPagamentoRecorrente().UpOperations));
        Assert.Equal(("Assinaturas", "MeioPagamento"), (coluna.Table, coluna.Name));
        Assert.True(coluna.IsNullable);
    }

    [Fact]
    public void Down_SoRemoveAColuna()
    {
        var drop = Assert.IsType<DropColumnOperation>(Assert.Single(new AddMeioPagamentoRecorrente().DownOperations));
        Assert.Equal(("Assinaturas", "MeioPagamento"), (drop.Table, drop.Name));
    }
}

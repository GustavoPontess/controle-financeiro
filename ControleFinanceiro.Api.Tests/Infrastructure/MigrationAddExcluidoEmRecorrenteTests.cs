using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>AddExcluidoEmRecorrente</c> (exclusão lógica de conta fixa, 2026-10-05), sem banco:
/// registrada como a mais recente, Up só ADICIONA a coluna anulável (nada existente muda) e Down a tira.
/// </summary>
public class MigrationAddExcluidoEmRecorrenteTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=unused")
            .Options);

    [Fact]
    public void Migration_EstaRegistrada_NaOrdem()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();

        var excluido = ids.IndexOf("20261005071851_AddExcluidoEmRecorrente");
        Assert.True(excluido >= 0, "A migration AddExcluidoEmRecorrente não foi descoberta pelo EF.");
        // Logo depois dela vem só a AddCompetenciaTransacao (nada gerado no meio sem querer).
        Assert.Equal("20261005170111_AddCompetenciaTransacao", ids[excluido + 1]);
    }

    [Fact]
    public void Up_SoAdicionaColunaAnulavel_NaTabelaDasContasFixas()
    {
        var ops = new AddExcluidoEmRecorrente().UpOperations;

        var add = Assert.IsType<AddColumnOperation>(Assert.Single(ops));
        Assert.Equal("Assinaturas", add.Table); // Recorrente mora na tabela "Assinaturas"
        Assert.Equal("ExcluidoEm", add.Name);
        Assert.True(add.IsNullable);           // null = não excluída (todas as existentes)
    }

    [Fact]
    public void Down_TiraAColuna()
    {
        var ops = new AddExcluidoEmRecorrente().DownOperations;

        var drop = Assert.IsType<DropColumnOperation>(Assert.Single(ops));
        Assert.Equal("Assinaturas", drop.Table);
        Assert.Equal("ExcluidoEm", drop.Name);
    }

    [Fact]
    public void Modelo_TemOCampoMapeado()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var prop = ctx.Model.FindEntityType(typeof(Api.Domain.Entities.Recorrente))!.FindProperty("ExcluidoEm");
        Assert.NotNull(prop);
        Assert.True(prop!.IsNullable);
    }
}

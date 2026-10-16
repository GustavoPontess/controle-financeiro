using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>AddModeloImportacao</c> (colunas do CSV lembradas por conta, 2026-10-16), sem banco:
/// só CRIA a tabela nova, com o índice único (usuário + conta + assinatura) e as FKs em cascata. Nada existente muda.
/// </summary>
public class MigrationAddModeloImportacaoTests
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

        Assert.EndsWith("_AddModeloImportacao", ids[^1]); // nada gerado por cima sem querer
        Assert.EndsWith("_AddSubcategoriaRecorrente", ids[^2]);
    }

    [Fact]
    public void Up_SoCriaATabela_ComIndiceUnico_EFksEmCascata()
    {
        var ops = new AddModeloImportacao().UpOperations.ToList();

        var tabela = Assert.Single(ops.OfType<CreateTableOperation>());
        Assert.Equal("ModelosImportacao", tabela.Name);
        Assert.All(tabela.ForeignKeys, fk => Assert.Equal(ReferentialAction.Cascade, fk.OnDelete));
        Assert.Equal(2, tabela.ForeignKeys.Count);
        Assert.Contains(ops.OfType<CreateIndexOperation>(), i => i.IsUnique && i.Columns.SequenceEqual(new[] { "UsuarioId", "ContaId", "Assinatura" }));
        Assert.DoesNotContain(ops, o => o is AlterColumnOperation or DropColumnOperation or DropTableOperation);
    }

    [Fact]
    public void Down_SoApagaATabela()
    {
        var drop = Assert.IsType<DropTableOperation>(Assert.Single(new AddModeloImportacao().DownOperations));
        Assert.Equal("ModelosImportacao", drop.Name);
    }
}

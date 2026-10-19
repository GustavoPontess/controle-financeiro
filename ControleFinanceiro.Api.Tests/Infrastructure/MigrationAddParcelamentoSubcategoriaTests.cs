using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>AddParcelamentoSubcategoria</c> (2026-10-19): a compra parcelada do formulário de
/// transação virou parcelamento de verdade e guarda a subcategoria (antes ficava em cada lançamento solto).
/// Coluna opcional, FK SetNull como a da transação e a da conta fixa. Parcelamento existente fica sem.
/// </summary>
public class MigrationAddParcelamentoSubcategoriaTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=unused").Options);

    [Fact]
    public void Migration_EstaRegistrada_EEhAMaisRecente()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();
        Assert.EndsWith("_AddParcelamentoSubcategoria", ids[^1]); // nada gerado por cima sem querer
        Assert.EndsWith("_AddNotificacaoChave", ids[^2]);
    }

    [Fact]
    public void Up_ColunaNula_ComFkSetNull()
    {
        var ops = new AddParcelamentoSubcategoria().UpOperations.ToList();
        var coluna = Assert.IsType<AddColumnOperation>(ops[0]);
        Assert.Equal(("Parcelamentos", "SubcategoriaId", true), (coluna.Table, coluna.Name, coluna.IsNullable));
        var fk = Assert.Single(ops.OfType<AddForeignKeyOperation>());
        Assert.Equal(("Subcategorias", ReferentialAction.SetNull), (fk.PrincipalTable, fk.OnDelete));
        Assert.DoesNotContain(ops, o => o is DropColumnOperation or DropTableOperation or SqlOperation);
    }
}

using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>MotorContaFixaP2</c> (P2 da revisão do motor de contas fixas, 2026-10-05), sem banco:
/// só ADICIONA (marca de edição do usuário com default false, data do conserto único anulável — as existentes
/// ficam null e o job realinha cada uma uma vez — e o índice das ocorrências por conta fixa). Nada existente muda.
/// </summary>
public class MigrationMotorContaFixaP2Tests
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

        Assert.Equal("20261005180232_MotorContaFixaP2", ids[^1]); // nada gerado por cima sem querer
        Assert.Equal("20261005170111_AddCompetenciaTransacao", ids[^2]);
    }

    [Fact]
    public void Up_SoAdiciona_DuasColunasEUmIndice()
    {
        var ops = new MotorContaFixaP2().UpOperations;

        Assert.Equal(3, ops.Count);
        var editada = Assert.IsType<AddColumnOperation>(ops[0]);
        Assert.Equal(("Transacoes", "EditadaPeloUsuario"), (editada.Table, editada.Name));
        Assert.False(editada.IsNullable);
        Assert.Equal(false, editada.DefaultValue); // as existentes: não editadas (não há como saber)

        var realinhado = Assert.IsType<AddColumnOperation>(ops[1]);
        Assert.Equal(("Assinaturas", "RealinhadoEm"), (realinhado.Table, realinhado.Name)); // Recorrente = "Assinaturas"
        Assert.True(realinhado.IsNullable);         // null = ainda não passou pelo conserto único

        var idx = Assert.IsType<CreateIndexOperation>(ops[2]);
        Assert.Equal(new[] { "RecorrenteOrigemId", "Data" }, idx.Columns);
        Assert.False(idx.IsUnique);
    }

    [Fact]
    public void Down_DesfazTudo()
    {
        var ops = new MotorContaFixaP2().DownOperations;

        Assert.Equal(3, ops.Count);
        Assert.IsType<DropIndexOperation>(ops[0]);
        Assert.All(ops.Skip(1), o => Assert.IsType<DropColumnOperation>(o));
    }
}

using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>AddNotificacaoChave</c> (2026-10-19): aviso de uma vez só (alerta de limite) ganha uma
/// chave opcional, única por usuário quando preenchida. Notificação existente fica sem chave (comum).
/// </summary>
public class MigrationAddNotificacaoChaveTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=unused").Options);

    [Fact]
    public void Migration_EstaRegistrada_EEhAMaisRecente()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();
        Assert.EndsWith("_AddNotificacaoChave", ids[^1]); // nada gerado por cima sem querer
        Assert.EndsWith("_AddMetaConclusao", ids[^2]);
    }

    [Fact]
    public void Up_ColunaNula_IndiceUnicoSoComChave()
    {
        var ops = new AddNotificacaoChave().UpOperations.ToList();
        var coluna = Assert.IsType<AddColumnOperation>(ops[0]);
        Assert.Equal(("Notificacoes", "Chave", true), (coluna.Table, coluna.Name, coluna.IsNullable));
        var indice = Assert.IsType<CreateIndexOperation>(ops[1]);
        Assert.True(indice.IsUnique);
        Assert.Equal(["UsuarioId", "Chave"], indice.Columns);
        Assert.Equal("\"Chave\" IS NOT NULL", indice.Filter);
    }
}

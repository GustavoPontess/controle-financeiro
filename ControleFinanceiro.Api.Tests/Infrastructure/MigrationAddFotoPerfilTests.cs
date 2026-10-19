using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>AddFotoPerfil</c> (2026-10-18): a versão da foto em <c>Usuarios</c> (nula pra quem já
/// existe) e a tabela <c>FotosPerfil</c> 1:1 com cascade. Não mexe em dado existente.
/// </summary>
public class MigrationAddFotoPerfilTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=unused").Options);

    [Fact]
    public void Migration_EstaRegistrada_DepoisDaRendaFixa()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();
        var i = ids.FindIndex(id => id.EndsWith("_AddFotoPerfil"));
        Assert.True(i > 0);
        Assert.EndsWith("_AddRendaFixaEsperada", ids[i - 1]);
    }

    [Fact]
    public void Up_ColunaNulaETabelaComCascade()
    {
        var ops = new AddFotoPerfil().UpOperations.ToList();
        var coluna = Assert.IsType<AddColumnOperation>(ops[0]);
        Assert.Equal("Usuarios", coluna.Table);
        Assert.Equal("FotoPerfilEm", coluna.Name);
        Assert.True(coluna.IsNullable);

        var tabela = Assert.IsType<CreateTableOperation>(ops[1]);
        Assert.Equal("FotosPerfil", tabela.Name);
        Assert.Equal(new[] { "UsuarioId" }, tabela.PrimaryKey!.Columns);
        var fk = Assert.Single(tabela.ForeignKeys);
        Assert.Equal("Usuarios", fk.PrincipalTable);
        Assert.Equal(ReferentialAction.Cascade, fk.OnDelete);
        Assert.Equal(2, ops.Count);
    }

    [Fact]
    public void Down_TiraTabelaEColuna()
    {
        var ops = new AddFotoPerfil().DownOperations.ToList();
        Assert.IsType<DropTableOperation>(ops[0]);
        Assert.Equal("FotoPerfilEm", Assert.IsType<DropColumnOperation>(ops[1]).Name);
    }
}

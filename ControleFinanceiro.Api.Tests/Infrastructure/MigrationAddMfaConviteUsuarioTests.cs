using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>AddMfaConviteUsuario</c> (convite pra ativar o MFA depois do login, 2026-10-15), sem
/// banco: só ADICIONA duas colunas em Usuarios — a data do "agora não" (anulável) e o "não perguntar mais"
/// (default false). Quem já existe passa a ver o convite uma vez; nada existente muda.
/// </summary>
public class MigrationAddMfaConviteUsuarioTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=unused")
            .Options);

    [Fact]
    public void Migration_EstaRegistrada_DepoisDaCarteiraTipoDinheiro()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();

        var i = ids.FindIndex(x => x.EndsWith("_AddMfaConviteUsuario"));
        Assert.True(i > 0);
        Assert.EndsWith("_CarteiraTipoDinheiro", ids[i - 1]);
    }

    [Fact]
    public void Up_SoAdicionaAsDuasColunas()
    {
        var ops = new AddMfaConviteUsuario().UpOperations.Cast<AddColumnOperation>().ToList();

        Assert.Equal(2, ops.Count);
        Assert.All(ops, o => Assert.Equal("Usuarios", o.Table));
        var adiado = Assert.Single(ops, o => o.Name == "MfaConviteAdiadoAte");
        Assert.True(adiado.IsNullable);
        var dispensado = Assert.Single(ops, o => o.Name == "MfaConviteDispensado");
        Assert.False(dispensado.IsNullable);
        Assert.Equal(false, dispensado.DefaultValue);
    }

    [Fact]
    public void Down_SoRemoveAsDuasColunas()
    {
        var drops = new AddMfaConviteUsuario().DownOperations.Cast<DropColumnOperation>().ToList();

        Assert.Equal(new[] { "MfaConviteAdiadoAte", "MfaConviteDispensado" }, drops.Select(d => d.Name).OrderBy(n => n));
    }
}

using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>Smoke da migration <c>RendaPrevistaViraPlanejadoDeReceita</c> (2026-10-22): só dado, nenhuma tabela
/// muda. O que cada pessoa declarou esperar (fixa + variável) vira o planejado da categoria padrão "Renda", sem
/// duplicar linha que já existe; a tabela antiga fica.</summary>
public class MigrationRendaPrevistaViraPlanejadoDeReceitaTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=unused").Options);

    [Fact]
    public void Migration_EstaRegistrada_DepoisDaContaDaCasa()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();
        var i = ids.FindIndex(id => id.EndsWith("_RendaPrevistaViraPlanejadoDeReceita"));
        Assert.True(i > 0);
        Assert.EndsWith("_AddContaCartaoDaCasa", ids[i - 1]);
    }

    [Fact]
    public void Up_SoCopiaADeclaracaoProPlanejadoDaRenda_SemMexerNoEsquema()
    {
        var ops = new RendaPrevistaViraPlanejadoDeReceita().UpOperations.ToList();
        var sql = Assert.IsType<SqlOperation>(Assert.Single(ops)).Sql;
        Assert.Contains("INSERT INTO \"Orcamentos\"", sql);
        Assert.Contains("FROM \"RendasPrevistas\"", sql);
        Assert.Contains("\"FixaEsperada\" + r.\"VariavelEsperada\"", sql);
        Assert.Contains("\"Descricao\" = 'Renda' AND \"UsuarioId\" IS NULL", sql);
        Assert.Contains("NOT EXISTS", sql); // não duplica o que já foi planejado no mês
        Assert.DoesNotContain("DELETE", sql);
    }
}

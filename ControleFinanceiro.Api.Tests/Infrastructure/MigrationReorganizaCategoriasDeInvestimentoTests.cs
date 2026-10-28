using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>Smoke da migration <c>ReorganizaCategoriasDeInvestimento</c> (2026-10-22): só dado. A "Investimentos" vira
/// "Renda fixa", nascem as outras cinco categorias de investimento, as subcategorias antigas vão pro lugar certo com o
/// que aponta pra elas, e as fontes novas entram. Nada se apaga e nada muda em banco vazio.</summary>
public class MigrationReorganizaCategoriasDeInvestimentoTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=unused").Options);

    [Fact]
    public void Migration_EstaRegistrada_DepoisDaAddCategoriaInvestimento()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();
        // Logo depois de AddCategoriaInvestimento (a mais recente agora é a ConfirmacaoEmailCadastro, 2026-10-27).
        var i = ids.FindIndex(id => id.EndsWith("_ReorganizaCategoriasDeInvestimento"));
        Assert.True(i > 0 && ids[i - 1].EndsWith("_AddCategoriaInvestimento"));
        Assert.EndsWith("_ConfirmacaoEmailCadastro", ids[^1]); // nada gerado por cima sem querer
    }

    [Fact]
    public void Up_SoDado_RenomeiaMoveECriaSemApagar()
    {
        var ops = new ReorganizaCategoriasDeInvestimento().UpOperations.ToList();
        Assert.All(ops, o => Assert.IsType<SqlOperation>(o));
        var sql = string.Join("\n", ops.Cast<SqlOperation>().Select(o => o.Sql));
        Assert.Contains("SET \"Descricao\" = 'Renda fixa'", sql);
        foreach (var c in new[] { "Renda variável", "Previdência", "Criptomoedas", "Investimentos no exterior", "Outros investimentos" })
            Assert.Contains($"'{c}', 4, NULL", sql);
        Assert.Contains("'Ações e fundos'", sql);       // vai pra Renda variável como "Ações"
        Assert.Contains("'Outras moedas'", sql);        // a "Criptomoedas" antiga vira a fonte genérica da categoria nova
        foreach (var t in new[] { "Transacoes", "Orcamentos", "Assinaturas", "Parcelamentos" })
            Assert.Contains($"UPDATE \"{t}\" t SET \"CategoriaId\"", sql); // o que aponta pra subcategoria movida acompanha
        Assert.Contains("'Tesouro Direto'", sql);
        Assert.Contains("'Fundos imobiliários'", sql);
        Assert.DoesNotContain("DELETE", sql);
        Assert.DoesNotContain("DROP", sql);
        Assert.Empty(new ReorganizaCategoriasDeInvestimento().DownOperations);
    }
}

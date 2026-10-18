using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>AddRendaPrevistaEVisibilidade</c> (renda-e-visibilidade.md, 2026-10-18), sem banco:
/// cria <c>RendasPrevistas</c> (única por usuário+mês, cascata), troca o valor manual de renda do membro pela
/// visibilidade, e MOVE os dados antes de apagar a coluna: a renda manual vira a variável esperada do mês
/// corrente, cashback/reembolso saem de "Renda" pra "Dinheiro que volta", as subcategorias novas entram.
/// </summary>
public class MigrationAddRendaPrevistaEVisibilidadeTests
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

        // Depois de AddModeloImportacao (a mais recente é a AddRendaFixaEsperada, que tem o próprio teste).
        var i = ids.FindIndex(id => id.EndsWith("_AddRendaPrevistaEVisibilidade"));
        Assert.True(i > 0 && ids[i - 1].EndsWith("_AddModeloImportacao"));
    }

    [Fact]
    public void Up_CriaATabela_TrocaAsColunasDoMembro_EMoveOsDadosAntesDeApagar()
    {
        var ops = new AddRendaPrevistaEVisibilidade().UpOperations.ToList();

        var tabela = Assert.Single(ops.OfType<CreateTableOperation>());
        Assert.Equal("RendasPrevistas", tabela.Name);
        Assert.All(tabela.ForeignKeys, fk => Assert.Equal(ReferentialAction.Cascade, fk.OnDelete));
        Assert.Contains(ops.OfType<CreateIndexOperation>(), i => i.IsUnique && i.Columns.SequenceEqual(new[] { "UsuarioId", "Ano", "Mes" }));

        var adicionadas = ops.OfType<AddColumnOperation>().Where(c => c.Table == "MembrosFamilia").Select(c => c.Name).ToList();
        Assert.Contains("VisibilidadeRenda", adicionadas);
        Assert.Contains("RendaVisivelPara", adicionadas);
        var apagada = Assert.Single(ops.OfType<DropColumnOperation>());
        Assert.Equal("RendaMensal", apagada.Name);

        // O SQL que move os dados vem ANTES de apagar a coluna da renda manual.
        var sqls = ops.OfType<SqlOperation>().ToList();
        Assert.True(sqls.Count >= 4, "faltou o SQL de dados");
        Assert.True(ops.IndexOf(sqls[^1]) < ops.IndexOf(apagada), "o SQL de dados tem que rodar antes do DropColumn");
        var todoSql = string.Join("\n", sqls.Select(s => s.Sql));
        Assert.Contains("Dinheiro que volta", todoSql);
        Assert.Contains("RendasPrevistas", todoSql);
        Assert.Contains("Bolsa Família", todoSql);
        Assert.DoesNotContain(ops, o => o is DropTableOperation);
    }

    [Fact]
    public void Down_ApagaATabela_EVoltaAColuna()
    {
        var ops = new AddRendaPrevistaEVisibilidade().DownOperations.ToList();
        Assert.Equal("RendasPrevistas", Assert.Single(ops.OfType<DropTableOperation>()).Name);
        Assert.Contains(ops.OfType<AddColumnOperation>(), c => c.Name == "RendaMensal");
    }
}

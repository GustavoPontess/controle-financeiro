using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>AddTransacaoEhEmprestimo</c> (2026-10-19): dinheiro de empréstimo fica fora do resultado do
/// mês, como transferência (decisão do Gustavo). Coluna nova com false e os lançamentos já ligados a um empréstimo
/// (o da criação e os dos pagamentos) passam a true.
/// </summary>
public class MigrationAddTransacaoEhEmprestimoTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=unused").Options);

    [Fact]
    public void Migration_EstaRegistrada_DepoisDaSubcategoriaDoParcelamento()
    {
        using var ctx = ContextoNpgsqlSemBanco();
        var ids = ctx.Database.GetMigrations().ToList();
        var i = ids.FindIndex(id => id.EndsWith("_AddTransacaoEhEmprestimo"));
        Assert.True(i > 0);
        Assert.EndsWith("_AddParcelamentoSubcategoria", ids[i - 1]);
    }

    [Fact]
    public void Up_ColunaFalse_EMarcaOsLancamentosJaLigadosAEmprestimo()
    {
        var ops = new AddTransacaoEhEmprestimo().UpOperations.ToList();
        var coluna = Assert.IsType<AddColumnOperation>(ops[0]);
        Assert.Equal(("Transacoes", "EhEmprestimo", false, (object?)false), (coluna.Table, coluna.Name, coluna.IsNullable, coluna.DefaultValue));
        var sql = Assert.IsType<SqlOperation>(ops[1]).Sql;
        Assert.Contains("UPDATE \"Transacoes\" SET \"EhEmprestimo\" = TRUE", sql);
        Assert.Contains("\"Emprestimos\"", sql);
        Assert.Contains("\"TransacaoComprovanteId\"", sql);
        Assert.Contains("\"TransacaoRecebimentoId\"", sql);
        Assert.DoesNotContain(ops, o => o is DropColumnOperation or DropTableOperation);
    }
}

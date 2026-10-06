using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Smoke da migration <c>SepararDataHoraTransacao</c> (Transacao.Data: timestamp → date + Hora time),
/// sem banco: as operações geradas por Up/Down e a consistência do snapshot com o modelo. O que protege
/// aqui é a ORDEM — no Up a Hora tem que ser copiada ANTES de a Data virar date (senão a hora do
/// lançamento é perdida pra sempre) e, no Down, o timestamp tem que ser recomposto ANTES de a Hora ser
/// descartada. Montar o modelo/migration não conecta no banco.
/// </summary>
public class MigrationSepararDataHoraTransacaoTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=unused")
            .Options);

    [Fact]
    public void Migration_EstaRegistradaNoAssembly_DepoisDaReconciliacao()
    {
        using var ctx = ContextoNpgsqlSemBanco();

        var ids = ctx.Database.GetMigrations().ToList();

        var separar = ids.IndexOf("20261002122556_SepararDataHoraTransacao");
        var reconciliacao = ids.IndexOf("20260930175534_AddReconciliacaoSaldo");
        Assert.True(separar >= 0, "A migration SepararDataHoraTransacao não foi descoberta pelo EF.");
        Assert.True(reconciliacao >= 0 && separar > reconciliacao);
        // Depois dela só vem a AddExcluidoEmRecorrente (2026-10-05) — nada gerado por cima sem querer.
        Assert.Equal("20261005071851_AddExcluidoEmRecorrente", ids[separar + 1]);
    }

    [Fact]
    public void Up_CriaHoraAnulavel_CopiaAHoraAntesDeReduzirADataParaDate()
    {
        var ops = new SepararDataHoraTransacao().UpOperations;

        Assert.Equal(3, ops.Count);
        var addHora = Assert.IsType<AddColumnOperation>(ops[0]);
        Assert.Equal("Transacoes", addHora.Table);
        Assert.Equal("Hora", addHora.Name);
        Assert.Equal("time without time zone", addHora.ColumnType);
        Assert.True(addHora.IsNullable); // null = lançamento sem hora

        var copiaHora = Assert.IsType<SqlOperation>(ops[1]);
        Assert.Contains("\"Hora\" =", copiaHora.Sql);
        Assert.Contains("\"Data\"::time", copiaHora.Sql);
        Assert.Contains("NULL", copiaHora.Sql); // meia-noite = sem hora real → Hora null

        var reduzData = Assert.IsType<SqlOperation>(ops[2]);
        Assert.Contains("ALTER COLUMN \"Data\" TYPE date", reduzData.Sql);
        Assert.Contains("USING \"Data\"::date", reduzData.Sql);
    }

    [Fact]
    public void Down_RecompoeOTimestampAntesDeDescartarAHora()
    {
        var ops = new SepararDataHoraTransacao().DownOperations;

        Assert.Equal(2, ops.Count);
        var recompoe = Assert.IsType<SqlOperation>(ops[0]);
        Assert.Contains("TYPE timestamp without time zone", recompoe.Sql);
        Assert.Contains("COALESCE(\"Hora\"", recompoe.Sql); // hora null → meia-noite
        var dropHora = Assert.IsType<DropColumnOperation>(ops[1]);
        Assert.Equal("Transacoes", dropHora.Table);
        Assert.Equal("Hora", dropHora.Name);
    }

    [Fact]
    public void Snapshot_EstaEmDiaComOModelo_SemMudancaPendente()
    {
        // Se alguém mexer na entidade e esquecer a migration (ou o contrário), o deploy aplica um schema
        // diferente do que o código espera. Compara o snapshot das migrations com o modelo atual.
        using var ctx = ContextoNpgsqlSemBanco();

        Assert.False(ctx.Database.HasPendingModelChanges(),
            "O modelo do EF diverge do snapshot das migrations — falta gerar (ou regerar) uma migration.");
    }
}

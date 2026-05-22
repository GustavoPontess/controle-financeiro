using System.Text;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class RelatorioServiceTests
{
    private static readonly DateTime DataBase = new(2026, 5, 20, 12, 0, 0, DateTimeKind.Utc);

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static async Task SeedTransacaoAsync(
        AppDbContext ctx,
        Guid usuarioId,
        string descricao,
        string categoriaDescricao = "Mercado",
        string contaNome = "Conta Corrente")
    {
        var conta = new Conta
        {
            Id = Guid.NewGuid(),
            Nome = contaNome,
            UsuarioIdProprietario = usuarioId,
            Tipo = TipoConta.ContaCorrente
        };

        var categoria = new Categoria
        {
            Id = Guid.NewGuid(),
            Descricao = categoriaDescricao,
            Finalidade = Finalidade.Despesa,
            UsuarioId = usuarioId
        };

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = conta.Id,
            Conta = conta,
            CategoriaId = categoria.Id,
            Categoria = categoria,
            Descricao = descricao,
            Valor = 123.45m,
            Tipo = TipoTransacao.Despesa,
            Data = DataBase,
            CriadoPor = usuarioId,
            MeioPagamento = MeioPagamento.Pix
        };

        ctx.Contas.Add(conta);
        ctx.Categorias.Add(categoria);
        ctx.Transacoes.Add(transacao);
        await ctx.SaveChangesAsync();
    }

    private static async Task<string> ExportarCsvAsync(AppDbContext ctx, Guid usuarioId)
    {
        var service = new RelatorioService(ctx);
        var bytes = await service.ExportarCsvAsync(usuarioId, DataBase.AddDays(-1), DataBase.AddDays(1));
        return Encoding.UTF8.GetString(bytes);
    }

    [Theory]
    [InlineData("=SOMA(1;1)", "\"'=SOMA(1;1)\"")]
    [InlineData("+SOMA(1;1)", "\"'+SOMA(1;1)\"")]
    [InlineData("-SOMA(1;1)", "\"'-SOMA(1;1)\"")]
    [InlineData("@SOMA(1;1)", "\"'@SOMA(1;1)\"")]
    public async Task ExportarCsvAsync_NeutralizaFormulaNaDescricao(string descricao, string esperado)
    {
        await using var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        await SeedTransacaoAsync(ctx, usuarioId, descricao);

        var csv = await ExportarCsvAsync(ctx, usuarioId);

        Assert.Contains(esperado, csv);
    }

    [Fact]
    public async Task ExportarCsvAsync_NeutralizaFormulaAposEspacoInicial()
    {
        await using var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        await SeedTransacaoAsync(ctx, usuarioId, "  =SOMA(1;1)");

        var csv = await ExportarCsvAsync(ctx, usuarioId);

        Assert.Contains("\"  '=SOMA(1;1)\"", csv);
    }

    [Fact]
    public async Task ExportarCsvAsync_NeutralizaFormulaEmCategoriaEConta()
    {
        await using var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        await SeedTransacaoAsync(ctx, usuarioId, "Compra", "=Categoria", "@Conta");

        var csv = await ExportarCsvAsync(ctx, usuarioId);

        Assert.Contains("\"'=Categoria\"", csv);
        Assert.Contains("\"'@Conta\"", csv);
    }

    [Fact]
    public async Task ExportarCsvAsync_PreservaTextoNormalEEscapaAspas()
    {
        await using var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        await SeedTransacaoAsync(ctx, usuarioId, "Mercado \"Centro\"");

        var csv = await ExportarCsvAsync(ctx, usuarioId);

        Assert.Contains("\"Mercado \"\"Centro\"\"\"", csv);
        Assert.DoesNotContain("\"'Mercado", csv);
    }

    [Fact]
    public async Task ExportarCsvAsync_NormalizaQuebrasDeLinhaSemCriarNovasLinhas()
    {
        await using var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        await SeedTransacaoAsync(ctx, usuarioId, "\r\n=HYPERLINK(\"http://example.test\")");

        var csv = await ExportarCsvAsync(ctx, usuarioId);
        var linhas = csv.Replace("\r\n", "\n").Split('\n', StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal(2, linhas.Length);
        Assert.Contains("\" '=HYPERLINK(\"\"http://example.test\"\")\"", csv);
    }
}

using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Importacao;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class ImportacaoServiceTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(
                Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static ImportacaoService CreateService(AppDbContext ctx)
    {
        var transacaoService = new TransacaoService(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx));
        return new ImportacaoService(ctx, new ExtratoImportService(), transacaoService);
    }

    private static Guid SeedConta(AppDbContext ctx, Guid usuarioId)
    {
        var conta = new Conta
        {
            Id = Guid.NewGuid(), Nome = "Conta", Tipo = TipoConta.ContaCorrente,
            UsuarioIdProprietario = usuarioId,
        };
        ctx.Contas.Add(conta);
        ctx.SaveChanges();
        return conta.Id;
    }

    private static void SeedTransacao(
        AppDbContext ctx, Guid contaId, decimal valor, DateTime data,
        string descricao, TipoTransacao tipo, string? fitId = null)
    {
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = descricao, Valor = valor, Tipo = tipo,
            Data = DateOnly.FromDateTime(data), ContaId = contaId, Ativo = true,
            StatusTransacao = StatusTransacao.Executado, ImportacaoFitId = fitId,
        });
        ctx.SaveChanges();
    }

    private const string OfxDuasLinhas =
        "<STMTTRN><DTPOSTED>20260510<TRNAMT>-50.00<FITID>FIT-1<MEMO>Mercado</STMTTRN>" +
        "<STMTTRN><DTPOSTED>20260512<TRNAMT>200.00<FITID>FIT-2<MEMO>Salario</STMTTRN>";

    [Fact]
    public async Task PreviewAsync_ContaInexistente_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var svc = CreateService(ctx);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.PreviewAsync(Guid.NewGuid(), Guid.NewGuid(), "e.ofx", OfxDuasLinhas));
    }

    [Fact]
    public async Task PreviewAsync_DerivaTipoPeloSinalDoValor()
    {
        var ctx = CreateContext();
        var usuario = Guid.NewGuid();
        var contaId = SeedConta(ctx, usuario);
        var svc = CreateService(ctx);

        var preview = await svc.PreviewAsync(contaId, usuario, "e.ofx", OfxDuasLinhas);

        Assert.Equal(2, preview.Total);
        var despesa = preview.Linhas[0];
        Assert.Equal(TipoTransacao.Despesa, despesa.Tipo);
        Assert.Equal(50.00m, despesa.Valor); // valor absoluto
        var receita = preview.Linhas[1];
        Assert.Equal(TipoTransacao.Receita, receita.Tipo);
        Assert.Equal(200.00m, receita.Valor);
    }

    [Fact]
    public async Task PreviewAsync_MarcaDuplicataPorFitId()
    {
        var ctx = CreateContext();
        var usuario = Guid.NewGuid();
        var contaId = SeedConta(ctx, usuario);
        // Já existe a transação com FITID FIT-1.
        SeedTransacao(ctx, contaId, 50m, new DateTime(2026, 5, 10), "Mercado",
            TipoTransacao.Despesa, fitId: "FIT-1");
        var svc = CreateService(ctx);

        var preview = await svc.PreviewAsync(contaId, usuario, "e.ofx", OfxDuasLinhas);

        Assert.True(preview.Linhas[0].Duplicada);   // FIT-1 já existe
        Assert.False(preview.Linhas[1].Duplicada);  // FIT-2 é nova
        Assert.Equal(1, preview.Duplicadas);
    }

    [Fact]
    public async Task PreviewAsync_Csv_DuplicataHeuristica()
    {
        var ctx = CreateContext();
        var usuario = Guid.NewGuid();
        var contaId = SeedConta(ctx, usuario);
        SeedTransacao(ctx, contaId, 50m, new DateTime(2026, 5, 10), "Mercado",
            TipoTransacao.Despesa);
        var svc = CreateService(ctx);

        var csv = "2026-05-10,Mercado,-50.00\n2026-05-11,Posto,-30.00";
        var preview = await svc.PreviewAsync(contaId, usuario, "e.csv", csv);

        Assert.True(preview.Linhas[0].Duplicada);   // conta+data+valor+descrição batem
        Assert.False(preview.Linhas[1].Duplicada);
    }

    [Fact]
    public async Task PreviewAsync_SugereCategoriaPorPalavraChave()
    {
        var ctx = CreateContext();
        var usuario = Guid.NewGuid();
        var contaId = SeedConta(ctx, usuario);
        var catId = Guid.NewGuid();
        ctx.Categorias.Add(new Categoria
        {
            Id = catId, Descricao = "Mercado", Finalidade = Finalidade.Despesa, UsuarioId = usuario,
        });
        ctx.SaveChanges();
        var svc = CreateService(ctx);

        var preview = await svc.PreviewAsync(contaId, usuario, "e.ofx", OfxDuasLinhas);

        Assert.Equal(catId, preview.Linhas[0].CategoriaSugeridaId);
        Assert.Equal("Mercado", preview.Linhas[0].CategoriaSugeridaNome);
        Assert.Null(preview.Linhas[1].CategoriaSugeridaId); // "Salario" não casa
    }

    [Fact]
    public async Task ConfirmarAsync_CriaTransacoesNaConta()
    {
        var ctx = CreateContext();
        var usuario = Guid.NewGuid();
        var contaId = SeedConta(ctx, usuario);
        var svc = CreateService(ctx);

        var dto = new ConfirmarImportacaoDto(contaId, new List<LinhaImportarDto>
        {
            new(new DateTime(2026, 5, 10), "Mercado", 50m, TipoTransacao.Despesa, "FIT-1", null),
            new(new DateTime(2026, 5, 12), "Salario", 200m, TipoTransacao.Receita, "FIT-2", null),
        });

        var resultado = await svc.ConfirmarAsync(dto, usuario);

        Assert.Equal(2, resultado.Importadas);
        Assert.Equal(2, ctx.Transacoes.Count(t => t.ContaId == contaId));
        Assert.Equal("FIT-1", ctx.Transacoes.First(t => t.Descricao == "Mercado").ImportacaoFitId);
    }

    [Fact]
    public async Task ConfirmarAsync_SemLinhas_LancaArgument()
    {
        var ctx = CreateContext();
        var usuario = Guid.NewGuid();
        var contaId = SeedConta(ctx, usuario);
        var svc = CreateService(ctx);

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.ConfirmarAsync(
                new ConfirmarImportacaoDto(contaId, new List<LinhaImportarDto>()), usuario));
    }
}

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

    // ══ Pix no Crédito (dogfood 2026-10-09) ═════════════════════════════════════════════
    // O Nubank põe o valor na conta ("Valor adicionado… Pix no Crédito") e o Pix sai no mesmo dia. Importado
    // como receita + despesa comuns, inflava as receitas (R$ 3.503,25 no ano) e contava o gasto em dobro (o Pix
    // e, depois, o pagamento da fatura).

    private const string Adicionado =
        "Valor adicionado na conta por cartão de crédito - Valor adicionado para Pix no Crédito";

    private static string Stmt(string data, string valor, string fit, string memo) =>
        $"<STMTTRN><DTPOSTED>{data}000000[-3:BRT]<TRNAMT>{valor}<FITID>{fit}<MEMO>{memo}</STMTTRN>";

    // Trecho do extrato de abril/26 (valores reais; nomes trocados).
    private static readonly string OfxComPixNoCredito = string.Concat(
        Stmt("20260404", "-41.86", "F1", "Compra no débito - SUPERMERCADOS BH"),
        Stmt("20260406", "132.50", "F2", Adicionado),
        Stmt("20260406", "-132.50", "F3", "Transferência enviada pelo Pix - FULANO - •••.414.176-•• - BANCO"),
        Stmt("20260411", "132.50", "F4", Adicionado),
        Stmt("20260411", "-132.50", "F5", "Transferência enviada pelo Pix - FULANO - •••.414.176-•• - BANCO"),
        Stmt("20260411", "-132.50", "F6", "Transferência enviada pelo Pix - OUTRA PESSOA"), // mesmo dia e valor, sem par
        Stmt("20260418", "16.00", "F7", "Transferência recebida pelo Pix - CICLANA"));

    [Fact]
    public async Task PreviewAsync_PixNoCredito_MarcaAEntradaEOPixDoMesmoDiaEValor_SoUmPorEntrada()
    {
        var ctx = CreateContext();
        var usuario = Guid.NewGuid();
        var contaId = SeedConta(ctx, usuario);

        var preview = await CreateService(ctx).PreviewAsync(contaId, usuario, "nubank.ofx", OfxComPixNoCredito);

        Assert.Equal(new[] { false, true, true, true, true, false, false }, preview.Linhas.Select(l => l.PixNoCredito));
    }

    [Fact]
    public void PernasDePixNoCredito_PixAntesDaEntrada_TambemCasa_ESemPixAEntradaSegueMarcada()
    {
        var d = new DateOnly(2026, 3, 5);
        var linhas = new List<(DateOnly, decimal, TipoTransacao, string)>
        {
            (d, 314.80m, TipoTransacao.Despesa, "Transferência enviada pelo Pix - ESTADO DE MINAS GERAIS"),
            (d, 314.80m, TipoTransacao.Receita, Adicionado),
            (d, 29.99m, TipoTransacao.Receita, Adicionado),                                   // Pix não veio no arquivo
            (d, 29.99m, TipoTransacao.Despesa, "Compra no débito - KIWIFY"),                  // mesmo valor, mas não é Pix
            (d.AddDays(1), 29.99m, TipoTransacao.Despesa, "Transferência enviada pelo Pix - KIWIFY"), // outro dia
        };

        var marcadas = ImportacaoService.PernasDePixNoCredito(linhas);

        Assert.Equal(new[] { true, true, true, false, false }, marcadas);
    }

    [Theory]
    [InlineData("Transferência recebida pelo Pix - Valor adicionado")] // "valor adicionado" sem Pix no Crédito
    [InlineData("Pix no Crédito - estorno")]                            // Pix no Crédito sem "valor adicionado"
    public void PernasDePixNoCredito_SoAEntradaComOsDoisTextos(string descricao)
    {
        var d = new DateOnly(2026, 3, 5);
        var marcadas = ImportacaoService.PernasDePixNoCredito(new List<(DateOnly, decimal, TipoTransacao, string)>
        {
            (d, 50m, TipoTransacao.Receita, descricao),
            (d, 50m, TipoTransacao.Despesa, "Transferência enviada pelo Pix - X"),
        });

        Assert.Equal(new[] { false, false }, marcadas);
    }

    [Fact]
    public async Task ConfirmarAsync_PixNoCredito_DetectaNoServidor_SaldoIntacto_ForaDoEntrouSaiu()
    {
        var ctx = CreateContext();
        var usuario = Guid.NewGuid();
        var contaId = SeedConta(ctx, usuario);
        var svc = CreateService(ctx);
        var preview = await svc.PreviewAsync(contaId, usuario, "nubank.ofx", OfxComPixNoCredito);

        // A confirmação não leva a flag da prévia: o servidor detecta de novo pelas linhas.
        await svc.ConfirmarAsync(new ConfirmarImportacaoDto(contaId, preview.Linhas
            .Select(l => new LinhaImportarDto(l.Data, l.Descricao, l.Valor, l.Tipo, l.FitId, null))
            .ToList()), usuario);

        var marcadas = ctx.Transacoes.Where(t => t.EhPixNoCredito).Select(t => t.ImportacaoFitId).OrderBy(f => f).ToList();
        Assert.Equal(new[] { "F2", "F3", "F4", "F5" }, marcadas);

        var stats = await new TransacaoService(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx))
            .ObterStatsAsync(usuario);
        Assert.Equal(16.00m, stats.Entradas);              // só o Pix recebido de verdade
        Assert.Equal(41.86m + 132.50m, stats.Saidas);      // o mercado e o Pix sem par
        var saldo = ctx.Transacoes.Sum(t => t.Tipo == TipoTransacao.Receita ? t.Valor : -t.Valor);
        Assert.Equal(16.00m - 41.86m - 132.50m, saldo);    // as pernas do Pix no Crédito se anulam no saldo
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

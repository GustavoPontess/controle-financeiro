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

    // ══ "Pagamento de fatura" no extrato (decisão do Gustavo, 2026-10-12) ═══════════════════
    // Fatura no app → a linha vira o PAGAMENTO dela (fatura paga, limite volta, fora das despesas — o gasto já
    // está nas compras). Fatura que não está no app (histórico) → continua despesa, único registro do gasto.
    // Cartão como o Nubank: fecha dia 1, vence dia 8, ligado à conta.

    private sealed record Cenario(AppDbContext Ctx, Guid Usuario, Guid ContaId, Guid CartaoId, ImportacaoService Svc);

    private static TransacaoService TransacoesDe(AppDbContext ctx) =>
        new(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx));

    /// <summary>Compras no cartão: (dia da compra, valor) — cada uma cai na fatura do ciclo dela.</summary>
    private static async Task<Cenario> CenarioCartaoAsync(bool ligadoAConta = true, params (DateOnly Dia, decimal Valor)[] compras)
    {
        var ctx = CreateContext();
        var usuario = Guid.NewGuid();
        var contaId = SeedConta(ctx, usuario);
        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = "Nubank", TemCredito = true, Ativo = true, LimiteTotal = 12000,
            DiaFechamento = 1, DiaVencimento = 8, CriadoPor = usuario, ContaId = ligadoAConta ? contaId : null,
        };
        ctx.CartoesCredito.Add(cartao);
        await ctx.SaveChangesAsync();
        foreach (var (dia, valor) in compras)
            await TransacoesDe(ctx).CriarTransacaoAsync(new Transacao
            {
                Id = Guid.NewGuid(), Descricao = "Compras", Valor = valor, Tipo = TipoTransacao.Despesa,
                CartaoCreditoId = cartao.Id, UsadoComoCredito = true, Data = dia,
                StatusTransacao = StatusTransacao.Executado,
            }, usuario);
        return new Cenario(ctx, usuario, contaId, cartao.Id, CreateService(ctx));
    }

    // Compra de 20/10 → fatura que fecha 01/11 e vence 08/11 ("Novembro" na tela Cartões).
    private static Task<Cenario> CenarioNovembroAsync(bool ligadoAConta = true) =>
        CenarioCartaoAsync(ligadoAConta, (new DateOnly(2025, 10, 20), 2239.87m));

    private static async Task ImportarTudoAsync(Cenario c, PreviewImportacaoDto preview) =>
        await c.Svc.ConfirmarAsync(new ConfirmarImportacaoDto(c.ContaId, preview.Linhas
            .Select(l => new LinhaImportarDto(l.Data, l.Descricao, l.Valor, l.Tipo, l.FitId, l.CategoriaSugeridaId))
            .ToList()), c.Usuario);

    private static Task<Fatura> FaturaQueFechaEm(Cenario c, DateTime fechamento) =>
        c.Ctx.Faturas.SingleAsync(f => f.CartaoCreditoId == c.CartaoId && f.DataFechamento == fechamento);

    [Fact]
    public async Task PagamentoDeFatura_FaturaNoApp_ViraOPagamentoDela_EOGastoContaUmaVezSo()
    {
        var c = await CenarioNovembroAsync();
        var ofx = Stmt("20251109", "-2239.87", "PG-NOV", "Pagamento de fatura")
                  + Stmt("20251110", "-30.00", "M1", "Compra no débito - MERCADO");

        var preview = await c.Svc.PreviewAsync(c.ContaId, c.Usuario, "nu.ofx", ofx);
        Assert.Equal(new DateTime(2025, 11, 1), preview.Linhas[0].PagaFaturaFechamento);
        Assert.Null(preview.Linhas[1].PagaFaturaFechamento);

        await ImportarTudoAsync(c, preview);

        var fatura = await FaturaQueFechaEm(c, new DateTime(2025, 11, 1));
        Assert.Equal(2239.87m, fatura.ValorPago);
        Assert.Equal(EstadoPagamentoFatura.Pago, fatura.EstadoPagamento);
        var pagamento = await c.Ctx.Transacoes.SingleAsync(t => t.EhPagamentoFatura);
        Assert.Equal((c.ContaId, fatura.Id, "PG-NOV", 2239.87m, new DateOnly(2025, 11, 9)),
            (pagamento.ContaId!.Value, pagamento.FaturaPagaId!.Value, pagamento.ImportacaoFitId, pagamento.Valor, pagamento.Data));
        // Saiu: a compra do cartão + o mercado. Antes o pagamento entrava de novo (4.509,74).
        Assert.Equal(2269.87m, (await TransacoesDe(c.Ctx).ObterStatsAsync(c.Usuario)).Saidas);
        // O dinheiro saiu da conta do mesmo jeito.
        var saldo = c.Ctx.Transacoes.Where(t => t.ContaId == c.ContaId).Sum(t => t.Tipo == TipoTransacao.Receita ? t.Valor : -t.Valor);
        Assert.Equal(-2269.87m, saldo);
    }

    [Fact]
    public async Task PagamentoDeFatura_DeFaturaQueNaoEstaNoApp_ContinuaDespesa()
    {
        // 07/10: paga a fatura que fechou 01/10 e vence 08/10 — de antes do app. A de novembro (no app) não é dela.
        var c = await CenarioNovembroAsync();

        var preview = await c.Svc.PreviewAsync(c.ContaId, c.Usuario, "nu.ofx", Stmt("20251007", "-696.87", "PG-OUT", "Pagamento de fatura"));
        Assert.Null(preview.Linhas.Single().PagaFaturaFechamento);

        await ImportarTudoAsync(c, preview);

        Assert.Equal(0m, (await FaturaQueFechaEm(c, new DateTime(2025, 11, 1))).ValorPago);
        var linha = await c.Ctx.Transacoes.SingleAsync(t => t.ImportacaoFitId == "PG-OUT");
        Assert.False(linha.EhPagamentoFatura);
        Assert.Equal(TipoTransacao.Despesa, linha.Tipo);
    }

    [Fact]
    public async Task PagamentoDeFatura_DepoisDoVencimentoDaAnterior_AdiantaAFaturaAberta()
    {
        var c = await CenarioNovembroAsync();

        var preview = await c.Svc.PreviewAsync(c.ContaId, c.Usuario, "nu.ofx", Stmt("20251020", "-500.00", "ADI", "Pagamento de fatura"));
        Assert.Equal(new DateTime(2025, 11, 1), preview.Linhas.Single().PagaFaturaFechamento);

        await ImportarTudoAsync(c, preview);

        var fatura = await FaturaQueFechaEm(c, new DateTime(2025, 11, 1));
        Assert.Equal(500m, fatura.ValorPago);
        Assert.Equal(EstadoPagamentoFatura.Parcial, fatura.EstadoPagamento);
    }

    [Fact]
    public async Task PagamentoDeFatura_MaiorQueORestante_OuCartaoSemConta_ContinuaDespesa()
    {
        var maior = await CenarioNovembroAsync();
        var previewMaior = await maior.Svc.PreviewAsync(maior.ContaId, maior.Usuario, "nu.ofx", Stmt("20251109", "-3000.00", "PG", "Pagamento de fatura"));
        Assert.Null(previewMaior.Linhas.Single().PagaFaturaFechamento);

        var semConta = await CenarioNovembroAsync(ligadoAConta: false);
        var previewSemConta = await semConta.Svc.PreviewAsync(semConta.ContaId, semConta.Usuario, "nu.ofx", Stmt("20251109", "-2239.87", "PG", "Pagamento de fatura"));
        Assert.Null(previewSemConta.Linhas.Single().PagaFaturaFechamento);
    }

    [Fact]
    public async Task PagamentoDeFatura_ConfirmarDeNovo_NaoPagaDuasVezes()
    {
        var c = await CenarioNovembroAsync();
        var preview = await c.Svc.PreviewAsync(c.ContaId, c.Usuario, "nu.ofx", Stmt("20251020", "-500.00", "ADI", "Pagamento de fatura"));

        await ImportarTudoAsync(c, preview);
        await ImportarTudoAsync(c, preview); // retry / mesmo arquivo de novo

        Assert.Equal(500m, (await FaturaQueFechaEm(c, new DateTime(2025, 11, 1))).ValorPago);
        Assert.Single(c.Ctx.Transacoes.Where(t => t.EhPagamentoFatura));
        // E a prévia seguinte já mostra como duplicada (FITID gravado no pagamento).
        var deNovo = await c.Svc.PreviewAsync(c.ContaId, c.Usuario, "nu.ofx", Stmt("20251020", "-500.00", "ADI", "Pagamento de fatura"));
        Assert.True(deNovo.Linhas.Single().Duplicada);
    }

    [Fact]
    public async Task PagamentoDeFatura_JaPagoPelaTela_PreviaMarcaComoDuplicado()
    {
        var c = await CenarioNovembroAsync();
        var fatura = await FaturaQueFechaEm(c, new DateTime(2025, 11, 1));
        await new FaturaService(c.Ctx).PagarFaturaAsync(fatura.Id, new DTOs.Fatura.PagarFaturaDto
        {
            ContaId = c.ContaId, Valor = 2239.87m, DataPagamento = new DateTime(2025, 11, 8),
        }, c.Usuario, Guid.NewGuid().ToString());

        var preview = await c.Svc.PreviewAsync(c.ContaId, c.Usuario, "nu.ofx", Stmt("20251109", "-2239.87", "PG", "Pagamento de fatura"));

        Assert.True(preview.Linhas.Single().Duplicada);
    }

    [Fact]
    public async Task PagamentoDeFatura_DoisNoMesmoArquivo_AbateDaFechadaMaisAntigaPraFrente()
    {
        // Novembro (100) e dezembro (200) fechadas e sem pagamento; em 09/12 paga 100 e em 10/12 paga 200.
        var c = await CenarioCartaoAsync(true, (new DateOnly(2025, 10, 20), 100m), (new DateOnly(2025, 11, 20), 200m));
        var ofx = Stmt("20251209", "-100.00", "P1", "Pagamento de fatura") + Stmt("20251210", "-200.00", "P2", "Pagamento de fatura");

        var preview = await c.Svc.PreviewAsync(c.ContaId, c.Usuario, "nu.ofx", ofx);
        Assert.Equal(new DateTime?[] { new DateTime(2025, 11, 1), new DateTime(2025, 12, 1) },
            preview.Linhas.Select(l => l.PagaFaturaFechamento));

        await ImportarTudoAsync(c, preview);

        Assert.Equal(100m, (await FaturaQueFechaEm(c, new DateTime(2025, 11, 1))).ValorPago);
        Assert.Equal(200m, (await FaturaQueFechaEm(c, new DateTime(2025, 12, 1))).ValorPago);
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

    // ── CSV mapeado + confirmar seguro (2026-10-16) ──

    private const string CsvEstranho = "Dia;Texto;X;Y\n05/05/2026;Salário;3500,00;\n06/05/2026;Aluguel;;1800,00\n";
    private static readonly MapeamentoCsvDto MapaEstranho = new(0, 1, null, 2, 3, null, false);

    [Fact]
    public async Task PreviewAsync_CsvNaoReconhecido_VoltaPrecisaMapear_ComColunasEAmostra()
    {
        var ctx = CreateContext();
        var usuario = Guid.NewGuid();
        var contaId = SeedConta(ctx, usuario);

        var preview = await CreateService(ctx).PreviewAsync(contaId, usuario, "banco.csv", CsvEstranho);

        Assert.True(preview.PrecisaMapear);
        Assert.Empty(preview.Linhas);
        Assert.Equal("csv", preview.Formato);
        Assert.Equal(new[] { "Dia", "Texto", "X", "Y" }, preview.Colunas);
        Assert.Equal(2, preview.Amostra!.Count);
        Assert.Equal("dia|texto|x|y", preview.Assinatura);
    }

    [Fact]
    public async Task ConfirmarAsync_ComMapeamento_LembraPraConta_EAProximaPreviaJaVemLida()
    {
        var ctx = CreateContext();
        var usuario = Guid.NewGuid();
        var contaId = SeedConta(ctx, usuario);
        var svc = CreateService(ctx);

        var preview = await svc.PreviewAsync(contaId, usuario, "banco.csv", CsvEstranho, MapaEstranho);
        Assert.False(preview.PrecisaMapear);
        Assert.Equal(2, preview.Linhas.Count);

        await svc.ConfirmarAsync(new ConfirmarImportacaoDto(contaId,
            preview.Linhas.Select(l => new LinhaImportarDto(l.Data, l.Descricao, l.Valor, l.Tipo, l.FitId, null)).ToList(),
            MapaEstranho, preview.Assinatura), usuario, "chave-1");

        var modelo = await ctx.ModelosImportacao.SingleAsync();
        Assert.Equal((contaId, "dia|texto|x|y", 2, 3), (modelo.ContaId, modelo.Assinatura, modelo.ColunaEntrada!.Value, modelo.ColunaSaida!.Value));

        var proxima = await svc.PreviewAsync(contaId, usuario, "banco.csv", CsvEstranho);
        Assert.False(proxima.PrecisaMapear);
        Assert.True(proxima.MapeamentoLembrado);
        Assert.All(proxima.Linhas, l => Assert.True(l.Duplicada)); // já entraram
    }

    [Fact]
    public async Task ConfirmarAsync_MesmaChaveDuasVezes_NaoImportaDeNovo()
    {
        var ctx = CreateContext();
        var usuario = Guid.NewGuid();
        var contaId = SeedConta(ctx, usuario);
        var svc = CreateService(ctx);
        var dto = new ConfirmarImportacaoDto(contaId, new List<LinhaImportarDto>
        {
            new(new DateTime(2026, 5, 10), "Mercado", 50m, TipoTransacao.Despesa, null, null),
        });

        var primeira = await svc.ConfirmarAsync(dto, usuario, "chave-x");
        var segunda = await svc.ConfirmarAsync(dto, usuario, "chave-x");

        Assert.Equal((1, false), (primeira.Importadas, primeira.Repetido));
        Assert.Equal((0, true), (segunda.Importadas, segunda.Repetido));
        Assert.Equal(1, ctx.Transacoes.Count(t => t.ContaId == contaId));
    }

    [Fact]
    public async Task ConfirmarAsync_FitIdQueJaEstaNaConta_OuRepetidoNoEnvio_EhPuladoNoServidor()
    {
        var ctx = CreateContext();
        var usuario = Guid.NewGuid();
        var contaId = SeedConta(ctx, usuario);
        SeedTransacao(ctx, contaId, 50m, new DateTime(2026, 5, 10), "Mercado", TipoTransacao.Despesa, "FIT-1");
        var svc = CreateService(ctx);

        var resultado = await svc.ConfirmarAsync(new ConfirmarImportacaoDto(contaId, new List<LinhaImportarDto>
        {
            new(new DateTime(2026, 5, 10), "Mercado", 50m, TipoTransacao.Despesa, "FIT-1", null),
            new(new DateTime(2026, 5, 12), "Salario", 200m, TipoTransacao.Receita, "FIT-2", null),
            new(new DateTime(2026, 5, 12), "Salario", 200m, TipoTransacao.Receita, "FIT-2", null),
        }), usuario, "chave-y");

        Assert.Equal((1, 2), (resultado.Importadas, resultado.JaExistiam));
        Assert.Equal(2, ctx.Transacoes.Count(t => t.ContaId == contaId));
    }

    [Fact]
    public async Task ConfirmarAsync_MaisLinhasQueOTeto_Recusa()
    {
        var ctx = CreateContext();
        var usuario = Guid.NewGuid();
        var contaId = SeedConta(ctx, usuario);
        var linhas = Enumerable.Range(0, ImportacaoService.MaxLinhasPorConfirmacao + 1)
            .Select(i => new LinhaImportarDto(new DateTime(2026, 5, 10), $"L{i}", 1m, TipoTransacao.Despesa, null, null)).ToList();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            CreateService(ctx).ConfirmarAsync(new ConfirmarImportacaoDto(contaId, linhas), usuario, "chave-z"));
        Assert.Equal(0, ctx.Transacoes.Count());
    }
}

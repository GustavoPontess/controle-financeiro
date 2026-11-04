using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Importacao;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;
using static ControleFinanceiro.Api.Services.ImportacaoService;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// O que o sinal do extrato não diz (P2, achado 2026-10-12 no extrato real da Nubank): Pix entre contas do próprio
/// titular, empréstimo e aplicação/resgate entravam como receita/despesa. Não são ganho nem gasto.
/// </summary>
public class ImportacaoNaturezaTests
{
    private const string Titular = "Gustavo Nunes Pontes";

    [Theory]
    [InlineData("Transferência recebida pelo Pix - GUSTAVO NUNES PONTES - •••.123.456-•• - ITAÚ UNIBANCO", NaturezaExtrato.EntreSuasContas)]
    [InlineData("Transferência enviada pelo Pix - Gustavo Nunes Pontes - BANCO INTER", NaturezaExtrato.EntreSuasContas)]
    [InlineData("TED recebida GUSTAVO N PONTES", NaturezaExtrato.Comum)] // nome incompleto: não arrisca
    [InlineData("Transferência enviada pelo Pix - MARIA SILVA - •••.414.176-••", NaturezaExtrato.Comum)]
    [InlineData("Depósito de empréstimo", NaturezaExtrato.Emprestimo)]
    [InlineData("Resgate de empréstimo", NaturezaExtrato.Emprestimo)] // empréstimo antes de "resgate"
    [InlineData("Resgate RDB", NaturezaExtrato.Investimento)]
    [InlineData("Aplicação RDB", NaturezaExtrato.Investimento)]
    [InlineData("Dinheiro guardado na Caixinha", NaturezaExtrato.Investimento)]
    [InlineData("Compra no débito - SUPERMERCADOS BH", NaturezaExtrato.Comum)]
    public void NaturezaDaLinha_PelaDescricaoENomeDoTitular(string descricao, NaturezaExtrato esperada) =>
        Assert.Equal(esperada, NaturezaDaLinha(descricao, Titular));

    [Fact]
    public void NaturezaDaLinha_NomeDeUmaPalavraSo_NaoBastaPraDizerQueEhEntreContas() =>
        Assert.Equal(NaturezaExtrato.Comum, NaturezaDaLinha("Transferência recebida pelo Pix - GUSTAVO", "Gustavo"));

    // ── Prévia e confirmação ──────────────────────────────────────────────────────────────────

    private sealed record Cenario(AppDbContext Ctx, Guid Usuario, Guid Nubank, Guid Itau, Guid RendaFixa, ImportacaoService Svc);

    private static Cenario Montar()
    {
        var ctx = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning)).Options);
        var usuario = new Usuario { Id = Guid.NewGuid(), Email = "g@x.com", Nome = Titular, PasswordHash = "x" };
        var nubank = new Conta { Id = Guid.NewGuid(), Nome = "Nubank", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuario.Id };
        var itau = new Conta { Id = Guid.NewGuid(), Nome = "Itaú", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuario.Id };
        var rendaFixa = new Categoria { Id = Guid.NewGuid(), Descricao = "Renda fixa", Finalidade = Finalidade.Investimento };
        ctx.AddRange(usuario, nubank, itau, rendaFixa);
        ctx.SaveChanges();
        var svc = new ImportacaoService(ctx, new ExtratoImportService(), new TransacaoService(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx)));
        return new Cenario(ctx, usuario.Id, nubank.Id, itau.Id, rendaFixa.Id, svc);
    }

    private static string Stmt(string data, string valor, string fit, string memo) =>
        $"<STMTTRN><DTPOSTED>{data}000000[-3:BRT]<TRNAMT>{valor}<FITID>{fit}<MEMO>{memo}</STMTTRN>";

    private static readonly string Extrato = string.Concat(
        Stmt("20261005", "500.00", "N1", "Transferência recebida pelo Pix - GUSTAVO NUNES PONTES - ITAÚ"),
        Stmt("20261006", "2610.00", "N2", "Depósito de empréstimo"),
        Stmt("20261007", "300.00", "N3", "Resgate RDB"),
        Stmt("20261008", "-50.00", "N4", "Compra no débito - MERCADO"),
        Stmt("20261009", "800.00", "N5", "Transferência recebida pelo Pix - GUSTAVO NUNES PONTES - INTER")); // conta fora do app

    private static async Task Importar(Cenario c, PreviewImportacaoDto previa) =>
        await c.Svc.ConfirmarAsync(new ConfirmarImportacaoDto(c.Nubank, previa.Linhas
            .Select(l => new LinhaImportarDto(l.Data, l.Descricao, l.Valor, l.Tipo, l.FitId, l.CategoriaSugeridaId)).ToList()), c.Usuario);

    [Fact]
    public async Task Previa_MarcaANatureza_DizComQuemJunta_ESugereCategoriaDeInvestimento()
    {
        var c = Montar();
        c.Ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "PIX ENVIADO GUSTAVO", Valor = 500m, Tipo = TipoTransacao.Despesa, ContaId = c.Itau,
            CriadoPor = c.Usuario, Data = new DateOnly(2026, 10, 4), StatusTransacao = StatusTransacao.Executado,
        });
        c.Ctx.SaveChanges();

        var previa = await c.Svc.PreviewAsync(c.Nubank, c.Usuario, "nubank.ofx", Extrato);

        Assert.Equal(new[] { "entre-contas", "emprestimo", "investimento", null, "entre-contas" }, previa.Linhas.Select(l => l.Natureza));
        Assert.Equal(new[] { "Itaú", null, null, null, null }, previa.Linhas.Select(l => l.JuntaComConta));
        Assert.Equal(c.RendaFixa, previa.Linhas[2].CategoriaSugeridaId);
        Assert.Null(previa.Linhas[0].CategoriaSugeridaId);
        Assert.Null(previa.Linhas[1].CategoriaSugeridaId);
    }

    [Fact]
    public async Task Confirmar_JuntaAsPernasNumaTransferencia_ENadaDissoEntraComoRendaOuGasto()
    {
        var c = Montar();
        var pernaNoItau = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "PIX ENVIADO GUSTAVO", Valor = 500m, Tipo = TipoTransacao.Despesa, ContaId = c.Itau,
            CriadoPor = c.Usuario, Data = new DateOnly(2026, 10, 4), StatusTransacao = StatusTransacao.Executado,
        };
        c.Ctx.Transacoes.Add(pernaNoItau);
        c.Ctx.SaveChanges();

        await Importar(c, await c.Svc.PreviewAsync(c.Nubank, c.Usuario, "nubank.ofx", Extrato));
        c.Ctx.ChangeTracker.Clear();

        var transferencia = await c.Ctx.Transferencias.SingleAsync();
        var recebida = await c.Ctx.Transacoes.SingleAsync(t => t.ImportacaoFitId == "N1");
        Assert.Equal((c.Itau, c.Nubank, pernaNoItau.Id, recebida.Id),
            (transferencia.ContaOrigemId, transferencia.ContaDestinoId, transferencia.TransacaoOrigemId, transferencia.TransacaoDestinoId));
        Assert.True((await c.Ctx.Transacoes.SingleAsync(t => t.Id == pernaNoItau.Id)).EhTransferencia);
        Assert.True((await c.Ctx.Transacoes.SingleAsync(t => t.ImportacaoFitId == "N5")).EhTransferencia); // solta, conta fora do app
        Assert.True((await c.Ctx.Transacoes.SingleAsync(t => t.ImportacaoFitId == "N2")).EhEmprestimo);
        Assert.True((await c.Ctx.Transacoes.SingleAsync(t => t.ImportacaoFitId == "N3")).EhInvestimento);
        Assert.Single(await c.Ctx.FinancialEventLogs.Where(e => e.Tipo == FinancialEventType.TransferenciaCriada)
            .Select(e => e.CorrelationId).Distinct().ToListAsync());

        var stats = await new TransacaoService(c.Ctx, new FaturaService(c.Ctx), new FinancialEventLogService(c.Ctx)).ObterStatsAsync(c.Usuario);
        Assert.Equal((0m, 50m), (stats.Entradas, stats.Saidas)); // só o mercado é gasto; nada disso é renda
        var saldoNubank = (await RegrasFinanceiras.SaldoDaContaAsync(c.Ctx, c.Nubank, c.Usuario)).Saldo;
        Assert.Equal(500m + 2610m + 300m - 50m + 800m, saldoNubank); // o saldo continua com tudo
    }

    // Achado 2026-11-03 (Nubank e Inter do Gustavo pela tela): a perna que entrou SOLTA no primeiro extrato (a outra conta
    // ainda não tinha lançamento) era ignorada no segundo, e as duas ficavam soltas pra sempre.
    [Fact]
    public async Task Confirmar_SegundoExtrato_JuntaComAPernaQueEntrouSoltaNoPrimeiro()
    {
        var c = Montar();
        // 1º extrato, Nubank: o Pix vindo do Itaú entra solto (o Itaú ainda não tem nada).
        await Importar(c, await c.Svc.PreviewAsync(c.Nubank, c.Usuario, "nubank.ofx",
            Stmt("20261005", "500.00", "N1", "Transferência recebida pelo Pix - GUSTAVO NUNES PONTES - ITAÚ")));
        Assert.Empty(c.Ctx.Transferencias);

        // 2º extrato, Itaú: a saída do mesmo Pix acha a perna solta.
        var previa = await c.Svc.PreviewAsync(c.Itau, c.Usuario, "itau.ofx",
            Stmt("20261005", "-500.00", "I1", "Pix enviado: Gustavo Nunes Pontes"));
        Assert.Equal("Nubank", previa.Linhas.Single().JuntaComConta);
        await c.Svc.ConfirmarAsync(new ConfirmarImportacaoDto(c.Itau, previa.Linhas
            .Select(l => new LinhaImportarDto(l.Data, l.Descricao, l.Valor, l.Tipo, l.FitId, l.CategoriaSugeridaId)).ToList()), c.Usuario);
        c.Ctx.ChangeTracker.Clear();

        var transferencia = await c.Ctx.Transferencias.SingleAsync();
        var entrada = await c.Ctx.Transacoes.SingleAsync(t => t.ImportacaoFitId == "N1");
        var saida = await c.Ctx.Transacoes.SingleAsync(t => t.ImportacaoFitId == "I1");
        Assert.Equal((c.Itau, c.Nubank, saida.Id, entrada.Id),
            (transferencia.ContaOrigemId, transferencia.ContaDestinoId, transferencia.TransacaoOrigemId, transferencia.TransacaoDestinoId));

        // 3º extrato com outro Pix igual: a perna já ligada não serve de par de novo.
        var outra = await c.Svc.PreviewAsync(c.Itau, c.Usuario, "itau2.ofx",
            Stmt("20261006", "-500.00", "I2", "Pix enviado: Gustavo Nunes Pontes"));
        Assert.Null(outra.Linhas.Single().JuntaComConta);
    }
}

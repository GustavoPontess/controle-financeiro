using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Importar a fatura do cartão (docs/features/cartao-credito/fatura-a-detalhar.md, passo 3). Cartão como o Nubank:
/// fecha dia 1, vence dia 8; "hoje" = 22/11/2026.
/// </summary>
public class ImportacaoCartaoTests
{
    private static readonly DateTime Agora = new(2026, 11, 22, 15, 0, 0, DateTimeKind.Utc);

    // Fatura de novembro (compras de outubro) e de dezembro (compras de novembro), no formato do CSV do Nubank.
    private const string FaturaNovembro = """
        date,title,amount
        2026-10-05,Padaria Pao Bom,25.50
        2026-10-10,Loja Movel - 1/3,100.00
        2026-10-15,Mercado Bom Preco,200.00
        2026-10-06,Pagamento recebido,-500.00
        """;
    private const string FaturaDezembro = """
        date,title,amount
        2026-11-01,Loja Movel - 2/3,100.00
        2026-11-03,Padaria Pao Bom,30.00
        2026-11-03,Padaria Pao Bom,30.00
        2026-11-09,Pagamento recebido,-325.50
        2026-11-12,Estorno Loja,-20.00
        """;

    private static readonly IReadOnlyList<(string, string)> Arquivos =
        [("Nubank_2026-11-08.csv", FaturaNovembro), ("Nubank_2026-12-08.csv", FaturaDezembro)];

    private sealed record Cenario(AppDbContext Ctx, ImportacaoCartaoService Servico, Guid U, Guid ContaId, Guid CartaoId);

    private static Cenario Build()
    {
        var ctx = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);
        var u = Guid.NewGuid();
        ctx.Usuarios.Add(new Usuario { Id = u, Email = $"{u:N}@test.com", Nome = "Eu", PasswordHash = "x" });
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Nubank", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = u };
        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = "Nubank", TemCredito = true, LimiteTotal = 100, // limite baixo: a fatura já aconteceu
            DiaFechamento = 1, DiaVencimento = 8, CriadoPor = u, Ativo = true, ContaId = conta.Id,
        };
        ctx.Contas.Add(conta);
        ctx.CartoesCredito.Add(cartao);
        ctx.SaveChanges();
        var log = new FinancialEventLogService(ctx);
        var transacoes = new TransacaoService(ctx, new FaturaService(ctx), log);
        var leitor = new ExtratoImportService();
        var servico = new ImportacaoCartaoService(ctx, leitor, transacoes, new ImportacaoService(ctx, leitor, transacoes), log);
        return new Cenario(ctx, servico, u, conta.Id, cartao.Id);
    }

    /// <summary>O "Pagamento de fatura" que veio do extrato da conta, sem fatura no app.</summary>
    private static Guid PagamentoDaConta(Cenario c, DateOnly dia, decimal valor)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Pagamento de fatura", Valor = valor, Tipo = TipoTransacao.Despesa,
            ContaId = c.ContaId, EhPagamentoFatura = true, CriadoPor = c.U, Data = dia,
            StatusTransacao = StatusTransacao.Executado, Ativo = true, CriadoEm = dia.ToDateTime(TimeOnly.MinValue),
        };
        c.Ctx.Transacoes.Add(t);
        c.Ctx.SaveChanges();
        return t.Id;
    }

    [Fact]
    public async Task Previa_ContaComprasParcelamentoEFaturas_SemGravar()
    {
        using var _ = HorarioBrasil.FixarParaTeste(Agora);
        var c = Build();
        PagamentoDaConta(c, new DateOnly(2026, 11, 9), 325.50m);

        var p = await c.Servico.PreviewAsync(c.CartaoId, c.U, Arquivos);

        Assert.Equal(4, p.Compras); // as duas padarias iguais do mesmo dia são duas compras
        Assert.Equal(1, p.Parcelamentos);
        Assert.Equal(2, p.Pagamentos);
        Assert.Equal(1, p.Creditos);
        Assert.Equal(0, p.JaNoApp);
        Assert.Equal(3, p.Faturas.Count);
        Assert.Equal(("paga-pela-conta", 325.50m, 325.50m), (p.Faturas[0].Situacao, p.Faturas[0].Compras, p.Faturas[0].PagoPelaConta));
        Assert.Equal(new DateOnly(2026, 11, 8), p.Faturas[0].Vencimento);
        Assert.Equal(("a-pagar", 160m), (p.Faturas[1].Situacao, p.Faturas[1].Compras));
        Assert.Equal(("a-pagar", 100m, new DateOnly(2027, 1, 8)), (p.Faturas[2].Situacao, p.Faturas[2].Compras, p.Faturas[2].Vencimento));
        Assert.Empty(c.Ctx.Transacoes.Where(t => t.CartaoCreditoId == c.CartaoId));
    }

    [Fact]
    public async Task Importar_CriaComprasUmParcelamentoELigaOPagamentoDaConta()
    {
        using var _ = HorarioBrasil.FixarParaTeste(Agora);
        var c = Build();
        var outubro = PagamentoDaConta(c, new DateOnly(2026, 10, 6), 500m); // pagou a fatura de outubro, que não veio
        var novembro = PagamentoDaConta(c, new DateOnly(2026, 11, 9), 325.50m);

        var r = await c.Servico.ImportarAsync(c.CartaoId, c.U, Arquivos, "chave-1");

        Assert.Equal((4, 1, 1, 0), (r.Compras, r.Parcelamentos, r.PagamentosLigados, r.FaturasPagas));
        Assert.Equal(5, r.SemCategoria); // nada conhecido: vai tudo pra Pendentes

        var compras = c.Ctx.Transacoes.Where(t => t.CartaoCreditoId == c.CartaoId).ToList();
        Assert.All(compras, t => Assert.True(t.UsadoComoCredito && t.FaturaId != null && t.Tipo == TipoTransacao.Despesa));
        Assert.DoesNotContain(compras, t => t.Descricao.Contains("/3")); // parcela nunca vira lançamento solto

        var parcelamento = Assert.Single(c.Ctx.Parcelamentos);
        Assert.Equal(("Loja Movel", 3, 300m, new DateTime(2026, 10, 10)),
            (parcelamento.Descricao, parcelamento.QuantidadeParcelas, parcelamento.ValorTotal, parcelamento.DataCompra));
        var parcelas = c.Ctx.ParcelasTransacao.OrderBy(p => p.Numero).ToList();
        Assert.Equal([1, 2, 3], parcelas.Select(p => p.Numero));
        Assert.Equal(new DateTime(2027, 1, 8), parcelas[2].DataVencimento);

        // O pagamento de novembro quitou a fatura de novembro; o de outubro segue "a detalhar" (a fatura dele não veio).
        var faturaNov = c.Ctx.Faturas.Single(f => f.DataVencimento == new DateTime(2026, 11, 8));
        Assert.Equal((325.50m, EstadoPagamentoFatura.Pago, EstadoCicloFatura.Fechada),
            (faturaNov.ValorPago, faturaNov.EstadoPagamento, faturaNov.EstadoCiclo));
        Assert.Equal(faturaNov.Id, c.Ctx.Transacoes.Single(t => t.Id == novembro).FaturaPagaId);
        Assert.Null(c.Ctx.Transacoes.Single(t => t.Id == outubro).FaturaPagaId);
        var dezembro = c.Ctx.Faturas.Single(f => f.DataVencimento == new DateTime(2026, 12, 8));
        Assert.Equal(EstadoPagamentoFatura.NaoPago, dezembro.EstadoPagamento);

        // Relatório: novembro não conta o pagamento duas vezes (as compras estão no app); outubro segue com os 500.
        var aDetalharNov = (await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(c.Ctx, c.U, 2026, 11))
            .GetValueOrDefault(RegrasFinanceiras.CartaoADetalhar).Gasto;
        var aDetalharOut = (await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(c.Ctx, c.U, 2026, 10))
            .GetValueOrDefault(RegrasFinanceiras.CartaoADetalhar).Gasto;
        Assert.Equal((0m, 500m), (aDetalharNov, aDetalharOut));
    }

    [Fact]
    public async Task FaturaVencidaSemPagamentoNaConta_FicaPagaForaDoApp()
    {
        using var _ = HorarioBrasil.FixarParaTeste(Agora);
        var c = Build();

        var r = await c.Servico.ImportarAsync(c.CartaoId, c.U, Arquivos, "chave-1");

        Assert.Equal((0, 1), (r.PagamentosLigados, r.FaturasPagas));
        var faturaNov = c.Ctx.Faturas.Single(f => f.DataVencimento == new DateTime(2026, 11, 8));
        Assert.Equal((325.50m, EstadoPagamentoFatura.Pago), (faturaNov.ValorPago, faturaNov.EstadoPagamento));
        Assert.Contains(c.Ctx.FinancialEventLogs, e => e.EntidadeId == faturaNov.Id && e.Tipo == FinancialEventType.FaturaPagaTotal);
    }

    [Fact]
    public async Task MesmaChave_NaoGravaDeNovo_OutraChave_NaoDuplica()
    {
        using var _ = HorarioBrasil.FixarParaTeste(Agora);
        var c = Build();
        await c.Servico.ImportarAsync(c.CartaoId, c.U, Arquivos, "chave-1");

        var repetido = await c.Servico.ImportarAsync(c.CartaoId, c.U, Arquivos, "chave-1");
        var deNovo = await c.Servico.ImportarAsync(c.CartaoId, c.U, Arquivos, "chave-2");

        Assert.True(repetido.Repetido);
        Assert.Equal((0, 0, 6), (deNovo.Compras, deNovo.Parcelamentos, deNovo.JaNoApp));
        Assert.Equal(4, c.Ctx.Transacoes.Count(t => t.CartaoCreditoId == c.CartaoId));
        Assert.Single(c.Ctx.Parcelamentos);
    }

    [Fact]
    public async Task CartaoDeOutraPessoa_NaoEncontrado()
    {
        using var _ = HorarioBrasil.FixarParaTeste(Agora);
        var c = Build();

        await Assert.ThrowsAsync<KeyNotFoundException>(() => c.Servico.PreviewAsync(c.CartaoId, Guid.NewGuid(), Arquivos));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => c.Servico.ImportarAsync(c.CartaoId, Guid.NewGuid(), Arquivos, "k"));
    }

    [Fact]
    public async Task SemChave_Recusa()
    {
        var c = Build();
        await Assert.ThrowsAsync<ArgumentException>(() => c.Servico.ImportarAsync(c.CartaoId, c.U, Arquivos, null));
    }

    [Fact]
    public async Task PagamentoAdiantado_AntesDoFechamento_QuitaAFaturaAberta()
    {
        using var _ = HorarioBrasil.FixarParaTeste(Agora);
        var c = Build();
        var outubro = PagamentoDaConta(c, new DateOnly(2026, 10, 6), 500m); // fatura de outubro, que não veio
        var adiantado1 = PagamentoDaConta(c, new DateOnly(2026, 10, 20), 300m);
        var adiantado2 = PagamentoDaConta(c, new DateOnly(2026, 10, 28), 25.50m);

        var r = await c.Servico.ImportarAsync(c.CartaoId, c.U, Arquivos, "k");

        Assert.Equal(2, r.PagamentosLigados);
        var faturaNov = c.Ctx.Faturas.Single(f => f.DataVencimento == new DateTime(2026, 11, 8));
        Assert.Equal((325.50m, EstadoPagamentoFatura.Pago), (faturaNov.ValorPago, faturaNov.EstadoPagamento));
        Assert.Equal(faturaNov.Id, c.Ctx.Transacoes.Single(t => t.Id == adiantado1).FaturaPagaId);
        Assert.Equal(faturaNov.Id, c.Ctx.Transacoes.Single(t => t.Id == adiantado2).FaturaPagaId);
        Assert.Null(c.Ctx.Transacoes.Single(t => t.Id == outubro).FaturaPagaId);
    }

    [Fact]
    public async Task PixNoCredito_EntraNaFaturaForaDoGastoSemCategoriaENaoViraParcelamento()
    {
        using var _ = HorarioBrasil.FixarParaTeste(Agora);
        var c = Build();
        const string fatura = """
            date,title,amount
            2026-11-02,Pix no Crédito - Fulano,80.00
            2026-11-03,Pix no Crédito - Ciclano - 2/2,50.00
            2026-11-04,Padaria Pao Bom,20.00
            """;

        var r = await c.Servico.ImportarAsync(c.CartaoId, c.U, [("Nubank_2026-12-08.csv", fatura)], "k");

        Assert.Equal((3, 0, 1), (r.Compras, r.Parcelamentos, r.SemCategoria)); // só a padaria vai pra Pendentes
        Assert.Empty(c.Ctx.Parcelamentos);
        var pix = c.Ctx.Transacoes.Where(t => t.CartaoCreditoId == c.CartaoId && t.EhPixNoCredito).ToList();
        Assert.Equal(2, pix.Count);
        Assert.All(pix, t => Assert.Null(t.CategoriaId));
        var dezembro = c.Ctx.Faturas.Include(f => f.Transacoes).Include(f => f.ParcelasTransacao)
            .Single(f => f.DataVencimento == new DateTime(2026, 12, 8));
        Assert.Equal(150m, RegrasFinanceiras.ValorTotalFatura(dezembro)); // a fatura cobra tudo
        Assert.All(pix, t => Assert.False(RegrasFinanceiras.EntraNoResultadoEmMemoria(t))); // o gasto é o PIX da conta
    }

    [Fact]
    public async Task ArquivoQueNaoEFatura_FicaListadoComOMotivo()
    {
        using var _ = HorarioBrasil.FixarParaTeste(Agora);
        var c = Build();

        var p = await c.Servico.PreviewAsync(c.CartaoId, c.U, [("vazio.csv", ""), ("Nubank_2026-11-08.csv", FaturaNovembro)]);

        Assert.Equal("O arquivo está vazio.", p.Arquivos.Single(a => a.Nome == "vazio.csv").Erro);
        Assert.Equal(2, p.Compras);
    }
}

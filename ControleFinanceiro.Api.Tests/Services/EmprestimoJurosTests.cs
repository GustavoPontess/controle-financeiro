using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Emprestimo;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Juros de empréstimo (2026-11-01, Gustavo: "se eu emprestei, ele volta com juros"): o pagamento é um lançamento só,
/// com o valor inteiro no saldo, e só os juros/multa são receita (quem emprestou) ou gasto (quem pegou). Imputação do
/// Código Civil (art. 354): o pagamento cobre primeiro os juros, depois o capital.
/// </summary>
public class EmprestimoJurosTests
{
    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning)).Options);

    private static EmprestimoService NewSvc(AppDbContext ctx) =>
        new(ctx, TestHelpers.Notif(ctx), TestHelpers.EventLog(ctx), new TransacaoService(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx)));

    private static (Guid Usuario, Guid Conta, Guid Categoria) Seed(AppDbContext ctx, Finalidade finalidade)
    {
        var usuario = new Usuario { Id = Guid.NewGuid(), Email = $"{Guid.NewGuid()}@x.com", Nome = "Ana", PasswordHash = "x" };
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Conta", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuario.Id };
        var categoria = new Categoria { Id = Guid.NewGuid(), Descricao = "Empréstimos", Finalidade = finalidade, UsuarioId = usuario.Id };
        ctx.AddRange(usuario, conta, categoria);
        ctx.SaveChanges();
        return (usuario.Id, conta.Id, categoria.Id);
    }

    private static CriarEmprestimoDto Novo(TipoEmprestimo tipo, decimal valor, decimal juros, int parcelas = 0) => new()
    {
        Descricao = "Empréstimo João", Pessoa = "João", ValorTotal = valor, Tipo = tipo,
        DataInicio = HorarioBrasil.Agora(), DataVencimento = HorarioBrasil.Agora().AddDays(30),
        IdempotencyKey = Guid.NewGuid().ToString(), TaxaJuroMensal = juros,
        FormaPagamento = parcelas > 0 ? FormaPagamentoEmprestimo.Parcelado : FormaPagamentoEmprestimo.AVista,
        QuantidadeParcelas = parcelas > 0 ? parcelas : null,
        PrimeiroVencimento = parcelas > 0 ? HorarioBrasil.Agora().AddDays(30) : null,
    };

    private static async Task<Transacao> Pagar(AppDbContext ctx, EmprestimoService svc, Guid emprestimo, Guid usuario, Guid conta, Guid categoria, decimal valor)
    {
        await svc.SolicitarPagamentoAsync(emprestimo, new SolicitarPagamentoEmprestimoDto
        {
            Valor = valor, ContaId = conta, CategoriaId = categoria, Data = HorarioBrasil.Agora(), IdempotencyKey = Guid.NewGuid().ToString(),
        }, usuario);
        return await ctx.Transacoes.OrderByDescending(t => t.CriadoEm).ThenByDescending(t => t.Id).FirstAsync(t => t.Valor == valor && t.EhEmprestimo);
    }

    [Fact]
    public async Task Emprestei_Parcelado_ParcelaComJuros_OLancamentoEhUmSo_ESoOsJurosViramReceita()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (eu, conta, categoria) = Seed(ctx, Finalidade.Receita);
        var e = await svc.CriarAsync(Novo(TipoEmprestimo.Emprestei, 1000m, 10m, parcelas: 2), eu); // 2 × (500 + 50 de juros)

        var recebido = await Pagar(ctx, svc, e.Id, eu, conta, categoria, 550m);

        Assert.Equal((550m, 50m, TipoTransacao.Receita), (recebido.Valor, recebido.ValorJuros, recebido.Tipo));
        var hoje = HorarioBrasil.Hoje();
        Assert.Equal(50m, (await new RendaService(ctx).ObterMesAsync(eu, hoje.Year, hoje.Month)).Recebido);
        var stats = await new TransacaoService(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx)).ObterStatsAsync(eu);
        Assert.Equal(50m, stats.Entradas);
        var saldo = (await RegrasFinanceiras.SaldoDaContaAsync(ctx, conta, eu)).Saldo;
        Assert.Equal(550m, saldo); // no saldo, o valor inteiro
    }

    [Fact]
    public async Task PagamentoParcial_CobrePrimeiroOsJuros_DepoisOCapital_ArtigoTrezentosECinquentaEQuatro()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (eu, conta, categoria) = Seed(ctx, Finalidade.Receita);
        var e = await svc.CriarAsync(Novo(TipoEmprestimo.Emprestei, 1000m, 10m, parcelas: 2), eu);

        Assert.Equal(20m, (await Pagar(ctx, svc, e.Id, eu, conta, categoria, 20m)).ValorJuros);  // 20 dos 50 de juros
        Assert.Equal(30m, (await Pagar(ctx, svc, e.Id, eu, conta, categoria, 530m)).ValorJuros); // o resto dos juros + 500
        // A 2ª parcela inteira de uma vez: 50 de juros.
        Assert.Equal(50m, (await Pagar(ctx, svc, e.Id, eu, conta, categoria, 550m)).ValorJuros);
    }

    [Fact]
    public async Task AVista_JurosPrimeiro_NoTotalOsJurosDaoExatamenteADiferenca()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (eu, conta, categoria) = Seed(ctx, Finalidade.Receita);
        var e = await svc.CriarAsync(Novo(TipoEmprestimo.Emprestei, 1000m, 20m), eu); // volta 1.200

        var primeiro = await Pagar(ctx, svc, e.Id, eu, conta, categoria, 500m);
        var segundo = await Pagar(ctx, svc, e.Id, eu, conta, categoria, 700m);

        Assert.Equal(200m, primeiro.ValorJuros);
        Assert.Null(segundo.ValorJuros);
    }

    [Fact]
    public async Task PegueiEmprestado_AParcelaQueEuPago_SoOsJurosViramGasto_NaCategoriaDoPagamento()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (eu, conta, categoria) = Seed(ctx, Finalidade.Despesa);
        var e = await svc.CriarAsync(Novo(TipoEmprestimo.PeguiEmprestado, 1000m, 10m, parcelas: 2), eu);

        var paguei = await Pagar(ctx, svc, e.Id, eu, conta, categoria, 550m);

        Assert.Equal((TipoTransacao.Despesa, 50m), (paguei.Tipo, paguei.ValorJuros));
        var hoje = HorarioBrasil.Hoje();
        var gastos = await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(ctx, eu, hoje.Year, hoje.Month);
        Assert.Equal(50m, gastos[categoria].Gasto);
        var stats = await new TransacaoService(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx)).ObterStatsAsync(eu);
        Assert.Equal(50m, stats.Saidas);
    }

    [Fact]
    public async Task EmprestimoSemJuros_SegueForaDoResultado_ComoAntes()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (eu, conta, categoria) = Seed(ctx, Finalidade.Receita);
        var dto = Novo(TipoEmprestimo.Emprestei, 300m, 0m);
        dto.TaxaJuroMensal = null;
        var e = await svc.CriarAsync(dto, eu);

        var recebido = await Pagar(ctx, svc, e.Id, eu, conta, categoria, 300m);

        Assert.Null(recebido.ValorJuros);
        var hoje = HorarioBrasil.Hoje();
        Assert.Equal(0m, (await new RendaService(ctx).ObterMesAsync(eu, hoje.Year, hoje.Month)).Recebido);
    }
    // ── Empréstimo de banco: Tabela Price pela taxa efetiva ──────────────────────────────────────────────

    [Fact]
    public void TaxaEfetiva_EhATaxaQueIgualaORecebidoAsParcelas()
    {
        Assert.Equal(2.92m, Math.Round(EmprestimoService.TaxaEfetivaMensal(1000m, 100m, 12) * 100, 2)); // 12 × 100 sobre 1.000
        Assert.Equal(0m, EmprestimoService.TaxaEfetivaMensal(1200m, 100m, 12)); // sem juros
    }

    [Fact]
    public async Task EmprestimoDeBanco_ComOValorDaParcela_SeparaJurosEAmortizacao_PelaTabelaPrice()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (eu, conta, categoria) = Seed(ctx, Finalidade.Despesa);
        var dto = Novo(TipoEmprestimo.PeguiEmprestado, 2610m, 0m, parcelas: 12);
        dto.TaxaJuroMensal = null;
        dto.ValorParcela = 250m; // recebeu 2.610, paga 12 × 250 = 3.000
        var e = await svc.CriarAsync(dto, eu);

        var parcelas = await ctx.EmprestimoParcelas.Where(p => p.EmprestimoId == e.Id).OrderBy(p => p.Numero).ToListAsync();
        var taxa = EmprestimoService.TaxaEfetivaMensal(2610m, 250m, 12);
        Assert.Equal(2610m, parcelas.Sum(p => p.Valor));                           // a amortização devolve o recebido
        Assert.InRange(parcelas.Sum(p => p.ValorComJuros!.Value), 2999.95m, 3000.05m); // e as parcelas somam o contrato
        Assert.Equal(Math.Round(2610m * taxa, 2), parcelas[0].ValorComJuros - parcelas[0].Valor); // juros = saldo × taxa
        Assert.True(parcelas[0].ValorComJuros - parcelas[0].Valor > parcelas[11].ValorComJuros - parcelas[11].Valor); // juros caem

        var paguei = await Pagar(ctx, svc, e.Id, eu, conta, categoria, 250m);
        Assert.Equal(parcelas[0].ValorComJuros - parcelas[0].Valor, paguei.ValorJuros);
    }

    [Fact]
    public async Task EmprestimoDeBanco_ValorDaParcelaNaoPodeVirComJurosNemSomarMenosQueORecebido()
    {
        var svc = NewSvc(CreateContext());
        var comOsDois = Novo(TipoEmprestimo.PeguiEmprestado, 1000m, 2m, parcelas: 10);
        comOsDois.ValorParcela = 120m;
        await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(comOsDois, Guid.NewGuid()));

        var poucoDemais = Novo(TipoEmprestimo.PeguiEmprestado, 1000m, 0m, parcelas: 10);
        poucoDemais.TaxaJuroMensal = null;
        poucoDemais.ValorParcela = 90m;
        await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(poucoDemais, Guid.NewGuid()));
    }

    [Fact]
    public async Task Multa_EhSobreAParcelaDevida_ComOsJuros_AtrasarNuncaSaiMaisBarato()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (eu, _, _) = Seed(ctx, Finalidade.Receita);
        var dto = Novo(TipoEmprestimo.Emprestei, 1000m, 10m, parcelas: 2);
        dto.DataInicio = HorarioBrasil.Agora().AddDays(-60);
        dto.DataVencimento = null;
        dto.PrimeiroVencimento = HorarioBrasil.Agora().AddDays(-10); // a 1ª já venceu
        dto.PercentualMultaAtraso = 2m;
        var e = await svc.CriarAsync(dto, eu);

        await svc.ListarParcelasAsync(e.Id, eu); // a multa entra na 1ª leitura depois do vencimento
        var vencida = await ctx.EmprestimoParcelas.SingleAsync(p => p.EmprestimoId == e.Id && p.Numero == 1);
        Assert.Equal(550m * 1.02m, vencida.ValorComMulta); // 500 + 50 de juros, + 2%
    }
    [Fact]
    public async Task ComJuros_SoQuitaNaUltimaParcela_EJaDevolviEhOCapital()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (eu, conta, categoria) = Seed(ctx, Finalidade.Despesa);
        var dto = Novo(TipoEmprestimo.PeguiEmprestado, 1000m, 0m, parcelas: 3);
        dto.TaxaJuroMensal = null;
        dto.ValorParcela = 400m; // 3 × 400 sobre 1.000
        var e = await svc.CriarAsync(dto, eu);
        var parcelas = await ctx.EmprestimoParcelas.Where(p => p.EmprestimoId == e.Id).OrderBy(p => p.Numero).ToListAsync();

        await Pagar(ctx, svc, e.Id, eu, conta, categoria, parcelas[0].ValorComJuros!.Value);
        await Pagar(ctx, svc, e.Id, eu, conta, categoria, parcelas[1].ValorComJuros!.Value);
        var depoisDeDuas = await ctx.Emprestimos.SingleAsync(x => x.Id == e.Id);
        Assert.False(depoisDeDuas.Quitado); // falta uma parcela (antes os juros contavam como devolução e quitava cedo)
        Assert.Equal(parcelas[0].Valor + parcelas[1].Valor, depoisDeDuas.ValorPago); // só o capital devolvido

        await Pagar(ctx, svc, e.Id, eu, conta, categoria, parcelas[2].ValorComJuros!.Value);
        var quitado = await ctx.Emprestimos.SingleAsync(x => x.Id == e.Id);
        Assert.True(quitado.Quitado);
        Assert.Equal(1000m, quitado.ValorPago);
    }
    [Fact]
    public async Task AVista_PagamentoParcial_FaltaContaOsJuros_EJaDevolviEhTudoQueFoiPago()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (eu, conta, categoria) = Seed(ctx, Finalidade.Receita);
        var e = await svc.CriarAsync(Novo(TipoEmprestimo.Emprestei, 1000m, 20m), eu); // volta 1.200

        await Pagar(ctx, svc, e.Id, eu, conta, categoria, 500m); // 200 de juros + 300 de capital

        var dto = (await svc.BuscarPorIdAsync(e.Id, eu))!;
        Assert.Equal((500m, 700m), (dto.ValorPago, dto.ValorRestante));
        Assert.Equal(700m, (await svc.ObterStatsAsync(eu)).TotalAReceber);
    }

    [Fact]
    public async Task Parcelado_FaltaEhOQueFaltaDasParcelas_ComOsJuros()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (eu, conta, categoria) = Seed(ctx, Finalidade.Receita);
        var e = await svc.CriarAsync(Novo(TipoEmprestimo.Emprestei, 1000m, 10m, parcelas: 2), eu); // 2 × 550

        await Pagar(ctx, svc, e.Id, eu, conta, categoria, 550m);

        var dto = (await svc.BuscarPorIdAsync(e.Id, eu))!;
        Assert.Equal((550m, 550m, 50m), (dto.ValorPago, dto.ValorRestante, dto.PercentualPago));
        Assert.Equal(550m, (await svc.ObterStatsAsync(eu)).TotalAReceber);
    }
    [Fact]
    public async Task VisaoGastos_AParcelaDeEmprestimoEntraPelosJuros()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (eu, conta, categoria) = Seed(ctx, Finalidade.Despesa);
        var e = await svc.CriarAsync(Novo(TipoEmprestimo.PeguiEmprestado, 1000m, 10m, parcelas: 2), eu);
        var paguei = await Pagar(ctx, svc, e.Id, eu, conta, categoria, 550m);

        var transacoes = new TransacaoService(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx));
        Assert.Equal((50m, 50m), ((await transacoes.ResumirGastosAsync(eu)).Total, (await transacoes.ResumirGastosAsync(eu)).EmConta));
        Assert.Contains((await transacoes.ListarGastosAsync(eu)).Items, l => l.Transacao?.Id == paguei.Id);
    }
}

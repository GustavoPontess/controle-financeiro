using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Transacao;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Compra parcelada lançada pelo formulário de transação vira um parcelamento de verdade (nunca N lançamentos
/// soltos "X (i/N)") e a visão Gastos de Transações mostra o que a pessoa gastou, na data em que gastou: conta e
/// cartão, com a compra parcelada UMA vez (o total), sem pagamento de fatura nem transferência.
/// </summary>
public class CompraParceladaTests
{
    // Cartão fecha dia 10 e vence dia 17; "hoje" = 19/10/2026 (a fatura que fechou em 10/10 já venceu em 17/10).
    private static readonly DateTime Agora = new(2026, 10, 19, 12, 0, 0, DateTimeKind.Utc);

    private sealed class RelogioFixo(DateTime agoraUtc) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(DateTime.SpecifyKind(agoraUtc, DateTimeKind.Utc));
    }

    private sealed record Cenario(AppDbContext Ctx, ParcelamentoService Parcelamentos, TransacaoService Transacoes,
        Guid UsuarioId, Guid ContaId, Guid CartaoId, Guid CasaId, Guid MoveisId);

    private static async Task<Cenario> Build()
    {
        var ctx = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);
        var u = Guid.NewGuid();
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Conta", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = u };
        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = "Nubank", TemCredito = true, LimiteTotal = 50_000,
            DiaFechamento = 10, DiaVencimento = 17, CriadoPor = u, Ativo = true,
        };
        var casa = new Categoria { Id = Guid.NewGuid(), Descricao = "Casa", Finalidade = Finalidade.Despesa, UsuarioId = u };
        var moveis = new Subcategoria { Id = Guid.NewGuid(), Nome = "Móveis", CategoriaId = casa.Id, UsuarioId = u };
        ctx.Contas.Add(conta);
        ctx.CartoesCredito.Add(cartao);
        ctx.Categorias.Add(casa);
        ctx.Subcategorias.Add(moveis);
        await ctx.SaveChangesAsync();

        var log = new FinancialEventLogService(ctx);
        var faturas = new FaturaService(ctx);
        var parcelamentos = new ParcelamentoService(ctx, log, new LimiteCalculatorService(ctx), faturas, new RelogioFixo(Agora));
        return new Cenario(ctx, parcelamentos, new TransacaoService(ctx, faturas, log), u, conta.Id, cartao.Id, casa.Id, moveis.Id);
    }

    private static CriarTransacaoDto Compra(Cenario c, string descricao = "Sofá", decimal valor = 1500m, int parcelas = 5,
        DateOnly? data = null, Guid? subcategoria = null) => new()
    {
        Descricao = descricao, Valor = valor, Tipo = (int)TipoTransacao.Despesa, CategoriaId = c.CasaId,
        SubcategoriaId = subcategoria, CartaoCreditoId = c.CartaoId, UsadoComoCredito = true,
        MeioPagamento = (int)MeioPagamento.Credito, Parcelas = parcelas, Data = data ?? new DateOnly(2026, 10, 19),
    };

    // ── Formulário → parcelamento de verdade ───────────────────────────────────

    [Fact]
    public async Task CompraParcelada_ViraUmParcelamento_ComAsParcelasNasFaturas_ENenhumLancamentoSolto()
    {
        var c = await Build();

        var p = await c.Parcelamentos.CriarDoLancamentoAsync(Compra(c, subcategoria: c.MoveisId), c.UsuarioId, Guid.NewGuid().ToString());

        var salvo = await c.Ctx.Parcelamentos.Include(x => x.Parcelas).SingleAsync();
        Assert.Equal(p.Id, salvo.Id);
        Assert.Equal(("Sofá", 1500m, 5, 0), (salvo.Descricao, salvo.ValorTotal, salvo.QuantidadeParcelas, salvo.ParcelasPagasAntes));
        Assert.Equal((c.CasaId, c.MoveisId), (salvo.CategoriaId!.Value, salvo.SubcategoriaId!.Value));
        Assert.Equal(5, salvo.Parcelas.Count);
        Assert.All(salvo.Parcelas, x => Assert.Equal(300m, x.Valor));
        // Compra de 19/10 cai na fatura que fecha em 10/11; uma parcela por fatura dali em diante.
        var fechamentos = await c.Ctx.Faturas.OrderBy(f => f.DataFechamento).Select(f => f.DataFechamento).ToListAsync();
        Assert.Equal(new DateTime(2026, 11, 10), fechamentos[0]);
        Assert.Equal(5, fechamentos.Count);
        Assert.Equal(0, await c.Ctx.Transacoes.CountAsync());
    }

    [Fact]
    public async Task MesmaChave_DevolveOMesmoParcelamento_EComOutrosDados409()
    {
        var c = await Build();
        var chave = Guid.NewGuid().ToString();

        var primeira = await c.Parcelamentos.CriarDoLancamentoAsync(Compra(c), c.UsuarioId, chave);
        var segunda = await c.Parcelamentos.CriarDoLancamentoAsync(Compra(c), c.UsuarioId, chave);

        Assert.Equal(primeira.Id, segunda.Id);
        Assert.Equal(1, await c.Ctx.Parcelamentos.CountAsync());
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => c.Parcelamentos.CriarDoLancamentoAsync(Compra(c, valor: 999m), c.UsuarioId, chave));
        Assert.Equal(Idempotencia.MensagemChaveComOutrosDados, ex.Message);
    }

    [Fact]
    public async Task CompraAntiga_ParcelasEmFaturasVencidas_EntramComoJaPagas()
    {
        var c = await Build();

        // 05/07 em 6x: julho, agosto, setembro e outubro já venceram; ficam novembro e dezembro.
        await c.Parcelamentos.CriarDoLancamentoAsync(Compra(c, valor: 600m, parcelas: 6, data: new DateOnly(2026, 7, 5)), c.UsuarioId, null);

        var p = await c.Ctx.Parcelamentos.Include(x => x.Parcelas).SingleAsync();
        Assert.Equal(4, p.ParcelasPagasAntes);
        Assert.Equal(new[] { 5, 6 }, p.Parcelas.OrderBy(x => x.Numero).Select(x => x.Numero));
    }

    [Fact]
    public async Task CompraAntiga_TodasAsParcelasEmFaturasVencidas_Recusa()
    {
        var c = await Build();

        await Assert.ThrowsAsync<InvalidOperationException>(() => c.Parcelamentos.CriarDoLancamentoAsync(
            Compra(c, parcelas: 3, data: new DateOnly(2026, 7, 5)), c.UsuarioId, null));
        Assert.Equal(0, await c.Ctx.Parcelamentos.CountAsync());
    }

    [Fact]
    public async Task CategoriaOuSubcategoriaQueNaoServe_Recusa()
    {
        var c = await Build();
        var deOutro = new Categoria { Id = Guid.NewGuid(), Descricao = "Privada", Finalidade = Finalidade.Despesa, UsuarioId = Guid.NewGuid() };
        var outra = new Categoria { Id = Guid.NewGuid(), Descricao = "Lazer", Finalidade = Finalidade.Despesa, UsuarioId = c.UsuarioId };
        c.Ctx.Categorias.AddRange(deOutro, outra);
        await c.Ctx.SaveChangesAsync();

        var categoriaDeOutro = Compra(c);
        categoriaDeOutro.CategoriaId = deOutro.Id;
        await Assert.ThrowsAsync<InvalidOperationException>(() => c.Parcelamentos.CriarDoLancamentoAsync(categoriaDeOutro, c.UsuarioId, null));

        var subDeOutraCategoria = Compra(c, subcategoria: c.MoveisId);
        subDeOutraCategoria.CategoriaId = outra.Id;
        await Assert.ThrowsAsync<ArgumentException>(() => c.Parcelamentos.CriarDoLancamentoAsync(subDeOutraCategoria, c.UsuarioId, null));

        var receita = Compra(c);
        receita.Tipo = (int)TipoTransacao.Receita;
        await Assert.ThrowsAsync<ArgumentException>(() => c.Parcelamentos.CriarDoLancamentoAsync(receita, c.UsuarioId, null));

        Assert.Equal(0, await c.Ctx.Parcelamentos.CountAsync());
    }

    // ── Transações › Gastos ───────────────────────────────────────────────────

    private static async Task SeedGastos(Cenario c)
    {
        void T(string d, decimal v, int dia, TipoTransacao tipo = TipoTransacao.Despesa, bool cartao = false,
            bool pagamentoFatura = false, bool transferencia = false) => c.Ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = d, Valor = v, Tipo = tipo, Data = new DateOnly(2026, 10, dia), CriadoPor = c.UsuarioId,
            ContaId = cartao ? null : c.ContaId, CartaoCreditoId = cartao ? c.CartaoId : null, UsadoComoCredito = cartao,
            EhPagamentoFatura = pagamentoFatura, EhTransferencia = transferencia,
        });
        T("Mercado", 100m, 18);
        T("Uber", 30m, 17, cartao: true);
        T("Salário", 3000m, 5, TipoTransacao.Receita);
        T("Pagamento fatura Nubank", 500m, 8, pagamentoFatura: true);
        T("Guardado na caixinha", 200m, 9, transferencia: true);
        await c.Ctx.SaveChangesAsync();

        await c.Parcelamentos.CriarDoLancamentoAsync(Compra(c, "Geladeira", data: new DateOnly(2026, 10, 15)), c.UsuarioId, null);
        var tv = await c.Parcelamentos.CriarDoLancamentoAsync(Compra(c, "TV", data: new DateOnly(2026, 10, 16)), c.UsuarioId, null);
        (await c.Ctx.Parcelamentos.SingleAsync(p => p.Id == tv.Id)).Ativo = false; // cancelada: sai como lançamento excluído
        await c.Ctx.SaveChangesAsync();
    }

    private static string Nome(TransacaoService.LinhaDeGasto l) => l.Parcelamento?.Descricao ?? l.Transacao!.Descricao;

    [Fact]
    public async Task Gastos_ContaECartao_CompraParceladaUmaVezComOTotal_SemPagamentoDeFaturaNemTransferencia()
    {
        var c = await Build();
        await SeedGastos(c);

        var r = await c.Transacoes.ListarGastosAsync(c.UsuarioId);

        Assert.Equal(new[] { "Mercado", "Uber", "Geladeira" }, r.Items.Select(Nome));
        Assert.Equal(3, r.Total);
        var geladeira = r.Items.Last().Parcelamento!;
        Assert.Equal((1500m, 5), (geladeira.ValorTotal, geladeira.QuantidadeParcelas));
    }

    [Fact]
    public async Task Gastos_FiltrosEPaginaValemPraCompraParceladaTambem()
    {
        var c = await Build();
        await SeedGastos(c);

        Assert.Equal(new[] { "Mercado" }, (await c.Transacoes.ListarGastosAsync(c.UsuarioId, contaId: c.ContaId)).Items.Select(Nome));
        Assert.Equal(new[] { "Geladeira" }, (await c.Transacoes.ListarGastosAsync(c.UsuarioId, categoriaId: c.CasaId)).Items.Select(Nome));
        Assert.Equal(new[] { "Geladeira" }, (await c.Transacoes.ListarGastosAsync(c.UsuarioId, q: "GELA")).Items.Select(Nome));
        Assert.Equal(new[] { "Uber", "Geladeira" }, (await c.Transacoes.ListarGastosAsync(c.UsuarioId, cartaoId: c.CartaoId)).Items.Select(Nome));
        Assert.Empty((await c.Transacoes.ListarGastosAsync(c.UsuarioId, status: (int)StatusTransacao.Previsao)).Items);
        Assert.Equal(new[] { "Geladeira" }, (await c.Transacoes.ListarGastosAsync(c.UsuarioId, valorMin: 1000m)).Items.Select(Nome));
        Assert.Equal(new[] { "Uber", "Mercado" }, (await c.Transacoes.ListarGastosAsync(c.UsuarioId, to: new DateOnly(2026, 10, 19), from: new DateOnly(2026, 10, 16), ordenacao: "data_asc")).Items.Select(Nome));

        var pagina2 = await c.Transacoes.ListarGastosAsync(c.UsuarioId, page: 2, pageSize: 2);
        Assert.Equal(3, pagina2.Total);
        Assert.Equal(new[] { "Geladeira" }, pagina2.Items.Select(Nome));
    }

    [Fact]
    public async Task Gastos_DeOutraPessoa_NaoAparecem()
    {
        var c = await Build();
        await SeedGastos(c);

        var r = await c.Transacoes.ListarGastosAsync(Guid.NewGuid());

        Assert.Empty(r.Items);
        Assert.Equal(0, r.Total);
    }

    // ── Subcategoria do parcelamento ──────────────────────────────────────────

    [Fact]
    public async Task ExcluirSubcategoria_MovendoPraOutra_LevaOParcelamentoJunto_EContaNoUso()
    {
        var c = await Build();
        var sala = new Subcategoria { Id = Guid.NewGuid(), Nome = "Sala", CategoriaId = c.CasaId, UsuarioId = c.UsuarioId };
        c.Ctx.Subcategorias.Add(sala);
        await c.Ctx.SaveChangesAsync();
        await c.Parcelamentos.CriarDoLancamentoAsync(Compra(c, subcategoria: c.MoveisId), c.UsuarioId, null);
        var subs = new SubcategoriaService(c.Ctx);

        Assert.Equal(1, (await subs.UsoAsync(c.MoveisId, c.UsuarioId)).Parcelamentos);
        await subs.DeletarAsync(c.MoveisId, c.UsuarioId, sala.Id);

        Assert.Equal(sala.Id, (await c.Ctx.Parcelamentos.SingleAsync()).SubcategoriaId);
    }
}

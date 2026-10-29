using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Meta;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// "Essa meta cabe?" (pedido do Gustavo, 2026-10-19): a viagem de R$ 5 mil em dezembro pra quem só junta R$ 3 mil,
/// a meta de R$ 1 milhão em um ano pra quem recebe R$ 1 mil. Folga = renda esperada − gasto típico − outras metas.
/// </summary>
public class ViabilidadeMetaServiceTests
{
    private static readonly DateTime Hoje = new(2026, 10, 15);

    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    private static MetaService Metas(AppDbContext ctx) => new(ctx, new TransferenciaService(ctx));
    private static ViabilidadeMetaService Servico(AppDbContext ctx) => new(ctx, new RendaService(ctx), Metas(ctx));

    /// <summary>Renda esperada de R$ 3.000 e R$ 2.000 de gasto por mês em julho, agosto e setembro.</summary>
    private static Guid Pessoa(AppDbContext ctx, decimal renda = 3000m, bool comGasto = true)
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = Guid.NewGuid() + "@t.com", Nome = "U", PasswordHash = "x" };
        ctx.Usuarios.Add(u);
        if (renda > 0)
            ctx.Add(new RendaPrevista { Id = Guid.NewGuid(), UsuarioId = u.Id, Ano = 2026, Mes = 10, FixaEsperada = renda, VariavelEsperada = 0m });
        if (comGasto)
            foreach (var mes in new[] { 7, 8, 9 })
                ctx.Transacoes.Add(new Transacao
                {
                    Id = Guid.NewGuid(), Descricao = "Gastos", Valor = 2000m, Tipo = TipoTransacao.Despesa, CriadoPor = u.Id,
                    Data = new DateOnly(2026, mes, 10), StatusTransacao = StatusTransacao.Executado, Ativo = true,
                });
        ctx.SaveChanges();
        return u.Id;
    }

    private static async Task OutraMeta(AppDbContext ctx, Guid u) => // pede R$ 800 por mês (R$ 2.400 até dezembro)
        await Metas(ctx).CriarAsync(new CriarMetaDto("Reserva", null, 2400m, new DateTime(2026, 12, 1), null, null), u);

    [Fact]
    public async Task Viagem_QueNaoCabeNoPrazo_DizQuantoJuntaEQuandoChega()
    {
        var ctx = CreateContext();
        var u = Pessoa(ctx);
        await OutraMeta(ctx, u);

        var v = await Servico(ctx).CalcularAsync(u, 5000m, new DateTime(2026, 12, 1), null, Hoje);

        Assert.Equal((1666.67m, 3, 200m, 2000m, 800m), (v.PorMes!.Value, v.Meses!.Value, v.Folga!.Value, v.GastoTipico!.Value, v.OutrasMetasPorMes));
        Assert.Equal(new DateTime(2028, 10, 1), v.PrazoQueCabe); // 25 meses guardando R$ 200
        Assert.Equal("alerta", v.Resposta.Tom);
        Assert.Equal("Precisa guardar R$ 1.666,67 por mês, mas sobram R$ 200,00. Até dezembro de 2026 você junta R$ 600,00. " +
                     "Nesse ritmo chega lá em outubro de 2028.", v.Resposta.Texto);
    }

    [Fact]
    public async Task QueCabe_DizQueCabe()
    {
        var ctx = CreateContext();
        var u = Pessoa(ctx);

        var v = await Servico(ctx).CalcularAsync(u, 300m, new DateTime(2026, 12, 1), null, Hoje);

        Assert.Equal("positivo", v.Resposta.Tom);
        Assert.Equal("Precisa guardar R$ 100,00 por mês. Cabe: sobram R$ 1.000,00 por mês depois dos gastos e das outras metas.", v.Resposta.Texto);
        Assert.Null(v.PrazoQueCabe);
    }

    [Fact]
    public async Task UmMilhaoEmUmAno_PraQuemRecebeMil_DizQueEhMaisDoQueRecebe()
    {
        var ctx = CreateContext();
        var u = Pessoa(ctx, renda: 1000m, comGasto: false);
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Gastos", Valor = 800m, Tipo = TipoTransacao.Despesa, CriadoPor = u,
            Data = new DateOnly(2026, 9, 10), StatusTransacao = StatusTransacao.Executado, Ativo = true,
        });
        ctx.SaveChanges();

        var v = await Servico(ctx).CalcularAsync(u, 1_000_000m, new DateTime(2027, 9, 1), null, Hoje);

        Assert.Equal("negativo", v.Resposta.Tom);
        Assert.Equal("Precisa guardar R$ 83.333,34 por mês, mais do que você recebe (R$ 1.000,00). " +
                     "Guardando o que sobra (R$ 200,00 por mês), levaria mais de 50 anos.", v.Resposta.Texto);
        Assert.Null(v.PrazoQueCabe);
    }

    [Fact]
    public async Task SemPrazo_DizQuandoChegaGuardandoAFolga()
    {
        var ctx = CreateContext();
        var u = Pessoa(ctx);

        var v = await Servico(ctx).CalcularAsync(u, 5000m, null, null, Hoje);

        Assert.Null(v.PorMes);
        Assert.Equal("Guardando o que sobra (R$ 1.000,00 por mês), chega lá em fevereiro de 2027.", v.Resposta.Texto);
    }

    [Fact]
    public async Task NaoSobraNada_SemRenda_SemGasto()
    {
        var ctx = CreateContext();
        var apertado = Pessoa(ctx, renda: 2000m);
        var semRenda = Pessoa(ctx, renda: 0m);
        var semGasto = Pessoa(ctx, comGasto: false);
        var svc = Servico(ctx);

        var a = await svc.CalcularAsync(apertado, 600m, new DateTime(2026, 12, 1), null, Hoje);
        Assert.Equal(("negativo", "Precisa guardar R$ 200,00 por mês, e hoje não sobra nada: o seu gasto normal (R$ 2.000,00 por mês) já leva toda a renda (R$ 2.000,00)."),
            (a.Resposta.Tom, a.Resposta.Texto));

        // O que aperta são as outras metas: sobra do gasto normal, mas elas já pedem mais que isso.
        var comMetas = Pessoa(ctx, renda: 2500m);
        await OutraMeta(ctx, comMetas);
        var d = await svc.CalcularAsync(comMetas, 600m, new DateTime(2026, 12, 1), null, Hoje);
        Assert.Equal("Precisa guardar R$ 200,00 por mês, e hoje não sobra nada: depois do gasto normal sobram R$ 500,00, e as outras metas já pedem R$ 800,00 por mês.",
            d.Resposta.Texto);
        Assert.Equal("/metas", Assert.Single(d.Resposta.Acoes).Para);

        var b = await svc.CalcularAsync(semRenda, 600m, new DateTime(2026, 12, 1), null, Hoje);
        Assert.Equal(("neutro", "/orcamento"), (b.Resposta.Tom, Assert.Single(b.Resposta.Acoes).Para));

        var c = await svc.CalcularAsync(semGasto, 600m, new DateTime(2026, 12, 1), null, Hoje);
        Assert.Equal("Precisa guardar R$ 200,00 por mês. Pra saber se cabe, lance os gastos de pelo menos um mês.", c.Resposta.Texto);
    }

    /// <summary>Compra parcelada: uma parcela por mês informado (ano 2026), cada uma com o status dado.</summary>
    private static void Parcelado(AppDbContext ctx, Guid u, Guid? categoria, decimal parcela, params (int Mes, StatusParcela Status)[] parcelas)
    {
        var pc = new Parcelamento
        {
            Id = Guid.NewGuid(), CriadoPor = u, Descricao = "Geladeira", DataCompra = new DateTime(2026, parcelas[0].Mes, 5),
            ValorTotal = parcela * parcelas.Length, QuantidadeParcelas = parcelas.Length, CartaoCreditoId = Guid.NewGuid(), CategoriaId = categoria,
        };
        ctx.Parcelamentos.Add(pc);
        var n = 1;
        foreach (var (mes, status) in parcelas)
            ctx.ParcelasTransacao.Add(new ParcelaTransacao
            {
                Id = Guid.NewGuid(), ParcelamentoId = pc.Id, Numero = n++, QuantidadeTotal = parcelas.Length,
                DataVencimento = mes > 12 ? new DateTime(2027, mes - 12, 5) : new DateTime(2026, mes, 5),
                Valor = parcela, FaturaId = Guid.NewGuid(), Status = status, CriadoPor = u,
            });
        ctx.SaveChanges();
    }

    [Fact]
    public async Task ParcelasJaCompradas_SaemDaFolga_EOGastoNormalNaoContaParcelaDuasVezes()
    {
        var ctx = CreateContext();
        var u = Pessoa(ctx);
        // Setembro teve uma parcela de R$ 500 (paga) além dos R$ 2.000 de gasto: o gasto normal continua R$ 2.000.
        Parcelado(ctx, u, null, 500m, (9, StatusParcela.Paga));
        // Parcelas de R$ 600 em outubro, novembro e dezembro: até o prazo (dezembro) pesam R$ 600 por mês.
        Parcelado(ctx, u, null, 600m, (10, StatusParcela.Pendente), (11, StatusParcela.Pendente), (12, StatusParcela.Pendente));

        var v = await Servico(ctx).CalcularAsync(u, 300m, new DateTime(2026, 12, 1), null, Hoje);

        Assert.Equal((2000m, 600m, 400m), (v.GastoTipico!.Value, v.ParcelasPorMes, v.Folga!.Value)); // 3.000 − 2.000 − 600
        Assert.Equal("Precisa guardar R$ 100,00 por mês. Cabe: sobram R$ 400,00 por mês depois dos gastos, das parcelas e das outras metas.",
            v.Resposta.Texto);

        var apertado = Pessoa(ctx, renda: 2500m);
        Parcelado(ctx, apertado, null, 600m, (10, StatusParcela.Pendente), (11, StatusParcela.Pendente), (12, StatusParcela.Pendente));
        var a = await Servico(ctx).CalcularAsync(apertado, 300m, new DateTime(2026, 12, 1), null, Hoje);
        Assert.Equal("Precisa guardar R$ 100,00 por mês, e hoje não sobra nada: depois do gasto normal sobram R$ 500,00, " +
                     "e as parcelas já compradas levam R$ 600,00 por mês.", a.Resposta.Texto);
        Assert.Equal("/cartoes", Assert.Single(a.Resposta.Acoes).Para);
    }

    [Fact]
    public async Task Editando_AMetaNaoContaNasOutras()
    {
        var ctx = CreateContext();
        var u = Pessoa(ctx);
        var meta = await Metas(ctx).CriarAsync(new CriarMetaDto("Viagem", null, 2400m, new DateTime(2026, 12, 1), null, null), u);

        var v = await Servico(ctx).CalcularAsync(u, 2400m, new DateTime(2026, 12, 1), meta.Id, Hoje);

        Assert.Equal(0m, v.OutrasMetasPorMes);
        Assert.Equal(1000m, v.Folga);
        await Assert.ThrowsAsync<ArgumentException>(() => Servico(ctx).CalcularAsync(u, 0m, null, null, Hoje));
    }

    // ── "As metas juntas cabem?" (lista de Metas) ──────────────────────────

    [Fact]
    public async Task MetasJuntas_Cabem_DizQuantoAindaFicaLivre()
    {
        var ctx = CreateContext();
        var u = Pessoa(ctx);
        await OutraMeta(ctx, u); // R$ 800 por mês

        var v = await Servico(ctx).DasMetasAsync(u, Hoje);

        Assert.Equal((800m, 1000m), (v.PedemPorMes, v.Folga!.Value));
        Assert.Equal("positivo", v.Resposta!.Tom);
        Assert.Equal("As metas pedem R$ 800,00 por mês e cabem: depois dos gastos sobram R$ 1.000,00, e ainda ficam R$ 200,00 livres.",
            v.Resposta.Texto);
    }

    [Fact]
    public async Task MetasJuntas_NaoCabem_SugereEsticarOPrazoDaQueMaisPede()
    {
        var ctx = CreateContext();
        var u = Pessoa(ctx);
        await OutraMeta(ctx, u); // R$ 800 por mês
        var carro = await Metas(ctx).CriarAsync(new CriarMetaDto("Carro", null, 6000m, new DateTime(2026, 12, 1), null, null), u); // R$ 2.000 por mês

        var v = await Servico(ctx).DasMetasAsync(u, Hoje);

        // Sobra R$ 1.000; a Reserva leva 800, pro Carro ficam 200: R$ 6.000 em 30 meses, de outubro/2026 a março/2029.
        Assert.Equal("alerta", v.Resposta!.Tom);
        Assert.Equal("As metas pedem R$ 2.800,00 por mês, mas sobram R$ 1.000,00. Pra caber, estique o prazo de Carro pra março de 2029.",
            v.Resposta.Texto);
        var acao = Assert.Single(v.Resposta.Acoes);
        Assert.Equal(("Ajustar Carro", $"/metas/{carro.Id}/editar"), (acao.Rotulo, acao.Para));
    }

    [Fact]
    public async Task MetasJuntas_SemFolga_SemRenda_OuSemMetaPedindo()
    {
        var ctx = CreateContext();

        var semFolga = Pessoa(ctx, renda: 2000m);
        await OutraMeta(ctx, semFolga);
        var r = (await Servico(ctx).DasMetasAsync(semFolga, Hoje)).Resposta!;
        Assert.Equal(("negativo", "As metas pedem R$ 800,00 por mês, e hoje não sobra nada: o seu gasto normal (R$ 2.000,00 por mês) " +
                                  "já leva toda a renda (R$ 2.000,00)."), (r.Tom, r.Texto));
        Assert.Equal("/orcamento", Assert.Single(r.Acoes).Para);

        var semRenda = Pessoa(ctx, renda: 0m);
        await OutraMeta(ctx, semRenda);
        var n = (await Servico(ctx).DasMetasAsync(semRenda, Hoje)).Resposta!;
        Assert.Equal(("neutro", "/orcamento"), (n.Tom, Assert.Single(n.Acoes).Para));

        var nada = await Servico(ctx).DasMetasAsync(Pessoa(ctx), Hoje); // nenhuma meta pedindo nada por mês
        Assert.Equal((0m, (decimal?)null), (nada.PedemPorMes, nada.Folga));
        Assert.Null(nada.Resposta);
    }
}

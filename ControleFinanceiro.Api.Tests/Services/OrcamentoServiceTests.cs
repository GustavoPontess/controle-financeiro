using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Orcamento;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Limites (decisão do Gustavo 2026-10-19): vale todo mês até mudar; mudar/tirar vale do mês em diante e o mês
/// passado fica como estava. Gasto = regra única <see cref="RegrasFinanceiras.GastosPorCategoriaDoMesAsync"/>.
/// </summary>
public class OrcamentoServiceTests
{
    // "Hoje" dos testes: maio/2026 é o mês atual (abril já passou).
    private static readonly DateTime Agora = new(2026, 5, 10);

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(
                Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static Guid SeedUsuario(AppDbContext ctx, string email = "u@test.com")
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = email, Nome = "User", PasswordHash = "x" };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u.Id;
    }

    private static Guid SeedCategoria(AppDbContext ctx, string nome = "Mercado", Finalidade finalidade = Finalidade.Despesa, Guid? dono = null)
    {
        var c = new Categoria { Id = Guid.NewGuid(), Descricao = nome, Finalidade = finalidade, UsuarioId = dono };
        ctx.Categorias.Add(c);
        ctx.SaveChanges();
        return c.Id;
    }

    private static void Gasto(AppDbContext ctx, Guid usuario, Guid? categoria, decimal valor, DateOnly data,
        StatusTransacao status = StatusTransacao.Executado, Action<Transacao>? ajuste = null)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Gasto", Valor = valor, Tipo = TipoTransacao.Despesa, CategoriaId = categoria,
            CriadoPor = usuario, Data = data, StatusTransacao = status, Ativo = true,
        };
        ajuste?.Invoke(t);
        ctx.Transacoes.Add(t);
        ctx.SaveChanges();
    }

    private static Task<LimitesDoMesDto> Definir(OrcamentoService svc, Guid usuario, Guid? categoria, decimal valor, int ano, int mes) =>
        svc.DefinirAsync(new DefinirLimiteDto(categoria, ano, mes, valor), usuario, Agora);

    // ── Gasto do mês (regra única) ──────────────────────────────────────────

    [Fact]
    public async Task Gasto_SoDespesaQueEntraNoResultado_PrevistaSeparada_OutroMesFora()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var cat = SeedCategoria(ctx);
        Gasto(ctx, u, cat, 300m, new DateOnly(2026, 5, 3));
        Gasto(ctx, u, cat, 500m, new DateOnly(2026, 5, 4), ajuste: t => t.EhTransferencia = true);
        Gasto(ctx, u, cat, 539.22m, new DateOnly(2026, 5, 5), ajuste: t => t.EhPixNoCredito = true); // o gasto é do cartão
        Gasto(ctx, u, cat, 40m, new DateOnly(2026, 5, 6), ajuste: t => t.EhAjusteReconciliacao = true);
        Gasto(ctx, u, cat, 70m, new DateOnly(2026, 5, 7), ajuste: t => t.Ativo = false);
        Gasto(ctx, u, cat, 120m, new DateOnly(2026, 5, 20), StatusTransacao.Previsao); // conta fixa que ainda vai cair
        Gasto(ctx, u, cat, 999m, new DateOnly(2026, 6, 1));

        var g = (await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(ctx, u, 2026, 5))[cat];

        Assert.Equal(300m, g.Gasto);
        Assert.Equal(120m, g.Previsto);
    }

    [Fact]
    public async Task Gasto_CompraParcelada_ContaAParcelaDoMesComJuros_CanceladaNao()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var cat = SeedCategoria(ctx, "Casa");
        var parcelamento = new Parcelamento
        {
            Id = Guid.NewGuid(), CriadoPor = u, Descricao = "Geladeira", DataCompra = new DateTime(2026, 4, 20), ValorTotal = 3000m,
            QuantidadeParcelas = 3, CartaoCreditoId = Guid.NewGuid(), CategoriaId = cat,
        };
        ctx.Parcelamentos.Add(parcelamento);
        ParcelaTransacao Parcela(int n, DateTime venc, decimal? juros = null, StatusParcela status = StatusParcela.Pendente) => new()
        {
            Id = Guid.NewGuid(), ParcelamentoId = parcelamento.Id, Numero = n, QuantidadeTotal = 3, DataVencimento = venc,
            Valor = 1000m, ValorComJuros = juros, FaturaId = Guid.NewGuid(), Status = status, CriadoPor = u,
        };
        ctx.ParcelasTransacao.AddRange(
            Parcela(1, new DateTime(2026, 4, 20)),
            Parcela(2, new DateTime(2026, 5, 20), juros: 1050m),
            Parcela(3, new DateTime(2026, 6, 20), status: StatusParcela.Cancelada));
        ctx.SaveChanges();

        var maio = await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(ctx, u, 2026, 5);
        var junho = await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(ctx, u, 2026, 6);

        Assert.Equal(1050m, maio[cat].Gasto); // só a parcela de maio, com juros (não os 3.000 da compra)
        Assert.False(junho.ContainsKey(cat));  // a de junho foi cancelada
    }

    // ── Vale todo mês até mudar ─────────────────────────────────────────────

    [Fact]
    public async Task Definir_ValeNosMesesSeguintes_ComGastoESituacao()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var mercado = SeedCategoria(ctx, "Mercado");
        var restaurante = SeedCategoria(ctx, "Restaurante");
        var transporte = SeedCategoria(ctx, "Transporte");
        var svc = new OrcamentoService(ctx);
        await Definir(svc, u, mercado, 1000m, 2026, 5);
        await Definir(svc, u, restaurante, 300m, 2026, 5);
        await Definir(svc, u, transporte, 400m, 2026, 5);
        Gasto(ctx, u, mercado, 850m, new DateOnly(2026, 7, 2));
        Gasto(ctx, u, restaurante, 410m, new DateOnly(2026, 7, 3));
        Gasto(ctx, u, transporte, 100m, new DateOnly(2026, 7, 4));

        var julho = await svc.DoMesAsync(u, 2026, 7, Agora);

        Assert.True(julho.Editavel);
        Assert.Equal(["Restaurante", "Mercado", "Transporte"], julho.Limites.Select(l => l.Categoria)); // atenção primeiro
        var r = julho.Limites[0];
        Assert.Equal(("passou", -110m, 2026, 5), (r.Situacao, r.Sobra, r.DesdeAno, r.DesdeMes)); // vale desde maio
        Assert.Equal("perto", julho.Limites[1].Situacao); // 85% ≥ 80%
        Assert.Equal("ok", julho.Limites[2].Situacao);
        Assert.Equal(1700m, julho.TotalLimite);
        Assert.Equal(1360m, julho.TotalGasto);
    }

    [Fact]
    public async Task Mudar_ValeDoMesEmDiante_OMesAnteriorGuardaOAntigo_EApagaOQueHaviaDepois()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var cat = SeedCategoria(ctx);
        var svc = new OrcamentoService(ctx);
        await Definir(svc, u, cat, 1000m, 2026, 5);
        await Definir(svc, u, cat, 1500m, 2026, 8);
        await Definir(svc, u, cat, 1200m, 2026, 7); // vale de julho pra frente: o de agosto sai

        Assert.Equal(1000m, Assert.Single((await svc.DoMesAsync(u, 2026, 6, Agora)).Limites).Limite);
        Assert.Equal(1200m, Assert.Single((await svc.DoMesAsync(u, 2026, 7, Agora)).Limites).Limite);
        Assert.Equal(1200m, Assert.Single((await svc.DoMesAsync(u, 2026, 12, Agora)).Limites).Limite);
        Assert.Equal(2, ctx.Orcamentos.Count());
    }

    [Fact]
    public async Task Tirar_SaiDoMesEmDiante_OsPassadosContinuam_SemLimiteDa404()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var cat = SeedCategoria(ctx);
        var svc = new OrcamentoService(ctx);
        await Definir(svc, u, cat, 1000m, 2026, 5);
        await Definir(svc, u, cat, 900m, 2026, 9);

        var julho = await svc.TirarAsync(cat, 2026, 7, u, Agora);

        Assert.Empty(julho.Limites);
        Assert.Single((await svc.DoMesAsync(u, 2026, 6, Agora)).Limites); // junho continua com o de maio
        Assert.Empty((await svc.DoMesAsync(u, 2026, 10, Agora)).Limites); // o de setembro saiu junto
        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.TirarAsync(cat, 2026, 8, u, Agora));
        // Pôr de novo depois de tirar volta a valer.
        await Definir(svc, u, cat, 500m, 2026, 8);
        Assert.Equal(500m, Assert.Single((await svc.DoMesAsync(u, 2026, 11, Agora)).Limites).Limite);
    }

    [Fact]
    public async Task MesQuePassou_FicaComoEstava()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var cat = SeedCategoria(ctx);
        var svc = new OrcamentoService(ctx);
        ctx.Orcamentos.Add(new Orcamento { Id = Guid.NewGuid(), UsuarioId = u, CategoriaId = cat, Ano = 2026, Mes = 3, ValorLimite = 800m });
        ctx.SaveChanges();

        var abril = await svc.DoMesAsync(u, 2026, 4, Agora);

        Assert.False(abril.Editavel);
        Assert.Equal(800m, Assert.Single(abril.Limites).Limite);
        await Assert.ThrowsAsync<InvalidOperationException>(() => Definir(svc, u, cat, 100m, 2026, 4));
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.TirarAsync(cat, 2026, 4, u, Agora));
        Assert.True((await svc.DoMesAsync(u, 2026, 5, Agora)).Editavel);
        // No dia 1º em UTC ainda é o mês anterior em Brasília: um dia de folga.
        Assert.True((await svc.DoMesAsync(u, 2026, 4, new DateTime(2026, 5, 1, 1, 0, 0))).Editavel);
    }

    // ── O que ainda vem: "vai passar" e a resposta ───────────────────────────

    [Fact]
    public async Task AindaVem_EntraNaResposta_ENaSituacao_NuncaNaSobra()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var moradia = SeedCategoria(ctx, "Moradia");
        var svc = new OrcamentoService(ctx);
        await Definir(svc, u, moradia, 1900m, 2026, 5);
        Gasto(ctx, u, moradia, 1765m, new DateOnly(2026, 5, 3));
        var internet = Guid.NewGuid();
        Gasto(ctx, u, moradia, 99.90m, new DateOnly(2026, 5, 20), StatusTransacao.Previsao, t => { t.Descricao = "Internet"; t.RecorrenteOrigemId = internet; });

        var l = Assert.Single((await svc.DoMesAsync(u, 2026, 5, Agora)).Limites);
        Assert.Equal("perto", l.Situacao);
        Assert.Equal(135m, l.Sobra); // a sobra é só o que já aconteceu
        Assert.Equal(("Internet", (Guid?)internet), (Assert.Single(l.AindaVem).Descricao, l.AindaVem[0].ContaFixaId));
        Assert.Equal("Ainda vem Internet (dia 20, R$ 99,90). Contando isso, dá pra gastar mais R$ 35,10 sem passar.", l.Resposta);

        Gasto(ctx, u, moradia, 50m, new DateOnly(2026, 5, 25), StatusTransacao.Previsao, t => t.Descricao = "Gás");
        l = Assert.Single((await svc.DoMesAsync(u, 2026, 5, Agora)).Limites);
        Assert.Equal("vai-passar", l.Situacao);
        Assert.Equal("Ainda vêm 2 contas (R$ 149,90). Contando isso, passa R$ 14,90 do planejado.", l.Resposta);

        Gasto(ctx, u, moradia, 200m, new DateOnly(2026, 5, 9));
        l = Assert.Single((await svc.DoMesAsync(u, 2026, 5, Agora)).Limites);
        Assert.Equal("passou", l.Situacao);
        Assert.Equal("Passou R$ 65,00. Ainda vêm 2 contas (R$ 149,90). Pausar ou cancelar uma dessas contas alivia o mês.", l.Resposta);
    }

    [Fact]
    public async Task VaiPassar_VemAntesDePerto_EOkSemNadaPraDizer()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var a = SeedCategoria(ctx, "A");
        var b = SeedCategoria(ctx, "B");
        var c = SeedCategoria(ctx, "C");
        var svc = new OrcamentoService(ctx);
        await Definir(svc, u, a, 100m, 2026, 5);
        await Definir(svc, u, b, 100m, 2026, 5);
        await Definir(svc, u, c, 100m, 2026, 5);
        Gasto(ctx, u, a, 90m, new DateOnly(2026, 5, 3));                           // perto (90%)
        Gasto(ctx, u, b, 50m, new DateOnly(2026, 5, 3));
        Gasto(ctx, u, b, 60m, new DateOnly(2026, 5, 28), StatusTransacao.Previsao); // vai passar
        Gasto(ctx, u, c, 10m, new DateOnly(2026, 5, 3));                           // ok

        var limites = (await svc.DoMesAsync(u, 2026, 5, Agora)).Limites;

        Assert.Equal([("B", "vai-passar"), ("A", "perto"), ("C", "ok")], limites.Select(l => (l.Categoria, l.Situacao)));
        Assert.Null(limites[2].Resposta);
        Assert.Equal("Dá pra gastar mais R$ 10,00 sem passar.", limites[1].Resposta);
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
    public async Task Limite_MostraAsParcelasJaCompradasDaCategoriaPraFrente()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var casa = SeedCategoria(ctx, "Casa");
        var outra = SeedCategoria(ctx, "Outra");
        var svc = new OrcamentoService(ctx);
        await Definir(svc, u, casa, 1500m, 2026, 5);
        Parcelado(ctx, u, casa, 400m, (5, StatusParcela.Pendente), (6, StatusParcela.Pendente), (7, StatusParcela.Pendente));
        Parcelado(ctx, u, outra, 999m, (6, StatusParcela.Pendente));

        var l = Assert.Single((await svc.DoMesAsync(u, 2026, 5, Agora)).Limites);

        Assert.Equal(400m, l.Gasto); // a de maio conta no mês
        Assert.Equal((800m, (int?)2026, (int?)7), (l.ParcelasFuturas, l.ParcelasAteAno, l.ParcelasAteMes)); // junho e julho, só da categoria
    }

    // ── Sem limite, sugestão, validação ─────────────────────────────────────

    [Fact]
    public async Task SemLimite_QuemGastouPrimeiro_DepoisTodaCategoriaDeGastoSemGasto_EOutroUsuarioNaoAparece()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var outro = SeedUsuario(ctx, "outro@test.com");
        var mercado = SeedCategoria(ctx, "Mercado");
        var lazer = SeedCategoria(ctx, "Lazer");
        SeedCategoria(ctx, "Pets", dono: u);                       // da pessoa, sem gasto: aparece no fim
        SeedCategoria(ctx, "Do outro", dono: outro);               // de outra pessoa: nunca
        SeedCategoria(ctx, "Salário", Finalidade.Receita);         // de receita: fica nas Receitas
        var svc = new OrcamentoService(ctx);
        await Definir(svc, u, mercado, 1000m, 2026, 5);
        await Definir(svc, outro, lazer, 50m, 2026, 5);
        Gasto(ctx, u, mercado, 100m, new DateOnly(2026, 5, 2));
        Gasto(ctx, u, lazer, 250m, new DateOnly(2026, 5, 3));
        Gasto(ctx, u, null, 30m, new DateOnly(2026, 5, 4));
        Gasto(ctx, outro, mercado, 9999m, new DateOnly(2026, 5, 4));

        var maio = await svc.DoMesAsync(u, 2026, 5, Agora);

        Assert.Equal(100m, Assert.Single(maio.Limites).Gasto); // o gasto do outro não entra
        Assert.Equal([("Lazer", 250m), ("Sem categoria", 30m), ("Pets", 0m)], maio.SemLimite.Select(s => (s.Categoria, s.Gasto)));
    }

    [Fact]
    public async Task Sugestao_MediaDos3MesesAnteriores()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var cat = SeedCategoria(ctx);
        var svc = new OrcamentoService(ctx);
        Gasto(ctx, u, cat, 900m, new DateOnly(2026, 2, 10));
        Gasto(ctx, u, cat, 600m, new DateOnly(2026, 3, 10));
        Gasto(ctx, u, cat, 300m, new DateOnly(2026, 4, 10));
        Gasto(ctx, u, cat, 5000m, new DateOnly(2026, 5, 10)); // o próprio mês não entra
        Gasto(ctx, u, cat, 5000m, new DateOnly(2026, 1, 10)); // nem antes dos 3

        Assert.Equal(600m, (await svc.SugestaoAsync(u, cat, 2026, 5)).MediaUltimos3Meses);
        Assert.Null((await svc.SugestaoAsync(u, cat, 2026, 1)).MediaUltimos3Meses);
    }

    [Fact]
    public async Task Definir_CategoriaDeReceitaOuDeOutro_ValorInvalido_Recusa()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var outro = SeedUsuario(ctx, "outro@test.com");
        var salario = SeedCategoria(ctx, "Salário", Finalidade.Receita);
        var deOutro = SeedCategoria(ctx, "Do outro", dono: outro);
        var cat = SeedCategoria(ctx);
        var svc = new OrcamentoService(ctx);

        await Assert.ThrowsAsync<ArgumentException>(() => Definir(svc, u, salario, 100m, 2026, 5));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => Definir(svc, u, deOutro, 100m, 2026, 5));
        await Assert.ThrowsAsync<ArgumentException>(() => Definir(svc, u, cat, 0m, 2026, 5));
        await Assert.ThrowsAsync<ArgumentException>(() => Definir(svc, u, cat, 10m, 2026, 13));
        Assert.Empty(ctx.Orcamentos);
    }

    [Fact]
    public async Task LimiteDeTodosOsGastos_SomaTudo_ENaoEntraNosTotais()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var cat = SeedCategoria(ctx);
        var svc = new OrcamentoService(ctx);
        await Definir(svc, u, null, 2000m, 2026, 5);
        Gasto(ctx, u, cat, 700m, new DateOnly(2026, 5, 2));
        Gasto(ctx, u, null, 100m, new DateOnly(2026, 5, 3));

        var maio = await svc.DoMesAsync(u, 2026, 5, Agora);

        var geral = Assert.Single(maio.Limites);
        Assert.Equal(("Todos os gastos", 800m), (geral.Categoria, geral.Gasto));
        Assert.Equal(0m, maio.TotalLimite); // os totais são das categorias com limite próprio
    }

    // ── Receitas: o que espera receber, por categoria de receita ─────────────

    private static void Receita(AppDbContext ctx, Guid usuario, Guid? categoria, decimal valor, DateOnly data,
        StatusTransacao status = StatusTransacao.Executado) =>
        Gasto(ctx, usuario, categoria, valor, data, status, t => { t.Tipo = TipoTransacao.Receita; t.Descricao = "Receita"; });

    [Fact]
    public async Task Receitas_PlanejadoPorCategoria_ComRecebidoOQueAindaVemEOQueCaiuSemPlanejado()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var salario = SeedCategoria(ctx, "Salário", Finalidade.Receita, u);
        var freela = SeedCategoria(ctx, "Freela", Finalidade.Receita, u);
        var aluguel = SeedCategoria(ctx, "Aluguel", Finalidade.Receita, u);
        var volta = SeedCategoria(ctx, RendaService.CategoriaDinheiroQueVolta, Finalidade.Receita);
        var mercado = SeedCategoria(ctx);
        var svc = new OrcamentoService(ctx);
        await svc.DefinirReceitaAsync(new DefinirFonteDto(salario, null, 2026, 5, 5000m), u, Agora);
        await svc.DefinirReceitaAsync(new DefinirFonteDto(freela, null, 2026, 5, 800m), u, Agora);
        await Definir(svc, u, mercado, 1000m, 2026, 5);
        Receita(ctx, u, salario, 5000m, new DateOnly(2026, 6, 5));
        Receita(ctx, u, freela, 300m, new DateOnly(2026, 6, 10));
        Receita(ctx, u, freela, 200m, new DateOnly(2026, 6, 25), StatusTransacao.Previsao);
        Receita(ctx, u, aluguel, 900m, new DateOnly(2026, 6, 1));
        Receita(ctx, u, volta, 40m, new DateOnly(2026, 6, 2)); // cashback: não é renda

        var junho = await svc.ReceitasDoMesAsync(u, 2026, 6, Agora); // vale todo mês até mudar

        Assert.Equal(["Salário", "Freela"], junho.Fontes.Select(r => r.Nome));
        Assert.Equal((800m, 300m, 200m), (junho.Fontes[1].Planejado, junho.Fontes[1].Realizado, junho.Fontes[1].AindaVem));
        Assert.Equal((5800m, 5300m, 200m), (junho.TotalPlanejado, junho.TotalRealizado, junho.TotalAindaVem));
        var sem = Assert.Single(junho.SemPlanejado); // toda categoria de receita aparece; aqui todas já estão (fora "Dinheiro que volta")
        Assert.Equal(("Aluguel", 900m, true), (sem.Nome, sem.Realizado, sem.Planejavel));
        SeedCategoria(ctx, "Bolsa", Finalidade.Receita, u);
        Assert.Equal(("Bolsa", 0m), (await svc.ReceitasDoMesAsync(u, 2026, 6, Agora)).SemPlanejado.Select(r => (r.Nome, r.Realizado)).Last());
        // As despesas não veem o planejado de receita, nem o contrário.
        Assert.Equal("Mercado", Assert.Single((await svc.DoMesAsync(u, 2026, 6, Agora)).Limites).Categoria);
    }

    [Fact]
    public async Task Receitas_SoCategoriaDeReceita_TirarValeDoMesEmDiante_EARendaEsperadaSegueOPlanejado()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var salario = SeedCategoria(ctx, "Salário", Finalidade.Receita, u);
        var freela = SeedCategoria(ctx, "Freela", Finalidade.Receita, u);
        var mercado = SeedCategoria(ctx);
        var volta = SeedCategoria(ctx, RendaService.CategoriaDinheiroQueVolta, Finalidade.Receita);
        var svc = new OrcamentoService(ctx);
        await Assert.ThrowsAsync<ArgumentException>(() => svc.DefinirReceitaAsync(new DefinirFonteDto(mercado, null, 2026, 5, 10m), u, Agora));
        await Assert.ThrowsAsync<ArgumentException>(() => svc.DefinirReceitaAsync(new DefinirFonteDto(volta, null, 2026, 5, 10m), u, Agora));
        await Assert.ThrowsAsync<ArgumentException>(() => Definir(svc, u, salario, 10m, 2026, 5)); // despesa não planeja receita

        // Antes de planejar por categoria vale a declaração antiga; depois, o planejado.
        ctx.Add(new RendaPrevista { Id = Guid.NewGuid(), UsuarioId = u, Ano = 2026, Mes = 5, FixaEsperada = 3000m, VariavelEsperada = 0m });
        ctx.SaveChanges();
        var renda = new RendaService(ctx);
        Assert.Equal(3000m, (await renda.ObterMesAsync(u, 2026, 5)).Previsto);
        await svc.DefinirReceitaAsync(new DefinirFonteDto(salario, null, 2026, 5, 5000m), u, Agora);
        await svc.DefinirReceitaAsync(new DefinirFonteDto(freela, null, 2026, 5, 800m), u, Agora);
        Assert.Equal(5800m, (await renda.ObterMesAsync(u, 2026, 7)).Previsto);

        var julho = await svc.TirarReceitaAsync(freela, null, 2026, 7, u, Agora);

        Assert.Equal("Salário", Assert.Single(julho.Fontes).Nome);
        Assert.Equal(2, (await svc.ReceitasDoMesAsync(u, 2026, 6, Agora)).Fontes.Count); // junho continua com as duas
        Assert.Equal(5000m, (await renda.ObterMesAsync(u, 2026, 7)).Previsto);
    }

    [Fact]
    public async Task Receitas_UmaLinhaPorSubcategoria_DaCategoriaDeRenda_EARendaEsperadaSomaTodas()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var renda = SeedCategoria(ctx, "Renda", Finalidade.Receita);
        var mercado = SeedCategoria(ctx);
        Guid Sub(string nome, Guid categoria)
        {
            var x = new Subcategoria { Id = Guid.NewGuid(), Nome = nome, CategoriaId = categoria };
            ctx.Subcategorias.Add(x);
            ctx.SaveChanges();
            return x.Id;
        }
        var salario = Sub("Salário", renda);
        var freela = Sub("Freelance e PJ", renda);
        Sub("Aposentadoria", renda);
        var feira = Sub("Feira", mercado);
        var svc = new OrcamentoService(ctx);
        await svc.DefinirReceitaAsync(new DefinirFonteDto(renda, salario, 2026, 5, 5000m), u, Agora);
        await svc.DefinirReceitaAsync(new DefinirFonteDto(renda, freela, 2026, 5, 800m), u, Agora);
        await Assert.ThrowsAsync<ArgumentException>(() => svc.DefinirReceitaAsync(new DefinirFonteDto(renda, feira, 2026, 5, 1m), u, Agora));
        Gasto(ctx, u, renda, 5000m, new DateOnly(2026, 5, 5), ajuste: t => { t.Tipo = TipoTransacao.Receita; t.SubcategoriaId = salario; });
        Gasto(ctx, u, renda, 12m, new DateOnly(2026, 5, 6), ajuste: t => t.Tipo = TipoTransacao.Receita); // sem subcategoria

        var maio = await svc.ReceitasDoMesAsync(u, 2026, 5, Agora);

        Assert.Equal([("Salário", 5000m, 5000m), ("Freelance e PJ", 800m, 0m)], maio.Fontes.Select(r => (r.Nome, r.Planejado, r.Realizado)));
        Assert.All(maio.Fontes, r => Assert.Equal("Renda", r.Categoria));
        // Recebeu sem subcategoria: a categoria inteira, com nome que diz isso; depois a fonte sem nada.
        Assert.Equal([("Renda (sem subcategoria)", 12m), ("Aposentadoria", 0m)], maio.SemPlanejado.Select(r => (r.Nome, r.Realizado)));
        Assert.Equal(5800m, (await new RendaService(ctx).ObterMesAsync(u, 2026, 5)).Previsto);

        var semFreela = await svc.TirarReceitaAsync(renda, freela, 2026, 5, u, Agora);
        Assert.Equal("Salário", Assert.Single(semFreela.Fontes).Nome);
    }

    // ── Investimentos: aporte e resgate, fora do resultado ───────────────────

    [Fact]
    public async Task Investimento_MarcaSozinho_FicaForaDoGasto_EASecaoContaAporteMenosResgate()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var investimentos = SeedCategoria(ctx, "Investimentos", Finalidade.Investimento);
        var tesouro = new Subcategoria { Id = Guid.NewGuid(), Nome = "Tesouro Direto", CategoriaId = investimentos };
        var acoes = new Subcategoria { Id = Guid.NewGuid(), Nome = "Ações e fundos", CategoriaId = investimentos };
        ctx.Subcategorias.AddRange(tesouro, acoes);
        ctx.SaveChanges();
        var mercado = SeedCategoria(ctx);
        var svc = new OrcamentoService(ctx);
        await svc.DefinirInvestimentoAsync(new DefinirFonteDto(investimentos, tesouro.Id, 2026, 5, 1000m), u, Agora);
        await Assert.ThrowsAsync<ArgumentException>(() => svc.DefinirInvestimentoAsync(new DefinirFonteDto(mercado, null, 2026, 5, 1m), u, Agora));
        await Assert.ThrowsAsync<ArgumentException>(() => Definir(svc, u, investimentos, 1m, 2026, 5)); // despesa não planeja investimento
        Gasto(ctx, u, investimentos, 1200m, new DateOnly(2026, 5, 5), ajuste: t => t.SubcategoriaId = tesouro.Id);       // aporte
        Gasto(ctx, u, investimentos, 300m, new DateOnly(2026, 5, 20), ajuste: t => { t.Tipo = TipoTransacao.Receita; t.SubcategoriaId = tesouro.Id; }); // resgate
        Gasto(ctx, u, mercado, 100m, new DateOnly(2026, 5, 6));

        Assert.True(ctx.Transacoes.Single(t => t.Valor == 1200m).EhInvestimento); // o AppDbContext marca pela categoria
        Assert.False(ctx.Transacoes.Single(t => t.Valor == 100m).EhInvestimento);
        var gastos = await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(ctx, u, 2026, 5);
        Assert.Equal([mercado], gastos.Keys); // aporte não é gasto
        Assert.DoesNotContain((await svc.DoMesAsync(u, 2026, 5, Agora)).SemLimite, x => x.CategoriaId == investimentos);

        var maio = await svc.InvestimentosDoMesAsync(u, 2026, 5, Agora);

        var linha = Assert.Single(maio.Fontes);
        Assert.Equal(("Tesouro Direto", 1000m, 900m), (linha.Nome, linha.Planejado, linha.Realizado)); // 1.200 − 300
        Assert.Equal(["Ações e fundos"], maio.SemPlanejado.Select(r => r.Nome));
    }

    [Fact]
    public async Task Categoria_QueViraInvestimento_LevaOsLancamentosDelaPraForaDoResultado()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var poupar = SeedCategoria(ctx, "Poupar", Finalidade.Ambas, u);
        Gasto(ctx, u, poupar, 500m, new DateOnly(2026, 5, 5));
        Assert.False(ctx.Transacoes.Single().EhInvestimento);

        var svc = new CategoriaService(ctx);
        await svc.AtualizarAsync(poupar, "Poupar", Finalidade.Investimento, u);
        Assert.True(ctx.Transacoes.Single().EhInvestimento);
        await svc.AtualizarAsync(poupar, "Poupar", Finalidade.Despesa, u);
        Assert.False(ctx.Transacoes.Single().EhInvestimento);
    }
}

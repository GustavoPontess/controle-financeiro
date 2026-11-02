using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.DTOs.Relatorios;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// O check-up do mês (Relatórios do v2): entrou, saiu e sobrou; comprometido (contas fixas + parcelas) contra a
/// renda; cada categoria contra o normal dela (média dos meses anteriores com gasto); a série de 12 meses; a reserva
/// em meses; e a resposta em frase. Tudo pelas regras únicas.
/// </summary>
public class CheckUpServiceTests
{
    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    private static CheckUpService Servico(AppDbContext ctx) =>
        new(ctx, new RendaService(ctx), new RecorrenteService(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx)));

    private sealed record Cenario(AppDbContext Ctx, Guid U, Guid Conta, Guid Mercado, Guid Lazer, Guid Salario);

    private static Cenario Seed()
    {
        var ctx = CreateContext();
        var u = new Usuario { Id = Guid.NewGuid(), Email = Guid.NewGuid() + "@t.com", Nome = "U", PasswordHash = "x" };
        Categoria Cat(string nome, Finalidade f) => new() { Id = Guid.NewGuid(), Descricao = nome, Finalidade = f };
        var mercado = Cat("Mercado", Finalidade.Despesa);
        var lazer = Cat("Lazer", Finalidade.Despesa);
        var salario = Cat("Renda", Finalidade.Receita);
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Conta", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = u.Id };
        ctx.AddRange(u, mercado, lazer, salario, conta);
        ctx.SaveChanges();
        return new Cenario(ctx, u.Id, conta.Id, mercado.Id, lazer.Id, salario.Id);
    }

    private static void Lancar(Cenario c, Guid categoria, decimal valor, int mes, TipoTransacao tipo = TipoTransacao.Despesa)
    {
        c.Ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "x", Valor = valor, Tipo = tipo, CategoriaId = categoria, ContaId = c.Conta, CriadoPor = c.U,
            Data = new DateOnly(2026, mes, 10), StatusTransacao = StatusTransacao.Executado, Ativo = true,
        });
        c.Ctx.SaveChanges();
    }

    [Fact]
    public async Task MesSemNada_DizQueNaoHaLancamento()
    {
        var c = Seed();
        var r = await Servico(c.Ctx).CalcularAsync(c.U, 2026, 10);
        Assert.Equal((0m, 0m), (r.Entrou, r.Saiu));
        Assert.Equal("Nada lançado em outubro ainda.", r.Resposta.Texto);
        Assert.Equal(12, r.MesAMes.Count);
    }

    [Fact]
    public async Task EntrouSaiuSobrou_CategoriaContraONormal_ReservaEmMeses_EAResposta()
    {
        var c = Seed();
        // Agosto e setembro: salário 5.000, mercado 500, lazer 200 (normal 700). Outubro: mercado 900 (+80%), lazer 100.
        foreach (var mes in new[] { 8, 9 })
        {
            Lancar(c, c.Salario, 5000m, mes, TipoTransacao.Receita);
            Lancar(c, c.Mercado, 500m, mes);
            Lancar(c, c.Lazer, 200m, mes);
        }
        Lancar(c, c.Salario, 5000m, 10, TipoTransacao.Receita);
        Lancar(c, c.Mercado, 900m, 10);
        Lancar(c, c.Lazer, 100m, 10);

        var r = await Servico(c.Ctx).CalcularAsync(c.U, 2026, 10);

        Assert.Equal((5000m, 1000m, 4000m, 80m), (r.Entrou, r.Saiu, r.Sobrou, r.PercentualQueSobrou));
        var mercado = r.PraOndeFoi[0];
        Assert.Equal(("Mercado", 900m, 500m, 80m), (mercado.Nome, mercado.Valor, mercado.Normal, mercado.VariacaoPercentual));
        Assert.Equal(-50m, r.PraOndeFoi[1].VariacaoPercentual);
        Assert.Equal(700m, r.GastoNormal);
        // Saldo hoje: 3 × 5.000 − (700 + 700 + 1.000) = 12.600 → 18 meses do gasto normal de 700.
        Assert.Equal(12600m, r.DinheiroGuardado);
        Assert.Equal(18m, r.MesesDeReserva);
        // Pelo mês, não "os 3 últimos": o gráfico termina no mês de HOJE e, a partir de novembro, outubro já não era o
        // último (quebrou em 2026-11-01).
        Assert.Equal(new[] { 4300m, 4300m, 4000m }, r.MesAMes.Where(m => m.Ano == 2026 && m.Mes is >= 8 and <= 10).Select(m => m.Sobrou));
        Assert.Equal("positivo", r.Resposta.Tom);
        Assert.Contains("sobraram R$ 4.000,00 (80% do que entrou)", r.Resposta.Texto);
        Assert.Contains("Mercado veio 80% acima do normal.", r.Resposta.Texto);
        Assert.Contains("cobre 18 meses", r.Resposta.Texto);
        Assert.DoesNotContain("levam 0%", r.Resposta.Texto); // sem conta fixa nem parcela, a frase sai
        Assert.Contains(r.Resposta.Acoes, a => a.Rotulo == "Ver o planejado" && a.Para == "/orcamento");
    }

    [Fact]
    public async Task EscolherMesAnterior_OMesAMesSegueTerminandoNoMesAtual()
    {
        // Tocar num mês do gráfico não pode sumir com os meses depois dele (bug visto pelo Gustavo em 2026-10-29).
        var c = Seed();
        var hoje = HorarioBrasil.HojeData();
        var escolhido = new DateTime(hoje.Year, hoje.Month, 1).AddMonths(-2);
        c.Ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "x", Valor = 300m, Tipo = TipoTransacao.Despesa, CategoriaId = c.Mercado, ContaId = c.Conta,
            CriadoPor = c.U, Data = new DateOnly(escolhido.Year, escolhido.Month, 10), StatusTransacao = StatusTransacao.Executado, Ativo = true,
        });
        c.Ctx.SaveChanges();

        var r = await Servico(c.Ctx).CalcularAsync(c.U, escolhido.Year, escolhido.Month);

        Assert.Equal(300m, r.Saiu);
        Assert.Equal(12, r.MesAMes.Count);
        Assert.Equal((hoje.Year, hoje.Month), (r.MesAMes[^1].Ano, r.MesAMes[^1].Mes));
        Assert.Equal(300m, r.MesAMes[^3].Saiu);
    }

    [Fact]
    public async Task SaiuMaisDoQueEntrou_FaladoComoFato_EComprometidoComAsContasFixas()
    {
        var c = Seed();
        Lancar(c, c.Salario, 1000m, 10, TipoTransacao.Receita);
        Lancar(c, c.Mercado, 1500m, 10);
        c.Ctx.Recorrentes.Add(new Recorrente
        {
            Id = Guid.NewGuid(), Descricao = "Aluguel", Valor = 500m, Tipo = TipoTransacao.Despesa, ContaId = c.Conta, Ativo = true,
            Frequencia = FrequenciaRecorrencia.Mensal, Dia = 5, DataInicio = new DateTime(2026, 1, 1), CriadoPor = c.U,
        });
        c.Ctx.SaveChanges();

        var r = await Servico(c.Ctx).CalcularAsync(c.U, 2026, 10);

        Assert.Equal(-500m, r.Sobrou);
        Assert.Equal(500m, r.ContasFixasPorMes);
        Assert.Equal(50m, r.PercentualComprometido); // 500 ÷ renda de 1.000
        Assert.Equal("negativo", r.Resposta.Tom);
        Assert.Contains("entraram R$ 1.000,00 e saíram R$ 1.500,00: R$ 500,00 a mais do que entrou.", r.Resposta.Texto);
        Assert.Contains("levam 50% da renda", r.Resposta.Texto);
        Assert.DoesNotContain("deve", r.Resposta.Texto);
        Assert.Contains(r.Resposta.Acoes, a => a.Rotulo == "Dizer a renda" && a.Para == "/orcamento"); // sem renda esperada declarada
    }

    [Fact]
    public async Task MesInvalido_Recusa_EMesQueAindaNaoChegouTambem()
    {
        var c = Seed();
        await Assert.ThrowsAsync<ArgumentException>(() => Servico(c.Ctx).CalcularAsync(c.U, 2026, 13));
        var e = await Assert.ThrowsAsync<ArgumentException>(() => Servico(c.Ctx).CalcularAsync(c.U, 2100, 12));
        Assert.Equal("Esse mês ainda não chegou.", e.Message);
    }

    private static void LancarSemCategoria(Cenario c, decimal valor, int mes)
    {
        c.Ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "importado", Valor = valor, Tipo = TipoTransacao.Despesa, ContaId = c.Conta, CriadoPor = c.U,
            Data = new DateOnly(2026, mes, 12), StatusTransacao = StatusTransacao.Executado, Ativo = true,
        });
        c.Ctx.SaveChanges();
    }

    [Fact]
    public async Task SemCategoria_ForaDoRanking_AvisoEmSeusDados_EFraseComClassificar()
    {
        var c = Seed();
        Lancar(c, c.Salario, 3000m, 9, TipoTransacao.Receita);
        Lancar(c, c.Mercado, 400m, 9);
        LancarSemCategoria(c, 700m, 9);
        LancarSemCategoria(c, 300m, 9);

        var r = await Servico(c.Ctx).CalcularAsync(c.U, 2026, 9);

        Assert.All(r.PraOndeFoi, x => Assert.NotEqual("Sem categoria", x.Nome)); // fora do ranking
        Assert.Equal((1000m, 2), (r.SemCategoria!.Valor, r.SemCategoria.Quantidade));
        // Mais de 30% do que saiu sem categoria: a frase avisa e a primeira ação é classificar (e o aviso não repete).
        Assert.Contains("R$ 1.000,00 do mês ainda sem categoria.", r.Resposta.Texto);
        Assert.Equal("Classificar", r.Resposta.Acoes[0].Rotulo);
        Assert.Equal($"/transacoes?categoriaId={Guid.Empty}&mes=2026-09", r.Resposta.Acoes[0].Para);
        Assert.DoesNotContain(r.Sinais, s => s.Chave.StartsWith("sem-categoria"));

        // Pouco sem categoria: a frase não fala, o aviso em "Seus dados" fala.
        Lancar(c, c.Mercado, 9000m, 9);
        var pouco = await Servico(c.Ctx).CalcularAsync(c.U, 2026, 9);
        var sinal = Assert.Single(pouco.Sinais, s => s.Origem == "dados" && s.Chave.StartsWith("sem-categoria"));
        Assert.Equal("2 lançamentos de setembro ainda sem categoria (R$ 1.000,00).", sinal.Resposta.Texto);
        Assert.DoesNotContain("ainda sem categoria", pouco.Resposta.Texto);
    }

    [Fact]
    public async Task Reserva_SemACaixinhaDasMetas_QueApareceAParte()
    {
        var c = Seed();
        var caixinha = new Conta { Id = Guid.NewGuid(), Nome = "Viagem", Tipo = TipoConta.Caixinha, UsuarioIdProprietario = c.U };
        c.Ctx.Contas.Add(caixinha);
        c.Ctx.SaveChanges();
        foreach (var mes in new[] { 7, 8, 9 })
        {
            Lancar(c, c.Salario, 2000m, mes, TipoTransacao.Receita);
            Lancar(c, c.Mercado, 1000m, mes);
        }
        c.Ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Guardar", Valor = 5000m, Tipo = TipoTransacao.Receita, ContaId = caixinha.Id, CriadoPor = c.U,
            Data = new DateOnly(2026, 9, 20), StatusTransacao = StatusTransacao.Executado, Ativo = true, EhTransferencia = true,
        });
        using (c.Ctx.LiberarCaixinha()) c.Ctx.SaveChanges(); // só Metas mexe na caixinha

        var r = await Servico(c.Ctx).CalcularAsync(c.U, 2026, 9);

        Assert.Equal(3000m, r.DinheiroGuardado); // 3 × (2.000 − 1.000); a caixinha não entra
        Assert.Equal(5000m, r.GuardadoNasMetas);
        Assert.Equal(3m, r.MesesDeReserva);       // 3.000 ÷ 1.000 de gasto normal
        Assert.Equal("neutro", r.RespostaReserva!.Tom);
    }

    [Fact]
    public async Task TotalAcimaDoNormal_NaFrase_ECortarOndeComAsCategoriasQuePassaram()
    {
        var c = Seed();
        foreach (var mes in new[] { 6, 7, 8 })
        {
            Lancar(c, c.Salario, 3000m, mes, TipoTransacao.Receita);
            Lancar(c, c.Mercado, 800m, mes);
            Lancar(c, c.Lazer, 200m, mes);
        }
        Lancar(c, c.Salario, 3000m, 9, TipoTransacao.Receita);
        Lancar(c, c.Mercado, 1100m, 9); // +300 (37%)
        Lancar(c, c.Lazer, 500m, 9);    // +300 (150%)

        var r = await Servico(c.Ctx).CalcularAsync(c.U, 2026, 9);

        Assert.Contains("Saiu 60% a mais que o normal dos últimos meses.", r.Resposta.Texto); // 1.600 contra 1.000
        Assert.Equal(new[] { "Mercado", "Lazer" }.OrderBy(x => x), r.Corte!.Itens.Select(i => i.Nome).OrderBy(x => x));
        Assert.Equal("Duas categorias passaram do normal em setembro: R$ 600,00 a mais, no total.", r.Corte.Resposta.Texto);
    }

    [Theory]
    [InlineData(0.4, "12 dias")]
    [InlineData(0.01, "1 dia")]
    [InlineData(1, "1 mês")]
    [InlineData(4.6, "4,6 meses")]
    public void Duracao_SemNumeroVago_DiasAbaixoDeUmMes(decimal meses, string esperado) =>
        Assert.Equal(esperado, CheckUpService.Duracao(meses));

    [Fact]
    public async Task Comprometido_SemContaFixa_DizOQueFazer_ENuncaSome()
    {
        var c = Seed();
        Lancar(c, c.Salario, 3000m, 9, TipoTransacao.Receita);
        Lancar(c, c.Mercado, 400m, 9);

        var r = await Servico(c.Ctx).CalcularAsync(c.U, 2026, 9);

        Assert.Equal(0m, r.PercentualComprometido);
        Assert.Equal("Nenhuma conta fixa cadastrada.", r.Comprometido.Resposta!.Texto);
        Assert.Equal("/contas-fixas/nova", Assert.Single(r.Comprometido.Resposta.Acoes).Para);
        Assert.Equal((40m, 60m), (r.Comprometido.FaixaAtencao, r.Comprometido.FaixaAlerta));
    }

    [Fact]
    public async Task MesAMes_TrazOInvestidoDeCadaMes_AporteMenosResgate_ForaDoSaiu()
    {
        // A linha do tempo de Relatórios mostra receita, despesa e investimentos lado a lado (Gustavo, 2026-11-01).
        var c = Seed();
        var xp = new Categoria { Id = Guid.NewGuid(), Descricao = "Renda fixa", Finalidade = Finalidade.Investimento };
        c.Ctx.Add(xp); c.Ctx.SaveChanges();
        Lancar(c, c.Salario, 5000m, 9, TipoTransacao.Receita);
        Lancar(c, c.Mercado, 800m, 9);
        void Investir(decimal valor, TipoTransacao tipo) => c.Ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "CDB", Valor = valor, Tipo = tipo, CategoriaId = xp.Id, ContaId = c.Conta, CriadoPor = c.U,
            Data = new DateOnly(2026, 9, 15), StatusTransacao = StatusTransacao.Executado, Ativo = true, EhInvestimento = true,
        });
        Investir(1000m, TipoTransacao.Despesa); // aporte
        Investir(200m, TipoTransacao.Receita);  // resgate
        c.Ctx.SaveChanges();

        var r = await Servico(c.Ctx).CalcularAsync(c.U, 2026, 9);

        var set = r.MesAMes.Single(m => m.Mes == 9);
        Assert.Equal((5000m, 800m, 800m), (set.Entrou, set.Saiu, set.Investido)); // investir não é gasto: fica fora do saiu
        Assert.Equal(0m, r.MesAMes.Single(m => m.Mes == 8).Investido);
    }

    [Fact]
    public async Task PraOndeFoi_TrazTodasAsCategorias_SemJuntarEmOutras()
    {
        // Relatórios mostra todas (as 5 maiores com cor, o resto recolhido na tela): o servidor não junta nenhuma.
        var c = Seed();
        for (var i = 1; i <= 8; i++)
        {
            var cat = new Categoria { Id = Guid.NewGuid(), Descricao = $"Cat {i}", Finalidade = Finalidade.Despesa };
            c.Ctx.Add(cat);
            c.Ctx.SaveChanges();
            Lancar(c, cat.Id, 100m * i, 9);
        }

        var r = await Servico(c.Ctx).CalcularAsync(c.U, 2026, 9);

        Assert.Equal(8, r.PraOndeFoi.Count);
        Assert.All(r.PraOndeFoi, x => Assert.NotNull(x.CategoriaId));
        Assert.Equal("Cat 8", r.PraOndeFoi[0].Nome); // as maiores primeiro
    }

    [Fact]
    public async Task Ano_RitmoContasFixasEReserva_PelosMesesFechados()
    {
        // 15/11/2026: os meses fechados com movimento são ago (entrou 5.000, saiu 500), set (saiu 500) e out (conta fixa 300).
        using var _ = HorarioBrasil.FixarParaTeste(new DateTime(2026, 11, 15, 15, 0, 0, DateTimeKind.Utc));
        var c = Seed();
        Lancar(c, c.Salario, 5000m, 8, TipoTransacao.Receita);
        Lancar(c, c.Mercado, 500m, 8);
        Lancar(c, c.Mercado, 500m, 9);
        c.Ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Aluguel", Valor = 300m, Tipo = TipoTransacao.Despesa, CategoriaId = c.Mercado, ContaId = c.Conta,
            CriadoPor = c.U, Data = new DateOnly(2026, 10, 5), StatusTransacao = StatusTransacao.Executado, Ativo = true, RecorrenteOrigemId = Guid.NewGuid(),
        });
        c.Ctx.SaveChanges();

        var r = await Servico(c.Ctx).AnoAsync(c.U, 2026);

        Assert.NotNull(r.Ritmo);
        Assert.Equal(3, r.Ritmo!.MesesNaMedia); // o mês em andamento (novembro) não entra na média
        Assert.Equal((1666.67m, 433.33m, 1233.33m), (r.Ritmo.EntrouPorMes, r.Ritmo.SaiuPorMes, r.Ritmo.SobrouPorMes));
        Assert.Equal(3700m + 1233.33m * 2, r.Ritmo.FechaOAnoCom); // o que sobrou até outubro + a média em nov e dez
        Assert.Equal((300m, 0m, 6m), (r.Comprometido!.ContasFixas, r.Comprometido.Parcelas, r.Comprometido.PercentualDoQueEntrou));
        Assert.Equal(433.33m, r.Reserva!.GastoMedioPorMes);

        // Num ano passado não há projeção (o ano já fechou).
        Assert.Null((await Servico(c.Ctx).AnoAsync(c.U, 2025)).Ritmo);
    }

    [Fact]
    public async Task Ano_SomaOsMeses_CategoriasContraOMesmoPeriodoDoAnoAnterior_ELimiteDoAno()
    {
        // "Ano completo": o ano somado. Mercado: 2025 (só ago) 300; 2026 ago 500 + set 400. Limite de Mercado R$ 600 desde
        // setembro de 2026: vale todo mês dali até o mês de hoje, e o limite do ano é a soma.
        var c = Seed();
        c.Ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "x", Valor = 300m, Tipo = TipoTransacao.Despesa, CategoriaId = c.Mercado, ContaId = c.Conta, CriadoPor = c.U,
            Data = new DateOnly(2025, 8, 10), StatusTransacao = StatusTransacao.Executado, Ativo = true,
        });
        Lancar(c, c.Salario, 5000m, 8, TipoTransacao.Receita);
        Lancar(c, c.Mercado, 500m, 8);
        Lancar(c, c.Mercado, 400m, 9);
        Lancar(c, c.Lazer, 100m, 9);
        c.Ctx.Orcamentos.Add(new Orcamento { Id = Guid.NewGuid(), UsuarioId = c.U, CategoriaId = c.Mercado, Ano = 2026, Mes = 9, ValorLimite = 600m });
        c.Ctx.SaveChanges();

        var r = await Servico(c.Ctx).AnoAsync(c.U, 2026);

        var ateMes = HorarioBrasil.HojeData().Year == 2026 ? HorarioBrasil.HojeData().Month : 12;
        Assert.Equal(Enumerable.Range(1, 12), r.Meses.Select(m => m.Mes)); // sempre jan a dez
        Assert.All(r.Meses.Where(m => m.Mes > ateMes), m => Assert.Equal((0m, 0m), (m.Entrou, m.Saiu)));
        if (ateMes < 12) Assert.Equal(600m, r.Meses.Single(m => m.Mes == 12).DespesasPlanejadas); // o que não chegou: só o planejado
        Assert.Equal((5000m, 1000m, 4000m), (r.Entrou, r.Saiu, r.Sobrou));
        Assert.Equal(600m * (ateMes - 8), r.DespesasPlanejadas);
        var mercado = r.Categorias[0];
        Assert.Equal(("Mercado", 900m, 90m), (mercado.Nome, mercado.Valor, mercado.PercentualDoGasto));
        Assert.Equal((300m, 200m), (mercado.Normal, mercado.VariacaoPercentual)); // contra ago/2025
        Assert.Equal(600m * (ateMes - 8), mercado.Limite);
        var lazer = r.Categorias[1];
        Assert.Equal((100m, (decimal?)0m, (decimal?)null), (lazer.Valor, lazer.Normal, lazer.Limite)); // nada em 2025: nova no ano
        Assert.Null(r.SemCategoria);
        Assert.Equal(2025, r.PrimeiroAno); // o lançamento de agosto de 2025

        // Um ano passado vai de janeiro a dezembro; um ano que não chegou é recusado.
        Assert.Equal(12, (await Servico(c.Ctx).AnoAsync(c.U, 2025)).Meses.Count);
        await Assert.ThrowsAsync<ArgumentException>(() => Servico(c.Ctx).AnoAsync(c.U, HorarioBrasil.HojeData().Year + 1));
    }

    [Fact]
    public async Task MesAMes_TrazOPlanejadoDeCadaMes_RendaEsperadaLimitesEInvestimentos_ValendoAteMudar()
    {
        // A linha do tempo mostra, por mês, o realizado (cor forte) contra o planejado (cor clara), como a planilha.
        var c = Seed();
        var xp = new Categoria { Id = Guid.NewGuid(), Descricao = "Renda fixa", Finalidade = Finalidade.Investimento };
        c.Ctx.Add(xp);
        c.Ctx.Add(new RendaPrevista { Id = Guid.NewGuid(), UsuarioId = c.U, Ano = 2026, Mes = 8, FixaEsperada = 6000m, VariavelEsperada = 0m });
        // Limite de Mercado desde julho (R$ 900) e mudado em setembro (R$ 700); limite geral ("todos os gastos") não soma;
        // investimento planejado desde agosto. Vale todo mês até mudar.
        c.Ctx.Orcamentos.AddRange(
            new Orcamento { Id = Guid.NewGuid(), UsuarioId = c.U, CategoriaId = c.Mercado, Ano = 2026, Mes = 7, ValorLimite = 900m },
            new Orcamento { Id = Guid.NewGuid(), UsuarioId = c.U, CategoriaId = c.Mercado, Ano = 2026, Mes = 9, ValorLimite = 700m },
            new Orcamento { Id = Guid.NewGuid(), UsuarioId = c.U, CategoriaId = null, Ano = 2026, Mes = 7, ValorLimite = 5000m },
            new Orcamento { Id = Guid.NewGuid(), UsuarioId = c.U, CategoriaId = xp.Id, Ano = 2026, Mes = 8, ValorLimite = 1000m });
        c.Ctx.SaveChanges();

        var r = await Servico(c.Ctx).CalcularAsync(c.U, 2026, 9);

        MesDoCheckUpDto Mes(int m) => r.MesAMes.Single(x => x.Mes == m);
        Assert.Equal((0m, 0m, 0m), (Mes(6).RendaEsperada, Mes(6).DespesasPlanejadas, Mes(6).InvestimentosPlanejados));
        Assert.Equal((0m, 900m, 0m), (Mes(7).RendaEsperada, Mes(7).DespesasPlanejadas, Mes(7).InvestimentosPlanejados));
        Assert.Equal((900m, 1000m), (Mes(8).DespesasPlanejadas, Mes(8).InvestimentosPlanejados));
        Assert.Equal((700m, 1000m), (Mes(9).DespesasPlanejadas, Mes(9).InvestimentosPlanejados));
        Assert.True(Mes(8).RendaEsperada >= 6000m); // a renda prevista de agosto (a regra dela mora em RendaService)
    }
}

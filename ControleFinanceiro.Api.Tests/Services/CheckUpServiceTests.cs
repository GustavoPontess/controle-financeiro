using ControleFinanceiro.Api.Domain.Entities;
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
        Assert.Equal(new[] { 4300m, 4300m, 4000m }, r.MesAMes.TakeLast(3).Select(m => m.Sobrou));
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
}

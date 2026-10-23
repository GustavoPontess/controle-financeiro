using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Meta;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// O orçamento do mês (tela Orçamento, base zero como a planilha do Gustavo): a renda esperada menos o planejado das
/// despesas menos os investimentos planejados é o "a ser alocado"; zerado, toda a renda tem destino. Metas ficam fora.
/// </summary>
public class OrcamentoDoMesServiceTests
{
    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    private static OrcamentoDoMesService Servico(AppDbContext ctx) =>
        new(new RendaService(ctx), new OrcamentoService(ctx));

    private static Guid Usuario(AppDbContext ctx)
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = Guid.NewGuid() + "@t.com", Nome = "U", PasswordHash = "x" };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u.Id;
    }

    private static Guid Categoria(AppDbContext ctx, string nome)
    {
        var c = new Categoria { Id = Guid.NewGuid(), Descricao = nome, Finalidade = Finalidade.Despesa };
        ctx.Categorias.Add(c);
        ctx.SaveChanges();
        return c.Id;
    }

    private static void Planejar(AppDbContext ctx, Guid u, Guid categoria, decimal valor, int ano, int mes)
    {
        ctx.Orcamentos.Add(new Orcamento { Id = Guid.NewGuid(), UsuarioId = u, CategoriaId = categoria, Ano = ano, Mes = mes, ValorLimite = valor });
        ctx.SaveChanges();
    }

    private static void RendaEsperada(AppDbContext ctx, Guid u, decimal fixa, int ano, int mes)
    {
        ctx.Add(new RendaPrevista { Id = Guid.NewGuid(), UsuarioId = u, Ano = ano, Mes = mes, FixaEsperada = fixa, VariavelEsperada = 0m });
        ctx.SaveChanges();
    }

    private static Guid Conta(AppDbContext ctx, Guid u, decimal saldo)
    {
        var c = new Conta { Id = Guid.NewGuid(), Nome = "Corrente", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = u };
        ctx.Contas.Add(c);
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Saldo Inicial", Valor = saldo, Tipo = TipoTransacao.Receita, ContaId = c.Id,
            Data = HorarioBrasil.Hoje().AddMonths(-2), CriadoPor = u, EhSaldoInicial = true,
        });
        ctx.SaveChanges();
        return c.Id;
    }

    [Fact]
    public async Task SemRenda_PedeParaDizerARenda()
    {
        var ctx = CreateContext();
        var u = Usuario(ctx);
        var hoje = HorarioBrasil.Hoje();

        var mes = await Servico(ctx).CalcularAsync(u, hoje.Year, hoje.Month);

        Assert.Equal((0m, 0m, 0m, 0m), (mes.RendaEsperada, mes.DespesasPlanejadas, mes.InvestimentosPlanejados, mes.AAlocar));
        Assert.Equal("neutro", mes.Resposta.Tom);
        Assert.StartsWith("Diga quanto você espera receber", mes.Resposta.Texto);
    }

    [Fact]
    public async Task AAlocar_EARendaMenosOPlanejadoMenosOsInvestimentosPlanejados_MetasFicamFora()
    {
        var ctx = CreateContext();
        var u = Usuario(ctx);
        var hoje = HorarioBrasil.Hoje();
        RendaEsperada(ctx, u, 5000m, hoje.Year, hoje.Month);
        Planejar(ctx, u, Categoria(ctx, "Mercado"), 1000m, hoje.Year, hoje.Month);
        Planejar(ctx, u, Categoria(ctx, "Moradia"), 1500m, hoje.Year, hoje.Month);
        var tesouro = new Categoria { Id = Guid.NewGuid(), Descricao = "Renda fixa", Finalidade = Finalidade.Investimento };
        ctx.Categorias.Add(tesouro);
        ctx.SaveChanges();
        Planejar(ctx, u, tesouro.Id, 300m, hoje.Year, hoje.Month);
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Aporte", Valor = 200m, Tipo = TipoTransacao.Despesa, CategoriaId = tesouro.Id, CriadoPor = u,
            Data = new DateOnly(hoje.Year, hoje.Month, 1), StatusTransacao = StatusTransacao.Executado, Ativo = true,
        });
        ctx.SaveChanges();
        var conta = Conta(ctx, u, 3000m);
        var metas = new MetaService(ctx, new TransferenciaService(ctx));
        var viagem = await metas.CriarAsync(new CriarMetaDto("Viagem", null, 2400m, hoje.AddMonths(11).ToDateTime(TimeOnly.MinValue), null, null), u);
        await metas.GuardarAsync(viagem.Id, new MovimentoMetaDto(conta, 300m), u, Guid.NewGuid().ToString());

        var mes = await Servico(ctx).CalcularAsync(u, hoje.Year, hoje.Month);

        Assert.Equal(5000m, mes.RendaEsperada);
        Assert.Equal(2500m, mes.DespesasPlanejadas); // o investimento não entra nas despesas
        Assert.Equal((300m, 200m), (mes.InvestimentosPlanejados, mes.Investido));
        Assert.Equal(2200m, mes.AAlocar); // 5.000 − 2.500 − 300; a meta não pede nada aqui
        Assert.Equal("neutro", mes.Resposta.Tom);
        Assert.StartsWith("Faltam ", mes.Resposta.Texto);
    }

    [Fact]
    public async Task PlanejadoPassaARenda_RespostaNegativa_EZeradoTemDestino()
    {
        var ctx = CreateContext();
        var u = Usuario(ctx);
        var hoje = HorarioBrasil.Hoje();
        RendaEsperada(ctx, u, 2000m, hoje.Year, hoje.Month);
        var mercado = Categoria(ctx, "Mercado");
        Planejar(ctx, u, mercado, 2300m, hoje.Year, hoje.Month);

        var passou = await Servico(ctx).CalcularAsync(u, hoje.Year, hoje.Month);
        Assert.Equal(-300m, passou.AAlocar);
        Assert.Equal("negativo", passou.Resposta.Tom);
        Assert.Contains("R$ 300,00", passou.Resposta.Texto);

        ctx.Orcamentos.Single().ValorLimite = 2000m;
        ctx.SaveChanges();
        var zerado = await Servico(ctx).CalcularAsync(u, hoje.Year, hoje.Month);
        Assert.Equal(0m, zerado.AAlocar);
        Assert.Equal("positivo", zerado.Resposta.Tom);
    }
}

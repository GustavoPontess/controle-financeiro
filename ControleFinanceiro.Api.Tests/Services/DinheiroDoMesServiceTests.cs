using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// O dinheiro do mês (docs/features/respostas/visao.md): renda como total, o que já saiu, o que ainda vem e a
/// resposta "vai dar?" em uma frase com o que fazer.
/// </summary>
public class DinheiroDoMesServiceTests
{
    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    private static DinheiroDoMesService Servico(AppDbContext ctx) => new(ctx, new RendaService(ctx));

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

    private static void RendaEsperada(AppDbContext ctx, Guid u, decimal fixa) =>
        ctx.Add(new RendaPrevista { Id = Guid.NewGuid(), UsuarioId = u, Ano = 2026, Mes = 10, FixaEsperada = fixa, VariavelEsperada = 0m });

    private static void Lancar(AppDbContext ctx, Guid u, Guid? categoria, decimal valor, int dia, TipoTransacao tipo = TipoTransacao.Despesa,
        StatusTransacao status = StatusTransacao.Executado, Guid? contaFixa = null, string descricao = "Gasto")
    {
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = descricao, Valor = valor, Tipo = tipo, CategoriaId = categoria, CriadoPor = u,
            Data = new DateOnly(2026, 10, dia), StatusTransacao = status, Ativo = true, RecorrenteOrigemId = contaFixa,
        });
        ctx.SaveChanges();
    }

    [Fact]
    public async Task SemRenda_PedeParaDizerARenda()
    {
        var ctx = CreateContext();
        var u = Usuario(ctx);

        var mes = await Servico(ctx).CalcularAsync(u, 2026, 10);

        Assert.Equal(0m, mes.RendaBase);
        Assert.Equal("neutro", mes.Resposta.Tom);
        Assert.Equal("/renda", Assert.Single(mes.Resposta.Acoes).Para);
    }

    [Fact]
    public async Task Sobra_ComOQueJaSaiuEOQueAindaVem_EmPartesEItens()
    {
        var ctx = CreateContext();
        var u = Usuario(ctx);
        var moradia = Categoria(ctx, "Moradia");
        var mercado = Categoria(ctx, "Mercado");
        RendaEsperada(ctx, u, 3000m);
        Lancar(ctx, u, moradia, 700m, 5);
        Lancar(ctx, u, mercado, 300m, 6);
        var internet = Guid.NewGuid();
        Lancar(ctx, u, moradia, 99.90m, 20, status: StatusTransacao.Previsao, contaFixa: internet, descricao: "Internet");

        var mes = await Servico(ctx).CalcularAsync(u, 2026, 10);

        Assert.Equal((3000m, 1000m, 99.90m, 1900.10m), (mes.RendaBase, mes.JaSaiu, mes.AindaVemTotal, mes.Livre));
        Assert.Equal(36.7m, mes.PercentualUsado);
        Assert.Equal([("Moradia", 700m), ("Mercado", 300m)], mes.JaSaiuPorCategoria.Select(p => (p.Nome, p.Valor)));
        var vem = Assert.Single(mes.AindaVem);
        Assert.Equal(("Internet", new DateOnly(2026, 10, 20), (Guid?)internet, "Moradia"), (vem.Descricao, vem.Data, vem.ContaFixaId, vem.Categoria));
        Assert.Equal("positivo", mes.Resposta.Tom);
        Assert.Equal("Fecha o mês com R$ 1.900,10 sobrando, contando o que ainda entra e sai.", mes.Resposta.Texto);
    }

    [Fact]
    public async Task SaiuMaisDoQueEntrou_DizQuantoEOMaiorPeso_SemCategoriaPedeClassificar()
    {
        var ctx = CreateContext();
        var u = Usuario(ctx);
        var moradia = Categoria(ctx, "Moradia");
        Lancar(ctx, u, null, 3903.23m, 5, TipoTransacao.Receita, descricao: "Salário");
        Lancar(ctx, u, null, 4312.13m, 8);
        Lancar(ctx, u, moradia, 1765m, 10);
        Lancar(ctx, u, moradia, 99.90m, 20, status: StatusTransacao.Previsao);

        var mes = await Servico(ctx).CalcularAsync(u, 2026, 10);

        Assert.Equal(3903.23m, mes.RendaBase); // sem esperado declarado, vale o que entrou
        Assert.Equal("negativo", mes.Resposta.Tom);
        Assert.Equal("Saiu mais do que entrou: R$ 2.173,90 acima da renda. O maior peso é Sem categoria (R$ 4.312,13). " +
                     "E ainda vem R$ 99,90 de contas este mês.", mes.Resposta.Texto);
        Assert.Equal("Classificar lançamentos", Assert.Single(mes.Resposta.Acoes).Rotulo);
        Assert.Equal(158.3m, mes.PercentualUsado); // (4.312,13 + 1.765 + 99,90) ÷ 3.903,23
    }

    [Fact]
    public async Task BaseEhOMaiorEntreEsperadoERecebido_EMaisDe5CategoriasViramOutras()
    {
        var ctx = CreateContext();
        var u = Usuario(ctx);
        RendaEsperada(ctx, u, 3000m);
        Lancar(ctx, u, null, 3500m, 5, TipoTransacao.Receita, descricao: "Salário com extra");
        for (var i = 1; i <= 7; i++)
            Lancar(ctx, u, Categoria(ctx, $"C{i}"), 100m * i, i);

        var mes = await Servico(ctx).CalcularAsync(u, 2026, 10);

        Assert.Equal(3500m, mes.RendaBase);
        Assert.Equal(6, mes.JaSaiuPorCategoria.Count);
        Assert.Equal(("Outras", 300m), (mes.JaSaiuPorCategoria[^1].Nome, mes.JaSaiuPorCategoria[^1].Valor)); // C1 + C2
    }

    [Theory]
    [InlineData(900, 200, "alerta", "Com o que ainda vem (R$ 200,00 em contas), o mês passa R$ 100,00 da renda.")]
    [InlineData(950, 0, "alerta", "Sobra pouco: R$ 50,00 até o fim do mês, contando o que ainda entra e sai.")]
    [InlineData(400, 0, "positivo", "Fecha o mês com R$ 600,00 sobrando.")]
    public void Responder_PelaSituacaoDoMes(int jaSaiu, int aindaVem, string tom, string texto)
    {
        var r = DinheiroDoMesService.Responder(1000m, jaSaiu, aindaVem, 1000m - jaSaiu - aindaVem, ("Mercado", jaSaiu, false));
        Assert.Equal((tom, texto), (r.Tom, r.Texto));
    }
}

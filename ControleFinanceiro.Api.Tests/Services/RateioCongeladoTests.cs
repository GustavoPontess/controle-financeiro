using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Passo 1 do espaço da família (docs/features/familia/espaco-da-familia.md; decisão do Gustavo 2026-10-19):
/// a parte de cada um fica GRAVADA ao dividir; mudar a regra da família vale pras próximas; quem saiu continua
/// nos meses em que dividiu; e o gasto do mês de cada um é a sua parte (a luz de R$ 180 dividida é R$ 90 pra cada).
/// </summary>
public class RateioCongeladoTests
{
    private sealed record Cenario(AppDbContext Ctx, Guid FamiliaId, Guid Gustavo, Guid Gabriel, Guid Marina, Guid Moradia);

    private static async Task<Cenario> Build(ModoRateio modo = ModoRateio.Igualitario)
    {
        var ctx = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);
        Guid Pessoa(string nome)
        {
            var u = new Usuario { Id = Guid.NewGuid(), Email = $"{nome.ToLower()}@t.com", Nome = nome, PasswordHash = "x" };
            ctx.Usuarios.Add(u);
            return u.Id;
        }
        var gustavo = Pessoa("Gustavo");
        var gabriel = Pessoa("Gabriel");
        var marina = Pessoa("Marina");
        var moradia = new Categoria { Id = Guid.NewGuid(), Descricao = "Moradia", Finalidade = Finalidade.Despesa };
        ctx.Categorias.Add(moradia);
        ctx.SaveChanges();
        var familia = await new FamiliaService(ctx).CriarAsync(new CriarFamiliaDto("Casa"), gustavo);
        (await ctx.Familias.SingleAsync()).ModoRateioPadrao = modo;
        ctx.MembrosFamilia.Add(new MembroFamilia { Id = Guid.NewGuid(), FamiliaId = familia.Id, UsuarioId = gabriel, Papel = "Companheiro", PapelPermissao = PapelFamilia.Membro });
        ctx.MembrosFamilia.Add(new MembroFamilia { Id = Guid.NewGuid(), FamiliaId = familia.Id, UsuarioId = marina, Papel = "Irmã", PapelPermissao = PapelFamilia.Dependente }); // só vê
        ctx.SaveChanges();
        return new Cenario(ctx, familia.Id, gustavo, gabriel, marina, moradia.Id);
    }

    private static Transacao Despesa(Cenario c, Guid quem, decimal valor, DateOnly data, string descricao = "Conta de luz")
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = descricao, Valor = valor, Tipo = TipoTransacao.Despesa, CriadoPor = quem, Data = data,
            CategoriaId = c.Moradia, StatusTransacao = StatusTransacao.Executado,
        };
        c.Ctx.Transacoes.Add(t);
        c.Ctx.SaveChanges();
        return t;
    }

    private static DespesaCompartilhadaService Despesas(Cenario c) => new(c.Ctx, TestHelpers.Notif(c.Ctx), new RateioService(c.Ctx));

    private static async Task<Dictionary<Guid, decimal>> Cotas(Cenario c, int ano, int mes) =>
        (await Despesas(c).ObterBalancoAsync(c.FamiliaId, c.Gustavo, mes, ano)).Saldos.ToDictionary(s => s.UsuarioId, s => s.Cota);

    [Fact]
    public async Task Dividir_GravaAParteDeCadaUm_SemQuemSoVe_ComORestoDosCentavosEmQuemPagou()
    {
        var c = await Build();
        var luz = Despesa(c, c.Gustavo, 180.01m, new DateOnly(2026, 10, 19));

        await Despesas(c).CompartilharAsync(luz.Id, c.FamiliaId, c.Gustavo);

        var partes = await c.Ctx.RateiosTransacao.Where(r => r.TransacaoId == luz.Id).ToListAsync();
        Assert.Equal(2, partes.Count); // Marina só vê: fica fora
        Assert.Equal(90.01m, partes.Single(p => p.UsuarioId == c.Gustavo).Valor);
        Assert.Equal(90.00m, partes.Single(p => p.UsuarioId == c.Gabriel).Valor);
        Assert.Equal(ModoRateio.Igualitario, (await c.Ctx.Transacoes.SingleAsync(t => t.Id == luz.Id)).ModoRateio);
    }

    [Fact]
    public async Task FamiliaDoMeuJeito_DividirSemDizerAsPartes_ComecaIgual()
    {
        var c = await Build(ModoRateio.Personalizado);
        var luz = Despesa(c, c.Gustavo, 100m, new DateOnly(2026, 10, 19));

        await Despesas(c).CompartilharAsync(luz.Id, c.FamiliaId, c.Gustavo);

        var t = await c.Ctx.Transacoes.Include(x => x.Rateios).SingleAsync(x => x.Id == luz.Id);
        Assert.Equal(ModoRateio.Igualitario, t.ModoRateio);
        Assert.Equal(50m, t.Rateios.Single(r => r.UsuarioId == c.Gustavo).Valor);
        Assert.Equal(50m, t.Rateios.Single(r => r.UsuarioId == c.Gabriel).Valor);
    }

    [Fact]
    public async Task ExigirPodeDividir_RecusaReceita_EQuemSoVe()
    {
        var c = await Build();
        var salario = new Transacao { Id = Guid.NewGuid(), Descricao = "Salário", Valor = 10m, Tipo = TipoTransacao.Receita, CriadoPor = c.Gustavo, Data = new DateOnly(2026, 10, 1) };
        await Assert.ThrowsAsync<InvalidOperationException>(() => Despesas(c).ExigirPodeDividirAsync(c.FamiliaId, c.Gustavo, salario));
        var luz = new Transacao { Id = Guid.NewGuid(), Descricao = "Luz", Valor = 10m, Tipo = TipoTransacao.Despesa, CriadoPor = c.Marina, Data = new DateOnly(2026, 10, 1) };
        await Assert.ThrowsAnyAsync<Exception>(() => Despesas(c).ExigirPodeDividirAsync(c.FamiliaId, c.Marina, luz));
        await Despesas(c).ExigirPodeDividirAsync(c.FamiliaId, c.Gabriel, luz); // quem lança pode
    }

    [Fact]
    public async Task MudarARegraDaFamilia_NaoMexeNoQueJaFoiDividido()
    {
        var c = await Build();
        var luz = Despesa(c, c.Gustavo, 180m, new DateOnly(2026, 9, 20));
        await Despesas(c).CompartilharAsync(luz.Id, c.FamiliaId, c.Gustavo);
        var antes = await Cotas(c, 2026, 9);

        // Gustavo declara renda 3x maior e a família passa a dividir pela renda: setembro continua meio a meio.
        c.Ctx.RendasPrevistas.AddRange(
            new RendaPrevista { Id = Guid.NewGuid(), UsuarioId = c.Gustavo, Ano = 2026, Mes = 9, FixaEsperada = 3000m },
            new RendaPrevista { Id = Guid.NewGuid(), UsuarioId = c.Gabriel, Ano = 2026, Mes = 9, FixaEsperada = 1000m });
        await c.Ctx.SaveChangesAsync();
        await new RateioService(c.Ctx).DefinirModoFamiliaAsync(c.FamiliaId, c.Gustavo, ModoRateio.Proporcional);

        Assert.Equal(antes, await Cotas(c, 2026, 9));
        Assert.Equal((90m, 90m), (antes[c.Gustavo], antes[c.Gabriel]));

        // A próxima despesa já nasce pela renda (75% / 25%), e só ela.
        var mercado = Despesa(c, c.Gabriel, 400m, new DateOnly(2026, 9, 25), "Mercado");
        await Despesas(c).CompartilharAsync(mercado.Id, c.FamiliaId, c.Gabriel);
        var depois = await Cotas(c, 2026, 9);
        Assert.Equal((90m + 300m, 90m + 100m), (depois[c.Gustavo], depois[c.Gabriel]));
    }

    [Fact]
    public async Task QuemSaiu_ContinuaNoEquilibrioDosMesesEmQueDividiu_ComADataQueSaiu()
    {
        var c = await Build();
        var luz = Despesa(c, c.Gabriel, 180m, new DateOnly(2026, 9, 20));
        await Despesas(c).CompartilharAsync(luz.Id, c.FamiliaId, c.Gabriel);
        var membro = await c.Ctx.MembrosFamilia.SingleAsync(m => m.UsuarioId == c.Gabriel);

        await new FamiliaService(c.Ctx).RemoverMembroAsync(c.FamiliaId, membro.Id, c.Gustavo);

        var balanco = await Despesas(c).ObterBalancoAsync(c.FamiliaId, c.Gustavo, 9, 2026);
        var gabriel = balanco.Saldos.Single(s => s.UsuarioId == c.Gabriel);
        Assert.Equal((180m, 90m, 90m), (gabriel.Pagou, gabriel.Cota, gabriel.Saldo)); // pagou a mais R$ 90
        Assert.NotNull(gabriel.SaiuEm);
        Assert.Equal(-90m, balanco.Saldos.Single(s => s.UsuarioId == c.Gustavo).Saldo);
        // Outubro, depois que saiu: a despesa nova é só do Gustavo (ninguém mais pra dividir além dele).
        var outubro = Despesa(c, c.Gustavo, 100m, new DateOnly(2026, 10, 5));
        await Despesas(c).CompartilharAsync(outubro.Id, c.FamiliaId, c.Gustavo);
        var cotasOut = await Cotas(c, 2026, 10);
        Assert.Equal(100m, cotasOut[c.Gustavo]);
        Assert.False(cotasOut.ContainsKey(c.Gabriel));
    }

    [Fact]
    public async Task GastoDoMes_EhASuaParte_NasSuasENasDosOutros_PendenteContaInteiraPraQuemPagou()
    {
        var c = await Build();
        var luz = Despesa(c, c.Gustavo, 180m, new DateOnly(2026, 10, 19));
        await Despesas(c).CompartilharAsync(luz.Id, c.FamiliaId, c.Gustavo);
        var mercado = Despesa(c, c.Gabriel, 400m, new DateOnly(2026, 10, 15), "Mercado");
        await Despesas(c).CompartilharAsync(mercado.Id, c.FamiliaId, c.Gabriel);
        Despesa(c, c.Gustavo, 50m, new DateOnly(2026, 10, 10), "Só minha");
        // Acima do limite da família: fica esperando aprovação, conta inteira pra quem pagou.
        await new FamiliaService(c.Ctx).DefinirLimiteAprovacaoAsync(c.FamiliaId, c.Gustavo, 500m);
        var sofa = Despesa(c, c.Gabriel, 1000m, new DateOnly(2026, 10, 18), "Sofá");
        await Despesas(c).CompartilharAsync(sofa.Id, c.FamiliaId, c.Gabriel);

        var gustavo = await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(c.Ctx, c.Gustavo, 2026, 10);
        var gabriel = await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(c.Ctx, c.Gabriel, 2026, 10);
        var marina = await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(c.Ctx, c.Marina, 2026, 10);

        Assert.Equal(90m + 200m + 50m, gustavo[c.Moradia].Gasto);   // sua parte da luz + sua parte do mercado + a só sua
        Assert.Equal(90m + 200m + 1000m, gabriel[c.Moradia].Gasto); // suas partes + o sofá inteiro (ainda não dividido)
        Assert.Empty(marina);                                         // só vê: não entra em nada
    }

    [Fact]
    public async Task PararDeDividir_TiraAsPartes_EVoltarAoPadraoRegravaPelaRegraDeHoje()
    {
        var c = await Build();
        var luz = Despesa(c, c.Gustavo, 180m, new DateOnly(2026, 10, 19));
        var rateio = new RateioService(c.Ctx);
        await Despesas(c).CompartilharAsync(luz.Id, c.FamiliaId, c.Gustavo);
        await rateio.DefinirRateioTransacaoAsync(luz.Id, c.Gustavo, new DefinirRateioTransacaoDto(ModoRateio.Personalizado,
            [new RateioItemDto(c.Gustavo, 70m), new RateioItemDto(c.Gabriel, 30m)]));
        Assert.Equal(126m, (await c.Ctx.RateiosTransacao.SingleAsync(r => r.TransacaoId == luz.Id && r.UsuarioId == c.Gustavo)).Valor);

        await rateio.RemoverRateioTransacaoAsync(luz.Id, c.Gustavo);
        Assert.Equal(90m, (await c.Ctx.RateiosTransacao.SingleAsync(r => r.TransacaoId == luz.Id && r.UsuarioId == c.Gustavo)).Valor);

        await Despesas(c).DescompartilharAsync(luz.Id, c.Gustavo);
        Assert.Empty(await c.Ctx.RateiosTransacao.Where(r => r.TransacaoId == luz.Id).ToListAsync());
        Assert.Equal(180m, (await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(c.Ctx, c.Gustavo, 2026, 10))[c.Moradia].Gasto);
    }

    [Fact]
    public async Task ListaDaFamilia_TrazAMinhaParte_EOutroMembroVeORateio()
    {
        var c = await Build();
        var luz = Despesa(c, c.Gustavo, 180m, new DateOnly(2026, 10, 19));
        await Despesas(c).CompartilharAsync(luz.Id, c.FamiliaId, c.Gustavo);

        var lista = await Despesas(c).ListarDespesasAsync(c.FamiliaId, c.Gabriel, 10, 2026);
        Assert.Equal(90m, Assert.Single(lista).MinhaParte);
        var rateio = await new RateioService(c.Ctx).ObterRateioTransacaoAsync(luz.Id, c.Gabriel);
        Assert.Equal(new[] { (c.Gabriel, 90m), (c.Gustavo, 90m) }, rateio.Membros.OrderBy(m => m.Nome).Select(m => (m.UsuarioId, m.Valor)));
    }
}

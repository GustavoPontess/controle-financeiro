using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.DTOs.Recorrente;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Passo 4 do espaço da família (2026-10-19): conta fixa DA CASA (<c>Recorrente.FamiliaId</c>). Cada cobrança nasce
/// dividida com a parte de cada um gravada; mudar a regra da família vale pras cobranças que ainda não aconteceram;
/// a aba Contas fixas mostra quem paga e a sua parte. E mudar o valor de uma despesa dividida regrava as partes.
/// </summary>
public class ContasFixasDaCasaTests
{
    private sealed record Casa(AppDbContext Ctx, Guid FamiliaId, Guid Gustavo, Guid Gabriel, Guid Marina, Guid Conta, Guid Moradia);

    private static async Task<Casa> Build()
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
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Nubank", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = gustavo };
        ctx.Contas.Add(conta);
        ctx.SaveChanges();
        var familia = await new FamiliaService(ctx).CriarAsync(new CriarFamiliaDto("Casa"), gustavo);
        ctx.MembrosFamilia.Add(new MembroFamilia { Id = Guid.NewGuid(), FamiliaId = familia.Id, UsuarioId = gabriel, Papel = "Companheiro", PapelPermissao = PapelFamilia.Membro });
        ctx.MembrosFamilia.Add(new MembroFamilia { Id = Guid.NewGuid(), FamiliaId = familia.Id, UsuarioId = marina, Papel = "Irmã", PapelPermissao = PapelFamilia.Dependente });
        ctx.SaveChanges();
        return new Casa(ctx, familia.Id, gustavo, gabriel, marina, conta.Id, moradia.Id);
    }

    private static RecorrenteService Recorrentes(Casa c) => new(c.Ctx, new FaturaService(c.Ctx), new FinancialEventLogService(c.Ctx));
    private static DespesaCompartilhadaService Despesas(Casa c) => new(c.Ctx, TestHelpers.Notif(c.Ctx), new RateioService(c.Ctx));

    private static CriarRecorrenteDto Aluguel(Casa c, Guid? familiaId, decimal valor = 1500.01m) => new()
    {
        Descricao = "Aluguel", Valor = valor, Tipo = (int)TipoTransacao.Despesa, CategoriaId = c.Moradia, ContaId = c.Conta,
        Frequencia = (int)FrequenciaRecorrencia.Mensal, Dia = 5, DataInicio = HorarioBrasil.HojeData().AddDays(1), FamiliaId = familiaId,
    };

    private static Task<List<Transacao>> Cobrancas(Casa c, Guid recorrenteId) =>
        c.Ctx.Transacoes.Include(t => t.Rateios).Where(t => t.RecorrenteOrigemId == recorrenteId).ToListAsync();

    [Fact]
    public async Task ContaFixaDaCasa_CadaCobrancaNasceDividida_ComAParteGravada_SemQuemSoVe()
    {
        var c = await Build();
        var r = await Recorrentes(c).CriarAsync(Aluguel(c, c.FamiliaId), c.Gustavo);

        Assert.Equal(c.FamiliaId, r.FamiliaId);
        var cobrancas = await Cobrancas(c, r.Id);
        Assert.NotEmpty(cobrancas);
        Assert.All(cobrancas, t =>
        {
            Assert.Equal(c.FamiliaId, t.FamiliaId);
            Assert.Equal(StatusAprovacaoDespesa.NaoRequerida, t.StatusAprovacao);
            Assert.Equal(1500.01m, t.Rateios.Sum(x => x.Valor));
            Assert.Equal(750.01m, t.Rateios.Single(x => x.UsuarioId == c.Gustavo).Valor); // centavo em quem paga
            Assert.Equal(750m, t.Rateios.Single(x => x.UsuarioId == c.Gabriel).Valor);
            Assert.DoesNotContain(t.Rateios, x => x.UsuarioId == c.Marina);
        });
    }

    [Fact]
    public async Task SoContaAPagar_DeQuemLanca_EDesmarcar_VaiPrasProximas()
    {
        var c = await Build();
        var receita = Aluguel(c, c.FamiliaId);
        receita.Tipo = (int)TipoTransacao.Receita;
        await Assert.ThrowsAsync<ArgumentException>(() => Recorrentes(c).CriarAsync(receita, c.Gustavo));

        var r = await Recorrentes(c).CriarAsync(Aluguel(c, c.FamiliaId), c.Gustavo);
        await Recorrentes(c).AtualizarAsync(r.Id, Aluguel(c, null), c.Gustavo);
        var vivas = (await Cobrancas(c, r.Id)).Where(t => t.Ativo).ToList();
        Assert.NotEmpty(vivas);
        Assert.All(vivas, t => Assert.Null(t.FamiliaId));
    }

    [Fact]
    public async Task MudarARegraDaFamilia_RegravaSoAsCobrancasQueAindaNaoAconteceram()
    {
        var c = await Build();
        var r = await Recorrentes(c).CriarAsync(Aluguel(c, c.FamiliaId, 1000m), c.Gustavo);
        var cobrancas = await Cobrancas(c, r.Id);
        var paga = cobrancas.OrderBy(t => t.Data).First();
        paga.StatusTransacao = StatusTransacao.Executado;
        c.Ctx.SaveChanges();
        // Gabriel declara renda maior: pela renda, ele passa a ter parte maior nas próximas.
        foreach (var t in cobrancas.Select(t => t.Data).Distinct())
        {
            c.Ctx.RendasPrevistas.Add(new RendaPrevista { Id = Guid.NewGuid(), UsuarioId = c.Gabriel, Ano = t.Year, Mes = t.Month, FixaEsperada = 3000m });
            c.Ctx.RendasPrevistas.Add(new RendaPrevista { Id = Guid.NewGuid(), UsuarioId = c.Gustavo, Ano = t.Year, Mes = t.Month, FixaEsperada = 1000m });
        }
        c.Ctx.SaveChanges();

        await new RateioService(c.Ctx).DefinirModoFamiliaAsync(c.FamiliaId, c.Gustavo, ModoRateio.Proporcional);

        var depois = await Cobrancas(c, r.Id);
        Assert.Equal(500m, depois.Single(t => t.Id == paga.Id).Rateios.Single(x => x.UsuarioId == c.Gabriel).Valor); // já aconteceu
        Assert.All(depois.Where(t => t.Id != paga.Id), t => Assert.Equal(750m, t.Rateios.Single(x => x.UsuarioId == c.Gabriel).Valor));
    }

    [Fact]
    public async Task AbaContasFixas_MostraQuemPaga_ACobrancaDoMes_EASuaParte()
    {
        var c = await Build();
        var r = await Recorrentes(c).CriarAsync(Aluguel(c, c.FamiliaId, 1000m), c.Gustavo);
        await Recorrentes(c).CriarAsync(Aluguel(c, null, 50m), c.Gustavo); // só do Gustavo: fora da aba
        var primeira = (await Cobrancas(c, r.Id)).OrderBy(t => t.Data).First();

        var doGabriel = await Despesas(c).ListarContasFixasAsync(c.FamiliaId, c.Gabriel, primeira.Data.Month, primeira.Data.Year);

        var conta = Assert.Single(doGabriel);
        Assert.Equal(("Aluguel", 1000m, 5, c.Gustavo, "Gustavo"), (conta.Descricao, conta.Valor, conta.Dia, conta.PagadorUsuarioId, conta.PagadorNome));
        Assert.False(conta.EhMinha);
        Assert.Equal(primeira.Data, conta.CobrancaData);
        Assert.False(conta.CobrancaPaga);
        Assert.Equal(500m, conta.MinhaParte);
        Assert.True((await Despesas(c).ListarContasFixasAsync(c.FamiliaId, c.Gustavo, primeira.Data.Month, primeira.Data.Year)).Single().EhMinha);
    }

    [Fact]
    public async Task MudarOValorDaDespesaDividida_AsPartesAcompanham_ComOMesmoPercentual()
    {
        var c = await Build();
        var luz = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Luz", Valor = 100m, Tipo = TipoTransacao.Despesa, CriadoPor = c.Gustavo,
            Data = HorarioBrasil.Hoje(), CategoriaId = c.Moradia, ContaId = c.Conta, StatusTransacao = StatusTransacao.Executado,
        };
        c.Ctx.Transacoes.Add(luz);
        c.Ctx.SaveChanges();
        await Despesas(c).CompartilharAsync(luz.Id, c.FamiliaId, c.Gustavo);

        luz.Valor = 180.01m;
        await new RateioService(c.Ctx).RegravarPeloValorAsync(luz);
        c.Ctx.SaveChanges();

        var partes = await c.Ctx.RateiosTransacao.Where(x => x.TransacaoId == luz.Id).ToListAsync();
        Assert.Equal(180.01m, partes.Sum(x => x.Valor));
        Assert.Equal(90.01m, partes.Single(x => x.UsuarioId == c.Gustavo).Valor);
        Assert.Equal(90m, partes.Single(x => x.UsuarioId == c.Gabriel).Valor);
    }
}

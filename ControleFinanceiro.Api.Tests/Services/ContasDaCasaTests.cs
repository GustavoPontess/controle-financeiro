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
/// Passo 5 do espaço da família (2026-10-19, modelo Honeydue/Monarch): conta ou cartão DA CASA. A despesa que nasce
/// nela já nasce dividida (regra única <see cref="RateioService.DividirSeForDaCasaAsync"/>): lançamento, extrato
/// importado e cobrança de conta fixa. O que não é gasto, a compra parcelada e o que já existia não mudam.
/// </summary>
public class ContasDaCasaTests
{
    private sealed record Casa(AppDbContext Ctx, Guid FamiliaId, Guid Gustavo, Guid Gabriel, Guid Marina, Guid Conta, Guid OutraConta, Guid Cartao, Guid Mercado);

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
        var mercado = new Categoria { Id = Guid.NewGuid(), Descricao = "Mercado", Finalidade = Finalidade.Despesa };
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Conjunta", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = gustavo };
        var outra = new Conta { Id = Guid.NewGuid(), Nome = "Pessoal", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = gustavo };
        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = "Cartão do mercado", TemCredito = true, LimiteTotal = 10_000,
            DiaFechamento = 10, DiaVencimento = 17, CriadoPor = gustavo, Ativo = true,
        };
        ctx.Categorias.Add(mercado);
        ctx.Contas.AddRange(conta, outra);
        ctx.CartoesCredito.Add(cartao);
        ctx.SaveChanges();
        var familia = await new FamiliaService(ctx).CriarAsync(new CriarFamiliaDto("Casa"), gustavo);
        ctx.MembrosFamilia.Add(new MembroFamilia { Id = Guid.NewGuid(), FamiliaId = familia.Id, UsuarioId = gabriel, Papel = "Companheiro", PapelPermissao = PapelFamilia.Membro });
        ctx.MembrosFamilia.Add(new MembroFamilia { Id = Guid.NewGuid(), FamiliaId = familia.Id, UsuarioId = marina, Papel = "Irmã", PapelPermissao = PapelFamilia.Dependente });
        ctx.SaveChanges();
        return new Casa(ctx, familia.Id, gustavo, gabriel, marina, conta.Id, outra.Id, cartao.Id, mercado.Id);
    }

    private static DespesaCompartilhadaService Despesas(Casa c) => new(c.Ctx, TestHelpers.Notif(c.Ctx), new RateioService(c.Ctx));
    private static TransacaoService Transacoes(Casa c) => new(c.Ctx, new FaturaService(c.Ctx), new FinancialEventLogService(c.Ctx));

    private static Task<Transacao> Lancar(Casa c, decimal valor, Guid? conta = null, Guid? cartao = null, TipoTransacao tipo = TipoTransacao.Despesa) =>
        Transacoes(c).CriarTransacaoAsync(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Mercado", Valor = valor, Tipo = tipo, CategoriaId = tipo == TipoTransacao.Despesa ? c.Mercado : null,
            ContaId = conta, CartaoCreditoId = cartao, UsadoComoCredito = cartao != null, StatusTransacao = StatusTransacao.Executado,
            Data = DateOnly.FromDateTime(DateTime.UtcNow),
        }, c.Gustavo);

    private static Task<Transacao> Ler(Casa c, Guid id) => c.Ctx.Transacoes.Include(t => t.Rateios).SingleAsync(t => t.Id == id);

    [Fact]
    public async Task ContaDaCasa_ADespesaJaNasceDividida_SemQuemSoVe()
    {
        var c = await Build();
        await Despesas(c).MarcarContaDaCasaAsync(c.Conta, c.Gustavo, c.FamiliaId);

        var feira = await Ler(c, (await Lancar(c, 300m, conta: c.Conta)).Id);

        Assert.Equal(c.FamiliaId, feira.FamiliaId);
        Assert.Equal(StatusAprovacaoDespesa.NaoRequerida, feira.StatusAprovacao);
        Assert.Equal(150m, feira.Rateios.Single(r => r.UsuarioId == c.Gabriel).Valor);
        Assert.DoesNotContain(feira.Rateios, r => r.UsuarioId == c.Marina);
        // A outra conta, receita e transferência não.
        Assert.Null((await Ler(c, (await Lancar(c, 50m, conta: c.OutraConta)).Id)).FamiliaId);
        Assert.Null((await Ler(c, (await Lancar(c, 1000m, conta: c.Conta, tipo: TipoTransacao.Receita)).Id)).FamiliaId);
        var transferencia = await Ler(c, (await Transacoes(c).CriarTransacaoAsync(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Pra poupança", Valor = 10m, Tipo = TipoTransacao.Despesa, ContaId = c.Conta,
            EhTransferencia = true, StatusTransacao = StatusTransacao.Executado, Data = DateOnly.FromDateTime(DateTime.UtcNow),
        }, c.Gustavo)).Id);
        Assert.Null(transferencia.FamiliaId);
    }

    [Fact]
    public async Task CartaoDaCasa_CompraAVistaDivide_EAcimaDoLimiteEsperaAprovacao()
    {
        var c = await Build();
        await new FamiliaService(c.Ctx).DefinirLimiteAprovacaoAsync(c.FamiliaId, c.Gustavo, 500m);
        await Despesas(c).MarcarCartaoDaCasaAsync(c.Cartao, c.Gustavo, c.FamiliaId);

        var pequena = await Ler(c, (await Lancar(c, 80m, cartao: c.Cartao)).Id);
        var grande = await Ler(c, (await Lancar(c, 900m, cartao: c.Cartao)).Id);

        Assert.Equal((c.FamiliaId, StatusAprovacaoDespesa.NaoRequerida), (pequena.FamiliaId!.Value, pequena.StatusAprovacao));
        Assert.Equal((c.FamiliaId, StatusAprovacaoDespesa.Pendente), (grande.FamiliaId!.Value, grande.StatusAprovacao));
    }

    [Fact]
    public async Task Desmarcar_VaiPrasProximas_EOQueJaExistiaNaoMuda()
    {
        var c = await Build();
        var antes = await Lancar(c, 40m, conta: c.Conta);
        await Despesas(c).MarcarContaDaCasaAsync(c.Conta, c.Gustavo, c.FamiliaId);
        Assert.Null((await Ler(c, antes.Id)).FamiliaId); // marcar não divide o passado

        var dividida = await Lancar(c, 60m, conta: c.Conta);
        await Despesas(c).MarcarContaDaCasaAsync(c.Conta, c.Gustavo, null);
        var depois = await Lancar(c, 70m, conta: c.Conta);

        Assert.Equal(c.FamiliaId, (await Ler(c, dividida.Id)).FamiliaId); // desmarcar não desfaz o que já foi dividido
        Assert.Null((await Ler(c, depois.Id)).FamiliaId);
    }

    [Fact]
    public async Task SoODonoMarca_QuemSoVeNao_ECaixinhaNao()
    {
        var c = await Build();
        await Assert.ThrowsAsync<KeyNotFoundException>(() => Despesas(c).MarcarContaDaCasaAsync(c.Conta, c.Gabriel, c.FamiliaId));
        var contaMarina = new Conta { Id = Guid.NewGuid(), Nome = "Dela", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = c.Marina };
        var caixinha = new Conta { Id = Guid.NewGuid(), Nome = "Viagem", Tipo = TipoConta.Caixinha, UsuarioIdProprietario = c.Gustavo };
        c.Ctx.Contas.AddRange(contaMarina, caixinha);
        c.Ctx.SaveChanges();
        await Assert.ThrowsAsync<ForbiddenAccessException>(() => Despesas(c).MarcarContaDaCasaAsync(contaMarina.Id, c.Marina, c.FamiliaId));
        await Assert.ThrowsAsync<InvalidOperationException>(() => Despesas(c).MarcarContaDaCasaAsync(caixinha.Id, c.Gustavo, c.FamiliaId));
    }

    [Fact]
    public async Task ContaFixaSoDaPessoa_PagaNaContaDaCasa_ACobrancaNasceDividida()
    {
        var c = await Build();
        await Despesas(c).MarcarContaDaCasaAsync(c.Conta, c.Gustavo, c.FamiliaId);
        var r = await new RecorrenteService(c.Ctx, new FaturaService(c.Ctx), new FinancialEventLogService(c.Ctx)).CriarAsync(new CriarRecorrenteDto
        {
            Descricao = "Luz", Valor = 200m, Tipo = (int)TipoTransacao.Despesa, CategoriaId = c.Mercado, ContaId = c.Conta,
            Frequencia = (int)FrequenciaRecorrencia.Mensal, Dia = 5, DataInicio = DateTime.UtcNow.Date.AddDays(1),
        }, c.Gustavo);

        var cobrancas = await c.Ctx.Transacoes.Include(t => t.Rateios).Where(t => t.RecorrenteOrigemId == r.Id).ToListAsync();
        Assert.NotEmpty(cobrancas);
        Assert.All(cobrancas, t => Assert.Equal(100m, t.Rateios.Single(x => x.UsuarioId == c.Gabriel).Valor));
    }
}

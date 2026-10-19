using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Conta;
using ControleFinanceiro.Api.DTOs.Transferencia;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Encerrar conta (2026-10-15): conta com histórico não se exclui, se encerra. O saldo nunca some de vista —
/// zerada encerra direto; com saldo vira transferência de verdade ou ajuste. Conta encerrada não recebe
/// dinheiro novo e sai das listas; dá pra reabrir.
/// </summary>
public class EncerramentoContaServiceTests
{
    private static AppDbContext CreateContext() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
        .Options);

    private static EncerramentoContaService Servico(AppDbContext ctx) =>
        new(ctx, new TransferenciaService(ctx), new FinancialEventLogService(ctx));

    private static DateOnly Hoje => DateOnly.FromDateTime(DateTime.UtcNow);
    private static string Chave() => Guid.NewGuid().ToString();

    private static Conta NovaConta(AppDbContext ctx, Guid usuarioId, string nome, decimal saldoInicial = 0m)
    {
        var c = new Conta { Id = Guid.NewGuid(), Nome = nome, Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuarioId };
        ctx.Contas.Add(c);
        if (saldoInicial != 0m)
            ctx.Transacoes.Add(new Transacao
            {
                Id = Guid.NewGuid(), Descricao = "Saldo Inicial", Valor = Math.Abs(saldoInicial),
                Tipo = saldoInicial > 0 ? TipoTransacao.Receita : TipoTransacao.Despesa, ContaId = c.Id,
                Data = Hoje.AddDays(-10), CriadoPor = usuarioId, EhSaldoInicial = saldoInicial > 0,
            });
        return c;
    }

    private static async Task<decimal> SaldoAsync(AppDbContext ctx, Guid contaId, Guid usuarioId) =>
        (await RegrasFinanceiras.SaldosDasContasAsync(ctx, new[] { contaId }, usuarioId))[contaId].Saldo;

    [Fact]
    public async Task CaixinhaDeMeta_NaoSeEncerraPorBancos()
    {
        var ctx = CreateContext();
        var u = Guid.NewGuid();
        var metas = new MetaService(ctx, new TransferenciaService(ctx));
        var meta = await metas.CriarAsync(new DTOs.Meta.CriarMetaDto("Viagem", null, 1000m, null, null, null), u);

        var erro = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Servico(ctx).EncerrarAsync(meta.ContaId!.Value, new DTOs.Conta.EncerrarContaDto { Ajustar = true }, u, Chave()));
        Assert.Contains("Metas", erro.Message);
        Assert.Null((await ctx.Contas.FindAsync(meta.ContaId))!.EncerradaEm);
    }

    [Fact]
    public async Task SaldoZerado_EncerraDireto_ESaiDaLista()
    {
        var ctx = CreateContext();
        var u = Guid.NewGuid();
        var conta = NovaConta(ctx, u, "Inter");
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).EncerrarAsync(conta.Id, new EncerrarContaDto(), u, Chave());

        Assert.Equal(EncerramentoContaService.ResolucaoZerada, r.Resolucao);
        Assert.NotNull((await ctx.Contas.FindAsync(conta.Id))!.EncerradaEm);
        var contas = new ContaService(ctx, new FinancialEventLogService(ctx));
        Assert.DoesNotContain(await contas.ListarAsync(u), c => c.Id == conta.Id);
        Assert.Contains(await contas.ListarAsync(u, incluirEncerradas: true), c => c.Id == conta.Id);
    }

    [Fact]
    public async Task ComSaldo_SemDizerOQueAconteceu_Recusa()
    {
        var ctx = CreateContext();
        var u = Guid.NewGuid();
        var conta = NovaConta(ctx, u, "Inter", 300m);
        await ctx.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => Servico(ctx).EncerrarAsync(conta.Id, new EncerrarContaDto(), u, Chave()));
        Assert.Contains("saldo", ex.Message);
        Assert.Null((await ctx.Contas.FindAsync(conta.Id))!.EncerradaEm);
    }

    [Fact]
    public async Task ComSaldo_Recusa_ComOValorEmReais_MesmoComCulturaInvariante()
    {
        // Como na imagem de produção (alpine): sem dados de cultura, {valor:C} saía "¤300.00".
        var antes = System.Globalization.CultureInfo.CurrentCulture;
        System.Globalization.CultureInfo.CurrentCulture = System.Globalization.CultureInfo.InvariantCulture;
        try
        {
            var ctx = CreateContext();
            var u = Guid.NewGuid();
            var conta = NovaConta(ctx, u, "Inter", 1300m);
            await ctx.SaveChangesAsync();

            var ex = await Assert.ThrowsAsync<ArgumentException>(() => Servico(ctx).EncerrarAsync(conta.Id, new EncerrarContaDto(), u, Chave()));
            Assert.Contains("saldo de R$ 1.300,00.", ex.Message);
        }
        finally { System.Globalization.CultureInfo.CurrentCulture = antes; }
    }

    [Fact]
    public async Task ComSaldo_Transferir_LevaOSaldoPraOutraConta()
    {
        var ctx = CreateContext();
        var u = Guid.NewGuid();
        var conta = NovaConta(ctx, u, "Inter", 300m);
        var destino = NovaConta(ctx, u, "Nubank", 100m);
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).EncerrarAsync(conta.Id, new EncerrarContaDto { ContaDestinoId = destino.Id }, u, Chave());

        Assert.Equal(EncerramentoContaService.ResolucaoTransferencia, r.Resolucao);
        Assert.Equal(300m, r.SaldoAntes);
        Assert.Equal(0m, await SaldoAsync(ctx, conta.Id, u));
        Assert.Equal(400m, await SaldoAsync(ctx, destino.Id, u));
        Assert.Equal(2, await ctx.Transacoes.CountAsync(t => t.EhTransferencia));
        Assert.NotNull((await ctx.Contas.FindAsync(conta.Id))!.EncerradaEm);
    }

    [Fact]
    public async Task SaldoNegativo_Transferir_AOutraContaCobre()
    {
        var ctx = CreateContext();
        var u = Guid.NewGuid();
        var conta = NovaConta(ctx, u, "Inter", -50m); // cheque especial
        var destino = NovaConta(ctx, u, "Nubank", 100m);
        await ctx.SaveChangesAsync();

        await Servico(ctx).EncerrarAsync(conta.Id, new EncerrarContaDto { ContaDestinoId = destino.Id }, u, Chave());

        Assert.Equal(0m, await SaldoAsync(ctx, conta.Id, u));
        Assert.Equal(50m, await SaldoAsync(ctx, destino.Id, u));
    }

    [Fact]
    public async Task ComSaldo_Ajustar_ZeraComAjusteForaDoResultado()
    {
        var ctx = CreateContext();
        var u = Guid.NewGuid();
        var conta = NovaConta(ctx, u, "Inter", 300m);
        await ctx.SaveChangesAsync();

        var r = await Servico(ctx).EncerrarAsync(conta.Id, new EncerrarContaDto { Ajustar = true }, u, Chave());

        Assert.Equal(EncerramentoContaService.ResolucaoAjuste, r.Resolucao);
        Assert.Equal(0m, await SaldoAsync(ctx, conta.Id, u));
        var ajuste = await ctx.Transacoes.SingleAsync(t => t.EhAjusteReconciliacao);
        Assert.Equal((TipoTransacao.Despesa, 300m), (ajuste.Tipo, ajuste.Valor));
        Assert.False(RegrasFinanceiras.EntraNoResultadoEmMemoria(ajuste));
        Assert.Single(await ctx.FinancialEventLogs.Where(e => e.EntidadeId == ajuste.Id).ToListAsync());
    }

    [Fact]
    public async Task MesmaChave_NaoTransfereDuasVezes()
    {
        var ctx = CreateContext();
        var u = Guid.NewGuid();
        var conta = NovaConta(ctx, u, "Inter", 300m);
        var destino = NovaConta(ctx, u, "Nubank");
        await ctx.SaveChangesAsync();
        var chave = Chave();
        var dto = new EncerrarContaDto { ContaDestinoId = destino.Id };

        await Servico(ctx).EncerrarAsync(conta.Id, dto, u, chave);
        var replay = await Servico(ctx).EncerrarAsync(conta.Id, dto, u, chave);

        Assert.Equal("repetido", replay.Resolucao);
        Assert.Equal(2, await ctx.Transacoes.CountAsync(t => t.EhTransferencia));
        Assert.Equal(300m, await SaldoAsync(ctx, destino.Id, u));
    }

    [Fact]
    public async Task ContaFixaAtivaOuPausada_Recusa()
    {
        var ctx = CreateContext();
        var u = Guid.NewGuid();
        var conta = NovaConta(ctx, u, "Inter");
        ctx.Recorrentes.Add(new Recorrente
        {
            Id = Guid.NewGuid(), Descricao = "Aluguel", Valor = 1800, Tipo = TipoTransacao.Despesa, ContaId = conta.Id,
            Frequencia = FrequenciaRecorrencia.Mensal, Dia = 10, DataInicio = DateTime.UtcNow, Ativo = false, CriadoPor = u,
        });
        await ctx.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => Servico(ctx).EncerrarAsync(conta.Id, new EncerrarContaDto(), u, Chave()));
        Assert.Contains("conta fixa", ex.Message);
    }

    [Fact]
    public async Task LancamentoPrevisto_Recusa()
    {
        var ctx = CreateContext();
        var u = Guid.NewGuid();
        var conta = NovaConta(ctx, u, "Inter");
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Salário", Valor = 5000, Tipo = TipoTransacao.Receita, ContaId = conta.Id,
            Data = Hoje.AddDays(10), CriadoPor = u, StatusTransacao = StatusTransacao.Previsao,
        });
        await ctx.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => Servico(ctx).EncerrarAsync(conta.Id, new EncerrarContaDto(), u, Chave()));
        Assert.Contains("previstos", ex.Message);
    }

    [Fact]
    public async Task Carteira_NaoEncerra()
    {
        var ctx = CreateContext();
        var u = Guid.NewGuid();
        var carteira = new Conta { Id = Guid.NewGuid(), Nome = "Carteira", Tipo = TipoConta.Dinheiro, IsCarteira = true, UsuarioIdProprietario = u };
        ctx.Contas.Add(carteira);
        await ctx.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() => Servico(ctx).EncerrarAsync(carteira.Id, new EncerrarContaDto(), u, Chave()));
    }

    [Fact]
    public async Task ContaDeOutraPessoa_404()
    {
        var ctx = CreateContext();
        var conta = NovaConta(ctx, Guid.NewGuid(), "Inter");
        await ctx.SaveChangesAsync();

        await Assert.ThrowsAsync<KeyNotFoundException>(() => Servico(ctx).EncerrarAsync(conta.Id, new EncerrarContaDto(), Guid.NewGuid(), Chave()));
    }

    [Fact]
    public async Task Encerrada_NaoRecebeTransferencia_EReabrirVolta()
    {
        var ctx = CreateContext();
        var u = Guid.NewGuid();
        var conta = NovaConta(ctx, u, "Inter");
        var outra = NovaConta(ctx, u, "Nubank", 100m);
        await ctx.SaveChangesAsync();
        await Servico(ctx).EncerrarAsync(conta.Id, new EncerrarContaDto(), u, Chave());

        var transferir = () => new TransferenciaService(ctx).CriarAsync(new CriarTransferenciaDto
        {
            ContaOrigemId = outra.Id, ContaDestinoId = conta.Id, Valor = 10, Data = Hoje,
        }, u);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(transferir);
        Assert.Contains("encerrada", ex.Message);
        await Assert.ThrowsAsync<InvalidOperationException>(() => DonoRecursos.ExigirContaAbertaAsync(ctx, conta.Id, u));

        await Servico(ctx).ReabrirAsync(conta.Id, u);
        Assert.Null((await ctx.Contas.FindAsync(conta.Id))!.EncerradaEm);
        await transferir();
        Assert.Equal(10m, await SaldoAsync(ctx, conta.Id, u));
    }

    [Fact]
    public async Task CartaoVinculado_PerdeOVinculo()
    {
        var ctx = CreateContext();
        var u = Guid.NewGuid();
        var conta = NovaConta(ctx, u, "Inter");
        var cartao = new CartaoCredito { Id = Guid.NewGuid(), Nome = "Inter", TemCredito = true, LimiteTotal = 1000, ContaId = conta.Id, CriadoPor = u, Ativo = true };
        ctx.CartoesCredito.Add(cartao);
        await ctx.SaveChangesAsync();

        await Servico(ctx).EncerrarAsync(conta.Id, new EncerrarContaDto(), u, Chave());

        Assert.Null((await ctx.CartoesCredito.FindAsync(cartao.Id))!.ContaId);
    }
}

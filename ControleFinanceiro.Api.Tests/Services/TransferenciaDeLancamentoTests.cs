using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// "Isso foi entre minhas contas" (Gustavo, 2026-11-22: a Swile manda o bônus pro Nubank e o extrato do Nubank não diz
/// que é conta dele): o lançamento que entrou como receita vira transferência, sem mudar o saldo da conta dele.
/// </summary>
public class TransferenciaDeLancamentoTests
{
    private sealed record Cenario(AppDbContext Ctx, Guid Usuario, Conta Nubank, Conta Swile, Transacao Recebida, Categoria Renda);

    private static Cenario Montar()
    {
        var ctx = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning)).Options);
        var usuario = Guid.NewGuid();
        var nubank = new Conta { Id = Guid.NewGuid(), Nome = "Nubank", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuario };
        var swile = new Conta { Id = Guid.NewGuid(), Nome = "Swile", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuario };
        var renda = new Categoria { Id = Guid.NewGuid(), Descricao = "Renda", Finalidade = Finalidade.Receita };
        var recebida = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Transferência Recebida - Swile", Valor = 1144m, Tipo = TipoTransacao.Receita,
            ContaId = nubank.Id, CriadoPor = usuario, Data = new DateOnly(2026, 11, 9), StatusTransacao = StatusTransacao.Executado,
            CategoriaId = renda.Id,
        };
        ctx.AddRange(nubank, swile, renda, recebida);
        ctx.SaveChanges();
        return new Cenario(ctx, usuario, nubank, swile, recebida, renda);
    }

    [Fact]
    public async Task Receita_ViraTransferencia_CriaAPernaNaOutraConta_ESaiDoResultado()
    {
        var c = Montar();
        var dto = await new TransferenciaService(c.Ctx).DeLancamentoAsync(c.Recebida.Id, c.Swile.Id, c.Usuario, "k1");
        c.Ctx.ChangeTracker.Clear();

        Assert.Equal((c.Swile.Id, c.Nubank.Id, 1144m), (dto.ContaOrigemId, dto.ContaDestinoId, dto.Valor));
        var recebida = await c.Ctx.Transacoes.SingleAsync(t => t.Id == c.Recebida.Id);
        Assert.True(recebida.EhTransferencia);
        Assert.Null(recebida.CategoriaId);
        Assert.False(RegrasFinanceiras.EntraNoResultadoEmMemoria(recebida));
        var saida = await c.Ctx.Transacoes.SingleAsync(t => t.ContaId == c.Swile.Id);
        Assert.Equal((TipoTransacao.Despesa, 1144m, new DateOnly(2026, 11, 9), true), (saida.Tipo, saida.Valor, saida.Data, saida.EhTransferencia));
        Assert.Equal(1144m, (await RegrasFinanceiras.SaldoDaContaAsync(c.Ctx, c.Nubank.Id, c.Usuario)).Saldo); // não mudou
        Assert.Equal(-1144m, (await RegrasFinanceiras.SaldoDaContaAsync(c.Ctx, c.Swile.Id, c.Usuario)).Saldo);
        Assert.NotEmpty(await c.Ctx.FinancialEventLogs.Where(e => e.Tipo == FinancialEventType.TransferenciaCriada).ToListAsync());
    }

    [Fact]
    public async Task JuntaComAPernaQueJaEstaNaOutraConta_SemCriarOutra()
    {
        var c = Montar();
        var jaLa = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Envio pro Nubank", Valor = 1144m, Tipo = TipoTransacao.Despesa, ContaId = c.Swile.Id,
            CriadoPor = c.Usuario, Data = new DateOnly(2026, 11, 8), StatusTransacao = StatusTransacao.Executado,
        };
        c.Ctx.Add(jaLa);
        c.Ctx.SaveChanges();

        await new TransferenciaService(c.Ctx).DeLancamentoAsync(c.Recebida.Id, c.Swile.Id, c.Usuario, "k1");
        c.Ctx.ChangeTracker.Clear();

        Assert.Single(await c.Ctx.Transacoes.Where(t => t.ContaId == c.Swile.Id).ToListAsync());
        var tr = await c.Ctx.Transferencias.SingleAsync();
        Assert.Equal((jaLa.Id, c.Recebida.Id), (tr.TransacaoOrigemId, tr.TransacaoDestinoId));
    }

    [Fact]
    public async Task MesmaChave_DevolveAMesma_SemCriarDeNovo()
    {
        var c = Montar();
        var svc = new TransferenciaService(c.Ctx);
        var a = await svc.DeLancamentoAsync(c.Recebida.Id, c.Swile.Id, c.Usuario, "k1");
        var b = await svc.DeLancamentoAsync(c.Recebida.Id, c.Swile.Id, c.Usuario, "k1");
        Assert.Equal(a.Id, b.Id);
        Assert.Single(await c.Ctx.Transferencias.ToListAsync());
    }

    [Fact]
    public async Task LancamentoDeOutraPessoa_OuJaTransferencia_OuContaDeOutraPessoa_Recusa()
    {
        var c = Montar();
        var svc = new TransferenciaService(c.Ctx);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.DeLancamentoAsync(c.Recebida.Id, c.Swile.Id, Guid.NewGuid(), "k1"));

        var deOutro = new Conta { Id = Guid.NewGuid(), Nome = "Alheia", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = Guid.NewGuid() };
        c.Ctx.Add(deOutro);
        c.Ctx.SaveChanges();
        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.DeLancamentoAsync(c.Recebida.Id, deOutro.Id, c.Usuario, "k2"));
        await Assert.ThrowsAsync<ArgumentException>(() => svc.DeLancamentoAsync(c.Recebida.Id, c.Nubank.Id, c.Usuario, "k3"));

        await svc.DeLancamentoAsync(c.Recebida.Id, c.Swile.Id, c.Usuario, "k4");
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.DeLancamentoAsync(c.Recebida.Id, c.Swile.Id, c.Usuario, "k5"));
    }
}

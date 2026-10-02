using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class OnboardingServiceTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(
                Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static Guid SeedUsuario(AppDbContext ctx)
    {
        var u = new Usuario
        {
            Id = Guid.NewGuid(), Email = "u@test.com", Nome = "User", PasswordHash = "x",
        };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u.Id;
    }

    private static Guid SeedConta(AppDbContext ctx, Guid usuarioId)
    {
        var conta = new Conta
        {
            Id = Guid.NewGuid(), Nome = "Conta", Tipo = TipoConta.ContaCorrente,
            UsuarioIdProprietario = usuarioId,
        };
        ctx.Contas.Add(conta);
        ctx.SaveChanges();
        return conta.Id;
    }

    [Fact]
    public async Task ObterStatusAsync_UsuarioInexistente_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var svc = new OnboardingService(ctx);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.ObterStatusAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task ObterStatusAsync_UsuarioNovo_TudoFalso()
    {
        var ctx = CreateContext();
        var usuario = SeedUsuario(ctx);
        var svc = new OnboardingService(ctx);

        var status = await svc.ObterStatusAsync(usuario);

        Assert.False(status.Concluido);
        Assert.False(status.TemConta);
        Assert.False(status.TemCartao);
        Assert.False(status.TemTransacao);
        Assert.False(status.TemFamilia);
    }

    [Fact]
    public async Task ObterStatusAsync_ComConta_TemContaVerdadeiro()
    {
        var ctx = CreateContext();
        var usuario = SeedUsuario(ctx);
        SeedConta(ctx, usuario);
        var svc = new OnboardingService(ctx);

        var status = await svc.ObterStatusAsync(usuario);

        Assert.True(status.TemConta);
    }

    [Fact]
    public async Task ObterStatusAsync_ComCartao_TemCartaoVerdadeiro()
    {
        var ctx = CreateContext();
        var usuario = SeedUsuario(ctx);
        ctx.CartoesCredito.Add(new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = "Cartão", CriadoPor = usuario, TemCredito = true,
        });
        ctx.SaveChanges();
        var svc = new OnboardingService(ctx);

        var status = await svc.ObterStatusAsync(usuario);

        Assert.True(status.TemCartao);
    }

    [Fact]
    public async Task ObterStatusAsync_ComTransacaoEmConta_TemTransacaoVerdadeiro()
    {
        var ctx = CreateContext();
        var usuario = SeedUsuario(ctx);
        var contaId = SeedConta(ctx, usuario);
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Compra", Valor = 10m,
            Tipo = TipoTransacao.Despesa, Data = new DateOnly(2026, 5, 10),
            ContaId = contaId, Ativo = true, StatusTransacao = StatusTransacao.Executado,
        });
        ctx.SaveChanges();
        var svc = new OnboardingService(ctx);

        var status = await svc.ObterStatusAsync(usuario);

        Assert.True(status.TemTransacao);
    }

    [Fact]
    public async Task ObterStatusAsync_ComFamilia_TemFamiliaVerdadeiro()
    {
        var ctx = CreateContext();
        var usuario = SeedUsuario(ctx);
        var familia = new Familia
        {
            Id = Guid.NewGuid(), Nome = "F", CriadoPorUsuarioId = usuario,
        };
        ctx.Familias.Add(familia);
        ctx.MembrosFamilia.Add(new MembroFamilia
        {
            Id = Guid.NewGuid(), FamiliaId = familia.Id, UsuarioId = usuario,
            Papel = "Administrador", Ativo = true,
        });
        ctx.SaveChanges();
        var svc = new OnboardingService(ctx);

        var status = await svc.ObterStatusAsync(usuario);

        Assert.True(status.TemFamilia);
    }

    [Fact]
    public async Task ConcluirAsync_MarcaConcluido()
    {
        var ctx = CreateContext();
        var usuario = SeedUsuario(ctx);
        var svc = new OnboardingService(ctx);

        await svc.ConcluirAsync(usuario);

        var status = await svc.ObterStatusAsync(usuario);
        Assert.True(status.Concluido);
    }

    [Fact]
    public async Task ConcluirAsync_Idempotente()
    {
        var ctx = CreateContext();
        var usuario = SeedUsuario(ctx);
        var svc = new OnboardingService(ctx);

        await svc.ConcluirAsync(usuario);
        await svc.ConcluirAsync(usuario); // segunda chamada não lança

        var status = await svc.ObterStatusAsync(usuario);
        Assert.True(status.Concluido);
    }
}

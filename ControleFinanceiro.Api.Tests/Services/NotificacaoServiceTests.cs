using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class NotificacaoServiceTests
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

    private static NotificacaoService CreateService(AppDbContext ctx) =>
        new(ctx, NullLogger<NotificacaoService>.Instance);

    [Fact]
    public async Task CriarAsync_PersisteNotificacao()
    {
        var ctx = CreateContext();
        var usuario = Guid.NewGuid();
        var svc = CreateService(ctx);

        await svc.CriarAsync(usuario, TipoNotificacao.ConviteFamilia, "Título", "Mensagem", "/familias");

        var n = await ctx.Notificacoes.SingleAsync();
        Assert.Equal(usuario, n.UsuarioId);
        Assert.Equal("Título", n.Titulo);
        Assert.False(n.Lida);
        Assert.Equal("/familias", n.LinkRelativo);
    }

    [Fact]
    public async Task ListarAsync_OrdenaMaisRecentePrimeiro()
    {
        var ctx = CreateContext();
        var usuario = Guid.NewGuid();
        ctx.Notificacoes.AddRange(
            new Notificacao { Id = Guid.NewGuid(), UsuarioId = usuario, Titulo = "Antiga",
                Tipo = TipoNotificacao.Outro, CriadoEm = new DateTime(2026, 5, 1) },
            new Notificacao { Id = Guid.NewGuid(), UsuarioId = usuario, Titulo = "Nova",
                Tipo = TipoNotificacao.Outro, CriadoEm = new DateTime(2026, 5, 18) });
        ctx.SaveChanges();
        var svc = CreateService(ctx);

        var lista = await svc.ListarAsync(usuario);

        Assert.Equal("Nova", lista[0].Titulo);
        Assert.Equal("Antiga", lista[1].Titulo);
    }

    [Fact]
    public async Task ListarAsync_IsolaPorUsuario()
    {
        var ctx = CreateContext();
        var ana = Guid.NewGuid();
        var bia = Guid.NewGuid();
        ctx.Notificacoes.AddRange(
            new Notificacao { Id = Guid.NewGuid(), UsuarioId = ana, Titulo = "Da Ana", Tipo = TipoNotificacao.Outro },
            new Notificacao { Id = Guid.NewGuid(), UsuarioId = bia, Titulo = "Da Bia", Tipo = TipoNotificacao.Outro });
        ctx.SaveChanges();
        var svc = CreateService(ctx);

        var lista = await svc.ListarAsync(ana);

        Assert.Single(lista);
        Assert.Equal("Da Ana", lista[0].Titulo);
    }

    [Fact]
    public async Task ContarNaoLidasAsync_ContaApenasNaoLidas()
    {
        var ctx = CreateContext();
        var usuario = Guid.NewGuid();
        ctx.Notificacoes.AddRange(
            new Notificacao { Id = Guid.NewGuid(), UsuarioId = usuario, Titulo = "A", Tipo = TipoNotificacao.Outro, Lida = false },
            new Notificacao { Id = Guid.NewGuid(), UsuarioId = usuario, Titulo = "B", Tipo = TipoNotificacao.Outro, Lida = false },
            new Notificacao { Id = Guid.NewGuid(), UsuarioId = usuario, Titulo = "C", Tipo = TipoNotificacao.Outro, Lida = true });
        ctx.SaveChanges();
        var svc = CreateService(ctx);

        var contagem = await svc.ContarNaoLidasAsync(usuario);

        Assert.Equal(2, contagem.NaoLidas);
    }

    [Fact]
    public async Task MarcarLidaAsync_DefineLida()
    {
        var ctx = CreateContext();
        var usuario = Guid.NewGuid();
        var n = new Notificacao { Id = Guid.NewGuid(), UsuarioId = usuario, Titulo = "A", Tipo = TipoNotificacao.Outro };
        ctx.Notificacoes.Add(n);
        ctx.SaveChanges();
        var svc = CreateService(ctx);

        await svc.MarcarLidaAsync(n.Id, usuario);

        Assert.True((await ctx.Notificacoes.FindAsync(n.Id))!.Lida);
    }

    [Fact]
    public async Task MarcarLidaAsync_OutroUsuario_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var n = new Notificacao { Id = Guid.NewGuid(), UsuarioId = Guid.NewGuid(), Titulo = "A", Tipo = TipoNotificacao.Outro };
        ctx.Notificacoes.Add(n);
        ctx.SaveChanges();
        var svc = CreateService(ctx);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.MarcarLidaAsync(n.Id, Guid.NewGuid()));
    }

    [Fact]
    public async Task MarcarTodasLidasAsync_ZeraNaoLidas()
    {
        var ctx = CreateContext();
        var usuario = Guid.NewGuid();
        ctx.Notificacoes.AddRange(
            new Notificacao { Id = Guid.NewGuid(), UsuarioId = usuario, Titulo = "A", Tipo = TipoNotificacao.Outro },
            new Notificacao { Id = Guid.NewGuid(), UsuarioId = usuario, Titulo = "B", Tipo = TipoNotificacao.Outro });
        ctx.SaveChanges();
        var svc = CreateService(ctx);

        await svc.MarcarTodasLidasAsync(usuario);

        var contagem = await svc.ContarNaoLidasAsync(usuario);
        Assert.Equal(0, contagem.NaoLidas);
    }
}

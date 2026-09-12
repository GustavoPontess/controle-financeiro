using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Notificações do painel admin — stream SEPARADO do financeiro. Cobre a lógica do serviço
/// (criar/listar/contar/marcar) e garante que nada aqui cruza com as notificações do usuário.
/// </summary>
public class NotificacaoAdminServiceTests
{
    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    [Fact]
    public async Task Criar_adicionaNotificacaoNaoLida()
    {
        using var ctx = CreateContext();
        var svc = TestHelpers.NotifAdmin(ctx);

        await svc.CriarAsync(TipoNotificacaoAdmin.NovoCadastro, "Novo cadastro na fila", "Fulano aguardando.", "/admin/pendentes");

        var n = Assert.Single(ctx.NotificacoesAdmin);
        Assert.Equal(TipoNotificacaoAdmin.NovoCadastro, n.Tipo);
        Assert.Equal("/admin/pendentes", n.LinkRelativo);
        Assert.False(n.Lida);
    }

    [Fact]
    public async Task Listar_retornaMaisRecentePrimeiro()
    {
        using var ctx = CreateContext();
        ctx.NotificacoesAdmin.AddRange(
            new NotificacaoAdmin { Id = Guid.NewGuid(), Tipo = TipoNotificacaoAdmin.NovoCadastro, Titulo = "Velha", Mensagem = "", CriadoEm = DateTime.UtcNow.AddHours(-2) },
            new NotificacaoAdmin { Id = Guid.NewGuid(), Tipo = TipoNotificacaoAdmin.Seguranca, Titulo = "Nova", Mensagem = "", CriadoEm = DateTime.UtcNow });
        await ctx.SaveChangesAsync();

        var lista = await TestHelpers.NotifAdmin(ctx).ListarAsync();

        Assert.Equal("Nova", lista[0].Titulo);
        Assert.Equal("Velha", lista[1].Titulo);
    }

    [Fact]
    public async Task Contar_contaSoNaoLidas()
    {
        using var ctx = CreateContext();
        ctx.NotificacoesAdmin.AddRange(
            new NotificacaoAdmin { Id = Guid.NewGuid(), Tipo = TipoNotificacaoAdmin.NovoCadastro, Titulo = "a", Mensagem = "", Lida = false },
            new NotificacaoAdmin { Id = Guid.NewGuid(), Tipo = TipoNotificacaoAdmin.NovoCadastro, Titulo = "b", Mensagem = "", Lida = true });
        await ctx.SaveChangesAsync();

        var c = await TestHelpers.NotifAdmin(ctx).ContarNaoLidasAsync();

        Assert.Equal(1, c.NaoLidas);
    }

    [Fact]
    public async Task MarcarLida_marcaEhIdempotente_eLancaSeNaoExiste()
    {
        using var ctx = CreateContext();
        var svc = TestHelpers.NotifAdmin(ctx);
        var n = new NotificacaoAdmin { Id = Guid.NewGuid(), Tipo = TipoNotificacaoAdmin.NovoCadastro, Titulo = "a", Mensagem = "" };
        ctx.NotificacoesAdmin.Add(n);
        await ctx.SaveChangesAsync();

        await svc.MarcarLidaAsync(n.Id);
        await svc.MarcarLidaAsync(n.Id); // idempotente
        Assert.True((await ctx.NotificacoesAdmin.FindAsync(n.Id))!.Lida);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.MarcarLidaAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task MarcarTodasLidas_zeraOContador()
    {
        using var ctx = CreateContext();
        var svc = TestHelpers.NotifAdmin(ctx);
        ctx.NotificacoesAdmin.AddRange(
            new NotificacaoAdmin { Id = Guid.NewGuid(), Tipo = TipoNotificacaoAdmin.NovoCadastro, Titulo = "a", Mensagem = "" },
            new NotificacaoAdmin { Id = Guid.NewGuid(), Tipo = TipoNotificacaoAdmin.Seguranca, Titulo = "b", Mensagem = "" });
        await ctx.SaveChangesAsync();

        await svc.MarcarTodasLidasAsync();

        Assert.Equal(0, (await svc.ContarNaoLidasAsync()).NaoLidas);
    }

    [Fact]
    public async Task Criar_naoTocaNoStreamDoUsuario()
    {
        // Garantia de não-mistura: criar notificação de admin não cria nada em Notificacoes (usuário).
        using var ctx = CreateContext();
        await TestHelpers.NotifAdmin(ctx).CriarAsync(TipoNotificacaoAdmin.NovoCadastro, "x", "y");

        Assert.Single(ctx.NotificacoesAdmin);
        Assert.Empty(ctx.Notificacoes);
    }
}

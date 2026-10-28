using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Link do e-mail de "pedido recebido": confirmar o e-mail ou apagar o pedido ("Não fui eu"). Uso único, vence, só
/// vale pra pedido que espera aprovação, e apagar leva o pedido inteiro (usuário, Carteira, aviso do admin).
/// </summary>
public class ConfirmacaoCadastroServiceTests
{
    private static AppDbContext CreateContext() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
        .Options);

    private static ConfirmacaoCadastroService Svc(AppDbContext ctx) => new(ctx, NullLogger<ConfirmacaoCadastroService>.Instance);

    private static Usuario Pedido(AppDbContext ctx, DateTime? criadoEm = null, StatusUsuario status = StatusUsuario.AguardandoAprovacao)
    {
        var u = new Usuario
        {
            Id = Guid.NewGuid(), Email = $"p{Guid.NewGuid():N}@test.com", Nome = "P", PasswordHash = "x",
            Status = status, CriadoEm = criadoEm ?? DateTime.UtcNow,
        };
        ctx.Usuarios.Add(u);
        ctx.Contas.Add(new Conta { Id = Guid.NewGuid(), Nome = "Carteira", Tipo = TipoConta.Dinheiro, IsCarteira = true, UsuarioIdProprietario = u.Id });
        ctx.NotificacoesAdmin.Add(new NotificacaoAdmin { Id = Guid.NewGuid(), Tipo = TipoNotificacaoAdmin.NovoCadastro, Titulo = "Novo cadastro", AlvoId = u.Id });
        ctx.SaveChanges();
        return u;
    }

    [Fact]
    public async Task Confirmar_marcaOEmail_eOLinkNaoServeDeNovo()
    {
        using var ctx = CreateContext();
        var u = Pedido(ctx);
        var svc = Svc(ctx);
        var (token, _) = (await svc.GerarAsync(u.Id))!.Value;

        await svc.ConfirmarAsync(token);

        Assert.NotNull((await ctx.Usuarios.FindAsync(u.Id))!.EmailConfirmadoEm);
        Assert.Equal(StatusUsuario.AguardandoAprovacao, u.Status); // segue esperando o admin
        // Já usado: nem confirmar de novo nem "Não fui eu" (quem confirmou não perde o pedido por um clique depois).
        await Assert.ThrowsAsync<ArgumentException>(() => svc.ConfirmarAsync(token));
        await Assert.ThrowsAsync<ArgumentException>(() => svc.NaoFuiEuAsync(token));
        Assert.Equal(1, await ctx.Usuarios.CountAsync());
    }

    [Fact]
    public async Task NaoFuiEu_apagaOPedidoInteiro()
    {
        using var ctx = CreateContext();
        var u = Pedido(ctx);
        var outro = Pedido(ctx);
        var svc = Svc(ctx);
        var (token, _) = (await svc.GerarAsync(u.Id))!.Value;

        await svc.NaoFuiEuAsync(token);

        Assert.Null(await ctx.Usuarios.FindAsync(u.Id));
        Assert.False(await ctx.Contas.AnyAsync(c => c.UsuarioIdProprietario == u.Id));
        Assert.False(await ctx.NotificacoesAdmin.AnyAsync(n => n.AlvoId == u.Id));
        Assert.NotNull(await ctx.Usuarios.FindAsync(outro.Id)); // só o dele
    }

    [Theory]
    [InlineData(StatusUsuario.Ativo)]
    [InlineData(StatusUsuario.Recusado)]
    public async Task LinkDePedidoJaDecidido_naoApagaNemConfirma(StatusUsuario decidido)
    {
        using var ctx = CreateContext();
        var u = Pedido(ctx);
        var svc = Svc(ctx);
        var (token, _) = (await svc.GerarAsync(u.Id))!.Value;
        u.Status = decidido; // o admin decidiu antes do clique
        await ctx.SaveChangesAsync();

        await Assert.ThrowsAsync<ArgumentException>(() => svc.NaoFuiEuAsync(token));
        await Assert.ThrowsAsync<ArgumentException>(() => svc.ConfirmarAsync(token));
        Assert.NotNull(await ctx.Usuarios.FindAsync(u.Id));
    }

    [Fact]
    public async Task LinkVencido_ouInventado_mesmaRecusa()
    {
        using var ctx = CreateContext();
        var u = Pedido(ctx);
        var svc = Svc(ctx);
        var (token, _) = (await svc.GerarAsync(u.Id))!.Value;
        var t = await ctx.TokensCadastro.SingleAsync();
        t.ExpiraEm = DateTime.UtcNow.AddMinutes(-1);
        await ctx.SaveChangesAsync();

        var vencido = await Assert.ThrowsAsync<ArgumentException>(() => svc.ConfirmarAsync(token));
        var inventado = await Assert.ThrowsAsync<ArgumentException>(() => svc.ConfirmarAsync("nao-existe"));
        Assert.Equal(vencido.Message, inventado.Message); // não diz se o link existiu
    }

    [Fact]
    public async Task Gerar_deNovo_invalidaOLinkAnterior()
    {
        using var ctx = CreateContext();
        var u = Pedido(ctx);
        var svc = Svc(ctx);
        var (primeiro, _) = (await svc.GerarAsync(u.Id))!.Value;
        var (segundo, _) = (await svc.GerarAsync(u.Id))!.Value;

        await Assert.ThrowsAsync<ArgumentException>(() => svc.ConfirmarAsync(primeiro));
        await svc.ConfirmarAsync(segundo);
    }

    [Fact]
    public async Task Gerar_soParaPedidoQueEsperaENaoConfirmou()
    {
        using var ctx = CreateContext();
        var ativo = Pedido(ctx, status: StatusUsuario.Ativo);
        var confirmado = Pedido(ctx);
        confirmado.EmailConfirmadoEm = DateTime.UtcNow;
        await ctx.SaveChangesAsync();
        var svc = Svc(ctx);

        Assert.Null(await svc.GerarAsync(ativo.Id));
        Assert.Null(await svc.GerarAsync(confirmado.Id));
        Assert.Null(await svc.GerarAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task Purga_apagaSoPedidoNaoConfirmadoVencido()
    {
        using var ctx = CreateContext();
        var velho = Pedido(ctx, criadoEm: DateTime.UtcNow.AddDays(-(ConfirmacaoCadastroService.DiasValidade + 1)));
        var novo = Pedido(ctx);
        var velhoConfirmado = Pedido(ctx, criadoEm: DateTime.UtcNow.AddDays(-30));
        velhoConfirmado.EmailConfirmadoEm = DateTime.UtcNow.AddDays(-29);
        var ativoVelho = Pedido(ctx, criadoEm: DateTime.UtcNow.AddDays(-30), status: StatusUsuario.Ativo);
        await ctx.SaveChangesAsync();

        var apagados = await Svc(ctx).PurgarNaoConfirmadosAsync();

        Assert.Equal(1, apagados);
        Assert.Null(await ctx.Usuarios.FindAsync(velho.Id));
        Assert.NotNull(await ctx.Usuarios.FindAsync(novo.Id));
        Assert.NotNull(await ctx.Usuarios.FindAsync(velhoConfirmado.Id));
        Assert.NotNull(await ctx.Usuarios.FindAsync(ativoVelho.Id));
    }
}

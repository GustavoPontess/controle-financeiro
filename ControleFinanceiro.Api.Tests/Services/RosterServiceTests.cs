using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Roster / "escolher conta" (chooser pré-login, opt-in). Foco: amarração por NAVEGADOR (device),
/// mascaramento do e-mail na lista, e o e-mail real revelado só no select. Não usa senha/VerifyPassword
/// → não precisa da coleção PasswordHasherEnv.
/// </summary>
public class RosterServiceTests
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

    private static Usuario SeedUsuario(AppDbContext ctx, string email, string nome, StatusUsuario status = StatusUsuario.Ativo)
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = email, Nome = nome, PasswordHash = "x", Status = status };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u;
    }

    // ── LembrarAsync ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Lembrar_adicionaConta_aoDevice()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "a@test.com", "Ana");
        var svc = new RosterService(ctx);

        await svc.LembrarAsync("device-1", u.Id);

        Assert.Single(ctx.ContasLembradas);
        var lista = await svc.ListarAsync("device-1");
        Assert.Single(lista);
        Assert.Equal(u.Id, lista[0].UsuarioId);
    }

    [Fact]
    public async Task Relembrar_mesmaConta_naoDuplica_soAtualizaUltimoUso()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "a@test.com", "Ana");
        var svc = new RosterService(ctx);

        await svc.LembrarAsync("device-1", u.Id);
        var primeiro = (await ctx.ContasLembradas.SingleAsync()).UltimoUsoEm;
        await svc.LembrarAsync("device-1", u.Id);

        Assert.Single(ctx.ContasLembradas); // não duplicou (índice único device+usuario)
        Assert.True((await ctx.ContasLembradas.SingleAsync()).UltimoUsoEm >= primeiro);
    }

    // ── ListarAsync ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Listar_mascaraEmail_eNaoVazaOInteiro()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "gustavo@gmail.com", "Gustavo");
        var svc = new RosterService(ctx);
        await svc.LembrarAsync("device-1", u.Id);

        var lista = await svc.ListarAsync("device-1");

        Assert.Equal("Gustavo", lista[0].Nome);
        Assert.Equal("gu•••@gmail.com", lista[0].EmailMascarado);
        Assert.DoesNotContain("gustavo@gmail.com", System.Text.Json.JsonSerializer.Serialize(lista));
    }

    [Fact]
    public async Task Listar_soContasAtivas()
    {
        using var ctx = CreateContext();
        var ativa = SeedUsuario(ctx, "ativa@test.com", "Ativa");
        var bloqueada = SeedUsuario(ctx, "block@test.com", "Bloqueada", StatusUsuario.Bloqueado);
        var svc = new RosterService(ctx);
        await svc.LembrarAsync("device-1", ativa.Id);
        await svc.LembrarAsync("device-1", bloqueada.Id);

        var lista = await svc.ListarAsync("device-1");

        Assert.Single(lista);
        Assert.Equal(ativa.Id, lista[0].UsuarioId);
    }

    [Fact]
    public async Task Listar_isolaPorDevice_umNavegadorNaoVeOOutro()
    {
        using var ctx = CreateContext();
        var a = SeedUsuario(ctx, "a@test.com", "Ana");
        var b = SeedUsuario(ctx, "b@test.com", "Bruno");
        var svc = new RosterService(ctx);
        await svc.LembrarAsync("device-A", a.Id);
        await svc.LembrarAsync("device-B", b.Id);

        var listaA = await svc.ListarAsync("device-A");

        Assert.Single(listaA);
        Assert.Equal(a.Id, listaA[0].UsuarioId); // device A não vê a conta do device B
    }

    [Fact]
    public async Task Listar_semDevice_ouDeviceDesconhecido_vazio()
    {
        using var ctx = CreateContext();
        var svc = new RosterService(ctx);
        Assert.Empty(await svc.ListarAsync(null));
        Assert.Empty(await svc.ListarAsync("nunca-vi"));
    }

    // ── ObterEmailAsync (reveal no select) ────────────────────────────────────────

    [Fact]
    public async Task ObterEmail_devolveReal_soParaContaDoDevice()
    {
        using var ctx = CreateContext();
        var a = SeedUsuario(ctx, "ana@test.com", "Ana");
        var svc = new RosterService(ctx);
        await svc.LembrarAsync("device-A", a.Id);

        Assert.Equal("ana@test.com", await svc.ObterEmailAsync("device-A", a.Id));
        Assert.Null(await svc.ObterEmailAsync("device-B", a.Id)); // outro navegador não revela
        Assert.Null(await svc.ObterEmailAsync("device-A", Guid.NewGuid())); // conta não rostered
    }

    // ── Remover ───────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Remover_tiraUmaConta_doDevice()
    {
        using var ctx = CreateContext();
        var a = SeedUsuario(ctx, "a@test.com", "Ana");
        var b = SeedUsuario(ctx, "b@test.com", "Bruno");
        var svc = new RosterService(ctx);
        await svc.LembrarAsync("device-1", a.Id);
        await svc.LembrarAsync("device-1", b.Id);

        await svc.RemoverAsync("device-1", a.Id);

        var lista = await svc.ListarAsync("device-1");
        Assert.Single(lista);
        Assert.Equal(b.Id, lista[0].UsuarioId);
    }

    [Fact]
    public async Task RemoverTodas_esquecaODeviceInteiro()
    {
        using var ctx = CreateContext();
        var a = SeedUsuario(ctx, "a@test.com", "Ana");
        var b = SeedUsuario(ctx, "b@test.com", "Bruno");
        var svc = new RosterService(ctx);
        await svc.LembrarAsync("device-1", a.Id);
        await svc.LembrarAsync("device-1", b.Id);

        await svc.RemoverTodasAsync("device-1");

        Assert.Empty(await svc.ListarAsync("device-1"));
    }

    // ── Mascaramento ───────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("gustavo@gmail.com", "gu•••@gmail.com")]
    [InlineData("ab@x.com", "ab•••@x.com")]
    [InlineData("a@b.com", "a•••@b.com")]
    public void MascararEmail_mostra2primeirosMaisDominio(string email, string esperado)
        => Assert.Equal(esperado, RosterService.MascararEmail(email));
}

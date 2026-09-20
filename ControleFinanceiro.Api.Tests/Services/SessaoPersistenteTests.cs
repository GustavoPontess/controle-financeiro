using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Auth;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using ControleFinanceiro.Api.Infrastructure.Jobs;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// "Manter-me conectado": o flag do login decide se a sessão é persistente (LembrarSessao) e precisa
/// SOBREVIVER à rotação (refresh) — senão uma renovação viraria a natureza do cookie. Usa login com
/// senha real → coleção PasswordHasherEnv.
/// </summary>
[Collection("PasswordHasherEnv")]
public class SessaoPersistenteTests
{
    private const string Senha = "SenhaForteDeTeste2026!";

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(
                Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static ControleFinanceiro.Api.Services.AuthService CreateService(AppDbContext ctx)
    {
        var jwt = new JwtTokenProvider("chave-de-teste-suficientemente-grande-0123456789", "test", "test");
        var dispatcher = new Mock<IPasswordResetDispatcher>();
        return new ControleFinanceiro.Api.Services.AuthService(
            ctx, jwt, dispatcher.Object, new ControleFinanceiro.Api.Services.MfaService(ctx), TestHelpers.NotifAdmin(ctx));
    }

    private static void SeedUsuario(AppDbContext ctx, string email)
    {
        ctx.Usuarios.Add(new Usuario
        {
            Id = Guid.NewGuid(),
            Email = email,
            Nome = "User",
            PasswordHash = PasswordHasher.HashPassword(Senha),
            Status = StatusUsuario.Ativo,
        });
        ctx.SaveChanges();
    }

    private static LoginDto Login(string email) => new() { Email = email, Password = Senha };

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Login_propagaManterConectado_paraAuthEParaOToken(bool manter)
    {
        using var ctx = CreateContext();
        SeedUsuario(ctx, "a@test.com");
        var auth = CreateService(ctx);

        var r = await auth.LoginAsync(Login("a@test.com"), trustedDeviceToken: null, manterConectado: manter);

        Assert.False(r.MfaRequerido);
        Assert.Equal(manter, r.Auth!.LembrarSessao);
        Assert.Equal(manter, (await ctx.RefreshTokens.SingleAsync()).LembrarSessao);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Refresh_herdaLembrarSessao_naRotacao(bool manter)
    {
        using var ctx = CreateContext();
        SeedUsuario(ctx, "a@test.com");
        var auth = CreateService(ctx);

        var login = await auth.LoginAsync(Login("a@test.com"), trustedDeviceToken: null, manterConectado: manter);
        var refreshBruto = login.Auth!.RefreshToken;

        var rotacionado = await auth.RefreshAsync(refreshBruto);

        // A rotação preserva a natureza da sessão (persistente x sessão).
        Assert.Equal(manter, rotacionado.LembrarSessao);
        var novo = await ctx.RefreshTokens.FirstAsync(t => !t.Revogado);
        Assert.Equal(manter, novo.LembrarSessao);
    }
}

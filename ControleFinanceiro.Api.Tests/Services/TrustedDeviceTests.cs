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
/// Trusted-device ("lembrar este dispositivo por X dias"): o login PULA o 2º fator quando o
/// navegador apresenta um device confiável VÁLIDO PRA AQUELA CONTA. O foco dos testes é a
/// segurança do skip — sobretudo o anti-cross-account (device da conta A nunca pula MFA da conta
/// B no mesmo navegador), que é a razão de a feature ter esperado o fix do multi-conta.
///
/// Usa VerifyPassword (login com senha real) → entra na coleção PasswordHasherEnv (serializa com
/// quem liga/desliga o PASSWORD_PEPPER; ver ROADMAP/AuthHttpTests).
/// </summary>
[Collection("PasswordHasherEnv")]
public class TrustedDeviceTests
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

    // Usuário Ativo com MFA ligado e senha real (pra passar no VerifyPassword do login).
    private static Usuario SeedUsuarioMfa(AppDbContext ctx, string email)
    {
        var u = new Usuario
        {
            Id = Guid.NewGuid(),
            Email = email,
            Nome = "User",
            PasswordHash = PasswordHasher.HashPassword(Senha),
            Status = StatusUsuario.Ativo,
            MfaAtivo = true,
        };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u;
    }

    private static LoginDto Login(string email) => new() { Email = email, Password = Senha };

    // ── Skip do 2º fator ────────────────────────────────────────────────────────

    [Fact]
    public async Task LoginComMfa_semDeviceConfiavel_exigeSegundoFator()
    {
        using var ctx = CreateContext();
        SeedUsuarioMfa(ctx, "a@test.com");
        var auth = CreateService(ctx);

        var r = await auth.LoginAsync(Login("a@test.com"), trustedDeviceToken: null);

        Assert.True(r.MfaRequerido);
        Assert.Null(r.Auth);
        Assert.NotNull(r.MfaChallengeToken);
    }

    [Fact]
    public async Task LoginComMfa_comDeviceConfiavelValido_pulaSegundoFator()
    {
        using var ctx = CreateContext();
        var u = SeedUsuarioMfa(ctx, "a@test.com");
        var auth = CreateService(ctx);

        var token = await auth.CriarTrustedDeviceAsync(u.Id);
        var r = await auth.LoginAsync(Login("a@test.com"), token);

        Assert.False(r.MfaRequerido);
        Assert.NotNull(r.Auth);
        Assert.Equal(u.Id, r.Auth!.UsuarioId);
        // Uso do device foi marcado.
        var dev = await ctx.TrustedDevices.SingleAsync();
        Assert.NotNull(dev.UltimoUsoEm);
    }

    [Fact]
    public async Task DeviceConfiavelDeOutraConta_naoPulaMfa_antiCrossAccount()
    {
        using var ctx = CreateContext();
        var a = SeedUsuarioMfa(ctx, "a@test.com");
        var b = SeedUsuarioMfa(ctx, "b@test.com");
        var auth = CreateService(ctx);

        // Device confiado pela conta B, mesmo navegador.
        var tokenB = await auth.CriarTrustedDeviceAsync(b.Id);

        // A conta A tenta logar apresentando o token de B → NÃO pode pular o 2º fator.
        var r = await auth.LoginAsync(Login("a@test.com"), tokenB);

        Assert.True(r.MfaRequerido);
        Assert.Null(r.Auth);
    }

    [Fact]
    public async Task DeviceExpirado_naoPula()
    {
        using var ctx = CreateContext();
        var u = SeedUsuarioMfa(ctx, "a@test.com");
        var auth = CreateService(ctx);

        var token = await auth.CriarTrustedDeviceAsync(u.Id);
        var dev = await ctx.TrustedDevices.SingleAsync();
        dev.ExpiraEm = DateTime.UtcNow.AddMinutes(-1);
        await ctx.SaveChangesAsync();

        var r = await auth.LoginAsync(Login("a@test.com"), token);

        Assert.True(r.MfaRequerido);
    }

    [Fact]
    public async Task DeviceRevogado_naoPula()
    {
        using var ctx = CreateContext();
        var u = SeedUsuarioMfa(ctx, "a@test.com");
        var auth = CreateService(ctx);

        var token = await auth.CriarTrustedDeviceAsync(u.Id);
        var dev = await ctx.TrustedDevices.SingleAsync();
        dev.Revogado = true;
        await ctx.SaveChangesAsync();

        var r = await auth.LoginAsync(Login("a@test.com"), token);

        Assert.True(r.MfaRequerido);
    }

    // ── Armazenamento ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task CriarTrustedDevice_gravaHash_naoOTokenBruto()
    {
        using var ctx = CreateContext();
        var u = SeedUsuarioMfa(ctx, "a@test.com");
        var auth = CreateService(ctx);

        var token = await auth.CriarTrustedDeviceAsync(u.Id);
        var dev = await ctx.TrustedDevices.SingleAsync();

        Assert.NotEqual(token, dev.TokenHash);                       // bruto nunca é persistido
        Assert.Equal(OpaqueTokenHasher.Hash(token), dev.TokenHash);  // só o hash
        Assert.False(dev.Revogado);
        Assert.True(dev.ExpiraEm > DateTime.UtcNow);
    }

    // ── Revogação em evento sensível ────────────────────────────────────────────────

    [Fact]
    public async Task TrocaDeSenha_revogaDevicesConfiaveis_eProximoLoginExigeMfa()
    {
        using var ctx = CreateContext();
        var u = SeedUsuarioMfa(ctx, "a@test.com");
        var auth = CreateService(ctx);

        var token = await auth.CriarTrustedDeviceAsync(u.Id);
        // Sanidade: antes da troca, o device pula o MFA.
        Assert.False((await auth.LoginAsync(Login("a@test.com"), token)).MfaRequerido);

        await auth.ChangePasswordAsync(u.Id, Senha, "OutraSenhaForte2026!!");

        var dev = await ctx.TrustedDevices.SingleAsync();
        Assert.True(dev.Revogado);

        // Novo login (com a senha nova) + o mesmo token NÃO pula mais o 2º fator.
        var r = await auth.LoginAsync(new LoginDto { Email = "a@test.com", Password = "OutraSenhaForte2026!!" }, token);
        Assert.True(r.MfaRequerido);
    }
}

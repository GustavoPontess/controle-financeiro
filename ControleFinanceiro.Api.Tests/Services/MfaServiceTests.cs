using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using OtpNet;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// MFA opt-in (TOTP RFC 6238). Cobre ativação (setup → confirmar com código → backup codes),
/// desativação (exige senha + código), status, e o fluxo de login em 2 passos (senha certa
/// gera challenge, não sessão; só o código completa). Usa MFA_ENCRYPTION_KEY setada no ctor.
/// </summary>
[Collection("PasswordHasherEnv")] // mexe em env var global (MFA_ENCRYPTION_KEY), serializa com AuthService/PasswordHasher
public class MfaServiceTests : IDisposable
{
    public MfaServiceTests()
    {
        // AES-256 → chave de 32 bytes em base64.
        Environment.SetEnvironmentVariable("MFA_ENCRYPTION_KEY", Convert.ToBase64String(new byte[32]));
    }

    public void Dispose() => Environment.SetEnvironmentVariable("MFA_ENCRYPTION_KEY", null);

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(
                Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static AuthService CreateAuth(AppDbContext ctx)
    {
        var jwt = new JwtTokenProvider("chave-de-teste-suficientemente-grande-0123456789", "test", "test");
        return new AuthService(ctx, jwt, new Mock<IPasswordResetDispatcher>().Object, new MfaService(ctx));
    }

    private static Usuario SeedUsuario(AppDbContext ctx, string email, string senha)
    {
        var u = new Usuario
        {
            Id = Guid.NewGuid(), Email = email, Nome = "User",
            PasswordHash = PasswordHasher.HashPassword(senha), Ativo = true,
        };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u;
    }

    // Calcula o código TOTP atual a partir do secret base32 que o setup devolveu.
    private static string CodigoAtual(string secretBase32)
    {
        var totp = new Totp(Base32Encoding.ToBytes(secretBase32), mode: OtpHashMode.Sha1, totpSize: 6);
        return totp.ComputeTotp();
    }

    private static async Task<(string secretBase32, List<string> backupCodes)> AtivarMfaAsync(MfaService mfa, Guid usuarioId)
    {
        var setup = await mfa.IniciarAtivacaoAsync(usuarioId);
        var backupCodes = await mfa.ConfirmarAtivacaoAsync(usuarioId, CodigoAtual(setup.SecretBase32));
        return (setup.SecretBase32, backupCodes);
    }

    // ── Ativação ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task IniciarAtivacao_geraSecretEQrCode_masNaoAtivaAinda()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "u@test.com", "SenhaForte!2026");
        var mfa = new MfaService(ctx);

        var setup = await mfa.IniciarAtivacaoAsync(u.Id);

        Assert.False(string.IsNullOrEmpty(setup.SecretBase32));
        Assert.StartsWith("otpauth://totp/", setup.QrCodeUri);
        var depois = await ctx.Usuarios.FindAsync(u.Id);
        Assert.False(depois!.MfaAtivo); // ainda não confirmou
        Assert.NotNull(depois.MfaSecretoPendenteCriptografado);
        Assert.Null(depois.MfaSecretoCriptografado);
    }

    [Fact]
    public async Task ConfirmarAtivacao_comCodigoCerto_ativa_e_devolve10BackupCodes()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "u@test.com", "SenhaForte!2026");
        var mfa = new MfaService(ctx);

        var (_, backupCodes) = await AtivarMfaAsync(mfa, u.Id);

        Assert.Equal(10, backupCodes.Count);
        var depois = await ctx.Usuarios.FindAsync(u.Id);
        Assert.True(depois!.MfaAtivo);
        Assert.NotNull(depois.MfaSecretoCriptografado);
        Assert.Null(depois.MfaSecretoPendenteCriptografado);
        Assert.Equal(10, await ctx.MfaBackupCodes.CountAsync(c => c.UsuarioId == u.Id && !c.Usado));
    }

    [Fact]
    public async Task ConfirmarAtivacao_comCodigoErrado_naoAtiva()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "u@test.com", "SenhaForte!2026");
        var mfa = new MfaService(ctx);
        await mfa.IniciarAtivacaoAsync(u.Id);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => mfa.ConfirmarAtivacaoAsync(u.Id, "000000"));

        var depois = await ctx.Usuarios.FindAsync(u.Id);
        Assert.False(depois!.MfaAtivo);
    }

    [Fact]
    public async Task ConfirmarAtivacao_secretGuardadoCriptografado_naoEmTextoClaro()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "u@test.com", "SenhaForte!2026");
        var mfa = new MfaService(ctx);

        var (secretBase32, _) = await AtivarMfaAsync(mfa, u.Id);

        var depois = await ctx.Usuarios.FindAsync(u.Id);
        Assert.DoesNotContain(secretBase32, depois!.MfaSecretoCriptografado); // não é texto claro
        Assert.Equal(secretBase32, MfaCrypto.Decrypt(depois.MfaSecretoCriptografado!)); // mas descriptografa de volta
    }

    // ── Login em 2 passos ─────────────────────────────────────────────────────────

    [Fact]
    public async Task Login_comMfaAtivo_naoEmiteSessao_retornaChallenge()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "u@test.com", "SenhaForte!2026");
        var mfa = new MfaService(ctx);
        await AtivarMfaAsync(mfa, u.Id);
        var auth = CreateAuth(ctx);

        var login = await auth.LoginAsync(new DTOs.Auth.LoginDto { Email = "u@test.com", Password = "SenhaForte!2026" });

        Assert.True(login.MfaRequerido);
        Assert.False(string.IsNullOrEmpty(login.MfaChallengeToken));
        Assert.Null(login.Auth);                 // sem sessão ainda
        Assert.Empty(ctx.RefreshTokens);         // nenhum refresh token emitido
    }

    [Fact]
    public async Task VerificarMfaLogin_comCodigoTotpCerto_emiteSessao()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "u@test.com", "SenhaForte!2026");
        var mfa = new MfaService(ctx);
        var (secretBase32, _) = await AtivarMfaAsync(mfa, u.Id);
        var auth = CreateAuth(ctx);
        var login = await auth.LoginAsync(new DTOs.Auth.LoginDto { Email = "u@test.com", Password = "SenhaForte!2026" });

        var sessao = await auth.VerificarMfaLoginAsync(login.MfaChallengeToken!, CodigoAtual(secretBase32));

        Assert.False(string.IsNullOrEmpty(sessao.Token));
        Assert.False(string.IsNullOrEmpty(sessao.RefreshToken));
        Assert.Empty(ctx.MfaLoginChallenges); // challenge consumido
    }

    [Fact]
    public async Task VerificarMfaLogin_comCodigoErrado_naoEmiteSessao_e_naoConsomeChallenge()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "u@test.com", "SenhaForte!2026");
        var mfa = new MfaService(ctx);
        await AtivarMfaAsync(mfa, u.Id);
        var auth = CreateAuth(ctx);
        var login = await auth.LoginAsync(new DTOs.Auth.LoginDto { Email = "u@test.com", Password = "SenhaForte!2026" });

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => auth.VerificarMfaLoginAsync(login.MfaChallengeToken!, "000000"));

        Assert.Empty(ctx.RefreshTokens);
        Assert.Single(ctx.MfaLoginChallenges); // permite tentar de novo dentro do TTL
    }

    [Fact]
    public async Task VerificarMfaLogin_comBackupCode_emiteSessao_e_consomeOCodigo()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "u@test.com", "SenhaForte!2026");
        var mfa = new MfaService(ctx);
        var (_, backupCodes) = await AtivarMfaAsync(mfa, u.Id);
        var auth = CreateAuth(ctx);
        var login = await auth.LoginAsync(new DTOs.Auth.LoginDto { Email = "u@test.com", Password = "SenhaForte!2026" });

        var sessao = await auth.VerificarMfaLoginAsync(login.MfaChallengeToken!, backupCodes[0]);

        Assert.False(string.IsNullOrEmpty(sessao.Token));
        Assert.Equal(9, await ctx.MfaBackupCodes.CountAsync(c => c.UsuarioId == u.Id && !c.Usado)); // um consumido
    }

    [Fact]
    public async Task VerificarMfaLogin_mesmoBackupCodeDuasVezes_falhaNaSegunda()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "u@test.com", "SenhaForte!2026");
        var mfa = new MfaService(ctx);
        var (_, backupCodes) = await AtivarMfaAsync(mfa, u.Id);
        var auth = CreateAuth(ctx);

        var login1 = await auth.LoginAsync(new DTOs.Auth.LoginDto { Email = "u@test.com", Password = "SenhaForte!2026" });
        await auth.VerificarMfaLoginAsync(login1.MfaChallengeToken!, backupCodes[0]);

        var login2 = await auth.LoginAsync(new DTOs.Auth.LoginDto { Email = "u@test.com", Password = "SenhaForte!2026" });
        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => auth.VerificarMfaLoginAsync(login2.MfaChallengeToken!, backupCodes[0]));
    }

    // ── Desativação ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Desativar_comSenhaECodigoCertos_desliga_e_apagaBackupCodes()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "u@test.com", "SenhaForte!2026");
        var mfa = new MfaService(ctx);
        var (secretBase32, _) = await AtivarMfaAsync(mfa, u.Id);

        await mfa.DesativarAsync(u.Id, "SenhaForte!2026", CodigoAtual(secretBase32));

        var depois = await ctx.Usuarios.FindAsync(u.Id);
        Assert.False(depois!.MfaAtivo);
        Assert.Null(depois.MfaSecretoCriptografado);
        Assert.Empty(ctx.MfaBackupCodes.Where(c => c.UsuarioId == u.Id));
    }

    [Fact]
    public async Task Desativar_comSenhaErrada_naoDesliga()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "u@test.com", "SenhaForte!2026");
        var mfa = new MfaService(ctx);
        var (secretBase32, _) = await AtivarMfaAsync(mfa, u.Id);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => mfa.DesativarAsync(u.Id, "SenhaErrada!2026", CodigoAtual(secretBase32)));

        var depois = await ctx.Usuarios.FindAsync(u.Id);
        Assert.True(depois!.MfaAtivo);
    }

    // ── Status ────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Status_refleteAtivoEBackupCodesRestantes()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "u@test.com", "SenhaForte!2026");
        var mfa = new MfaService(ctx);

        var antes = await mfa.ObterStatusAsync(u.Id);
        Assert.False(antes.Ativo);
        Assert.Equal(0, antes.BackupCodesRestantes);

        await AtivarMfaAsync(mfa, u.Id);

        var depois = await mfa.ObterStatusAsync(u.Id);
        Assert.True(depois.Ativo);
        Assert.Equal(10, depois.BackupCodesRestantes);
    }
}

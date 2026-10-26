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

    // ── Tela "Dispositivos confiáveis": listar / esquecer 1 / esquecer todos ─────────

    [Fact]
    public async Task Listar_SoOsVivosDoUsuario_MarcandoODesteNavegador()
    {
        using var ctx = CreateContext();
        var u = SeedUsuarioMfa(ctx, "lista@test.com");
        var outro = SeedUsuarioMfa(ctx, "outro@test.com");
        var auth = CreateService(ctx);
        var deste = await auth.CriarTrustedDeviceAsync(u.Id);
        await auth.CriarTrustedDeviceAsync(u.Id);
        var revogado = await auth.CriarTrustedDeviceAsync(u.Id);
        await auth.CriarTrustedDeviceAsync(outro.Id);
        var hRevogado = OpaqueTokenHasher.Hash(revogado);
        (await ctx.TrustedDevices.SingleAsync(d => d.TokenHash == hRevogado)).Revogado = true;
        ctx.TrustedDevices.Add(new TrustedDevice { Id = Guid.NewGuid(), UsuarioId = u.Id, TokenHash = "x", ExpiraEm = DateTime.UtcNow.AddMinutes(-1) });
        await ctx.SaveChangesAsync();

        var lista = await auth.ListarDispositivosConfiaveisAsync(u.Id, deste);

        Assert.Equal(2, lista.Count); // fora: o revogado, o expirado e o do outro usuário
        Assert.Single(lista, d => d.Atual);
    }

    [Fact]
    public async Task Esquecer1_DeOutroUsuario_404_EOProprio_ParaDePular()
    {
        using var ctx = CreateContext();
        var u = SeedUsuarioMfa(ctx, "esq@test.com");
        var intruso = SeedUsuarioMfa(ctx, "intruso@test.com");
        var auth = CreateService(ctx);
        var token = await auth.CriarTrustedDeviceAsync(u.Id);
        var id = (await auth.ListarDispositivosConfiaveisAsync(u.Id, null)).Single().Id;

        await Assert.ThrowsAsync<KeyNotFoundException>(() => auth.RevogarDispositivoConfiavelAsync(intruso.Id, id, null));

        Assert.True(await auth.RevogarDispositivoConfiavelAsync(u.Id, id, token)); // era o deste navegador
        Assert.Empty(await auth.ListarDispositivosConfiaveisAsync(u.Id, token));
        Assert.True((await auth.LoginAsync(Login("esq@test.com"), trustedDeviceToken: token)).MfaRequerido);
    }

    [Fact]
    public async Task EsquecerTodos_RevogaTudoDoUsuario_ENaoMexeNoDosOutros()
    {
        using var ctx = CreateContext();
        var u = SeedUsuarioMfa(ctx, "todos@test.com");
        var outro = SeedUsuarioMfa(ctx, "vizinho@test.com");
        var auth = CreateService(ctx);
        await auth.CriarTrustedDeviceAsync(u.Id);
        await auth.CriarTrustedDeviceAsync(u.Id);
        var doOutro = await auth.CriarTrustedDeviceAsync(outro.Id);

        Assert.Equal(2, await auth.RevogarTodosDispositivosConfiaveisAsync(u.Id));
        Assert.Empty(await auth.ListarDispositivosConfiaveisAsync(u.Id, null));
        Assert.Single(await auth.ListarDispositivosConfiaveisAsync(outro.Id, doOutro));
    }

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
    public async Task Admin_comDeviceConfiavel_naoPulaSegundoFator()
    {
        // Admin sempre digita o código: a policy de admin conta com toda sessão dele ter passado pelo 2º fator.
        using var ctx = CreateContext();
        var u = SeedUsuarioMfa(ctx, "admin@test.com");
        u.IsAdmin = true;
        await ctx.SaveChangesAsync();
        var auth = CreateService(ctx);

        var token = await auth.CriarTrustedDeviceAsync(u.Id);
        var r = await auth.LoginAsync(Login("admin@test.com"), token);

        Assert.True(r.MfaRequerido);
        Assert.Null(r.Auth);
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
    public async Task TrocaDeSenha_EncerrandoOutras_DerrubaOsOutrosAparelhos_EMantemEste()
    {
        using var ctx = CreateContext();
        var u = SeedUsuarioMfa(ctx, "sessoes@test.com");
        u.MfaAtivo = false; // login direto, sem 2º fator
        await ctx.SaveChangesAsync();
        var auth = CreateService(ctx);
        var este = (await auth.LoginAsync(Login("sessoes@test.com"), null)).Auth!.RefreshToken;
        await auth.LoginAsync(Login("sessoes@test.com"), null);
        await auth.LoginAsync(Login("sessoes@test.com"), null);

        await auth.ChangePasswordAsync(u.Id, Senha, "OutraSenhaForte2026!!", encerrarOutrasSessoes: true, refreshTokenAtual: este);

        var vivas = await auth.ListarSessoesAsync(u.Id, este);
        var atual = Assert.Single(vivas);
        Assert.True(atual.Atual);
    }

    [Fact]
    public async Task TrocaDeSenha_SemEncerrar_MantemAsOutrasSessoes()
    {
        using var ctx = CreateContext();
        var u = SeedUsuarioMfa(ctx, "manter@test.com");
        u.MfaAtivo = false;
        await ctx.SaveChangesAsync();
        var auth = CreateService(ctx);
        var este = (await auth.LoginAsync(Login("manter@test.com"), null)).Auth!.RefreshToken;
        await auth.LoginAsync(Login("manter@test.com"), null);

        await auth.ChangePasswordAsync(u.Id, Senha, "OutraSenhaForte2026!!", encerrarOutrasSessoes: false, refreshTokenAtual: este);

        Assert.Equal(2, (await auth.ListarSessoesAsync(u.Id, este)).Count);
    }

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

using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using ControleFinanceiro.Api.Infrastructure.Jobs;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Regressão do C1: o token de reset NUNCA pode voltar na resposta HTTP de /forgot-password
/// (account takeover) e a resposta deve ser idêntica para qualquer e-mail (sem enumeração).
/// O trabalho real (token + e-mail) acontece fora do caminho da requisição.
/// </summary>
[Collection("PasswordHasherEnv")]
public class AuthServiceTests
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

    private static AuthService CreateService(AppDbContext ctx, IPasswordResetDispatcher dispatcher)
    {
        var jwt = new JwtTokenProvider("chave-de-teste-suficientemente-grande-0123456789", "test", "test");
        return new AuthService(ctx, jwt, dispatcher, new MfaService(ctx), TestHelpers.NotifAdmin(ctx));
    }

    // Login sem MFA sempre retorna Auth preenchido — helper pra não repetir o `.Auth!` em todo teste.
    private static async Task<DTOs.Auth.AuthResponseDto> LoginSemMfaAsync(AuthService auth, string email, string senha)
    {
        var r = await auth.LoginAsync(new DTOs.Auth.LoginDto { Email = email, Password = senha });
        Assert.False(r.MfaRequerido);
        return r.Auth!;
    }

    private static Usuario SeedUsuario(AppDbContext ctx, string email)
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = email, Nome = "User", PasswordHash = "x", Status = StatusUsuario.Ativo };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u;
    }

    // ── UpdateProfileAsync ────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateProfile_recusaNomeVazio_e_dataNoFuturo()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "perfil@test.com");
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);

        await Assert.ThrowsAsync<ArgumentException>(() => auth.UpdateProfileAsync(u.Id, "   ", null));
        await Assert.ThrowsAsync<ArgumentException>(() => auth.UpdateProfileAsync(u.Id, new string('a', 201), null));
        await Assert.ThrowsAsync<ArgumentException>(() => auth.UpdateProfileAsync(u.Id, "Ana", DateTime.UtcNow.AddDays(1)));
        await Assert.ThrowsAsync<ArgumentException>(() => auth.UpdateProfileAsync(u.Id, "Ana", new DateTime(1850, 1, 1)));
        Assert.Equal("User", (await ctx.Usuarios.FindAsync(u.Id))!.Nome);
    }

    [Fact]
    public async Task UpdateProfile_salvaNomeSemEspacoSobrando_e_data()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "perfil2@test.com");
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);

        var dto = await auth.UpdateProfileAsync(u.Id, "  Ana Silva ", new DateTime(1990, 5, 10));

        Assert.Equal("Ana Silva", dto.Nome);
        Assert.Equal(new DateTime(1990, 5, 10), dto.DataNascimento);
        Assert.Equal("Ana Silva", (await ctx.Usuarios.FindAsync(u.Id))!.Nome);
    }

    // ── SolicitarResetSenhaAsync ───────────────────────────────────────────────

    [Fact]
    public async Task Login_emailInexistente_e_senhaErrada_mesmaMensagem_semEnumeracao()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "existe@test.com");
        u.PasswordHash = PasswordHasher.HashPassword("a senha certa bem longa");
        ctx.SaveChanges();
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);

        // Conta que existe, senha errada → mesma mensagem que conta que não existe. O tempo também tem que ser
        // parecido (login chama PasswordHasher.FakeVerify quando a conta não existe), mas aqui provamos só a mensagem:
        // mensagem ou status diferentes já seriam oráculo de enumeração.
        var existeErro = await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => auth.LoginAsync(new DTOs.Auth.LoginDto { Email = "existe@test.com", Password = "senha errada qualquer" }));
        var naoExisteErro = await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => auth.LoginAsync(new DTOs.Auth.LoginDto { Email = "naoexiste@test.com", Password = "senha errada qualquer" }));

        Assert.Equal("Email ou senha inválidos", existeErro.Message);
        Assert.Equal(existeErro.Message, naoExisteErro.Message);
    }

    [Fact]
    public async Task SolicitarReset_naoRetornaToken_e_mensagemGenerica()
    {
        using var ctx = CreateContext();
        SeedUsuario(ctx, "alvo@test.com");
        var dispatcher = new Mock<IPasswordResetDispatcher>();
        var auth = CreateService(ctx, dispatcher.Object);

        var resp = await auth.SolicitarResetSenhaAsync("alvo@test.com");

        // C1: a resposta não pode carregar nada que vire token de reset.
        Assert.Equal("Se o e-mail existir, um link de recuperação será enviado.", resp.Mensagem);
        var corpo = System.Text.Json.JsonSerializer.Serialize(resp);
        Assert.DoesNotContain("token", corpo, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SolicitarReset_mensagemIdentica_paraEmailExistenteEInexistente()
    {
        using var ctx = CreateContext();
        SeedUsuario(ctx, "existe@test.com");
        var dispatcher = new Mock<IPasswordResetDispatcher>();
        var auth = CreateService(ctx, dispatcher.Object);

        var existente = await auth.SolicitarResetSenhaAsync("existe@test.com");
        var inexistente = await auth.SolicitarResetSenhaAsync("naoexiste@test.com");

        // Mensagens diferentes seriam um oráculo de enumeração de usuário.
        Assert.Equal(existente.Mensagem, inexistente.Mensagem);
    }

    [Fact]
    public async Task SolicitarReset_disparaUmaVez_paraQualquerEmail_semTimingOracle()
    {
        using var ctx = CreateContext();
        SeedUsuario(ctx, "existe@test.com");
        var dispatcher = new Mock<IPasswordResetDispatcher>();
        var auth = CreateService(ctx, dispatcher.Object);

        await auth.SolicitarResetSenhaAsync("existe@test.com");
        await auth.SolicitarResetSenhaAsync("naoexiste@test.com");

        // Mesmo trabalho no caminho da requisição (1 enqueue) independente de existir ou não.
        dispatcher.Verify(d => d.Disparar("existe@test.com"), Times.Once);
        dispatcher.Verify(d => d.Disparar("naoexiste@test.com"), Times.Once);
        // E o serviço NÃO persiste token de forma síncrona no caminho da requisição.
        Assert.Empty(ctx.PasswordResetTokens);
    }

    [Fact]
    public async Task SolicitarReset_emailVazio_lancaArgumentException()
    {
        using var ctx = CreateContext();
        var dispatcher = new Mock<IPasswordResetDispatcher>();
        var auth = CreateService(ctx, dispatcher.Object);

        await Assert.ThrowsAsync<ArgumentException>(() => auth.SolicitarResetSenhaAsync("  "));
        dispatcher.Verify(d => d.Disparar(It.IsAny<string>()), Times.Never);
    }

    // ── PasswordResetEmailJob (trabalho fora do caminho da requisição) ──────────

    [Fact]
    public async Task Job_usuarioExistente_criaToken_e_chamaSender()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "existe@test.com");
        var sender = new Mock<IPasswordResetEmailSender>();
        var job = new PasswordResetEmailJob(ctx, sender.Object);

        await job.ExecuteAsync("existe@test.com");

        var prt = Assert.Single(ctx.PasswordResetTokens);
        Assert.Equal(u.Id, prt.UsuarioId);
        Assert.False(prt.Usado);
        Assert.True(prt.ExpiresAt > DateTime.UtcNow);
        Assert.False(string.IsNullOrWhiteSpace(prt.Token));
        // O sender recebe o token BRUTO; o banco guarda o HASH dele.
        sender.Verify(s => s.EnviarAsync(
            u.Email,
            It.Is<string>(raw => OpaqueTokenHasher.Hash(raw) == prt.Token),
            prt.ExpiresAt,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Job_emailInexistente_naoCriaToken_e_naoChamaSender()
    {
        using var ctx = CreateContext();
        var sender = new Mock<IPasswordResetEmailSender>();
        var job = new PasswordResetEmailJob(ctx, sender.Object);

        await job.ExecuteAsync("naoexiste@test.com");

        Assert.Empty(ctx.PasswordResetTokens);
        sender.Verify(s => s.EnviarAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ── A1/A2: rehash transparente de senha legada no login ─────────────────────

    private static string LegacyPbkdf2Hash(string password)
    {
        var salt = System.Security.Cryptography.RandomNumberGenerator.GetBytes(16);
        var key = System.Security.Cryptography.Rfc2898DeriveBytes.Pbkdf2(
            System.Text.Encoding.UTF8.GetBytes(password), salt, 10000,
            System.Security.Cryptography.HashAlgorithmName.SHA256, 20);
        var blob = new byte[36];
        Array.Copy(salt, 0, blob, 0, 16);
        Array.Copy(key, 0, blob, 16, 20);
        return Convert.ToBase64String(blob);
    }

    [Fact]
    public async Task Login_comHashLegado_fazRehashParaArgon2_e_continuaValido()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "legado@test.com");
        u.PasswordHash = LegacyPbkdf2Hash("Senha@Legada1");
        await ctx.SaveChangesAsync();
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);

        var resp = await LoginSemMfaAsync(auth, "legado@test.com", "Senha@Legada1");

        Assert.False(string.IsNullOrEmpty(resp.Token));
        var atualizado = await ctx.Usuarios.FindAsync(u.Id);
        // O hash foi regravado no esquema atual (Argon2id) e ainda valida a mesma senha.
        Assert.StartsWith("ARGON2ID$", atualizado!.PasswordHash);
        Assert.False(PasswordHasher.NeedsRehash(atualizado.PasswordHash));
        Assert.True(PasswordHasher.VerifyPassword("Senha@Legada1", atualizado.PasswordHash));
    }

    [Fact]
    public async Task Login_comHashArgon2Atual_naoRegrava()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "atual@test.com");
        u.PasswordHash = PasswordHasher.HashPassword("Senha@Atual1");
        await ctx.SaveChangesAsync();
        var hashAntes = u.PasswordHash;
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);

        await LoginSemMfaAsync(auth, "atual@test.com", "Senha@Atual1");

        var depois = await ctx.Usuarios.FindAsync(u.Id);
        Assert.Equal(hashAntes, depois!.PasswordHash); // sem rehash desnecessário
    }

    // ── Reset token hasheado no banco + rate-limit por conta ────────────────────

    private static (Mock<IPasswordResetEmailSender> sender, Func<string?> raw) SenderCapturandoToken()
    {
        string? capturado = null;
        var sender = new Mock<IPasswordResetEmailSender>();
        sender.Setup(s => s.EnviarAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
              .Callback<string, string, DateTime, CancellationToken>((_, token, _, _) => capturado = token)
              .Returns(Task.CompletedTask);
        return (sender, () => capturado);
    }

    [Fact]
    public async Task Job_guardaHashDoToken_e_enviaTokenBruto()
    {
        using var ctx = CreateContext();
        SeedUsuario(ctx, "reset@test.com");
        var (sender, raw) = SenderCapturandoToken();
        var job = new PasswordResetEmailJob(ctx, sender.Object);

        await job.ExecuteAsync("reset@test.com");

        var prt = Assert.Single(ctx.PasswordResetTokens);
        Assert.NotNull(raw());
        Assert.NotEqual(raw(), prt.Token);                              // não persiste o bruto
        Assert.Equal(OpaqueTokenHasher.Hash(raw()!), prt.Token);        // persiste só o hash
    }

    [Fact]
    public async Task ResetSenha_funcionaComTokenBruto_e_falhaComOHashArmazenado()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "reset@test.com");
        var (sender, raw) = SenderCapturandoToken();
        await new PasswordResetEmailJob(ctx, sender.Object).ExecuteAsync("reset@test.com");
        var hashArmazenado = (await ctx.PasswordResetTokens.SingleAsync()).Token;
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);

        // Token bruto (o que vai no e-mail) reseta a senha.
        await auth.ResetSenhaAsync(new DTOs.Auth.ResetPasswordDto
        {
            Token = raw()!, NovaSenha = "NovaSenhaForte!2026", ConfirmarNovaSenha = "NovaSenhaForte!2026",
        });
        var atualizado = await ctx.Usuarios.FindAsync(u.Id);
        Assert.True(PasswordHasher.VerifyPassword("NovaSenhaForte!2026", atualizado!.PasswordHash));

        // Mandar o HASH armazenado (como se tivesse vazado do banco) não vale como token.
        await new PasswordResetEmailJob(ctx, sender.Object).ExecuteAsync("reset@test.com");
        var hash2 = (await ctx.PasswordResetTokens.OrderByDescending(t => t.CriadoEm).FirstAsync()).Token;
        await Assert.ThrowsAsync<ArgumentException>(() => auth.ResetSenhaAsync(new DTOs.Auth.ResetPasswordDto
        {
            Token = hash2, NovaSenha = "OutraSenhaForte!99", ConfirmarNovaSenha = "OutraSenhaForte!99",
        }));
    }

    [Fact]
    public async Task Job_rateLimitPorConta_naoCriaAlemDoMaximoPorHora()
    {
        using var ctx = CreateContext();
        SeedUsuario(ctx, "spam@test.com");
        var (sender, _) = SenderCapturandoToken();
        var job = new PasswordResetEmailJob(ctx, sender.Object);

        for (var i = 0; i < 6; i++)
            await job.ExecuteAsync("spam@test.com");

        // Máx 3 por conta por hora — as chamadas extras são ignoradas.
        Assert.Equal(3, await ctx.PasswordResetTokens.CountAsync());
    }

    // ── Refresh token hasheado no banco ─────────────────────────────────────────

    private static Usuario SeedUsuarioComSenha(AppDbContext ctx, string email, string senha)
    {
        var u = new Usuario
        {
            Id = Guid.NewGuid(), Email = email, Nome = "User",
            PasswordHash = PasswordHasher.HashPassword(senha), Status = StatusUsuario.Ativo,
        };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u;
    }

    [Fact]
    public async Task Login_guardaRefreshTokenHasheado_naoOBruto()
    {
        using var ctx = CreateContext();
        SeedUsuarioComSenha(ctx, "u@test.com", "SenhaForte!2026");
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);

        var resp = await LoginSemMfaAsync(auth, "u@test.com", "SenhaForte!2026");

        Assert.False(string.IsNullOrEmpty(resp.RefreshToken));
        var stored = await ctx.RefreshTokens.SingleAsync();
        Assert.NotEqual(resp.RefreshToken, stored.Token);                       // não guarda o bruto
        Assert.Equal(OpaqueTokenHasher.Hash(resp.RefreshToken), stored.Token);  // guarda o hash
    }

    [Fact]
    public async Task Refresh_comBruto_rotaciona_e_hashArmazenadoNaoVale()
    {
        using var ctx = CreateContext();
        SeedUsuarioComSenha(ctx, "u@test.com", "SenhaForte!2026");
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);
        var login = await LoginSemMfaAsync(auth, "u@test.com", "SenhaForte!2026");

        var novo = await auth.RefreshAsync(login.RefreshToken);

        Assert.False(string.IsNullOrEmpty(novo.RefreshToken));
        Assert.NotEqual(login.RefreshToken, novo.RefreshToken);                  // rotacionou
        // O hash armazenado (como se vazasse do banco) não vale como token bruto.
        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => auth.RefreshAsync(OpaqueTokenHasher.Hash(novo.RefreshToken)));
        // O token antigo (já rotacionado) também não vale mais.
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => auth.RefreshAsync(login.RefreshToken));
    }

    [Fact]
    public async Task Logout_revogaPorTokenBruto()
    {
        using var ctx = CreateContext();
        SeedUsuarioComSenha(ctx, "u@test.com", "SenhaForte!2026");
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);
        var login = await LoginSemMfaAsync(auth, "u@test.com", "SenhaForte!2026");

        await auth.LogoutAsync(login.RefreshToken);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => auth.RefreshAsync(login.RefreshToken));
    }

    // ── SwitchAsync (multi-conta) ──────────────────────────────────────────────

    [Fact]
    public async Task Switch_comRefreshDaConta_rotaciona_eRetornaAContaCerta()
    {
        using var ctx = CreateContext();
        var a = SeedUsuarioComSenha(ctx, "a@test.com", "SenhaForte!2026");
        var b = SeedUsuarioComSenha(ctx, "b@test.com", "SenhaForte!2026");
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);
        await LoginSemMfaAsync(auth, "a@test.com", "SenhaForte!2026");
        var loginB = await LoginSemMfaAsync(auth, "b@test.com", "SenhaForte!2026");

        var trocado = await auth.SwitchAsync(loginB.RefreshToken, b.Id);

        Assert.Equal(b.Id, trocado.UsuarioId);                 // ativou a conta B
        Assert.NotEqual(loginB.RefreshToken, trocado.RefreshToken); // rotacionou
        // O refresh antigo de B já não vale (rotação).
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => auth.RefreshAsync(loginB.RefreshToken));
        _ = a; // A permanece intacta (não foi tocada)
    }

    [Fact]
    public async Task Switch_antiIDOR_refreshDeOutraConta_naoTrocaPraContaPedida()
    {
        using var ctx = CreateContext();
        var a = SeedUsuarioComSenha(ctx, "a@test.com", "SenhaForte!2026");
        var b = SeedUsuarioComSenha(ctx, "b@test.com", "SenhaForte!2026");
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);
        var loginA = await LoginSemMfaAsync(auth, "a@test.com", "SenhaForte!2026");

        // Tenta trocar pra B usando o refresh de A (seletor mente; autoridade é o token) → recusado.
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => auth.SwitchAsync(loginA.RefreshToken, b.Id));
        // E o refresh de A NÃO foi rotacionado/consumido pela tentativa falha.
        var aindaVale = await auth.RefreshAsync(loginA.RefreshToken);
        Assert.Equal(a.Id, aindaVale.UsuarioId);
    }

    [Fact]
    public async Task Switch_semRefresh_falha()
    {
        using var ctx = CreateContext();
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => auth.SwitchAsync(null, Guid.NewGuid()));
    }

    [Fact]
    public async Task Switch_contaNaoAtiva_falha()
    {
        using var ctx = CreateContext();
        var b = SeedUsuarioComSenha(ctx, "b@test.com", "SenhaForte!2026");
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);
        var loginB = await LoginSemMfaAsync(auth, "b@test.com", "SenhaForte!2026");

        // Conta some da atividade entre o login e o switch (bloqueada).
        b.Status = StatusUsuario.Bloqueado;
        await ctx.SaveChangesAsync();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => auth.SwitchAsync(loginB.RefreshToken, b.Id));
    }

    [Fact]
    public async Task LogoutAll_revogaTodosOsRefreshInformados()
    {
        using var ctx = CreateContext();
        SeedUsuarioComSenha(ctx, "a@test.com", "SenhaForte!2026");
        SeedUsuarioComSenha(ctx, "b@test.com", "SenhaForte!2026");
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);
        var loginA = await LoginSemMfaAsync(auth, "a@test.com", "SenhaForte!2026");
        var loginB = await LoginSemMfaAsync(auth, "b@test.com", "SenhaForte!2026");

        await auth.LogoutAllAsync(new[] { loginA.RefreshToken, loginB.RefreshToken });

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => auth.RefreshAsync(loginA.RefreshToken));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => auth.RefreshAsync(loginB.RefreshToken));
    }

    // ── Fase 2: reuse-detection + sessões ──────────────────────────────────────

    [Fact]
    public async Task Refresh_replayDeTokenJaRotacionado_comprometeAFamiliaInteira()
    {
        using var ctx = CreateContext();
        SeedUsuarioComSenha(ctx, "u@test.com", "SenhaForte!2026");
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);
        var login = await LoginSemMfaAsync(auth, "u@test.com", "SenhaForte!2026");

        // Rotação legítima → o token de login vira "já rotacionado".
        var novo = await auth.RefreshAsync(login.RefreshToken);

        // Replay do token ANTIGO (roubado) → reuse-detection dispara.
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => auth.RefreshAsync(login.RefreshToken));

        // A família inteira foi comprometida: o refresh NOVO (legítimo) também morre.
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => auth.RefreshAsync(novo.RefreshToken));
    }

    [Fact]
    public async Task Logout_naoDispara_reuseDetection_noReplay()
    {
        // Token revogado por LOGOUT (sem SubstituidoPorId) reapresentado só falha — não é replay de
        // rotação, então NÃO deve comprometer a outra sessão (outra família).
        using var ctx = CreateContext();
        SeedUsuarioComSenha(ctx, "u@test.com", "SenhaForte!2026");
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);
        var l1 = await LoginSemMfaAsync(auth, "u@test.com", "SenhaForte!2026");
        var l2 = await LoginSemMfaAsync(auth, "u@test.com", "SenhaForte!2026");

        await auth.LogoutAsync(l1.RefreshToken);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => auth.RefreshAsync(l1.RefreshToken));

        // A outra sessão (l2) segue válida.
        var novo = await auth.RefreshAsync(l2.RefreshToken);
        Assert.False(string.IsNullOrEmpty(novo.RefreshToken));
    }

    [Fact]
    public async Task ListarSessoes_retornaAtivas_eMarcaAtual()
    {
        using var ctx = CreateContext();
        var u = SeedUsuarioComSenha(ctx, "u@test.com", "SenhaForte!2026");
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);
        await LoginSemMfaAsync(auth, "u@test.com", "SenhaForte!2026");
        var atual = await LoginSemMfaAsync(auth, "u@test.com", "SenhaForte!2026");

        var sessoes = await auth.ListarSessoesAsync(u.Id, atual.RefreshToken);

        Assert.Equal(2, sessoes.Count);
        Assert.Single(sessoes, s => s.Atual);
        Assert.All(sessoes, s => Assert.NotEqual(Guid.Empty, s.Id));
    }

    [Fact]
    public async Task RevogarSessao_antiIDOR_naoRevogaSessaoDeOutroUsuario()
    {
        using var ctx = CreateContext();
        var a = SeedUsuarioComSenha(ctx, "a@test.com", "SenhaForte!2026");
        var b = SeedUsuarioComSenha(ctx, "b@test.com", "SenhaForte!2026");
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);
        var loginA = await LoginSemMfaAsync(auth, "a@test.com", "SenhaForte!2026");
        await LoginSemMfaAsync(auth, "b@test.com", "SenhaForte!2026");

        var sessaoDeA = (await auth.ListarSessoesAsync(a.Id, loginA.RefreshToken)).Single();

        await Assert.ThrowsAsync<KeyNotFoundException>(() => auth.RevogarSessaoAsync(b.Id, sessaoDeA.Id));
        Assert.Single(await auth.ListarSessoesAsync(a.Id, loginA.RefreshToken));
    }

    [Fact]
    public async Task RevogarOutrasSessoes_encerraTudoMenosAAtual()
    {
        using var ctx = CreateContext();
        var u = SeedUsuarioComSenha(ctx, "u@test.com", "SenhaForte!2026");
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);
        await LoginSemMfaAsync(auth, "u@test.com", "SenhaForte!2026");
        await LoginSemMfaAsync(auth, "u@test.com", "SenhaForte!2026");
        var atual = await LoginSemMfaAsync(auth, "u@test.com", "SenhaForte!2026");

        var encerradas = await auth.RevogarOutrasSessoesAsync(u.Id, atual.RefreshToken);

        Assert.Equal(2, encerradas);
        var restantes = await auth.ListarSessoesAsync(u.Id, atual.RefreshToken);
        Assert.Single(restantes);
        Assert.True(restantes[0].Atual);
    }

    // ── Register: e-mail duplicado — anti-enumeração (pentest 2026-09-12) ──
    // Não pode revelar que o e-mail existe: responde IGUAL a um cadastro novo e NÃO cria duplicata.

    [Fact]
    public async Task Register_emailDuplicado_respostaGenericaIgual_eNaoCriaDuplicata()
    {
        using var ctx = CreateContext();
        SeedUsuario(ctx, "duplicado@test.com");
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);

        var resp = await auth.RegisterAsync(new DTOs.Auth.RegisterDto
        {
            Email = "duplicado@test.com", Nome = "Outro", Password = "SenhaForte!2026", ConfirmPassword = "SenhaForte!2026",
        });

        // Resposta idêntica à de um cadastro novo (não vaza que já existe).
        Assert.Equal(StatusUsuario.AguardandoAprovacao, resp.Status);
        // E não criou uma segunda conta com o mesmo e-mail.
        Assert.Equal(1, await ctx.Usuarios.CountAsync(u => u.Email == "duplicado@test.com"));
    }

    [Fact]
    public async Task Register_emailDuplicado_comCaseDiferente_naoRevelaEnaoDuplica()
    {
        // Case-insensitive: e-mail gravado em lowercase; comparar sem normalizar deixava passar
        // e estourava na constraint única depois. Aqui também deve responder genérico e não duplicar.
        using var ctx = CreateContext();
        SeedUsuario(ctx, "duplicado@test.com");
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);

        var resp = await auth.RegisterAsync(new DTOs.Auth.RegisterDto
        {
            Email = "DUPLICADO@TEST.COM", Nome = "Outro", Password = "SenhaForte!2026", ConfirmPassword = "SenhaForte!2026",
        });

        Assert.Equal(StatusUsuario.AguardandoAprovacao, resp.Status);
        Assert.Equal(1, await ctx.Usuarios.CountAsync(u => u.Email == "duplicado@test.com"));
    }

    // ── Register: e-mail "pedido recebido" vai pela fila, só pra cadastro novo ──

    private static AuthService CreateServiceComEmail(AppDbContext ctx, IEmailCadastroDispatcher email)
    {
        var jwt = new JwtTokenProvider("chave-de-teste-suficientemente-grande-0123456789", "test", "test");
        return new AuthService(ctx, jwt, new Mock<IPasswordResetDispatcher>().Object, new MfaService(ctx),
            TestHelpers.NotifAdmin(ctx), emailCadastro: email);
    }

    [Fact]
    public async Task Register_novo_enfileiraEmailDePedidoRecebido_comOIdDaPessoa()
    {
        using var ctx = CreateContext();
        var email = new Mock<IEmailCadastroDispatcher>();
        var auth = CreateServiceComEmail(ctx, email.Object);

        await auth.RegisterAsync(new DTOs.Auth.RegisterDto
        {
            Email = "novo@test.com", Nome = "Novo", Password = "SenhaForte!2026", ConfirmPassword = "SenhaForte!2026",
        });

        var u = await ctx.Usuarios.SingleAsync(x => x.Email == "novo@test.com");
        email.Verify(e => e.PedidoRecebido(u.Id), Times.Once);
    }

    [Fact]
    public async Task Register_emailQueJaTemConta_naoMandaEmail()
    {
        using var ctx = CreateContext();
        SeedUsuario(ctx, "duplicado@test.com");
        var email = new Mock<IEmailCadastroDispatcher>();
        var auth = CreateServiceComEmail(ctx, email.Object);

        await auth.RegisterAsync(new DTOs.Auth.RegisterDto
        {
            Email = "duplicado@test.com", Nome = "Outro", Password = "SenhaForte!2026", ConfirmPassword = "SenhaForte!2026",
        });

        email.Verify(e => e.PedidoRecebido(It.IsAny<Guid>()), Times.Never);
    }

    [Theory]
    [InlineData(StatusUsuario.AguardandoAprovacao, true)]
    [InlineData(StatusUsuario.Ativo, false)]
    [InlineData(StatusUsuario.Recusado, false)]
    public async Task JobPedidoRecebido_soMandaSeAindaEspera(StatusUsuario status, bool manda)
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "fila@test.com");
        u.Status = status;
        await ctx.SaveChangesAsync();
        var sender = new Mock<IContaEmailSender>();
        var confirmacao = new ConfirmacaoCadastroService(ctx, Microsoft.Extensions.Logging.Abstractions.NullLogger<ConfirmacaoCadastroService>.Instance);

        await new ControleFinanceiro.Api.Infrastructure.Jobs.EmailPedidoRecebidoJob(ctx, confirmacao, sender.Object).ExecuteAsync(u.Id);

        sender.Verify(s => s.EnviarPedidoRecebidoAsync("fila@test.com", It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()),
            manda ? Times.Once() : Times.Never());
    }

    // ── "Não fui eu" do e-mail de senha nova ──

    [Fact]
    public async Task CancelarResetSenha_linkParaDeValer_eAContaNaoTrava()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "cancela@test.com");
        const string bruto = "token-bruto-de-teste";
        ctx.PasswordResetTokens.Add(new PasswordResetToken
        {
            Id = Guid.NewGuid(), UsuarioId = u.Id, Token = OpaqueTokenHasher.Hash(bruto),
            ExpiresAt = DateTime.UtcNow.AddHours(1), Usado = false,
        });
        await ctx.SaveChangesAsync();
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);

        await auth.CancelarResetSenhaAsync(bruto);
        await auth.CancelarResetSenhaAsync("nao-existe"); // link inventado: mesma resposta, sem erro

        Assert.True((await ctx.PasswordResetTokens.SingleAsync()).Usado);
        await Assert.ThrowsAsync<ArgumentException>(() => auth.ResetSenhaAsync(new DTOs.Auth.ResetPasswordDto
        {
            Token = bruto, NovaSenha = "uma frase longa e boa", ConfirmarNovaSenha = "uma frase longa e boa",
        }));
        Assert.Equal(StatusUsuario.Ativo, (await ctx.Usuarios.FindAsync(u.Id))!.Status); // conta não trava
    }

    // ── /auth/me expõe IsAdmin (o front usa pra gate/entrada do painel admin) ──

    [Fact]
    public async Task GetUsuario_exponhaIsAdmin()
    {
        using var ctx = CreateContext();
        var comum = SeedUsuario(ctx, "comum@test.com");
        var admin = SeedUsuario(ctx, "admin@test.com");
        admin.IsAdmin = true;
        await ctx.SaveChangesAsync();
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);

        Assert.False((await auth.GetUsuarioAsync(comum.Id))!.IsAdmin);
        Assert.True((await auth.GetUsuarioAsync(admin.Id))!.IsAdmin);
    }

    // ── Gate do beta: cadastro nasce pendente e sem sessão; login barra não-Ativo ──

    [Fact]
    public async Task Register_contaNasceAguardandoAprovacao_semSessao()
    {
        using var ctx = CreateContext();
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);

        var resp = await auth.RegisterAsync(new DTOs.Auth.RegisterDto
        {
            Email = "novo@test.com", Nome = "Novo",
            Password = "SenhaForte!2026", ConfirmPassword = "SenhaForte!2026",
        });

        // Nasce pendente…
        Assert.Equal(StatusUsuario.AguardandoAprovacao, resp.Status);
        var u = await ctx.Usuarios.SingleAsync(x => x.Email == "novo@test.com");
        Assert.Equal(StatusUsuario.AguardandoAprovacao, u.Status);
        // …e NÃO ganha sessão: nenhum refresh token foi emitido no cadastro (gate do beta).
        Assert.Empty(ctx.RefreshTokens);
    }

    [Fact]
    public async Task Login_contaPendente_barraComMensagemDeAprovacao()
    {
        using var ctx = CreateContext();
        var u = SeedUsuarioComSenha(ctx, "pendente@test.com", "SenhaForte!2026");
        u.Status = StatusUsuario.AguardandoAprovacao;
        await ctx.SaveChangesAsync();
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);

        var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => auth.LoginAsync(new DTOs.Auth.LoginDto { Email = "pendente@test.com", Password = "SenhaForte!2026" }));
        Assert.Contains("aguardando aprovação", ex.Message);
    }

    [Fact]
    public async Task Login_contaMarcadaExclusao_retornaSinalDeReativacao_naoBarra()
    {
        using var ctx = CreateContext();
        var u = SeedUsuarioComSenha(ctx, "marcada@test.com", "SenhaForte!2026");
        u.Status = StatusUsuario.MarcadoParaExclusao;
        u.MarcadoExclusaoEm = DateTime.UtcNow;
        await ctx.SaveChangesAsync();
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);

        // Não barra (não lança) — sinaliza pro front oferecer reativação, sem emitir sessão.
        var r = await auth.LoginAsync(new DTOs.Auth.LoginDto { Email = "marcada@test.com", Password = "SenhaForte!2026" });

        Assert.True(r.ContaMarcadaExclusao);
        Assert.False(r.MfaRequerido);
        Assert.Null(r.Auth);
        Assert.Empty(ctx.RefreshTokens); // nenhuma sessão emitida
    }

    [Fact]
    public async Task Login_contaRecusada_barra()
    {
        using var ctx = CreateContext();
        var u = SeedUsuarioComSenha(ctx, "recusado@test.com", "SenhaForte!2026");
        u.Status = StatusUsuario.Recusado;
        await ctx.SaveChangesAsync();
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => auth.LoginAsync(new DTOs.Auth.LoginDto { Email = "recusado@test.com", Password = "SenhaForte!2026" }));
    }

    [Fact]
    public async Task Login_contaAtiva_gravaUltimoAcesso()
    {
        using var ctx = CreateContext();
        var u = SeedUsuarioComSenha(ctx, "ativo@test.com", "SenhaForte!2026");
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);

        await LoginSemMfaAsync(auth, "ativo@test.com", "SenhaForte!2026");

        var atualizado = await ctx.Usuarios.FindAsync(u.Id);
        Assert.NotNull(atualizado!.UltimoAcessoEm);
    }

    // ── Força bruta por conta (OWASP Authentication Cheat Sheet) ────────────────

    [Fact]
    public async Task Login_senhaErrada_incrementaContadorDeFalhas()
    {
        using var ctx = CreateContext();
        var u = SeedUsuarioComSenha(ctx, "alvo@test.com", "SenhaForte!2026");
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => auth.LoginAsync(new DTOs.Auth.LoginDto { Email = "alvo@test.com", Password = "Errada!123456" }));

        var atualizado = await ctx.Usuarios.FindAsync(u.Id);
        Assert.Equal(1, atualizado!.FalhasLoginConsecutivas);
        Assert.NotNull(atualizado.UltimaFalhaLoginEm);
    }

    [Fact]
    public async Task Login_depoisDe3ErrosSeguidos_bloqueiaTentativaImediata_mesmoComSenhaCerta()
    {
        using var ctx = CreateContext();
        SeedUsuarioComSenha(ctx, "alvo@test.com", "SenhaForte!2026");
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);

        for (var i = 0; i < 3; i++)
            await Assert.ThrowsAsync<UnauthorizedAccessException>(
                () => auth.LoginAsync(new DTOs.Auth.LoginDto { Email = "alvo@test.com", Password = "Errada!123456" }));

        // 4ª tentativa, imediatamente depois — delay progressivo bloqueia mesmo com a senha certa.
        var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => auth.LoginAsync(new DTOs.Auth.LoginDto { Email = "alvo@test.com", Password = "SenhaForte!2026" }));
        Assert.Contains("Aguarde", ex.Message);
    }

    [Fact]
    public async Task Login_depoisDoDelayExpirar_permiteLoginCerto_e_zeraContador()
    {
        using var ctx = CreateContext();
        var u = SeedUsuarioComSenha(ctx, "alvo@test.com", "SenhaForte!2026");
        u.FalhasLoginConsecutivas = 3;
        u.UltimaFalhaLoginEm = DateTime.UtcNow.AddSeconds(-2); // já passou do delay de 1s (3 falhas)
        await ctx.SaveChangesAsync();
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);

        var resp = await LoginSemMfaAsync(auth, "alvo@test.com", "SenhaForte!2026");

        Assert.False(string.IsNullOrEmpty(resp.Token));
        var atualizado = await ctx.Usuarios.FindAsync(u.Id);
        Assert.Equal(0, atualizado!.FalhasLoginConsecutivas);
        Assert.Null(atualizado.UltimaFalhaLoginEm);
    }

    [Fact]
    public async Task Login_apos10FalhasSeguidas_bloqueiaPermanentemente_ateResetDeSenha()
    {
        using var ctx = CreateContext();
        var u = SeedUsuarioComSenha(ctx, "alvo@test.com", "SenhaForte!2026");
        u.FalhasLoginConsecutivas = 10;
        u.UltimaFalhaLoginEm = DateTime.UtcNow.AddMinutes(-10); // delay já expirou, mas o bloqueio permanente independe disso
        await ctx.SaveChangesAsync();
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);

        // Nem a senha certa passa — só reset de senha libera.
        var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => auth.LoginAsync(new DTOs.Auth.LoginDto { Email = "alvo@test.com", Password = "SenhaForte!2026" }));
        Assert.Contains("Redefina sua senha", ex.Message);
    }

    [Fact]
    public async Task ResetSenha_zeraContadorDeFalhas_liberandoLoginDeNovo()
    {
        using var ctx = CreateContext();
        var u = SeedUsuarioComSenha(ctx, "alvo@test.com", "SenhaForte!2026");
        u.FalhasLoginConsecutivas = 10; // bloqueado permanentemente
        u.UltimaFalhaLoginEm = DateTime.UtcNow;
        await ctx.SaveChangesAsync();
        var (sender, raw) = SenderCapturandoToken();
        await new PasswordResetEmailJob(ctx, sender.Object).ExecuteAsync("alvo@test.com");
        var auth = CreateService(ctx, new Mock<IPasswordResetDispatcher>().Object);

        await auth.ResetSenhaAsync(new DTOs.Auth.ResetPasswordDto
        {
            Token = raw()!, NovaSenha = "NovaSenhaForte!2026", ConfirmarNovaSenha = "NovaSenhaForte!2026",
        });

        var atualizado = await ctx.Usuarios.FindAsync(u.Id);
        Assert.Equal(0, atualizado!.FalhasLoginConsecutivas);
        Assert.Null(atualizado.UltimaFalhaLoginEm);

        // Login com a senha nova funciona normalmente (bloqueio foi limpo).
        var resp = await LoginSemMfaAsync(auth, "alvo@test.com", "NovaSenhaForte!2026");
        Assert.False(string.IsNullOrEmpty(resp.Token));
    }
}

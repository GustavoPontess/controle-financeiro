using ControleFinanceiro.Api.Domain.Entities;
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
        return new AuthService(ctx, jwt, dispatcher);
    }

    private static Usuario SeedUsuario(AppDbContext ctx, string email)
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = email, Nome = "User", PasswordHash = "x", Ativo = true };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u;
    }

    // ── SolicitarResetSenhaAsync ───────────────────────────────────────────────

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
        sender.Verify(s => s.EnviarAsync(u.Email, prt.Token, prt.ExpiresAt, It.IsAny<CancellationToken>()), Times.Once);
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
}

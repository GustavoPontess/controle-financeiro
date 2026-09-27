using System.Net;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using ControleFinanceiro.Api.Infrastructure.Jobs;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Janela de tolerância da reuse-detection do refresh. Bug que motivou: com o jwt de 15min expirado, a
/// tela disparava vários GETs → vários 401 → vários /auth/refresh com o MESMO token; o 2º em diante era
/// tratado como replay → família comprometida → usuário deslogado + alerta falso de roubo. Agora a
/// reapresentação logo após a rotação, do MESMO dispositivo, só falha aquela request; fora disso (tarde
/// demais ou de outro dispositivo) a regra estrita segue valendo. O replay sem contexto HTTP (fail-closed)
/// já é coberto por <c>AuthServiceTests.Refresh_replayDeTokenJaRotacionado_comprometeAFamiliaInteira</c>.
/// Semeia o refresh direto no banco (sem hash de senha) → não precisa da coleção PasswordHasherEnv.
/// </summary>
public class RefreshReuseToleranciaTests
{
    private const string UaNavegador = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Teste/1.0";

    // IHttpContextAccessor fixo por instância: o HttpContextAccessor real guarda o contexto num
    // AsyncLocal estático, então dois "dispositivos" no mesmo teste se sobrescreveriam.
    private sealed class AcessorFixo(HttpContext contexto) : IHttpContextAccessor
    {
        public HttpContext? HttpContext { get; set; } = contexto;
    }

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(
                Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    // AuthService "atendendo" requests de um dispositivo (User-Agent + IP) — é o que a janela compara.
    private static AuthService ServicoNoDispositivo(AppDbContext ctx, string ip, string userAgent = UaNavegador)
    {
        var http = new DefaultHttpContext();
        http.Request.Headers.UserAgent = userAgent;
        http.Connection.RemoteIpAddress = IPAddress.Parse(ip);

        var jwt = new JwtTokenProvider("chave-de-teste-suficientemente-grande-0123456789", "test", "test");
        return new AuthService(ctx, jwt, new Mock<IPasswordResetDispatcher>().Object, new MfaService(ctx),
            TestHelpers.NotifAdmin(ctx), new AcessorFixo(http));
    }

    // Usuário ativo + refresh de login (família nova). Devolve o token BRUTO (o que vai no cookie).
    private static string SeedSessao(AppDbContext ctx)
    {
        var usuario = new Usuario { Id = Guid.NewGuid(), Email = "u@test.com", Nome = "User", PasswordHash = "x", Status = StatusUsuario.Ativo };
        ctx.Usuarios.Add(usuario);

        var bruto = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
        ctx.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UsuarioId = usuario.Id,
            Token = OpaqueTokenHasher.Hash(bruto),
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CriadoEm = DateTime.UtcNow,
            FamiliaId = Guid.NewGuid(),
        });
        ctx.SaveChanges();
        return bruto;
    }

    private static bool TemAlertaDeSeguranca(AppDbContext ctx) =>
        ctx.NotificacoesAdmin.Any(n => n.Tipo == TipoNotificacaoAdmin.Seguranca);

    [Fact]
    public async Task Replay_dentroDaJanela_mesmoDispositivo_soFalhaARequest_familiaSegueValida()
    {
        using var ctx = CreateContext();
        var tokenLogin = SeedSessao(ctx);
        var auth = ServicoNoDispositivo(ctx, "203.0.113.10");

        // Request A ganha a corrida e rotaciona.
        var vencedora = await auth.RefreshAsync(tokenLogin);

        // Request B (paralela, mesmo navegador) chega com o token já rotacionado → 401 só pra ela.
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => auth.RefreshAsync(tokenLogin));

        // Nada foi revogado além da rotação normal e o admin NÃO recebeu alerta falso de roubo.
        Assert.Single(ctx.RefreshTokens, r => !r.Revogado);
        Assert.False(TemAlertaDeSeguranca(ctx));

        // E a sessão continua: o token entregue à vencedora ainda renova.
        var seguinte = await auth.RefreshAsync(vencedora.RefreshToken);
        Assert.False(string.IsNullOrEmpty(seguinte.RefreshToken));
    }

    [Fact]
    public async Task Replay_depoisDaJanela_comprometeAFamilia_eAlerta()
    {
        using var ctx = CreateContext();
        var tokenLogin = SeedSessao(ctx);
        var auth = ServicoNoDispositivo(ctx, "203.0.113.10");

        var vencedora = await auth.RefreshAsync(tokenLogin);

        // Simula a passagem do tempo: a rotação aconteceu há mais de 30s (fora da janela).
        var sucessor = await ctx.RefreshTokens.SingleAsync(r => !r.Revogado);
        sucessor.CriadoEm = DateTime.UtcNow.AddSeconds(-31);
        await ctx.SaveChangesAsync();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => auth.RefreshAsync(tokenLogin));

        // Regra estrita (RFC 9700 §4.14.2): família inteira revogada + alerta pro admin.
        Assert.All(ctx.RefreshTokens, r => Assert.True(r.Revogado));
        Assert.True(TemAlertaDeSeguranca(ctx));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => auth.RefreshAsync(vencedora.RefreshToken));
    }

    [Fact]
    public async Task Replay_dentroDaJanela_deOutroDispositivo_comprometeAFamilia()
    {
        using var ctx = CreateContext();
        var tokenLogin = SeedSessao(ctx);
        var legitimo = ServicoNoDispositivo(ctx, "203.0.113.10");
        var atacante = ServicoNoDispositivo(ctx, "198.51.100.77");

        var vencedora = await legitimo.RefreshAsync(tokenLogin);

        // Mesmo segundos depois, reapresentação vinda de OUTRA rede não é corrida do cliente: é o caso
        // típico de token roubado → a janela não se aplica.
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => atacante.RefreshAsync(tokenLogin));

        Assert.All(ctx.RefreshTokens, r => Assert.True(r.Revogado));
        Assert.True(TemAlertaDeSeguranca(ctx));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => legitimo.RefreshAsync(vencedora.RefreshToken));
    }

    [Fact]
    public async Task Replay_dentroDaJanela_mesmoIpOutroNavegador_comprometeAFamilia()
    {
        using var ctx = CreateContext();
        var tokenLogin = SeedSessao(ctx);
        var legitimo = ServicoNoDispositivo(ctx, "203.0.113.10");
        var outroNavegador = ServicoNoDispositivo(ctx, "203.0.113.10", userAgent: "curl/8.0");

        await legitimo.RefreshAsync(tokenLogin);

        // Mesmo IP (NAT de casa/escritório) mas outro cliente → também não é corrida do mesmo navegador.
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => outroNavegador.RefreshAsync(tokenLogin));

        Assert.All(ctx.RefreshTokens, r => Assert.True(r.Revogado));
        Assert.True(TemAlertaDeSeguranca(ctx));
    }
}

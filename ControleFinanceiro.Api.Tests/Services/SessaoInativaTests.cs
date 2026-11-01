using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Sair por inatividade (OWASP Session Management): sessão SEM "Manter-me conectado" parada além de jwt +
/// <see cref="SessaoInativa.Minutos"/> não renova nem troca de conta (SESSAO_INATIVA); com ele, segue os 7 dias.
/// </summary>
// Login lê PASSWORD_PEPPER (env global): mesma coleção do AuthServiceTests.
[Collection("PasswordHasherEnv")]
public class SessaoInativaTests
{
    private const string Senha = "SenhaForte!2026";
    private static readonly JwtTokenProvider Jwt = new("chave-de-teste-suficientemente-grande-0123456789", "test", "test");

    private static AppDbContext CreateContext() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
        .Options);

    private static AuthService CreateService(AppDbContext ctx) =>
        new(ctx, Jwt, new Mock<IPasswordResetDispatcher>().Object, new MfaService(ctx), TestHelpers.NotifAdmin(ctx));

    private static Usuario SeedUsuario(AppDbContext ctx, string email)
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = email, Nome = "User", PasswordHash = PasswordHasher.HashPassword(Senha), Status = StatusUsuario.Ativo };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u;
    }

    private static async Task<DTOs.Auth.AuthResponseDto> EntrarAsync(AuthService auth, string email, bool manterConectado)
    {
        var r = await auth.LoginAsync(new DTOs.Auth.LoginDto { Email = email, Password = Senha }, manterConectado: manterConectado);
        return r.Auth!;
    }

    // Faz o refresh vivo da sessão parecer criado há tantos minutos (como se ninguém tivesse usado desde então).
    private static void Envelhecer(AppDbContext ctx, Guid usuarioId, double minutos)
    {
        var rt = ctx.RefreshTokens.Single(r => r.UsuarioId == usuarioId && !r.Revogado);
        rt.CriadoEm = DateTime.UtcNow.AddMinutes(-minutos);
        ctx.SaveChanges();
    }

    private static double Limite => Jwt.MinutosDeVida + SessaoInativa.Minutos;

    [Fact]
    public async Task Refresh_semManterConectado_paradaAlemDoLimite_recusaComSessaoInativa_eRevoga()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "parado@test.com");
        var auth = CreateService(ctx);
        var login = await EntrarAsync(auth, "parado@test.com", manterConectado: false);
        Envelhecer(ctx, u.Id, Limite + 1);

        await Assert.ThrowsAsync<SessaoInativaException>(() => auth.RefreshAsync(login.RefreshToken));

        // Saiu da lista de sessões (revogado sem sucessor: não é roubo) e não volta a valer.
        var rt = ctx.RefreshTokens.Single(r => r.UsuarioId == u.Id);
        Assert.True(rt.Revogado);
        Assert.Null(rt.SubstituidoPorId);
        await Assert.ThrowsAnyAsync<UnauthorizedAccessException>(() => auth.RefreshAsync(login.RefreshToken));
    }

    [Fact]
    public async Task Refresh_semManterConectado_dentroDoLimite_renova()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "ativo@test.com");
        var auth = CreateService(ctx);
        var login = await EntrarAsync(auth, "ativo@test.com", manterConectado: false);
        Envelhecer(ctx, u.Id, Limite - 1);

        var novo = await auth.RefreshAsync(login.RefreshToken);

        Assert.NotEqual(login.RefreshToken, novo.RefreshToken);
    }

    [Fact]
    public async Task Refresh_comManterConectado_paradaHoras_renova()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "lembrado@test.com");
        var auth = CreateService(ctx);
        var login = await EntrarAsync(auth, "lembrado@test.com", manterConectado: true);
        Envelhecer(ctx, u.Id, 6 * 60);

        var novo = await auth.RefreshAsync(login.RefreshToken);

        Assert.True(novo.LembrarSessao);
    }

    [Fact]
    public async Task Switch_contaParqueadaSemManterConectado_paradaAlemDoLimite_recusa()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "parqueada@test.com");
        var auth = CreateService(ctx);
        var login = await EntrarAsync(auth, "parqueada@test.com", manterConectado: false);
        Envelhecer(ctx, u.Id, Limite + 1);

        await Assert.ThrowsAsync<SessaoInativaException>(() => auth.SwitchAsync(login.RefreshToken, u.Id));
    }

    [Fact]
    public async Task SessaoLembrada_dizSeAFamiliaFoiAbertaComManterConectado()
    {
        using var ctx = CreateContext();
        SeedUsuario(ctx, "a@test.com");
        SeedUsuario(ctx, "b@test.com");
        var auth = CreateService(ctx);
        await EntrarAsync(auth, "a@test.com", manterConectado: false);
        await EntrarAsync(auth, "b@test.com", manterConectado: true);
        var familiaA = ctx.RefreshTokens.Single(r => r.Usuario.Email == "a@test.com").FamiliaId;
        var familiaB = ctx.RefreshTokens.Single(r => r.Usuario.Email == "b@test.com").FamiliaId;

        Assert.False(await auth.SessaoLembradaAsync(familiaA));
        Assert.True(await auth.SessaoLembradaAsync(familiaB));
        Assert.Null(await auth.SessaoLembradaAsync(Guid.NewGuid()));
    }
}

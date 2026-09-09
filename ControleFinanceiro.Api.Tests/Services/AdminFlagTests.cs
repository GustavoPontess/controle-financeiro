using ControleFinanceiro.Api.Data;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Auth;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Invariantes de segurança da flag <c>IsAdmin</c> (spec `docs/features/admin/spec.md` §0):
/// nunca é concedida por fluxo de usuário (cadastro nasce não-admin); a ÚNICA via pela app é o
/// <c>AdminSeeder</c> via env var <c>ADMIN_EMAILS</c>, que só CONCEDE (nunca revoga automaticamente).
/// Usa a collection de env pra não correr em paralelo com outros testes que mexem em env var.
/// </summary>
[Collection("PasswordHasherEnv")]
public class AdminFlagTests
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

    private static Usuario SeedUsuario(AppDbContext ctx, string email, bool isAdmin = false)
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = email, Nome = "U", PasswordHash = "x", Status = StatusUsuario.Ativo, IsAdmin = isAdmin };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u;
    }

    [Fact]
    public async Task Cadastro_nasce_naoAdmin()
    {
        using var ctx = CreateContext();
        var jwt = new JwtTokenProvider("chave-de-teste-suficientemente-grande-0123456789", "test", "test");
        var auth = new AuthService(ctx, jwt, new Mock<IPasswordResetDispatcher>().Object, new MfaService(ctx));

        await auth.RegisterAsync(new RegisterDto
        {
            Email = "novo@test.com",
            Password = "senhaSuperSegura123",
            ConfirmPassword = "senhaSuperSegura123",
            Nome = "Novo",
        });

        var u = await ctx.Usuarios.SingleAsync(x => x.Email == "novo@test.com");
        Assert.False(u.IsAdmin); // nenhum fluxo de usuário concede admin
    }

    [Fact]
    public async Task AdminSeeder_concede_para_email_da_env()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "chefe@test.com", isAdmin: false);
        var outro = SeedUsuario(ctx, "outro@test.com", isAdmin: false);

        await ComEnv("ADMIN_EMAILS", "chefe@test.com", () => AdminSeeder.SeedAsync(ctx));

        await ctx.Entry(u).ReloadAsync();
        await ctx.Entry(outro).ReloadAsync();
        Assert.True(u.IsAdmin);       // e-mail listado → vira admin
        Assert.False(outro.IsAdmin);  // não listado → não vira
    }

    [Fact]
    public async Task AdminSeeder_semEnv_naoConcedeNada()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "chefe@test.com", isAdmin: false);

        await ComEnv("ADMIN_EMAILS", null, () => AdminSeeder.SeedAsync(ctx));

        await ctx.Entry(u).ReloadAsync();
        Assert.False(u.IsAdmin); // fail-safe: sem env var, ninguém vira admin
    }

    [Fact]
    public async Task AdminSeeder_caseInsensitive()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, "chefe@test.com", isAdmin: false);

        await ComEnv("ADMIN_EMAILS", "  CHEFE@TEST.COM ", () => AdminSeeder.SeedAsync(ctx));

        await ctx.Entry(u).ReloadAsync();
        Assert.True(u.IsAdmin); // e-mail é normalizado (lower + trim)
    }

    private static async Task ComEnv(string chave, string? valor, Func<Task> acao)
    {
        var antigo = Environment.GetEnvironmentVariable(chave);
        Environment.SetEnvironmentVariable(chave, valor);
        try { await acao(); }
        finally { Environment.SetEnvironmentVariable(chave, antigo); }
    }
}

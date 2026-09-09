using System.Security.Claims;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Segurança da autorização de admin: a policy revalida <c>IsAdmin</c> no banco (não confia só no
/// JWT). Cobre os vetores de escalação de privilégio — token válido de não-admin, admin desativado,
/// claim ausente, usuário inexistente — que NÃO podem conceder acesso admin.
/// </summary>
public class AdminAuthorizationHandlerTests
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

    private static Usuario Seed(AppDbContext ctx, bool isAdmin, bool ativo = true)
    {
        var u = new Usuario
        {
            Id = Guid.NewGuid(),
            Email = "u@test.com",
            Nome = "U",
            PasswordHash = "x",
            // "ativo" aqui = conta habilitada. Com o Status novo: Ativo permite, Bloqueado barra.
            Status = ativo ? StatusUsuario.Ativo : StatusUsuario.Bloqueado,
            IsAdmin = isAdmin,
        };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u;
    }

    private static ClaimsPrincipal PrincipalFor(Guid usuarioId) =>
        new(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, usuarioId.ToString()) }, "test"));

    private static async Task<bool> Autoriza(AppDbContext ctx, ClaimsPrincipal user)
    {
        var handler = new AdminAuthorizationHandler(ctx);
        var req = new AdminRequirement();
        var context = new AuthorizationHandlerContext(new[] { req }, user, null);
        await handler.HandleAsync(context);
        return context.HasSucceeded;
    }

    [Fact]
    public async Task Admin_ativo_autoriza()
    {
        using var ctx = CreateContext();
        var u = Seed(ctx, isAdmin: true);
        Assert.True(await Autoriza(ctx, PrincipalFor(u.Id)));
    }

    [Fact]
    public async Task NaoAdmin_naoAutoriza()
    {
        using var ctx = CreateContext();
        var u = Seed(ctx, isAdmin: false);
        Assert.False(await Autoriza(ctx, PrincipalFor(u.Id)));
    }

    [Fact]
    public async Task AdminDesativado_naoAutoriza()
    {
        using var ctx = CreateContext();
        var u = Seed(ctx, isAdmin: true, ativo: false);
        Assert.False(await Autoriza(ctx, PrincipalFor(u.Id)));
    }

    [Fact]
    public async Task SemClaimDeUsuario_naoAutoriza()
    {
        using var ctx = CreateContext();
        Seed(ctx, isAdmin: true);
        var anonimo = new ClaimsPrincipal(new ClaimsIdentity()); // sem NameIdentifier
        Assert.False(await Autoriza(ctx, anonimo));
    }

    [Fact]
    public async Task UsuarioInexistente_naoAutoriza()
    {
        using var ctx = CreateContext();
        Seed(ctx, isAdmin: true);
        Assert.False(await Autoriza(ctx, PrincipalFor(Guid.NewGuid()))); // id que não existe
    }
}

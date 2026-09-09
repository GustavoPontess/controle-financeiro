using System.Security.Claims;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Infrastructure.Identity;

/// <summary>
/// Requisito da policy de admin global. Ver <c>docs/features/admin/spec.md</c> §0.
/// </summary>
public class AdminRequirement : IAuthorizationRequirement
{
    public const string PolicyName = "IsAdmin";
}

/// <summary>
/// Autoriza rotas de admin com **re-check no banco** (defense in depth): não basta o JWT ser
/// válido — a flag <c>Usuario.IsAdmin</c> é revalidada no banco a cada request. Assim:
/// (1) um token não pode ser forjado pra conceder admin; (2) revogar admin (UPDATE no banco)
/// tem efeito imediato, sem esperar o token expirar. Mesmo espírito do
/// <c>HangfireDashboardAuthFilter</c>, mas usando a flag em vez de allowlist de e-mail.
/// </summary>
public class AdminAuthorizationHandler : AuthorizationHandler<AdminRequirement>
{
    private readonly AppDbContext _context;

    public AdminAuthorizationHandler(AppDbContext context) => _context = context;

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context, AdminRequirement requirement)
    {
        var idClaim = context.User.FindFirst(ClaimTypes.NameIdentifier);
        if (idClaim == null || !Guid.TryParse(idClaim.Value, out var usuarioId))
            return; // não autenticado / claim inválida → não concede

        var ehAdmin = await _context.Usuarios
            .Where(u => u.Id == usuarioId && u.IsAdmin && u.Ativo)
            .AnyAsync();

        if (ehAdmin)
            context.Succeed(requirement);
    }
}

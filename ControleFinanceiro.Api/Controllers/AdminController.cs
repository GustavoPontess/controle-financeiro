using System.Security.Claims;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Controllers;

/// <summary>
/// Área administrativa. TODA rota exige a policy <c>IsAdmin</c> (autenticado + flag revalidada
/// no banco). Ver spec `docs/features/admin/spec.md`. Por ora só o endpoint de identidade do
/// admin; os módulos (fila de aprovação, usuários, LGPD, auditoria) entram a seguir.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = AdminRequirement.PolicyName)]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _context;

    public AdminController(AppDbContext context) => _context = context;

    /// <summary>Dados do admin autenticado. Serve pro front confirmar acesso admin.</summary>
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var idClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (idClaim == null || !Guid.TryParse(idClaim.Value, out var usuarioId))
            return Unauthorized();

        var u = await _context.Usuarios
            .Where(x => x.Id == usuarioId)
            .Select(x => new { x.Id, x.Email, x.Nome, x.IsAdmin })
            .FirstOrDefaultAsync();

        return u == null ? NotFound() : Ok(u);
    }
}

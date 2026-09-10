using System.Security.Claims;
using ControleFinanceiro.Api.DTOs.Admin;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Controllers;

/// <summary>
/// Área administrativa. TODA rota exige a policy <c>IsAdmin</c> (autenticado + flag revalidada
/// no banco). Ver spec `docs/features/admin/spec.md`. Módulo A (fila de aprovação + métricas)
/// implementado; usuários/LGPD/auditoria entram a seguir.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = AdminRequirement.PolicyName)]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AdminUsuarioService _adminUsuarios;
    private readonly AdminAuditService _auditoria;

    public AdminController(AppDbContext context, AdminUsuarioService adminUsuarios, AdminAuditService auditoria)
    {
        _context = context;
        _adminUsuarios = adminUsuarios;
        _auditoria = auditoria;
    }

    private Guid AdminId()
    {
        var idClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        return idClaim != null && Guid.TryParse(idClaim.Value, out var id) ? id : Guid.Empty;
    }

    private string AdminEmail() => User.FindFirst(ClaimTypes.Email)?.Value ?? string.Empty;

    /// <summary>Dados do admin autenticado. Serve pro front confirmar acesso admin.</summary>
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var usuarioId = AdminId();
        if (usuarioId == Guid.Empty)
            return Unauthorized();

        var u = await _context.Usuarios
            .Where(x => x.Id == usuarioId)
            .Select(x => new { x.Id, x.Email, x.Nome, x.IsAdmin })
            .FirstOrDefaultAsync();

        return u == null ? NotFound() : Ok(u);
    }

    // ── Módulo A — fila de aprovação + métricas (gate do beta) ────────────────────────────

    /// <summary>Fila de cadastros aguardando aprovação (mais antigos primeiro).</summary>
    [HttpGet("pendentes")]
    public async Task<ActionResult<List<UsuarioAdminDto>>> Pendentes()
        => Ok(await _adminUsuarios.ListarPendentesAsync());

    /// <summary>Aprova um cadastro pendente — a conta passa a poder logar.</summary>
    [HttpPost("usuarios/{id:guid}/aprovar")]
    public async Task<ActionResult<UsuarioAdminDto>> Aprovar(Guid id)
        => Ok(await _adminUsuarios.AprovarAsync(id, AdminId(), AdminEmail()));

    /// <summary>Recusa um cadastro pendente — a conta não pode logar.</summary>
    [HttpPost("usuarios/{id:guid}/recusar")]
    public async Task<ActionResult<UsuarioAdminDto>> Recusar(Guid id)
        => Ok(await _adminUsuarios.RecusarAsync(id, AdminId(), AdminEmail()));

    /// <summary>Métricas do beta (contagens por status + cadastros/acessos recentes).</summary>
    [HttpGet("metricas")]
    public async Task<ActionResult<MetricasAdminDto>> Metricas()
        => Ok(await _adminUsuarios.ObterMetricasAsync());

    // ── Módulo B — gestão de usuários ─────────────────────────────────────────────────────

    /// <summary>Lista todos os usuários (gestão). `busca` opcional filtra por nome/e-mail.</summary>
    [HttpGet("usuarios")]
    public async Task<ActionResult<List<UsuarioAdminDto>>> Usuarios([FromQuery] string? busca)
        => Ok(await _adminUsuarios.ListarUsuariosAsync(busca));

    /// <summary>Bloqueia um usuário ativo (não loga mais; reversível). Não pode bloquear a si mesmo.</summary>
    [HttpPatch("usuarios/{id:guid}/bloquear")]
    public async Task<ActionResult<UsuarioAdminDto>> Bloquear(Guid id)
        => Ok(await _adminUsuarios.BloquearAsync(id, AdminId(), AdminEmail()));

    /// <summary>Reativa um usuário bloqueado.</summary>
    [HttpPatch("usuarios/{id:guid}/reativar")]
    public async Task<ActionResult<UsuarioAdminDto>> Reativar(Guid id)
        => Ok(await _adminUsuarios.ReativarAsync(id, AdminId(), AdminEmail()));

    /// <summary>Força o reset de senha (dispara o e-mail de recuperação).</summary>
    [HttpPost("usuarios/{id:guid}/forcar-reset")]
    public async Task<IActionResult> ForcarReset(Guid id)
    {
        await _adminUsuarios.ForcarResetSenhaAsync(id, AdminId(), AdminEmail());
        return NoContent();
    }

    // ── Módulo D — visualizador de auditoria (só leitura) ─────────────────────────────────

    /// <summary>Últimas ações de admin (auditoria), mais recentes primeiro.</summary>
    [HttpGet("auditoria")]
    public async Task<ActionResult<List<AdminAuditLogDto>>> Auditoria()
        => Ok(await _auditoria.ListarAsync());
}

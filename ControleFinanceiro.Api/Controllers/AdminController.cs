using ControleFinanceiro.Api.Infrastructure.Security;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;
using ControleFinanceiro.Api.DTOs.Admin;
using ControleFinanceiro.Api.DTOs.Common;
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
    private readonly AdminLgpdService _lgpd;
    private readonly NotificacaoAdminService _notificacoes;

    public AdminController(AppDbContext context, AdminUsuarioService adminUsuarios, AdminAuditService auditoria,
        AdminLgpdService lgpd, NotificacaoAdminService notificacoes)
    {
        _context = context;
        _adminUsuarios = adminUsuarios;
        _auditoria = auditoria;
        _lgpd = lgpd;
        _notificacoes = notificacoes;
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

    /// <summary>Lista usuários (gestão), paginada. `busca` opcional filtra por nome/e-mail (server-side).</summary>
    [HttpGet("usuarios")]
    public async Task<ActionResult<PagedResult<UsuarioAdminDto>>> Usuarios(
        [FromQuery] string? busca, [FromQuery] int page = 1, [FromQuery] int pageSize = 25)
        => Ok(await _adminUsuarios.ListarUsuariosAsync(busca, page, pageSize));

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

    // ── Módulo C — LGPD (exportar + exclusão em 2 estágios) ───────────────────────────────

    /// <summary>Exporta os dados pessoais do usuário (direito de acesso/portabilidade, LGPD Art. 18).</summary>
    [HttpGet("usuarios/{id:guid}/exportar")]
    [EnableRateLimiting(LimitesDeUso.PoliticaPesada)]
    public async Task<ActionResult<ExportacaoUsuarioDto>> Exportar(Guid id)
        => Ok(await _lgpd.ExportarAsync(id, AdminId(), AdminEmail()));

    /// <summary>Estágio 1 — marca a conta pra exclusão (soft delete; reversível na carência). Não a si.</summary>
    [HttpPost("usuarios/{id:guid}/marcar-exclusao")]
    public async Task<ActionResult<UsuarioAdminDto>> MarcarExclusao(Guid id)
        => Ok(await _lgpd.MarcarExclusaoAsync(id, AdminId(), AdminEmail()));

    /// <summary>Desfaz a marcação de exclusão na janela de carência → conta volta a Ativo.</summary>
    [HttpPost("usuarios/{id:guid}/cancelar-exclusao")]
    public async Task<ActionResult<UsuarioAdminDto>> CancelarExclusao(Guid id)
        => Ok(await _lgpd.CancelarExclusaoAsync(id, AdminId(), AdminEmail()));

    /// <summary>Estágio 2 — purga física (IRREVERSÍVEL). Exige conta marcada + confirmação por e-mail;
    /// recusa se houver vínculo com outro usuário.</summary>
    [HttpPost("usuarios/{id:guid}/purgar")]
    public async Task<IActionResult> Purgar(Guid id, [FromBody] PurgarUsuarioRequest body)
    {
        await _lgpd.PurgarAsync(id, AdminId(), AdminEmail(), body?.EmailConfirmacao ?? string.Empty);
        return NoContent();
    }

    // ── Módulo D — visualizador de auditoria (só leitura) ─────────────────────────────────

    /// <summary>Ações de admin (auditoria), paginada, mais recentes primeiro. `busca` opcional filtra
    /// por e-mail do admin ou descrição do alvo (server-side).</summary>
    [HttpGet("auditoria")]
    public async Task<ActionResult<PagedResult<AdminAuditLogDto>>> Auditoria(
        [FromQuery] string? busca, [FromQuery] int page = 1, [FromQuery] int pageSize = 25)
        => Ok(await _auditoria.ListarAsync(busca, page, pageSize));

    // ── Notificações do admin (stream separado do financeiro) ─────────────────────────────

    /// <summary>Notificações do painel admin (mais recentes primeiro).</summary>
    [HttpGet("notificacoes")]
    public async Task<ActionResult<List<NotificacaoAdminDto>>> Notificacoes()
        => Ok(await _notificacoes.ListarAsync());

    /// <summary>Quantidade de notificações de admin não lidas.</summary>
    [HttpGet("notificacoes/contagem")]
    public async Task<ActionResult<ContagemNotificacaoAdminDto>> ContarNotificacoes()
        => Ok(await _notificacoes.ContarNaoLidasAsync());

    /// <summary>Marca uma notificação de admin como lida.</summary>
    [HttpPut("notificacoes/{id:guid}/lida")]
    public async Task<IActionResult> MarcarNotificacaoLida(Guid id)
    {
        await _notificacoes.MarcarLidaAsync(id);
        return NoContent();
    }

    /// <summary>Marca todas as notificações de admin como lidas.</summary>
    [HttpPut("notificacoes/lidas")]
    public async Task<IActionResult> MarcarTodasNotificacoesLidas()
    {
        await _notificacoes.MarcarTodasLidasAsync();
        return NoContent();
    }
}

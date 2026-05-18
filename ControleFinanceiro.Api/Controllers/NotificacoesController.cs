using System.Security.Claims;
using ControleFinanceiro.Api.DTOs.Notificacao;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControleFinanceiro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificacoesController : ControllerBase
{
    private readonly NotificacaoService _notificacaoService;

    public NotificacoesController(NotificacaoService notificacaoService)
    {
        _notificacaoService = notificacaoService;
    }

    private Guid GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !Guid.TryParse(claim.Value, out var id))
            throw new UnauthorizedAccessException("Usuário não identificado.");
        return id;
    }

    /// <summary>Lista as notificações do usuário (mais recentes primeiro).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<NotificacaoDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Listar()
    {
        return Ok(await _notificacaoService.ListarAsync(GetUserId()));
    }

    /// <summary>Quantidade de notificações não lidas.</summary>
    [HttpGet("contagem")]
    [ProducesResponseType(typeof(ContagemNotificacaoDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Contar()
    {
        return Ok(await _notificacaoService.ContarNaoLidasAsync(GetUserId()));
    }

    /// <summary>Marca uma notificação como lida.</summary>
    [HttpPut("{id:guid}/lida")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> MarcarLida(Guid id)
    {
        await _notificacaoService.MarcarLidaAsync(id, GetUserId());
        return NoContent();
    }

    /// <summary>Marca todas as notificações como lidas.</summary>
    [HttpPut("lidas")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> MarcarTodasLidas()
    {
        await _notificacaoService.MarcarTodasLidasAsync(GetUserId());
        return NoContent();
    }
}

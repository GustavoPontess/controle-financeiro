using System.Security.Claims;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControleFinanceiro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ConvitesController : ControllerBase
{
    private readonly ConviteService _conviteService;

    public ConvitesController(ConviteService conviteService)
    {
        _conviteService = conviteService;
    }

    private Guid GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !Guid.TryParse(claim.Value, out var id))
            throw new UnauthorizedAccessException("Usuário não identificado.");
        return id;
    }

    /// <summary>Lista os convites pendentes para o e-mail do usuário logado.</summary>
    [HttpGet("pendentes")]
    [ProducesResponseType(typeof(List<ConviteFamiliaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListarPendentes()
    {
        return Ok(await _conviteService.ListarPendentesAsync(GetUserId()));
    }

    /// <summary>Aceita um convite pelo token. Entra na família como membro.</summary>
    [HttpPost("{token}/aceitar")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Aceitar(string token)
    {
        await _conviteService.AceitarAsync(token, GetUserId());
        return NoContent();
    }

    /// <summary>Recusa um convite pelo token.</summary>
    [HttpPost("{token}/recusar")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Recusar(string token)
    {
        await _conviteService.RecusarAsync(token, GetUserId());
        return NoContent();
    }
}

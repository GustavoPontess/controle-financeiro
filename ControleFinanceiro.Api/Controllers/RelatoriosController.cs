using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ControleFinanceiro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RelatoriosController : ControllerBase
{
    private readonly RelatorioService _service;

    public RelatoriosController(RelatorioService service)
    {
        _service = service;
    }

    private Guid GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !Guid.TryParse(claim.Value, out var userId))
            throw new UnauthorizedAccessException("Usuário não identificado");
        return userId;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRelatorio([FromQuery] int? ano)
    {
        var usuarioId = GetUserId();
        var resultado = await _service.GetRelatorioAsync(usuarioId, ano ?? DateTime.Now.Year);
        return Ok(resultado);
    }
}

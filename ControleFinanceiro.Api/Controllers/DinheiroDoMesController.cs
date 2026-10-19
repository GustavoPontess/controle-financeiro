using System.Security.Claims;
using ControleFinanceiro.Api.DTOs.DinheiroDoMes;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControleFinanceiro.Api.Controllers;

/// <summary>O dinheiro do mês da pessoa: renda, o que já saiu, o que ainda vem e a resposta "vai dar?".</summary>
[ApiController]
[Route("api/dinheiro-do-mes")]
[Authorize]
public class DinheiroDoMesController : ControllerBase
{
    private readonly DinheiroDoMesService _service;

    public DinheiroDoMesController(DinheiroDoMesService service)
    {
        _service = service;
    }

    /// <summary>O mês (ano, mês): a renda como total, o que já saiu por categoria, o que ainda vem e a resposta.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(DinheiroDoMesDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> DoMes([FromQuery] int ano, [FromQuery] int mes)
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(claim, out var usuarioId))
            throw new UnauthorizedAccessException("Usuário não identificado.");
        return Ok(await _service.CalcularAsync(usuarioId, ano, mes));
    }
}

using System.Security.Claims;
using ControleFinanceiro.Api.DTOs.Orcamento;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControleFinanceiro.Api.Controllers;

/// <summary>O orçamento do mês: a renda esperada distribuída entre as despesas planejadas e as metas.</summary>
[ApiController]
[Route("api/orcamento-do-mes")]
[Authorize]
public class OrcamentoDoMesController : ControllerBase
{
    private readonly OrcamentoDoMesService _service;

    public OrcamentoDoMesController(OrcamentoDoMesService service)
    {
        _service = service;
    }

    /// <summary>O mês (ano, mês): renda esperada e recebida, despesas planejadas e gastas, o que as metas pedem, o
    /// "a ser alocado" e a resposta.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(OrcamentoDoMesDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> DoMes([FromQuery] int ano, [FromQuery] int mes)
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(claim, out var usuarioId))
            throw new UnauthorizedAccessException("Usuário não identificado.");
        return Ok(await _service.CalcularAsync(usuarioId, ano, mes));
    }
}

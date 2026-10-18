using System.Security.Claims;
using ControleFinanceiro.Api.DTOs.Renda;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControleFinanceiro.Api.Controllers;

/// <summary>
/// Renda da pessoa (docs/features/familia/renda-e-visibilidade.md): o que entrou no mês (fato) e o que ela
/// esperava (contas fixas de receita + variável esperada). Dado pessoal: só o dono lê e escreve.
/// </summary>
[ApiController]
[Route("api/renda")]
[Authorize]
public class RendaController : ControllerBase
{
    private readonly RendaService _service;

    public RendaController(RendaService service)
    {
        _service = service;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>O mês: previsto (fixas + variável esperada), recebido, o que falta e as entradas.</summary>
    [HttpGet("mes")]
    [ProducesResponseType(typeof(RendaMesDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<RendaMesDto>> ObterMes([FromQuery] int ano, [FromQuery] int mes)
        => Ok(await _service.ObterMesAsync(UserId, ano, mes));

    /// <summary>Define a renda variável esperada do mês (null apaga: volta a valer a do último mês que tem).</summary>
    [HttpPut("mes")]
    [ProducesResponseType(typeof(RendaMesDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<RendaMesDto>> DefinirVariavelEsperada([FromBody] DefinirVariavelEsperadaDto dto)
        => Ok(await _service.DefinirVariavelEsperadaAsync(UserId, dto));
}

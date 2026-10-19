using ControleFinanceiro.Api.DTOs.Orcamento;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ControleFinanceiro.Api.Controllers;

/// <summary>
/// Limites de gasto por categoria (tela Limites). Um limite vale todo mês até a pessoa mudar; mudar ou tirar vale
/// do mês em diante (mês passado fica como estava).
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrcamentosController : ControllerBase
{
    private readonly OrcamentoService _service;

    public OrcamentosController(OrcamentoService service)
    {
        _service = service;
    }

    private Guid GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !Guid.TryParse(claim.Value, out var id))
            throw new UnauthorizedAccessException("Usuário não identificado.");
        return id;
    }

    /// <summary>
    /// Limites que valem no mês, com o gasto (inclui a parcela do mês das compras parceladas) e o previsto, mais as
    /// categorias que gastaram sem limite.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(LimitesDoMesDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> DoMes([FromQuery] int ano, [FromQuery] int mes) =>
        Ok(await _service.DoMesAsync(GetUserId(), ano, mes));

    /// <summary>Média do gasto da categoria nos 3 meses antes do mês (pra sugerir o limite).</summary>
    [HttpGet("sugestao")]
    [ProducesResponseType(typeof(SugestaoLimiteDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Sugestao([FromQuery] Guid? categoriaId, [FromQuery] int ano, [FromQuery] int mes) =>
        Ok(await _service.SugestaoAsync(GetUserId(), categoriaId, ano, mes));

    /// <summary>Põe ou muda o limite da categoria do mês em diante. Devolve o mês atualizado.</summary>
    [HttpPut]
    [ProducesResponseType(typeof(LimitesDoMesDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Definir([FromBody] DefinirLimiteDto dto) =>
        Ok(await _service.DefinirAsync(dto, GetUserId()));

    /// <summary>Tira o limite da categoria do mês em diante (sem <c>categoriaId</c> = o de todos os gastos).</summary>
    [HttpDelete]
    [ProducesResponseType(typeof(LimitesDoMesDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Tirar([FromQuery] Guid? categoriaId, [FromQuery] int ano, [FromQuery] int mes) =>
        Ok(await _service.TirarAsync(categoriaId, ano, mes, GetUserId()));
}

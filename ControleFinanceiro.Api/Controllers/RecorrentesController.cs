using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.DTOs.Recorrente;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RecorrentesController : ControllerBase
{
    private readonly RecorrenteService _service;

    public RecorrentesController(RecorrenteService service)
    {
        _service = service;
    }

    private Guid GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !Guid.TryParse(claim.Value, out var id))
            throw new UnauthorizedAccessException("Usuário não identificado");
        return id;
    }

    /// <summary>
    /// Lista paginada das contas fixas. `status` opcional: "ativas" (ativas + pausadas) ou
    /// "encerradas" (canceladas + data fim passada); sem ele, todas. `busca` opcional filtra por
    /// descrição/categoria/conta/cartão. Filtro e busca são server-side (o total já vem filtrado).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<RecorrenteDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Listar(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 25,
        [FromQuery] string? status = null, [FromQuery] string? busca = null)
    {
        var uid = GetUserId();
        await _service.GerarPendentesAsync(uid);
        var resultado = await _service.ListarAsync(uid, page, pageSize, status, busca);
        return Ok(resultado);
    }

    /// <summary>KPIs agregados — ativas, custo mensal, próximas 30 dias, total.</summary>
    [HttpGet("stats")]
    [ProducesResponseType(typeof(RecorrenteStatsDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObterStats()
    {
        var stats = await _service.ObterStatsAsync(GetUserId());
        return Ok(stats);
    }

    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CriarRecorrenteDto dto)
    {
        var uid = GetUserId();
        var result = await _service.CriarAsync(dto, uid);
        return CreatedAtAction(nameof(Listar), null, result);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Atualizar(Guid id, [FromBody] CriarRecorrenteDto dto)
    {
        var uid = GetUserId();
        await _service.AtualizarAsync(id, dto, uid);
        return NoContent();
    }

    /// <summary>
    /// Pausa ou retoma a conta fixa. <c>?ativo=false</c> pausa e <c>?ativo=true</c> retoma — já no estado pedido,
    /// não faz nada (duplo clique não desfaz). Sem o parâmetro, inverte.
    /// </summary>
    [HttpPatch("{id}/toggle")]
    public async Task<IActionResult> ToggleAtivo(Guid id, [FromQuery] bool? ativo = null)
    {
        var uid = GetUserId();
        await _service.ToggleAtivoAsync(id, uid, ativo);
        return NoContent();
    }

    [HttpPost("{id}/cancelar")]
    public async Task<IActionResult> Cancelar(Guid id, [FromBody] CancelarRecorrenteDto dto)
    {
        var uid = GetUserId();
        var result = await _service.CancelarAsync(id, dto, uid);
        return Ok(result);
    }

    [HttpPatch("{id}/proxima")]
    public async Task<IActionResult> EditarProxima(Guid id, [FromBody] EditarProximaOcorrenciaDto dto)
    {
        var uid = GetUserId();
        await _service.EditarProximaOcorrenciaAsync(id, dto, uid);
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Deletar(Guid id)
    {
        var uid = GetUserId();
        await _service.DeletarAsync(id, uid);
        return NoContent();
    }
}

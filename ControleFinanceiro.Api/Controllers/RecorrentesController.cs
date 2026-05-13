using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.DTOs.Recorrente;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

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

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<RecorrenteDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Listar([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var uid = GetUserId();
        await _service.GerarPendentesAsync(uid);
        var resultado = await _service.ListarAsync(uid, page, pageSize);
        return Ok(resultado);
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

    [HttpPatch("{id}/toggle")]
    public async Task<IActionResult> ToggleAtivo(Guid id)
    {
        var uid = GetUserId();
        await _service.ToggleAtivoAsync(id, uid);
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

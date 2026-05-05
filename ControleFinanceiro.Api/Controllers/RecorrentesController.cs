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
    public async Task<IActionResult> Listar()
    {
        var uid = GetUserId();
        await _service.GerarPendentesAsync(uid);
        var lista = await _service.ListarAsync(uid);
        return Ok(lista);
    }

    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CriarRecorrenteDto dto)
    {
        try
        {
            var uid = GetUserId();
            var result = await _service.CriarAsync(dto, uid);
            return CreatedAtAction(nameof(Listar), null, result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { mensagem = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Atualizar(Guid id, [FromBody] CriarRecorrenteDto dto)
    {
        try
        {
            var uid = GetUserId();
            await _service.AtualizarAsync(id, dto, uid);
            return NoContent();
        }
        catch (Exception ex)
        {
            return BadRequest(new { mensagem = ex.Message });
        }
    }

    [HttpPatch("{id}/toggle")]
    public async Task<IActionResult> ToggleAtivo(Guid id)
    {
        try
        {
            var uid = GetUserId();
            await _service.ToggleAtivoAsync(id, uid);
            return NoContent();
        }
        catch (Exception ex)
        {
            return BadRequest(new { mensagem = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Deletar(Guid id)
    {
        try
        {
            var uid = GetUserId();
            await _service.DeletarAsync(id, uid);
            return NoContent();
        }
        catch (Exception ex)
        {
            return BadRequest(new { mensagem = ex.Message });
        }
    }
}

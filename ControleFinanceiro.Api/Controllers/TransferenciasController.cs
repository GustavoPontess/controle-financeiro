using ControleFinanceiro.Api.DTOs.Transferencia;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ControleFinanceiro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TransferenciasController : ControllerBase
{
    private readonly TransferenciaService _service;

    public TransferenciasController(TransferenciaService service)
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
    [ProducesResponseType(typeof(List<TransferenciaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Listar()
    {
        var usuarioId = GetUserId();
        var lista = await _service.ListarAsync(usuarioId);
        return Ok(lista);
    }

    [HttpPost]
    [ProducesResponseType(typeof(TransferenciaDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Criar([FromBody] CriarTransferenciaDto dto)
    {
        try
        {
            var usuarioId = GetUserId();
            var resultado = await _service.CriarAsync(dto, usuarioId);
            return CreatedAtAction(nameof(Listar), resultado);
        }
        catch (Exception ex)
        {
            return BadRequest(new { mensagem = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Deletar(Guid id)
    {
        try
        {
            var usuarioId = GetUserId();
            await _service.DeletarAsync(id, usuarioId);
            return NoContent();
        }
        catch (Exception ex)
        {
            return BadRequest(new { mensagem = ex.Message });
        }
    }
}

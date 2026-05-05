using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ControleFinanceiro.Api.DTOs.CartaoCredito;
using ControleFinanceiro.Api.Services;
using System.Security.Claims;

namespace ControleFinanceiro.Api.Controllers;

[ApiController]
[Route("api/cartoes")]
[Authorize]
public class CartoesCreditoController(CartaoCreditoService service) : ControllerBase
{
    private readonly CartaoCreditoService _service = service;

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Listar()
    {
        var result = await _service.ListarAsync(UserId);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Buscar(Guid id)
    {
        var result = await _service.BuscarPorIdAsync(id, UserId);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CriarCartaoCreditoDto dto)
    {
        try
        {
            var result = await _service.CriarAsync(dto, UserId);
            return CreatedAtAction(nameof(Buscar), new { id = result.Id }, result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { mensagem = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Atualizar(Guid id, [FromBody] CriarCartaoCreditoDto dto)
    {
        try
        {
            var ok = await _service.AtualizarAsync(id, dto, UserId);
            return ok ? NoContent() : NotFound();
        }
        catch (Exception ex)
        {
            return BadRequest(new { mensagem = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Deletar(Guid id)
    {
        try
        {
            var ok = await _service.DeletarAsync(id, UserId);
            return ok ? NoContent() : NotFound();
        }
        catch (Exception ex)
        {
            return BadRequest(new { mensagem = ex.Message });
        }
    }
}

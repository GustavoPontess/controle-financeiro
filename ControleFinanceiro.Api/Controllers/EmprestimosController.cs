using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.DTOs.Emprestimo;
using ControleFinanceiro.Api.Services;
using System.Security.Claims;

namespace ControleFinanceiro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EmprestimosController(EmprestimoService service) : ControllerBase
{
    private readonly EmprestimoService _service = service;

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<EmprestimoDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Listar([FromQuery] int page = 1, [FromQuery] int pageSize = 25)
    {
        var result = await _service.ListarAsync(UserId, page, pageSize);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Buscar(Guid id)
    {
        var result = await _service.BuscarPorIdAsync(id, UserId);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CriarEmprestimoDto dto)
    {
        var result = await _service.CriarAsync(dto, UserId);
        return CreatedAtAction(nameof(Buscar), new { id = result.Id }, result);
    }

    [HttpPatch("{id:guid}/pagamento")]
    public async Task<IActionResult> RegistrarPagamento(Guid id, [FromBody] PagamentoDto dto)
    {
        var ok = await _service.RegistrarPagamentoAsync(id, dto.Valor, UserId);
        return ok ? NoContent() : NotFound();
    }

    [HttpPatch("{id:guid}/quitar")]
    public async Task<IActionResult> Quitar(Guid id)
    {
        var ok = await _service.QuitarAsync(id, UserId);
        return ok ? NoContent() : NotFound();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Deletar(Guid id)
    {
        var ok = await _service.DeletarAsync(id, UserId);
        return ok ? NoContent() : NotFound();
    }
}

public record PagamentoDto(decimal Valor);

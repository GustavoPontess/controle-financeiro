using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ControleFinanceiro.Api.DTOs.CartaoCredito;
using ControleFinanceiro.Api.Services;
using System.Security.Claims;

namespace ControleFinanceiro.Api.Controllers;

[ApiController]
[Route("api/cartoes")]
[Authorize]
public class CartoesCreditoController(CartaoCreditoService service, ContaFixaDoCartaoService contaFixa) : ControllerBase
{
    private readonly CartaoCreditoService _service = service;

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>
    /// Cobranças que se repetem no cartão (3+ faturas seguidas, valor parecido) e ainda não são conta fixa: o app só
    /// sugere; aceitar abre Nova conta fixa preenchida.
    /// </summary>
    [HttpGet("{id:guid}/sugestoes-conta-fixa")]
    [ProducesResponseType(typeof(List<SugestaoContaFixaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SugestoesContaFixa(Guid id) => Ok(await contaFixa.SugestoesAsync(id, UserId));

    /// <summary>"Não é conta fixa": a sugestão desse lugar não volta nesse cartão.</summary>
    [HttpPost("{id:guid}/sugestoes-conta-fixa/dispensar")]
    public async Task<IActionResult> DispensarSugestao(Guid id, [FromBody] DispensarSugestaoDto dto)
    {
        await contaFixa.DispensarAsync(id, UserId, dto.Chave);
        return NoContent();
    }

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
        var result = await _service.CriarAsync(dto, UserId);
        return CreatedAtAction(nameof(Buscar), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Atualizar(Guid id, [FromBody] CriarCartaoCreditoDto dto)
    {
        var ok = await _service.AtualizarAsync(id, dto, UserId);
        return ok ? NoContent() : NotFound();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Deletar(Guid id)
    {
        var ok = await _service.DeletarAsync(id, UserId);
        return ok ? NoContent() : NotFound();
    }
}

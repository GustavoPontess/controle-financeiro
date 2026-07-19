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

    /// <summary>KPIs agregados — a receber, a pagar, ativos e total.</summary>
    [HttpGet("stats")]
    [ProducesResponseType(typeof(EmprestimoStatsDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObterStats()
    {
        var stats = await _service.ObterStatsAsync(UserId);
        return Ok(stats);
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

    /// <summary>Propõe vínculo bilateral por e-mail. Resposta sempre igual (anti-enumeração) —
    /// o link só volta pra quem chamou, pra copiar/compartilhar por fora.</summary>
    [HttpPost("{id:guid}/vincular")]
    [ProducesResponseType(typeof(EmprestimoConviteResultadoDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Vincular(Guid id, [FromBody] VincularEmprestimoDto dto)
    {
        var resultado = await _service.VincularAsync(id, dto, UserId);
        return Ok(resultado);
    }

    /// <summary>Convites de vínculo pendentes pro usuário logado (por e-mail, igual convite de família).</summary>
    [HttpGet("convites-pendentes")]
    [ProducesResponseType(typeof(List<EmprestimoConvitePendenteDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListarConvitesPendentes()
    {
        var pendentes = await _service.ListarConvitesPendentesAsync(UserId);
        return Ok(pendentes);
    }

    [HttpPost("convites/{token}/aceitar")]
    public async Task<IActionResult> AceitarVinculo(string token)
    {
        await _service.AceitarVinculoAsync(token, UserId);
        return NoContent();
    }

    [HttpPost("convites/{token}/recusar")]
    public async Task<IActionResult> RecusarVinculo(string token)
    {
        await _service.RecusarVinculoAsync(token, UserId);
        return NoContent();
    }
}

public record PagamentoDto(decimal Valor);

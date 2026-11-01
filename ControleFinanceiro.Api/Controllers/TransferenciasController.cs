using ControleFinanceiro.Api.DTOs.Common;
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

    /// <summary>
    /// Lista paginada das transferências, mais recentes primeiro. `busca` opcional filtra
    /// (server-side) por descrição ou nome da conta de origem/destino.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<TransferenciaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Listar(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 25, [FromQuery] string? busca = null,
        [FromQuery] decimal? valorMin = null, [FromQuery] decimal? valorMax = null,
        [FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null)
    {
        var usuarioId = GetUserId();
        var resultado = await _service.ListarAsync(usuarioId, page, pageSize, busca, valorMin, valorMax, from, to);
        return Ok(resultado);
    }

    /// <summary>KPIs agregados — total movimentado e quantidade no filtro.</summary>
    [HttpGet("stats")]
    [ProducesResponseType(typeof(TransferenciaStatsDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObterStats(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        var stats = await _service.ObterStatsAsync(GetUserId(), from, to);
        return Ok(stats);
    }

    [HttpPost]
    [ProducesResponseType(typeof(TransferenciaDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Criar(
        [FromBody] CriarTransferenciaDto dto,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey)
    {
        var usuarioId = GetUserId();
        var resultado = await _service.CriarAsync(dto, usuarioId, idempotencyKey);
        return CreatedAtAction(nameof(Listar), resultado);
    }

    /// <summary>
    /// Edita a transferência inteira: o mesmo corpo e a mesma conferência de criar (regra do formulário). As duas
    /// pernas mudam juntas.
    /// </summary>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(TransferenciaDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Editar(Guid id, [FromBody] CriarTransferenciaDto dto) =>
        Ok(await _service.EditarAsync(id, dto, GetUserId()));

    /// <summary>A transferência de uma perna (a tela da transação abre a edição por ela).</summary>
    [HttpGet("da-transacao/{transacaoId}")]
    [ProducesResponseType(typeof(TransferenciaDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ObterPelaPerna(Guid transacaoId) =>
        Ok(await _service.ObterPelaPernaAsync(transacaoId, GetUserId()));

    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Deletar(Guid id)
    {
        var usuarioId = GetUserId();
        await _service.DeletarAsync(id, usuarioId);
        return NoContent();
    }
}

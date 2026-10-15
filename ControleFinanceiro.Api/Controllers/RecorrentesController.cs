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

    /// <summary>
    /// Uma conta fixa, com situação (ativa/pausada/cancelada/encerrada) e próxima cobrança — o que a
    /// página dela mostra. Excluída ou inexistente → 404.
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(RecorrenteDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Obter(Guid id)
    {
        var uid = GetUserId();
        await _service.GerarPendentesAsync(uid);
        return Ok(await _service.ObterAsync(id, uid));
    }

    /// <summary>KPIs agregados — ativas, custo mensal, próximas 30 dias, total.</summary>
    [HttpGet("stats")]
    [ProducesResponseType(typeof(RecorrenteStatsDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObterStats()
    {
        var stats = await _service.ObterStatsAsync(GetUserId());
        return Ok(stats);
    }

    /// <summary>
    /// Cria a conta fixa (e as previsões dos próximos 3 meses). Requer header Idempotency-Key (UUID por
    /// abertura do formulário): repetir a mesma chave devolve a conta fixa original em vez de criar outra;
    /// a mesma chave com outros dados → 409.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(RecorrenteDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Criar(
        [FromBody] CriarRecorrenteDto dto,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey)
    {
        var uid = GetUserId();
        // Obrigatória aqui (não no service): criar gera previsões que o job efetiva — sem chave, um duplo
        // clique ou retry de rede criava a conta fixa (e as cobranças) 2x. Chamadas internas não passam.
        if (string.IsNullOrWhiteSpace(idempotencyKey))
            throw new ArgumentException("O header Idempotency-Key é obrigatório para criar uma conta fixa.");
        var result = await _service.CriarAsync(dto, uid, idempotencyKey);
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

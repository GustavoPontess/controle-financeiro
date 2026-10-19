using ControleFinanceiro.Api.DTOs.Meta;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ControleFinanceiro.Api.Controllers;

/// <summary>
/// Gerencia metas financeiras individuais e conjuntas.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MetasController : ControllerBase
{
    private readonly MetaService _service;

    public MetasController(MetaService service)
    {
        _service = service;
    }

    private Guid GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !Guid.TryParse(claim.Value, out var id))
            throw new UnauthorizedAccessException("Usuário não identificado.");
        return id;
    }

    /// <summary>
    /// Lista metas ativas (pessoais + familiares) do usuário autenticado.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<MetaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Listar([FromQuery] bool pessoais = false)
    {
        var resultado = await _service.ListarAsync(GetUserId(), pessoais);
        return Ok(resultado);
    }

    /// <summary>Guardou e resgatou (as transferências da caixinha), do mais recente pro mais antigo.</summary>
    [HttpGet("{id:guid}/historico")]
    [ProducesResponseType(typeof(List<MetaHistoricoDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Historico(Guid id) => Ok(await _service.HistoricoAsync(id, GetUserId()));

    /// <summary>
    /// Obtém uma meta pelo ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(MetaDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Obter(Guid id)
    {
        var resultado = await _service.ObterAsync(id, GetUserId());
        return Ok(resultado);
    }

    /// <summary>
    /// Cria uma nova meta financeira.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(MetaDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Criar([FromBody] CriarMetaDto dto)
    {
        var resultado = await _service.CriarAsync(dto, GetUserId());
        return CreatedAtAction(nameof(Obter), new { id = resultado.Id }, resultado);
    }

    /// <summary>
    /// Atualiza dados de uma meta (somente o criador).
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(MetaDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Atualizar(Guid id, [FromBody] CriarMetaDto dto)
    {
        var resultado = await _service.AtualizarAsync(id, dto, GetUserId());
        return Ok(resultado);
    }

    /// <summary>
    /// Guarda: transfere da conta da pessoa pra caixinha da meta (o saldo da conta cai). Não passa do saldo.
    /// Exige o header Idempotency-Key (o mesmo nas tentativas).
    /// </summary>
    [HttpPost("{id:guid}/guardar")]
    [ProducesResponseType(typeof(MetaDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Guardar(Guid id, [FromBody] MovimentoMetaDto dto,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey) =>
        Ok(await _service.GuardarAsync(id, dto, GetUserId(), idempotencyKey));

    /// <summary>
    /// Resgata: transfere da caixinha da meta de volta pra uma conta da pessoa. Não passa do guardado.
    /// Exige o header Idempotency-Key.
    /// </summary>
    [HttpPost("{id:guid}/resgatar")]
    [ProducesResponseType(typeof(MetaDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Resgatar(Guid id, [FromBody] MovimentoMetaDto dto,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey) =>
        Ok(await _service.ResgatarAsync(id, dto, GetUserId(), idempotencyKey));

    /// <summary>
    /// Conclui a meta que chegou lá e leva o guardado todo pra uma conta (uma transferência). A meta fica em
    /// Concluídas com o histórico; a caixinha é encerrada. Exige o header Idempotency-Key.
    /// </summary>
    [HttpPost("{id:guid}/concluir")]
    [ProducesResponseType(typeof(MetaDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Concluir(Guid id, [FromBody] ConcluirMetaDto dto,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey) =>
        Ok(await _service.ConcluirAsync(id, dto, GetUserId(), idempotencyKey));

    /// <summary>Desfaz a conclusão: a meta volta pra Em andamento (a caixinha reabre, vazia).</summary>
    [HttpPost("{id:guid}/reabrir")]
    [ProducesResponseType(typeof(MetaDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Reabrir(Guid id) => Ok(await _service.ReabrirAsync(id, GetUserId()));

    /// <summary>
    /// Inativa (soft delete) uma meta (somente o criador).
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Excluir(Guid id)
    {
        await _service.ExcluirAsync(id, GetUserId());
        return NoContent();
    }
}

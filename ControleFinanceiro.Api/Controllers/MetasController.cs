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
    public async Task<IActionResult> Listar()
    {
        var resultado = await _service.ListarAsync(GetUserId());
        return Ok(resultado);
    }

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
    /// Adiciona uma contribuição ao progresso da meta.
    /// </summary>
    [HttpPost("{id:guid}/contribuir")]
    [ProducesResponseType(typeof(MetaDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Contribuir(Guid id, [FromBody] ContribuirMetaDto dto)
    {
        var resultado = await _service.ContribuirAsync(id, dto, GetUserId());
        return Ok(resultado);
    }

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

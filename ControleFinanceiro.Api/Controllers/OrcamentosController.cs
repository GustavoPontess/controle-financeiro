using ControleFinanceiro.Api.DTOs.Orcamento;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ControleFinanceiro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrcamentosController : ControllerBase
{
    private readonly OrcamentoService _service;

    public OrcamentosController(OrcamentoService service)
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
    /// Lista orçamentos do mês/ano com situação atual de consumo e alertas.
    /// </summary>
    /// <param name="mes">Mês de referência (1–12). Padrão: mês atual.</param>
    /// <param name="ano">Ano de referência. Padrão: ano atual.</param>
    [HttpGet]
    [ProducesResponseType(typeof(List<OrcamentoDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Listar(
        [FromQuery] int? mes = null,
        [FromQuery] int? ano = null)
    {
        var usuarioId = GetUserId();
        var agora = DateTime.Now;
        var resultado = await _service.ListarAsync(usuarioId, mes ?? agora.Month, ano ?? agora.Year);
        return Ok(resultado);
    }

    /// <summary>
    /// Cria um novo orçamento mensal por categoria.
    /// Apenas 1 orçamento por (categoria + mês + ano) por usuário.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(OrcamentoDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Criar([FromBody] CriarOrcamentoDto dto)
    {
        var usuarioId = GetUserId();
        var resultado = await _service.CriarAsync(dto, usuarioId);
        return CreatedAtAction(nameof(Listar), new { mes = dto.Mes, ano = dto.Ano }, resultado);
    }

    /// <summary>
    /// Atualiza limite e percentual de alerta de um orçamento existente.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(OrcamentoDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Atualizar(Guid id, [FromBody] CriarOrcamentoDto dto)
    {
        var usuarioId = GetUserId();
        var resultado = await _service.AtualizarAsync(id, dto, usuarioId);
        return Ok(resultado);
    }

    /// <summary>
    /// Remove um orçamento.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Deletar(Guid id)
    {
        var usuarioId = GetUserId();
        await _service.DeletarAsync(id, usuarioId);
        return NoContent();
    }
}

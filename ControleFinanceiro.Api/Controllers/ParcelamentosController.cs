using System.Security.Claims;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.DTOs.Parcelamento;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControleFinanceiro.Api.Controllers;

/// <summary>
/// Operações com parcelamentos (CompraParcelada, PIXCredito).
/// Spec: ARQUITETURA_PARCELAMENTO.md § "Fluxos 1 (Criar), 3 (Cancelar)".
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ParcelamentosController : ControllerBase
{
    private readonly ParcelamentoService _service;

    public ParcelamentosController(ParcelamentoService service)
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
    /// Listar todos os parcelamentos ativos do usuário.
    /// </summary>
    /// <param name="ativo">Filtro opcional (null = ambos).</param>
    /// <param name="page">Página atual (base 1, padrão 1).</param>
    /// <param name="pageSize">Itens por página (1–100, padrão 20).</param>
    /// <returns>Resultado paginado de parcelamentos com próxima parcela.</returns>
    /// <response code="200">Lista retornada.</response>
    /// <response code="401">Não autenticado.</response>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<ParcelamentoDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Listar([FromQuery] bool? ativo = null, [FromQuery] int page = 1, [FromQuery] int pageSize = 25)
    {
        var usuarioId = GetUserId();
        var parcelamentos = await _service.ListarAsync(usuarioId, ativo, page, pageSize);
        return Ok(parcelamentos);
    }

    /// <summary>
    /// Detalhe de um parcelamento com todas as parcelas.
    /// </summary>
    /// <param name="id">ID do parcelamento.</param>
    /// <returns>Parcelamento com array de parcelas detalhadas.</returns>
    /// <response code="200">Encontrado.</response>
    /// <response code="404">Não encontrado.</response>
    /// <response code="401">Não autenticado.</response>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ParcelamentoDetalheDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Detalhe(Guid id)
    {
        var usuarioId = GetUserId();
        var detalhe = await _service.ObterDetalheAsync(id, usuarioId);
        return Ok(detalhe);
    }

    /// <summary>
    /// Criar um novo parcelamento (CompraParcelada ou PIXCredito).
    /// Requer header Idempotency-Key (UUID gerado no cliente).
    /// </summary>
    /// <param name="dto">Descrição, valor, tipo, cartão, datas, parcelas, taxa (PIX), categoria, idempotencyKey.</param>
    /// <returns>Parcelamento criado com detalhe de parcelas.</returns>
    /// <response code="201">Criado.</response>
    /// <response code="400">Validação falhou (limite insuficiente, datas inválidas, etc).</response>
    /// <response code="401">Não autenticado.</response>
    [HttpPost]
    [ProducesResponseType(typeof(ParcelamentoDetalheDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Criar([FromBody] CriarParcelamentoDto dto)
    {
        var usuarioId = GetUserId();
        var resultado = await _service.CriarAsync(dto, usuarioId);
        return CreatedAtAction(nameof(Detalhe), new { id = resultado.Id }, resultado);
    }

    /// <summary>
    /// Cancelar um parcelamento (soft delete).
    /// Parcelas pagas são preservadas; UI sugere estorno se requerEstorno=true.
    /// Requer header Idempotency-Key.
    /// </summary>
    /// <param name="id">ID do parcelamento.</param>
    /// <param name="dto">Motivo do cancelamento + idempotencyKey.</param>
    /// <returns>Resultado do cancelamento (quantas canceladas, quantas pagas, novo limite).</returns>
    /// <response code="200">Cancelado.</response>
    /// <response code="400">Validação falhou (não ativo, motivo vazio, etc).</response>
    /// <response code="401">Não autenticado.</response>
    /// <response code="404">Parcelamento não encontrado.</response>
    [HttpPost("{id}/cancelar")]
    [ProducesResponseType(typeof(CancelamentoResultadoDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Cancelar(Guid id, [FromBody] CancelarParcelamentoDto dto)
    {
        var usuarioId = GetUserId();
        var resultado = await _service.CancelarAsync(id, dto, usuarioId);
        return Ok(resultado);
    }
}

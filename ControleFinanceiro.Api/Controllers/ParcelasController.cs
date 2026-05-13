using System.Security.Claims;
using ControleFinanceiro.Api.DTOs.Parcelamento;
using ControleFinanceiro.Api.DTOs.ParcelaTransacao;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControleFinanceiro.Api.Controllers;

/// <summary>
/// Operações com parcelas individuais (antecipação, cancelamento).
/// Spec: ARQUITETURA_PARCELAMENTO.md § "Fluxo 2 (Pagar Antecipado), Cancelar individual".
/// </summary>
[ApiController]
[Route("api/parcelas")]
[Authorize]
public class ParcelasController : ControllerBase
{
    private readonly ParcelaTransacaoService _service;

    public ParcelasController(ParcelaTransacaoService service)
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
    /// Antecipar o pagamento de uma parcela individual.
    /// Libera limite do cartão e marca parcela como Paga.
    /// Requer header Idempotency-Key.
    /// </summary>
    /// <param name="parcelaId">ID da parcela (ParcelaTransacao).</param>
    /// <param name="dto">Conta bancária de pagamento + data + idempotencyKey.</param>
    /// <returns>Resultado do pagamento (status, data, fatura atualizada, novo limite).</returns>
    /// <response code="200">Pago.</response>
    /// <response code="400">Validação falhou (saldo insuficiente, parcela não pendente, fatura inválida, etc).</response>
    /// <response code="401">Não autenticado.</response>
    /// <response code="404">Parcela não encontrada.</response>
    [HttpPost("{parcelaId}/pagar")]
    [ProducesResponseType(typeof(PagarParcelaResultadoDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> PagarAntecipado(Guid parcelaId, [FromBody] PagarParcelaDto dto)
    {
        var usuarioId = GetUserId();
        var resultado = await _service.PagarAntecipadoAsync(parcelaId, dto, usuarioId);
        return Ok(resultado);
    }

    /// <summary>
    /// Cancelar uma parcela individual (soft delete).
    /// Libera limite do cartão. Parcelamento continua ativo (apenas esta parcela cancela).
    /// Requer header Idempotency-Key.
    /// </summary>
    /// <param name="parcelaId">ID da parcela (ParcelaTransacao).</param>
    /// <param name="dto">Motivo + idempotencyKey.</param>
    /// <returns>Resultado do cancelamento (novo limite).</returns>
    /// <response code="200">Cancelada.</response>
    /// <response code="400">Validação falhou (não pendente, parcelamento inativo, etc).</response>
    /// <response code="401">Não autenticado.</response>
    /// <response code="404">Parcela não encontrada.</response>
    [HttpPost("{parcelaId}/cancelar")]
    [ProducesResponseType(typeof(LimiteSnapshotDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Cancelar(Guid parcelaId, [FromBody] CancelarParcelaDto dto)
    {
        var usuarioId = GetUserId();
        var resultado = await _service.CancelarAsync(parcelaId, dto, usuarioId);
        return Ok(resultado);
    }
}

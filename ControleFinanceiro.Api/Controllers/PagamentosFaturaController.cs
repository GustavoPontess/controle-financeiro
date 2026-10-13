using ControleFinanceiro.Api.DTOs.Fatura;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ControleFinanceiro.Api.Controllers;

/// <summary>
/// Ações sobre um pagamento de fatura já feito, pelo id do próprio pagamento (o lançamento na conta) —
/// a tela de Transações só conhece esse id, não o cartão nem a fatura.
/// </summary>
[ApiController]
[Route("api/faturas/pagamentos")]
[Authorize]
public class PagamentosFaturaController : ControllerBase
{
    private readonly FaturaService _service;

    public PagamentosFaturaController(FaturaService service)
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
    /// Estorna (desfaz) um pagamento de fatura: o dinheiro volta pra conta, a fatura volta a dever o valor e
    /// o limite volta a ser ocupado. Pagamento de parcela antecipada devolve a parcela pra Pendente (ou
    /// Cancelada, se o parcelamento foi cancelado). Requer header Idempotency-Key: repetir a mesma chave
    /// devolve o mesmo resultado sem estornar 2x. Sem chave → 400. Pagamento inexistente, de outro usuário
    /// ou que não é de fatura → 404 (mesma resposta). Já estornado, ou fatura alterada no meio → 409.
    /// </summary>
    [HttpPost("{pagamentoId}/estornar")]
    [ProducesResponseType(typeof(EstornoPagamentoResultadoDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Estornar(
        Guid pagamentoId,
        [FromBody] EstornarPagamentoDto? dto,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey)
    {
        var resultado = await _service.EstornarPagamentoAsync(
            pagamentoId, dto ?? new EstornarPagamentoDto(), GetUserId(), idempotencyKey);
        return Ok(resultado);
    }
}

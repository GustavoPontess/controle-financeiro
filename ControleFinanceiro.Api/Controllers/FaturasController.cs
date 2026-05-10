using ControleFinanceiro.Api.DTOs.Fatura;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ControleFinanceiro.Api.Controllers;

[ApiController]
[Route("api/cartoes/{cartaoCreditoId}/faturas")]
[Authorize]
public class FaturasController : ControllerBase
{
    private readonly FaturaService _service;

    public FaturasController(FaturaService service)
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
    /// Lista todas as faturas de um cartão, ordenadas da mais recente para a mais antiga.
    /// Cada fatura expõe 3 flags ortogonais em vez de enum monolítico (Status obsoleto):
    /// - EstadoCiclo (Aberta/Fechada): ciclo de cobrança.
    /// - EstadoPagamento (NaoPago/Parcial/Pago): andamento do pagamento.
    /// - EstaAtrasada (bool): vencida sem quitar (marcada pelo job FaturaAtrasoJob).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<FaturaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Listar(Guid cartaoCreditoId)
    {
        try
        {
            var usuarioId = GetUserId();
            var faturas = await _service.ListarPorCartaoAsync(cartaoCreditoId, usuarioId);
            return Ok(faturas);
        }
        catch (Exception ex)
        {
            return BadRequest(new { mensagem = ex.Message });
        }
    }

    /// <summary>
    /// Detalhe de uma fatura com todas as transações e parcelas do período.
    /// Expõe EstadoCiclo, EstadoPagamento, EstaAtrasada (3 flags em vez de Status obsoleto).
    /// Inclui FinancialEventLog audit trail de pagamentos/atrasos.
    /// </summary>
    [HttpGet("{faturaId}")]
    [ProducesResponseType(typeof(FaturaDetalheDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Detalhe(Guid cartaoCreditoId, Guid faturaId)
    {
        try
        {
            var usuarioId = GetUserId();
            var detalhe = await _service.DetalheAsync(faturaId, usuarioId);
            return Ok(detalhe);
        }
        catch (Exception ex)
        {
            return NotFound(new { mensagem = ex.Message });
        }
    }

    /// <summary>
    /// Paga uma fatura (total ou parcialmente).
    /// Cria uma transação de débito na conta informada.
    /// Atualiza EstadoPagamento (e possivelmente EstadoCiclo se pagamento total antecipado).
    /// Idempotência via header Idempotency-Key.
    /// </summary>
    [HttpPost("{faturaId}/pagar")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Pagar(Guid cartaoCreditoId, Guid faturaId, [FromBody] PagarFaturaDto dto)
    {
        try
        {
            var usuarioId = GetUserId();
            await _service.PagarFaturaAsync(faturaId, dto, usuarioId);
            return NoContent();
        }
        catch (Exception ex)
        {
            return BadRequest(new { mensagem = ex.Message });
        }
    }
}

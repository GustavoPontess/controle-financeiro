using ControleFinanceiro.Api.DTOs.Common;
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
        var usuarioId = GetUserId();
        var faturas = await _service.ListarPorCartaoAsync(cartaoCreditoId, usuarioId);
        return Ok(faturas);
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
        var usuarioId = GetUserId();
        var detalhe = await _service.DetalheAsync(faturaId, usuarioId);
        return Ok(detalhe);
    }

    /// <summary>
    /// Lançamentos da fatura numa lista só (compras à vista, parcelas e pagamentos), do mais recente
    /// pro mais antigo. Busca por texto (<paramref name="q"/>: descrição, categoria, meio do pagamento),
    /// filtro por <paramref name="tipo"/> ("compra" | "parcela" | "pagamento") e paginação
    /// (pageSize 1–100, padrão 25). Fatura inexistente ou de outra pessoa → 404.
    /// </summary>
    [HttpGet("{faturaId}/lancamentos")]
    [ProducesResponseType(typeof(PagedResult<LancamentoFaturaDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Lancamentos(Guid cartaoCreditoId, Guid faturaId,
        [FromQuery] string? q = null, [FromQuery] string? tipo = null, [FromQuery] int page = 1, [FromQuery] int pageSize = 25)
    {
        var usuarioId = GetUserId();
        var pagina = await _service.ListarLancamentosAsync(faturaId, usuarioId, q, tipo, page, pageSize);
        return Ok(pagina);
    }

    /// <summary>
    /// Paga uma fatura (total ou parcialmente).
    /// Cria uma transação de débito na conta informada.
    /// Atualiza EstadoPagamento (e possivelmente EstadoCiclo se pagamento total antecipado).
    /// Requer header Idempotency-Key (UUID gerado no cliente por tentativa de pagamento): repetir a
    /// mesma chave com os mesmos dados devolve 204 de novo sem pagar 2x; com OUTROS dados (conta,
    /// valor, data ou meio) → 409. Sem chave → 400. Fatura inexistente ou de outro usuário → 404
    /// (mesma resposta). Fatura alterada por outra operação no meio do pagamento → 409 (recarregar
    /// e tentar de novo).
    /// </summary>
    [HttpPost("{faturaId}/pagar")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Pagar(
        Guid cartaoCreditoId,
        Guid faturaId,
        [FromBody] PagarFaturaDto dto,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey)
    {
        var usuarioId = GetUserId();
        // Chave lida aqui e passada explícita (não via HttpContext.Items do IdempotencyAttribute
        // global): o service fica testável sem HTTP e a obrigatoriedade é validada nele.
        await _service.PagarFaturaAsync(faturaId, dto, usuarioId, idempotencyKey);
        return NoContent();
    }
}

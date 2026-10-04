using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ControleFinanceiro.Api.DTOs.Reconciliacao;
using ControleFinanceiro.Api.Services;
using System.Security.Claims;

namespace ControleFinanceiro.Api.Controllers;

/// <summary>
/// Reconciliação — marcos de saldo por conta. "Nesta conta, nesta data+hora, o saldo real era X."
/// Ancora a confiança no saldo. Ver docs/features/reconciliacao/spec.md.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReconciliacaoController(ReconciliacaoService service) : ControllerBase
{
    private readonly ReconciliacaoService _service = service;

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>Lista os marcos de uma conta (mais recente primeiro).</summary>
    [HttpGet("contas/{contaId:guid}/marcos")]
    public async Task<ActionResult<List<ReconciliacaoSaldoDto>>> Listar(Guid contaId)
        => Ok(await _service.ListarAsync(UserId, contaId));

    /// <summary>Saldo que o app calcula pra uma conta até uma data+hora (pra conferir antes de gravar).</summary>
    [HttpGet("contas/{contaId:guid}/saldo-calculado")]
    public async Task<ActionResult<object>> SaldoCalculado(Guid contaId, [FromQuery] DateTime dataHora)
        => Ok(new { saldoCalculado = await _service.CalcularSaldoAteAsync(UserId, contaId, dataHora) });

    /// <summary>
    /// Cria um marco. Requer header Idempotency-Key (UUID por tentativa): repetir a mesma chave
    /// devolve o mesmo marco, sem criar de novo.
    /// </summary>
    [HttpPost("marcos")]
    public async Task<ActionResult<ReconciliacaoSaldoDto>> Criar(
        [FromBody] CriarMarcoReconciliacaoDto dto,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey)
    {
        var marco = await _service.CriarMarcoAsync(UserId, dto, idempotencyKey ?? "");
        return CreatedAtAction(nameof(Listar), new { contaId = marco.ContaId }, marco);
    }

    /// <summary>
    /// Fecha a diferença de um marco já gravado: recalcula o saldo do app até a data do marco e, se
    /// ainda não bate, cria o lançamento de ajuste (no máximo um por marco). Se passou a bater (a
    /// pessoa lançou o que faltava), só atualiza o marco. Requer header Idempotency-Key.
    /// </summary>
    [HttpPost("marcos/{id:guid}/fechar")]
    public async Task<ActionResult<ReconciliacaoSaldoDto>> FecharDiferenca(
        Guid id,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey)
        => Ok(await _service.FecharDiferencaAsync(UserId, id, idempotencyKey ?? ""));

    /// <summary>Remove um marco (e cancela o lançamento de ajuste que ele criou, se houver).</summary>
    [HttpDelete("marcos/{id:guid}")]
    public async Task<IActionResult> Remover(Guid id)
    {
        await _service.RemoverAsync(UserId, id);
        return NoContent();
    }
}

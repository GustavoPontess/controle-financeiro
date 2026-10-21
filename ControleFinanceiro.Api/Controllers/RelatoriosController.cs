using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.DTOs.Relatorios;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ControleFinanceiro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RelatoriosController : ControllerBase
{
    private readonly RelatorioService _service;

    public RelatoriosController(RelatorioService service)
    {
        _service = service;
    }

    private Guid GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !Guid.TryParse(claim.Value, out var userId))
            throw new UnauthorizedAccessException("Usuário não identificado");
        return userId;
    }

    /// <summary>
    /// Relatório anual com evolução mensal e gastos por categoria.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(RelatorioMensalDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRelatorio([FromQuery] int? ano)
    {
        var usuarioId = GetUserId();
        var resultado = await _service.GetRelatorioAsync(usuarioId, ano ?? HorarioBrasil.Agora().Year);
        return Ok(resultado);
    }

    /// <summary>
    /// Relatório customizado por período com filtros opcionais.
    /// Retorna evolução diária, gastos por categoria e por meio de pagamento.
    /// </summary>
    /// <param name="dataInicio">Data de início do período (ex: 2026-01-01).</param>
    /// <param name="dataFim">Data de fim do período (ex: 2026-06-30). Máximo 2 anos.</param>
    /// <param name="categoriaId">Filtrar por categoria (opcional).</param>
    /// <param name="tipo">Filtrar por tipo: 0=Despesa, 1=Receita (opcional).</param>
    /// <param name="contaId">Filtrar por conta ou cartão (opcional).</param>
    [HttpGet("periodo")]
    [ProducesResponseType(typeof(RelatorioPeriodoDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetRelatorioPeriodo(
        [FromQuery] DateTime dataInicio,
        [FromQuery] DateTime dataFim,
        [FromQuery] Guid? categoriaId = null,
        [FromQuery] int? tipo = null,
        [FromQuery] Guid? contaId = null)
    {
        var usuarioId = GetUserId();
        var resultado = await _service.GetRelatorioPeriodoAsync(
            usuarioId, dataInicio, dataFim, categoriaId, tipo, contaId);
        return Ok(resultado);
    }

    /// <summary>
    /// Exporta transações do período em formato CSV (download direto).
    /// Aceita os mesmos filtros do endpoint /periodo.
    /// </summary>
    /// <param name="dataInicio">Data de início do período.</param>
    /// <param name="dataFim">Data de fim do período. Máximo 2 anos.</param>
    /// <param name="categoriaId">Filtrar por categoria (opcional).</param>
    /// <param name="tipo">Filtrar por tipo: 0=Despesa, 1=Receita (opcional).</param>
    /// <param name="contaId">Filtrar por conta ou cartão (opcional).</param>
    [HttpGet("export/csv")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ExportarCsv(
        [FromQuery] DateTime dataInicio,
        [FromQuery] DateTime dataFim,
        [FromQuery] Guid? categoriaId = null,
        [FromQuery] int? tipo = null,
        [FromQuery] Guid? contaId = null)
    {
        var usuarioId = GetUserId();
        var bytes = await _service.ExportarCsvAsync(
            usuarioId, dataInicio, dataFim, categoriaId, tipo, contaId);

        var nomeArquivo = $"transacoes_{dataInicio:yyyyMMdd}_{dataFim:yyyyMMdd}.csv";
        return File(bytes, "text/csv; charset=utf-8", nomeArquivo);
    }
}

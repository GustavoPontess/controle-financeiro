using System.Security.Claims;
using ControleFinanceiro.Api.DTOs.Solicitacao;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ControleFinanceiro.Api.Controllers;

/// <summary>Solicitações do beta: a pessoa aponta algo na tela e manda "algo errado" ou "melhoria". A lista é só do Admin.</summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SolicitacoesController : ControllerBase
{
    private readonly SolicitacaoService _service;

    public SolicitacoesController(SolicitacaoService service) => _service = service;

    private Guid GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !Guid.TryParse(claim.Value, out var id))
            throw new UnauthorizedAccessException("Usuário não identificado.");
        return id;
    }

    /// <summary>Manda uma solicitação (algo errado ou melhoria) com a tela e o bloco apontado.</summary>
    [HttpPost]
    [EnableRateLimiting("solicitacoes")]
    [RequestSizeLimit(9_500_000)] // até 5 anexos em base64
    [ProducesResponseType(typeof(MinhaSolicitacaoDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Criar([FromBody] CriarSolicitacaoDto dto)
    {
        var criada = await _service.CriarAsync(GetUserId(), dto);
        return StatusCode(StatusCodes.Status201Created, criada);
    }
}

using System.Security.Claims;
using ControleFinanceiro.Api.DTOs.Onboarding;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControleFinanceiro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OnboardingController : ControllerBase
{
    private readonly OnboardingService _onboardingService;

    public OnboardingController(OnboardingService onboardingService)
    {
        _onboardingService = onboardingService;
    }

    private Guid GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !Guid.TryParse(claim.Value, out var id))
            throw new UnauthorizedAccessException("Usuário não identificado.");
        return id;
    }

    /// <summary>Checklist do onboarding (passos concluídos e flag de conclusão).</summary>
    [HttpGet("status")]
    [ProducesResponseType(typeof(OnboardingStatusDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObterStatus()
    {
        return Ok(await _onboardingService.ObterStatusAsync(GetUserId()));
    }

    /// <summary>Marca o onboarding como concluído.</summary>
    [HttpPost("concluir")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Concluir()
    {
        await _onboardingService.ConcluirAsync(GetUserId());
        return NoContent();
    }
}

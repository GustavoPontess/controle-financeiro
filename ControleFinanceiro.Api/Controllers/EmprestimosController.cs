using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.DTOs.Emprestimo;
using ControleFinanceiro.Api.Services;
using System.Security.Claims;

namespace ControleFinanceiro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EmprestimosController(EmprestimoService service) : ControllerBase
{
    private readonly EmprestimoService _service = service;

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<EmprestimoDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Listar([FromQuery] int page = 1, [FromQuery] int pageSize = 25)
    {
        var result = await _service.ListarAsync(UserId, page, pageSize);
        return Ok(result);
    }

    /// <summary>KPIs agregados — a receber, a pagar, ativos e total.</summary>
    [HttpGet("stats")]
    [ProducesResponseType(typeof(EmprestimoStatsDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObterStats()
    {
        var stats = await _service.ObterStatsAsync(UserId);
        return Ok(stats);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Buscar(Guid id)
    {
        var result = await _service.BuscarPorIdAsync(id, UserId);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CriarEmprestimoDto dto)
    {
        var result = await _service.CriarAsync(dto, UserId);
        return CreatedAtAction(nameof(Buscar), new { id = result.Id }, result);
    }

    [HttpPatch("{id:guid}/quitar")]
    public async Task<IActionResult> Quitar(Guid id)
    {
        var ok = await _service.QuitarAsync(id, UserId);
        return ok ? NoContent() : NotFound();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Deletar(Guid id)
    {
        var ok = await _service.DeletarAsync(id, UserId);
        return ok ? NoContent() : NotFound();
    }

    /// <summary>Propõe vínculo bilateral por e-mail. Resposta sempre igual (anti-enumeração) —
    /// o link só volta pra quem chamou, pra copiar/compartilhar por fora.</summary>
    [HttpPost("{id:guid}/vincular")]
    [ProducesResponseType(typeof(EmprestimoConviteResultadoDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Vincular(Guid id, [FromBody] VincularEmprestimoDto dto)
    {
        var resultado = await _service.VincularAsync(id, dto, UserId);
        return Ok(resultado);
    }

    /// <summary>Convites de vínculo pendentes pro usuário logado (por e-mail, igual convite de família).</summary>
    [HttpGet("convites-pendentes")]
    [ProducesResponseType(typeof(List<EmprestimoConvitePendenteDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListarConvitesPendentes()
    {
        var pendentes = await _service.ListarConvitesPendentesAsync(UserId);
        return Ok(pendentes);
    }

    /// <summary>Pré-visualização do convite pelo token — landing pública /convite/emprestimo/:token,
    /// já autenticado. Mesmas checagens do aceite (token + e-mail), só leitura.</summary>
    [HttpGet("convites/{token}")]
    [ProducesResponseType(typeof(EmprestimoConvitePendenteDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObterConvitePorToken(string token)
    {
        var convite = await _service.ObterConvitePorTokenAsync(token, UserId);
        return Ok(convite);
    }

    [HttpPost("convites/{token}/aceitar")]
    public async Task<IActionResult> AceitarVinculo(string token)
    {
        await _service.AceitarVinculoAsync(token, UserId);
        return NoContent();
    }

    [HttpPost("convites/{token}/recusar")]
    public async Task<IActionResult> RecusarVinculo(string token)
    {
        await _service.RecusarVinculoAsync(token, UserId);
        return NoContent();
    }

    /// <summary>Aceite pela lista "convites pendentes" in-app — sem token (o token nunca fica
    /// recuperável; só o hash é persistido). Autenticação + e-mail batendo bastam.</summary>
    [HttpPost("{id:guid}/aceitar-vinculo")]
    public async Task<IActionResult> AceitarVinculoPorId(Guid id)
    {
        await _service.AceitarVinculoPorIdAsync(id, UserId);
        return NoContent();
    }

    [HttpPost("{id:guid}/recusar-vinculo")]
    public async Task<IActionResult> RecusarVinculoPorId(Guid id)
    {
        await _service.RecusarVinculoPorIdAsync(id, UserId);
        return NoContent();
    }

    /// <summary>Parcelas de um empréstimo Parcelado (vazio se AVista).</summary>
    [HttpGet("{id:guid}/parcelas")]
    [ProducesResponseType(typeof(List<EmprestimoParcelaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListarParcelas(Guid id)
    {
        var lista = await _service.ListarParcelasAsync(id, UserId);
        return Ok(lista);
    }

    // ── Pagamento com comprovante + aprovação ──────────────────────────────────

    /// <summary>Registra pagamento — devedor ou credor, mesmo endpoint (cria a Transacao real
    /// junto). Devedor: nasce Pendente. Credor: nasce já Aprovada.</summary>
    [HttpPost("{id:guid}/solicitar-pagamento")]
    [ProducesResponseType(typeof(EmprestimoPagamentoSolicitacaoDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> SolicitarPagamento(Guid id, [FromBody] SolicitarPagamentoEmprestimoDto dto)
    {
        var resultado = await _service.SolicitarPagamentoAsync(id, dto, UserId);
        return Ok(resultado);
    }

    /// <summary>Histórico de solicitações de pagamento de um empréstimo.</summary>
    [HttpGet("{id:guid}/solicitacoes")]
    [ProducesResponseType(typeof(List<EmprestimoPagamentoSolicitacaoDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListarSolicitacoes(Guid id)
    {
        var lista = await _service.ListarSolicitacoesAsync(id, UserId);
        return Ok(lista);
    }

    /// <summary>Solicitações de pagamento pendentes onde eu sou o credor.</summary>
    [HttpGet("solicitacoes-pendentes")]
    [ProducesResponseType(typeof(List<EmprestimoPagamentoSolicitacaoDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListarSolicitacoesPendentes()
    {
        var lista = await _service.ListarSolicitacoesPendentesAsync(UserId);
        return Ok(lista);
    }

    [HttpPost("solicitacoes/{solicitacaoId:guid}/aprovar")]
    public async Task<IActionResult> AprovarPagamento(Guid solicitacaoId, [FromBody] AprovarPagamentoEmprestimoDto dto)
    {
        var ok = await _service.AprovarPagamentoSolicitacaoAsync(solicitacaoId, dto, UserId);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("solicitacoes/{solicitacaoId:guid}/rejeitar")]
    public async Task<IActionResult> RejeitarPagamento(Guid solicitacaoId, [FromBody] RejeitarPagamentoEmprestimoDto? dto)
    {
        var ok = await _service.RejeitarPagamentoSolicitacaoAsync(solicitacaoId, dto ?? new RejeitarPagamentoEmprestimoDto(), UserId);
        return ok ? NoContent() : NotFound();
    }

    /// <summary>Devedor reenvia uma solicitação rejeitada — volta pra Pendente.</summary>
    [HttpPost("solicitacoes/{solicitacaoId:guid}/reenviar")]
    public async Task<IActionResult> ReenviarPagamento(Guid solicitacaoId)
    {
        var ok = await _service.ReenviarPagamentoSolicitacaoAsync(solicitacaoId, UserId);
        return ok ? NoContent() : NotFound();
    }
}


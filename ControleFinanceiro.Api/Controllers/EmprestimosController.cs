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
    public async Task<IActionResult> Listar(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 25, [FromQuery] bool incluirArquivados = false,
        [FromQuery] string? busca = null, [FromQuery] string? direcao = null,
        [FromQuery] string? situacao = null, [FromQuery] string? forma = null,
        [FromQuery] decimal? valorMin = null, [FromQuery] decimal? valorMax = null,
        [FromQuery] DateTime? vencDe = null, [FromQuery] DateTime? vencAte = null)
    {
        var result = await _service.ListarAsync(UserId, page, pageSize, incluirArquivados, busca, direcao,
            situacao, forma, valorMin, valorMax, vencDe, vencAte);
        return Ok(result);
    }

    /// <summary>
    /// O topo da tela: o que vence nos próximos 30 dias dos dois lados (inclui o que já venceu e ainda falta), se o
    /// saldo nas contas cobre o que a pessoa devolve, e a frase. Só leitura.
    /// </summary>
    [HttpGet("proximos")]
    [ProducesResponseType(typeof(ProximosEmprestimosDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Proximos([FromServices] ProximosEmprestimosService proximos) =>
        // "Hoje" no Brasil (UTC-3): o dia em que a pessoa está olhando.
        Ok(await proximos.CalcularAsync(UserId, DateOnly.FromDateTime(DateTime.UtcNow.AddHours(-3))));

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

    /// <summary>Esconde da lista principal do lado de quem chama — só pra empréstimo Quitado
    /// (arquivar decisão pessoal, não apaga nada, não afeta a visão da outra parte).</summary>
    [HttpPatch("{id:guid}/arquivar")]
    public async Task<IActionResult> Arquivar(Guid id)
    {
        var ok = await _service.ArquivarAsync(id, UserId);
        return ok ? NoContent() : NotFound();
    }

    /// <summary>Reverte o arquivar — volta a aparecer na lista principal de quem chama.</summary>
    [HttpPatch("{id:guid}/desarquivar")]
    public async Task<IActionResult> Desarquivar(Guid id)
    {
        var ok = await _service.DesarquivarAsync(id, UserId);
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
    /// junto). Devedor: nasce Pendente. Credor: nasce já Aprovada. Pra empréstimo Parcelado, o
    /// valor é aplicado em sequência nas parcelas pendentes mais antigas (quantas cobrir por
    /// completo) — pode gerar mais de uma solicitação numa chamada só.</summary>
    [HttpPost("{id:guid}/solicitar-pagamento")]
    [ProducesResponseType(typeof(List<EmprestimoPagamentoSolicitacaoDto>), StatusCodes.Status200OK)]
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

    // ── Unificar/consolidar ─────────────────────────────────────────────────

    /// <summary>Contrapartes com 2+ empréstimos ativos onde eu sou credor — candidatas a
    /// consolidação (evita seleção manual às cegas pela lista inteira).</summary>
    [HttpGet("candidatos-consolidacao")]
    [ProducesResponseType(typeof(List<EmprestimoConsolidacaoCandidatoDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListarCandidatosConsolidacao()
    {
        var lista = await _service.ListarCandidatosConsolidacaoAsync(UserId);
        return Ok(lista);
    }

    /// <summary>Propõe juntar 2+ empréstimos ativos da mesma contraparte vinculada num plano novo
    /// renegociado. Nada muda até o devedor aceitar.</summary>
    [HttpPost("consolidar")]
    [ProducesResponseType(typeof(EmprestimoConsolidacaoPropostaDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ProporConsolidacao([FromBody] ProporConsolidacaoDto dto)
    {
        var resultado = await _service.ProporConsolidacaoAsync(dto, UserId);
        return Ok(resultado);
    }

    /// <summary>Consolidações onde sou credor (propus) ou devedor (preciso responder).</summary>
    [HttpGet("consolidacoes")]
    [ProducesResponseType(typeof(List<EmprestimoConsolidacaoPropostaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListarConsolidacoes()
    {
        var lista = await _service.ListarConsolidacoesAsync(UserId);
        return Ok(lista);
    }

    /// <summary>Devedor aceita — cria o empréstimo consolidado e fecha os originais.</summary>
    [HttpPost("consolidacoes/{id:guid}/aceitar")]
    [ProducesResponseType(typeof(EmprestimoDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> AceitarConsolidacao(Guid id)
    {
        var resultado = await _service.AceitarConsolidacaoAsync(id, UserId);
        return Ok(resultado);
    }

    /// <summary>Devedor recusa — nenhum empréstimo original é tocado.</summary>
    [HttpPost("consolidacoes/{id:guid}/recusar")]
    public async Task<IActionResult> RecusarConsolidacao(Guid id, [FromBody] RecusarConsolidacaoDto? dto)
    {
        await _service.RecusarConsolidacaoAsync(id, dto ?? new RecusarConsolidacaoDto(), UserId);
        return NoContent();
    }

    /// <summary>Credor cancela a proposta antes do devedor responder.</summary>
    [HttpPost("consolidacoes/{id:guid}/cancelar")]
    public async Task<IActionResult> CancelarConsolidacao(Guid id)
    {
        await _service.CancelarConsolidacaoAsync(id, UserId);
        return NoContent();
    }
}


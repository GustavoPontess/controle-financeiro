using System.Security.Claims;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControleFinanceiro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FamiliasController : ControllerBase
{
    private readonly FamiliaService _familiaService;
    private readonly ConviteService _conviteService;
    private readonly DespesaCompartilhadaService _despesaCompartilhada;
    private readonly DependenteService _dependenteService;
    private readonly RateioService _rateioService;
    private readonly AcertoService _acertoService;
    private readonly RendaService _rendaService;

    public FamiliasController(
        FamiliaService familiaService,
        ConviteService conviteService,
        DespesaCompartilhadaService despesaCompartilhada,
        DependenteService dependenteService,
        RateioService rateioService,
        AcertoService acertoService,
        RendaService rendaService)
    {
        _familiaService = familiaService;
        _conviteService = conviteService;
        _despesaCompartilhada = despesaCompartilhada;
        _dependenteService = dependenteService;
        _rateioService = rateioService;
        _acertoService = acertoService;
        _rendaService = rendaService;
    }

    private Guid GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !Guid.TryParse(claim.Value, out var id))
            throw new UnauthorizedAccessException("Usuário não identificado.");
        return id;
    }

    /// <summary>Cria uma família. O criador entra como Administrador.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(FamiliaDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Criar([FromBody] CriarFamiliaDto dto)
    {
        var result = await _familiaService.CriarAsync(dto, GetUserId());
        return CreatedAtAction(nameof(ObterDetalhe), new { id = result.Id }, result);
    }

    /// <summary>Lista as famílias das quais o usuário logado é membro ativo.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<FamiliaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Listar()
    {
        return Ok(await _familiaService.ListarAsync(GetUserId()));
    }

    /// <summary>Detalhe da família: membros e convites pendentes.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(FamiliaDetalheDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ObterDetalhe(Guid id)
    {
        return Ok(await _familiaService.ObterDetalheAsync(id, GetUserId()));
    }

    /// <summary>Dissolve a família (apenas administrador).</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Dissolver(Guid id)
    {
        await _familiaService.DissolverAsync(id, GetUserId());
        return NoContent();
    }

    /// <summary>Edita o rótulo de relação de um membro (admin edita qualquer um; membro, o próprio).</summary>
    [HttpPut("{id:guid}/membros/{membroId:guid}/papel")]
    [ProducesResponseType(typeof(MembroFamiliaDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> EditarPapel(Guid id, Guid membroId, [FromBody] EditarPapelDto dto)
    {
        return Ok(await _familiaService.EditarPapelAsync(id, membroId, dto, GetUserId()));
    }

    /// <summary>Feature 2.3 — promove/rebaixa a permissão de um membro (só admin; o dono não muda).</summary>
    [HttpPut("{id:guid}/membros/{membroId:guid}/permissao")]
    [ProducesResponseType(typeof(MembroFamiliaDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> EditarPermissao(
        Guid id, Guid membroId, [FromBody] EditarPermissaoDto dto)
    {
        return Ok(await _familiaService.EditarPermissaoAsync(id, membroId, dto, GetUserId()));
    }

    /// <summary>Remove um membro da família. Admin remove qualquer um; membro sai sozinho.</summary>
    [HttpDelete("{id:guid}/membros/{membroId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> RemoverMembro(Guid id, Guid membroId)
    {
        await _familiaService.RemoverMembroAsync(id, membroId, GetUserId());
        return NoContent();
    }

    /// <summary>Cria um convite para a família (apenas administrador).</summary>
    [HttpPost("{id:guid}/convites")]
    [ProducesResponseType(typeof(ConviteFamiliaDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CriarConvite(Guid id, [FromBody] CriarConviteDto dto)
    {
        var result = await _conviteService.CriarAsync(id, dto, GetUserId());
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>Revoga um convite pendente (apenas administrador).</summary>
    [HttpDelete("{id:guid}/convites/{conviteId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> RevogarConvite(Guid id, Guid conviteId)
    {
        await _conviteService.RevogarAsync(id, conviteId, GetUserId());
        return NoContent();
    }

    /// <summary>Despesas divididas da família no mês/ano (Transações da família). Filtros: responsável, quem pagou,
    /// categoria e situação (esperando | dividida | recusada).</summary>
    [HttpGet("{id:guid}/despesas")]
    [ProducesResponseType(typeof(List<DespesaCompartilhadaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListarDespesas(
        Guid id, [FromQuery] int? mes = null, [FromQuery] int? ano = null,
        [FromQuery] Guid? responsavelId = null, [FromQuery] Guid? pagadorId = null,
        [FromQuery] Guid? categoriaId = null, [FromQuery] string? situacao = null)
    {
        var agora = DateTime.UtcNow;
        var result = await _despesaCompartilhada.ListarDespesasAsync(
            id, GetUserId(), mes ?? agora.Month, ano ?? agora.Year, responsavelId, pagadorId, categoriaId, situacao);
        return Ok(result);
    }

    /// <summary>Marca (ou desmarca, com <c>familiaId</c> null) uma conta sua como da casa: as despesas que nascem nela
    /// daqui pra frente já nascem divididas com a família.</summary>
    [HttpPut("contas/{contaId:guid}/casa")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> MarcarContaDaCasa(Guid contaId, [FromBody] DaCasaDto dto)
    {
        await _despesaCompartilhada.MarcarContaDaCasaAsync(contaId, GetUserId(), dto.FamiliaId);
        return NoContent();
    }

    /// <summary>Marca (ou desmarca) um cartão seu como da casa: as compras à vista nele já nascem divididas.</summary>
    [HttpPut("cartoes/{cartaoId:guid}/casa")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> MarcarCartaoDaCasa(Guid cartaoId, [FromBody] DaCasaDto dto)
    {
        await _despesaCompartilhada.MarcarCartaoDaCasaAsync(cartaoId, GetUserId(), dto.FamiliaId);
        return NoContent();
    }

    /// <summary>Contas fixas da casa no mês: quem paga, o dia, a cobrança do mês e a sua parte.</summary>
    [HttpGet("{id:guid}/contas-fixas")]
    [ProducesResponseType(typeof(List<ContaFixaDaCasaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListarContasFixas(Guid id, [FromQuery] int? mes = null, [FromQuery] int? ano = null)
    {
        var agora = DateTime.UtcNow;
        return Ok(await _despesaCompartilhada.ListarContasFixasAsync(id, GetUserId(), mes ?? agora.Month, ano ?? agora.Year));
    }

    /// <summary>Balanço mensal da família, respeitando o modo de rateio.</summary>
    [HttpGet("{id:guid}/balanco")]
    [ProducesResponseType(typeof(BalancoFamiliaDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObterBalanco(
        Guid id, [FromQuery] int? mes = null, [FromQuery] int? ano = null)
    {
        var agora = DateTime.UtcNow;
        var result = await _despesaCompartilhada.ObterBalancoAsync(
            id, GetUserId(), mes ?? agora.Month, ano ?? agora.Year);
        return Ok(result);
    }

    /// <summary>Feature 2.4 — define/limpa o limite de aprovação da família (só admin).</summary>
    [HttpPut("{id:guid}/limite-aprovacao")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DefinirLimiteAprovacao(
        Guid id, [FromBody] DefinirLimiteAprovacaoDto dto)
    {
        await _familiaService.DefinirLimiteAprovacaoAsync(id, GetUserId(), dto.LimiteAprovacao);
        return NoContent();
    }

    /// <summary>Feature 2.4 — aprova uma despesa compartilhada pendente (membro ≠ criador).</summary>
    [HttpPost("{id:guid}/despesas/{transacaoId:guid}/aprovar")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> AprovarDespesa(Guid id, Guid transacaoId)
    {
        await _despesaCompartilhada.AprovarAsync(id, transacaoId, GetUserId());
        return NoContent();
    }

    /// <summary>Feature 2.4 — rejeita uma despesa compartilhada pendente (membro ≠ criador).</summary>
    [HttpPost("{id:guid}/despesas/{transacaoId:guid}/rejeitar")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> RejeitarDespesa(Guid id, Guid transacaoId)
    {
        await _despesaCompartilhada.RejeitarAsync(id, transacaoId, GetUserId());
        return NoContent();
    }

    /// <summary>Feature 2.1 — atribui/limpa o membro responsável por uma despesa compartilhada.</summary>
    [HttpPut("{id:guid}/despesas/{transacaoId:guid}/responsavel")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> AtribuirResponsavel(
        Guid id, Guid transacaoId, [FromBody] AtribuirResponsavelDto dto)
    {
        await _despesaCompartilhada.AtribuirResponsavelAsync(
            id, transacaoId, dto.ResponsavelUsuarioId, GetUserId());
        return NoContent();
    }

    /// <summary>Cria um dependente na família.</summary>
    [HttpPost("{id:guid}/dependentes")]
    [ProducesResponseType(typeof(DependenteDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CriarDependente(Guid id, [FromBody] CriarDependenteDto dto)
    {
        var result = await _dependenteService.CriarAsync(id, GetUserId(), dto);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>Lista os dependentes ativos da família.</summary>
    [HttpGet("{id:guid}/dependentes")]
    [ProducesResponseType(typeof(List<DependenteDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListarDependentes(Guid id)
    {
        return Ok(await _dependenteService.ListarAsync(id, GetUserId()));
    }

    /// <summary>Edita um dependente da família.</summary>
    [HttpPut("{id:guid}/dependentes/{depId:guid}")]
    [ProducesResponseType(typeof(DependenteDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> AtualizarDependente(
        Guid id, Guid depId, [FromBody] CriarDependenteDto dto)
    {
        return Ok(await _dependenteService.AtualizarAsync(id, depId, GetUserId(), dto));
    }

    /// <summary>Inativa um dependente (soft delete — preserva histórico).</summary>
    [HttpDelete("{id:guid}/dependentes/{depId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> InativarDependente(Guid id, Guid depId)
    {
        await _dependenteService.InativarAsync(id, depId, GetUserId());
        return NoContent();
    }

    /// <summary>Total gasto com o dependente no mês/ano.</summary>
    [HttpGet("{id:guid}/dependentes/{depId:guid}/gastos")]
    [ProducesResponseType(typeof(GastoDependenteDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObterGastoDependente(
        Guid id, Guid depId, [FromQuery] int? mes = null, [FromQuery] int? ano = null)
    {
        var agora = DateTime.UtcNow;
        var result = await _dependenteService.ObterGastoAsync(
            id, depId, GetUserId(), mes ?? agora.Month, ano ?? agora.Year);
        return Ok(result);
    }

    /// <summary>Define o modo de rateio padrão da família.</summary>
    [HttpPut("{id:guid}/modo-rateio")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DefinirModoRateio(Guid id, [FromBody] DefinirModoRateioDto dto)
    {
        await _rateioService.DefinirModoFamiliaAsync(id, GetUserId(), dto.Modo);
        return NoContent();
    }

    /// <summary>A própria pessoa escolhe o que a família vê da renda dela (nada, só o peso, o valor pra alguns ou pra todos).</summary>
    [HttpPut("{id:guid}/membros/{membroId:guid}/renda-visibilidade")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DefinirVisibilidadeRenda(
        Guid id, Guid membroId, [FromBody] DefinirVisibilidadeRendaDto dto)
    {
        await _rendaService.DefinirVisibilidadeAsync(id, membroId, GetUserId(), dto);
        return NoContent();
    }

    /// <summary>Renda da casa no mês, calculada pra quem pede: só entra quem liberou o valor pra essa pessoa.</summary>
    [HttpGet("{id:guid}/renda")]
    [ProducesResponseType(typeof(RendaFamiliaDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObterRenda(Guid id, [FromQuery] int mes, [FromQuery] int ano)
    {
        return Ok(await _rendaService.ObterRendaFamiliaAsync(id, GetUserId(), ano, mes));
    }

    /// <summary>Registra um acerto de contas entre dois membros da família.</summary>
    [HttpPost("{id:guid}/acertos")]
    [ProducesResponseType(typeof(AcertoContasDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> RegistrarAcerto(Guid id, [FromBody] RegistrarAcertoDto dto)
    {
        var result = await _acertoService.RegistrarAsync(id, GetUserId(), dto);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>Histórico de acertos da família (mês/ano opcionais).</summary>
    [HttpGet("{id:guid}/acertos")]
    [ProducesResponseType(typeof(List<AcertoContasDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListarAcertos(
        Guid id, [FromQuery] int? mes = null, [FromQuery] int? ano = null, [FromQuery] Guid? deUsuarioId = null)
    {
        return Ok(await _acertoService.ListarAsync(id, GetUserId(), mes, ano, deUsuarioId));
    }

    /// <summary>Cancela um acerto (soft delete — preserva o histórico).</summary>
    [HttpDelete("{id:guid}/acertos/{acertoId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> CancelarAcerto(Guid id, Guid acertoId)
    {
        await _acertoService.CancelarAsync(id, acertoId, GetUserId());
        return NoContent();
    }

    /// <summary>Quem recebeu confirma (e, com conta, nasce a entrada). Só aí o acerto entra no equilíbrio.</summary>
    [HttpPost("{id:guid}/acertos/{acertoId:guid}/confirmar")]
    [ProducesResponseType(typeof(AcertoContasDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ConfirmarAcerto(Guid id, Guid acertoId, [FromBody] ContaDoAcertoDto dto)
    {
        return Ok(await _acertoService.ConfirmarAsync(id, acertoId, GetUserId(), dto));
    }

    /// <summary>Lança o seu lado do acerto numa conta sua (a saída de quem passou ou a entrada de quem recebeu).</summary>
    [HttpPost("{id:guid}/acertos/{acertoId:guid}/lancar")]
    [ProducesResponseType(typeof(AcertoContasDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> LancarAcerto(Guid id, Guid acertoId, [FromBody] ContaDoAcertoDto dto)
    {
        return Ok(await _acertoService.LancarNaMinhaContaAsync(id, acertoId, GetUserId(), dto));
    }
}

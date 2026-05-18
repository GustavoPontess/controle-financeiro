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

    public FamiliasController(
        FamiliaService familiaService,
        ConviteService conviteService,
        DespesaCompartilhadaService despesaCompartilhada,
        DependenteService dependenteService,
        RateioService rateioService)
    {
        _familiaService = familiaService;
        _conviteService = conviteService;
        _despesaCompartilhada = despesaCompartilhada;
        _dependenteService = dependenteService;
        _rateioService = rateioService;
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

    /// <summary>Edita o papel de um membro (admin edita qualquer um; membro, o próprio).</summary>
    [HttpPut("{id:guid}/membros/{membroId:guid}/papel")]
    [ProducesResponseType(typeof(MembroFamiliaDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> EditarPapel(Guid id, Guid membroId, [FromBody] EditarPapelDto dto)
    {
        return Ok(await _familiaService.EditarPapelAsync(id, membroId, dto, GetUserId()));
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

    /// <summary>Feed de despesas compartilhadas da família no mês/ano.</summary>
    [HttpGet("{id:guid}/despesas")]
    [ProducesResponseType(typeof(List<DespesaCompartilhadaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListarDespesas(
        Guid id, [FromQuery] int? mes = null, [FromQuery] int? ano = null)
    {
        var agora = DateTime.UtcNow;
        var result = await _despesaCompartilhada.ListarDespesasAsync(
            id, GetUserId(), mes ?? agora.Month, ano ?? agora.Year);
        return Ok(result);
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

    /// <summary>Define a renda mensal de um membro (usada no rateio proporcional).</summary>
    [HttpPut("{id:guid}/membros/{membroId:guid}/renda")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DefinirRenda(
        Guid id, Guid membroId, [FromBody] DefinirRendaDto dto)
    {
        await _rateioService.DefinirRendaAsync(id, membroId, GetUserId(), dto.RendaMensal);
        return NoContent();
    }
}

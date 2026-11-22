using System.Security.Claims;
using ControleFinanceiro.Api.DTOs.Transacao;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ControleFinanceiro.Api.Controllers;

/// <summary>
/// Anexos (print da nota, foto do cupom, PDF) e localização de um lançamento. Só o dono do lançamento; de outra pessoa
/// ou inexistente → 404. Foto é guardada redesenhada (WebP, sem metadados); PDF conferido e só sai como download.
/// </summary>
[ApiController]
[Route("api/transacoes/{transacaoId:guid}")]
[Authorize]
public class TransacaoAnexosController : ControllerBase
{
    private readonly AnexoTransacaoService _anexos;

    public TransacaoAnexosController(AnexoTransacaoService anexos)
    {
        _anexos = anexos;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>Os anexos do lançamento (sem os bytes), do mais antigo pro mais novo.</summary>
    [HttpGet("anexos")]
    [ProducesResponseType(typeof(List<AnexoTransacaoDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<List<AnexoTransacaoDto>>> Listar(Guid transacaoId) =>
        Ok(await _anexos.ListarAsync(transacaoId, UserId));

    /// <summary>Anexa um arquivo (multipart, campo <c>arquivo</c>; JPG, PNG, WebP ou PDF até 10 MB; até 5 por lançamento).</summary>
    [HttpPost("anexos")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(AnexoTransacaoService.TamanhoMaximoBytes + 64 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = AnexoTransacaoService.TamanhoMaximoBytes + 64 * 1024)]
    [EnableRateLimiting("anexo-transacao")]
    [ProducesResponseType(typeof(AnexoTransacaoDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AnexoTransacaoDto>> Anexar(Guid transacaoId, IFormFile? arquivo)
    {
        if (arquivo is null)
            throw new ArgumentException("Escolha um arquivo.");
        await using var conteudo = arquivo.OpenReadStream();
        var anexo = await _anexos.AdicionarAsync(transacaoId, UserId, conteudo, arquivo.Length, arquivo.FileName);
        return StatusCode(StatusCodes.Status201Created, anexo);
    }

    /// <summary>O arquivo. Foto aparece na tela; PDF sempre baixa (nunca abre dentro do app).</summary>
    [HttpGet("anexos/{anexoId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Arquivo(Guid transacaoId, Guid anexoId)
    {
        var anexo = await _anexos.ObterAsync(transacaoId, anexoId, UserId);
        if (anexo is null)
            return NotFound();
        Response.Headers.CacheControl = "private, no-store";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return anexo.TipoConteudo == AnexoTransacaoService.TipoPdf
            ? File(anexo.Dados, anexo.TipoConteudo, anexo.Nome)
            : File(anexo.Dados, anexo.TipoConteudo);
    }

    /// <summary>Tira o anexo do lançamento.</summary>
    [HttpDelete("anexos/{anexoId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Remover(Guid transacaoId, Guid anexoId)
    {
        await _anexos.RemoverAsync(transacaoId, anexoId, UserId);
        return NoContent();
    }

    /// <summary>Grava onde o lançamento aconteceu (o ponto do aparelho; o servidor arredonda a ~11 m).</summary>
    [HttpPut("localizacao")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DefinirLocalizacao(Guid transacaoId, [FromBody] LocalizacaoDto dto)
    {
        await _anexos.DefinirLocalizacaoAsync(transacaoId, UserId, dto);
        return NoContent();
    }

    /// <summary>Tira a localização do lançamento.</summary>
    [HttpDelete("localizacao")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoverLocalizacao(Guid transacaoId)
    {
        await _anexos.DefinirLocalizacaoAsync(transacaoId, UserId, null);
        return NoContent();
    }
}

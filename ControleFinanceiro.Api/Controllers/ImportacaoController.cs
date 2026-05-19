using System.Security.Claims;
using System.Text;
using ControleFinanceiro.Api.DTOs.Importacao;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControleFinanceiro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PreviewUploadForm
{
    public IFormFile Arquivo { get; set; } = null!;
    public Guid ContaId { get; set; }
}

public class ImportacaoController : ControllerBase
{
    private const long TamanhoMaximoBytes = 2 * 1024 * 1024; // 2 MB
    private static readonly string[] ExtensoesAceitas = { ".ofx", ".csv" };

    private readonly ImportacaoService _importacaoService;

    public ImportacaoController(ImportacaoService importacaoService)
    {
        _importacaoService = importacaoService;
    }

    private Guid GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !Guid.TryParse(claim.Value, out var id))
            throw new UnauthorizedAccessException("Usuário não identificado.");
        return id;
    }

    /// <summary>Lê um extrato OFX/CSV e devolve a preview (sem salvar nada).</summary>
    [HttpPost("preview")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(PreviewImportacaoDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Preview([FromForm] PreviewUploadForm form)
    {
        var conteudo = LerArquivo(form.Arquivo);
        var preview = await _importacaoService.PreviewAsync(
            form.ContaId, GetUserId(), form.Arquivo.FileName, conteudo);
        return Ok(preview);
    }

    /// <summary>Cria as transações aprovadas pelo usuário na conta indicada.</summary>
    [HttpPost("confirmar")]
    [ProducesResponseType(typeof(ResultadoImportacaoDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Confirmar([FromBody] ConfirmarImportacaoDto dto)
    {
        var resultado = await _importacaoService.ConfirmarAsync(dto, GetUserId());
        return Ok(resultado);
    }

    /// <summary>Valida e lê o arquivo enviado. OFX brasileiro costuma vir em
    /// Latin1 — tenta UTF-8 estrito e cai para Latin1 se não for válido.</summary>
    private static string LerArquivo(IFormFile arquivo)
    {
        if (arquivo is null || arquivo.Length == 0)
            throw new ArgumentException("Envie um arquivo de extrato.");

        if (arquivo.Length > TamanhoMaximoBytes)
            throw new ArgumentException("O arquivo excede o limite de 2 MB.");

        var ext = Path.GetExtension(arquivo.FileName).ToLowerInvariant();
        if (!ExtensoesAceitas.Contains(ext))
            throw new ArgumentException("Formato não suportado. Envie um arquivo .ofx ou .csv.");

        using var ms = new MemoryStream();
        arquivo.CopyTo(ms);
        var bytes = ms.ToArray();

        try
        {
            return new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true)
                .GetString(bytes);
        }
        catch (DecoderFallbackException)
        {
            return Encoding.Latin1.GetString(bytes);
        }
    }
}

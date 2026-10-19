using System.Security.Claims;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ControleFinanceiro.Api.Controllers;

/// <summary>
/// Foto de perfil. A própria pessoa troca e remove; quem divide uma família ativa com ela vê.
/// O arquivo enviado nunca é guardado: o servidor redesenha a imagem (WebP 256x256, sem metadados).
/// </summary>
[ApiController]
[Route("api/usuarios")]
[Authorize]
public class UsuariosController : ControllerBase
{
    private readonly FotoPerfilService _fotos;

    public UsuariosController(FotoPerfilService fotos)
    {
        _fotos = fotos;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>Foto de uma pessoa (a própria ou de alguém da mesma família). 404 sem foto ou sem permissão.
    /// A URL do front leva a versão (<c>?v=</c>), então o navegador pode guardar por um dia.</summary>
    [HttpGet("{id:guid}/foto")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Foto(Guid id)
    {
        var foto = await _fotos.ObterAsync(UserId, id);
        if (foto is null)
            return NotFound();
        Response.Headers.CacheControl = "private, max-age=86400";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return File(foto.Dados, foto.TipoConteudo);
    }

    /// <summary>Troca a própria foto (multipart, campo <c>arquivo</c>; JPG, PNG ou WebP até 8 MB).
    /// Devolve a nova versão.</summary>
    [HttpPut("me/foto")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(FotoPerfilService.TamanhoMaximoBytes + 64 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = FotoPerfilService.TamanhoMaximoBytes + 64 * 1024)]
    [EnableRateLimiting("foto-perfil")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<object>> TrocarFoto(IFormFile? arquivo)
    {
        if (arquivo is null)
            throw new ArgumentException("Escolha uma foto.");
        await using var conteudo = arquivo.OpenReadStream();
        var versao = await _fotos.SalvarAsync(UserId, conteudo, arquivo.Length);
        return Ok(new { fotoEm = versao });
    }

    /// <summary>Remove a própria foto (volta a inicial).</summary>
    [HttpDelete("me/foto")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> RemoverFoto()
    {
        await _fotos.RemoverAsync(UserId);
        return NoContent();
    }
}

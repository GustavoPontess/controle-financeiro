# Controller XML Documentation Template

Use este template ao criar novos controllers. Copie e adapte!

```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ControleFinanceiro.Api.DTOs.MinhaEntidade;
using ControleFinanceiro.Api.Services;

namespace ControleFinanceiro.Api.Controllers;

/// <summary>
/// Operações com MinhaEntidade.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MinhaEntidadeController : ControllerBase
{
    private readonly MinhaEntidadeService _service;

    public MinhaEntidadeController(MinhaEntidadeService service)
    {
        _service = service;
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
            throw new UnauthorizedAccessException("Usuário não identificado");
        return userId;
    }

    /// <summary>
    /// Listar todas as entidades do usuário.
    /// </summary>
    /// <returns>Lista de entidades</returns>
    /// <response code="200">Retorna a lista</response>
    /// <response code="401">Não autenticado</response>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<MinhaEntidadeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IEnumerable<MinhaEntidadeDto>>> Listar()
    {
        var usuarioId = GetUserId();
        var resultado = await _service.ListarAsync(usuarioId);
        return Ok(resultado);
    }

    /// <summary>
    /// Obter uma entidade por ID.
    /// </summary>
    /// <param name="id">ID da entidade</param>
    /// <returns>Dados da entidade</returns>
    /// <response code="200">Entidade encontrada</response>
    /// <response code="404">Não encontrada</response>
    /// <response code="401">Não autenticado</response>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(MinhaEntidadeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<MinhaEntidadeDto>> BuscarPorId(Guid id)
    {
        var usuarioId = GetUserId();
        var resultado = await _service.BuscarPorIdAsync(id, usuarioId);

        if (resultado == null)
            return NotFound(new { message = "Não encontrado" });

        return Ok(resultado);
    }

    /// <summary>
    /// Criar uma nova entidade.
    /// </summary>
    /// <param name="dto">Dados da entidade</param>
    /// <returns>Entidade criada</returns>
    /// <response code="201">Criada com sucesso</response>
    /// <response code="400">Dados inválidos</response>
    /// <response code="401">Não autenticado</response>
    [HttpPost]
    [ProducesResponseType(typeof(MinhaEntidadeDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Criar([FromBody] CriarMinhaEntidadeDto dto)
    {
        try
        {
            var usuarioId = GetUserId();
            var resultado = await _service.CriarAsync(dto, usuarioId);
            return CreatedAtAction(nameof(BuscarPorId), new { id = resultado.Id }, resultado);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Atualizar uma entidade existente.
    /// </summary>
    /// <param name="id">ID da entidade</param>
    /// <param name="dto">Dados atualizados</param>
    /// <returns>Entidade atualizada</returns>
    /// <response code="200">Atualizada</response>
    /// <response code="400">Dados inválidos</response>
    /// <response code="404">Não encontrada</response>
    /// <response code="401">Não autenticado</response>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(MinhaEntidadeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<MinhaEntidadeDto>> Atualizar(
        Guid id,
        [FromBody] AtualizarMinhaEntidadeDto dto)
    {
        try
        {
            var usuarioId = GetUserId();
            var resultado = await _service.AtualizarAsync(id, dto, usuarioId);

            if (resultado == null)
                return NotFound(new { message = "Não encontrado" });

            return Ok(resultado);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Deletar uma entidade.
    /// </summary>
    /// <param name="id">ID da entidade</param>
    /// <response code="204">Deletada</response>
    /// <response code="404">Não encontrada</response>
    /// <response code="401">Não autenticado</response>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Deletar(Guid id)
    {
        try
        {
            var usuarioId = GetUserId();
            await _service.DeletarAsync(id, usuarioId);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
```

---

## Checklist para novo Controller

- [ ] Herda de `ControllerBase`
- [ ] Tem `[ApiController]` e `[Route("api/[controller]")]`
- [ ] Tem `[Authorize]` (se precisa autenticação)
- [ ] Todos métodos têm comentário `/// <summary>`
- [ ] Métodos protegidos extraem `usuarioId` via `GetUserId()`
- [ ] Passa `usuarioId` para service
- [ ] Todos endpoints têm `[ProducesResponseType(...)]` para cada possível resposta
- [ ] Endpoints retornam status codes apropriados (201 para POST, 204 para DELETE, etc)
- [ ] DTOs têm nomes claros (Criar, Atualizar, etc)

---

## DTOs Template

```csharp
namespace ControleFinanceiro.Api.DTOs.MinhaEntidade;

/// <summary>
/// DTO para leitura de entidade.
/// </summary>
public class MinhaEntidadeDto
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Descricao { get; set; } = string.Empty;
}

/// <summary>
/// DTO para criação de entidade.
/// </summary>
public class CriarMinhaEntidadeDto
{
    public string Nome { get; set; } = string.Empty;
    public string Descricao { get; set; } = string.Empty;
}

/// <summary>
/// DTO para atualização de entidade.
/// </summary>
public class AtualizarMinhaEntidadeDto
{
    public string? Nome { get; set; }
    public string? Descricao { get; set; }
}
```

---

**Resultado:** Seu novo controller aparecerá automaticamente no Swagger com toda documentação!

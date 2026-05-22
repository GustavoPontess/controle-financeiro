using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.DTOs.Subcategoria;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ControleFinanceiro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SubcategoriasController : ControllerBase
    {
        private readonly SubcategoriaService _service;

        public SubcategoriasController(SubcategoriaService service)
        {
            _service = service;
        }

        private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        /// <summary>Lista subcategorias do usuário (+ padrões), opcionalmente filtradas por categoria.</summary>
        [HttpGet]
        public async Task<IActionResult> Listar([FromQuery] Guid? categoriaId)
        {
            var subs = await _service.ListarAsync(UserId, categoriaId);
            return Ok(subs.Select(ToDto));
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> BuscarPorId(Guid id)
        {
            var sub = await _service.BuscarPorIdAsync(id, UserId);
            return sub == null ? NotFound() : Ok(ToDto(sub));
        }

        [HttpPost]
        public async Task<IActionResult> Criar([FromBody] CriarSubcategoriaDto dto)
        {
            var sub = await _service.CriarAsync(new Subcategoria
            {
                Nome = dto.Nome,
                Icone = dto.Icone,
                Cor = dto.Cor,
                CategoriaId = dto.CategoriaId,
            }, UserId);

            return CreatedAtAction(nameof(BuscarPorId), new { id = sub.Id }, ToDto(sub));
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Atualizar(Guid id, [FromBody] AtualizarSubcategoriaDto dto)
        {
            var sub = await _service.AtualizarAsync(id, new Subcategoria
            {
                Nome = dto.Nome,
                Icone = dto.Icone,
                Cor = dto.Cor,
            }, UserId);

            return Ok(ToDto(sub));
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Deletar(Guid id)
        {
            await _service.DeletarAsync(id, UserId);
            return NoContent();
        }

        private static SubcategoriaDto ToDto(Subcategoria s) => new()
        {
            Id = s.Id,
            Nome = s.Nome,
            Icone = s.Icone,
            Cor = s.Cor,
            CategoriaId = s.CategoriaId,
            IsPadrao = s.UsuarioId == null,
        };
    }
}

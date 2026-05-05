using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Categoria;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ControleFinanceiro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CategoriasController : ControllerBase
    {
        private readonly CategoriaService _service;

        public CategoriasController(CategoriaService service)
        {
            _service = service;
        }

        private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        [HttpGet]
        public async Task<IActionResult> Listar()
        {
            var categorias = await _service.ListarAsync(UserId);

            var retorno = categorias.Select(c => new CategoriaDto
            {
                Id = c.Id,
                Descricao = c.Descricao,
                Finalidade = (int)c.Finalidade,
                IsPadrao = c.UsuarioId == null,
            });

            return Ok(retorno);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> BuscarPorId(Guid id)
        {
            var categoria = await _service.BuscarPorIdAsync(id, UserId);
            if (categoria == null) return NotFound();

            return Ok(new CategoriaDto
            {
                Id = categoria.Id,
                Descricao = categoria.Descricao,
                Finalidade = (int)categoria.Finalidade,
                IsPadrao = categoria.UsuarioId == null,
            });
        }

        [HttpPost]
        public async Task<IActionResult> Criar([FromBody] CriarCategoriaDto dto)
        {
            try
            {
                var categoria = new Categoria
                {
                    Descricao = dto.Descricao,
                    Finalidade = (Finalidade)dto.Finalidade
                };

                var criada = await _service.CriarAsync(categoria, UserId);

                return CreatedAtAction(nameof(BuscarPorId), new { id = criada.Id }, new CategoriaDto
                {
                    Id = criada.Id,
                    Descricao = criada.Descricao,
                    Finalidade = (int)criada.Finalidade,
                    IsPadrao = false,
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { mensagem = ex.Message });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Deletar(Guid id)
        {
            try
            {
                await _service.DeletarAsync(id, UserId);
                return NoContent();
            }
            catch (Exception ex)
            {
                return BadRequest(new { mensagem = ex.Message });
            }
        }
    }
}

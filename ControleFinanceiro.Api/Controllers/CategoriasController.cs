using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Categoria;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace ControleFinanceiro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CategoriasController : ControllerBase
    {
        private readonly CategoriaService _service;

        public CategoriasController(CategoriaService service)
        {
            _service = service;
        }

        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<CategoriaDto>), StatusCodes.Status200OK)]
        public async Task<IActionResult> Listar()
        {
            var categorias = await _service.ListarAsync();

            var retorno = categorias.Select(c => new CategoriaDto
            {
                Id = c.Id,
                Descricao = c.Descricao,
                Finalidade = (int)c.Finalidade
            });

            return Ok(retorno);
        }

        [HttpGet("{id}")]
        [ProducesResponseType(typeof(CategoriaDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> BuscarPorId(Guid id)
        {
            var categoria = await _service.BuscarPorIdAsync(id);

            if (categoria == null)
            {
                return NotFound();
            }

            var retorno = new CategoriaDto
            {
                Id = categoria.Id,
                Descricao = categoria.Descricao,
                Finalidade = (int)categoria.Finalidade
            };

            return Ok(retorno);
        }

        [HttpPost]
        [ProducesResponseType(typeof(CategoriaDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> Criar([FromBody] CriarCategoriaDto dto)
        {
            try
            {
                var categoria = new Categoria
                {
                    Id = Guid.NewGuid(),
                    Descricao = dto.Descricao,
                    Finalidade = (Finalidade)dto.Finalidade
                };

                var criada = await _service.CriarAsync(categoria);

                var retorno = new CategoriaDto
                {
                    Id = criada.Id,
                    Descricao = criada.Descricao,
                    Finalidade = (int)criada.Finalidade
                };

                return CreatedAtAction(nameof(BuscarPorId), new { id = retorno.Id }, retorno);
            }
            catch (Exception ex)
            {
                return BadRequest(new { mensagem = ex.Message });
            }
        }
    }
}
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

        private static CategoriaDto ToDto(Categoria c) => new()
        {
            Id = c.Id,
            Descricao = c.Descricao,
            Finalidade = (int)c.Finalidade,
            IsPadrao = c.UsuarioId == null,
        };

        /// <summary>Categorias padrão (de todos) e as do usuário.</summary>
        [HttpGet]
        public async Task<IActionResult> Listar()
        {
            var categorias = await _service.ListarAsync(UserId);
            return Ok(categorias.Select(ToDto));
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> BuscarPorId(Guid id)
        {
            var categoria = await _service.BuscarPorIdAsync(id, UserId);
            if (categoria == null) return NotFound();
            return Ok(ToDto(categoria));
        }

        /// <summary>
        /// O que usa a categoria (lançamentos, contas fixas, parcelamentos, limites, metas, subcategorias). A tela
        /// pergunta pra onde mover antes de excluir quando há uso.
        /// </summary>
        [HttpGet("{id}/uso")]
        public async Task<IActionResult> Uso(Guid id) => Ok(await _service.UsoAsync(id, UserId));

        [HttpPost]
        public async Task<IActionResult> Criar([FromBody] CriarCategoriaDto dto)
        {
            var categoria = new Categoria
            {
                Descricao = dto.Descricao,
                Finalidade = (Finalidade)dto.Finalidade
            };

            var criada = await _service.CriarAsync(categoria, UserId);
            return CreatedAtAction(nameof(BuscarPorId), new { id = criada.Id }, ToDto(criada));
        }

        /// <summary>Renomeia ou troca o tipo de uma categoria do usuário (padrão não muda). O tipo novo tem que aceitar o que já está nela.</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Atualizar(Guid id, [FromBody] CriarCategoriaDto dto)
        {
            var atualizada = await _service.AtualizarAsync(id, dto.Descricao, (Finalidade)dto.Finalidade, UserId);
            return Ok(ToDto(atualizada));
        }

        /// <summary>
        /// Exclui uma categoria do usuário. Em uso, <paramref name="moverPara"/> é obrigatório (409 sem ele): tudo vai
        /// pra essa categoria numa transação só, inclusive as subcategorias. Devolve o que foi movido.
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Deletar(Guid id, [FromQuery] Guid? moverPara)
        {
            var movido = await _service.DeletarAsync(id, UserId, moverPara);
            return Ok(movido);
        }
    }
}

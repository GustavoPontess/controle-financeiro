using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.DTOs.Pessoa;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace ControleFinanceiro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PessoasController : ControllerBase
    {
        private readonly PessoaService _service;

        public PessoasController(PessoaService service)
        {
            _service = service;
        }

        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<PessoaDto>), StatusCodes.Status200OK)]
        public async Task<IActionResult> Listar()
        {
            var pessoas = await _service.ListarAsync();

            var retorno = pessoas.Select(p => new PessoaDto
            {
                Id = p.Id,
                Nome = p.Nome,
                Idade = p.Idade
            });

            return Ok(retorno);
        }

        [HttpGet("{id}")]
        [ProducesResponseType(typeof(PessoaDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> BuscarPorId(Guid id)
        {
            var pessoa = await _service.BuscarPorIdAsync(id);

            if (pessoa == null)
            {
                return NotFound();
            }

            var retorno = new PessoaDto
            {
                Id = pessoa.Id,
                Nome = pessoa.Nome,
                Idade = pessoa.Idade
            };

            return Ok(retorno);
        }

        [HttpPost]
        [ProducesResponseType(typeof(PessoaDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> Criar([FromBody] CriarPessoaDto dto)
        {
            try
            {
                var pessoa = new Pessoa
                {
                    Id = Guid.NewGuid(),
                    Nome = dto.Nome,
                    Idade = dto.Idade
                };

                var criada = await _service.CriarAsync(pessoa);

                var retorno = new PessoaDto
                {
                    Id = criada.Id,
                    Nome = criada.Nome,
                    Idade = criada.Idade
                };

                return CreatedAtAction(nameof(BuscarPorId), new { id = retorno.Id }, retorno);
            }
            catch (Exception ex)
            {
                return BadRequest(new { mensagem = ex.Message });
            }
        }

        [HttpPut("{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> Atualizar(Guid id, [FromBody] AtualizarPessoaDto dto)
        {
            try
            {
                var pessoa = new Pessoa
                {
                    Id = id,
                    Nome = dto.Nome,
                    Idade = dto.Idade
                };

                await _service.AtualizarAsync(id, pessoa);
                return NoContent();
            }
            catch (Exception ex)
            {
                return BadRequest(new { mensagem = ex.Message });
            }
        }

        [HttpDelete("{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> Deletar(Guid id)
        {
            try
            {
                await _service.DeletarAsync(id);
                return NoContent();
            }
            catch (Exception ex)
            {
                return BadRequest(new { mensagem = ex.Message });
            }
        }
    }
}
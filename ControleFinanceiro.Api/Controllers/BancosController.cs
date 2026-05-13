using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Banco;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace ControleFinanceiro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BancosController : ControllerBase
    {
        private readonly BancoService _service;

        public BancosController(BancoService service)
        {
            _service = service;
        }

        private static string DescricaoTipo(TipoBanco tipo) => tipo switch
        {
            TipoBanco.BancoTradicional => "Banco Tradicional",
            TipoBanco.Fintech => "Fintech",
            TipoBanco.Corretora => "Corretora",
            TipoBanco.Cooperativa => "Cooperativa",
            TipoBanco.Outro => "Outro",
            _ => tipo.ToString()
        };

        private static BancoDto ToDto(Banco b) => new()
        {
            Id = b.Id,
            Nome = b.Nome,
            NomeFantasia = b.NomeFantasia,
            RazaoSocial = b.RazaoSocial,
            CodigoBanco = b.CodigoBanco,
            Tipo = (int)b.Tipo,
            TipoDescricao = DescricaoTipo(b.Tipo),
            Ativo = b.Ativo,
            LogoUrl = b.LogoUrl,
            Cor = b.Cor
        };

        [HttpGet]
        public async Task<IActionResult> Listar()
        {
            var lista = await _service.ListarAsync();
            return Ok(lista.Select(ToDto));
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> BuscarPorId(Guid id)
        {
            var banco = await _service.BuscarPorIdAsync(id);
            if (banco == null) return NotFound();
            return Ok(ToDto(banco));
        }

        [HttpPost]
        [ProducesResponseType(typeof(BancoDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> Criar([FromBody] CriarBancoDto dto)
        {
            var banco = new Banco { Nome = dto.Nome, Tipo = (TipoBanco)dto.Tipo };
            var criado = await _service.CriarAsync(banco);
            return CreatedAtAction(nameof(BuscarPorId), new { id = criado.Id }, ToDto(criado));
        }

        [HttpPut("{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> Atualizar(Guid id, [FromBody] CriarBancoDto dto)
        {
            var banco = new Banco { Nome = dto.Nome, Tipo = (TipoBanco)dto.Tipo };
            await _service.AtualizarAsync(id, banco);
            return NoContent();
        }

        [HttpDelete("{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> Deletar(Guid id)
        {
            await _service.DeletarAsync(id);
            return NoContent();
        }
    }
}

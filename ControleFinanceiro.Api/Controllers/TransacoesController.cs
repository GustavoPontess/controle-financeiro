using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Relatorios;
using ControleFinanceiro.Api.DTOs.Transacao;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace ControleFinanceiro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TransacoesController : ControllerBase
    {
        private readonly TransacaoService _service;

        public TransacoesController(TransacaoService service)
        {
            _service = service;
        }

        [HttpPost]
        [ProducesResponseType(typeof(TransacaoDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> Criar([FromBody] CriarTransacaoDto dto)
        {
            try
            {
                var transacao = new Transacao
                {
                    Id = Guid.NewGuid(),
                    Descricao = dto.Descricao,
                    Valor = dto.Valor,
                    Tipo = (TipoTransacao)dto.Tipo,
                    CategoriaId = dto.CategoriaId,
                    PessoaId = dto.PessoaId,
                    ContaId = dto.ContaId,
                    Data = dto.Data.ToUniversalTime()
                };

                var criada = await _service.CriarTransacaoAsync(transacao);

                var retorno = new TransacaoDto
                {
                    Id = criada.Id,
                    Descricao = criada.Descricao,
                    Valor = criada.Valor,
                    Tipo = (int)criada.Tipo,
                    CategoriaId = criada.CategoriaId,
                    PessoaId = criada.PessoaId,
                    ContaId = criada.ContaId,
                    Data = criada.Data
                };

                return CreatedAtAction(
                    nameof(BuscarPorId),
                    new { id = retorno.Id },
                    retorno
                );
            }
            catch (Exception ex)
            {
                return BadRequest(new { mensagem = ex.Message });
            }
        }

        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<TransacaoDto>), StatusCodes.Status200OK)]
        public async Task<IActionResult> Listar()
        {
            var lista = await _service.ListarAsync();

            var retorno = lista.Select(t => new TransacaoDto
            {
                Id = t.Id,
                Descricao = t.Descricao,
                Valor = t.Valor,
                Tipo = (int)t.Tipo,
                CategoriaId = t.CategoriaId,
                PessoaId = t.PessoaId,
                ContaId = t.ContaId,
                Data = t.Data
            });

            return Ok(retorno);
        }

        [HttpGet("{id}")]
        [ProducesResponseType(typeof(TransacaoDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> BuscarPorId(Guid id)
        {
            var transacao = await _service.BuscarPorIdAsync(id);

            if (transacao == null)
            {
                return NotFound();
            }

            var retorno = new TransacaoDto
            {
                Id = transacao.Id,
                Descricao = transacao.Descricao,
                Valor = transacao.Valor,
                Tipo = (int)transacao.Tipo,
                CategoriaId = transacao.CategoriaId,
                PessoaId = transacao.PessoaId,
                Data = transacao.Data
            };

            return Ok(retorno);
        }

        [HttpGet("resumo/{pessoaId}")]
        [ProducesResponseType(typeof(ResumoFinanceiroDto), StatusCodes.Status200OK)]
        public async Task<IActionResult> ObterResumo(Guid pessoaId)
        {
            var resumo = await _service.ObterResumoPorPessoaAsync(pessoaId);

            return Ok(resumo);
        }
    }
}
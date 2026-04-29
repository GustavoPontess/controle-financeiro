using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Relatorios;
using ControleFinanceiro.Api.DTOs.Transacao;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ControleFinanceiro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class TransacoesController : ControllerBase
    {
        private readonly TransacaoService _service;

        public TransacoesController(TransacaoService service)
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

        [HttpPost]
        [ProducesResponseType(typeof(TransacaoDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> Criar([FromBody] CriarTransacaoDto dto)
        {
            try
            {
                var usuarioId = GetUserId();

                var transacao = new Transacao
                {
                    Id = Guid.NewGuid(),
                    Descricao = dto.Descricao,
                    Valor = dto.Valor,
                    Tipo = (TipoTransacao)dto.Tipo,
                    CategoriaId = dto.CategoriaId,
                    ContaId = dto.ContaId,
                    Data = dto.Data.ToUniversalTime()
                };

                var criada = await _service.CriarTransacaoAsync(transacao, usuarioId);

                var retorno = new TransacaoDto
                {
                    Id = criada.Id,
                    Descricao = criada.Descricao,
                    Valor = criada.Valor,
                    Tipo = (int)criada.Tipo,
                    CategoriaId = criada.CategoriaId,
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
            var usuarioId = GetUserId();
            var lista = await _service.ListarAsync(usuarioId);

            var retorno = lista.Select(t => new TransacaoDto
            {
                Id = t.Id,
                Descricao = t.Descricao,
                Valor = t.Valor,
                Tipo = (int)t.Tipo,
                CategoriaId = t.CategoriaId,
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
            var usuarioId = GetUserId();
            var transacao = await _service.BuscarPorIdAsync(id, usuarioId);

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
                ContaId = transacao.ContaId,
                Data = transacao.Data
            };

            return Ok(retorno);
        }

        [HttpGet("resumo/{contaId}")]
        [ProducesResponseType(typeof(ResumoFinanceiroDto), StatusCodes.Status200OK)]
        public async Task<IActionResult> ObterResumo(Guid contaId)
        {
            var usuarioId = GetUserId();
            var resumo = await _service.ObterResumoPorContaAsync(contaId, usuarioId);

            return Ok(resumo);
        }
    }
}
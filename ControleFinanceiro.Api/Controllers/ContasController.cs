using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Conta;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace ControleFinanceiro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ContasController : ControllerBase
    {
        private readonly ContaService _service;

        public ContasController(ContaService service)
        {
            _service = service;
        }

        private static string DescricaoTipo(TipoConta tipo) => tipo switch
        {
            TipoConta.ContaCorrente => "Conta Corrente",
            TipoConta.ContaPoupanca => "Conta Poupança",
            TipoConta.CartaoCredito => "Cartão de Crédito",
            TipoConta.Dinheiro => "Dinheiro",
            TipoConta.Emprestimo => "Empréstimo",
            _ => tipo.ToString()
        };

        private static string DescricaoTipoCartao(TipoCartao? tipo) => tipo switch
        {
            TipoCartao.Credito => "Crédito",
            TipoCartao.Debito => "Débito",
            TipoCartao.PrePago => "Pré-Pago",
            _ => string.Empty
        };

        private static ContaDto ToDto(Conta c) => new()
        {
            Id = c.Id,
            Nome = c.Nome,
            NumeroConta = c.NumeroConta,
            Tipo = (int)c.Tipo,
            TipoDescricao = DescricaoTipo(c.Tipo),
            TipoCartao = c.TipoCartao != null ? (int)c.TipoCartao : null,
            TipoCartaoDescricao = DescricaoTipoCartao(c.TipoCartao),
            SaldoInicial = c.SaldoInicial,
            BancoId = c.BancoId,
            BancoNome = c.Banco?.Nome ?? string.Empty
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
            var conta = await _service.BuscarPorIdAsync(id);
            if (conta == null) return NotFound();
            return Ok(ToDto(conta));
        }

        private IActionResult? ValidarCartao(CriarContaDto dto)
        {
            if (dto.Tipo == (int)TipoConta.CartaoCredito)
            {
                if (!dto.TipoCartao.HasValue)
                    return BadRequest(new { mensagem = "Tipo de cartão é obrigatório para cartões de crédito" });

                var tipoCartao = (TipoCartao)dto.TipoCartao.Value;
                if (tipoCartao == TipoCartao.Credito || tipoCartao == TipoCartao.Debito)
                {
                    if (!dto.BancoId.HasValue)
                        return BadRequest(new { mensagem = "Cartões de crédito e débito devem estar vinculados a uma conta bancária" });
                }
            }
            return null;
        }

        [HttpPost]
        [ProducesResponseType(typeof(ContaDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> Criar([FromBody] CriarContaDto dto)
        {
            try
            {
                var validacao = ValidarCartao(dto);
                if (validacao != null) return validacao;

                var conta = new Conta
                {
                    Nome = dto.Nome,
                    Tipo = (TipoConta)dto.Tipo,
                    TipoCartao = dto.TipoCartao.HasValue ? (TipoCartao)dto.TipoCartao.Value : null,
                    SaldoInicial = dto.SaldoInicial,
                    BancoId = dto.BancoId
                };

                var criada = await _service.CriarAsync(conta);
                return CreatedAtAction(nameof(BuscarPorId), new { id = criada.Id }, ToDto(criada));
            }
            catch (Exception ex)
            {
                return BadRequest(new { mensagem = ex.Message });
            }
        }

        [HttpPut("{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> Atualizar(Guid id, [FromBody] CriarContaDto dto)
        {
            try
            {
                var validacao = ValidarCartao(dto);
                if (validacao != null) return validacao;

                var conta = new Conta
                {
                    Nome = dto.Nome,
                    Tipo = (TipoConta)dto.Tipo,
                    TipoCartao = dto.TipoCartao.HasValue ? (TipoCartao)dto.TipoCartao.Value : null,
                    SaldoInicial = dto.SaldoInicial,
                    BancoId = dto.BancoId
                };

                await _service.AtualizarAsync(id, conta);
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


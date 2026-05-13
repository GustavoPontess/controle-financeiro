using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Conta;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ControleFinanceiro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ContasController : ControllerBase
    {
        private readonly ContaService _service;

        public ContasController(ContaService service)
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
            SaldoAtual = c.Transacoes.Where(t => t.Tipo == TipoTransacao.Receita).Sum(t => t.Valor)
                       - c.Transacoes.Where(t => t.Tipo == TipoTransacao.Despesa).Sum(t => t.Valor),
            IsCarteira = c.IsCarteira,
            BancoId = c.BancoId,
            BancoNome = c.Banco?.Nome ?? string.Empty
        };

        private static void ValidarCartao(CriarContaDto dto)
        {
            if (dto.Tipo == (int)TipoConta.CartaoCredito)
            {
                if (!dto.TipoCartao.HasValue)
                    throw new ArgumentException("Tipo de cartão é obrigatório para cartões de crédito");

                var tipoCartao = (TipoCartao)dto.TipoCartao.Value;
                if ((tipoCartao == TipoCartao.Credito || tipoCartao == TipoCartao.Debito) && !dto.BancoId.HasValue)
                    throw new ArgumentException("Cartões de crédito e débito devem estar vinculados a uma conta bancária");
            }
        }

        [HttpGet]
        public async Task<IActionResult> Listar()
        {
            var usuarioId = GetUserId();
            var lista = await _service.ListarAsync(usuarioId);
            return Ok(lista.Select(ToDto));
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> BuscarPorId(Guid id)
        {
            var usuarioId = GetUserId();
            var conta = await _service.BuscarPorIdAsync(id, usuarioId);
            if (conta == null) return NotFound();
            return Ok(ToDto(conta));
        }

        [HttpPost]
        [ProducesResponseType(typeof(ContaDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> Criar([FromBody] CriarContaDto dto)
        {
            var usuarioId = GetUserId();
            ValidarCartao(dto);

            var conta = new Conta
            {
                Nome = dto.Nome,
                NumeroConta = dto.NumeroConta,
                Tipo = (TipoConta)dto.Tipo,
                TipoCartao = dto.TipoCartao.HasValue ? (TipoCartao)dto.TipoCartao.Value : null,
                BancoId = dto.BancoId,
                IsCarteira = (TipoConta)dto.Tipo == TipoConta.Dinheiro
            };

            var criada = await _service.CriarAsync(conta, usuarioId, dto.SaldoInicial);
            return CreatedAtAction(nameof(BuscarPorId), new { id = criada.Id }, ToDto(criada));
        }

        [HttpPut("{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> Atualizar(Guid id, [FromBody] CriarContaDto dto)
        {
            var usuarioId = GetUserId();
            ValidarCartao(dto);

            var conta = new Conta
            {
                Nome = dto.Nome,
                NumeroConta = dto.NumeroConta,
                Tipo = (TipoConta)dto.Tipo,
                TipoCartao = dto.TipoCartao.HasValue ? (TipoCartao)dto.TipoCartao.Value : null,
                BancoId = dto.BancoId,
                IsCarteira = (TipoConta)dto.Tipo == TipoConta.Dinheiro
            };

            await _service.AtualizarAsync(id, conta, usuarioId);
            return NoContent();
        }

        [HttpDelete("{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> Deletar(Guid id)
        {
            var usuarioId = GetUserId();
            await _service.DeletarAsync(id, usuarioId);
            return NoContent();
        }
    }
}

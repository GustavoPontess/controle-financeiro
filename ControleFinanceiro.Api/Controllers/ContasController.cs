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

        // Saldo = movimento real (Ativo + Executado): exclui canceladas (soft delete) e previsões;
        // inclui transferência/saldo inicial/pagamento (movem dinheiro). Calculado no banco pela
        // regra única (RegrasFinanceiras via ContaService.ObterSaldosAsync) e só repassado aqui.
        private static ContaDto ToDto(Conta c, decimal saldoAtual) => new()
        {
            Id = c.Id,
            Nome = c.Nome,
            NumeroConta = c.NumeroConta,
            Agencia = c.Agencia,
            Tipo = (int)c.Tipo,
            TipoDescricao = DescricaoTipo(c.Tipo),
            TipoCartao = c.TipoCartao != null ? (int)c.TipoCartao : null,
            TipoCartaoDescricao = DescricaoTipoCartao(c.TipoCartao),
            SaldoAtual = saldoAtual,
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
            var saldos = await _service.ObterSaldosAsync(lista.Select(c => c.Id), usuarioId);
            return Ok(lista.Select(c => ToDto(c, saldos[c.Id].Saldo)));
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> BuscarPorId(Guid id)
        {
            var usuarioId = GetUserId();
            var conta = await _service.BuscarPorIdAsync(id, usuarioId);
            if (conta == null) return NotFound();
            var saldos = await _service.ObterSaldosAsync(new[] { conta.Id }, usuarioId);
            return Ok(ToDto(conta, saldos[conta.Id].Saldo));
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
                Agencia = dto.Agencia,
                Tipo = (TipoConta)dto.Tipo,
                TipoCartao = dto.TipoCartao.HasValue ? (TipoCartao)dto.TipoCartao.Value : null,
                BancoId = dto.BancoId,
                IsCarteira = (TipoConta)dto.Tipo == TipoConta.Dinheiro
            };

            var criada = await _service.CriarAsync(conta, usuarioId, dto.SaldoInicial, dto.DataSaldoInicial);
            // Saldo lido do banco (já com o lançamento de saldo inicial gravado) pela mesma regra.
            var saldos = await _service.ObterSaldosAsync(new[] { criada.Id }, usuarioId);
            return CreatedAtAction(nameof(BuscarPorId), new { id = criada.Id }, ToDto(criada, saldos[criada.Id].Saldo));
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
                Agencia = dto.Agencia,
                Tipo = (TipoConta)dto.Tipo,
                TipoCartao = dto.TipoCartao.HasValue ? (TipoCartao)dto.TipoCartao.Value : null,
                BancoId = dto.BancoId,
                IsCarteira = (TipoConta)dto.Tipo == TipoConta.Dinheiro
            };

            await _service.AtualizarAsync(id, conta, usuarioId);
            return NoContent();
        }

        /// <summary>Edita o saldo inicial (ponto de partida) da conta — valor e data de abertura.</summary>
        [HttpPut("{id}/saldo-inicial")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> AtualizarSaldoInicial(Guid id, [FromBody] AtualizarSaldoInicialDto dto)
        {
            var usuarioId = GetUserId();
            await _service.AtualizarSaldoInicialAsync(id, usuarioId, dto.Valor, dto.Data);
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

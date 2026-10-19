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
        private readonly EncerramentoContaService _encerramento;
        private readonly MetaService _metas;

        public ContasController(ContaService service, EncerramentoContaService encerramento, MetaService metas)
        {
            _service = service;
            _encerramento = encerramento;
            _metas = metas;
        }

        private Guid GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
                throw new UnauthorizedAccessException("Usuário não identificado");
            return userId;
        }

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
        private static ContaDto ToDto(Conta c, decimal saldoAtual, (decimal Valor, DateOnly Data)? saldoInicial = null) => new()
        {
            Id = c.Id,
            SaldoInicial = saldoInicial?.Valor ?? 0m,
            DataSaldoInicial = saldoInicial?.Data,
            Nome = c.Nome,
            NumeroConta = c.NumeroConta,
            Agencia = c.Agencia,
            Tipo = (int)c.Tipo,
            TipoDescricao = c.Tipo.Descricao(),
            TipoCartao = c.TipoCartao != null ? (int)c.TipoCartao : null,
            TipoCartaoDescricao = DescricaoTipoCartao(c.TipoCartao),
            SaldoAtual = saldoAtual,
            IsCarteira = c.IsCarteira,
            BancoId = c.BancoId,
            BancoNome = c.Banco?.Nome ?? string.Empty,
            BancoLogoUrl = c.Banco?.LogoUrl,
            BancoCor = c.Banco?.Cor,
            EncerradaEm = c.EncerradaEm,
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

        /// <summary>
        /// Contas do usuário com o saldo atual. Encerradas ficam fora (seleções de conta no app); a tela de
        /// Bancos/contas pede <paramref name="incluirEncerradas"/>=true pra mostrar a seção "Encerradas".
        /// Caixinhas de meta (tipo 7) também ficam fora, salvo <paramref name="incluirCaixinhas"/> (Bancos): o
        /// dinheiro delas entra e sai só por Metas.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> Listar([FromQuery] bool incluirEncerradas = false, [FromQuery] bool incluirCaixinhas = false)
        {
            var usuarioId = GetUserId();
            var lista = await _service.ListarAsync(usuarioId, incluirEncerradas);
            if (!incluirCaixinhas)
                lista = lista.Where(c => c.Tipo != TipoConta.Caixinha).ToList();
            var saldos = await _service.ObterSaldosAsync(lista.Select(c => c.Id), usuarioId);
            var iniciais = await _service.ObterSaldosIniciaisAsync(lista.Select(c => c.Id), usuarioId);
            var metaDaCaixinha = await _metas.MetaPorCaixinhaAsync(lista.Where(c => c.Tipo == TipoConta.Caixinha).Select(c => c.Id));
            return Ok(lista.Select(c =>
            {
                var dto = ToDto(c, saldos[c.Id].Saldo, iniciais.TryGetValue(c.Id, out var si) ? si : null);
                dto.MetaId = metaDaCaixinha.TryGetValue(c.Id, out var m) ? m : null;
                return dto;
            }));
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> BuscarPorId(Guid id)
        {
            var usuarioId = GetUserId();
            var conta = await _service.BuscarPorIdAsync(id, usuarioId);
            if (conta == null) return NotFound();
            var saldos = await _service.ObterSaldosAsync(new[] { conta.Id }, usuarioId);
            var iniciais = await _service.ObterSaldosIniciaisAsync(new[] { conta.Id }, usuarioId);
            return Ok(ToDto(conta, saldos[conta.Id].Saldo, iniciais.TryGetValue(conta.Id, out var si) ? si : null));
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
            };

            var criada = await _service.CriarAsync(conta, usuarioId, dto.SaldoInicial, dto.DataSaldoInicial);
            // Saldo lido do banco (já com o lançamento de saldo inicial gravado) pela mesma regra.
            var saldos = await _service.ObterSaldosAsync(new[] { criada.Id }, usuarioId);
            var iniciais = await _service.ObterSaldosIniciaisAsync(new[] { criada.Id }, usuarioId);
            return CreatedAtAction(nameof(BuscarPorId), new { id = criada.Id }, ToDto(criada, saldos[criada.Id].Saldo, iniciais.TryGetValue(criada.Id, out var si) ? si : null));
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

        /// <summary>
        /// Encerra a conta (fechada no banco): sai das listas e não recebe lançamento novo; o histórico fica.
        /// Com saldo, o corpo diz o que aconteceu com o dinheiro — <c>contaDestinoId</c> (vira transferência) ou
        /// <c>ajustar</c> (no banco já está zerado). Requer header Idempotency-Key: reenviar com a mesma chave
        /// devolve o mesmo resultado sem transferir 2x. Conta fixa ou lançamento previsto na conta → 409.
        /// </summary>
        [HttpPost("{id}/encerrar")]
        [ProducesResponseType(typeof(EncerramentoContaDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status409Conflict)]
        public async Task<IActionResult> Encerrar(Guid id, [FromBody] EncerrarContaDto dto,
            [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey)
        {
            var usuarioId = GetUserId();
            return Ok(await _encerramento.EncerrarAsync(id, dto, usuarioId, idempotencyKey));
        }

        /// <summary>Reabre a conta encerrada (volta pras listas e pode receber lançamento).</summary>
        [HttpPost("{id}/reabrir")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Reabrir(Guid id)
        {
            var usuarioId = GetUserId();
            await _encerramento.ReabrirAsync(id, usuarioId);
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

using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.DTOs.Familia;
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
        private readonly DespesaCompartilhadaService _despesaCompartilhada;
        private readonly DependenteService _dependenteService;
        private readonly RateioService _rateioService;

        public TransacoesController(
            TransacaoService service,
            DespesaCompartilhadaService despesaCompartilhada,
            DependenteService dependenteService,
            RateioService rateioService)
        {
            _service = service;
            _despesaCompartilhada = despesaCompartilhada;
            _dependenteService = dependenteService;
            _rateioService = rateioService;
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
        [ProducesResponseType(typeof(IEnumerable<TransacaoDto>), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> Criar([FromBody] CriarTransacaoDto dto)
        {
            var usuarioId = GetUserId();

            // Parcelamento → cria N transações e retorna lista
            if (dto.Parcelas.HasValue && dto.Parcelas.Value > 1)
            {
                dto.Data = dto.Data.ToUniversalTime();
                var parcelas = await _service.CriarParcelamentoAsync(dto, usuarioId);
                var retornoParcelas = parcelas.Select(ToDto).ToList();
                return StatusCode(StatusCodes.Status201Created, retornoParcelas);
            }

            // Transação à vista
            var transacao = new Transacao
            {
                Id = Guid.NewGuid(),
                Descricao = dto.Descricao,
                Valor = dto.Valor,
                Tipo = (TipoTransacao)dto.Tipo,
                CategoriaId = dto.CategoriaId == Guid.Empty ? null : dto.CategoriaId,
                SubcategoriaId = dto.SubcategoriaId,
                ContaId = dto.ContaId,
                CartaoCreditoId = dto.CartaoCreditoId,
                UsadoComoCredito = dto.UsadoComoCredito,
                MeioPagamento = dto.MeioPagamento.HasValue ? (MeioPagamento)dto.MeioPagamento.Value : null,
                // Efetivado → entra no saldo real; não efetivado → previsão (futura permitida).
                StatusTransacao = dto.Efetivado ? StatusTransacao.Executado : StatusTransacao.Previsao,
                Data = dto.Data.ToUniversalTime()
            };

            var criada = await _service.CriarTransacaoAsync(transacao, usuarioId);
            return CreatedAtAction(nameof(BuscarPorId), new { id = criada.Id }, ToDto(criada));
        }

        private static TransacaoDto ToDto(Transacao t) => new()
        {
            Id = t.Id,
            Descricao = t.Descricao,
            Valor = t.Valor,
            Tipo = (int)t.Tipo,
            CategoriaId = t.CategoriaId,
            SubcategoriaId = t.SubcategoriaId,
            ContaId = t.ContaId,
            ContaNome = t.Conta?.Nome,
            CartaoCreditoId = t.CartaoCreditoId,
            CartaoCreditoNome = t.CartaoCredito?.Nome,
            UsadoComoCredito = t.UsadoComoCredito,
            MeioPagamento = t.MeioPagamento.HasValue ? (int)t.MeioPagamento.Value : null,
            MeioPagamentoDescricao = MeioPagamentoLabel(t.MeioPagamento),
            FaturaId = t.FaturaId,
            RecorrenteOrigemId = t.RecorrenteOrigemId,
            ParcelamentoId = t.ParcelamentoId,
            ParcelaTransacaoId = t.ParcelaTransacaoId,
            EhPagamentoFatura = t.EhPagamentoFatura,
            StatusTransacao = (int)t.StatusTransacao,
            Data = t.Data,
        };

        [HttpGet]
        [ProducesResponseType(typeof(PagedResult<TransacaoDto>), StatusCodes.Status200OK)]
        public async Task<IActionResult> Listar(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 25,
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            [FromQuery] Guid? categoriaId = null,
            [FromQuery] string? q = null,
            [FromQuery] int? tipo = null,
            [FromQuery] Guid? contaId = null,
            [FromQuery] Guid? cartaoId = null,
            [FromQuery] decimal? valorMin = null,
            [FromQuery] decimal? valorMax = null,
            [FromQuery] int? status = null,
            [FromQuery] string? ordenacao = null)
        {
            var usuarioId = GetUserId();
            var resultado = await _service.ListarAsync(
                usuarioId, page, pageSize, from, to, categoriaId, q, tipo,
                contaId, cartaoId, valorMin, valorMax, status, ordenacao);

            return Ok(new PagedResult<TransacaoDto>
            {
                Items = resultado.Items.Select(ToDto),
                Total = resultado.Total,
                Page = resultado.Page,
                PageSize = resultado.PageSize,
            });
        }

        /// <summary>
        /// KPIs agregados — entradas, saídas, saldo do período e quantidade.
        /// Calculado direto no banco, exato pra qualquer volume.
        /// </summary>
        [HttpGet("stats")]
        [ProducesResponseType(typeof(DTOs.Transacao.TransacaoStatsDto), StatusCodes.Status200OK)]
        public async Task<IActionResult> ObterStats(
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            [FromQuery] Guid? categoriaId = null)
        {
            var usuarioId = GetUserId();
            var stats = await _service.ObterStatsAsync(usuarioId, from, to, categoriaId);
            return Ok(stats);
        }

        [HttpGet("{id}")]
        [ProducesResponseType(typeof(TransacaoDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> BuscarPorId(Guid id)
        {
            var usuarioId = GetUserId();
            var transacao = await _service.BuscarPorIdAsync(id, usuarioId);

            if (transacao == null) return NotFound();
            return Ok(ToDto(transacao));
        }

        [HttpPut("{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Atualizar(Guid id, [FromBody] CriarTransacaoDto dto)
        {
            var usuarioId = GetUserId();
            var dados = new Transacao
            {
                Descricao = dto.Descricao,
                Valor = dto.Valor,
                Tipo = (TipoTransacao)dto.Tipo,
                CategoriaId = dto.CategoriaId,
                SubcategoriaId = dto.SubcategoriaId,
                MeioPagamento = dto.MeioPagamento.HasValue ? (MeioPagamento)dto.MeioPagamento.Value : null,
                Data = dto.Data.ToUniversalTime()
            };
            var ok = await _service.AtualizarAsync(id, dados, usuarioId);
            return ok ? NoContent() : NotFound();
        }

        [HttpDelete("{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Deletar(Guid id)
        {
            var usuarioId = GetUserId();
            var ok = await _service.DeletarAsync(id, usuarioId);
            return ok ? NoContent() : NotFound();
        }

        private static string? MeioPagamentoLabel(MeioPagamento? meio) => meio switch
        {
            Domain.Enums.MeioPagamento.Dinheiro => "Dinheiro",
            Domain.Enums.MeioPagamento.Debito   => "Débito",
            Domain.Enums.MeioPagamento.Credito  => "Crédito",
            Domain.Enums.MeioPagamento.Pix      => "Pix",
            Domain.Enums.MeioPagamento.Ted      => "TED/DOC",
            Domain.Enums.MeioPagamento.Boleto   => "Boleto",
            _ => null
        };

        [HttpGet("resumo/{contaId}")]
        [ProducesResponseType(typeof(ResumoFinanceiroDto), StatusCodes.Status200OK)]
        public async Task<IActionResult> ObterResumo(Guid contaId)
        {
            var usuarioId = GetUserId();
            var resumo = await _service.ObterResumoPorContaAsync(contaId, usuarioId);

            return Ok(resumo);
        }

        /// <summary>Marca a transação como despesa compartilhada com uma família.</summary>
        [HttpPut("{id:guid}/compartilhamento")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        public async Task<IActionResult> Compartilhar(Guid id, [FromBody] CompartilharTransacaoDto dto)
        {
            await _despesaCompartilhada.CompartilharAsync(id, dto.FamiliaId, GetUserId());
            return NoContent();
        }

        /// <summary>Desfaz o compartilhamento — a transação volta a ser pessoal.</summary>
        [HttpDelete("{id:guid}/compartilhamento")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        public async Task<IActionResult> Descompartilhar(Guid id)
        {
            await _despesaCompartilhada.DescompartilharAsync(id, GetUserId());
            return NoContent();
        }

        /// <summary>Atribui (ou desatribui, com dependenteId null) a transação a um dependente.</summary>
        [HttpPut("{id:guid}/dependente")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        public async Task<IActionResult> AtribuirDependente(Guid id, [FromBody] AtribuirDependenteDto dto)
        {
            await _dependenteService.AtribuirAsync(id, GetUserId(), dto.DependenteId);
            return NoContent();
        }

        /// <summary>Lê o modo de rateio (e itens personalizados) da despesa.</summary>
        [HttpGet("{id:guid}/rateio")]
        [ProducesResponseType(typeof(RateioTransacaoDto), StatusCodes.Status200OK)]
        public async Task<IActionResult> ObterRateio(Guid id)
        {
            return Ok(await _rateioService.ObterRateioTransacaoAsync(id, GetUserId()));
        }

        /// <summary>Define o modo de rateio (e itens, se Personalizado) da despesa.</summary>
        [HttpPut("{id:guid}/rateio")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        public async Task<IActionResult> DefinirRateio(Guid id, [FromBody] DefinirRateioTransacaoDto dto)
        {
            await _rateioService.DefinirRateioTransacaoAsync(id, GetUserId(), dto);
            return NoContent();
        }

        /// <summary>Remove o override de rateio — a despesa volta ao padrão da família.</summary>
        [HttpDelete("{id:guid}/rateio")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        public async Task<IActionResult> RemoverRateio(Guid id)
        {
            await _rateioService.RemoverRateioTransacaoAsync(id, GetUserId());
            return NoContent();
        }
    }
}
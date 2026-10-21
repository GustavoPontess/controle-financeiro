using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.DTOs.Parcelamento;
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
        private readonly LancamentoService _lancamentos;
        private readonly ParcelamentoService _parcelamentos;
        private readonly AvisoDeCompraService _aviso;

        public TransacoesController(
            TransacaoService service,
            DespesaCompartilhadaService despesaCompartilhada,
            DependenteService dependenteService,
            RateioService rateioService,
            LancamentoService lancamentos,
            ParcelamentoService parcelamentos,
            AvisoDeCompraService aviso)
        {
            _aviso = aviso;
            _service = service;
            _despesaCompartilhada = despesaCompartilhada;
            _dependenteService = dependenteService;
            _rateioService = rateioService;
            _lancamentos = lancamentos;
            _parcelamentos = parcelamentos;
        }

        private Guid GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
                throw new UnauthorizedAccessException("Usuário não identificado");
            return userId;
        }

        /// <summary>
        /// Cria um lançamento. Com <c>parcelas</c> &gt; 1 (só no cartão) vira um parcelamento de verdade e devolve
        /// o parcelamento (as parcelas vão nas faturas; a compra aparece uma vez em Transações › Gastos).
        /// </summary>
        [HttpPost]
        [ProducesResponseType(typeof(TransacaoDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ParcelamentoDetalheDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> Criar(
            [FromBody] CriarTransacaoDto dto,
            [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey)
        {
            var usuarioId = GetUserId();

            // Compra parcelada → parcelamento de verdade (nunca N lançamentos soltos)
            if (dto.Parcelas.HasValue && dto.Parcelas.Value > 1)
            {
                // Parcela dividida com a família ainda não existe: recusar em vez de ignorar o pedido calado.
                if (dto.FamiliaId is not null)
                    throw new ArgumentException("Compra parcelada ainda não divide com a família.");
                var parcelamento = await _parcelamentos.CriarDoLancamentoAsync(dto, usuarioId, idempotencyKey);
                return StatusCode(StatusCodes.Status201Created, parcelamento);
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
                MeioPagamento = MeioPagamentoExtensions.DoCliente(dto.MeioPagamento),
                // Efetivado → entra no saldo real; não efetivado → previsão (futura permitida).
                StatusTransacao = dto.Efetivado ? StatusTransacao.Executado : StatusTransacao.Previsao,
                Data = dto.Data,
                Hora = dto.Hora
            };

            // "Dividir com a família" na nova despesa: confere antes (família, permissão, tipo) pra não nascer sem dividir.
            if (dto.FamiliaId is { } familiaId)
                await _despesaCompartilhada.ExigirPodeDividirAsync(familiaId, usuarioId, transacao);
            var criada = await _service.CriarTransacaoAsync(transacao, usuarioId, idempotencyKey);
            if (dto.FamiliaId is { } fid && criada.FamiliaId is null)
                await _despesaCompartilhada.CompartilharAsync(criada.Id, fid, usuarioId);
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
            EhTransferencia = t.EhTransferencia,
            EhEmprestimo = t.EhEmprestimo,
            EhAcerto = t.EhAcerto,
            FamiliaId = t.FamiliaId,
            StatusAprovacao = (int)t.StatusAprovacao,
            DependenteId = t.DependenteId,
            ResponsavelUsuarioId = t.ResponsavelUsuarioId,
            StatusTransacao = (int)t.StatusTransacao,
            Data = t.Data,
            Hora = t.Hora,
        };

        // Compra parcelada na visão Gastos: uma linha só, na data da compra, com o total (com juros, se tiver).
        private static TransacaoDto ToDto(Parcelamento p)
        {
            var total = p.ValorComJuros ?? p.ValorTotal;
            return new()
            {
                Id = p.Id,
                Descricao = p.Descricao,
                Valor = total,
                Tipo = (int)TipoTransacao.Despesa,
                CategoriaId = p.CategoriaId,
                SubcategoriaId = p.SubcategoriaId,
                CartaoCreditoId = p.CartaoCreditoId,
                CartaoCreditoNome = p.CartaoCredito?.Nome,
                UsadoComoCredito = true,
                MeioPagamento = (int)MeioPagamento.Credito,
                MeioPagamentoDescricao = MeioPagamentoLabel(MeioPagamento.Credito),
                ParcelamentoId = p.Id,
                EhCompraParcelada = true,
                Parcelas = p.QuantidadeParcelas,
                ValorParcela = Math.Round(total / p.QuantidadeParcelas, 2),
                StatusTransacao = (int)StatusTransacao.Executado,
                Data = DateOnly.FromDateTime(p.DataCompra),
            };
        }

        [HttpGet]
        [ProducesResponseType(typeof(PagedResult<TransacaoDto>), StatusCodes.Status200OK)]
        public async Task<IActionResult> Listar(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 25,
            [FromQuery] DateOnly? from = null,
            [FromQuery] DateOnly? to = null,
            [FromQuery] Guid? categoriaId = null,
            [FromQuery] string? q = null,
            [FromQuery] int? tipo = null,
            [FromQuery] Guid? contaId = null,
            [FromQuery] Guid? cartaoId = null,
            [FromQuery] decimal? valorMin = null,
            [FromQuery] decimal? valorMax = null,
            [FromQuery] int? status = null,
            [FromQuery] string? ordenacao = null,
            [FromQuery] bool apenasCaixa = false,
            [FromQuery] int? meioPagamento = null,
            [FromQuery] string? natureza = null,
            [FromQuery] string? visao = null)
        {
            var usuarioId = GetUserId();
            // visao=gastos: o que a pessoa gastou, na data em que gastou (conta e cartão; compra parcelada uma
            // vez, com o total). Sem visao: o extrato de sempre (com apenasCaixa, só o que mexe no saldo).
            if (visao == "gastos")
            {
                var gastos = await _service.ListarGastosAsync(
                    usuarioId, page, pageSize, from, to, categoriaId, q, tipo,
                    contaId, cartaoId, valorMin, valorMax, status, ordenacao, meioPagamento, natureza);
                return Ok(new PagedResult<TransacaoDto>
                {
                    Items = gastos.Items.Select(l => l.Parcelamento != null ? ToDto(l.Parcelamento) : ToDto(l.Transacao!)),
                    Total = gastos.Total,
                    Page = gastos.Page,
                    PageSize = gastos.PageSize,
                });
            }

            var resultado = await _service.ListarAsync(
                usuarioId, page, pageSize, from, to, categoriaId, q, tipo,
                contaId, cartaoId, valorMin, valorMax, status, ordenacao, apenasCaixa, meioPagamento, natureza);

            return Ok(new PagedResult<TransacaoDto>
            {
                Items = resultado.Items.Select(ToDto),
                Total = resultado.Total,
                Page = resultado.Page,
                PageSize = resultado.PageSize,
            });
        }

        /// <summary>
        /// Topo da visão Gastos: total do que a lista de Gastos mostra (mesmos filtros), em conta e no cartão.
        /// </summary>
        [HttpGet("gastos/resumo")]
        [ProducesResponseType(typeof(ResumoGastosDto), StatusCodes.Status200OK)]
        public async Task<IActionResult> ResumoGastos(
            [FromQuery] DateOnly? from = null,
            [FromQuery] DateOnly? to = null,
            [FromQuery] Guid? categoriaId = null,
            [FromQuery] string? q = null,
            [FromQuery] Guid? contaId = null,
            [FromQuery] Guid? cartaoId = null,
            [FromQuery] decimal? valorMin = null,
            [FromQuery] decimal? valorMax = null,
            [FromQuery] int? status = null,
            [FromQuery] int? meioPagamento = null)
            => Ok(await _service.ResumirGastosAsync(GetUserId(), from, to, categoriaId, q, null, contaId, cartaoId,
                valorMin, valorMax, status, meioPagamento, null));

        /// <summary>
        /// Antes de salvar uma compra: ela tira o dinheiro das contas fixas dos próximos 30 dias? No cartão olha o
        /// limite, na conta o saldo. 200 com o aviso (frase, contas uma por linha e o saldo/limite de hoje) ou 204
        /// quando não aperta nada. Só avisa.
        /// </summary>
        [HttpGet("aviso")]
        [ProducesResponseType(typeof(AvisoDeCompraDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        public async Task<IActionResult> Aviso([FromQuery] decimal valor, [FromQuery] Guid? contaId = null, [FromQuery] Guid? cartaoId = null)
        {
            // "Hoje" no Brasil (UTC-3): o dia em que a pessoa está lançando.
            var hoje = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(-3));
            var resposta = await _aviso.AvisarAsync(GetUserId(), valor, contaId, cartaoId, hoje);
            return resposta is null ? NoContent() : Ok(resposta);
        }

        /// <summary>
        /// KPIs agregados — entradas, saídas, saldo do período e quantidade.
        /// Calculado direto no banco, exato pra qualquer volume.
        /// </summary>
        [HttpGet("stats")]
        [ProducesResponseType(typeof(DTOs.Transacao.TransacaoStatsDto), StatusCodes.Status200OK)]
        public async Task<IActionResult> ObterStats(
            [FromQuery] DateOnly? from = null,
            [FromQuery] DateOnly? to = null,
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

        /// <summary>
        /// Edita o lançamento por completo — o mesmo formulário de criar. Conta, cartão e status mudam no lugar;
        /// virar transferência, conta fixa ou parcelado troca o registro numa transação só (o antigo é cancelado).
        /// Idempotency-Key opcional: repetir devolve o mesmo resultado; com outros dados → 409.
        /// </summary>
        [HttpPut("{id}")]
        [ProducesResponseType(typeof(EdicaoLancamentoResultadoDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status409Conflict)]
        public async Task<IActionResult> Atualizar(
            Guid id,
            [FromBody] EditarLancamentoDto dto,
            [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey)
        {
            var usuarioId = GetUserId();
            var resultado = await _lancamentos.EditarAsync(id, dto, usuarioId, idempotencyKey);
            return Ok(resultado);
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

        private static string? MeioPagamentoLabel(MeioPagamento? meio) => meio.Descricao();

        /// <summary>
        /// Entradas, saídas e saldo REAL da conta (lançamentos ativos e efetivados — sem previsões),
        /// o mesmo saldo da listagem de contas e do dashboard.
        /// </summary>
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
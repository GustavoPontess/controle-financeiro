using System.Globalization;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.DTOs.Parcelamento;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Coração do Issue #1 — orquestra criação, cancelamento, listagem e detalhe
/// de Parcelamentos (CompraParcelada e PIXCredito).
/// Spec: ARQUITETURA_PARCELAMENTO.md § "Fluxo 1: Criar Parcelamento" e
/// § "Fluxo 3: Cancelar Parcelamento".
/// </summary>
/// <remarks>
/// <para>Padrões obrigatórios deste service:</para>
/// <list type="bullet">
///   <item>Idempotência via <c>idempotencyKey</c> consultado no <see cref="FinancialEventLogService"/>.</item>
///   <item>Transação ACID (BeginTransaction) em mutações.</item>
///   <item>FinancialEventLog em cada mudança de saldo/limite com CorrelationId compartilhado.</item>
///   <item>Soft delete — cancelamento marca <c>Ativo=false</c>; nunca <c>Remove()</c>.</item>
///   <item>Recálculo de limite on-the-fly via <see cref="LimiteCalculatorService"/>, sem coluna stale.</item>
/// </list>
/// </remarks>
public class ParcelamentoService
{
    private readonly AppDbContext _context;
    private readonly FinancialEventLogService _eventLog;
    private readonly LimiteCalculatorService _limiteCalc;
    private readonly FaturaService _faturaService;

    public ParcelamentoService(
        AppDbContext context,
        FinancialEventLogService eventLog,
        LimiteCalculatorService limiteCalc,
        FaturaService faturaService)
    {
        _context = context;
        _eventLog = eventLog;
        _limiteCalc = limiteCalc;
        _faturaService = faturaService;
    }

    // ── Criar ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// Cria um Parcelamento + N ParcelaTransacao + resolve faturas correspondentes,
    /// dentro de uma transação ACID. Idempotente via dto.IdempotencyKey.
    /// </summary>
    public async Task<ParcelamentoDetalheDto> CriarAsync(CriarParcelamentoDto dto, Guid usuarioId)
    {
        // 1. Idempotência — se já existe log com a mesma key, retorna detalhe anterior.
        if (string.IsNullOrWhiteSpace(dto.IdempotencyKey))
            throw new InvalidOperationException("idempotencyKey é obrigatório.");

        var prev = await _eventLog.BuscarPorIdempotencyKeyAsync(usuarioId, dto.IdempotencyKey);
        if (prev != null && prev.Tipo == FinancialEventType.ParcelamentoCriado
            && prev.EntidadeAfetada == "Parcelamento")
        {
            return await ObterDetalheAsync(prev.EntidadeId, usuarioId);
        }

        // 2. Validações sintáticas
        if (dto.Valor <= 0)
            throw new InvalidOperationException("Valor deve ser maior que zero.");

        if (dto.Parcelas < 2 || dto.Parcelas > 36)
            throw new InvalidOperationException("Quantidade de parcelas deve estar entre 2 e 36.");

        if (dto.DataCompra.Date > DateTime.UtcNow.Date)
            throw new InvalidOperationException("Data da compra não pode ser futura.");

        if (dto.Tipo != TipoParcelamento.CompraParcelada && dto.Tipo != TipoParcelamento.PIXCredito)
            throw new InvalidOperationException(
                "Tipo deve ser CompraParcelada ou PIXCredito (Recorrente segue fluxo próprio).");

        // 3. Parse primeiraParcelaMes (yyyy-MM)
        if (!DateTime.TryParseExact(
                dto.PrimeiraParcelaMes + "-01",
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var primeiroDiaPrimeiraParcela))
        {
            throw new InvalidOperationException("primeiraParcelaMes deve estar no formato yyyy-MM.");
        }

        var hoje = DateTime.UtcNow.Date;
        var primeiroDiaMesAtual = new DateTime(hoje.Year, hoje.Month, 1);
        if (primeiroDiaPrimeiraParcela < primeiroDiaMesAtual)
            throw new InvalidOperationException(
                "primeiraParcelaMes não pode ser anterior ao mês atual.");

        // 4. Cartão — valida existência, posse, modalidade crédito e ativo
        var cartao = await _context.CartoesCredito
            .FirstOrDefaultAsync(c => c.Id == dto.CartaoCreditoId && c.CriadoPor == usuarioId)
            ?? throw new InvalidOperationException("Cartão não encontrado.");

        if (!cartao.TemCredito)
            throw new InvalidOperationException("Cartão não possui modalidade crédito.");

        if (!cartao.Ativo)
            throw new InvalidOperationException("Cartão inativo.");

        // 5. Categoria (opcional) — valida posse e Finalidade compatível com despesa
        if (dto.CategoriaId.HasValue)
        {
            var cat = await _context.Categorias
                .FirstOrDefaultAsync(c => c.Id == dto.CategoriaId.Value
                    && (c.UsuarioId == null || c.UsuarioId == usuarioId))
                ?? throw new InvalidOperationException("Categoria não encontrada.");

            if (cat.Finalidade != Finalidade.Despesa && cat.Finalidade != Finalidade.Ambas)
                throw new InvalidOperationException(
                    "Categoria incompatível com parcelamento (precisa ser Despesa ou Ambas).");
        }

        // 6. Juros (apenas PIXCredito)
        decimal? valorComJurosTotal = null;
        if (dto.Tipo == TipoParcelamento.PIXCredito)
        {
            if (!dto.TaxaJuroMensal.HasValue)
                throw new InvalidOperationException("PIXCredito requer TaxaJuroMensal.");

            if (dto.TaxaJuroMensal.Value < 1.99m || dto.TaxaJuroMensal.Value > 11.99m)
                throw new InvalidOperationException(
                    "TaxaJuroMensal deve estar entre 1.99% e 11.99%.");

            // MVP — juros simples: principal × taxa × N. IOF = 0 (placeholder; integração
            // com Open Finance no futuro fornece valores exatos).
            var jurosTotal = Math.Round(
                dto.Valor * (dto.TaxaJuroMensal.Value / 100m) * dto.Parcelas, 2);
            const decimal iofTotalMvp = 0m;
            valorComJurosTotal = dto.Valor + jurosTotal + iofTotalMvp;
        }
        else if (dto.TaxaJuroMensal.HasValue)
        {
            throw new InvalidOperationException("TaxaJuroMensal só é válida em PIXCredito.");
        }

        // 7. Validação de limite — recalcula on-the-fly, não confia em coluna stale
        var valorBloquear = valorComJurosTotal ?? dto.Valor;
        var limiteAtual = await _limiteCalc.CalcularAsync(dto.CartaoCreditoId, usuarioId);
        if (limiteAtual.LimiteDisponivel < valorBloquear)
            throw new InvalidOperationException(
                $"Limite insuficiente. Precisa de {valorBloquear:C}, " +
                $"disponível {limiteAtual.LimiteDisponivel:C}.");

        // 8. Calcular valores das parcelas (principal + opcional com juros)
        var valoresPorParcela = RatearValor(dto.Valor, dto.Parcelas);
        decimal[]? valoresComJuros = null;
        if (valorComJurosTotal.HasValue)
            valoresComJuros = RatearValor(valorComJurosTotal.Value, dto.Parcelas);

        // 9. Calcular datas de vencimento — dia da DataCompra, mês = primeiraParcelaMes + i
        var diaCompra = dto.DataCompra.Day;
        var datasVencimento = new DateTime[dto.Parcelas];
        for (int i = 0; i < dto.Parcelas; i++)
        {
            var mesAlvo = primeiroDiaPrimeiraParcela.AddMonths(i);
            int diaEfetivo = Math.Min(diaCompra, DateTime.DaysInMonth(mesAlvo.Year, mesAlvo.Month));
            datasVencimento[i] = new DateTime(mesAlvo.Year, mesAlvo.Month, diaEfetivo);
        }

        // 10. Transação ACID — INSERT Parcelamento + N ParcelaTransacao + 2 logs
        var correlationId = Guid.NewGuid();
        var parcelamentoId = Guid.NewGuid();
        var agora = DateTime.UtcNow;

        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            var parcelamento = new Parcelamento
            {
                Id = parcelamentoId,
                CriadoPor = usuarioId,
                Tipo = dto.Tipo,
                Descricao = dto.Descricao,
                DataCompra = dto.DataCompra.Date,
                ValorTotal = dto.Valor,
                ValorComJuros = valorComJurosTotal,
                QuantidadeParcelas = dto.Parcelas,
                TaxaJuroMensal = dto.TaxaJuroMensal,
                CartaoCreditoId = dto.CartaoCreditoId,
                CategoriaId = dto.CategoriaId,
                Ativo = true,
                CriadoEm = agora,
            };
            _context.Parcelamentos.Add(parcelamento);

            for (int i = 0; i < dto.Parcelas; i++)
            {
                // ObterOuCriarFaturaAsync pertence ao FaturaService — reaproveitamos
                // a lógica de cálculo de período/fechamento/vencimento já existente.
                var fatura = await _faturaService.ObterOuCriarFaturaAsync(
                    dto.CartaoCreditoId, datasVencimento[i], usuarioId);

                var parcela = new ParcelaTransacao
                {
                    Id = Guid.NewGuid(),
                    ParcelamentoId = parcelamentoId,
                    Numero = i + 1,
                    QuantidadeTotal = dto.Parcelas,
                    DataVencimento = datasVencimento[i],
                    Valor = valoresPorParcela[i],
                    ValorComJuros = valoresComJuros?[i],
                    TaxaJuro = dto.TaxaJuroMensal,
                    IOF = null, // MVP placeholder — preencher quando integração Open Finance
                    FaturaId = fatura.Id,
                    Status = StatusParcela.Pendente,
                    CriadoPor = usuarioId,
                    CriadoEm = agora,
                };
                _context.ParcelasTransacao.Add(parcela);
            }

            // FinancialEventLog: ParcelamentoCriado (com idempotencyKey no payload)
            _eventLog.Registrar(
                usuarioId: usuarioId,
                tipo: FinancialEventType.ParcelamentoCriado,
                entidade: "Parcelamento",
                entidadeId: parcelamentoId,
                correlationId: correlationId,
                origemAcao: "API",
                valorAntes: null,
                valorDepois: dto.Valor,
                payload: new
                {
                    idempotencyKey = dto.IdempotencyKey,
                    descricao = dto.Descricao,
                    tipo = dto.Tipo.ToString(),
                    cartaoCreditoId = dto.CartaoCreditoId,
                    parcelas = dto.Parcelas,
                    valorTotal = dto.Valor,
                    valorComJuros = valorComJurosTotal,
                    primeiraParcelaMes = dto.PrimeiraParcelaMes,
                });

            // FinancialEventLog: LimiteBloqueado (mesmo correlationId)
            _eventLog.Registrar(
                usuarioId: usuarioId,
                tipo: FinancialEventType.LimiteBloqueado,
                entidade: "CartaoCredito",
                entidadeId: dto.CartaoCreditoId,
                correlationId: correlationId,
                origemAcao: "API",
                valorAntes: limiteAtual.LimiteBloqueado,
                valorDepois: limiteAtual.LimiteBloqueado + valorBloquear,
                payload: new
                {
                    parcelamentoId,
                    delta = valorBloquear,
                });

            await _context.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        return await ObterDetalheAsync(parcelamentoId, usuarioId);
    }

    // ── Cancelar (soft delete) ────────────────────────────────────────────────

    /// <summary>
    /// Cancela parcelamento (soft delete). Parcelas Pendentes viram Canceladas.
    /// Parcelas Pagas são preservadas — response sinaliza requerEstorno=true. Pendente cuja fatura
    /// já está coberta pelo pagamento conta como Paga (<see cref="RegrasFinanceiras.ParcelaQuitadaPelaFatura"/>).
    /// As faturas das canceladas têm o estado de pagamento reconciliado com o novo total.
    /// Idempotente via dto.IdempotencyKey.
    /// </summary>
    public async Task<CancelamentoResultadoDto> CancelarAsync(
        Guid parcelamentoId,
        CancelarParcelamentoDto dto,
        Guid usuarioId)
    {
        if (string.IsNullOrWhiteSpace(dto.IdempotencyKey))
            throw new InvalidOperationException("idempotencyKey é obrigatório.");

        if (string.IsNullOrWhiteSpace(dto.Motivo))
            throw new InvalidOperationException("Motivo é obrigatório.");

        // Idempotência — se já cancelou com essa key, retorna resultado
        var prev = await _eventLog.BuscarPorIdempotencyKeyAsync(usuarioId, dto.IdempotencyKey);
        if (prev != null
            && prev.Tipo == FinancialEventType.ParcelamentoCancelado
            && prev.EntidadeId == parcelamentoId)
        {
            return await MontarCancelamentoResultadoAsync(parcelamentoId, usuarioId);
        }

        // Fatura de cada parcela COM o total dela (Transacoes + ParcelasTransacao): decide se a Pendente
        // já foi quitada pelo pagamento da fatura, pela cobertura real (ValorPago ≥ total).
        var parcelamento = await _context.Parcelamentos
            .Include(p => p.Parcelas)
                .ThenInclude(par => par.Fatura)
                    .ThenInclude(f => f!.Transacoes)
            .Include(p => p.Parcelas)
                .ThenInclude(par => par.Fatura)
                    .ThenInclude(f => f!.ParcelasTransacao)
            .FirstOrDefaultAsync(p => p.Id == parcelamentoId && p.CriadoPor == usuarioId)
            ?? throw new InvalidOperationException("Parcelamento não encontrado.");

        if (!parcelamento.Ativo)
            throw new InvalidOperationException("Parcelamento já está cancelado.");

        // Pendente em fatura coberta pelo pagamento já foi paga (invariante em RegrasFinanceiras): vira
        // Paga — preservada e sinalizando estorno — em vez de Cancelada. Cancelar tiraria do total um valor
        // já pago e o dinheiro sumia (fatura R$ 0 com R$ 300 pagos, requerEstorno=false). Avaliado ANTES de
        // mexer em qualquer parcela: o total de cada fatura ainda é o de antes do cancelamento.
        var quitadasPelaFatura = parcelamento.Parcelas
            .Where(p => RegrasFinanceiras.ParcelaQuitadaPelaFatura(_context, p))
            .ToList();
        var pendentes = parcelamento.Parcelas
            .Where(p => p.Status == StatusParcela.Pendente && !quitadasPelaFatura.Contains(p))
            .ToList();
        var pagas = parcelamento.Parcelas.Count(p => p.Status == StatusParcela.Paga) + quitadasPelaFatura.Count;
        // Limite liberado (trilha de auditoria) = valor das parcelas que o parcelamento deixa de dever.
        // É o teto: o limite segue o pago de cada fatura (RegrasFinanceiras.LimiteUsadoDaFatura), então
        // pagamento anterior da fatura já tinha soltado parte — o número real sai no NovoLimite do resultado.
        var valorBloqueadoLiberado = pendentes.Concat(quitadasPelaFatura).Sum(p => p.ValorComJuros ?? p.Valor);

        var correlationId = Guid.NewGuid();
        var agora = DateTime.UtcNow;

        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            parcelamento.Ativo = false;
            parcelamento.CanceladoEm = agora;
            parcelamento.MotivoCancelamento = dto.Motivo;

            foreach (var p in pendentes)
            {
                p.Status = StatusParcela.Cancelada;
                p.CanceladoEm = agora;
                p.MotivoCancelamento = dto.Motivo;
            }

            // Grava a quitação que a fatura já fez: sem isso a parcela seguiria "Pendente" num
            // parcelamento cancelado, e o replay idempotente (que conta pelo Status) perderia o estorno.
            foreach (var p in quitadasPelaFatura)
            {
                p.Status = StatusParcela.Paga;
                // Quitação da fatura, se é dela mesmo; senão agora. Fatura Parcial coberta (ciclo aberto) não
                // tem DataPagamentoTotal, e a quitação anterior à própria parcela (a fatura foi quitada, a
                // parcela entrou depois e outro cancelamento a cobriu) não é o momento em que ela foi paga.
                var quitadaEm = p.Fatura!.DataPagamentoTotal;
                p.PagoEm = quitadaEm is { } q && q >= p.CriadoEm ? q : agora;
            }

            // O total das faturas das canceladas caiu sem pagamento novo: reconcilia o estado (fatura já
            // coberta vira Pago se fechada; zerada sem pagamento fica NaoPago, nunca vencida).
            await RegrasFinanceiras.ReconciliarFaturasAposCancelamentoAsync(
                _context, _eventLog, pendentes.Select(p => p.FaturaId), usuarioId, correlationId, agora);

            _eventLog.Registrar(
                usuarioId: usuarioId,
                tipo: FinancialEventType.ParcelamentoCancelado,
                entidade: "Parcelamento",
                entidadeId: parcelamentoId,
                correlationId: correlationId,
                origemAcao: "API",
                valorAntes: parcelamento.ValorComJuros ?? parcelamento.ValorTotal,
                valorDepois: 0m,
                payload: new
                {
                    idempotencyKey = dto.IdempotencyKey,
                    motivo = dto.Motivo,
                    pendentesCanceladas = pendentes.Count,
                    pagasPreservadas = pagas,
                    quitadasPelaFatura = quitadasPelaFatura.Count,
                });

            foreach (var p in pendentes)
            {
                _eventLog.Registrar(
                    usuarioId: usuarioId,
                    tipo: FinancialEventType.ParcelaCancelada,
                    entidade: "ParcelaTransacao",
                    entidadeId: p.Id,
                    correlationId: correlationId,
                    origemAcao: "API",
                    valorAntes: p.ValorComJuros ?? p.Valor,
                    valorDepois: 0m,
                    payload: new
                    {
                        parcelamentoId,
                        numero = p.Numero,
                    });
            }

            if (valorBloqueadoLiberado > 0)
            {
                _eventLog.Registrar(
                    usuarioId: usuarioId,
                    tipo: FinancialEventType.LimiteLiberado,
                    entidade: "CartaoCredito",
                    entidadeId: parcelamento.CartaoCreditoId,
                    correlationId: correlationId,
                    origemAcao: "API",
                    valorAntes: valorBloqueadoLiberado,
                    valorDepois: 0m,
                    payload: new
                    {
                        parcelamentoId,
                        delta = -valorBloqueadoLiberado,
                    });
            }

            await _context.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        return await MontarCancelamentoResultadoAsync(parcelamentoId, usuarioId);
    }

    // ── Listagem ──────────────────────────────────────────────────────────────

    /// <summary>
    /// KPIs agregados — ativos e soma do valor restante (efetivo - pago). Total inclui cancelados.
    /// Calculado no banco, exato pra qualquer volume.
    /// </summary>
    public async Task<ParcelamentoStatsDto> ObterStatsAsync(Guid usuarioId)
    {
        var query = _context.Parcelamentos.Where(p => p.CriadoPor == usuarioId);
        var ativos = query.Where(p => p.Ativo);

        var qtdAtivos = await ativos.CountAsync();
        var qtdTotal = await query.CountAsync();

        // Valor restante = valor total efetivo (com juros se houver) - soma das parcelas pagas.
        // Cálculo em duas queries (sum vs sum) — EF traduz sem N+1.
        var totalEfetivoAtivos = await ativos
            .SumAsync(p => (decimal?)(p.ValorComJuros ?? p.ValorTotal)) ?? 0m;
        var pagoAtivos = await _context.ParcelasTransacao
            .Where(par => par.Parcelamento != null
                          && par.Parcelamento.CriadoPor == usuarioId
                          && par.Parcelamento.Ativo
                          && par.Status == StatusParcela.Paga)
            .SumAsync(par => (decimal?)(par.ValorComJuros ?? par.Valor)) ?? 0m;

        return new ParcelamentoStatsDto
        {
            Ativos = qtdAtivos,
            TotalRestante = totalEfetivoAtivos - pagoAtivos,
            QtdTotal = qtdTotal,
        };
    }

    public async Task<PagedResult<ParcelamentoDto>> ListarAsync(Guid usuarioId, bool? ativo = null, int page = 1, int pageSize = 25)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _context.Parcelamentos
            .Where(p => p.CriadoPor == usuarioId
                        && (!ativo.HasValue || p.Ativo == ativo.Value))
            .Include(p => p.CartaoCredito)
            .Include(p => p.Parcelas)
            .OrderByDescending(p => p.CriadoEm)
            .AsNoTracking();

        var total = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<ParcelamentoDto>
        {
            Items = items.Select(p => MontarDto(p, detalhe: false)),
            Total = total,
            Page = page,
            PageSize = pageSize,
        };
    }

    // ── Detalhe ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Detalhe completo do parcelamento (com lista de parcelas).
    /// Retorna mesmo se Ativo=false (histórico).
    /// </summary>
    public async Task<ParcelamentoDetalheDto> ObterDetalheAsync(Guid id, Guid usuarioId)
    {
        var parcelamento = await _context.Parcelamentos
            .Where(p => p.Id == id && p.CriadoPor == usuarioId)
            .Include(p => p.CartaoCredito)
            .Include(p => p.Parcelas)
                .ThenInclude(par => par.Fatura)
            .AsNoTracking()
            .FirstOrDefaultAsync()
            ?? throw new InvalidOperationException("Parcelamento não encontrado.");

        var dto = (ParcelamentoDetalheDto)MontarDto(parcelamento, detalhe: true);
        dto.Parcelas = parcelamento.Parcelas
            .OrderBy(par => par.Numero)
            .Select(par => new ParcelaDto
            {
                Id = par.Id,
                Numero = par.Numero,
                QuantidadeTotal = par.QuantidadeTotal,
                DataVencimento = par.DataVencimento,
                Valor = par.Valor,
                ValorComJuros = par.ValorComJuros,
                TaxaJuro = par.TaxaJuro,
                IOF = par.IOF,
                Status = par.Status,
                FaturaId = par.FaturaId,
                FaturaMesReferencia = par.Fatura?.DataFechamento ?? par.DataVencimento,
                PagoEm = par.PagoEm,
                CanceladoEm = par.CanceladoEm,
                MotivoCancelamento = par.MotivoCancelamento,
            })
            .ToList();

        return dto;
    }

    // ── Helpers privados ──────────────────────────────────────────────────────

    /// <summary>
    /// Distribui um valor total em N parcelas com 2 casas decimais.
    /// Centavos residuais (do arredondamento) vão para a última parcela.
    /// </summary>
    private static decimal[] RatearValor(decimal valorTotal, int n)
    {
        var resultado = new decimal[n];
        var valorPorParcela = Math.Round(valorTotal / n, 2);
        var resto = valorTotal - valorPorParcela * n;
        for (int i = 0; i < n; i++)
            resultado[i] = (i == n - 1) ? valorPorParcela + resto : valorPorParcela;
        return resultado;
    }

    /// <summary>
    /// Monta DTO de listagem ou detalhe a partir da entidade carregada.
    /// Calcula campos derivados (parcelasPagas, valorPago, valorRestante, próxima parcela).
    /// </summary>
    private static ParcelamentoDto MontarDto(Parcelamento p, bool detalhe)
    {
        ParcelamentoDto dto = detalhe ? new ParcelamentoDetalheDto() : new ParcelamentoDto();

        var parcelasPagas = p.Parcelas.Count(par => par.Status == StatusParcela.Paga);
        var valorPago = p.Parcelas
            .Where(par => par.Status == StatusParcela.Paga)
            .Sum(par => par.ValorComJuros ?? par.Valor);
        var valorTotalEfetivo = p.ValorComJuros ?? p.ValorTotal;
        var valorRestante = valorTotalEfetivo - valorPago;

        var proxima = p.Parcelas
            .Where(par => par.Status == StatusParcela.Pendente)
            .OrderBy(par => par.DataVencimento)
            .FirstOrDefault();

        dto.Id = p.Id;
        dto.Descricao = p.Descricao;
        dto.Tipo = p.Tipo;
        dto.DataCompra = p.DataCompra;
        dto.CartaoCreditoId = p.CartaoCreditoId;
        dto.CartaoCreditoNome = p.CartaoCredito?.Nome ?? string.Empty;
        dto.CategoriaId = p.CategoriaId;
        dto.QuantidadeParcelas = p.QuantidadeParcelas;
        dto.ParcelasPagas = parcelasPagas;
        dto.ValorOriginal = p.ValorTotal;
        dto.ValorComJuros = p.ValorComJuros;
        dto.TaxaJuroMensal = p.TaxaJuroMensal;
        dto.ValorPago = valorPago;
        dto.ValorRestante = valorRestante;
        dto.ProximaParcela = proxima == null ? null : new ProximaParcelaDto
        {
            Id = proxima.Id,
            Numero = proxima.Numero,
            DataVencimento = proxima.DataVencimento,
            Valor = proxima.Valor,
            ValorComJuros = proxima.ValorComJuros,
            FaturaId = proxima.FaturaId,
        };
        dto.Ativo = p.Ativo;
        dto.CanceladoEm = p.CanceladoEm;
        dto.MotivoCancelamento = p.MotivoCancelamento;
        dto.CriadoEm = p.CriadoEm;
        return dto;
    }

    /// <summary>
    /// Reconstroi <see cref="CancelamentoResultadoDto"/> a partir do estado atual
    /// — usado no replay idempotente e no retorno após commit do cancelamento.
    /// </summary>
    private async Task<CancelamentoResultadoDto> MontarCancelamentoResultadoAsync(
        Guid parcelamentoId,
        Guid usuarioId)
    {
        var parcelamento = await _context.Parcelamentos
            .Include(p => p.Parcelas)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == parcelamentoId && p.CriadoPor == usuarioId)
            ?? throw new InvalidOperationException("Parcelamento não encontrado.");

        var canceladas = parcelamento.Parcelas.Count(p => p.Status == StatusParcela.Cancelada);
        var pagas = parcelamento.Parcelas.Count(p => p.Status == StatusParcela.Paga);
        var snapshot = await _limiteCalc.CalcularAsync(parcelamento.CartaoCreditoId, usuarioId);

        return new CancelamentoResultadoDto
        {
            ParcelamentoId = parcelamentoId,
            Canceladas = canceladas,
            JaPagas = pagas,
            RequerEstorno = pagas > 0,
            NovoLimite = new LimiteSnapshotDto
            {
                CartaoId = snapshot.CartaoId,
                LimiteTotal = snapshot.LimiteTotal,
                LimiteBloqueado = snapshot.LimiteBloqueado,
                LimiteDisponivel = snapshot.LimiteDisponivel,
                ExposicaoFuturaPrevisao = snapshot.ExposicaoFuturaPrevisao,
            },
        };
    }
}

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
    private readonly TimeProvider _relogio;

    public ParcelamentoService(
        AppDbContext context,
        FinancialEventLogService eventLog,
        LimiteCalculatorService limiteCalc,
        FaturaService faturaService,
        TimeProvider? relogio = null)
    {
        _context = context;
        _eventLog = eventLog;
        _limiteCalc = limiteCalc;
        _faturaService = faturaService;
        // Opcional só pra testar com um "hoje" fixo a regra da fatura aberta (a 1ª parcela depende do
        // dia). O Program.cs não registra TimeProvider → vale o default (relógio do sistema); os
        // chamadores não mudam.
        _relogio = relogio ?? TimeProvider.System;
    }

    // Nome do mês sem CultureInfo("pt-BR"): a imagem de produção (alpine) roda com globalização
    // invariante, e lá o construtor lança CultureNotFoundException — o usuário veria um 400 técnico em
    // inglês no lugar da mensagem da regra.
    private static readonly string[] MesesPtBr =
    {
        "janeiro", "fevereiro", "março", "abril", "maio", "junho",
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
    };

    private static string RotuloMesFatura(DateTime fechamento) =>
        $"{MesesPtBr[fechamento.Month - 1]} de {fechamento.Year}";

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

        var agoraUtc = _relogio.GetUtcNow().UtcDateTime;
        if (dto.DataCompra.Date > agoraUtc.Date)
            throw new InvalidOperationException("Data da compra não pode ser futura.");

        if (dto.Tipo != TipoParcelamento.CompraParcelada && dto.Tipo != TipoParcelamento.PIXCredito)
            throw new InvalidOperationException(
                "Tipo deve ser CompraParcelada ou PIXCredito (Recorrente segue fluxo próprio).");

        // 3. Parse primeiraParcelaMes (yyyy-MM) — o mês em que FECHA a fatura da 1ª parcela.
        if (!DateTime.TryParseExact(
                dto.PrimeiraParcelaMes + "-01",
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var mesPrimeiraParcela))
        {
            throw new InvalidOperationException("primeiraParcelaMes deve estar no formato yyyy-MM.");
        }

        // 4. Cartão — valida existência, posse, modalidade crédito e ativo
        var cartao = await _context.CartoesCredito
            .FirstOrDefaultAsync(c => c.Id == dto.CartaoCreditoId && c.CriadoPor == usuarioId)
            ?? throw new InvalidOperationException("Cartão não encontrado.");

        if (!cartao.TemCredito)
            throw new InvalidOperationException("Cartão não possui modalidade crédito.");

        if (!cartao.Ativo)
            throw new InvalidOperationException("Cartão inativo.");

        // 4b. Piso da 1ª parcela = a MAIS TARDE entre:
        //  (a) a fatura em que a compra cai (a que fecha depois da DataCompra, mesma regra do lançamento
        //      à vista) — o banco não cobra parcela numa fatura que fechou antes da compra;
        //  (b) a 1ª fatura que ainda NÃO VENCEU — é a mais antiga que ainda pode receber cobrança.
        //      Compra retroativa (ex.: de junho, lançada em setembro) com parcela numa fatura vencida
        //      nascia Pendente lá: o FaturaAtrasoJob cobrava juros e multa dela e uma fatura já paga
        //      voltava a ter restante. Mas a fatura que JÁ FECHOU e ainda não venceu é válida: compra do
        //      dia 24 (fecha 25, vence 5) lançada no dia 28 é cobrada justamente nela — travar na aberta
        //      jogava a 1ª parcela uma fatura depois do banco (o bug que motivou esta regra).
        // "Hoje" = o dia mais cedo possível no Brasil agora (UTC-5, Acre): o form usa o dia LOCAL de
        // quem usa, e o back não pode ser mais estrito que ele — com o dia UTC, das 21h à meia-noite
        // de Brasília na véspera do fechamento, a fatura que o form sugere seria recusada.
        var hojeNoBrasil = agoraUtc.AddHours(-5).Date;
        var (_, fechamentoDaCompra) = FaturaService.CalcularPeriodo(dto.DataCompra.Date, cartao.DiaFechamento);
        var (fechamentoDaAnterior, fechamentoDaAberta) = FaturaService.CalcularPeriodo(hojeNoBrasil, cartao.DiaFechamento);
        // A fatura anterior à aberta (fechou em fechamentoDaAnterior) ainda aceita cobrança se não venceu.
        var fechamentoNaoVencido =
            FaturaService.CalcularVencimento(fechamentoDaAnterior, cartao.DiaVencimento) >= hojeNoBrasil
                ? fechamentoDaAnterior
                : fechamentoDaAberta;
        var pisoEhACompra = fechamentoDaCompra >= fechamentoNaoVencido;
        var piso = pisoEhACompra ? fechamentoDaCompra : fechamentoNaoVencido;
        if (mesPrimeiraParcela < new DateTime(piso.Year, piso.Month, 1))
            throw new InvalidOperationException(pisoEhACompra
                ? $"A primeira parcela não pode ser antes da fatura de {RotuloMesFatura(piso)}, em que a compra cai."
                : $"A primeira parcela não pode ser antes da fatura de {RotuloMesFatura(piso)} — as anteriores já venceram.");

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

        // 9. Transação ACID — INSERT Parcelamento + N ParcelaTransacao + 2 logs
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
                // Parcela N na fatura que FECHA em primeiraParcelaMes + N-1 (o rótulo da tela Cartões).
                // Antes a parcela ganhava o DIA DA COMPRA naquele mês e a fatura saía do ciclo dessa
                // data: compra depois do fechamento pulava uma fatura ("outubro" caía na que fecha em
                // novembro). Achar pelo mês de fechamento não depende do dia da compra.
                var mesDaParcela = mesPrimeiraParcela.AddMonths(i);
                var fatura = await _faturaService.ObterOuCriarFaturaAsync(
                    dto.CartaoCreditoId,
                    FaturaService.DataNoCicloQueFechaEm(mesDaParcela.Year, mesDaParcela.Month, cartao.DiaFechamento),
                    usuarioId);

                var parcela = new ParcelaTransacao
                {
                    Id = Guid.NewGuid(),
                    ParcelamentoId = parcelamentoId,
                    Numero = i + 1,
                    QuantidadeTotal = dto.Parcelas,
                    // Vencimento REAL da fatura (o que a tela Cartões mostra), não uma data inventada:
                    // a parcela é cobrada quando a fatura vence. Juros do PIX Crédito não usam essa data
                    // (juros simples × N), então o valor não muda.
                    DataVencimento = fatura.DataVencimento,
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
        // Só as faturas das Pendentes canceladas mudam de total: a quitada pela fatura vira Paga e segue
        // no total (o pagamento dela já está no ValorPago).
        var faturasAfetadas = pendentes.Select(p => p.Fatura!).Distinct().ToList();

        var correlationId = Guid.NewGuid();
        var agora = DateTime.UtcNow;

        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            // Limite antes da mudança, pra trilha de auditoria registrar o que REALMENTE soltou (abaixo).
            var usadoCartaoAntes = await RegrasFinanceiras.LimiteUsadoDoCartaoAsync(
                _context, parcelamento.CartaoCreditoId, usuarioId);
            var usadoFaturasAntes = faturasAfetadas.Sum(RegrasFinanceiras.LimiteUsadoDaFatura);

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

            // Limite liberado = queda do usado das faturas afetadas, não o valor das parcelas: o limite segue
            // o pago de cada fatura (RegrasFinanceiras.LimiteUsadoDaFatura), então pagamento anterior já
            // tinha soltado parte. Antes/depois = limite usado do CARTÃO; as outras faturas não mudaram.
            var limiteLiberado = usadoFaturasAntes - faturasAfetadas.Sum(RegrasFinanceiras.LimiteUsadoDaFatura);
            if (limiteLiberado > 0)
            {
                _eventLog.Registrar(
                    usuarioId: usuarioId,
                    tipo: FinancialEventType.LimiteLiberado,
                    entidade: "CartaoCredito",
                    entidadeId: parcelamento.CartaoCreditoId,
                    correlationId: correlationId,
                    origemAcao: "API",
                    valorAntes: usadoCartaoAntes,
                    valorDepois: usadoCartaoAntes - limiteLiberado,
                    payload: new
                    {
                        parcelamentoId,
                        valorParcelasCanceladas = pendentes.Sum(p => p.ValorComJuros ?? p.Valor),
                        delta = -limiteLiberado,
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
            // Fatura de cada parcela no mesmo SELECT (join, sem N+1): o card mostra a próxima parcela
            // pelo mês de fechamento da fatura dela — o rótulo da tela Cartões.
            .Include(p => p.Parcelas)
                .ThenInclude(par => par.Fatura)
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
                // Da fatura, não da parcela: parcelas criadas antes da regra do mês de fechamento
                // guardam o dia da compra como DataVencimento — a fatura sabe quando vence de fato.
                FaturaDataVencimento = par.Fatura?.DataVencimento ?? par.DataVencimento,
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
        // Restante = só o que ainda está Pendente. Antes era total − pago, o que contava parcela
        // Cancelada como "a pagar" (parcelamento cancelado com 1 de 2 paga mostrava restante R$ 100).
        var valorRestante = p.Parcelas
            .Where(par => par.Status == StatusParcela.Pendente)
            .Sum(par => par.ValorComJuros ?? par.Valor);

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
            FaturaMesReferencia = proxima.Fatura?.DataFechamento ?? proxima.DataVencimento,
            FaturaDataVencimento = proxima.Fatura?.DataVencimento ?? proxima.DataVencimento,
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

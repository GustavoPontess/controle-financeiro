using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.ParcelaTransacao;
using ControleFinanceiro.Api.DTOs.Parcelamento;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Operações em parcelas individuais: pagamento antecipado e cancelamento granular.
/// Spec: ARQUITETURA_PARCELAMENTO.md § "Fluxo 2: Pagar Parcela Antecipada" e
/// § "Fluxo 4: Cancelar Parcela Individual".
/// </summary>
/// <remarks>
/// <para>Padrões obrigatórios herdados de ParcelamentoService:</para>
/// <list type="bullet">
///   <item>Idempotência via <c>idempotencyKey</c> + <see cref="FinancialEventLogService"/>.</item>
///   <item>Transação ACID em toda mutação.</item>
///   <item>FinancialEventLog em cada mudança de saldo/limite com CorrelationId compartilhado.</item>
///   <item>Soft delete — cancelar marca <c>Status=Cancelada</c>; nunca <c>Remove()</c>.</item>
/// </list>
/// <para>
/// Cálculo de saldo da conta: dinâmico (SUM Receitas - SUM Despesas em Transacoes Ativo+Executado),
/// conforme convenção do projeto (Conta.Saldo não é persistido).
/// </para>
/// <para>
/// Cálculo do total da fatura: soma de transações legacy <c>UsadoComoCredito=true</c>
/// (crédito à vista) mais <see cref="ParcelaTransacao"/> da nova arquitetura — evita dupla contagem.
/// A transação de pagamento criada aqui tem <c>FaturaPagaId</c> (não <c>FaturaId</c>) e portanto
/// não polui o total da fatura.
/// </para>
/// </remarks>
public class ParcelaTransacaoService
{
    private readonly AppDbContext _context;
    private readonly FinancialEventLogService _eventLog;
    private readonly LimiteCalculatorService _limiteCalc;

    public ParcelaTransacaoService(
        AppDbContext context,
        FinancialEventLogService eventLog,
        LimiteCalculatorService limiteCalc)
    {
        _context = context;
        _eventLog = eventLog;
        _limiteCalc = limiteCalc;
    }

    // ── Pagar antecipado ─────────────────────────────────────────────────────

    /// <summary>
    /// Paga uma parcela individual debitando da conta informada.
    /// Atualiza Fatura.ValorPago e recalcula EstadoPagamento.
    /// Libera a parcela do LimiteBloqueado do cartão.
    /// Idempotente via <paramref name="dto"/>.IdempotencyKey.
    /// </summary>
    public async Task<PagarParcelaResultadoDto> PagarAntecipadoAsync(
        Guid parcelaId,
        PagarParcelaDto dto,
        Guid usuarioId)
    {
        if (string.IsNullOrWhiteSpace(dto.IdempotencyKey))
            throw new InvalidOperationException("idempotencyKey é obrigatório.");

        // 1. Idempotência — replay retorna estado atual sem duplicar
        var prev = await _eventLog.BuscarPorIdempotencyKeyAsync(usuarioId, dto.IdempotencyKey);
        if (prev != null
            && prev.Tipo == FinancialEventType.ParcelaPaga
            && prev.EntidadeId == parcelaId)
        {
            return await MontarPagarResultadoAsync(parcelaId, usuarioId);
        }

        // 2. Carregar parcela com dependências para validações e mutações
        var parcela = await _context.ParcelasTransacao
            .Include(p => p.Parcelamento)
            .Include(p => p.Fatura)
                .ThenInclude(f => f!.Transacoes)
            .Include(p => p.Fatura)
                .ThenInclude(f => f!.ParcelasTransacao)
            .FirstOrDefaultAsync(p => p.Id == parcelaId
                                      && p.Parcelamento!.CriadoPor == usuarioId)
            ?? throw new InvalidOperationException("Parcela não encontrada.");

        if (parcela.Status != StatusParcela.Pendente)
            throw new InvalidOperationException(
                $"Parcela já está {parcela.Status}. Apenas parcelas Pendentes podem ser pagas.");

        if (!parcela.Parcelamento!.Ativo)
            throw new InvalidOperationException(
                "Parcelamento cancelado. Não é possível pagar parcelas individualmente.");

        // 3. Validar conta de pagamento
        var conta = await _context.Contas
            .FirstOrDefaultAsync(c => c.Id == dto.ContaPagamentoId
                                      && c.UsuarioIdProprietario == usuarioId)
            ?? throw new InvalidOperationException("Conta de pagamento não encontrada.");

        // 4. Validar saldo dinâmico da conta (Receitas - Despesas; Conta.Saldo não é persistido)
        var valorParcela = parcela.ValorComJuros ?? parcela.Valor;

        var receitas = await _context.Transacoes
            .Where(t => t.ContaId == conta.Id
                        && t.Ativo
                        && t.StatusTransacao == StatusTransacao.Executado
                        && t.Tipo == TipoTransacao.Receita)
            .SumAsync(t => (decimal?)t.Valor) ?? 0m;

        var despesas = await _context.Transacoes
            .Where(t => t.ContaId == conta.Id
                        && t.Ativo
                        && t.StatusTransacao == StatusTransacao.Executado
                        && t.Tipo == TipoTransacao.Despesa)
            .SumAsync(t => (decimal?)t.Valor) ?? 0m;

        var saldo = receitas - despesas;
        if (saldo < valorParcela)
            throw new InvalidOperationException(
                $"Saldo insuficiente. Necessário {valorParcela:C}, disponível {saldo:C}.");

        // 5. Fatura não pode estar integralmente paga
        var fatura = parcela.Fatura!;
        if (fatura.EstadoPagamento == EstadoPagamentoFatura.Pago)
            throw new InvalidOperationException(
                "A fatura desta parcela já está integralmente paga.");

        // 6. Transação ACID
        var correlationId = Guid.NewGuid();
        var agora = DateTime.UtcNow;
        var dataPagamento = (dto.DataPagamento ?? agora).ToUniversalTime();

        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            // 6a. Marcar parcela como paga
            parcela.Status = StatusParcela.Paga;
            parcela.PagoEm = agora;

            // 6b. Inserir Transacao de débito na conta.
            //     FaturaId = null (não é transação de crédito pertencente à fatura).
            //     FaturaPagaId = fatura.Id (rastreia qual fatura foi quitada).
            //     Isso garante que a transação NÃO poluirá o cálculo do total da fatura.
            var pagamento = new Transacao
            {
                Id = Guid.NewGuid(),
                Descricao = $"Pagamento parcela {parcela.Numero}/{parcela.QuantidadeTotal}" +
                            $" — {parcela.Parcelamento.Descricao}",
                Valor = valorParcela,
                Tipo = TipoTransacao.Despesa,
                ContaId = dto.ContaPagamentoId,
                EhPagamentoFatura = true,
                FaturaPagaId = fatura.Id,
                StatusTransacao = StatusTransacao.Executado,
                Ativo = true,
                Data = dataPagamento,
                CriadoPor = usuarioId,
                CriadoEm = agora,
                ParcelamentoId = parcela.ParcelamentoId,
                ParcelaTransacaoId = parcelaId,
            };
            _context.Transacoes.Add(pagamento);

            // 6c. Atualizar Fatura — acumula ValorPago e recalcula EstadoPagamento
            fatura.ValorPago += valorParcela;
            var valorTotalFatura = CalcularValorTotalFatura(fatura);
            var novoEstado = RecalcularEstadoPagamento(fatura.ValorPago, valorTotalFatura);
            fatura.EstadoPagamento = novoEstado;
            if (novoEstado == EstadoPagamentoFatura.Pago)
            {
                fatura.DataPagamentoTotal = agora;
                fatura.EstaAtrasada = false;
            }

            // 6d. FinancialEventLog — ParcelaPaga (contém idempotencyKey para replay)
            _eventLog.Registrar(
                usuarioId: usuarioId,
                tipo: FinancialEventType.ParcelaPaga,
                entidade: "ParcelaTransacao",
                entidadeId: parcelaId,
                correlationId: correlationId,
                origemAcao: "API",
                valorAntes: valorParcela,
                valorDepois: 0m,
                payload: new
                {
                    idempotencyKey = dto.IdempotencyKey,
                    parcelamentoId = parcela.ParcelamentoId,
                    numero = parcela.Numero,
                    faturaId = fatura.Id,
                    contaPagamentoId = dto.ContaPagamentoId,
                    valorPago = valorParcela,
                });

            // 6e. FinancialEventLog — LimiteLiberado (parcela sai de Pendente → não bloqueia mais)
            _eventLog.Registrar(
                usuarioId: usuarioId,
                tipo: FinancialEventType.LimiteLiberado,
                entidade: "CartaoCredito",
                entidadeId: parcela.Parcelamento.CartaoCreditoId,
                correlationId: correlationId,
                origemAcao: "API",
                valorAntes: valorParcela,
                valorDepois: 0m,
                payload: new
                {
                    parcelamentoId = parcela.ParcelamentoId,
                    parcelaId,
                    delta = -valorParcela,
                });

            // 6f. FinancialEventLog — FaturaPagaTotal ou FaturaPagaParcial
            var tipoFaturaEvento = novoEstado == EstadoPagamentoFatura.Pago
                ? FinancialEventType.FaturaPagaTotal
                : FinancialEventType.FaturaPagaParcial;

            _eventLog.Registrar(
                usuarioId: usuarioId,
                tipo: tipoFaturaEvento,
                entidade: "Fatura",
                entidadeId: fatura.Id,
                correlationId: correlationId,
                origemAcao: "API",
                valorAntes: fatura.ValorPago - valorParcela,
                valorDepois: fatura.ValorPago,
                payload: new
                {
                    valorTotal = valorTotalFatura,
                    estadoPagamento = novoEstado.ToString(),
                });

            await _context.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        return await MontarPagarResultadoAsync(parcelaId, usuarioId);
    }

    // ── Cancelar parcela individual ──────────────────────────────────────────

    /// <summary>
    /// Cancela uma parcela individual (soft delete).
    /// NÃO cancela o parcelamento inteiro — use ParcelamentoService.CancelarAsync pra isso.
    /// Libera o valor da parcela no LimiteBloqueado do cartão.
    /// Idempotente via <paramref name="dto"/>.IdempotencyKey.
    /// </summary>
    public async Task<CancelarParcelaResultadoDto> CancelarAsync(
        Guid parcelaId,
        CancelarParcelaDto dto,
        Guid usuarioId)
    {
        if (string.IsNullOrWhiteSpace(dto.IdempotencyKey))
            throw new InvalidOperationException("idempotencyKey é obrigatório.");

        if (string.IsNullOrWhiteSpace(dto.Motivo))
            throw new InvalidOperationException("Motivo é obrigatório.");

        // 1. Idempotência
        var prev = await _eventLog.BuscarPorIdempotencyKeyAsync(usuarioId, dto.IdempotencyKey);
        if (prev != null
            && prev.Tipo == FinancialEventType.ParcelaCancelada
            && prev.EntidadeId == parcelaId)
        {
            return await MontarCancelarResultadoAsync(parcelaId, usuarioId);
        }

        // 2. Carregar parcela
        var parcela = await _context.ParcelasTransacao
            .Include(p => p.Parcelamento)
            .FirstOrDefaultAsync(p => p.Id == parcelaId
                                      && p.Parcelamento!.CriadoPor == usuarioId)
            ?? throw new InvalidOperationException("Parcela não encontrada.");

        if (parcela.Status != StatusParcela.Pendente)
            throw new InvalidOperationException(
                $"Parcela já está {parcela.Status}. Apenas parcelas Pendentes podem ser canceladas individualmente.");

        if (!parcela.Parcelamento!.Ativo)
            throw new InvalidOperationException(
                "Parcelamento já cancelado — todas as parcelas Pendentes já foram canceladas junto com ele.");

        var valorParcela = parcela.ValorComJuros ?? parcela.Valor;
        var correlationId = Guid.NewGuid();
        var agora = DateTime.UtcNow;

        // 3. Transação ACID
        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            parcela.Status = StatusParcela.Cancelada;
            parcela.CanceladoEm = agora;
            parcela.MotivoCancelamento = dto.Motivo;

            _eventLog.Registrar(
                usuarioId: usuarioId,
                tipo: FinancialEventType.ParcelaCancelada,
                entidade: "ParcelaTransacao",
                entidadeId: parcelaId,
                correlationId: correlationId,
                origemAcao: "API",
                valorAntes: valorParcela,
                valorDepois: 0m,
                payload: new
                {
                    idempotencyKey = dto.IdempotencyKey,
                    parcelamentoId = parcela.ParcelamentoId,
                    numero = parcela.Numero,
                    motivo = dto.Motivo,
                });

            _eventLog.Registrar(
                usuarioId: usuarioId,
                tipo: FinancialEventType.LimiteLiberado,
                entidade: "CartaoCredito",
                entidadeId: parcela.Parcelamento.CartaoCreditoId,
                correlationId: correlationId,
                origemAcao: "API",
                valorAntes: valorParcela,
                valorDepois: 0m,
                payload: new
                {
                    parcelamentoId = parcela.ParcelamentoId,
                    parcelaId,
                    delta = -valorParcela,
                });

            await _context.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        return await MontarCancelarResultadoAsync(parcelaId, usuarioId);
    }

    // ── Helpers privados ──────────────────────────────────────────────────────

    /// <summary>
    /// Valor total de uma fatura = legacy UsadoComoCredito + parcelas do novo sistema.
    /// Transações de pagamento (FaturaPagaId) são excluídas automaticamente porque
    /// não têm UsadoComoCredito=true e não aparecem em Fatura.ParcelasTransacao.
    /// </summary>
    private static decimal CalcularValorTotalFatura(Fatura fatura)
    {
        // Transações de crédito à vista (sistema legado — ParcelamentoId = null)
        var legacyTotal = fatura.Transacoes
            .Where(t => t.UsadoComoCredito && t.Ativo)
            .Sum(t => t.Valor);

        // Parcelas do sistema novo (ValorComJuros quando há juros PIX, senão Valor)
        var parcelasTotal = fatura.ParcelasTransacao
            .Sum(p => p.ValorComJuros ?? p.Valor);

        return legacyTotal + parcelasTotal;
    }

    /// <summary>
    /// Recalcula <see cref="EstadoPagamentoFatura"/> a partir dos valores atualizados.
    /// </summary>
    private static EstadoPagamentoFatura RecalcularEstadoPagamento(
        decimal valorPago, decimal valorTotal)
    {
        if (valorTotal <= 0) return EstadoPagamentoFatura.Pago; // fatura vazia / edge case
        if (valorPago <= 0)  return EstadoPagamentoFatura.NaoPago;
        return valorPago >= valorTotal
            ? EstadoPagamentoFatura.Pago
            : EstadoPagamentoFatura.Parcial;
    }

    /// <summary>
    /// Reconstroi <see cref="PagarParcelaResultadoDto"/> a partir do estado atual
    /// — usado no replay idempotente e no retorno pós-commit.
    /// </summary>
    private async Task<PagarParcelaResultadoDto> MontarPagarResultadoAsync(
        Guid parcelaId,
        Guid usuarioId)
    {
        var parcela = await _context.ParcelasTransacao
            .Include(p => p.Parcelamento)
            .Include(p => p.Fatura)
                .ThenInclude(f => f!.Transacoes)
            .Include(p => p.Fatura)
                .ThenInclude(f => f!.ParcelasTransacao)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == parcelaId
                                      && p.Parcelamento!.CriadoPor == usuarioId)
            ?? throw new InvalidOperationException("Parcela não encontrada.");

        var fatura = parcela.Fatura!;
        var valorTotal = CalcularValorTotalFatura(fatura);
        var snapshot = await _limiteCalc.CalcularAsync(
            parcela.Parcelamento!.CartaoCreditoId, usuarioId);

        return new PagarParcelaResultadoDto
        {
            ParcelaId = parcelaId,
            Status = parcela.Status,
            PagoEm = parcela.PagoEm ?? DateTime.UtcNow,
            FaturaAtualizada = new FaturaAtualizadaDto
            {
                Id = fatura.Id,
                EstadoPagamento = fatura.EstadoPagamento,
                ValorPago = fatura.ValorPago,
                ValorTotal = valorTotal,
                ValorRestante = Math.Max(0m, valorTotal - fatura.ValorPago),
            },
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

    /// <summary>
    /// Reconstroi <see cref="CancelarParcelaResultadoDto"/> a partir do estado atual
    /// — usado no replay idempotente e no retorno pós-commit.
    /// </summary>
    private async Task<CancelarParcelaResultadoDto> MontarCancelarResultadoAsync(
        Guid parcelaId,
        Guid usuarioId)
    {
        var parcela = await _context.ParcelasTransacao
            .Include(p => p.Parcelamento)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == parcelaId
                                      && p.Parcelamento!.CriadoPor == usuarioId)
            ?? throw new InvalidOperationException("Parcela não encontrada.");

        var snapshot = await _limiteCalc.CalcularAsync(
            parcela.Parcelamento!.CartaoCreditoId, usuarioId);

        return new CancelarParcelaResultadoDto
        {
            ParcelaId = parcelaId,
            Status = parcela.Status,
            CanceladoEm = parcela.CanceladoEm ?? DateTime.UtcNow,
            Motivo = parcela.MotivoCancelamento ?? string.Empty,
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

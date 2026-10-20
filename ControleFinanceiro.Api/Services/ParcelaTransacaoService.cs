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
/// Saldo da conta e total da fatura vêm de <see cref="RegrasFinanceiras"/> (regra única do projeto:
/// saldo = Ativo+Executado agregado no banco; total = crédito à vista + parcelas não canceladas).
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
    /// Libera a parcela do LimiteBloqueado do cartão. Recusa quando o restante da fatura é menor que a
    /// parcela (o já pago cobre ela, no todo ou em parte).
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
        if (conta.EncerradaEm != null)
            throw new InvalidOperationException(DonoRecursos.MensagemContaEncerrada(conta.Nome));

        // 4. Validar saldo dinâmico da conta (Conta.Saldo não é persistido) — mesmo saldo que a
        //    tela de contas e o dashboard mostram, pela regra única.
        var valorParcela = parcela.ValorComJuros ?? parcela.Valor;

        var saldo = (await RegrasFinanceiras.SaldoDaContaAsync(_context, conta.Id, usuarioId)).Saldo;
        if (saldo < valorParcela)
            throw new InvalidOperationException(
                $"Saldo insuficiente. Necessário {Reais.Formatar(valorParcela)}, disponível {Reais.Formatar(saldo)}.");

        // 5. Fatura da parcela — "já paga" é decidido pelo RESTANTE no passo 5b, não pelo rótulo Pago
        //    (compra nova numa fatura marcada Pago volta a ter restante).
        var fatura = parcela.Fatura!;

        // 5b. Nem coberta pelo que já foi pago, olhando o RESTANTE e não só o rótulo: com o ciclo aberto a
        //     fatura coberta fica Parcial com restante 0 até o fechamento (decisão em
        //     RegrasFinanceiras.ReconciliarEstadoPagamento), e pagamento parcial da fatura pode já cobrir
        //     parte da parcela. Pagar a parcela inteira aí debitava a conta de novo por dinheiro já pago
        //     (fatura total 150 com 200 pagos). O que falta vai pela fatura, que aceita até o restante.
        var restanteFatura = RegrasFinanceiras.ValorRestanteFatura(fatura);
        if (restanteFatura <= 0)
            throw new InvalidOperationException(
                "A fatura desta parcela já está coberta pelos pagamentos feitos. Não há o que antecipar.");
        if (restanteFatura < valorParcela)
            throw new InvalidOperationException(
                $"A fatura desta parcela já foi paga em parte e resta {Reais.Formatar(restanteFatura)}, menos que a parcela " +
                $"({Reais.Formatar(valorParcela)}). Pague o restante pela fatura.");

        // 6. Transação ACID
        var correlationId = Guid.NewGuid();
        var agora = DateTime.UtcNow;
        var dataPagamento = (dto.DataPagamento ?? agora).ToUniversalTime();

        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            // Limite antes da mudança, pra trilha de auditoria registrar o que REALMENTE soltou (6e).
            var cartaoId = parcela.Parcelamento.CartaoCreditoId;
            var usadoCartaoAntes = await RegrasFinanceiras.LimiteUsadoDoCartaoAsync(_context, cartaoId, usuarioId);
            var usadoFaturaAntes = RegrasFinanceiras.LimiteUsadoDaFatura(fatura);

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
                            $" · {parcela.Parcelamento.Descricao}",
                Valor = valorParcela,
                Tipo = TipoTransacao.Despesa,
                ContaId = dto.ContaPagamentoId,
                EhPagamentoFatura = true,
                FaturaPagaId = fatura.Id,
                StatusTransacao = StatusTransacao.Executado,
                Ativo = true,
                Data = DateOnly.FromDateTime(dataPagamento),
                Hora = null, // pagamento de parcela é datado (sem hora específica)
                CriadoPor = usuarioId,
                CriadoEm = agora,
                ParcelamentoId = parcela.ParcelamentoId,
                ParcelaTransacaoId = parcelaId,
            };
            _context.Transacoes.Add(pagamento);

            // 6c. Atualizar Fatura — acumula ValorPago e recalcula EstadoPagamento
            fatura.ValorPago += valorParcela;
            var valorTotalFatura = RegrasFinanceiras.ValorTotalFatura(fatura);
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

            // 6e. FinancialEventLog — LimiteLiberado: o pagamento soma no pago da fatura, e o limite segue o
            //     pago. Costuma ser a parcela inteira, mas a parte do pago que cobre previsão da fatura não
            //     solta nada (previsão não usa limite). Antes/depois = limite usado do CARTÃO; só esta
            //     fatura mudou, então a queda dela é a do cartão.
            var limiteLiberado = usadoFaturaAntes - RegrasFinanceiras.LimiteUsadoDaFatura(fatura);
            if (limiteLiberado > 0)
                _eventLog.Registrar(
                    usuarioId: usuarioId,
                    tipo: FinancialEventType.LimiteLiberado,
                    entidade: "CartaoCredito",
                    entidadeId: cartaoId,
                    correlationId: correlationId,
                    origemAcao: "API",
                    valorAntes: usadoCartaoAntes,
                    valorDepois: usadoCartaoAntes - limiteLiberado,
                    payload: new
                    {
                        parcelamentoId = parcela.ParcelamentoId,
                        parcelaId,
                        faturaId = fatura.Id,
                        valorParcela,
                        delta = -limiteLiberado,
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
    /// Libera no limite do cartão o que a fatura ainda segurava da parcela e reconcilia o estado de pagamento da
    /// fatura (<see cref="RegrasFinanceiras.ReconciliarEstadoPagamento"/>). Recusa parcela já quitada
    /// pelo pagamento da fatura — fatura coberta (<see cref="RegrasFinanceiras.ParcelaQuitadaPelaFatura"/>).
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

        // 2. Carregar parcela com a Fatura e o total dela (mesmas Includes do pagamento antecipado): decide
        //    se a parcela já foi quitada pelo pagamento da fatura, pela cobertura real.
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
                $"Parcela já está {parcela.Status}. Apenas parcelas Pendentes podem ser canceladas individualmente.");

        if (!parcela.Parcelamento!.Ativo)
            throw new InvalidOperationException(
                "Parcelamento já cancelado: todas as parcelas Pendentes já foram canceladas junto com ele.");

        // Pendente numa fatura coberta pelo pagamento já foi paga (invariante em RegrasFinanceiras):
        // cancelar tiraria do total um valor já pago e o dinheiro sumiria. Mesma recusa da parcela Paga.
        // Cobertura, não rótulo: parcela que caiu numa fatura já Pago segue devida e pode ser cancelada.
        if (RegrasFinanceiras.ParcelaQuitadaPelaFatura(_context, parcela))
            throw new InvalidOperationException(
                "A fatura desta parcela já foi paga: a parcela conta como paga e não pode ser cancelada individualmente.");

        var valorParcela = parcela.ValorComJuros ?? parcela.Valor;
        var correlationId = Guid.NewGuid();
        var agora = DateTime.UtcNow;
        var cartaoId = parcela.Parcelamento.CartaoCreditoId;
        var fatura = parcela.Fatura!;

        // 3. Transação ACID
        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            // Limite antes da mudança, pra trilha de auditoria registrar o que REALMENTE soltou (abaixo).
            var usadoCartaoAntes = await RegrasFinanceiras.LimiteUsadoDoCartaoAsync(_context, cartaoId, usuarioId);
            var usadoFaturaAntes = RegrasFinanceiras.LimiteUsadoDaFatura(fatura);

            parcela.Status = StatusParcela.Cancelada;
            parcela.CanceladoEm = agora;
            parcela.MotivoCancelamento = dto.Motivo;

            // O total da fatura caiu sem pagamento novo: reconcilia o estado (senão fatura já coberta
            // ficava Parcial pra sempre — atraso indevido, pagamento recusado).
            await RegrasFinanceiras.ReconciliarFaturasAposCancelamentoAsync(
                _context, _eventLog, new[] { parcela.FaturaId }, usuarioId, correlationId, agora);

            // O limite segue o pago da fatura: com ela paga em parte, cancelar solta só o que ela ainda
            // segurava, não a parcela inteira (total 300 com 250 pagos segurava 50; sem a parcela de 200,
            // nada). Só esta fatura mudou, então a queda dela é a queda do cartão.
            var limiteLiberado = usadoFaturaAntes - RegrasFinanceiras.LimiteUsadoDaFatura(fatura);

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

            // Antes/depois = limite usado do CARTÃO. Nada soltou (a fatura já não segurava nada) → sem evento.
            if (limiteLiberado > 0)
                _eventLog.Registrar(
                    usuarioId: usuarioId,
                    tipo: FinancialEventType.LimiteLiberado,
                    entidade: "CartaoCredito",
                    entidadeId: cartaoId,
                    correlationId: correlationId,
                    origemAcao: "API",
                    valorAntes: usadoCartaoAntes,
                    valorDepois: usadoCartaoAntes - limiteLiberado,
                    payload: new
                    {
                        parcelamentoId = parcela.ParcelamentoId,
                        parcelaId,
                        faturaId = fatura.Id,
                        valorParcela,
                        delta = -limiteLiberado,
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
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == parcelaId
                                      && p.Parcelamento!.CriadoPor == usuarioId)
            ?? throw new InvalidOperationException("Parcela não encontrada.");

        // Fatura numa query PRÓPRIA (raiz Faturas): encadear a partir de ParcelaTransacao
        // com Include(Fatura).ThenInclude(ParcelasTransacao) formava um ciclo de Include do
        // MESMO tipo (ParcelaTransacao→Fatura→ParcelasTransacao) que o EF Core rejeita em
        // VerifyNoCycles sob AsNoTracking → InvalidOperationException lançada APÓS o commit
        // (débito + fechamento da fatura já gravados) devolvendo 500 num pagamento que deu certo.
        var fatura = await _context.Faturas
            .Include(f => f.Transacoes)
            .Include(f => f.ParcelasTransacao)
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == parcela.FaturaId)
            ?? throw new InvalidOperationException("Fatura não encontrada.");

        var valorTotal = RegrasFinanceiras.ValorTotalFatura(fatura);
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
                ValorRestante = RegrasFinanceiras.ValorRestanteFatura(valorTotal, fatura.ValorPago),
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

using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Recorrente;
using ControleFinanceiro.Api.DTOs.Transacao;
using ControleFinanceiro.Api.DTOs.Transferencia;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Edição COMPLETA de um lançamento — o mesmo formulário de criar vale pra editar (pedido do Gustavo:
/// "posso ter colocado tudo e errado o tipo"). O que continua sendo despesa/receita é alterado no lugar
/// (<see cref="TransacaoService.AtualizarAsync"/>, inclusive conta, cartão e status). O que vira outro
/// registro — transferência (duas pernas), conta fixa, parcelamento — é trocado numa transação SÓ do
/// banco: cancela o antigo e cria o novo, ou nada acontece. Idempotency-Key (índice único usuário +
/// operação + chave, gravada no mesmo commit): reenviar devolve o mesmo resultado; com outros dados, 409.
/// </summary>
public class LancamentoService
{
    public const string OperacaoEditar = "EditarLancamento";

    private readonly AppDbContext _context;
    private readonly TransacaoService _transacoes;
    private readonly TransferenciaService _transferencias;
    private readonly RecorrenteService _recorrentes;
    private readonly FinancialEventLogService _eventLog;

    public LancamentoService(
        AppDbContext context,
        TransacaoService transacoes,
        TransferenciaService transferencias,
        RecorrenteService recorrentes,
        FinancialEventLogService eventLog)
    {
        _context = context;
        _transacoes = transacoes;
        _transferencias = transferencias;
        _recorrentes = recorrentes;
        _eventLog = eventLog;
    }

    public async Task<EdicaoLancamentoResultadoDto> EditarAsync(Guid id, EditarLancamentoDto dto, Guid usuarioId, string? idempotencyKey = null)
    {
        Idempotencia.ExigirTamanho(idempotencyKey);
        // Replay ANTES das regras: o retry de um pedido que já gravou devolve o mesmo sucesso.
        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            var anterior = await BuscarResultadoPorChaveAsync(usuarioId, idempotencyKey, dto);
            if (anterior != null)
                return anterior;
        }

        var transacao = await _context.Transacoes
            .Where(t => t.Id == id && (
                (t.ContaId.HasValue && t.Conta!.UsuarioIdProprietario == usuarioId) ||
                (t.CartaoCreditoId.HasValue && t.CartaoCredito!.CriadoPor == usuarioId)))
            .FirstOrDefaultAsync()
            ?? throw new KeyNotFoundException("Transação não encontrada.");
        TransacaoService.ExigirEditavel(transacao);

        var destino = dto.Transferencia != null ? EdicaoLancamentoResultadoDto.TipoTransferencia
            : dto.ContaFixa != null ? EdicaoLancamentoResultadoDto.TipoContaFixa
            : dto.Parcelas is > 1 ? EdicaoLancamentoResultadoDto.TipoParcelamento
            : EdicaoLancamentoResultadoDto.TipoTransacao;
        var converte = destino != EdicaoLancamentoResultadoDto.TipoTransacao;

        if (converte && (transacao.ParcelamentoId != null || transacao.ParcelaTransacaoId != null || transacao.RecorrenteOrigemId != null))
            throw new ArgumentException("Parcela de parcelamento e ocorrência de conta fixa não viram outro tipo de lançamento. Exclua e lance de novo.");
        if (converte && (transacao.EhSaldoInicial || transacao.EhAjusteReconciliacao))
            throw new ArgumentException("Saldo inicial e ajuste de reconciliação não viram outro tipo de lançamento.");
        if (destino == EdicaoLancamentoResultadoDto.TipoParcelamento && !dto.CartaoCreditoId.HasValue)
            throw new ArgumentException("Parcelamento requer cartão de crédito.");

        // Tudo ou nada: cancelar o antigo + criar o novo (ou a edição no lugar) numa transação só.
        var proprioTx = _context.Database.CurrentTransaction is null;
        await using var tx = proprioTx ? await _context.Database.BeginTransactionAsync() : null;
        try
        {
            EdicaoLancamentoResultadoDto resultado;
            if (!converte)
            {
                var dados = new Transacao
                {
                    Descricao = dto.Descricao,
                    Valor = dto.Valor,
                    Tipo = (TipoTransacao)dto.Tipo,
                    CategoriaId = dto.CategoriaId,
                    SubcategoriaId = dto.SubcategoriaId,
                    ContaId = dto.ContaId,
                    CartaoCreditoId = dto.CartaoCreditoId,
                    MeioPagamento = MeioPagamentoExtensions.DoCliente(dto.MeioPagamento),
                    Data = dto.Data,
                    Hora = dto.Hora,
                };
                await _transacoes.AtualizarAsync(id, dados, usuarioId, dto.Efetivado);
                resultado = new EdicaoLancamentoResultadoDto { Tipo = EdicaoLancamentoResultadoDto.TipoTransacao, Id = id };
            }
            else
            {
                var valorAntes = transacao.Valor;
                var correlationId = Guid.NewGuid();
                // O antigo sai como numa exclusão (soft delete, fatura reconciliada, evento registrado)…
                if (!await _transacoes.DeletarAsync(id, usuarioId))
                    throw new KeyNotFoundException("Transação não encontrada.");

                // …e o novo nasce pelas mesmas regras de quando é lançado.
                Guid novoId;
                switch (destino)
                {
                    case EdicaoLancamentoResultadoDto.TipoTransferencia:
                        var transferencia = await _transferencias.CriarAsync(new CriarTransferenciaDto
                        {
                            ContaOrigemId = dto.Transferencia!.ContaOrigemId,
                            ContaDestinoId = dto.Transferencia.ContaDestinoId,
                            Valor = dto.Valor,
                            Data = dto.Data,
                            Hora = dto.Hora,
                            Descricao = dto.Descricao,
                        }, usuarioId);
                        novoId = transferencia.Id;
                        break;
                    case EdicaoLancamentoResultadoDto.TipoContaFixa:
                        var contaFixa = await _recorrentes.CriarAsync(new CriarRecorrenteDto
                        {
                            Descricao = dto.Descricao,
                            Valor = dto.Valor,
                            Tipo = dto.Tipo,
                            CategoriaId = dto.CategoriaId,
                            SubcategoriaId = dto.SubcategoriaId,
                            ContaId = dto.CartaoCreditoId.HasValue ? null : dto.ContaId ?? transacao.ContaId,
                            CartaoCreditoId = dto.CartaoCreditoId,
                            MeioPagamento = dto.CartaoCreditoId.HasValue ? null : dto.MeioPagamento ?? (int?)transacao.MeioPagamento,
                            Frequencia = dto.ContaFixa!.Frequencia,
                            Dia = dto.Data.Day,
                            DataInicio = dto.Data.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
                            DataFim = dto.ContaFixa.DataFim?.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
                        }, usuarioId);
                        novoId = contaFixa.Id;
                        break;
                    default:
                        var parcelas = await _transacoes.CriarParcelamentoAsync(new CriarTransacaoDto
                        {
                            Descricao = dto.Descricao,
                            Valor = dto.Valor,
                            Tipo = dto.Tipo,
                            CategoriaId = dto.CategoriaId ?? Guid.Empty,
                            SubcategoriaId = dto.SubcategoriaId,
                            CartaoCreditoId = dto.CartaoCreditoId,
                            UsadoComoCredito = true,
                            MeioPagamento = (int)MeioPagamento.Credito,
                            Parcelas = dto.Parcelas,
                            Data = dto.Data,
                        }, usuarioId);
                        // Crédito parcelado deste fluxo = N transações soltas (sem entidade de grupo): o resultado é a 1ª parcela.
                        novoId = parcelas[0].Id;
                        break;
                }

                _eventLog.Registrar(
                    usuarioId: usuarioId,
                    tipo: FinancialEventType.TransacaoAtualizada,
                    entidade: "Transacao",
                    entidadeId: id,
                    correlationId: correlationId,
                    origemAcao: "API",
                    valorAntes: valorAntes,
                    valorDepois: dto.Valor,
                    payload: new { convertidoPara = destino, novoId });
                resultado = new EdicaoLancamentoResultadoDto { Tipo = destino, Id = novoId };
            }

            // Chave no mesmo commit da operação: a 2ª requisição concorrente estoura o índice e vira replay.
            if (!string.IsNullOrWhiteSpace(idempotencyKey))
                _context.RegistrosIdempotencia.Add(Idempotencia.Novo(usuarioId, OperacaoEditar, idempotencyKey, resultado.Id));
            await _context.SaveChangesAsync();
            if (tx != null)
                await tx.CommitAsync();
            return resultado;
        }
        catch (DbUpdateException ex) when (!string.IsNullOrWhiteSpace(idempotencyKey) && Idempotencia.EhViolacaoDeUnicidade(ex))
        {
            if (tx != null)
                await tx.RollbackAsync();
            _context.ChangeTracker.Clear();
            var vencedor = await BuscarResultadoPorChaveAsync(usuarioId, idempotencyKey!, dto);
            if (vencedor != null)
                return vencedor;
            throw;
        }
        catch
        {
            if (tx != null)
                await tx.RollbackAsync();
            throw;
        }
    }

    /// <summary>
    /// Resultado já produzido por esta chave (replay) ou null se a chave é nova. 409 se a chave já produziu
    /// algo que não existe mais ou um pedido com outros dados (mesma regra da conta fixa).
    /// </summary>
    private async Task<EdicaoLancamentoResultadoDto?> BuscarResultadoPorChaveAsync(Guid usuarioId, string chave, EditarLancamentoDto dto)
    {
        var registro = await Idempotencia.BuscarAsync(_context, usuarioId, OperacaoEditar, chave);
        if (registro == null)
            return null;
        var referenciaId = registro.ReferenciaId ?? Guid.Empty;

        // O tipo do resultado é o que o pedido pede: o mesmo pedido produz o mesmo tipo.
        if (dto.Transferencia != null)
        {
            var tr = await _context.Transferencias.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == referenciaId && x.CriadoPor == usuarioId)
                ?? throw new InvalidOperationException(Idempotencia.MensagemChaveConsumida);
            if (tr.Valor != dto.Valor || DateOnly.FromDateTime(tr.Data) != dto.Data
                || tr.ContaOrigemId != dto.Transferencia.ContaOrigemId || tr.ContaDestinoId != dto.Transferencia.ContaDestinoId)
                throw new InvalidOperationException(Idempotencia.MensagemChaveComOutrosDados);
            return new EdicaoLancamentoResultadoDto { Tipo = EdicaoLancamentoResultadoDto.TipoTransferencia, Id = tr.Id };
        }
        if (dto.ContaFixa != null)
        {
            var rec = await _context.Recorrentes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == referenciaId && x.CriadoPor == usuarioId);
            if (rec == null || rec.ExcluidoEm != null)
                throw new InvalidOperationException(Idempotencia.MensagemChaveConsumida);
            if (rec.Valor != dto.Valor || rec.Descricao != dto.Descricao || (int)rec.Frequencia != dto.ContaFixa.Frequencia)
                throw new InvalidOperationException(Idempotencia.MensagemChaveComOutrosDados);
            return new EdicaoLancamentoResultadoDto { Tipo = EdicaoLancamentoResultadoDto.TipoContaFixa, Id = rec.Id };
        }
        if (dto.Parcelas is > 1)
        {
            // Crédito parcelado = N transações soltas; a referência é a 1ª parcela ("X (1/N)").
            var primeira = await _context.Transacoes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == referenciaId && x.CriadoPor == usuarioId)
                ?? throw new InvalidOperationException(Idempotencia.MensagemChaveConsumida);
            if (primeira.CartaoCreditoId != dto.CartaoCreditoId || primeira.Data != dto.Data
                || primeira.Descricao != $"{dto.Descricao} (1/{dto.Parcelas})")
                throw new InvalidOperationException(Idempotencia.MensagemChaveComOutrosDados);
            return new EdicaoLancamentoResultadoDto { Tipo = EdicaoLancamentoResultadoDto.TipoParcelamento, Id = primeira.Id };
        }
        var t = await _context.Transacoes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == referenciaId)
            ?? throw new InvalidOperationException(Idempotencia.MensagemChaveConsumida);
        if (t.Valor != dto.Valor || t.Descricao != dto.Descricao || t.Data != dto.Data)
            throw new InvalidOperationException(Idempotencia.MensagemChaveComOutrosDados);
        return new EdicaoLancamentoResultadoDto { Tipo = EdicaoLancamentoResultadoDto.TipoTransacao, Id = t.Id };
    }
}

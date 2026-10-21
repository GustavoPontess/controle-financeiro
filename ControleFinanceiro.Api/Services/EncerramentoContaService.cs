using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Conta;
using ControleFinanceiro.Api.DTOs.Transferencia;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Encerrar e reabrir conta (decisão do Gustavo, 2026-10-15, depois de pesquisar YNAB/Monarch/Quicken/Actual):
/// conta com histórico não se exclui (#305) — se ENCERRA. Encerrada sai das listas e não recebe lançamento
/// novo; o histórico fica em Transações e Relatórios; dá pra reabrir. O saldo nunca some de vista: zerado,
/// encerra direto; com saldo, a pessoa diz o que aconteceu com o dinheiro — foi pra outra conta (vira uma
/// transferência de verdade) ou no banco já está zerado (vira ajuste, como na reconciliação). Tudo numa
/// transação só do banco, com Idempotency-Key (reenviar não transfere 2x).
/// </summary>
public class EncerramentoContaService
{
    public const string OperacaoEncerrarConta = "EncerrarConta";
    public const string ResolucaoZerada = "zerada";
    public const string ResolucaoTransferencia = "transferencia";
    public const string ResolucaoAjuste = "ajuste";

    private readonly AppDbContext _context;
    private readonly TransferenciaService _transferencias;
    private readonly FinancialEventLogService _eventLog;

    public EncerramentoContaService(AppDbContext context, TransferenciaService transferencias, FinancialEventLogService eventLog)
    {
        _context = context;
        _transferencias = transferencias;
        _eventLog = eventLog;
    }

    public async Task<EncerramentoContaDto> EncerrarAsync(Guid contaId, EncerrarContaDto dto, Guid usuarioId, string? idempotencyKey)
    {
        if (string.IsNullOrWhiteSpace(idempotencyKey))
            throw new ArgumentException("O header Idempotency-Key é obrigatório para encerrar a conta.");
        Idempotencia.ExigirTamanho(idempotencyKey);

        var conta = await _context.Contas.FirstOrDefaultAsync(c => c.Id == contaId && c.UsuarioIdProprietario == usuarioId)
            ?? throw new KeyNotFoundException("Conta não encontrada.");

        // Replay ANTES das regras: se o 1º pedido já encerrou, o retry cairia em "já encerrada" — o certo é
        // devolver o mesmo resultado. Mesma chave pra outra conta → 409.
        var registro = await Idempotencia.BuscarAsync(_context, usuarioId, OperacaoEncerrarConta, idempotencyKey);
        if (registro != null)
        {
            if (registro.ReferenciaId != contaId || conta.EncerradaEm is null)
                throw new InvalidOperationException(Idempotencia.MensagemChaveComOutrosDados);
            return new EncerramentoContaDto { ContaId = contaId, EncerradaEm = conta.EncerradaEm.Value, Resolucao = "repetido" };
        }

        if (conta.IsCarteira)
            throw new InvalidOperationException("A carteira não pode ser encerrada.");
        if (conta.Tipo == TipoConta.Caixinha)
            throw new InvalidOperationException(ContaService.MensagemCaixinha);
        if (conta.EncerradaEm != null)
            throw new InvalidOperationException("Esta conta já está encerrada.");
        if (dto.ContaDestinoId.HasValue && dto.Ajustar)
            throw new ArgumentException("Escolha um só: transferir o saldo ou ajustar.");

        var hoje = HorarioBrasil.Hoje();
        var data = dto.Data ?? hoje;
        if (data > hoje)
            throw new ArgumentException("A data do encerramento não pode ser futura.");

        // O que ainda vai acontecer na conta segura o encerramento: conta fixa que pode cobrar nela (ativa ou
        // pausada) e lançamento previsto. Encerrar por cima deixaria cobrança caindo numa conta que sumiu.
        var hojeData = HorarioBrasil.HojeData();
        if (await _context.Recorrentes.AnyAsync(r => r.ContaId == contaId && r.CriadoPor == usuarioId
                && r.CanceladoEm == null && r.ExcluidoEm == null && (r.DataFim == null || r.DataFim >= hojeData)))
            throw new InvalidOperationException(
                "Uma conta fixa ainda usa esta conta. Troque a conta dela ou cancele a conta fixa antes de encerrar.");
        if (await _context.Transacoes.AnyAsync(t => t.ContaId == contaId && t.StatusTransacao == StatusTransacao.Previsao))
            throw new InvalidOperationException(
                "Esta conta tem lançamentos previstos. Efetive ou exclua as previsões antes de encerrar.");

        var saldos = await RegrasFinanceiras.SaldosDasContasAsync(_context, new[] { contaId }, usuarioId);
        var saldo = saldos.TryGetValue(contaId, out var mov) ? mov.Saldo : 0m;
        if (saldo != 0m && !dto.ContaDestinoId.HasValue && !dto.Ajustar)
            throw new ArgumentException(
                $"A conta ainda tem saldo de {Reais.Formatar(saldo)}. Diga pra onde foi o dinheiro (transferir) ou que no banco já está zerado (ajustar).");

        var resolucao = saldo == 0m ? ResolucaoZerada : dto.ContaDestinoId.HasValue ? ResolucaoTransferencia : ResolucaoAjuste;
        var correlationId = Guid.NewGuid();

        var proprioTx = _context.Database.CurrentTransaction is null;
        await using var tx = proprioTx ? await _context.Database.BeginTransactionAsync() : null;
        try
        {
            if (resolucao == ResolucaoTransferencia)
            {
                var destinoId = dto.ContaDestinoId!.Value;
                if (destinoId == contaId)
                    throw new ArgumentException("Escolha outra conta pra receber o saldo.");
                await DonoRecursos.ExigirContaAbertaAsync(_context, destinoId, usuarioId);
                // Saldo positivo sai desta conta; negativo (cheque especial) é coberto pela outra.
                var (origem, destino) = saldo > 0 ? (contaId, destinoId) : (destinoId, contaId);
                await _transferencias.CriarAsync(new CriarTransferenciaDto
                {
                    ContaOrigemId = origem,
                    ContaDestinoId = destino,
                    Valor = Math.Abs(saldo),
                    Data = data,
                    Hora = null,
                    Descricao = $"Saldo de {conta.Nome} (conta encerrada)",
                }, usuarioId);
            }
            else if (resolucao == ResolucaoAjuste)
            {
                // Mesmo lançamento da reconciliação: fora do resultado (não é receita nem despesa), só acerta o saldo.
                var ajuste = new Transacao
                {
                    Id = Guid.NewGuid(),
                    Descricao = "Ajuste ao encerrar a conta",
                    Valor = Math.Abs(saldo),
                    // Sobra no app (saldo > 0) sai; falta (saldo < 0) entra.
                    Tipo = saldo > 0 ? TipoTransacao.Despesa : TipoTransacao.Receita,
                    ContaId = contaId,
                    CategoriaId = null,
                    Data = data,
                    Hora = null,
                    StatusTransacao = StatusTransacao.Executado,
                    EhAjusteReconciliacao = true,
                    CriadoPor = usuarioId,
                };
                _context.Transacoes.Add(ajuste);
                _eventLog.Registrar(
                    usuarioId: usuarioId,
                    tipo: FinancialEventType.TransacaoCriada,
                    entidade: "Transacao",
                    entidadeId: ajuste.Id,
                    correlationId: correlationId,
                    origemAcao: "EncerrarConta",
                    valorAntes: saldo,
                    valorDepois: 0m,
                    payload: new { contaId, motivo = "encerramento" });
            }

            // Cartão que pagava a fatura por esta conta continua — só perde a conta vinculada.
            var cartoes = await _context.CartoesCredito.Where(c => c.ContaId == contaId).ToListAsync();
            foreach (var c in cartoes) c.ContaId = null;

            conta.EncerradaEm = DateTime.UtcNow;
            _context.RegistrosIdempotencia.Add(Idempotencia.Novo(usuarioId, OperacaoEncerrarConta, idempotencyKey, contaId));
            await _context.SaveChangesAsync();
            if (tx != null) await tx.CommitAsync();
        }
        catch (DbUpdateException ex) when (Idempotencia.EhViolacaoDeUnicidade(ex))
        {
            // Corrida: outra requisição com a mesma chave encerrou primeiro — devolve o resultado dela.
            if (tx != null) await tx.RollbackAsync();
            _context.ChangeTracker.Clear();
            var vencedora = await _context.Contas.AsNoTracking().FirstAsync(c => c.Id == contaId);
            return new EncerramentoContaDto { ContaId = contaId, EncerradaEm = vencedora.EncerradaEm ?? DateTime.UtcNow, Resolucao = "repetido" };
        }

        return new EncerramentoContaDto { ContaId = contaId, EncerradaEm = conta.EncerradaEm!.Value, Resolucao = resolucao, SaldoAntes = saldo };
    }

    /// <summary>Reabre a conta encerrada: volta pras listas e pode receber lançamento. Já aberta: nada muda.</summary>
    public async Task ReabrirAsync(Guid contaId, Guid usuarioId)
    {
        var conta = await _context.Contas.FirstOrDefaultAsync(c => c.Id == contaId && c.UsuarioIdProprietario == usuarioId)
            ?? throw new KeyNotFoundException("Conta não encontrada.");
        if (conta.EncerradaEm is null) return;
        if (conta.Tipo == TipoConta.Caixinha)
            throw new InvalidOperationException(ContaService.MensagemCaixinha);
        conta.EncerradaEm = null;
        await _context.SaveChangesAsync();
    }
}

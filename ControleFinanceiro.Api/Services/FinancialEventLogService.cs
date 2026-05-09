using System.Text.Json;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Helper pra registrar eventos no FinancialEventLog (audit log append-only).
/// Spec: ARQUITETURA_PARCELAMENTO.md § "FinancialEventLog (NOVA)".
/// </summary>
/// <remarks>
/// Suporta o padrão de idempotência: services salvam <c>idempotencyKey</c> dentro do
/// PayloadJson de qualquer evento que possa ser repetido por retry de cliente
/// (POST /parcelamentos, /parcelas/:id/pagar, /faturas/:id/pagar etc). Antes de
/// iniciar transação financeira, o service consulta <see cref="BuscarPorIdempotencyKeyAsync"/>
/// pra detectar replay e retornar resultado anterior em vez de duplicar lançamento.
/// </remarks>
public class FinancialEventLogService
{
    private readonly AppDbContext _context;

    public FinancialEventLogService(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Registra um evento financeiro. Não chama SaveChanges — o caller deve
    /// fazer SaveChangesAsync na mesma transação onde está modificando o estado.
    /// </summary>
    /// <param name="usuarioId">Dono dos dados.</param>
    /// <param name="tipo">Tipo do evento (FinancialEventType).</param>
    /// <param name="entidade">Nome da entidade ("Fatura", "Parcelamento", etc).</param>
    /// <param name="entidadeId">Id da entidade afetada.</param>
    /// <param name="correlationId">Agrupa eventos da mesma operação. Use o mesmo Guid pra todos os logs gerados por 1 ação do usuário.</param>
    /// <param name="origemAcao">"UserClick", "API", "Job:FecharFaturas", etc.</param>
    /// <param name="valorAntes">Estado antes (saldo/limite/etc), quando aplicável.</param>
    /// <param name="valorDepois">Estado depois.</param>
    /// <param name="payload">Snapshot extra (idempotencyKey + dados da operação) — serializado em JSON.</param>
    public FinancialEventLog Registrar(
        Guid usuarioId,
        FinancialEventType tipo,
        string entidade,
        Guid entidadeId,
        Guid correlationId,
        string origemAcao,
        decimal? valorAntes = null,
        decimal? valorDepois = null,
        object? payload = null)
    {
        var log = new FinancialEventLog
        {
            Id = Guid.NewGuid(),
            CriadoPor = usuarioId,
            Tipo = tipo,
            EntidadeAfetada = entidade,
            EntidadeId = entidadeId,
            CorrelationId = correlationId,
            OrigemAcao = origemAcao,
            ValorAntes = valorAntes,
            ValorDepois = valorDepois,
            PayloadJson = payload is null ? null : JsonSerializer.Serialize(payload),
            CriadoEm = DateTime.UtcNow,
        };
        _context.FinancialEventLogs.Add(log);
        return log;
    }

    /// <summary>
    /// Busca o log mais recente do usuário com a idempotencyKey fornecida (últimas 24h).
    /// Usado por endpoints transacionais pra detectar retry de cliente.
    /// </summary>
    /// <returns>Log existente ou null se for a primeira vez.</returns>
    public async Task<FinancialEventLog?> BuscarPorIdempotencyKeyAsync(
        Guid usuarioId,
        string idempotencyKey,
        TimeSpan? janela = null)
    {
        if (string.IsNullOrWhiteSpace(idempotencyKey)) return null;

        var limite = DateTime.UtcNow - (janela ?? TimeSpan.FromHours(24));
        var needle = $"\"idempotencyKey\":\"{idempotencyKey}\"";

        return await _context.FinancialEventLogs
            .Where(e => e.CriadoPor == usuarioId
                        && e.CriadoEm >= limite
                        && e.PayloadJson != null
                        && e.PayloadJson.Contains(needle))
            .OrderByDescending(e => e.CriadoEm)
            .FirstOrDefaultAsync();
    }
}

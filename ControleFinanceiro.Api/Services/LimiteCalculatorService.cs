using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Calcula LimiteBloqueado / LimiteDisponivel / ExposicaoFuturaPrevisao de um cartão
/// de crédito on-the-fly a partir do estado atual do banco. Bloqueado/disponível vêm da regra
/// única <see cref="RegrasFinanceiras.LimitesUsadosDosCartoesAsync"/>.
/// Spec: ARQUITETURA_PARCELAMENTO.md § "Cálculo de Limite de Crédito" e § "Cálculos derivados".
/// </summary>
/// <remarks>
/// Esses valores NÃO são persistidos. A fonte de verdade é sempre o estado atual de
/// ParcelaTransacao + Transacao + Fatura. Recalcular sob demanda evita drift entre
/// coluna stale e realidade — o trade-off é custo de query, mitigável com índices
/// (já temos IX_Transacoes_FaturaId, IX_ParcelasTransacao_ParcelamentoId, etc).
/// </remarks>
public class LimiteCalculatorService
{
    private readonly AppDbContext _context;

    public LimiteCalculatorService(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>Resultado do cálculo de limite de um cartão.</summary>
    public record LimiteSnapshot(
        Guid CartaoId,
        decimal LimiteTotal,
        decimal LimiteBloqueado,
        decimal LimiteDisponivel,
        decimal ExposicaoFuturaPrevisao);

    /// <summary>
    /// Calcula limites de UM cartão. Lança <see cref="InvalidOperationException"/>
    /// se o cartão não existe, não pertence ao usuário, ou não tem TemCredito=true.
    /// </summary>
    public async Task<LimiteSnapshot> CalcularAsync(Guid cartaoId, Guid usuarioId)
    {
        var cartao = await _context.CartoesCredito
            .Where(c => c.Id == cartaoId && c.CriadoPor == usuarioId)
            .Select(c => new { c.Id, c.TemCredito, c.LimiteTotal })
            .FirstOrDefaultAsync()
            ?? throw new InvalidOperationException("Cartão não encontrado.");

        if (!cartao.TemCredito)
            throw new InvalidOperationException("Cartão não possui modalidade crédito.");

        var limiteTotal = cartao.LimiteTotal ?? 0m;

        // Bloqueado = o que as faturas cobram de efetivado e ainda não foi pago (parcelas futuras
        // incluídas) + compra no cartão fora de fatura. Regra única em RegrasFinanceiras — a mesma do
        // card da tela de cartões. Antes eram parcelas Pendentes + à vista de fatura não Pago: pagamento
        // parcial não liberava nada e a parcela já coberta pelo pagamento da fatura seguia bloqueando.
        var bloqueado = await RegrasFinanceiras.LimiteUsadoDoCartaoAsync(_context, cartaoId, usuarioId);
        var disponivel = RegrasFinanceiras.LimiteDisponivel(limiteTotal, bloqueado);

        // Exposição futura prevista: transações de Recorrentes ainda em Previsao
        // (não bloqueia limite, mas dashboard mostra).
        var previsao = await _context.Transacoes
            .Where(t => t.CartaoCreditoId == cartaoId
                        && t.CriadoPor == usuarioId
                        && t.Ativo
                        && t.StatusTransacao == StatusTransacao.Previsao)
            .SumAsync(t => (decimal?)t.Valor) ?? 0m;

        return new LimiteSnapshot(cartaoId, limiteTotal, bloqueado, disponivel, previsao);
    }

    /// <summary>
    /// Calcula em batch pra todos os cartões de crédito do usuário (usado pelo dashboard).
    /// </summary>
    public async Task<List<LimiteSnapshot>> CalcularTodosDoUsuarioAsync(Guid usuarioId)
    {
        var ids = await _context.CartoesCredito
            .Where(c => c.CriadoPor == usuarioId && c.TemCredito && c.Ativo)
            .Select(c => c.Id)
            .ToListAsync();

        var snapshots = new List<LimiteSnapshot>(ids.Count);
        foreach (var id in ids)
            snapshots.Add(await CalcularAsync(id, usuarioId));
        return snapshots;
    }
}

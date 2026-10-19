using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Infrastructure.Jobs;

/// <summary>
/// Cobra a ocorrência da conta fixa no dia dela (previsão vira efetivado), pela regra única
/// <see cref="RegrasFinanceiras.CobrarOcorrenciasAsync"/>: no cartão, como no banco, só passa se o limite disponível
/// cobre. A que não cabe NÃO é cobrada, fica prevista, a pessoa recebe um aviso (uma vez por ocorrência) e o job
/// tenta de novo todo dia, até a fatura ser paga e o limite voltar. Decisão do Gustavo, 2026-10-19.
/// </summary>
public class ExecutarRecorrentesJob
{
    private readonly AppDbContext _context;
    private readonly NotificacaoService _notificacoes;

    public ExecutarRecorrentesJob(AppDbContext context, NotificacaoService notificacoes)
    {
        _context = context;
        _notificacoes = notificacoes;
    }

    /// <summary>Chave do aviso "não passou por falta de limite" (um por ocorrência).</summary>
    public static string ChaveSemLimite(Guid transacaoId) => $"cobranca-sem-limite:{transacaoId}";

    public async Task ExecuteAsync()
    {
        var hoje = DateTime.UtcNow.Date;
        var hojeData = DateOnly.FromDateTime(hoje);

        var transacoes = await _context.Transacoes
            .Where(t => t.StatusTransacao == StatusTransacao.Previsao && t.Data <= hojeData && t.Ativo && t.RecorrenteOrigemId != null)
            // Só cobra conta fixa que ainda deve cobrar: pausada, cancelada, excluída ou apagada (sem a linha)
            // NÃO efetiva. Antes efetivava toda previsão com RecorrenteOrigemId — pausar/excluir não parava a cobrança.
            .Where(t => _context.Recorrentes.Any(r => r.Id == t.RecorrenteOrigemId
                                                      && r.Ativo && r.CanceladoEm == null && r.ExcluidoEm == null))
            .ToListAsync();
        if (transacoes.Count == 0) return;

        var semLimite = await RegrasFinanceiras.CobrarOcorrenciasAsync(_context, transacoes);
        if (transacoes.Count > semLimite.Count)
            await _context.SaveChangesAsync();

        foreach (var (t, cartao, livre) in semLimite)
            await _notificacoes.CriarUmaVezAsync(cartao.CriadoPor, ChaveSemLimite(t.Id), TipoNotificacao.CobrancaSemLimite,
                $"{t.Descricao} não passou no {cartao.Nome}",
                $"A cobrança de {t.Descricao} ({Reais.Formatar(t.Valor)}) no {cartao.Nome} não passou: falta limite " +
                $"(disponível {Reais.Formatar(Math.Max(0m, livre))}). Quando a fatura for paga e o limite voltar, o app cobra de novo.",
                $"/cartoes/{cartao.Id}");
    }
}

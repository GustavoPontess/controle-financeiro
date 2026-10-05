using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Infrastructure.Jobs;

public class ExecutarRecorrentesJob
{
    private readonly AppDbContext _context;

    public ExecutarRecorrentesJob(AppDbContext context)
    {
        _context = context;
    }

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

        foreach (var t in transacoes)
        {
            t.StatusTransacao = StatusTransacao.Executado;
        }

        if (transacoes.Any())
            await _context.SaveChangesAsync();
    }
}

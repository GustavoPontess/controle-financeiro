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
            .ToListAsync();

        foreach (var t in transacoes)
        {
            t.StatusTransacao = StatusTransacao.Executado;
        }

        if (transacoes.Any())
            await _context.SaveChangesAsync();
    }
}

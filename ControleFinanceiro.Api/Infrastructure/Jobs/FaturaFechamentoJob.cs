using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Infrastructure.Jobs;

public class FaturaFechamentoJob
{
    private readonly AppDbContext _context;

    public FaturaFechamentoJob(AppDbContext context)
    {
        _context = context;
    }

    public async Task ExecuteAsync()
    {
        var hoje = DateTime.UtcNow.Date;
        var faturas = await _context.Faturas
            .Where(f => f.EstadoCiclo == EstadoCicloFatura.Aberta && f.DataFechamento <= hoje)
            .ToListAsync();

        foreach (var fatura in faturas)
        {
            fatura.EstadoCiclo = EstadoCicloFatura.Fechada;
            fatura.DataFechamentoEfetiva = DateTime.UtcNow;
        }

        if (faturas.Any())
            await _context.SaveChangesAsync();
    }
}

using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Infrastructure.Jobs;

public class RecalcularLimitesJob
{
    private readonly AppDbContext _context;
    private readonly LimiteCalculatorService _limiteCalculatorService;

    public RecalcularLimitesJob(AppDbContext context, LimiteCalculatorService limiteCalculatorService)
    {
        _context = context;
        _limiteCalculatorService = limiteCalculatorService;
    }

    public async Task ExecuteAsync()
    {
        // Recalculate limits for all users
        var usuarios = await _context.CartoesCredito
            .Select(c => c.CriadoPor)
            .Distinct()
            .ToListAsync();

        foreach (var usuarioId in usuarios)
        {
            // LimiteCalculatorService caches calculations in memory
            // This triggers recalculation for all cards of this user
            await _limiteCalculatorService.CalcularTodosDoUsuarioAsync(usuarioId);
        }
    }
}

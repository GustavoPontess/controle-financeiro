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

        var fusos = await FusoHorarioService.DosUsuariosAsync(_context, usuarios);
        foreach (var usuarioId in usuarios)
        {
            // No fuso da conta da pessoa (2026-11-02): o "hoje" do cálculo é o dela.
            using var _ = HorarioBrasil.UsarFuso(fusos.GetValueOrDefault(usuarioId));
            // LimiteCalculatorService caches calculations in memory
            // This triggers recalculation for all cards of this user
            await _limiteCalculatorService.CalcularTodosDoUsuarioAsync(usuarioId);
        }
    }
}

using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Infrastructure.Jobs;

/// <summary>
/// Apaga todo dia as senhas erradas que já não valem (última há mais de 24 h, <see cref="TentativasLogin.Janela"/>):
/// o resumo do e-mail não fica guardado além do necessário (minimização, LGPD art. 6º, III).
/// </summary>
public class PurgaTentativaLoginJob
{
    private readonly AppDbContext _context;
    private readonly ILogger<PurgaTentativaLoginJob> _logger;

    public PurgaTentativaLoginJob(AppDbContext context, ILogger<PurgaTentativaLoginJob> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<int> ExecuteAsync()
    {
        var limite = DateTime.UtcNow - TentativasLogin.Janela;
        var vencidas = await _context.TentativasLogin.Where(t => t.UltimaFalhaEm < limite).ToListAsync();
        if (vencidas.Count == 0) return 0;
        _context.TentativasLogin.RemoveRange(vencidas);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Senhas erradas vencidas apagadas: {Qtd}.", vencidas.Count);
        return vencidas.Count;
    }
}

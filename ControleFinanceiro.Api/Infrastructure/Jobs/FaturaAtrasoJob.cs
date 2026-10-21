using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace ControleFinanceiro.Api.Infrastructure.Jobs;

public class FaturaAtrasoJob
{
    private readonly AppDbContext _context;
    private readonly ILogger<FaturaAtrasoJob> _logger;

    public FaturaAtrasoJob(AppDbContext context, ILogger<FaturaAtrasoJob>? logger = null)
    {
        _context = context;
        _logger = logger ?? NullLogger<FaturaAtrasoJob>.Instance;
    }

    public async Task ExecuteAsync()
    {
        var hoje = HorarioBrasil.HojeData();
        var faturas = await Pendentes(hoje).ToListAsync();

        var marcouAlguma = false;
        foreach (var fatura in faturas)
            marcouAlguma |= MarcarAtraso(fatura, hoje);
        if (!marcouAlguma)
            return;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            // A Fatura tem token de concorrência (xmin): se alguém pagou uma delas entre a leitura e o
            // save, o lote INTEIRO é recusado. Sem este fallback nenhuma fatura de nenhum usuário era
            // marcada até o retry do Hangfire. Refaz uma a uma, relendo cada fatura — a que acabou de ser
            // paga sai sozinha pelo filtro/restante.
            _context.ChangeTracker.Clear();
            foreach (var id in faturas.Select(f => f.Id))
                await MarcarUmaAsync(id, hoje);
        }
    }

    private IQueryable<Fatura> Pendentes(DateTime hoje) =>
        _context.Faturas
            // Sem filtro pelo rótulo Pago: fatura marcada Pago que recebeu compra nova volta a ter restante e
            // também atrasa. Quem decide é o restante (MarcarAtraso).
            .Where(f => !f.EstaAtrasada && f.DataVencimento < hoje)
            .Include(f => f.Transacoes)
            .Include(f => f.ParcelasTransacao);

    private async Task MarcarUmaAsync(Guid faturaId, DateTime hoje)
    {
        var fatura = await Pendentes(hoje).FirstOrDefaultAsync(f => f.Id == faturaId);
        if (fatura == null || !MarcarAtraso(fatura, hoje))
            return;
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            // Mexeram nela de novo no meio do caminho: fica pra próxima execução (diária), sem travar as outras.
            _context.ChangeTracker.Clear();
            _logger.LogWarning("FaturaAtrasoJob: fatura {FaturaId} alterada durante o job; fica pra próxima execução.", faturaId);
        }
    }

    /// <summary>Marca a fatura como atrasada se ainda há restante. Devolve se mudou algo.</summary>
    private static bool MarcarAtraso(Fatura fatura, DateTime hoje)
    {
        // Atraso deriva do RESTANTE (regra única), não do EstadoPagamento: fatura coberta que ficou
        // Parcial depois de um cancelamento, ou zerada sem pagamento (parcelamento cancelado), não
        // deve nada — marcar atrasada gravava juros/multa sobre dívida inexistente.
        var restante = RegrasFinanceiras.ValorRestanteFatura(fatura);
        if (restante <= 0) return false;

        fatura.EstaAtrasada = true;
        // Juros de mora: 1% ao mês + multa de 2% (simplificado), sobre o que FALTA pagar — o já pago
        // não está em atraso.
        var diasAtraso = (hoje - fatura.DataVencimento).Days;
        var mesesAtraso = Math.Max(1, diasAtraso / 30);
        fatura.JurosDeMora = restante * (decimal)mesesAtraso * 0.01m;
        fatura.Multa = restante * 0.02m;
        return true;
    }
}

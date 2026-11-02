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

    /// <summary>A fatura vira atrasada às 23h30 do dia seguinte ao vencimento, no fuso do dono (2026-11-02: o job roda de
    /// hora em hora e trata cada pessoa no horário dela; antes era 23h30 de Brasília pra todo mundo).</summary>
    public static readonly TimeSpan HoraDoAtraso = new(23, 30, 0);

    public async Task ExecuteAsync()
    {
        // Nenhum fuso está dois dias à frente: pega as candidatas e decide pelo dia de cada dono.
        var limite = HorarioBrasil.Agora().Date.AddDays(2);
        var candidatas = await _context.Faturas.AsNoTracking()
            .Where(f => !f.EstaAtrasada && f.DataVencimento < limite)
            .Select(f => new { f.Id, f.CriadoPor, f.DataVencimento })
            .ToListAsync();
        if (candidatas.Count == 0)
            return;
        var donos = candidatas.Select(c => c.CriadoPor).Distinct().ToList();
        var fusos = await FusoHorarioService.DosUsuariosAsync(_context, donos);
        var hojeDe = donos.ToDictionary(u => u, u => HorarioBrasil.HojeDoJob(fusos.GetValueOrDefault(u), HoraDoAtraso));
        var hojeDaFatura = candidatas.Where(c => c.DataVencimento < hojeDe[c.CriadoPor]).ToDictionary(c => c.Id, c => hojeDe[c.CriadoPor]);
        if (hojeDaFatura.Count == 0)
            return;
        var ids = hojeDaFatura.Keys.ToList();
        var faturas = await Pendentes().Where(f => ids.Contains(f.Id)).ToListAsync();

        var marcouAlguma = false;
        foreach (var fatura in faturas)
            marcouAlguma |= MarcarAtraso(fatura, hojeDaFatura[fatura.Id]);
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
                await MarcarUmaAsync(id, hojeDaFatura[id]);
        }
    }

    private IQueryable<Fatura> Pendentes() =>
        _context.Faturas
            // Sem filtro pelo rótulo Pago: fatura marcada Pago que recebeu compra nova volta a ter restante e
            // também atrasa. Quem decide é o restante (MarcarAtraso).
            .Where(f => !f.EstaAtrasada)
            .Include(f => f.Transacoes)
            .Include(f => f.ParcelasTransacao);

    private async Task MarcarUmaAsync(Guid faturaId, DateTime hoje)
    {
        var fatura = await Pendentes().FirstOrDefaultAsync(f => f.Id == faturaId);
        if (fatura == null || !MarcarAtraso(fatura, hoje))
            return;
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            // Mexeram nela de novo no meio do caminho: fica pra próxima execução (de hora em hora), sem travar as outras.
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

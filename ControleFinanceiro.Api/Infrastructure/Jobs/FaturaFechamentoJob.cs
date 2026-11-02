using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace ControleFinanceiro.Api.Infrastructure.Jobs;

public class FaturaFechamentoJob
{
    private readonly AppDbContext _context;
    private readonly FinancialEventLogService _eventLog;
    private readonly ILogger<FaturaFechamentoJob> _logger;

    public FaturaFechamentoJob(
        AppDbContext context, FinancialEventLogService eventLog, ILogger<FaturaFechamentoJob>? logger = null)
    {
        _context = context;
        _eventLog = eventLog;
        _logger = logger ?? NullLogger<FaturaFechamentoJob>.Instance;
    }

    /// <summary>A fatura fecha às 23h do dia do fechamento, no fuso do dono (2026-11-02: o job roda de hora em hora e trata
    /// cada pessoa no horário dela; antes era 23h de Brasília pra todo mundo).</summary>
    public static readonly TimeSpan HoraDoFechamento = new(23, 0, 0);

    public async Task ExecuteAsync()
    {
        // Nenhum fuso está dois dias à frente: pega as candidatas e decide pelo dia de cada dono.
        var limite = HorarioBrasil.Agora().Date.AddDays(2);
        var candidatas = await _context.Faturas.AsNoTracking()
            .Where(f => f.EstadoCiclo == EstadoCicloFatura.Aberta && f.DataFechamento <= limite)
            .Select(f => new { f.Id, f.CriadoPor, f.DataFechamento })
            .ToListAsync();
        if (candidatas.Count == 0)
            return;
        var donos = candidatas.Select(c => c.CriadoPor).Distinct().ToList();
        var fusos = await FusoHorarioService.DosUsuariosAsync(_context, donos);
        var hojeDe = donos.ToDictionary(u => u, u => HorarioBrasil.HojeDoJob(fusos.GetValueOrDefault(u), HoraDoFechamento));
        var ids = candidatas.Where(c => c.DataFechamento <= hojeDe[c.CriadoPor]).Select(c => c.Id).ToList();
        if (ids.Count == 0)
            return;
        var faturas = await AFechar().Where(f => ids.Contains(f.Id)).ToListAsync();

        var agora = DateTime.UtcNow;
        // Uma execução do job = uma operação: os eventos dela compartilham o CorrelationId.
        var correlationId = Guid.NewGuid();
        foreach (var fatura in faturas)
            Fechar(fatura, agora, correlationId);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            // A Fatura tem token de concorrência (xmin): se alguém pagou uma delas entre a leitura e o
            // save, o lote INTEIRO é recusado — nenhum ciclo de nenhum usuário fechava até o retry do
            // Hangfire. Descarta o lote (inclusive os eventos de auditoria ainda não gravados) e refaz
            // uma a uma, relendo cada fatura: o fechamento passa a olhar o ValorPago já atualizado.
            _context.ChangeTracker.Clear();
            foreach (var id in faturas.Select(f => f.Id))
                await FecharUmaAsync(id, agora, correlationId);
        }
    }

    // Transacoes + ParcelasTransacao: o fechamento reconcilia o estado de pagamento pelo total.
    private IQueryable<Fatura> AFechar() =>
        _context.Faturas
            .Where(f => f.EstadoCiclo == EstadoCicloFatura.Aberta)
            .Include(f => f.Transacoes)
            .Include(f => f.ParcelasTransacao);

    private async Task FecharUmaAsync(Guid faturaId, DateTime agora, Guid correlationId)
    {
        var fatura = await AFechar().FirstOrDefaultAsync(f => f.Id == faturaId);
        if (fatura == null)
            return;
        Fechar(fatura, agora, correlationId);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            // Mexeram nela de novo no meio do caminho: segue Aberta e fecha na próxima execução (de hora em hora),
            // sem travar o fechamento das outras.
            _context.ChangeTracker.Clear();
            _logger.LogWarning("FaturaFechamentoJob: fatura {FaturaId} alterada durante o job; fecha na próxima execução.", faturaId);
        }
    }

    private void Fechar(Fatura fatura, DateTime agora, Guid correlationId)
    {
        fatura.EstadoCiclo = EstadoCicloFatura.Fechada;
        fatura.DataFechamentoEfetiva = agora;
        // Ciclo que fecha já coberto vira Pago. Cobre a fatura em que uma parcela foi cancelada com o
        // ciclo ABERTO: ela fica Parcial com restante 0 até aqui (ver a decisão em
        // RegrasFinanceiras.ReconciliarEstadoPagamento) — sem este passo ela seguia Parcial pra sempre.
        // Virar Pago registra no audit log como o caminho do cancelamento faz (a trilha não pode
        // depender de por onde a fatura foi quitada). O limite não espera por isto: segue o pago.
        if (RegrasFinanceiras.ReconciliarEstadoPagamento(fatura, agora))
            RegrasFinanceiras.RegistrarQuitacaoSemPagamentoNovo(
                _eventLog, fatura, fatura.CriadoPor, correlationId,
                origemAcao: "Job:FecharFaturas", motivo: "FechamentoComRestanteZero");
    }
}

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

    public async Task ExecuteAsync()
    {
        var hoje = HorarioBrasil.HojeData();
        var faturas = await AFechar(hoje).ToListAsync();
        if (faturas.Count == 0)
            return;

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
                await FecharUmaAsync(id, hoje, agora, correlationId);
        }
    }

    // Transacoes + ParcelasTransacao: o fechamento reconcilia o estado de pagamento pelo total.
    private IQueryable<Fatura> AFechar(DateTime hoje) =>
        _context.Faturas
            .Where(f => f.EstadoCiclo == EstadoCicloFatura.Aberta && f.DataFechamento <= hoje)
            .Include(f => f.Transacoes)
            .Include(f => f.ParcelasTransacao);

    private async Task FecharUmaAsync(Guid faturaId, DateTime hoje, DateTime agora, Guid correlationId)
    {
        var fatura = await AFechar(hoje).FirstOrDefaultAsync(f => f.Id == faturaId);
        if (fatura == null)
            return;
        Fechar(fatura, agora, correlationId);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            // Mexeram nela de novo no meio do caminho: segue Aberta e fecha na próxima execução (diária),
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

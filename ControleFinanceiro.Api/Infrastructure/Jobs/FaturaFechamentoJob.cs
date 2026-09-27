using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Infrastructure.Jobs;

public class FaturaFechamentoJob
{
    private readonly AppDbContext _context;
    private readonly FinancialEventLogService _eventLog;

    public FaturaFechamentoJob(AppDbContext context, FinancialEventLogService eventLog)
    {
        _context = context;
        _eventLog = eventLog;
    }

    public async Task ExecuteAsync()
    {
        var hoje = DateTime.UtcNow.Date;
        // Transacoes + ParcelasTransacao: o fechamento reconcilia o estado de pagamento pelo total.
        var faturas = await _context.Faturas
            .Where(f => f.EstadoCiclo == EstadoCicloFatura.Aberta && f.DataFechamento <= hoje)
            .Include(f => f.Transacoes)
            .Include(f => f.ParcelasTransacao)
            .ToListAsync();

        var agora = DateTime.UtcNow;
        // Uma execução do job = uma operação: os eventos dela compartilham o CorrelationId.
        var correlationId = Guid.NewGuid();
        foreach (var fatura in faturas)
        {
            fatura.EstadoCiclo = EstadoCicloFatura.Fechada;
            fatura.DataFechamentoEfetiva = agora;
            // Ciclo que fecha já coberto vira Pago. Cobre a fatura em que uma parcela foi cancelada com o
            // ciclo ABERTO: ela fica Parcial com restante 0 até aqui (ver a decisão em
            // RegrasFinanceiras.ReconciliarEstadoPagamento) — sem este passo o limite ficava preso.
            // Virar Pago solta o limite das compras à vista: registra no audit log como o caminho do
            // cancelamento faz (a trilha não pode depender de por onde a fatura foi quitada).
            if (RegrasFinanceiras.ReconciliarEstadoPagamento(fatura, agora))
                RegrasFinanceiras.RegistrarQuitacaoSemPagamentoNovo(
                    _eventLog, fatura, fatura.CriadoPor, correlationId,
                    origemAcao: "Job:FecharFaturas", motivo: "FechamentoComRestanteZero");
        }

        if (faturas.Any())
            await _context.SaveChangesAsync();
    }
}

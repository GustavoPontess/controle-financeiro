using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
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
        // Transacoes + ParcelasTransacao: o fechamento reconcilia o estado de pagamento pelo total.
        var faturas = await _context.Faturas
            .Where(f => f.EstadoCiclo == EstadoCicloFatura.Aberta && f.DataFechamento <= hoje)
            .Include(f => f.Transacoes)
            .Include(f => f.ParcelasTransacao)
            .ToListAsync();

        var agora = DateTime.UtcNow;
        foreach (var fatura in faturas)
        {
            fatura.EstadoCiclo = EstadoCicloFatura.Fechada;
            fatura.DataFechamentoEfetiva = agora;
            // Ciclo que fecha já coberto vira Pago. Cobre a fatura em que uma parcela foi cancelada com o
            // ciclo ABERTO: ela fica Parcial com restante 0 até aqui (ver a decisão em
            // RegrasFinanceiras.ReconciliarEstadoPagamento) — sem este passo o limite ficava preso.
            RegrasFinanceiras.ReconciliarEstadoPagamento(fatura, agora);
        }

        if (faturas.Any())
            await _context.SaveChangesAsync();
    }
}

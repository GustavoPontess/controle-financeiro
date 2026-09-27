using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Infrastructure.Jobs;

public class FaturaAtrasoJob
{
    private readonly AppDbContext _context;

    public FaturaAtrasoJob(AppDbContext context)
    {
        _context = context;
    }

    public async Task ExecuteAsync()
    {
        var hoje = DateTime.UtcNow.Date;
        var faturas = await _context.Faturas
            .Where(f => !f.EstaAtrasada && f.DataVencimento < hoje && f.EstadoPagamento != EstadoPagamentoFatura.Pago)
            .Include(f => f.Transacoes)
            .Include(f => f.ParcelasTransacao)
            .ToListAsync();

        foreach (var fatura in faturas)
        {
            // Mesma regra de total da tela/pagamento (parcela cancelada não gera juros nem multa).
            var valorTotal = RegrasFinanceiras.ValorTotalFatura(fatura);
            fatura.EstaAtrasada = true;
            // Juros de mora: 1% ao mês + multa de 2% (simplificado)
            var diasAtraso = (hoje - fatura.DataVencimento).Days;
            var mesesAtraso = Math.Max(1, diasAtraso / 30);
            fatura.JurosDeMora = valorTotal * (decimal)mesesAtraso * 0.01m;
            fatura.Multa = valorTotal * 0.02m;
        }

        if (faturas.Any())
            await _context.SaveChangesAsync();
    }
}

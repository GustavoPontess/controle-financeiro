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

        var marcouAlguma = false;
        foreach (var fatura in faturas)
        {
            // Atraso deriva do RESTANTE (regra única), não do EstadoPagamento: fatura coberta que ficou
            // Parcial depois de um cancelamento, ou zerada sem pagamento (parcelamento cancelado), não
            // deve nada — marcar atrasada gravava juros/multa sobre dívida inexistente.
            var restante = RegrasFinanceiras.ValorRestanteFatura(fatura);
            if (restante <= 0) continue;

            fatura.EstaAtrasada = true;
            // Juros de mora: 1% ao mês + multa de 2% (simplificado), sobre o que FALTA pagar — o já pago
            // não está em atraso.
            var diasAtraso = (hoje - fatura.DataVencimento).Days;
            var mesesAtraso = Math.Max(1, diasAtraso / 30);
            fatura.JurosDeMora = restante * (decimal)mesesAtraso * 0.01m;
            fatura.Multa = restante * 0.02m;
            marcouAlguma = true;
        }

        if (marcouAlguma)
            await _context.SaveChangesAsync();
    }
}

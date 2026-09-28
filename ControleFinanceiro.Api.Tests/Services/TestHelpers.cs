using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.Extensions.Logging.Abstractions;

namespace ControleFinanceiro.Api.Tests.Services;

internal static class TestHelpers
{
    /// <summary>NotificacaoService com logger nulo, para injetar nos serviços sob teste.</summary>
    public static NotificacaoService Notif(AppDbContext ctx) =>
        new(ctx, NullLogger<NotificacaoService>.Instance);

    /// <summary>NotificacaoAdminService com logger nulo, para injetar nos serviços sob teste.</summary>
    public static NotificacaoAdminService NotifAdmin(AppDbContext ctx) =>
        new(ctx, NullLogger<NotificacaoAdminService>.Instance);

    /// <summary>FinancialEventLogService para injetar nos serviços transacionais.</summary>
    public static FinancialEventLogService EventLog(AppDbContext ctx) => new(ctx);

    /// <summary>
    /// "yyyy-MM" da fatura em que cai uma compra do dia <paramref name="data"/> — o mês em que ela FECHA.
    /// É a primeira parcela mais cedo que o parcelamento aceita; usar "o mês de hoje" deixava o teste
    /// dependente do dia (depois do fechamento a compra já cai na fatura do mês seguinte).
    /// </summary>
    public static string MesDaFatura(DateTime data, int? diaFechamento) =>
        FaturaService.CalcularPeriodo(data.Date, diaFechamento).fechamento
            .ToString("yyyy-MM", System.Globalization.CultureInfo.InvariantCulture);
}

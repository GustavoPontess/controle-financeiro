using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.Extensions.Logging.Abstractions;

namespace ControleFinanceiro.Api.Tests.Services;

internal static class TestHelpers
{
    /// <summary>NotificacaoService com logger nulo, para injetar nos serviços sob teste.</summary>
    public static NotificacaoService Notif(AppDbContext ctx) =>
        new(ctx, NullLogger<NotificacaoService>.Instance);
}

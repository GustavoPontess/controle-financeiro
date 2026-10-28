using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;

namespace ControleFinanceiro.Api.Infrastructure.Security;

/// <summary>
/// Limite GERAL de uso da API (2026-10-28, pedido do Gustavo): além dos limites das portas de entrada (login, cadastro,
/// senha, links), todo pedido conta. Sem ele, um script numa conta logada chamava transações, relatórios, importar e
/// exportar sem parar, num servidor dividido com o PontesDev.
/// <list type="bullet">
/// <item>Logado: conta pela PESSOA (id do login), não pelo IP: casa com várias pessoas no mesmo Wi-Fi não se atrapalha,
/// e trocar de IP não ajuda quem abusa.</item>
/// <item>Sem login: conta pelo IP.</item>
/// <item>Fora: <c>/health</c> (o proxy confere a saúde da API o tempo todo) e o painel do Hangfire.</item>
/// </list>
/// Rotas pesadas (importar extrato, exportar dados) têm um limite a mais, por pessoa (<see cref="PoliticaPesada"/>).
/// </summary>
public static class LimitesDeUso
{
    /// <summary>Pedidos por minuto de uma pessoa logada. Uma tela do app faz poucos por vez; 300 é folga larga.</summary>
    public const int PorMinutoLogado = 300;
    /// <summary>Pedidos por minuto de um IP sem login (site, telas de acesso, roster, refresh).</summary>
    public const int PorMinutoSemLogin = 120;
    /// <summary>Rotas pesadas: pedidos a cada 10 minutos por pessoa.</summary>
    public const int PesadoPor10Minutos = 20;

    public const string PoliticaPesada = "pesado";

    /// <summary>De quem é o pedido: "u:{id}" logado, "ip:{ip}" sem login.</summary>
    public static string ChaveDoCliente(HttpContext ctx)
    {
        var id = ctx.User.Identity?.IsAuthenticated == true ? ctx.User.FindFirstValue(ClaimTypes.NameIdentifier) : null;
        return id is not null ? $"u:{id}" : $"ip:{ctx.Connection.RemoteIpAddress?.ToString() ?? "desconhecido"}";
    }

    public static bool ForaDoLimite(HttpContext ctx) =>
        ctx.Request.Path.StartsWithSegments("/health") || ctx.Request.Path.StartsWithSegments("/hangfire");

    /// <summary>O limite geral (janela de 1 minuto). Em desenvolvimento, 10x mais folga.</summary>
    public static PartitionedRateLimiter<HttpContext> Geral(bool dev) =>
        PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        {
            if (ForaDoLimite(ctx)) return RateLimitPartition.GetNoLimiter("fora");
            var chave = ChaveDoCliente(ctx);
            var limite = (chave.StartsWith("u:") ? PorMinutoLogado : PorMinutoSemLogin) * (dev ? 10 : 1);
            return RateLimitPartition.GetFixedWindowLimiter(chave, _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = limite,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            });
        });

    /// <summary>Limite das rotas pesadas, por pessoa.</summary>
    public static RateLimitPartition<string> Pesado(HttpContext ctx, bool dev) =>
        RateLimitPartition.GetFixedWindowLimiter(ChaveDoCliente(ctx), _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = PesadoPor10Minutos * (dev ? 10 : 1),
            Window = TimeSpan.FromMinutes(10),
            QueueLimit = 0,
        });
}

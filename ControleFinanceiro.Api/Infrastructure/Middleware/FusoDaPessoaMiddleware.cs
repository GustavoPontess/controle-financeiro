using System.Security.Claims;
using ControleFinanceiro.Api.Services;

namespace ControleFinanceiro.Api.Infrastructure.Middleware;

/// <summary>
/// "Que dia é hoje" é o da pessoa logada (2026-11-02): põe o fuso da conta dela (<see cref="FusoHorarioService"/>) no
/// relógio do app durante a requisição, então todo <c>HorarioBrasil.Hoje()</c> do que ela chama responde no fuso dela.
/// Sem login, ou conta sem fuso, segue Brasília. Depois da autenticação (precisa do User).
/// </summary>
public class FusoDaPessoaMiddleware
{
    private readonly RequestDelegate _next;

    public FusoDaPessoaMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, FusoHorarioService fusos)
    {
        var id = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(id, out var usuarioId))
        {
            await _next(context);
            return;
        }
        using var _ = HorarioBrasil.UsarFuso(await fusos.ObterAsync(usuarioId));
        await _next(context);
    }
}

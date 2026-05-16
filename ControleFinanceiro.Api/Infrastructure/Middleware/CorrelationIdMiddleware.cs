using Serilog.Context;

namespace ControleFinanceiro.Api.Infrastructure.Middleware;

/// <summary>
/// Atribui um Correlation ID a cada request: reaproveita o header
/// X-Correlation-Id se vier do cliente, senão gera um GUID. O ID é
/// devolvido no header de response e injetado no LogContext do Serilog,
/// de modo que todos os logs da request o carregam.
/// </summary>
public class CorrelationIdMiddleware
{
    private const string HeaderName = "X-Correlation-Id";
    private readonly RequestDelegate _next;

    public CorrelationIdMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Request.Headers[HeaderName].FirstOrDefault();
        if (string.IsNullOrEmpty(correlationId))
            correlationId = Guid.NewGuid().ToString();

        context.Response.OnStarting(() =>
        {
            context.Response.Headers[HeaderName] = correlationId;
            return Task.CompletedTask;
        });

        using (LogContext.PushProperty("CorrelationId", correlationId))
        {
            await _next(context);
        }
    }
}

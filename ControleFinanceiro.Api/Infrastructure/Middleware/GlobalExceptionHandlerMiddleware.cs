using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.Services;
using System.Text.Json;

namespace ControleFinanceiro.Api.Infrastructure.Middleware;

/// <summary>
/// Middleware global que intercepta exceções não tratadas e as converte em
/// respostas HTTP padronizadas usando <see cref="ErrorResponseDto"/>.
///
/// Mapeamento de exceções:
/// - <see cref="ArgumentException"/>           → 400 Bad Request   (VALIDATION_ERROR)
/// - <see cref="KeyNotFoundException"/>         → 404 Not Found     (NOT_FOUND)
/// - <see cref="InvalidOperationException"/>    → 409 Conflict      (BUSINESS_RULE_VIOLATION)
/// - <see cref="ControleFinanceiro.Api.Services.ForbiddenAccessException"/> → 403 Forbidden (FORBIDDEN)
/// - <see cref="UnauthorizedAccessException"/>  → 401 Unauthorized  (UNAUTHORIZED)
/// - Qualquer outra                             → 500 Internal      (INTERNAL_ERROR)
/// </summary>
public sealed class GlobalExceptionHandlerMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionHandlerMiddleware> _logger;

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public GlobalExceptionHandlerMiddleware(
        RequestDelegate next,
        ILogger<GlobalExceptionHandlerMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var (statusCode, code) = exception switch
        {
            ArgumentException          => (StatusCodes.Status400BadRequest,          "VALIDATION_ERROR"),
            KeyNotFoundException        => (StatusCodes.Status404NotFound,             "NOT_FOUND"),
            InvalidOperationException   => (StatusCodes.Status409Conflict,             "BUSINESS_RULE_VIOLATION"),
            ForbiddenAccessException    => (StatusCodes.Status403Forbidden,            "FORBIDDEN"),
            UnauthorizedAccessException => (StatusCodes.Status401Unauthorized,         "UNAUTHORIZED"),
            _                          => (StatusCodes.Status500InternalServerError,   "INTERNAL_ERROR")
        };

        var isServerError = statusCode == StatusCodes.Status500InternalServerError;

        if (isServerError)
            _logger.LogError(exception, "Unhandled exception");
        else
            _logger.LogWarning(exception, "Handled exception [{Code}]", code);

        // No 500 a mensagem da exceção pode carregar detalhe interno (EF/Npgsql, stack,
        // SQL) — nunca ecoar pro cliente. O detalhe fica só no log do servidor; o cliente
        // recebe uma mensagem genérica. Exceções mapeadas (4xx) têm mensagem de domínio
        // intencional e segura, essas seguem pro cliente.
        var message = isServerError
            ? "Erro interno do servidor. Tente novamente mais tarde."
            : exception.Message;

        var response = new ErrorResponseDto
        {
            Message = message,
            Code    = code
        };

        context.Response.StatusCode  = statusCode;
        context.Response.ContentType = "application/json";

        await context.Response.WriteAsync(JsonSerializer.Serialize(response, _jsonOptions));
    }
}

using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.Services;
using System.Text.Json;

namespace ControleFinanceiro.Api.Infrastructure.Middleware;

/// <summary>
/// Middleware global que intercepta exceções não tratadas e as converte em
/// respostas HTTP padronizadas usando <see cref="ErrorResponseDto"/>.
///
/// Mapeamento de exceções:
/// - <see cref="Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException"/> → 409 Conflict (CONCURRENCY_CONFLICT, mensagem fixa por entidade)
/// - <see cref="ArgumentException"/>           → 400 Bad Request   (VALIDATION_ERROR)
/// - <see cref="KeyNotFoundException"/>         → 404 Not Found     (NOT_FOUND)
/// - <see cref="InvalidOperationException"/>    → 409 Conflict      (BUSINESS_RULE_VIOLATION)
/// - <see cref="ControleFinanceiro.Api.Services.ForbiddenAccessException"/> → 403 Forbidden (FORBIDDEN)
/// - <see cref="ControleFinanceiro.Api.Services.RefreshEmCorridaException"/> → 401 Unauthorized (REFRESH_EM_CORRIDA)
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

    /// <summary>
    /// Mensagem fixa do 409 de concorrência quando o conflito foi numa Fatura (token xmin). A
    /// mensagem do EF (DbUpdateConcurrencyException) cita contagem de linhas/entidades — detalhe
    /// interno que não vai pro cliente.
    /// </summary>
    public const string MensagemConflitoFatura =
        "Esta fatura foi alterada por outra operação. Recarregue e tente de novo.";

    /// <summary>
    /// Mensagem fixa do 409 de concorrência nas demais entidades. O EF lança
    /// DbUpdateConcurrencyException em QUALQUER UPDATE/DELETE que afeta 0 linhas, não só onde há
    /// token de concorrência — ex.: duplo POST do MFA faz Remove(challenge) duas vezes, duplo
    /// excluir transferência. Falar de "fatura" nesses casos confundiria o usuário.
    /// </summary>
    public const string MensagemConflitoConcorrencia =
        "Este registro foi alterado por outra operação. Recarregue e tente de novo.";

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var (statusCode, code) = exception switch
        {
            // Concorrência otimista (xmin): outra operação alterou o registro entre a leitura e o
            // UPDATE — o nosso afetou 0 linhas. É conflito do cliente (recarregar e refazer), não
            // erro do servidor; sem isto caía no default e virava 500. Não herda de nenhum tipo
            // mapeado abaixo, mas fica no topo pra deixar explícito que tem prioridade.
            Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException
                                        => (StatusCodes.Status409Conflict,             "CONCURRENCY_CONFLICT"),
            // Corpo acima do limite (Kestrel MaxRequestBodySize) ou request malformado: o Kestrel
            // lança BadHttpRequestException com o StatusCode certo (413/400). Sem isto caía no default
            // e virava 500 — request JÁ é rejeitado (protege DoS), mas o status/log ficavam errados.
            Microsoft.AspNetCore.Http.BadHttpRequestException bad => (bad.StatusCode, "BAD_REQUEST"),
            ArgumentException          => (StatusCodes.Status400BadRequest,          "VALIDATION_ERROR"),
            KeyNotFoundException        => (StatusCodes.Status404NotFound,             "NOT_FOUND"),
            InvalidOperationException   => (StatusCodes.Status409Conflict,             "BUSINESS_RULE_VIOLATION"),
            ForbiddenAccessException    => (StatusCodes.Status403Forbidden,            "FORBIDDEN"),
            // Subtipo do 401: TEM que vir antes do UnauthorizedAccessException (o compilador acusa se
            // não vier). Code próprio pra o front distinguir "outra aba já renovou" de "sessão morta".
            RefreshEmCorridaException   => (StatusCodes.Status401Unauthorized,         "REFRESH_EM_CORRIDA"),
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
            : statusCode == StatusCodes.Status413PayloadTooLarge
                ? "Requisição grande demais."
                : exception is Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException concorrencia
                    ? MensagemDeConcorrencia(concorrencia)
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

    /// <summary>
    /// Escolhe a mensagem pela entidade que conflitou (<c>Entries</c> = as linhas cujo UPDATE/DELETE
    /// afetou 0 linhas). Sem entrada de Fatura → mensagem genérica, nunca a da fatura por engano.
    /// </summary>
    private static string MensagemDeConcorrencia(Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException ex) =>
        ex.Entries.Any(e => e.Entity is Fatura) ? MensagemConflitoFatura : MensagemConflitoConcorrencia;
}

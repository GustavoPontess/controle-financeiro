namespace ControleFinanceiro.Api.DTOs.Common;

/// <summary>
/// Envelope de erro padronizado retornado em todas as respostas de erro da API.
/// </summary>
public sealed class ErrorResponseDto
{
    /// <summary>Mensagem legível descrevendo o erro.</summary>
    public string Message { get; init; } = string.Empty;

    /// <summary>Código de erro categórico (ex: VALIDATION_ERROR, NOT_FOUND).</summary>
    public string Code { get; init; } = string.Empty;
}

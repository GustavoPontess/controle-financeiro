namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Usuário está autenticado, mas não tem permissão para o recurso/ação (ownership ou papel).
/// Mapeada para HTTP 403 Forbidden — distinta de <see cref="UnauthorizedAccessException"/> (401),
/// que significa NÃO autenticado. O 403 não dispara logout no front (só o 401 dispara).
/// </summary>
public class ForbiddenAccessException : Exception
{
    public ForbiddenAccessException(string message) : base(message) { }
}

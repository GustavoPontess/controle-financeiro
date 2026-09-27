namespace ControleFinanceiro.Api.Services;

/// <summary>
/// O refresh apresentado já tinha sido rotacionado segundos antes, pelo MESMO dispositivo — é a corrida
/// do próprio cliente (ex.: duas abas restauradas juntas, cada uma com seu single-flight), não replay.
/// Mapeada para HTTP 401 com code <c>REFRESH_EM_CORRIDA</c> (GlobalExceptionHandlerMiddleware): o front
/// entende que a sessão já foi renovada pela request que ganhou (cookies novos no navegador) e refaz a
/// request original UMA vez em vez de mandar pro login — que, se a pessoa relogasse, revogaria os rt_*
/// e derrubaria a outra aba. Deriva de <see cref="UnauthorizedAccessException"/> de propósito: quem só
/// conhece o 401 genérico continua tratando como não autenticado (fail-closed).
/// </summary>
public class RefreshEmCorridaException : UnauthorizedAccessException
{
    public RefreshEmCorridaException(string message) : base(message) { }
}

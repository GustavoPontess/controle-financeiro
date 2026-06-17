namespace ControleFinanceiro.Api.Infrastructure.Identity;

/// <summary>
/// Dispara, de forma fire-and-forget, a geração do token de reset e o envio do e-mail.
/// Usado pelo <c>/forgot-password</c> para que o caminho da requisição seja constante e
/// idêntico para e-mail existente ou não — sem oráculo de timing/enumeração — e nada vaze
/// na resposta HTTP.
/// </summary>
public interface IPasswordResetDispatcher
{
    void Disparar(string email);
}

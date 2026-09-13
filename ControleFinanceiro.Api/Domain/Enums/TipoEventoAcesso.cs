namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// Tipo do evento de acesso registrado no <c>RegistroAcesso</c> (retenção Marco Civil Art. 15).
/// Valores inteiros são persistidos — NÃO reordenar nem reaproveitar números.
/// </summary>
public enum TipoEventoAcesso
{
    /// <summary>Login concluído com sucesso (com ou sem MFA) — o "acesso à aplicação".</summary>
    Login = 0,
}

namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// Finalidade de um código OTP por e-mail (`EmailOtp`). O código é <b>escopado por finalidade</b> —
/// um código emitido pra excluir conta NÃO serve pra outra ação (e vice-versa). Valores inteiros são
/// persistidos — NÃO reordenar nem reaproveitar números.
/// </summary>
public enum TipoOtpEmail
{
    /// <summary>Confirmar a exclusão da própria conta (2º fator de reserva pra quem não tem TOTP).</summary>
    ExcluirConta = 0,
}

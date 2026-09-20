namespace ControleFinanceiro.Api.DTOs.Auth;

/// <summary>Item do chooser pré-login. Nunca traz e-mail inteiro (mascarado) nem token.</summary>
public class ContaLembradaDto
{
    public Guid UsuarioId { get; set; }
    public string Nome { get; set; } = string.Empty;

    /// <summary>E-mail mascarado pra exibir na lista (ex.: <c>gu•••@gmail.com</c>) — reduz exposição
    /// de PII num navegador compartilhado. O e-mail real só é digitado pela pessoa no passo da senha.</summary>
    public string EmailMascarado { get; set; } = string.Empty;
}

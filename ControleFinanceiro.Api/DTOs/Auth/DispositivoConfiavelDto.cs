namespace ControleFinanceiro.Api.DTOs.Auth;

/// <summary>
/// Dispositivo confiável (MFA "confiar neste dispositivo por 30 dias") — tela de Configurações. Nunca leva
/// o token, só id + metadados de exibição (o mesmo mínimo da sessão: aparelho e IP de criação).
/// </summary>
public class DispositivoConfiavelDto
{
    public Guid Id { get; set; }
    public DateTime CriadoEm { get; set; }
    public DateTime? UltimoUsoEm { get; set; }
    public DateTime ExpiraEm { get; set; }
    public string? Dispositivo { get; set; }
    public string? Ip { get; set; }

    /// <summary>É o deste navegador (o cookie <c>td</c> da requisição casa com ele).</summary>
    public bool Atual { get; set; }
}

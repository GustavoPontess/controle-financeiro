namespace ControleFinanceiro.Api.DTOs.Auth;

/// <summary>
/// Uma sessão ativa do usuário (refresh token não revogado/expirado) para a tela "Sessões / dispositivos".
/// Nunca inclui o token — só id e metadados de exibição.
/// </summary>
public class SessaoDto
{
    public Guid Id { get; set; }
    public DateTime CriadoEm { get; set; }
    public DateTime? UltimoUsoEm { get; set; }
    public string? Dispositivo { get; set; }
    public string? Ip { get; set; }

    /// <summary>É a sessão que está fazendo esta requisição (a conta ativa neste navegador).</summary>
    public bool Atual { get; set; }
}

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Dispositivo confiável pra MFA ("lembrar este dispositivo por X dias"). Quando o usuário marca
/// a opção no 2º passo do login, o navegador guarda um token opaco num cookie httpOnly e aqui fica
/// só o HASH desse token, amarrado à conta. Nos próximos X dias, o login NESSE navegador PULA o 2º
/// fator (NUNCA a senha) — mas só pra ESSA conta: a checagem exige <c>UsuarioId</c> == quem está
/// logando (anti-cross-account em navegador compartilhado; é o motivo de esta feature ter esperado
/// o fix do multi-conta). Fail-closed: token ausente/errado/revogado/expirado → cai no fluxo normal
/// de código. Revogável em massa (troca de senha, reset, desativar MFA, marcar conta pra exclusão)
/// e — quando a tela existir — 1 a 1. Minimização (LGPD): sem fingerprint; só hash do token +
/// User-Agent truncado + IP, e estes dois apenas pra exibir "de onde/quando" na lista de dispositivos.
/// </summary>
public class TrustedDevice
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }

    /// <summary>Hash SHA-256 (hex) do token opaco — o bruto vive só no cookie do navegador.</summary>
    public string TokenHash { get; set; } = string.Empty;

    public DateTime ExpiraEm { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    /// <summary>Último login que pulou o MFA por conta deste device. Pra exibir na tela de dispositivos.</summary>
    public DateTime? UltimoUsoEm { get; set; }

    /// <summary>Revogado por evento de segurança (troca/reset de senha, desativar MFA, exclusão) ou
    /// pela tela de dispositivos. Revogado nunca mais pula o 2º fator.</summary>
    public bool Revogado { get; set; }

    /// <summary>User-Agent (truncado) da criação — só exibição. Minimização: sem parsing/fingerprint.</summary>
    public string? DispositivoInfo { get; set; }

    /// <summary>IP de criação — só exibição (mesmo dado do RefreshToken/RegistroAcesso).</summary>
    public string? IpCriacao { get; set; }

    // Nav
    public Usuario Usuario { get; set; } = null!;
}

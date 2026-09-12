using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Código OTP (PIN) enviado por e-mail — 2º fator de RESERVA (fallback pra quem não tem TOTP) em ações
/// sensíveis, e nunca método de login. Guarda só o <b>hash</b> do código (nunca o texto), com validade
/// curta, uso único e escopo por finalidade. E-mail é fator FRACO (NIST veda como out-of-band) — por
/// isso só é usado somado à senha atual, jamais como bypass de um TOTP ativo. Ver
/// `docs/SEGURANCA_BEST_PRACTICES.md`.
/// </summary>
public class EmailOtp
{
    public Guid Id { get; set; }

    public Guid UsuarioId { get; set; }

    public TipoOtpEmail Finalidade { get; set; }

    /// <summary>Hash do código (OpaqueTokenHasher). Nunca o código em texto puro.</summary>
    [Required]
    [MaxLength(128)]
    public string CodigoHash { get; set; } = string.Empty;

    public DateTime ExpiraEm { get; set; }

    public bool Usado { get; set; }

    /// <summary>Tentativas erradas — ao estourar o teto, o código é queimado (anti-brute do PIN curto).</summary>
    public int Tentativas { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}

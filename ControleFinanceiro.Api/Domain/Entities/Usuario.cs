using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.Domain.Entities;

public class Usuario
{
    public Guid Id { get; set; }

    [Required]
    [EmailAddress]
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Nome { get; set; } = string.Empty;

    public DateTime? DataNascimento { get; set; }

    public bool Ativo { get; set; } = true;

    /// <summary>Issue #29 — true depois que o usuário concluiu (ou pulou) o
    /// onboarding guiado. Evita reexibir o fluxo de primeiros passos.</summary>
    public bool OnboardingConcluido { get; set; }

    /// <summary>Proteção contra força bruta (OWASP Authentication Cheat Sheet) — contador
    /// por CONTA, não por IP (rate-limit por IP já existe, mas é contornável trocando IP).
    /// Zerado no login bem-sucedido e no reset de senha.</summary>
    public int FalhasLoginConsecutivas { get; set; }

    /// <summary>Timestamp da última falha de login — base do delay progressivo
    /// (dobra a cada erro, OWASP) calculado em <c>AuthService.LoginAsync</c>.</summary>
    public DateTime? UltimaFalhaLoginEm { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;

    // ── MFA (TOTP, opt-in — NUNCA obrigatório, decisão do Gustavo 2026-08-23) ────────────

    /// <summary>True quando o usuário ativou e confirmou o MFA. Login passa a exigir um
    /// segundo passo (código TOTP ou backup code) antes de emitir o JWT.</summary>
    public bool MfaAtivo { get; set; }

    /// <summary>Secret TOTP (RFC 6238), criptografado em repouso (<c>MfaCrypto</c>) — nunca em
    /// texto claro no banco. Null enquanto MFA não está ativo.</summary>
    public string? MfaSecretoCriptografado { get; set; }

    /// <summary>Secret gerado durante o setup, ainda não confirmado (usuário escaneou o QR mas
    /// não digitou o código de confirmação ainda). Vira <see cref="MfaSecretoCriptografado"/> só
    /// depois de validar 1 código certo — evita ativar MFA com secret que o app do usuário nunca
    /// recebeu direito (QR não escaneado / erro de leitura).</summary>
    public string? MfaSecretoPendenteCriptografado { get; set; }

    public DateTime? MfaAtivadoEm { get; set; }

    public Guid? RelacionamentoId { get; set; }
    public Relacionamento? Relacionamento { get; set; }

    // Navigation properties
    public ICollection<Conta> Contas { get; set; } = new List<Conta>();
    public ICollection<CompartilhamentoConta> CompartilhamentosContas { get; set; } = new List<CompartilhamentoConta>();
    public ICollection<MfaBackupCode> MfaBackupCodes { get; set; } = new List<MfaBackupCode>();
}

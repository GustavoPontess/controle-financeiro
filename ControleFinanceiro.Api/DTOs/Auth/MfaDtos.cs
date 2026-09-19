using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Auth;

/// <summary>Resposta do passo 1 de ativação — secret pra digitar manualmente + URI pro QR code.</summary>
public class MfaIniciarAtivacaoResponseDto
{
    public string SecretBase32 { get; set; } = string.Empty;
    public string QrCodeUri { get; set; } = string.Empty;
}

public class MfaConfirmarAtivacaoDto
{
    [Required]
    [MaxLength(10)] // TOTP tem 6 dígitos; backup code é curto
    public string Codigo { get; set; } = string.Empty;
}

/// <summary>Backup codes em texto claro — só aparecem aqui, uma vez. Nunca mais recuperáveis
/// depois disso (só o hash fica no banco).</summary>
public class MfaAtivacaoConfirmadaResponseDto
{
    public List<string> BackupCodes { get; set; } = new();
}

public class MfaDesativarDto
{
    [Required]
    [MaxLength(128)]
    public string SenhaAtual { get; set; } = string.Empty;

    [Required]
    [MaxLength(10)]
    public string Codigo { get; set; } = string.Empty;
}

public class MfaVerificarLoginDto
{
    [Required]
    [MaxLength(512)]
    public string ChallengeToken { get; set; } = string.Empty;

    [Required]
    [MaxLength(10)]
    public string Codigo { get; set; } = string.Empty;

    /// <summary>Opt-in "confiar neste dispositivo por X dias": se true, após validar o código o
    /// servidor cria um <see cref="Domain.Entities.TrustedDevice"/> e seta o cookie httpOnly `td`,
    /// e os próximos logins NESTE navegador (só desta conta) pulam o 2º fator até expirar. Default
    /// false (opt-in explícito, LGPD).</summary>
    public bool ConfiarDispositivo { get; set; }
}

public class MfaStatusDto
{
    public bool Ativo { get; set; }
    public DateTime? AtivadoEm { get; set; }
    public int BackupCodesRestantes { get; set; }
}

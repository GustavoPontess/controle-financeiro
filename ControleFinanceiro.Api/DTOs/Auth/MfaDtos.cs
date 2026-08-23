namespace ControleFinanceiro.Api.DTOs.Auth;

/// <summary>Resposta do passo 1 de ativação — secret pra digitar manualmente + URI pro QR code.</summary>
public class MfaIniciarAtivacaoResponseDto
{
    public string SecretBase32 { get; set; } = string.Empty;
    public string QrCodeUri { get; set; } = string.Empty;
}

public class MfaConfirmarAtivacaoDto
{
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
    public string SenhaAtual { get; set; } = string.Empty;
    public string Codigo { get; set; } = string.Empty;
}

public class MfaVerificarLoginDto
{
    public string ChallengeToken { get; set; } = string.Empty;
    public string Codigo { get; set; } = string.Empty;
}

public class MfaStatusDto
{
    public bool Ativo { get; set; }
    public DateTime? AtivadoEm { get; set; }
    public int BackupCodesRestantes { get; set; }
}

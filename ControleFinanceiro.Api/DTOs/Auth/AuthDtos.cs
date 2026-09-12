using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Auth;

public class LoginDto
{
    [Required]
    [EmailAddress]
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    // Cap de 128 no login também: senha gigante força o Argon2 a hashear um input enorme
    // a cada tentativa (CPU DoS). O mínimo/força é validado no cadastro/reset.
    [Required]
    [MaxLength(128)]
    public string Password { get; set; } = string.Empty;
}

public class RegisterDto
{
    [Required]
    [EmailAddress]
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Nome { get; set; } = string.Empty;

    public DateTime? DataNascimento { get; set; }

    // Teto de 128 (política NIST já aplica o mínimo 15 + blocklist no PasswordPolicyService).
    // O teto impede senha gigante virar DoS no Argon2.
    [Required]
    [MaxLength(128)]
    public string Password { get; set; } = string.Empty;

    [Required]
    [MaxLength(128)]
    public string ConfirmPassword { get; set; } = string.Empty;
}

public class AuthResponseDto
{
    public Guid UsuarioId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime RefreshTokenExpiresAt { get; set; }
}

/// <summary>
/// Resultado de <c>AuthService.LoginAsync</c> — ou o login já terminou (<see cref="Auth"/>
/// preenchido) ou o usuário tem MFA ativo e precisa completar o 2º fator antes de ganhar
/// sessão de verdade (<see cref="MfaChallengeToken"/> preenchido, SEM cookie de sessão
/// setado ainda — só depois de <c>MfaService.VerificarLoginAsync</c> confirmar o código).
/// </summary>
public class LoginResultDto
{
    public bool MfaRequerido { get; set; }
    public string? MfaChallengeToken { get; set; }
    public AuthResponseDto? Auth { get; set; }

    /// <summary>Conta na carência de exclusão (senha provada). NÃO emite sessão — o front oferece
    /// reativar. <see cref="DiasRestantesExclusao"/> = dias até a purga automática.</summary>
    public bool ContaMarcadaExclusao { get; set; }
    public int? DiasRestantesExclusao { get; set; }
}

/// <summary>Reativação da própria conta na carência (usuário não está logado — vem por credenciais).</summary>
public class ReativarContaRequest
{
    [Required]
    [EmailAddress]
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MaxLength(128)]
    public string Senha { get; set; } = string.Empty;
}

public class UsuarioDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public DateTime? DataNascimento { get; set; }

    /// <summary>Situação da conta. Serializado como número (padrão do projeto — enums vão como int
    /// no JSON). Só <c>Ativo</c> (1) tem sessão de verdade; o <c>/auth/me</c> só responde pra quem já
    /// passou pelo login, então na prática vem sempre <c>Ativo</c>.</summary>
    public StatusUsuario Status { get; set; }
    public DateTime CriadoEm { get; set; }

    /// <summary>Admin global. Exposto pro front decidir se mostra a entrada do painel admin e libera
    /// a rota (defesa em profundidade — a fronteira real é a policy IsAdmin no backend, revalidada no
    /// banco a cada request). É atributo do próprio usuário: comum recebe false.</summary>
    public bool IsAdmin { get; set; }
}

/// <summary>
/// Resposta do cadastro no beta. Diferente do login: NÃO traz token/sessão — a conta nasce
/// <see cref="StatusUsuario.AguardandoAprovacao"/> e só loga depois que o admin aprova (gate do
/// beta, spec `docs/features/admin/spec.md` §3). O front mostra "cadastro enviado, aguarde aprovação".
/// </summary>
public class RegisterResponseDto
{
    public StatusUsuario Status { get; set; }
    public string Mensagem { get; set; } = string.Empty;
}

public class RefreshTokenRequestDto
{
    [Required]
    [MaxLength(512)]
    public string RefreshToken { get; set; } = string.Empty;
}

public class LogoutDto
{
    [Required]
    [MaxLength(512)]
    public string RefreshToken { get; set; } = string.Empty;
}

public class ForgotPasswordDto
{
    [Required]
    [EmailAddress]
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;
}

public class ResetPasswordDto
{
    [Required]
    [MaxLength(512)]
    public string Token { get; set; } = string.Empty;

    [Required]
    [MaxLength(128)]
    public string NovaSenha { get; set; } = string.Empty;

    [Required]
    [MaxLength(128)]
    public string ConfirmarNovaSenha { get; set; } = string.Empty;
}

public class ForgotPasswordResponseDto
{
    /// <summary>
    /// Mensagem genérica e idêntica para qualquer e-mail (evita enumeração de usuário).
    /// O token de reset NUNCA é retornado aqui — chega ao usuário apenas por e-mail.
    /// </summary>
    public string Mensagem { get; set; } = string.Empty;
}

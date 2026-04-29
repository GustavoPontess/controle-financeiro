namespace ControleFinanceiro.Api.DTOs.Auth;

public class LoginDto
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class RegisterDto
{
    public string Email { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public DateTime? DataNascimento { get; set; }
    public string Password { get; set; } = string.Empty;
    public string ConfirmPassword { get; set; } = string.Empty;
}

public class AuthResponseDto
{
    public Guid UsuarioId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
}

public class UsuarioDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public DateTime? DataNascimento { get; set; }
    public bool Ativo { get; set; }
    public DateTime CriadoEm { get; set; }
}

using System.Security.Cryptography;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Auth;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

public class AuthService
{
    private readonly AppDbContext _context;
    private readonly JwtTokenProvider _tokenProvider;

    private const int RefreshTokenDays = 7;
    private const int ResetTokenHours = 1;

    public AuthService(AppDbContext context, JwtTokenProvider tokenProvider)
    {
        _context = context;
        _tokenProvider = tokenProvider;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static string GerarTokenOpaco()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToHexString(bytes).ToLower();
    }

    private async Task<RefreshToken> CriarRefreshTokenAsync(Guid usuarioId)
    {
        var rt = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UsuarioId = usuarioId,
            Token = GerarTokenOpaco(),
            ExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenDays),
            Revogado = false,
            CriadoEm = DateTime.UtcNow,
        };
        _context.RefreshTokens.Add(rt);
        return rt;
    }

    public async Task<AuthResponseDto> RegisterAsync(RegisterDto dto)
    {
        // Validate input
        if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
            throw new ArgumentException("Email e senha são obrigatórios");

        if (dto.Password != dto.ConfirmPassword)
            throw new ArgumentException("Senhas não conferem");

        if (dto.Password.Length < 6)
            throw new ArgumentException("Senha deve ter no mínimo 6 caracteres");

        // Check if email already exists
        if (_context.Usuarios.Any(u => u.Email == dto.Email))
            throw new InvalidOperationException("Email já cadastrado");

        // Create new user
        var usuario = new Usuario
        {
            Id = Guid.NewGuid(),
            Email = dto.Email.ToLower(),
            Nome = dto.Nome,
            DataNascimento = dto.DataNascimento,
            PasswordHash = PasswordHasher.HashPassword(dto.Password),
            Ativo = true,
            CriadoEm = DateTime.UtcNow,
            AtualizadoEm = DateTime.UtcNow
        };

        _context.Usuarios.Add(usuario);

        _context.Contas.Add(new Conta
        {
            Id = Guid.NewGuid(),
            Nome = "Carteira",
            Tipo = TipoConta.ContaPoupanca,
            IsCarteira = true,
            UsuarioIdProprietario = usuario.Id
        });

        var rt = await CriarRefreshTokenAsync(usuario.Id);
        await _context.SaveChangesAsync();

        var token = _tokenProvider.GenerateToken(usuario.Id, usuario.Email, usuario.Nome);

        return new AuthResponseDto
        {
            UsuarioId = usuario.Id,
            Email = usuario.Email,
            Nome = usuario.Nome,
            Token = token,
            RefreshToken = rt.Token,
            RefreshTokenExpiresAt = rt.ExpiresAt,
        };
    }

    public async Task<AuthResponseDto> LoginAsync(LoginDto dto)
    {
        // Validate input
        if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
            throw new ArgumentException("Email e senha são obrigatórios");

        // Find user
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Email == dto.Email.ToLower());
        if (usuario == null)
            throw new InvalidOperationException("Email ou senha inválidos");

        // Verify password
        if (!PasswordHasher.VerifyPassword(dto.Password, usuario.PasswordHash))
            throw new InvalidOperationException("Email ou senha inválidos");

        if (!usuario.Ativo)
            throw new InvalidOperationException("Usuário inativo");

        var rt = await CriarRefreshTokenAsync(usuario.Id);
        await _context.SaveChangesAsync();

        var token = _tokenProvider.GenerateToken(usuario.Id, usuario.Email, usuario.Nome);

        return new AuthResponseDto
        {
            UsuarioId = usuario.Id,
            Email = usuario.Email,
            Nome = usuario.Nome,
            Token = token,
            RefreshToken = rt.Token,
            RefreshTokenExpiresAt = rt.ExpiresAt,
        };
    }

    // ── Refresh Token ────────────────────────────────────────────────────────

    /// <summary>
    /// Valida o refresh token, rotaciona (revoga o antigo, cria novo) e retorna novo par de tokens.
    /// </summary>
    public async Task<AuthResponseDto> RefreshAsync(string refreshToken)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
            throw new ArgumentException("Refresh token é obrigatório.");

        var rt = await _context.RefreshTokens
            .Include(r => r.Usuario)
            .FirstOrDefaultAsync(r => r.Token == refreshToken);

        if (rt == null || rt.Revogado || rt.ExpiresAt <= DateTime.UtcNow)
            throw new InvalidOperationException("Refresh token inválido ou expirado.");

        if (!rt.Usuario.Ativo)
            throw new InvalidOperationException("Usuário inativo.");

        // Revogar o token atual (rotação)
        rt.Revogado = true;

        // Criar novo refresh token
        var novoRt = await CriarRefreshTokenAsync(rt.UsuarioId);
        await _context.SaveChangesAsync();

        var jwtToken = _tokenProvider.GenerateToken(rt.Usuario.Id, rt.Usuario.Email, rt.Usuario.Nome);

        return new AuthResponseDto
        {
            UsuarioId = rt.Usuario.Id,
            Email = rt.Usuario.Email,
            Nome = rt.Usuario.Nome,
            Token = jwtToken,
            RefreshToken = novoRt.Token,
            RefreshTokenExpiresAt = novoRt.ExpiresAt,
        };
    }

    /// <summary>
    /// Revoga o refresh token (logout). Silencioso se token não encontrado.
    /// </summary>
    public async Task LogoutAsync(string refreshToken)
    {
        if (string.IsNullOrWhiteSpace(refreshToken)) return;

        var rt = await _context.RefreshTokens
            .FirstOrDefaultAsync(r => r.Token == refreshToken && !r.Revogado);

        if (rt != null)
        {
            rt.Revogado = true;
            await _context.SaveChangesAsync();
        }
    }

    // ── Forgot / Reset Password ───────────────────────────────────────────────

    /// <summary>
    /// Gera um token de reset de senha com validade de 1 hora.
    /// Em produção o token seria enviado por e-mail; aqui é retornado diretamente.
    /// </summary>
    public async Task<ForgotPasswordResponseDto> SolicitarResetSenhaAsync(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("E-mail é obrigatório.");

        // Resposta genérica mesmo quando e-mail não existe (evita user enumeration)
        var usuario = await _context.Usuarios
            .FirstOrDefaultAsync(u => u.Email == email.ToLower() && u.Ativo);

        if (usuario == null)
        {
            return new ForgotPasswordResponseDto
            {
                ResetToken = string.Empty,
                ExpiresAt = DateTime.UtcNow.AddHours(ResetTokenHours),
                Mensagem = "Se o e-mail existir, um link de recuperação será enviado.",
            };
        }

        // Invalidar tokens anteriores do mesmo usuário
        var tokensAntigos = await _context.PasswordResetTokens
            .Where(t => t.UsuarioId == usuario.Id && !t.Usado && t.ExpiresAt > DateTime.UtcNow)
            .ToListAsync();
        foreach (var t in tokensAntigos)
            t.Usado = true;

        // Criar novo token
        var prt = new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            UsuarioId = usuario.Id,
            Token = GerarTokenOpaco(),
            ExpiresAt = DateTime.UtcNow.AddHours(ResetTokenHours),
            Usado = false,
            CriadoEm = DateTime.UtcNow,
        };
        _context.PasswordResetTokens.Add(prt);
        await _context.SaveChangesAsync();

        // TODO: Em produção, enviar e-mail com link contendo prt.Token
        return new ForgotPasswordResponseDto
        {
            ResetToken = prt.Token,
            ExpiresAt = prt.ExpiresAt,
            Mensagem = "Token gerado. Em produção seria enviado por e-mail.",
        };
    }

    /// <summary>
    /// Valida o token de reset e altera a senha do usuário.
    /// </summary>
    public async Task ResetSenhaAsync(ResetPasswordDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Token))
            throw new ArgumentException("Token é obrigatório.");

        if (string.IsNullOrWhiteSpace(dto.NovaSenha) || dto.NovaSenha.Length < 6)
            throw new ArgumentException("Nova senha deve ter no mínimo 6 caracteres.");

        if (dto.NovaSenha != dto.ConfirmarNovaSenha)
            throw new ArgumentException("Senhas não conferem.");

        var prt = await _context.PasswordResetTokens
            .Include(t => t.Usuario)
            .FirstOrDefaultAsync(t => t.Token == dto.Token);

        if (prt == null || prt.Usado || prt.ExpiresAt <= DateTime.UtcNow)
            throw new InvalidOperationException("Token inválido ou expirado.");

        if (!prt.Usuario.Ativo)
            throw new InvalidOperationException("Usuário inativo.");

        // Alterar senha
        prt.Usuario.PasswordHash = PasswordHasher.HashPassword(dto.NovaSenha);
        prt.Usuario.AtualizadoEm = DateTime.UtcNow;

        // Invalidar token
        prt.Usado = true;

        // Revogar todos os refresh tokens do usuário (segurança pós-reset)
        var refreshTokens = await _context.RefreshTokens
            .Where(r => r.UsuarioId == prt.UsuarioId && !r.Revogado)
            .ToListAsync();
        foreach (var r in refreshTokens)
            r.Revogado = true;

        await _context.SaveChangesAsync();
    }

    public async Task<UsuarioDto?> GetUsuarioAsync(Guid usuarioId)
    {
        var usuario = await _context.Usuarios.FindAsync(usuarioId);
        if (usuario == null)
            return null;

        return new UsuarioDto
        {
            Id = usuario.Id,
            Email = usuario.Email,
            Nome = usuario.Nome,
            DataNascimento = usuario.DataNascimento,
            Ativo = usuario.Ativo,
            CriadoEm = usuario.CriadoEm
        };
    }

    public async Task<UsuarioDto> UpdateProfileAsync(Guid usuarioId, string nome, DateTime? dataNascimento)
    {
        var usuario = await _context.Usuarios.FindAsync(usuarioId);
        if (usuario == null)
            throw new InvalidOperationException("Usuário não encontrado");

        usuario.Nome = nome;
        usuario.DataNascimento = dataNascimento;
        usuario.AtualizadoEm = DateTime.UtcNow;

        _context.Usuarios.Update(usuario);
        await _context.SaveChangesAsync();

        return new UsuarioDto
        {
            Id = usuario.Id,
            Email = usuario.Email,
            Nome = usuario.Nome,
            DataNascimento = usuario.DataNascimento,
            Ativo = usuario.Ativo,
            CriadoEm = usuario.CriadoEm
        };
    }

    public async Task ChangePasswordAsync(Guid usuarioId, string senhaAtual, string novaSenha)
    {
        var usuario = await _context.Usuarios.FindAsync(usuarioId);
        if (usuario == null)
            throw new InvalidOperationException("Usuário não encontrado");

        if (!PasswordHasher.VerifyPassword(senhaAtual, usuario.PasswordHash))
            throw new InvalidOperationException("Senha atual inválida");

        if (novaSenha.Length < 6)
            throw new ArgumentException("Nova senha deve ter no mínimo 6 caracteres");

        usuario.PasswordHash = PasswordHasher.HashPassword(novaSenha);
        usuario.AtualizadoEm = DateTime.UtcNow;

        _context.Usuarios.Update(usuario);
        await _context.SaveChangesAsync();
    }
}

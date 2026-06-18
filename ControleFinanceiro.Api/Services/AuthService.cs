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
    private readonly IPasswordResetDispatcher _resetDispatcher;

    private const int RefreshTokenDays = 7;

    public AuthService(
        AppDbContext context,
        JwtTokenProvider tokenProvider,
        IPasswordResetDispatcher resetDispatcher)
    {
        _context = context;
        _tokenProvider = tokenProvider;
        _resetDispatcher = resetDispatcher;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static string GerarTokenOpaco()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToHexString(bytes).ToLower();
    }

    // Retorna (entidade, token BRUTO). O bruto vai pro cliente (cookie); no banco
    // guarda-se só o hash (igual ao reset token) — vazamento de DB não dá refresh tokens
    // reutilizáveis.
    private Task<(RefreshToken Entity, string TokenBruto)> CriarRefreshTokenAsync(Guid usuarioId)
    {
        var tokenBruto = GerarTokenOpaco();
        var rt = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UsuarioId = usuarioId,
            Token = OpaqueTokenHasher.Hash(tokenBruto),
            ExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenDays),
            Revogado = false,
            CriadoEm = DateTime.UtcNow,
        };
        _context.RefreshTokens.Add(rt);
        // Sem I/O aqui (o SaveChanges é do caller) — não precisa de async/await.
        return Task.FromResult((rt, tokenBruto));
    }

    public async Task<AuthResponseDto> RegisterAsync(RegisterDto dto)
    {
        // Validate input
        if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
            throw new ArgumentException("Email e senha são obrigatórios");

        if (dto.Password != dto.ConfirmPassword)
            throw new ArgumentException("Senhas não conferem");

        PasswordPolicyService.ValidarOuLancar(dto.Password);

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

        var (rt, refreshBruto) = await CriarRefreshTokenAsync(usuario.Id);
        await _context.SaveChangesAsync();

        var token = _tokenProvider.GenerateToken(usuario.Id, usuario.Email, usuario.Nome);

        return new AuthResponseDto
        {
            UsuarioId = usuario.Id,
            Email = usuario.Email,
            Nome = usuario.Nome,
            Token = token,
            RefreshToken = refreshBruto,
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
            throw new UnauthorizedAccessException("Email ou senha inválidos");

        // Verify password
        if (!PasswordHasher.VerifyPassword(dto.Password, usuario.PasswordHash))
            throw new UnauthorizedAccessException("Email ou senha inválidos");

        if (!usuario.Ativo)
            throw new UnauthorizedAccessException("Usuário inativo");

        // Rehash transparente: senha legada (PBKDF2 10k/20B) ou Argon2id com parâmetros
        // antigos é regravada com o esquema atual após verificação bem-sucedida — upgrade
        // gradual sem forçar reset (OWASP). Persistido no SaveChanges abaixo.
        if (PasswordHasher.NeedsRehash(usuario.PasswordHash))
            usuario.PasswordHash = PasswordHasher.HashPassword(dto.Password);

        var (rt, refreshBruto) = await CriarRefreshTokenAsync(usuario.Id);
        await _context.SaveChangesAsync();

        var token = _tokenProvider.GenerateToken(usuario.Id, usuario.Email, usuario.Nome);

        return new AuthResponseDto
        {
            UsuarioId = usuario.Id,
            Email = usuario.Email,
            Nome = usuario.Nome,
            Token = token,
            RefreshToken = refreshBruto,
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

        var tokenHash = OpaqueTokenHasher.Hash(refreshToken);
        var rt = await _context.RefreshTokens
            .Include(r => r.Usuario)
            .FirstOrDefaultAsync(r => r.Token == tokenHash);

        if (rt == null || rt.Revogado || rt.ExpiresAt <= DateTime.UtcNow)
            throw new UnauthorizedAccessException("Refresh token inválido ou expirado.");

        if (!rt.Usuario.Ativo)
            throw new UnauthorizedAccessException("Usuário inativo.");

        // Revogar o token atual (rotação)
        rt.Revogado = true;

        // Criar novo refresh token
        var (novoRt, refreshBruto) = await CriarRefreshTokenAsync(rt.UsuarioId);
        await _context.SaveChangesAsync();

        var jwtToken = _tokenProvider.GenerateToken(rt.Usuario.Id, rt.Usuario.Email, rt.Usuario.Nome);

        return new AuthResponseDto
        {
            UsuarioId = rt.Usuario.Id,
            Email = rt.Usuario.Email,
            Nome = rt.Usuario.Nome,
            Token = jwtToken,
            RefreshToken = refreshBruto,
            RefreshTokenExpiresAt = novoRt.ExpiresAt,
        };
    }

    /// <summary>
    /// Revoga o refresh token (logout). Silencioso se token não encontrado.
    /// </summary>
    public async Task LogoutAsync(string refreshToken)
    {
        if (string.IsNullOrWhiteSpace(refreshToken)) return;

        var tokenHash = OpaqueTokenHasher.Hash(refreshToken);
        var rt = await _context.RefreshTokens
            .FirstOrDefaultAsync(r => r.Token == tokenHash && !r.Revogado);

        if (rt != null)
        {
            rt.Revogado = true;
            await _context.SaveChangesAsync();
        }
    }

    // ── Forgot / Reset Password ───────────────────────────────────────────────

    /// <summary>
    /// Solicita o reset de senha. A geração do token e o envio do e-mail são disparados
    /// fire-and-forget (Hangfire), então a resposta é imediata e idêntica para qualquer
    /// e-mail — sem oráculo de timing/enumeração e sem vazar o token na resposta HTTP.
    /// O token só chega ao dono legítimo pelo e-mail.
    /// </summary>
    public Task<ForgotPasswordResponseDto> SolicitarResetSenhaAsync(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("E-mail é obrigatório.");

        _resetDispatcher.Disparar(email);

        return Task.FromResult(new ForgotPasswordResponseDto
        {
            Mensagem = "Se o e-mail existir, um link de recuperação será enviado.",
        });
    }

    /// <summary>
    /// Valida o token de reset e altera a senha do usuário.
    /// </summary>
    public async Task ResetSenhaAsync(ResetPasswordDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Token))
            throw new ArgumentException("Token é obrigatório.");

        if (string.IsNullOrWhiteSpace(dto.NovaSenha))
            throw new ArgumentException("Nova senha é obrigatória.");

        PasswordPolicyService.ValidarOuLancar(dto.NovaSenha);

        if (dto.NovaSenha != dto.ConfirmarNovaSenha)
            throw new ArgumentException("Senhas não conferem.");

        // O banco guarda só o hash do token; o usuário envia o token bruto.
        var tokenHash = OpaqueTokenHasher.Hash(dto.Token);
        var prt = await _context.PasswordResetTokens
            .Include(t => t.Usuario)
            .FirstOrDefaultAsync(t => t.Token == tokenHash);

        if (prt == null || prt.Usado || prt.ExpiresAt <= DateTime.UtcNow)
            throw new ArgumentException("Token inválido ou expirado.");

        if (!prt.Usuario.Ativo)
            throw new ArgumentException("Usuário inativo.");

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
            throw new KeyNotFoundException("Usuário não encontrado");

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
            throw new KeyNotFoundException("Usuário não encontrado");

        if (!PasswordHasher.VerifyPassword(senhaAtual, usuario.PasswordHash))
            throw new UnauthorizedAccessException("Senha atual inválida");

        PasswordPolicyService.ValidarOuLancar(novaSenha);

        usuario.PasswordHash = PasswordHasher.HashPassword(novaSenha);
        usuario.AtualizadoEm = DateTime.UtcNow;

        _context.Usuarios.Update(usuario);
        await _context.SaveChangesAsync();
    }
}

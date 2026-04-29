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

    public AuthService(AppDbContext context, JwtTokenProvider tokenProvider)
    {
        _context = context;
        _tokenProvider = tokenProvider;
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
            Tipo = TipoConta.Dinheiro,
            SaldoInicial = 0,
            IsCarteira = true,
            UsuarioIdProprietario = usuario.Id
        });

        await _context.SaveChangesAsync();

        // Generate token
        var token = _tokenProvider.GenerateToken(usuario.Id, usuario.Email, usuario.Nome);

        return new AuthResponseDto
        {
            UsuarioId = usuario.Id,
            Email = usuario.Email,
            Nome = usuario.Nome,
            Token = token
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

        // Generate token
        var token = _tokenProvider.GenerateToken(usuario.Id, usuario.Email, usuario.Nome);

        return new AuthResponseDto
        {
            UsuarioId = usuario.Id,
            Email = usuario.Email,
            Nome = usuario.Nome,
            Token = token
        };
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

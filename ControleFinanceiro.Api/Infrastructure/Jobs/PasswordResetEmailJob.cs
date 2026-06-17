using System.Security.Cryptography;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Infrastructure.Jobs;

/// <summary>
/// Gera o token de reset de senha e dispara o e-mail. Executa fora do caminho da requisição
/// HTTP (Hangfire), então <c>/forgot-password</c> responde imediato e idêntico para qualquer
/// e-mail. Se o e-mail não estiver cadastrado, não faz nada — a resposta já foi genérica,
/// sem enumeração de usuário.
/// </summary>
public class PasswordResetEmailJob
{
    private const int ResetTokenHours = 1;

    private readonly AppDbContext _context;
    private readonly IPasswordResetEmailSender _sender;

    public PasswordResetEmailJob(AppDbContext context, IPasswordResetEmailSender sender)
    {
        _context = context;
        _sender = sender;
    }

    public async Task ExecuteAsync(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return;

        var usuario = await _context.Usuarios
            .FirstOrDefaultAsync(u => u.Email == email.ToLower() && u.Ativo);

        if (usuario == null)
            return; // e-mail não cadastrado: nada a fazer

        // Invalida tokens anteriores ainda válidos do mesmo usuário.
        var tokensAntigos = await _context.PasswordResetTokens
            .Where(t => t.UsuarioId == usuario.Id && !t.Usado && t.ExpiresAt > DateTime.UtcNow)
            .ToListAsync();
        foreach (var t in tokensAntigos)
            t.Usado = true;

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

        await _sender.EnviarAsync(usuario.Email, prt.Token, prt.ExpiresAt);
    }

    private static string GerarTokenOpaco()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToHexString(bytes).ToLower();
    }
}

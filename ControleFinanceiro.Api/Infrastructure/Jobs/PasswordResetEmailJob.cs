using System.Security.Cryptography;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
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
    private const int MaxTokensPorHora = 3;

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
            .FirstOrDefaultAsync(u => u.Email == email.ToLower() && u.Status == StatusUsuario.Ativo);

        if (usuario == null)
            return; // e-mail não cadastrado: nada a fazer

        // Rate-limit POR CONTA (além do por-IP no endpoint): no máximo
        // MaxTokensPorHora pedidos de reset por usuário por hora — barra abuso/spam de
        // e-mail mesmo vindo de IPs diferentes. Roda no worker, fora do caminho da
        // requisição, então não vira oráculo de timing/enumeração.
        var desde = DateTime.UtcNow.AddHours(-1);
        var recentes = await _context.PasswordResetTokens
            .CountAsync(t => t.UsuarioId == usuario.Id && t.CriadoEm > desde);
        if (recentes >= MaxTokensPorHora)
            return;

        // Invalida tokens anteriores ainda válidos do mesmo usuário.
        var tokensAntigos = await _context.PasswordResetTokens
            .Where(t => t.UsuarioId == usuario.Id && !t.Usado && t.ExpiresAt > DateTime.UtcNow)
            .ToListAsync();
        foreach (var t in tokensAntigos)
            t.Usado = true;

        // Token bruto vai por e-mail; no banco guarda-se só o hash (se o banco vazar,
        // os hashes não dão tokens utilizáveis).
        var tokenBruto = GerarTokenOpaco();
        var prt = new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            UsuarioId = usuario.Id,
            Token = OpaqueTokenHasher.Hash(tokenBruto),
            ExpiresAt = DateTime.UtcNow.AddHours(ResetTokenHours),
            Usado = false,
            CriadoEm = DateTime.UtcNow,
        };
        _context.PasswordResetTokens.Add(prt);
        await _context.SaveChangesAsync();

        await _sender.EnviarAsync(usuario.Email, tokenBruto, prt.ExpiresAt);
    }

    private static string GerarTokenOpaco()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToHexString(bytes).ToLower();
    }
}

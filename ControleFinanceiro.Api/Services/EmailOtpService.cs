using System.Security.Cryptography;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Serviço genérico de código OTP (PIN) por e-mail — 2º fator de RESERVA em ações sensíveis (nunca
/// login). Código de 6 dígitos (CSPRNG), guardado só como HMAC com chave fora do banco (<see cref="CodigoOtpHasher"/>),
/// validade curta, uso único, escopado por finalidade, teto de tentativas e de códigos por hora. Ver `docs/SEGURANCA_BEST_PRACTICES.md` §0. E-mail é fator
/// fraco: só somado à senha atual, nunca como bypass de TOTP ativo.
/// </summary>
public class EmailOtpService
{
    public const int ValidadeMinutos = 10;
    public const int MaxTentativas = 5;
    /// <summary>Teto de códigos por hora (por pessoa e finalidade). Sem ele, pedir código novo dava mais 5 chutes
    /// a cada pedido.</summary>
    public const int MaxCodigosPorHora = 3;
    public const string MensagemMuitosCodigos = "Você já pediu muitos códigos. Espere uma hora e peça de novo.";

    private readonly AppDbContext _context;
    private readonly IContaEmailSender _sender;

    public EmailOtpService(AppDbContext context, IContaEmailSender sender)
    {
        _context = context;
        _sender = sender;
    }

    /// <summary>Gera um código novo pra a finalidade (invalidando os anteriores não usados), guarda o
    /// hash e envia por e-mail. Só o hash fica no banco.</summary>
    public async Task GerarEnviarAsync(Usuario usuario, TipoOtpEmail finalidade)
    {
        var umaHora = DateTime.UtcNow.AddHours(-1);
        var recentes = await _context.EmailOtps
            .CountAsync(o => o.UsuarioId == usuario.Id && o.Finalidade == finalidade && o.CriadoEm > umaHora);
        if (recentes >= MaxCodigosPorHora)
            throw new InvalidOperationException(MensagemMuitosCodigos);

        // Só o último código vale: queima os pendentes da mesma finalidade.
        var pendentes = await _context.EmailOtps
            .Where(o => o.UsuarioId == usuario.Id && o.Finalidade == finalidade && !o.Usado)
            .ToListAsync();
        foreach (var o in pendentes) o.Usado = true;

        var codigo = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var otp = new EmailOtp
        {
            Id = Guid.NewGuid(),
            UsuarioId = usuario.Id,
            Finalidade = finalidade,
            CodigoHash = CodigoOtpHasher.Hash(usuario.Id, codigo),
            ExpiraEm = DateTime.UtcNow.AddMinutes(ValidadeMinutos),
            Usado = false,
            Tentativas = 0,
            CriadoEm = DateTime.UtcNow,
        };
        _context.EmailOtps.Add(otp);
        await _context.SaveChangesAsync();

        await _sender.EnviarCodigoAsync(usuario.Email, codigo, finalidade, otp.ExpiraEm);
    }

    /// <summary>Valida o código pra a finalidade. Sucesso → marca usado (uso único). Erro → conta a
    /// tentativa e queima o código ao estourar o teto (anti-brute do PIN curto). Código expirado/
    /// inexistente → false.</summary>
    public async Task<bool> ValidarAsync(Guid usuarioId, TipoOtpEmail finalidade, string? codigo)
    {
        var otp = await _context.EmailOtps
            .Where(o => o.UsuarioId == usuarioId && o.Finalidade == finalidade && !o.Usado && o.ExpiraEm > DateTime.UtcNow)
            .OrderByDescending(o => o.CriadoEm)
            .FirstOrDefaultAsync();

        if (otp is null)
            return false;

        if (!string.IsNullOrEmpty(codigo) && codigo.Length <= 12 && CodigoOtpHasher.Confere(otp.CodigoHash, usuarioId, codigo))
        {
            otp.Usado = true;
            await _context.SaveChangesAsync();
            return true;
        }

        otp.Tentativas++;
        if (otp.Tentativas >= MaxTentativas)
            otp.Usado = true; // queima: força pedir um novo código

        await _context.SaveChangesAsync();
        return false;
    }
}

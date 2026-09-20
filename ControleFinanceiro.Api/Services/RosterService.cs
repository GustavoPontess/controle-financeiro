using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Auth;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Roster / chooser pré-login ("escolher conta", opt-in). Amarra contas a um NAVEGADOR via o device
/// id opaco (cookie `rd`) — aqui guarda só o hash. Lista/insere/remove, sempre por device. Nunca
/// devolve e-mail inteiro (mascarado) nem token. O controller cuida do cookie; o service recebe o
/// device id bruto.
/// </summary>
public class RosterService
{
    private readonly AppDbContext _context;

    public RosterService(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>Marca a conta como "lembrada" neste dispositivo (opt-in do "manter conectado").
    /// Idempotente: relogar a mesma conta no mesmo device só atualiza o último uso.</summary>
    public async Task LembrarAsync(string deviceIdBruto, Guid usuarioId)
    {
        if (string.IsNullOrWhiteSpace(deviceIdBruto)) return;

        var hash = OpaqueTokenHasher.Hash(deviceIdBruto);
        var existente = await _context.ContasLembradas
            .FirstOrDefaultAsync(c => c.DeviceHash == hash && c.UsuarioId == usuarioId);

        if (existente is not null)
        {
            existente.UltimoUsoEm = DateTime.UtcNow;
        }
        else
        {
            _context.ContasLembradas.Add(new ContaLembrada
            {
                Id = Guid.NewGuid(),
                DeviceHash = hash,
                UsuarioId = usuarioId,
                CriadoEm = DateTime.UtcNow,
                UltimoUsoEm = DateTime.UtcNow,
            });
        }

        await _context.SaveChangesAsync();
    }

    /// <summary>Lista as contas lembradas deste navegador (só as ATIVAS), mais recente primeiro.
    /// Nome + e-mail MASCARADO — nunca o e-mail inteiro.</summary>
    public async Task<List<ContaLembradaDto>> ListarAsync(string? deviceIdBruto)
    {
        if (string.IsNullOrWhiteSpace(deviceIdBruto)) return new();

        var hash = OpaqueTokenHasher.Hash(deviceIdBruto);
        var contas = await _context.ContasLembradas
            .Where(c => c.DeviceHash == hash && c.Usuario.Status == StatusUsuario.Ativo)
            .OrderByDescending(c => c.UltimoUsoEm)
            .Select(c => new { c.UsuarioId, c.Usuario.Nome, c.Usuario.Email })
            .ToListAsync();

        return contas
            .Select(c => new ContaLembradaDto
            {
                UsuarioId = c.UsuarioId,
                Nome = PrimeiroNome(c.Nome),          // só o 1º nome: menor exposição em navegador compartilhado
                EmailMascarado = MascararEmail(c.Email),
            })
            .ToList();
    }

    /// <summary>Só o primeiro nome — a lista pré-login não expõe o nome completo do usuário anterior
    /// num navegador compartilhado (o inteiro nem sai do servidor).</summary>
    internal static string PrimeiroNome(string nome)
    {
        if (string.IsNullOrWhiteSpace(nome)) return nome ?? string.Empty;
        var t = nome.Trim();
        var sp = t.IndexOf(' ');
        return sp <= 0 ? t : t[..sp];
    }

    /// <summary>E-mail REAL de uma conta do roster deste navegador — pra pré-preencher o campo quando
    /// a pessoa SELECIONA a conta (a lista só mostra mascarado; o inteiro só é revelado no clique
    /// deliberado, uma conta por vez). Só devolve se a conta está no roster do device e está Ativa;
    /// null caso contrário.</summary>
    public async Task<string?> ObterEmailAsync(string? deviceIdBruto, Guid usuarioId)
    {
        if (string.IsNullOrWhiteSpace(deviceIdBruto)) return null;

        var hash = OpaqueTokenHasher.Hash(deviceIdBruto);
        return await _context.ContasLembradas
            .Where(c => c.DeviceHash == hash && c.UsuarioId == usuarioId && c.Usuario.Status == StatusUsuario.Ativo)
            .Select(c => c.Usuario.Email)
            .FirstOrDefaultAsync();
    }

    /// <summary>Remove UMA conta do chooser deste navegador ("remover desta lista").</summary>
    public async Task RemoverAsync(string? deviceIdBruto, Guid usuarioId)
    {
        if (string.IsNullOrWhiteSpace(deviceIdBruto)) return;

        var hash = OpaqueTokenHasher.Hash(deviceIdBruto);
        var linhas = await _context.ContasLembradas
            .Where(c => c.DeviceHash == hash && c.UsuarioId == usuarioId)
            .ToListAsync();
        if (linhas.Count > 0)
        {
            _context.ContasLembradas.RemoveRange(linhas);
            await _context.SaveChangesAsync();
        }
    }

    /// <summary>Esquece TODAS as contas deste navegador ("esquecer todas").</summary>
    public async Task RemoverTodasAsync(string? deviceIdBruto)
    {
        if (string.IsNullOrWhiteSpace(deviceIdBruto)) return;

        var hash = OpaqueTokenHasher.Hash(deviceIdBruto);
        var linhas = await _context.ContasLembradas
            .Where(c => c.DeviceHash == hash)
            .ToListAsync();
        if (linhas.Count > 0)
        {
            _context.ContasLembradas.RemoveRange(linhas);
            await _context.SaveChangesAsync();
        }
    }

    /// <summary>Mascara o e-mail pra exibição: 2 primeiros do local + <c>•••</c> + domínio
    /// (ex.: <c>gustavo@gmail.com</c> → <c>gu•••@gmail.com</c>). Local curto (1 char) mostra 1.</summary>
    public static string MascararEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email)) return string.Empty;

        var at = email.IndexOf('@');
        if (at <= 0) return "•••";

        var local = email[..at];
        var dominio = email[at..]; // inclui o '@'
        var visivel = local.Length <= 2 ? local : local[..2]; // até 2 primeiros do local
        return $"{visivel}•••{dominio}";
    }
}

using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Notificacao;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>Issue #30 — central de notificações in-app.</summary>
public class NotificacaoService
{
    private const int LimiteListagem = 50;

    private readonly AppDbContext _context;
    private readonly ILogger<NotificacaoService> _logger;

    public NotificacaoService(AppDbContext context, ILogger<NotificacaoService> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>Cria uma notificação para um usuário. Falha aqui nunca derruba a
    /// operação de origem — o erro é logado e engolido.</summary>
    public async Task CriarAsync(
        Guid usuarioId, TipoNotificacao tipo, string titulo, string mensagem,
        string? linkRelativo = null)
    {
        try
        {
            _context.Notificacoes.Add(new Notificacao
            {
                Id = Guid.NewGuid(),
                UsuarioId = usuarioId,
                Tipo = tipo,
                Titulo = titulo,
                Mensagem = mensagem,
                LinkRelativo = linkRelativo,
                Lida = false,
            });
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha ao criar notificação para {UsuarioId}", usuarioId);
        }
    }

    /// <summary>
    /// Cria a notificação só se ainda não saiu uma com a mesma <paramref name="chave"/> pra pessoa (aviso de uma vez
    /// só, como o alerta de limite). Devolve se criou. Duas chamadas ao mesmo tempo: o índice único segura a segunda.
    /// </summary>
    public async Task<bool> CriarUmaVezAsync(
        Guid usuarioId, string chave, TipoNotificacao tipo, string titulo, string mensagem, string? linkRelativo = null)
    {
        if (await _context.Notificacoes.AnyAsync(n => n.UsuarioId == usuarioId && n.Chave == chave))
            return false;
        var n = new Notificacao
        {
            Id = Guid.NewGuid(), UsuarioId = usuarioId, Tipo = tipo, Titulo = titulo, Mensagem = mensagem,
            LinkRelativo = linkRelativo, Chave = chave,
        };
        _context.Notificacoes.Add(n);
        try
        {
            await _context.SaveChangesAsync();
            return true;
        }
        catch (DbUpdateException ex) when (Idempotencia.EhViolacaoDeUnicidade(ex))
        {
            _context.Entry(n).State = EntityState.Detached;
            return false;
        }
    }

    /// <summary>Lista as notificações do usuário (mais recentes primeiro).</summary>
    public async Task<List<NotificacaoDto>> ListarAsync(Guid usuarioId)
    {
        return await _context.Notificacoes
            .Where(n => n.UsuarioId == usuarioId)
            .OrderByDescending(n => n.CriadoEm)
            .Take(LimiteListagem)
            .Select(n => new NotificacaoDto(
                n.Id, n.Tipo, n.Titulo, n.Mensagem, n.LinkRelativo, n.Lida, n.CriadoEm))
            .ToListAsync();
    }

    /// <summary>Quantidade de notificações não lidas do usuário.</summary>
    public async Task<ContagemNotificacaoDto> ContarNaoLidasAsync(Guid usuarioId)
    {
        var naoLidas = await _context.Notificacoes
            .CountAsync(n => n.UsuarioId == usuarioId && !n.Lida);
        return new ContagemNotificacaoDto(naoLidas);
    }

    /// <summary>Marca uma notificação como lida (idempotente).</summary>
    public async Task MarcarLidaAsync(Guid notificacaoId, Guid usuarioId)
    {
        var notificacao = await _context.Notificacoes
            .FirstOrDefaultAsync(n => n.Id == notificacaoId && n.UsuarioId == usuarioId)
            ?? throw new KeyNotFoundException("Notificação não encontrada.");

        if (notificacao.Lida)
            return;

        notificacao.Lida = true;
        await _context.SaveChangesAsync();
    }

    /// <summary>Marca todas as notificações do usuário como lidas.</summary>
    public async Task MarcarTodasLidasAsync(Guid usuarioId)
    {
        var naoLidas = await _context.Notificacoes
            .Where(n => n.UsuarioId == usuarioId && !n.Lida)
            .ToListAsync();

        foreach (var n in naoLidas)
            n.Lida = true;

        if (naoLidas.Count > 0)
            await _context.SaveChangesAsync();
    }
}

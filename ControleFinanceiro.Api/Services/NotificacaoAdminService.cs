using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Admin;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Central de notificações do painel admin — stream SEPARADO do financeiro (`NotificacaoService`).
/// Notificações globais ao painel (qualquer admin vê). NÃO cruza com as notificações do usuário.
/// </summary>
public class NotificacaoAdminService
{
    private const int LimiteListagem = 50;

    private readonly AppDbContext _context;
    private readonly ILogger<NotificacaoAdminService> _logger;

    public NotificacaoAdminService(AppDbContext context, ILogger<NotificacaoAdminService> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>Cria uma notificação de admin. Best-effort: falha aqui NUNCA derruba a operação de
    /// origem (ex.: cadastro, login, purga) — o erro é logado e engolido.</summary>
    public async Task CriarAsync(TipoNotificacaoAdmin tipo, string titulo, string mensagem,
        string? linkRelativo = null, Guid? alvoId = null)
    {
        try
        {
            _context.NotificacoesAdmin.Add(new NotificacaoAdmin
            {
                Id = Guid.NewGuid(),
                Tipo = tipo,
                Titulo = titulo,
                Mensagem = mensagem,
                LinkRelativo = linkRelativo,
                AlvoId = alvoId,
                Lida = false,
            });
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha ao criar notificação de admin ({Tipo}).", tipo);
        }
    }

    /// <summary>Lista as notificações do admin (mais recentes primeiro).</summary>
    public async Task<List<NotificacaoAdminDto>> ListarAsync()
    {
        return await _context.NotificacoesAdmin
            .OrderByDescending(n => n.CriadoEm)
            .Take(LimiteListagem)
            .Select(n => new NotificacaoAdminDto(
                n.Id, n.Tipo, n.Titulo, n.Mensagem, n.LinkRelativo, n.Lida, n.CriadoEm))
            .ToListAsync();
    }

    /// <summary>Quantidade de notificações de admin não lidas.</summary>
    public async Task<ContagemNotificacaoAdminDto> ContarNaoLidasAsync()
    {
        var naoLidas = await _context.NotificacoesAdmin.CountAsync(n => !n.Lida);
        return new ContagemNotificacaoAdminDto(naoLidas);
    }

    /// <summary>Marca uma notificação de admin como lida (idempotente).</summary>
    public async Task MarcarLidaAsync(Guid notificacaoId)
    {
        var notificacao = await _context.NotificacoesAdmin
            .FirstOrDefaultAsync(n => n.Id == notificacaoId)
            ?? throw new KeyNotFoundException("Notificação não encontrada.");

        if (notificacao.Lida)
            return;

        notificacao.Lida = true;
        await _context.SaveChangesAsync();
    }

    /// <summary>Dá baixa (marca como lidas) nas notificações acionáveis ligadas a um alvo — ex.: ao
    /// aprovar/recusar um cadastro, a notificação "novo cadastro" daquele usuário some do sino
    /// (padrão: notificação acionável se resolve quando a ação é tratada). NÃO chama SaveChanges: é
    /// gravado junto com a transação da ação do caller (mesmo AppDbContext scoped), pra ficar atômico.</summary>
    public async Task MarcarLidasPorAlvoAsync(Guid alvoId)
    {
        var pendentes = await _context.NotificacoesAdmin
            .Where(n => n.AlvoId == alvoId && !n.Lida)
            .ToListAsync();

        foreach (var n in pendentes)
            n.Lida = true;
    }

    /// <summary>Marca todas as notificações de admin como lidas.</summary>
    public async Task MarcarTodasLidasAsync()
    {
        var naoLidas = await _context.NotificacoesAdmin.Where(n => !n.Lida).ToListAsync();

        foreach (var n in naoLidas)
            n.Lida = true;

        if (naoLidas.Count > 0)
            await _context.SaveChangesAsync();
    }
}

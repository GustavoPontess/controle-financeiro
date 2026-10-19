using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Infrastructure.Jobs;

/// <summary>
/// Alerta de limite (de hora em hora): pra quem tem limite, olha o mês e avisa UMA vez por categoria e mês quando
/// o gasto chega no alerta (80% por padrão) e quando passa do limite. Se pulou direto pra "passou", só sai esse.
/// A chave da notificação ("limite:{categoria}:{ano-mês}:{nível}") garante que não repete. Erro de uma pessoa não
/// para as outras.
/// </summary>
public class AlertaLimitesJob
{
    private static readonly string[] Meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
        "agosto", "setembro", "outubro", "novembro", "dezembro"];

    private readonly AppDbContext _context;
    private readonly OrcamentoService _limites;
    private readonly NotificacaoService _notificacoes;
    private readonly ILogger<AlertaLimitesJob> _logger;

    public AlertaLimitesJob(AppDbContext context, OrcamentoService limites, NotificacaoService notificacoes, ILogger<AlertaLimitesJob> logger)
    {
        _context = context;
        _limites = limites;
        _notificacoes = notificacoes;
        _logger = logger;
    }

    /// <param name="agora">Só pra teste. O mês é o de Brasília (UTC−3): o app ainda não guarda fuso por pessoa.</param>
    public async Task ExecuteAsync(DateTime? agora = null)
    {
        var hoje = (agora ?? DateTime.UtcNow).AddHours(-3);
        var usuarios = await _context.Orcamentos.Select(o => o.UsuarioId).Distinct().ToListAsync();
        foreach (var usuarioId in usuarios)
        {
            try
            {
                await AvisarAsync(usuarioId, hoje.Year, hoje.Month);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Alerta de limite falhou para {UsuarioId}", usuarioId);
                _context.ChangeTracker.Clear();
            }
        }
    }

    private async Task AvisarAsync(Guid usuarioId, int ano, int mes)
    {
        var doMes = await _limites.DoMesAsync(usuarioId, ano, mes);
        var nomeMes = Meses[mes - 1];
        foreach (var l in doMes.Limites.Where(l => l.Situacao is "perto" or "passou"))
        {
            var chave = $"limite:{l.CategoriaId?.ToString() ?? "todos"}:{ano:D4}-{mes:D2}:{l.Situacao}";
            var (titulo, mensagem) = l.Situacao == "passou"
                ? ($"{l.Categoria} passou do limite", $"Em {nomeMes}: {Reais.Formatar(l.Gasto)} de {Reais.Formatar(l.Limite)}, {Reais.Formatar(-l.Sobra)} a mais.")
                : ($"{l.Categoria} chegou a {Math.Floor(l.Percentual):0}% do limite", $"Em {nomeMes}: {Reais.Formatar(l.Gasto)} de {Reais.Formatar(l.Limite)}, sobram {Reais.Formatar(l.Sobra)}.");
            await _notificacoes.CriarUmaVezAsync(usuarioId, chave, TipoNotificacao.OrcamentoEstourado, titulo, mensagem, "/limites");
        }
    }
}

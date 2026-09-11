using ControleFinanceiro.Api.Services;

namespace ControleFinanceiro.Api.Infrastructure.Jobs;

/// <summary>
/// Job de carência da exclusão LGPD (Módulo C — spec §5). Varre diariamente as contas marcadas pra
/// exclusão cuja janela de <see cref="AdminLgpdService.JanelaCarenciaDias"/> dias venceu e purga de
/// verdade as que não têm vínculo com terceiro (as com vínculo ficam pro admin resolver na mão).
/// É o estágio que fecha a conformidade: só soft delete permanente NÃO seria conforme.
/// </summary>
public class PurgaExclusaoExpiradaJob
{
    private readonly AdminLgpdService _lgpd;
    private readonly ILogger<PurgaExclusaoExpiradaJob> _logger;

    public PurgaExclusaoExpiradaJob(AdminLgpdService lgpd, ILogger<PurgaExclusaoExpiradaJob> logger)
    {
        _lgpd = lgpd;
        _logger = logger;
    }

    public async Task ExecuteAsync()
    {
        var purgadas = await _lgpd.PurgarExpiradasAsync();
        if (purgadas > 0)
            _logger.LogInformation("Purga LGPD: {Qtd} conta(s) com carência vencida purgada(s).", purgadas);
    }
}

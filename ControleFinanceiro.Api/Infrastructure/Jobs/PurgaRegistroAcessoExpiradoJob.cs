using ControleFinanceiro.Api.Services;

namespace ControleFinanceiro.Api.Infrastructure.Jobs;

/// <summary>
/// Purga de retenção do store Marco Civil (Art. 15). Varre diariamente os registros de acesso cuja
/// guarda legal de <see cref="RegistroAcessoService.RetencaoDias"/> dias venceu e os elimina —
/// minimização LGPD (não guardar além do prazo/necessário).
/// </summary>
public class PurgaRegistroAcessoExpiradoJob
{
    private readonly RegistroAcessoService _registros;
    private readonly ILogger<PurgaRegistroAcessoExpiradoJob> _logger;

    public PurgaRegistroAcessoExpiradoJob(RegistroAcessoService registros, ILogger<PurgaRegistroAcessoExpiradoJob> logger)
    {
        _registros = registros;
        _logger = logger;
    }

    public async Task ExecuteAsync()
    {
        var purgados = await _registros.PurgarExpiradosAsync();
        if (purgados > 0)
            _logger.LogInformation("Retenção Marco Civil: {Qtd} registro(s) de acesso vencido(s) purgado(s).", purgados);
    }
}

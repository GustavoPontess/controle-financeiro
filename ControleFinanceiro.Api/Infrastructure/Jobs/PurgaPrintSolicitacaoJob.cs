using ControleFinanceiro.Api.Services;

namespace ControleFinanceiro.Api.Infrastructure.Jobs;

/// <summary>
/// Minimização LGPD: os anexos (prints e blocos apontados) podem ter valores da pessoa. Varre todo dia e apaga os anexos das
/// solicitações fechadas (Feita / Não vamos fazer) há mais de <see cref="SolicitacaoService.DiasDoPrintDepoisDeFechar"/>
/// dias. O texto da solicitação fica.
/// </summary>
public class PurgaPrintSolicitacaoJob
{
    private readonly SolicitacaoService _solicitacoes;
    private readonly ILogger<PurgaPrintSolicitacaoJob> _logger;

    public PurgaPrintSolicitacaoJob(SolicitacaoService solicitacoes, ILogger<PurgaPrintSolicitacaoJob> logger)
    {
        _solicitacoes = solicitacoes;
        _logger = logger;
    }

    public async Task ExecuteAsync()
    {
        var apagados = await _solicitacoes.PurgarPrintsVencidosAsync();
        if (apagados > 0)
            _logger.LogInformation("Solicitações: {Qtd} print(s) de solicitação fechada apagado(s).", apagados);
    }
}

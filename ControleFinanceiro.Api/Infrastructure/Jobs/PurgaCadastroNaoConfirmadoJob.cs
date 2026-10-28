using ControleFinanceiro.Api.Services;

namespace ControleFinanceiro.Api.Infrastructure.Jobs;

/// <summary>
/// Apaga todo dia os pedidos de acesso que ninguém confirmou em <see cref="ConfirmacaoCadastroService.DiasValidade"/>
/// dias: o e-mail pode ser de alguém que nunca pediu nada (minimização, LGPD art. 6º, III).
/// </summary>
public class PurgaCadastroNaoConfirmadoJob
{
    private readonly ConfirmacaoCadastroService _confirmacao;
    private readonly ILogger<PurgaCadastroNaoConfirmadoJob> _logger;

    public PurgaCadastroNaoConfirmadoJob(ConfirmacaoCadastroService confirmacao, ILogger<PurgaCadastroNaoConfirmadoJob> logger)
    {
        _confirmacao = confirmacao;
        _logger = logger;
    }

    public async Task ExecuteAsync()
    {
        var apagados = await _confirmacao.PurgarNaoConfirmadosAsync();
        if (apagados > 0)
            _logger.LogInformation("Pedidos de acesso sem e-mail confirmado apagados: {Qtd}.", apagados);
    }
}

using ControleFinanceiro.Api.Domain.Enums;
using Microsoft.Extensions.Hosting;

namespace ControleFinanceiro.Api.Infrastructure.Identity;

/// <summary>
/// Stub até existir SMTP real. Em <c>Development</c> loga o código pra o fluxo de dev/QA continuar
/// sem caixa de e-mail. Fora de Development o código NUNCA vai pro log (segredo em log é proibido);
/// registra só que o envio foi disparado.
/// </summary>
public class LoggingContaEmailSender : IContaEmailSender
{
    private readonly ILogger<LoggingContaEmailSender> _logger;
    private readonly IHostEnvironment _env;

    public LoggingContaEmailSender(ILogger<LoggingContaEmailSender> logger, IHostEnvironment env)
    {
        _logger = logger;
        _env = env;
    }

    public Task EnviarCodigoAsync(string email, string codigo, TipoOtpEmail finalidade, DateTime expiraEm, CancellationToken ct = default)
    {
        if (_env.IsDevelopment())
            _logger.LogWarning("[DEV] Código {Finalidade} para {Email}: {Codigo} (expira {ExpiraEm:u}). Em produção iria por e-mail.",
                finalidade, email, codigo, expiraEm);
        else
            _logger.LogInformation("E-mail de código ({Finalidade}) disparado (código omitido do log).", finalidade);

        return Task.CompletedTask;
    }

    public Task EnviarAcessoLiberadoAsync(string email, CancellationToken ct = default)
    {
        _logger.LogInformation("E-mail de acesso liberado disparado (sem SMTP configurado; destinatário omitido do log).");
        return Task.CompletedTask;
    }

    public Task EnviarPedidoRecebidoAsync(string email, string token, DateTime expiraEm, CancellationToken ct = default)
    {
        if (_env.IsDevelopment())
            _logger.LogWarning("[DEV] Pedido recebido de {Email}: /confirmar-email#token={Token} ou /nao-fui-eu#token={Token}. Em produção iria por e-mail.",
                email, token, token);
        else
            _logger.LogInformation("E-mail de pedido recebido disparado (sem SMTP configurado; destinatário e link omitidos do log).");
        return Task.CompletedTask;
    }

    public Task EnviarAvisoExclusaoAsync(string email, DateTime marcadoEm, int diasCarencia, CancellationToken ct = default)
    {
        // Aviso não é segredo — pode logar em qualquer ambiente (sem código).
        _logger.LogInformation(
            "E-mail de aviso de exclusão disparado para {Email}: conta marcada em {MarcadoEm:u}, carência de {Dias} dias.",
            email, marcadoEm, diasCarencia);
        return Task.CompletedTask;
    }
}

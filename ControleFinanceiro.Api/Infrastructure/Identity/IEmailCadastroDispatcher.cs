using ControleFinanceiro.Api.Infrastructure.Jobs;
using Hangfire;

namespace ControleFinanceiro.Api.Infrastructure.Identity;

/// <summary>
/// Dispara o e-mail de "pedido recebido" fora do caminho da requisição do cadastro. O SMTP é lento e varia; se
/// rodasse na requisição, o tempo de resposta diria se o e-mail já tinha conta (só cadastro novo manda e-mail).
/// Vai só o id da pessoa pra fila, nunca o e-mail (menos dado pessoal guardado no Hangfire).
/// </summary>
public interface IEmailCadastroDispatcher
{
    void PedidoRecebido(Guid usuarioId);
}

public class HangfireEmailCadastroDispatcher : IEmailCadastroDispatcher
{
    private readonly IBackgroundJobClient _jobs;

    public HangfireEmailCadastroDispatcher(IBackgroundJobClient jobs) => _jobs = jobs;

    public void PedidoRecebido(Guid usuarioId) =>
        _jobs.Enqueue<EmailPedidoRecebidoJob>(job => job.ExecuteAsync(usuarioId));
}

/// <summary>Sem fila (testes que constroem o serviço na mão): não manda nada.</summary>
public sealed class SemEmailCadastro : IEmailCadastroDispatcher
{
    public static readonly SemEmailCadastro Instancia = new();
    public void PedidoRecebido(Guid usuarioId) { }
}

using ControleFinanceiro.Api.Infrastructure.Jobs;
using Hangfire;

namespace ControleFinanceiro.Api.Infrastructure.Identity;

/// <summary>
/// Enfileira no Hangfire a geração do token + envio do e-mail de reset. O enqueue é rápido e
/// idêntico para qualquer e-mail; o trabalho pesado (consulta de usuário, persistência, envio)
/// roda no worker, fora do caminho da requisição.
/// </summary>
public class HangfirePasswordResetDispatcher : IPasswordResetDispatcher
{
    private readonly IBackgroundJobClient _jobs;

    public HangfirePasswordResetDispatcher(IBackgroundJobClient jobs) => _jobs = jobs;

    public void Disparar(string email) =>
        _jobs.Enqueue<PasswordResetEmailJob>(job => job.ExecuteAsync(email));
}

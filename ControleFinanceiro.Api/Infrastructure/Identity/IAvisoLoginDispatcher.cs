using ControleFinanceiro.Api.Infrastructure.Jobs;
using Hangfire;

namespace ControleFinanceiro.Api.Infrastructure.Identity;

/// <summary>
/// Dispara o e-mail "Alguém tentou entrar na sua conta" fora do caminho do login: o SMTP é lento e varia, e o tempo de
/// resposta diria a quem está tentando que o e-mail tem conta. Vai só o id da pessoa pra fila, nunca o e-mail.
/// </summary>
public interface IAvisoLoginDispatcher
{
    void TentativasDeLogin(Guid usuarioId, int falhas, DateTime quandoUtc);
}

public class HangfireAvisoLoginDispatcher : IAvisoLoginDispatcher
{
    private readonly IBackgroundJobClient _jobs;

    public HangfireAvisoLoginDispatcher(IBackgroundJobClient jobs) => _jobs = jobs;

    public void TentativasDeLogin(Guid usuarioId, int falhas, DateTime quandoUtc) =>
        _jobs.Enqueue<EmailTentativasLoginJob>(job => job.ExecuteAsync(usuarioId, falhas, quandoUtc));
}

/// <summary>Sem fila (testes que constroem o serviço na mão): não manda nada.</summary>
public sealed class SemAvisoLogin : IAvisoLoginDispatcher
{
    public static readonly SemAvisoLogin Instancia = new();
    public void TentativasDeLogin(Guid usuarioId, int falhas, DateTime quandoUtc) { }
}

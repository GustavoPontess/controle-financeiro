using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Infrastructure.Jobs;

/// <summary>Manda o "Alguém tentou entrar na sua conta" (Hangfire, fora do login). Conta que sumiu nesse meio-tempo: nada.</summary>
public class EmailTentativasLoginJob
{
    private readonly AppDbContext _context;
    private readonly IContaEmailSender _sender;

    public EmailTentativasLoginJob(AppDbContext context, IContaEmailSender sender)
    {
        _context = context;
        _sender = sender;
    }

    public async Task ExecuteAsync(Guid usuarioId, int falhas, DateTime quandoUtc)
    {
        var email = await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.Email).FirstOrDefaultAsync();
        if (email is null) return;
        await _sender.EnviarTentativasLoginAsync(email, falhas, quandoUtc);
    }
}

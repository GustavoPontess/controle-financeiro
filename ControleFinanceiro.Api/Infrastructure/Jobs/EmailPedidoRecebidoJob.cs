using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Infrastructure.Jobs;

/// <summary>
/// Manda o e-mail de "pedido recebido" depois do cadastro (Hangfire, fora da requisição). Só manda se a conta
/// ainda está esperando aprovação: se o admin já aprovou ou recusou antes do job rodar, o e-mail não faz sentido.
/// </summary>
public class EmailPedidoRecebidoJob
{
    private readonly AppDbContext _context;
    private readonly IContaEmailSender _sender;

    public EmailPedidoRecebidoJob(AppDbContext context, IContaEmailSender sender)
    {
        _context = context;
        _sender = sender;
    }

    public async Task ExecuteAsync(Guid usuarioId)
    {
        var email = await _context.Usuarios
            .Where(u => u.Id == usuarioId && u.Status == StatusUsuario.AguardandoAprovacao)
            .Select(u => u.Email)
            .FirstOrDefaultAsync();
        if (email is null) return;

        await _sender.EnviarPedidoRecebidoAsync(email);
    }
}

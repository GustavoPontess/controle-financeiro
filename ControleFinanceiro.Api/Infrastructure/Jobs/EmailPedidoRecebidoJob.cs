using ControleFinanceiro.Api.Infrastructure.Identity;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Infrastructure.Jobs;

/// <summary>
/// Manda o e-mail de "pedido recebido" depois do cadastro (Hangfire, fora da requisição), com o link de confirmar o
/// e-mail ou apagar o pedido. Só manda se o pedido ainda espera e não foi confirmado.
/// </summary>
public class EmailPedidoRecebidoJob
{
    private readonly AppDbContext _context;
    private readonly ConfirmacaoCadastroService _confirmacao;
    private readonly IContaEmailSender _sender;

    public EmailPedidoRecebidoJob(AppDbContext context, ConfirmacaoCadastroService confirmacao, IContaEmailSender sender)
    {
        _context = context;
        _confirmacao = confirmacao;
        _sender = sender;
    }

    public async Task ExecuteAsync(Guid usuarioId)
    {
        var link = await _confirmacao.GerarAsync(usuarioId);
        if (link is null) return;
        var email = await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.Email).FirstAsync();
        await _sender.EnviarPedidoRecebidoAsync(email, link.Value.Token, link.Value.ExpiraEm);
    }
}

using System.Security.Cryptography;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Dono do e-mail decide sobre o pedido de acesso (beta fechado). O cadastro não prova que o e-mail é de quem se
/// cadastrou; então o e-mail de "pedido recebido" leva um link com duas saídas:
/// <list type="bullet">
/// <item><b>Confirmar meu e-mail</b>: prova que quem pediu tem a caixa. Só pedido confirmado pode ser aprovado no Admin.</item>
/// <item><b>Não fui eu</b>: apaga o pedido e os dados que vieram com ele (LGPD art. 18, VI; minimização, art. 6º, III),
/// e o e-mail fica livre pro dono se cadastrar.</item>
/// </list>
/// Pedido sem confirmação some sozinho depois de <see cref="DiasValidade"/> dias (<see cref="PurgarNaoConfirmadosAsync"/>).
/// O token é de uso único, vence e só vale enquanto o pedido espera aprovação: conta aprovada nunca é apagada por ele.
/// Erro é sempre a mesma frase, pra não dizer se o link existiu.
/// </summary>
public class ConfirmacaoCadastroService
{
    public const int DiasValidade = 7;
    public const string MensagemLinkInvalido = "Este link venceu ou já foi usado.";

    private readonly AppDbContext _context;
    private readonly ILogger<ConfirmacaoCadastroService> _logger;

    public ConfirmacaoCadastroService(AppDbContext context, ILogger<ConfirmacaoCadastroService> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>Gera o link do e-mail pra um pedido que ainda espera. Devolve o token bruto e a validade, ou null se
    /// o pedido já foi decidido, confirmado ou não existe. Invalida os links anteriores da pessoa.</summary>
    public async Task<(string Token, DateTime ExpiraEm)?> GerarAsync(Guid usuarioId)
    {
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId);
        if (usuario is null || usuario.Status != StatusUsuario.AguardandoAprovacao || usuario.EmailConfirmadoEm is not null)
            return null;

        var antigos = await _context.TokensCadastro.Where(t => t.UsuarioId == usuarioId && !t.Usado).ToListAsync();
        foreach (var t in antigos) t.Usado = true;

        var bruto = Convert.ToHexString(RandomNumberGenerator.GetBytes(64)).ToLowerInvariant();
        var expiraEm = usuario.CriadoEm.AddDays(DiasValidade); // vence junto com o pedido não confirmado
        if (expiraEm <= DateTime.UtcNow) return null;
        _context.TokensCadastro.Add(new TokenCadastro
        {
            Id = Guid.NewGuid(),
            UsuarioId = usuarioId,
            TokenHash = OpaqueTokenHasher.Hash(bruto),
            ExpiraEm = expiraEm,
            CriadoEm = DateTime.UtcNow,
        });
        await _context.SaveChangesAsync();
        return (bruto, expiraEm);
    }

    /// <summary>"Confirmar meu e-mail": o pedido segue pra aprovação.</summary>
    public async Task ConfirmarAsync(string token)
    {
        var t = await TokenValidoAsync(token);
        t.Usado = true;
        t.Usuario.EmailConfirmadoEm = DateTime.UtcNow;
        t.Usuario.AtualizadoEm = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }

    /// <summary>"Não fui eu": apaga o pedido e os dados dele.</summary>
    public async Task NaoFuiEuAsync(string token)
    {
        var t = await TokenValidoAsync(token);
        await ApagarPedidoAsync(t.Usuario);
        // Sem e-mail nem id no log: só o fato (o pedido já não existe).
        _logger.LogInformation("Pedido de acesso apagado pelo dono do e-mail (Não fui eu).");
    }

    /// <summary>Apaga os pedidos que ninguém confirmou dentro do prazo. Devolve quantos.</summary>
    public async Task<int> PurgarNaoConfirmadosAsync()
    {
        var limite = DateTime.UtcNow.AddDays(-DiasValidade);
        var vencidos = await _context.Usuarios
            .Where(u => u.Status == StatusUsuario.AguardandoAprovacao && u.EmailConfirmadoEm == null && u.CriadoEm < limite)
            .ToListAsync();
        foreach (var u in vencidos) await ApagarPedidoAsync(u);
        return vencidos.Count;
    }

    private async Task<TokenCadastro> TokenValidoAsync(string token)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 256) throw new ArgumentException(MensagemLinkInvalido);
        var hash = OpaqueTokenHasher.Hash(token.Trim());
        var t = await _context.TokensCadastro.Include(x => x.Usuario).FirstOrDefaultAsync(x => x.TokenHash == hash);
        if (t is null || t.Usado || t.ExpiraEm <= DateTime.UtcNow || t.Usuario.Status != StatusUsuario.AguardandoAprovacao)
            throw new ArgumentException(MensagemLinkInvalido);
        return t;
    }

    /// <summary>Um pedido que espera aprovação só tem: o usuário, a Carteira vazia do cadastro, os links e o aviso no
    /// sino do admin. Apaga tudo numa transação (o cascade leva os tokens).</summary>
    private async Task ApagarPedidoAsync(Usuario u)
    {
        await using var tx = await _context.Database.BeginTransactionAsync();
        var contas = await _context.Contas.Where(c => c.UsuarioIdProprietario == u.Id).ToListAsync();
        _context.Contas.RemoveRange(contas);
        var avisos = await _context.NotificacoesAdmin.Where(n => n.AlvoId == u.Id).ToListAsync();
        _context.NotificacoesAdmin.RemoveRange(avisos);
        _context.Usuarios.Remove(u);
        await _context.SaveChangesAsync();
        await tx.CommitAsync();
    }
}

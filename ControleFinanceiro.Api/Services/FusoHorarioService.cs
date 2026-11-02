using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// O fuso da conta (2026-11-02, Gustavo: "não acho correto um campo pra pessoa escolher o fuso"): o aparelho manda o
/// próprio fuso (nome IANA, ex. "America/Rio_Branco") no primeiro acesso, e quando a pessoa aceita usar o fuso de um
/// aparelho que está em outro lugar (mudou de cidade, viagem longa). É ele que decide "que dia é hoje" pra ela no
/// servidor (<see cref="HorarioBrasil.UsarFuso"/>, posto pelo <c>FusoDaPessoaMiddleware</c>). Sem fuso = Brasília.
/// Guardado em memória por alguns minutos: o middleware lê em toda requisição.
/// </summary>
public class FusoHorarioService
{
    private static readonly TimeSpan NaMemoria = TimeSpan.FromMinutes(10);
    private readonly AppDbContext _context;
    private readonly IMemoryCache _cache;

    public FusoHorarioService(AppDbContext context, IMemoryCache cache)
    {
        _context = context;
        _cache = cache;
    }

    private static string Chave(Guid usuarioId) => $"fuso:{usuarioId}";

    /// <summary>O fuso gravado na conta (null = ainda não veio de nenhum aparelho: vale Brasília).</summary>
    public async Task<string?> ObterAsync(Guid usuarioId)
    {
        if (_cache.TryGetValue(Chave(usuarioId), out string? fuso))
            return fuso;
        fuso = await _context.Usuarios.AsNoTracking().Where(u => u.Id == usuarioId).Select(u => u.FusoHorario).FirstOrDefaultAsync();
        _cache.Set(Chave(usuarioId), fuso, NaMemoria);
        return fuso;
    }

    /// <summary>Grava o fuso do aparelho na conta. Recusa nome que o sistema não conhece (não vira Brasília calado).</summary>
    public async Task SalvarAsync(Guid usuarioId, string fuso)
    {
        var tz = HorarioBrasil.Resolver(fuso) ?? throw new ArgumentException("Fuso horário desconhecido.");
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");
        usuario.FusoHorario = tz.Id;
        await _context.SaveChangesAsync();
        _cache.Remove(Chave(usuarioId));
    }
}

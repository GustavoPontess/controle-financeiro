using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

public class RateioService
{
    private readonly AppDbContext _context;

    public RateioService(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>Define o modo de rateio padrão da família.</summary>
    public async Task DefinirModoFamiliaAsync(Guid familiaId, Guid usuarioId, ModoRateio modo)
    {
        await ExigirMembroAsync(familiaId, usuarioId);

        var familia = await _context.Familias
            .FirstOrDefaultAsync(f => f.Id == familiaId && f.Ativa)
            ?? throw new KeyNotFoundException("Família não encontrada.");

        familia.ModoRateioPadrao = modo;
        await _context.SaveChangesAsync();
    }

    /// <summary>Define a renda mensal de um membro (usada no rateio proporcional).</summary>
    public async Task DefinirRendaAsync(
        Guid familiaId, Guid membroId, Guid usuarioId, decimal? rendaMensal)
    {
        await ExigirMembroAsync(familiaId, usuarioId);

        if (rendaMensal is < 0)
            throw new ArgumentException("A renda mensal não pode ser negativa.");

        var membro = await _context.MembrosFamilia
            .FirstOrDefaultAsync(m => m.Id == membroId && m.FamiliaId == familiaId && m.Ativo)
            ?? throw new KeyNotFoundException("Membro não encontrado.");

        membro.RendaMensal = rendaMensal;
        await _context.SaveChangesAsync();
    }

    /// <summary>Define o modo de rateio (e os itens, se Personalizado) de uma despesa.</summary>
    public async Task DefinirRateioTransacaoAsync(
        Guid transacaoId, Guid usuarioId, DefinirRateioTransacaoDto dto)
    {
        var transacao = await _context.Transacoes
            .Include(t => t.Rateios)
            .FirstOrDefaultAsync(t => t.Id == transacaoId && t.Ativo)
            ?? throw new KeyNotFoundException("Transação não encontrada.");

        if (transacao.CriadoPor != usuarioId)
            throw new UnauthorizedAccessException("Você só pode alterar suas próprias transações.");

        if (transacao.FamiliaId is null)
            throw new InvalidOperationException(
                "A transação precisa ser uma despesa compartilhada para definir rateio.");

        // Limpa rateios anteriores (substituição completa).
        _context.RateiosTransacao.RemoveRange(transacao.Rateios);

        if (dto.Modo == ModoRateio.Personalizado)
        {
            var itens = dto.Itens ?? throw new ArgumentException(
                "O modo Personalizado exige a lista de itens de rateio.");

            await ValidarItensAsync(transacao.FamiliaId.Value, itens);

            foreach (var item in itens)
            {
                _context.RateiosTransacao.Add(new RateioTransacao
                {
                    Id = Guid.NewGuid(),
                    TransacaoId = transacao.Id,
                    UsuarioId = item.UsuarioId,
                    Percentual = item.Percentual,
                });
            }
        }

        transacao.ModoRateio = dto.Modo;
        await _context.SaveChangesAsync();
    }

    /// <summary>Remove o override de rateio — a despesa volta ao modo padrão da família.</summary>
    public async Task RemoverRateioTransacaoAsync(Guid transacaoId, Guid usuarioId)
    {
        var transacao = await _context.Transacoes
            .Include(t => t.Rateios)
            .FirstOrDefaultAsync(t => t.Id == transacaoId && t.Ativo)
            ?? throw new KeyNotFoundException("Transação não encontrada.");

        if (transacao.CriadoPor != usuarioId)
            throw new UnauthorizedAccessException("Você só pode alterar suas próprias transações.");

        _context.RateiosTransacao.RemoveRange(transacao.Rateios);
        transacao.ModoRateio = null;
        await _context.SaveChangesAsync();
    }

    /// <summary>Lê o rateio de uma despesa (modo override + itens personalizados).</summary>
    public async Task<RateioTransacaoDto> ObterRateioTransacaoAsync(Guid transacaoId, Guid usuarioId)
    {
        var transacao = await _context.Transacoes
            .Include(t => t.Rateios)
            .FirstOrDefaultAsync(t => t.Id == transacaoId && t.Ativo)
            ?? throw new KeyNotFoundException("Transação não encontrada.");

        if (transacao.CriadoPor != usuarioId)
            throw new UnauthorizedAccessException("Você só pode ver suas próprias transações.");

        var itens = transacao.Rateios
            .Select(r => new RateioItemDto(r.UsuarioId, r.Percentual))
            .ToList();

        return new RateioTransacaoDto(transacao.ModoRateio, itens);
    }

    private async Task ValidarItensAsync(Guid familiaId, List<RateioItemDto> itens)
    {
        if (itens.Count == 0)
            throw new ArgumentException("Informe ao menos um item de rateio.");

        var soma = itens.Sum(i => i.Percentual);
        if (Math.Abs(soma - 100m) > 0.01m)
            throw new ArgumentException("Os percentuais de rateio devem somar 100%.");

        if (itens.Any(i => i.Percentual < 0))
            throw new ArgumentException("Percentual de rateio não pode ser negativo.");

        var usuarioIds = itens.Select(i => i.UsuarioId).ToList();
        if (usuarioIds.Count != usuarioIds.Distinct().Count())
            throw new ArgumentException("Há membros repetidos no rateio.");

        var membrosValidos = await _context.MembrosFamilia
            .Where(m => m.FamiliaId == familiaId && m.Ativo)
            .Select(m => m.UsuarioId)
            .ToListAsync();

        if (usuarioIds.Any(id => !membrosValidos.Contains(id)))
            throw new ArgumentException("O rateio inclui alguém que não é membro ativo da família.");
    }

    private async Task ExigirMembroAsync(Guid familiaId, Guid usuarioId)
    {
        var ehMembro = await _context.MembrosFamilia
            .AnyAsync(m => m.FamiliaId == familiaId && m.UsuarioId == usuarioId && m.Ativo);
        if (!ehMembro)
            throw new KeyNotFoundException("Família não encontrada.");
    }
}

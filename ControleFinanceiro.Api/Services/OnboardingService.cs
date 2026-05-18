using ControleFinanceiro.Api.DTOs.Onboarding;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>Issue #29 — estado do onboarding guiado pós-cadastro.</summary>
public class OnboardingService
{
    private readonly AppDbContext _context;

    public OnboardingService(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>Checklist dos primeiros passos — computado a cada consulta.</summary>
    public async Task<OnboardingStatusDto> ObterStatusAsync(Guid usuarioId)
    {
        var usuario = await _context.Usuarios
            .FirstOrDefaultAsync(u => u.Id == usuarioId)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");

        var temConta = await _context.Contas
            .AnyAsync(c => c.UsuarioIdProprietario == usuarioId);

        var temCartao = await _context.CartoesCredito
            .AnyAsync(c => c.CriadoPor == usuarioId);

        var temTransacao = await _context.Transacoes
            .AnyAsync(t => t.Ativo &&
                ((t.ContaId != null && t.Conta!.UsuarioIdProprietario == usuarioId)
                || (t.CartaoCreditoId != null && t.CartaoCredito!.CriadoPor == usuarioId)));

        var temFamilia = await _context.MembrosFamilia
            .AnyAsync(m => m.UsuarioId == usuarioId && m.Ativo);

        return new OnboardingStatusDto(
            usuario.OnboardingConcluido, temConta, temCartao, temTransacao, temFamilia);
    }

    /// <summary>Marca o onboarding como concluído (idempotente).</summary>
    public async Task ConcluirAsync(Guid usuarioId)
    {
        var usuario = await _context.Usuarios
            .FirstOrDefaultAsync(u => u.Id == usuarioId)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");

        if (usuario.OnboardingConcluido)
            return;

        usuario.OnboardingConcluido = true;
        usuario.AtualizadoEm = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }
}

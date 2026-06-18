using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Autorização por papel da família (Feature 2.3). Fonte única de authz — reutilizada
/// por todos os services de família no lugar do antigo "é o criador?".
/// Hierarquia de poder: Admin &gt; Membro &gt; Dependente.
/// Spec: docs/features/familia/papeis-permissoes.md.
/// </summary>
public static class FamiliaPermissoes
{
    /// <summary>Poder relativo do papel (maior = mais permissões). Independe do valor do enum.</summary>
    private static int Poder(PapelFamilia papel) => papel switch
    {
        PapelFamilia.Admin => 3,
        PapelFamilia.Membro => 2,
        PapelFamilia.Dependente => 1,
        _ => 0,
    };

    /// <summary>Papel do usuário na família, ou null se não é membro ativo.</summary>
    public static async Task<PapelFamilia?> ObterPapelAsync(
        AppDbContext context, Guid familiaId, Guid usuarioId)
    {
        var membro = await context.MembrosFamilia
            .Where(m => m.FamiliaId == familiaId && m.UsuarioId == usuarioId && m.Ativo)
            .Select(m => new { m.PapelPermissao })
            .FirstOrDefaultAsync();
        return membro?.PapelPermissao;
    }

    /// <summary>
    /// Exige que o usuário seja membro ativo com papel &gt;= <paramref name="minimo"/>.
    /// Não-membro → <see cref="KeyNotFoundException"/> (404, não vaza existência).
    /// Membro sem poder suficiente → <see cref="ForbiddenAccessException"/> (403).
    /// Retorna o papel efetivo (útil pra regras extras no caller).
    /// </summary>
    public static async Task<PapelFamilia> ExigirPapelAsync(
        AppDbContext context, Guid familiaId, Guid usuarioId, PapelFamilia minimo)
    {
        var papel = await ObterPapelAsync(context, familiaId, usuarioId)
            ?? throw new KeyNotFoundException("Família não encontrada.");

        if (Poder(papel) < Poder(minimo))
            throw new ForbiddenAccessException("Você não tem permissão para esta ação.");

        return papel;
    }

    /// <summary>Exige só ser membro ativo (qualquer papel, inclusive Dependente).</summary>
    public static Task<PapelFamilia> ExigirMembroAsync(
        AppDbContext context, Guid familiaId, Guid usuarioId)
        => ExigirPapelAsync(context, familiaId, usuarioId, PapelFamilia.Dependente);
}

using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Autorização da família: o ÚNICO lugar que responde "quem pode o quê" (Feature 2.3; centralizado em 2026-10-19,
/// pedido do Gustavo antes do cartão compartilhado). Cada pergunta tem nome; service nenhum reescreve a regra na mão
/// (a trava <c>PermissoesCentralizadasTests</c> lê o código e falha). Tabela legível: <c>docs/PERMISSOES.md</c>.
/// Hierarquia de poder: Admin &gt; Membro &gt; Dependente ("só vê").
/// Spec: docs/features/familia/papeis-permissoes.md.
///
/// Os papéis, em palavras:
/// - <b>membro</b> = está ATIVO na família, qualquer papel: vê a família.
/// - <b>quem lança</b> = membro que não é "só vê": divide despesa, entra na divisão e no peso, passa/recebe dinheiro
///   entre vocês, marca conta/cartão/conta fixa da casa.
/// - <b>admin</b> = muda as regras, convida e cuida dos membros.
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

    // ── as regras (uma linha cada) ────────────────────────────────────────────────────────────────

    /// <summary>Quem lança: ativo e não "só vê". Pra lista já carregada em memória.</summary>
    public static bool Lanca(bool ativo, PapelFamilia papel) => ativo && papel != PapelFamilia.Dependente;

    /// <summary>Quem "só vê" não vê a renda (nem o valor) de ninguém além da própria.</summary>
    public static bool VeRendaDosOutros(PapelFamilia papel) => papel != PapelFamilia.Dependente;

    // ── consultas (o banco filtra) ─────────────────────────────────────────────────────────────────

    /// <summary>Os membros ativos da família (qualquer papel).</summary>
    public static IQueryable<MembroFamilia> MembrosAtivos(AppDbContext context, Guid familiaId) =>
        context.MembrosFamilia.Where(m => m.FamiliaId == familiaId && m.Ativo);

    /// <summary>Quem lança na família (ativos que não são "só vê"): os que entram na divisão.</summary>
    public static IQueryable<MembroFamilia> QuemLanca(AppDbContext context, Guid familiaId) =>
        context.MembrosFamilia.Where(m => m.FamiliaId == familiaId && m.Ativo && m.PapelPermissao != PapelFamilia.Dependente);

    // ── perguntas sim/não ──────────────────────────────────────────────────────────────────────────

    /// <summary>A pessoa é membro ativo da família (vê a família)?</summary>
    public static Task<bool> EhMembroAsync(AppDbContext context, Guid familiaId, Guid usuarioId) =>
        MembrosAtivos(context, familiaId).AnyAsync(m => m.UsuarioId == usuarioId);

    /// <summary>A pessoa lança nessa família (divide, entra na divisão, passa/recebe dinheiro)?</summary>
    public static Task<bool> LancaNaFamiliaAsync(AppDbContext context, Guid familiaId, Guid usuarioId) =>
        QuemLanca(context, familiaId).AnyAsync(m => m.UsuarioId == usuarioId);

    /// <summary>As duas pessoas estão juntas, ativas, numa família ativa (ex.: uma vê a foto da outra)?</summary>
    public static Task<bool> DividemFamiliaAsync(AppDbContext context, Guid usuarioId, Guid outroUsuarioId) =>
        context.MembrosFamilia.AnyAsync(m =>
            m.UsuarioId == usuarioId && m.Ativo && m.Familia!.Ativa &&
            m.Familia.Membros.Any(o => o.UsuarioId == outroUsuarioId && o.Ativo));

    /// <summary>A pessoa está ativa em alguma família (qualquer uma)?</summary>
    public static Task<bool> EstaEmAlgumaFamiliaAsync(AppDbContext context, Guid usuarioId) =>
        context.MembrosFamilia.AnyAsync(m => m.UsuarioId == usuarioId && m.Ativo);

    /// <summary>Papel do usuário na família, ou null se não é membro ativo.</summary>
    public static async Task<PapelFamilia?> ObterPapelAsync(
        AppDbContext context, Guid familiaId, Guid usuarioId)
    {
        var membro = await MembrosAtivos(context, familiaId)
            .Where(m => m.UsuarioId == usuarioId)
            .Select(m => new { m.PapelPermissao })
            .FirstOrDefaultAsync();
        return membro?.PapelPermissao;
    }

    // ── exigências (lançam o erro certo) ───────────────────────────────────────────────────────────

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

    /// <summary>Exige lançar na família (Membro ou Admin): dividir, passar dinheiro, marcar algo da casa.</summary>
    public static Task<PapelFamilia> ExigirLancarAsync(
        AppDbContext context, Guid familiaId, Guid usuarioId)
        => ExigirPapelAsync(context, familiaId, usuarioId, PapelFamilia.Membro);

    /// <summary>Quem criou a família: só ele dissolve, e ele não sai nem perde o Admin.</summary>
    public static bool EhCriador(Familia familia, Guid usuarioId) => familia.CriadoPorUsuarioId == usuarioId;

    /// <summary>Exige ser quem criou a família (dissolver).</summary>
    public static void ExigirCriador(Familia familia, Guid usuarioId)
    {
        if (!EhCriador(familia, usuarioId))
            throw new ForbiddenAccessException("Apenas o dono da família pode executar esta ação.");
    }

    /// <summary>Exige ser admin (regras, convites, membros).</summary>
    public static Task<PapelFamilia> ExigirAdminAsync(
        AppDbContext context, Guid familiaId, Guid usuarioId)
        => ExigirPapelAsync(context, familiaId, usuarioId, PapelFamilia.Admin);
}

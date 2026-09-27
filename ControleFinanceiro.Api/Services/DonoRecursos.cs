using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Isolamento por usuário nas ESCRITAS: confere que um recurso referenciado por id vindo do cliente
/// (conta, cartão, categoria, subcategoria) pertence — ou é visível — ao usuário antes de gravar a
/// referência. Fonte única: antes cada service repetia (ou esquecia) a query, e o esquecimento virava
/// furo de escrita entre contas (ex.: Recorrente apontando pra conta de outro usuário, e o job gerando
/// lançamentos no saldo dele).
/// Recurso inexistente OU de outro usuário → <see cref="KeyNotFoundException"/> (404): não revela se o
/// id existe, mesmo padrão do TransacaoService.
/// </summary>
public static class DonoRecursos
{
    /// <summary>Conta do usuário (dono = <c>UsuarioIdProprietario</c>).</summary>
    public static async Task ExigirContaAsync(AppDbContext context, Guid contaId, Guid usuarioId)
    {
        if (!await context.Contas.AnyAsync(c => c.Id == contaId && c.UsuarioIdProprietario == usuarioId))
            throw new KeyNotFoundException("Conta não encontrada ou você não tem permissão.");
    }

    /// <summary>Cartão do usuário (dono = <c>CriadoPor</c>).</summary>
    public static async Task ExigirCartaoAsync(AppDbContext context, Guid cartaoId, Guid usuarioId)
    {
        if (!await context.CartoesCredito.AnyAsync(c => c.Id == cartaoId && c.CriadoPor == usuarioId))
            throw new KeyNotFoundException("Cartão não encontrado ou você não tem permissão.");
    }

    /// <summary>Categoria global (<c>UsuarioId</c> nulo, vem do seeder) ou do próprio usuário.</summary>
    public static async Task ExigirCategoriaAsync(AppDbContext context, Guid categoriaId, Guid usuarioId)
    {
        if (!await context.Categorias.AnyAsync(c => c.Id == categoriaId && (c.UsuarioId == null || c.UsuarioId == usuarioId)))
            throw new KeyNotFoundException("Categoria não encontrada.");
    }

    /// <summary>Subcategoria global (<c>UsuarioId</c> nulo) ou do próprio usuário.</summary>
    public static async Task ExigirSubcategoriaAsync(AppDbContext context, Guid subcategoriaId, Guid usuarioId)
    {
        if (!await context.Subcategorias.AnyAsync(s => s.Id == subcategoriaId && (s.UsuarioId == null || s.UsuarioId == usuarioId)))
            throw new KeyNotFoundException("Subcategoria não encontrada.");
    }
}

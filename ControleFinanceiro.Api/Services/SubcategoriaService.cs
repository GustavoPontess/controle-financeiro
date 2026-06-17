using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Issue #83 — CRUD de subcategorias. Multi-tenant manual: toda query filtra por
/// usuarioId (padrão = UsuarioId null, visível a todos, imutável).
/// </summary>
public class SubcategoriaService
{
    private readonly AppDbContext _context;

    public SubcategoriaService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<Subcategoria>> ListarAsync(Guid usuarioId, Guid? categoriaId = null)
    {
        var query = _context.Subcategorias
            .Where(s => s.UsuarioId == null || s.UsuarioId == usuarioId);

        if (categoriaId.HasValue)
            query = query.Where(s => s.CategoriaId == categoriaId.Value);

        return await query
            .OrderBy(s => s.UsuarioId == null ? 0 : 1) // padrões primeiro
            .ThenBy(s => s.Nome)
            .AsNoTracking()
            .ToListAsync();
    }

    public async Task<Subcategoria?> BuscarPorIdAsync(Guid id, Guid usuarioId)
    {
        return await _context.Subcategorias
            .FirstOrDefaultAsync(s => s.Id == id && (s.UsuarioId == null || s.UsuarioId == usuarioId));
    }

    public async Task<Subcategoria> CriarAsync(Subcategoria sub, Guid usuarioId)
    {
        if (string.IsNullOrWhiteSpace(sub.Nome))
            throw new ArgumentException("Nome é obrigatório.");

        if (sub.Nome.Length > 120)
            throw new ArgumentException("Nome deve ter no máximo 120 caracteres.");

        // Categoria precisa existir e ser acessível ao usuário (padrão ou própria).
        var categoria = await _context.Categorias
            .FirstOrDefaultAsync(c => c.Id == sub.CategoriaId && (c.UsuarioId == null || c.UsuarioId == usuarioId))
            ?? throw new KeyNotFoundException("Categoria não encontrada.");

        sub.Id = Guid.NewGuid();
        sub.CategoriaId = categoria.Id;
        sub.UsuarioId = usuarioId;
        sub.Categoria = null;

        _context.Subcategorias.Add(sub);
        await _context.SaveChangesAsync();

        return sub;
    }

    public async Task<Subcategoria> AtualizarAsync(Guid id, Subcategoria dados, Guid usuarioId)
    {
        var sub = await _context.Subcategorias.FirstOrDefaultAsync(s => s.Id == id)
            ?? throw new KeyNotFoundException("Subcategoria não encontrada.");

        if (sub.UsuarioId == null)
            throw new InvalidOperationException("Subcategorias padrão não podem ser editadas.");

        if (sub.UsuarioId != usuarioId)
            throw new ForbiddenAccessException("Você não tem permissão para editar esta subcategoria.");

        if (string.IsNullOrWhiteSpace(dados.Nome))
            throw new ArgumentException("Nome é obrigatório.");

        if (dados.Nome.Length > 120)
            throw new ArgumentException("Nome deve ter no máximo 120 caracteres.");

        sub.Nome = dados.Nome;
        sub.Icone = dados.Icone;
        sub.Cor = dados.Cor;

        await _context.SaveChangesAsync();
        return sub;
    }

    public async Task DeletarAsync(Guid id, Guid usuarioId)
    {
        var sub = await _context.Subcategorias.FirstOrDefaultAsync(s => s.Id == id)
            ?? throw new KeyNotFoundException("Subcategoria não encontrada.");

        if (sub.UsuarioId == null)
            throw new InvalidOperationException("Subcategorias padrão não podem ser removidas.");

        if (sub.UsuarioId != usuarioId)
            throw new ForbiddenAccessException("Você não tem permissão para remover esta subcategoria.");

        _context.Subcategorias.Remove(sub);
        await _context.SaveChangesAsync();
    }
}

using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services
{
    public class CategoriaService
    {
        private readonly AppDbContext _context;

        public CategoriaService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<Categoria>> ListarAsync(Guid usuarioId)
        {
            return await _context.Categorias
                .Where(c => c.UsuarioId == null || c.UsuarioId == usuarioId)
                .OrderBy(c => c.UsuarioId == null ? 0 : 1) // padrões primeiro
                .ThenBy(c => c.Descricao)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<Categoria?> BuscarPorIdAsync(Guid id, Guid usuarioId)
        {
            return await _context.Categorias
                .FirstOrDefaultAsync(c => c.Id == id && (c.UsuarioId == null || c.UsuarioId == usuarioId));
        }

        public async Task<Categoria> CriarAsync(Categoria categoria, Guid usuarioId)
        {
            if (string.IsNullOrWhiteSpace(categoria.Descricao))
                throw new ArgumentException("Descrição é obrigatória.");

            if (categoria.Descricao.Length > 400)
                throw new ArgumentException("Descrição deve ter no máximo 400 caracteres.");

            categoria.Id = Guid.NewGuid();
            categoria.UsuarioId = usuarioId;

            _context.Categorias.Add(categoria);
            await _context.SaveChangesAsync();

            return categoria;
        }

        public async Task DeletarAsync(Guid id, Guid usuarioId)
        {
            var categoria = await _context.Categorias.FindAsync(id)
                ?? throw new KeyNotFoundException("Categoria não encontrada.");

            if (categoria.UsuarioId == null)
                throw new InvalidOperationException("Categorias padrão não podem ser removidas.");

            if (categoria.UsuarioId != usuarioId)
                throw new UnauthorizedAccessException("Você não tem permissão para remover esta categoria.");

            _context.Categorias.Remove(categoria);
            await _context.SaveChangesAsync();
        }
    }
}

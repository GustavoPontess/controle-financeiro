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

        public async Task<List<Categoria>> ListarAsync()
        {
            return await _context.Categorias
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<Categoria?> BuscarPorIdAsync(Guid id)
        {
            return await _context.Categorias
                .FirstOrDefaultAsync(c => c.Id == id);
        }

        public async Task<Categoria> CriarAsync(Categoria categoria)
        {
            if (string.IsNullOrWhiteSpace(categoria.Descricao))
            {
                throw new Exception("Descrição é obrigatória.");
            }

            if (categoria.Descricao.Length > 400)
            {
                throw new Exception("Descrição deve ter no máximo 400 caracteres.");
            }

            categoria.Id = Guid.NewGuid();

            _context.Categorias.Add(categoria);
            await _context.SaveChangesAsync();

            return categoria;
        }
    }
}
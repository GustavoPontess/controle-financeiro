using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services
{
    public class BancoService
    {
        private readonly AppDbContext _context;

        public BancoService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<Banco>> ListarAsync()
        {
            return await _context.Bancos
                .Include(b => b.Contas)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<Banco?> BuscarPorIdAsync(Guid id)
        {
            return await _context.Bancos
                .Include(b => b.Contas)
                .FirstOrDefaultAsync(b => b.Id == id);
        }

        public async Task<Banco> CriarAsync(Banco banco)
        {
            if (string.IsNullOrWhiteSpace(banco.Nome))
                throw new Exception("Nome é obrigatório.");

            banco.Id = Guid.NewGuid();
            _context.Bancos.Add(banco);
            await _context.SaveChangesAsync();
            return banco;
        }

        public async Task AtualizarAsync(Guid id, Banco banco)
        {
            var existente = await _context.Bancos.FindAsync(id)
                ?? throw new Exception("Banco não encontrado.");

            if (string.IsNullOrWhiteSpace(banco.Nome))
                throw new Exception("Nome é obrigatório.");

            existente.Nome = banco.Nome;
            existente.Tipo = banco.Tipo;
            await _context.SaveChangesAsync();
        }

        public async Task DeletarAsync(Guid id)
        {
            var banco = await _context.Bancos.FindAsync(id)
                ?? throw new Exception("Banco não encontrado.");

            _context.Bancos.Remove(banco);
            await _context.SaveChangesAsync();
        }
    }
}

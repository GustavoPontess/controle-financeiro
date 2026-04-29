using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services
{
    public class PessoaService
    {
        private readonly AppDbContext _context;

        public PessoaService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<Pessoa>> ListarAsync()
        {
            return await _context.Pessoas
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<Pessoa?> BuscarPorIdAsync(Guid id)
        {
            return await _context.Pessoas
                .FirstOrDefaultAsync(p => p.Id == id);
        }

        public async Task<Pessoa> CriarAsync(Pessoa pessoa)
        {
            if (string.IsNullOrWhiteSpace(pessoa.Nome))
            {
                throw new Exception("Nome é obrigatório.");
            }

            if (pessoa.Nome.Length > 200)
            {
                throw new Exception("Nome deve ter no máximo 200 caracteres.");
            }

            if (pessoa.DataNascimento > DateTime.Today)
                throw new Exception("Data de nascimento não pode ser no futuro.");

            if (pessoa.Idade > 120)
                throw new Exception("Data de nascimento inválida.");

            pessoa.Id = Guid.NewGuid();

            _context.Pessoas.Add(pessoa);
            await _context.SaveChangesAsync();

            return pessoa;
        }

        public async Task AtualizarAsync(Guid id, Pessoa pessoa)
        {
            var pessoaExistente = await _context.Pessoas.FindAsync(id);

            if (pessoaExistente == null)
            {
                throw new Exception("Pessoa não encontrada.");
            }

            if (string.IsNullOrWhiteSpace(pessoa.Nome))
            {
                throw new Exception("Nome é obrigatório.");
            }

            if (pessoa.Nome.Length > 200)
            {
                throw new Exception("Nome deve ter no máximo 200 caracteres.");
            }

            if (pessoa.DataNascimento > DateTime.Today)
                throw new Exception("Data de nascimento não pode ser no futuro.");

            if (pessoa.Idade > 120)
                throw new Exception("Data de nascimento inválida.");

            pessoaExistente.Nome = pessoa.Nome;
            pessoaExistente.DataNascimento = pessoa.DataNascimento;

            await _context.SaveChangesAsync();
        }

        public async Task DeletarAsync(Guid id)
        {
            var pessoa = await _context.Pessoas.FindAsync(id);

            if (pessoa == null)
            {
                throw new Exception("Pessoa não encontrada.");
            }

            _context.Pessoas.Remove(pessoa);
            await _context.SaveChangesAsync();
        }
    }
}
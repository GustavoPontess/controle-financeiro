using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services
{
    public class ContaService
    {
        private readonly AppDbContext _context;

        public ContaService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<Conta>> ListarAsync()
        {
            return await _context.Contas
                .Include(c => c.Banco)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<Conta?> BuscarPorIdAsync(Guid id)
        {
            return await _context.Contas
                .Include(c => c.Banco)
                .FirstOrDefaultAsync(c => c.Id == id);
        }

        public async Task<Conta> CriarAsync(Conta conta)
        {
            if (string.IsNullOrWhiteSpace(conta.Nome))
                throw new Exception("Nome é obrigatório.");

            if (conta.Nome.Length > 100)
                throw new Exception("Nome deve ter no máximo 100 caracteres.");

            conta.Id = Guid.NewGuid();
            _context.Contas.Add(conta);
            await _context.SaveChangesAsync();
            return conta;
        }

        public async Task AtualizarAsync(Guid id, Conta conta)
        {
            var existente = await _context.Contas.FindAsync(id)
                ?? throw new Exception("Conta não encontrada.");

            if (string.IsNullOrWhiteSpace(conta.Nome))
                throw new Exception("Nome é obrigatório.");

            existente.Nome = conta.Nome;
            existente.NumeroConta = conta.NumeroConta;
            existente.Tipo = conta.Tipo;
            existente.TipoCartao = conta.TipoCartao;
            existente.SaldoInicial = conta.SaldoInicial;
            existente.BancoId = conta.BancoId;

            await _context.SaveChangesAsync();
        }

        public async Task DeletarAsync(Guid id)
        {
            var conta = await _context.Contas.FindAsync(id)
                ?? throw new Exception("Conta não encontrada.");

            _context.Contas.Remove(conta);
            await _context.SaveChangesAsync();
        }
    }
}

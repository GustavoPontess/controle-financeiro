using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
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

        public async Task<List<Conta>> ListarAsync(Guid usuarioId)
        {
            return await _context.Contas
                .Where(c => c.UsuarioIdProprietario == usuarioId)
                .Include(c => c.Banco)
                .Include(c => c.Transacoes)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<Conta?> BuscarPorIdAsync(Guid id, Guid usuarioId)
        {
            return await _context.Contas
                .Where(c => c.Id == id && c.UsuarioIdProprietario == usuarioId)
                .Include(c => c.Banco)
                .Include(c => c.Transacoes)
                .FirstOrDefaultAsync();
        }

        public async Task<Conta> CriarAsync(Conta conta, Guid usuarioId, decimal saldoInicial = 0)
        {
            if (string.IsNullOrWhiteSpace(conta.Nome))
                throw new ArgumentException("Nome é obrigatório.");

            if (conta.Nome.Length > 100)
                throw new ArgumentException("Nome deve ter no máximo 100 caracteres.");

            if (saldoInicial < 0)
                throw new ArgumentException("Saldo inicial não pode ser negativo.");

            conta.Id = Guid.NewGuid();
            conta.UsuarioIdProprietario = usuarioId;
            _context.Contas.Add(conta);

            if (saldoInicial > 0)
            {
                _context.Transacoes.Add(new Transacao
                {
                    Id = Guid.NewGuid(),
                    Descricao = "Saldo Inicial",
                    Valor = saldoInicial,
                    Tipo = TipoTransacao.Receita,
                    ContaId = conta.Id,
                    CategoriaId = null,
                    CriadoPor = usuarioId,
                    Data = DateTime.UtcNow,
                    EhSaldoInicial = true
                });
            }

            await _context.SaveChangesAsync();
            return conta;
        }

        public async Task AtualizarAsync(Guid id, Conta conta, Guid usuarioId)
        {
            var existente = await _context.Contas.FindAsync(id)
                ?? throw new KeyNotFoundException("Conta não encontrada.");

            if (existente.UsuarioIdProprietario != usuarioId)
                throw new ForbiddenAccessException("Você não tem permissão para atualizar esta conta.");

            if (existente.IsCarteira)
                throw new InvalidOperationException("A carteira não pode ser editada.");

            if (string.IsNullOrWhiteSpace(conta.Nome))
                throw new ArgumentException("Nome é obrigatório.");

            existente.Nome = conta.Nome;
            existente.NumeroConta = conta.NumeroConta;
            existente.Tipo = conta.Tipo;
            existente.TipoCartao = conta.TipoCartao;
            existente.BancoId = conta.BancoId;
            existente.IsCarteira = conta.IsCarteira;

            await _context.SaveChangesAsync();
        }

        public async Task DeletarAsync(Guid id, Guid usuarioId)
        {
            var conta = await _context.Contas.FindAsync(id)
                ?? throw new KeyNotFoundException("Conta não encontrada.");

            if (conta.UsuarioIdProprietario != usuarioId)
                throw new ForbiddenAccessException("Você não tem permissão para deletar esta conta.");

            if (conta.IsCarteira)
                throw new InvalidOperationException("A carteira não pode ser deletada.");

            _context.Contas.Remove(conta);
            await _context.SaveChangesAsync();
        }
    }
}

using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Relatorios;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services
{
    public class TransacaoService
    {
        private readonly AppDbContext _context;

        public TransacaoService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<Transacao> CriarTransacaoAsync(Transacao transacao, Guid usuarioId)
        {
            // Validate conta exists and user owns it
            var conta = await _context.Contas
                .FirstOrDefaultAsync(c => c.Id == transacao.ContaId && c.UsuarioIdProprietario == usuarioId);

            if (conta == null)
            {
                throw new Exception("Conta não encontrada ou você não tem permissão.");
            }

            // Validate categoria exists
            var categoria = await _context.Categorias
                .FirstOrDefaultAsync(c => c.Id == transacao.CategoriaId);

            if (categoria == null)
            {
                throw new Exception("Categoria não encontrada.");
            }

            // Validate valor
            if (transacao.Valor <= 0)
            {
                throw new Exception("O valor da transação deve ser positivo.");
            }

            // Validate categoria matches tipo
            if (categoria.Finalidade == Finalidade.Receita &&
                transacao.Tipo == TipoTransacao.Despesa)
            {
                throw new Exception("Categoria inválida para despesa.");
            }

            if (categoria.Finalidade == Finalidade.Despesa &&
                transacao.Tipo == TipoTransacao.Receita)
            {
                throw new Exception("Categoria inválida para receita.");
            }

            transacao.CriadoPor = usuarioId;
            _context.Transacoes.Add(transacao);
            await _context.SaveChangesAsync();

            return transacao;
        }

        public async Task<List<Transacao>> ListarAsync(Guid usuarioId)
        {
            return await _context.Transacoes
                .Where(t => t.Conta!.UsuarioIdProprietario == usuarioId)
                .Include(t => t.Conta)
                .Include(t => t.Categoria)
                .ToListAsync();
        }

        public async Task<Transacao?> BuscarPorIdAsync(Guid id, Guid usuarioId)
        {
            return await _context.Transacoes
                .Where(t => t.Id == id && t.Conta!.UsuarioIdProprietario == usuarioId)
                .Include(t => t.Conta)
                .Include(t => t.Categoria)
                .FirstOrDefaultAsync();
        }

        public async Task<ResumoFinanceiroDto> ObterResumoPorContaAsync(Guid contaId, Guid usuarioId)
        {
            var conta = await _context.Contas
                .FirstOrDefaultAsync(c => c.Id == contaId && c.UsuarioIdProprietario == usuarioId);

            if (conta == null)
                throw new Exception("Conta não encontrada.");

            var transacoes = await _context.Transacoes
                .Where(t => t.ContaId == contaId)
                .ToListAsync();

            var totalReceitas = transacoes
                .Where(t => t.Tipo == TipoTransacao.Receita)
                .Sum(t => t.Valor);

            var totalDespesas = transacoes
                .Where(t => t.Tipo == TipoTransacao.Despesa)
                .Sum(t => t.Valor);

            return new ResumoFinanceiroDto
            {
                ContaId = contaId,
                TotalReceitas = totalReceitas,
                TotalDespesas = totalDespesas
            };
        }
    }
}
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

        public async Task<Transacao> CriarTransacaoAsync(Transacao transacao)
        {
            var pessoa = await _context.Pessoas
                .FirstOrDefaultAsync(p => p.Id == transacao.PessoaId);

            if (pessoa == null)
            {
                throw new Exception("Pessoa não encontrada.");
            }

            var categoria = await _context.Categorias
                .FirstOrDefaultAsync(c => c.Id == transacao.CategoriaId);

            if (categoria == null)
            {
                throw new Exception("Categoria não encontrada.");
            }

            if (transacao.Valor <= 0)
            {
                throw new Exception("O valor da transação deve ser positivo.");
            }

            if (pessoa.Idade < 18 && transacao.Tipo == TipoTransacao.Receita)
            {
                throw new Exception("Menor de idade pode registrar apenas despesas.");
            }

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

            _context.Transacoes.Add(transacao);

            await _context.SaveChangesAsync();

            return transacao;
        }

        public async Task<List<Transacao>> ListarAsync()
        {
            return await _context.Transacoes
                .Include(t => t.Pessoa)
                .Include(t => t.Categoria)
                .ToListAsync();
        }

        public async Task<Transacao?> BuscarPorIdAsync(Guid id)
        {
            return await _context.Transacoes
                .Include(t => t.Pessoa)
                .Include(t => t.Categoria)
                .FirstOrDefaultAsync(t => t.Id == id);
        }

        public async Task<ResumoFinanceiroDto> ObterResumoPorPessoaAsync(Guid pessoaId)
        {
            var transacoes = await _context.Transacoes
                .Where(t => t.PessoaId == pessoaId)
                .ToListAsync();

            var totalReceitas = transacoes
                .Where(t => t.Tipo == TipoTransacao.Receita)
                .Sum(t => t.Valor);

            var totalDespesas = transacoes
                .Where(t => t.Tipo == TipoTransacao.Despesa)
                .Sum(t => t.Valor);

            return new ResumoFinanceiroDto
            {
                PessoaId = pessoaId,
                TotalReceitas = totalReceitas,
                TotalDespesas = totalDespesas
            };
        }
    }
}
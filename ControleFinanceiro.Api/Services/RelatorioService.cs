using Microsoft.EntityFrameworkCore;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Relatorios;

namespace ControleFinanceiro.Api.Services
{
    public class RelatorioService
    {
        private readonly AppDbContext _context;

        public RelatorioService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<RelatorioTotaisPessoaDto> ObterTotaisPorPessoaAsync()
        {
            var pessoas = await _context.Pessoas
                .Include(p => p.Transacoes)
                .ToListAsync();

            var resultado = new RelatorioTotaisPessoaDto();

            foreach (var pessoa in pessoas)
            {
                var totalReceitas = pessoa.Transacoes?
                    .Where(t => t.Tipo == TipoTransacao.Receita)
                    .Sum(t => t.Valor) ?? 0;

                var totalDespesas = pessoa.Transacoes?
                    .Where(t => t.Tipo == TipoTransacao.Despesa)
                    .Sum(t => t.Valor) ?? 0;

                resultado.Pessoas.Add(new PessoaResumoDto
                {
                    PessoaId = pessoa.Id,
                    Nome = pessoa.Nome,
                    TotalReceitas = totalReceitas,
                    TotalDespesas = totalDespesas
                });

                resultado.TotalGeralReceitas += totalReceitas;
                resultado.TotalGeralDespesas += totalDespesas;
            }

            return resultado;
        }
    }
}
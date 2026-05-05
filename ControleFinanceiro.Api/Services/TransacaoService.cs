using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Relatorios;
using ControleFinanceiro.Api.DTOs.Transacao;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services
{
    public class TransacaoService
    {
        private readonly AppDbContext _context;
        private readonly FaturaService _faturaService;

        public TransacaoService(AppDbContext context, FaturaService faturaService)
        {
            _context = context;
            _faturaService = faturaService;
        }

        /// <summary>
        /// Cria uma transação simples (à vista) e, se for de crédito, associa automaticamente
        /// à fatura correta. Para parcelamento, use CriarParcelamentoAsync.
        /// </summary>
        public async Task<Transacao> CriarTransacaoAsync(Transacao transacao, Guid usuarioId)
        {
            if (transacao.ContaId.HasValue)
            {
                var conta = await _context.Contas
                    .FirstOrDefaultAsync(c => c.Id == transacao.ContaId && c.UsuarioIdProprietario == usuarioId);
                if (conta == null)
                    throw new Exception("Conta não encontrada ou você não tem permissão.");
            }
            else if (transacao.CartaoCreditoId.HasValue)
            {
                var cartao = await _context.CartoesCredito
                    .FirstOrDefaultAsync(c => c.Id == transacao.CartaoCreditoId && c.CriadoPor == usuarioId);
                if (cartao == null)
                    throw new Exception("Cartão não encontrado ou você não tem permissão.");
            }
            else
            {
                throw new Exception("Informe uma conta ou um cartão de crédito.");
            }

            if (transacao.CategoriaId.HasValue)
            {
                var categoria = await _context.Categorias
                    .FirstOrDefaultAsync(c => c.Id == transacao.CategoriaId);

                if (categoria == null)
                    throw new Exception("Categoria não encontrada.");

                if (categoria.Finalidade == Finalidade.Receita && transacao.Tipo == TipoTransacao.Despesa)
                    throw new Exception("Categoria inválida para despesa.");

                if (categoria.Finalidade == Finalidade.Despesa && transacao.Tipo == TipoTransacao.Receita)
                    throw new Exception("Categoria inválida para receita.");
            }

            if (transacao.Valor <= 0)
                throw new Exception("O valor da transação deve ser positivo.");

            // Transação de crédito → associar à fatura correspondente (invariante 2)
            if (transacao.UsadoComoCredito && transacao.CartaoCreditoId.HasValue)
            {
                var fatura = await _faturaService.ObterOuCriarFaturaAsync(
                    transacao.CartaoCreditoId.Value, transacao.Data, usuarioId);
                transacao.FaturaId = fatura.Id;
            }

            transacao.CriadoPor = usuarioId;
            _context.Transacoes.Add(transacao);
            await _context.SaveChangesAsync();

            return transacao;
        }

        /// <summary>
        /// Cria um parcelamento: N transações distribuídas em N faturas consecutivas.
        /// </summary>
        public async Task<List<Transacao>> CriarParcelamentoAsync(CriarTransacaoDto dto, Guid usuarioId)
        {
            if (!dto.CartaoCreditoId.HasValue)
                throw new Exception("Parcelamento requer cartão de crédito.");

            var cartao = await _context.CartoesCredito
                .FirstOrDefaultAsync(c => c.Id == dto.CartaoCreditoId && c.CriadoPor == usuarioId)
                ?? throw new Exception("Cartão não encontrado.");

            return await _faturaService.CriarParcelamentoAsync(
                cartao.Id,
                dto.CategoriaId == Guid.Empty ? null : (Guid?)dto.CategoriaId,
                dto.Descricao,
                dto.Valor,
                dto.Parcelas!.Value,
                dto.Data,
                usuarioId);
        }

        public async Task<List<Transacao>> ListarAsync(Guid usuarioId)
        {
            return await _context.Transacoes
                .Where(t =>
                    (t.ContaId.HasValue && t.Conta!.UsuarioIdProprietario == usuarioId) ||
                    (t.CartaoCreditoId.HasValue && t.CartaoCredito!.CriadoPor == usuarioId))
                .Include(t => t.Conta)
                .Include(t => t.CartaoCredito)
                .Include(t => t.Categoria)
                .OrderByDescending(t => t.Data)
                .ToListAsync();
        }

        public async Task<Transacao?> BuscarPorIdAsync(Guid id, Guid usuarioId)
        {
            return await _context.Transacoes
                .Where(t => t.Id == id && (
                    (t.ContaId.HasValue && t.Conta!.UsuarioIdProprietario == usuarioId) ||
                    (t.CartaoCreditoId.HasValue && t.CartaoCredito!.CriadoPor == usuarioId)))
                .Include(t => t.Conta)
                .Include(t => t.CartaoCredito)
                .Include(t => t.Categoria)
                .FirstOrDefaultAsync();
        }

        public async Task<bool> AtualizarAsync(Guid id, Transacao dados, Guid usuarioId)
        {
            var transacao = await _context.Transacoes
                .Where(t => t.Id == id && (
                    (t.ContaId.HasValue && t.Conta!.UsuarioIdProprietario == usuarioId) ||
                    (t.CartaoCreditoId.HasValue && t.CartaoCredito!.CriadoPor == usuarioId)))
                .Include(t => t.Conta)
                .Include(t => t.CartaoCredito)
                .FirstOrDefaultAsync();

            if (transacao is null) return false;

            transacao.Descricao = dados.Descricao;
            transacao.Valor = dados.Valor;
            transacao.Tipo = dados.Tipo;
            transacao.CategoriaId = dados.CategoriaId;
            transacao.MeioPagamento = dados.MeioPagamento;
            transacao.Data = dados.Data;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeletarAsync(Guid id, Guid usuarioId)
        {
            var transacao = await _context.Transacoes
                .Where(t => t.Id == id && (
                    (t.ContaId.HasValue && t.Conta!.UsuarioIdProprietario == usuarioId) ||
                    (t.CartaoCreditoId.HasValue && t.CartaoCredito!.CriadoPor == usuarioId)))
                .Include(t => t.Conta)
                .Include(t => t.CartaoCredito)
                .FirstOrDefaultAsync();

            if (transacao is null) return false;

            _context.Transacoes.Remove(transacao);
            await _context.SaveChangesAsync();
            return true;
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

            return new ResumoFinanceiroDto
            {
                ContaId = contaId,
                TotalReceitas = transacoes.Where(t => t.Tipo == TipoTransacao.Receita).Sum(t => t.Valor),
                TotalDespesas = transacoes.Where(t => t.Tipo == TipoTransacao.Despesa).Sum(t => t.Valor),
            };
        }
    }
}

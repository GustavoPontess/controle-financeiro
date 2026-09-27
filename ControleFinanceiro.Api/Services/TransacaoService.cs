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
                    throw new KeyNotFoundException("Conta não encontrada ou você não tem permissão.");
            }
            else if (transacao.CartaoCreditoId.HasValue)
            {
                var cartao = await _context.CartoesCredito
                    .FirstOrDefaultAsync(c => c.Id == transacao.CartaoCreditoId && c.CriadoPor == usuarioId);
                if (cartao == null)
                    throw new KeyNotFoundException("Cartão não encontrado ou você não tem permissão.");
            }
            else
            {
                throw new ArgumentException("Informe uma conta ou um cartão de crédito.");
            }

            if (transacao.CategoriaId.HasValue)
            {
                // Global (UsuarioId nulo) ou do próprio usuário — nunca de outro.
                var categoria = await _context.Categorias
                    .FirstOrDefaultAsync(c => c.Id == transacao.CategoriaId && (c.UsuarioId == null || c.UsuarioId == usuarioId));

                if (categoria == null)
                    throw new KeyNotFoundException("Categoria não encontrada.");

                if (categoria.Finalidade == Finalidade.Receita && transacao.Tipo == TipoTransacao.Despesa)
                    throw new ArgumentException("Categoria inválida para despesa.");

                if (categoria.Finalidade == Finalidade.Despesa && transacao.Tipo == TipoTransacao.Receita)
                    throw new ArgumentException("Categoria inválida para receita.");
            }

            if (transacao.SubcategoriaId.HasValue)
            {
                var sub = await _context.Subcategorias
                    .FirstOrDefaultAsync(s => s.Id == transacao.SubcategoriaId && (s.UsuarioId == null || s.UsuarioId == usuarioId));
                if (sub == null)
                    throw new KeyNotFoundException("Subcategoria não encontrada.");
                if (transacao.CategoriaId.HasValue && sub.CategoriaId != transacao.CategoriaId)
                    throw new ArgumentException("Subcategoria não pertence à categoria selecionada.");
            }

            if (transacao.Valor <= 0)
                throw new ArgumentException("O valor da transação deve ser positivo.");

            // Data futura só é proibida pra lançamento JÁ efetivado em conta. Previsão
            // (ex.: salário do próximo mês) pode ser futura — é justamente o ponto dela.
            if (!transacao.CartaoCreditoId.HasValue
                && transacao.StatusTransacao == Domain.Enums.StatusTransacao.Executado
                && transacao.Data.Date > DateTime.UtcNow.Date)
                throw new ArgumentException("A data da transação não pode ser futura.");

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
                throw new ArgumentException("Parcelamento requer cartão de crédito.");

            var cartao = await _context.CartoesCredito
                .FirstOrDefaultAsync(c => c.Id == dto.CartaoCreditoId && c.CriadoPor == usuarioId)
                ?? throw new KeyNotFoundException("Cartão não encontrado.");

            if (dto.CategoriaId != Guid.Empty)
                await DonoRecursos.ExigirCategoriaAsync(_context, dto.CategoriaId, usuarioId);
            if (dto.SubcategoriaId.HasValue)
                await DonoRecursos.ExigirSubcategoriaAsync(_context, dto.SubcategoriaId.Value, usuarioId);

            return await _faturaService.CriarParcelamentoAsync(
                cartao.Id,
                dto.CategoriaId == Guid.Empty ? null : (Guid?)dto.CategoriaId,
                dto.Descricao,
                dto.Valor,
                dto.Parcelas!.Value,
                dto.Data,
                usuarioId,
                dto.SubcategoriaId);
        }

        public async Task<DTOs.Common.PagedResult<Transacao>> ListarAsync(
            Guid usuarioId,
            int page = 1,
            int pageSize = 25,
            DateTime? from = null,
            DateTime? to = null,
            Guid? categoriaId = null,
            string? q = null,
            int? tipo = null,
            Guid? contaId = null,
            Guid? cartaoId = null,
            decimal? valorMin = null,
            decimal? valorMax = null,
            int? status = null,
            string? ordenacao = null)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _context.Transacoes
                .Where(t =>
                    (t.ContaId.HasValue && t.Conta!.UsuarioIdProprietario == usuarioId) ||
                    (t.CartaoCreditoId.HasValue && t.CartaoCredito!.CriadoPor == usuarioId))
                .Include(t => t.Conta)
                .Include(t => t.CartaoCredito)
                .Include(t => t.Categoria)
                .AsQueryable();

            // Filtros opcionais aplicados no banco — só assim a paginação serve
            // pra UI: o front pagina o conjunto JÁ filtrado (por mês, categoria
            // etc), em vez de pedir tudo e filtrar no cliente.
            if (from.HasValue) query = query.Where(t => t.Data >= from.Value);
            if (to.HasValue) query = query.Where(t => t.Data < to.Value);
            if (categoriaId.HasValue) query = query.Where(t => t.CategoriaId == categoriaId.Value);
            if (tipo.HasValue) query = query.Where(t => (int)t.Tipo == tipo.Value);
            if (contaId.HasValue) query = query.Where(t => t.ContaId == contaId.Value);
            if (cartaoId.HasValue) query = query.Where(t => t.CartaoCreditoId == cartaoId.Value);
            if (valorMin.HasValue) query = query.Where(t => t.Valor >= valorMin.Value);
            if (valorMax.HasValue) query = query.Where(t => t.Valor <= valorMax.Value);
            // status: previsto (Previsao) vs efetivado (Executado). Cancelado já é
            // excluído pelo global query filter (Ativo).
            if (status.HasValue) query = query.Where(t => (int)t.StatusTransacao == status.Value);
            if (!string.IsNullOrWhiteSpace(q))
            {
                // Busca case-insensitive na descrição. Postgres LIKE é
                // case-SENSITIVE por padrão — por isso baixamos os dois lados pra
                // LOWER() (traduz pra SQL nativo em PG e SQLite). Trim + wildcard.
                var termo = $"%{q.Trim().ToLower()}%";
                query = query.Where(t => EF.Functions.Like(t.Descricao.ToLower(), termo));
            }

            // Ordenação (default: data desc). Empate sempre por Data desc pra estabilidade.
            var ordered = ordenacao switch
            {
                "data_asc"  => query.OrderBy(t => t.Data),
                "valor_desc" => query.OrderByDescending(t => t.Valor).ThenByDescending(t => t.Data),
                "valor_asc"  => query.OrderBy(t => t.Valor).ThenByDescending(t => t.Data),
                _            => query.OrderByDescending(t => t.Data),
            };
            var total = await ordered.CountAsync();
            var items = await ordered
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return new DTOs.Common.PagedResult<Transacao>
            {
                Items = items,
                Total = total,
                Page = page,
                PageSize = pageSize,
            };
        }

        /// <summary>
        /// KPIs agregados (entradas, saídas, saldo) calculados no banco. Exclui
        /// transferência, pagamento de fatura, saldo inicial e soft-deleted —
        /// mesma regra contábil de saldo×P&amp;L (#128). Exato pra qualquer volume.
        /// </summary>
        public async Task<DTOs.Transacao.TransacaoStatsDto> ObterStatsAsync(
            Guid usuarioId,
            DateTime? from = null,
            DateTime? to = null,
            Guid? categoriaId = null)
        {
            var query = _context.Transacoes
                .Where(t =>
                    (t.ContaId.HasValue && t.Conta!.UsuarioIdProprietario == usuarioId) ||
                    (t.CartaoCreditoId.HasValue && t.CartaoCredito!.CriadoPor == usuarioId))
                .Where(t => t.Ativo
                            && t.StatusTransacao == Domain.Enums.StatusTransacao.Executado
                            && !t.EhTransferencia
                            && !t.EhPagamentoFatura
                            && !t.EhSaldoInicial)
                .AsQueryable();

            if (from.HasValue) query = query.Where(t => t.Data >= from.Value);
            if (to.HasValue) query = query.Where(t => t.Data < to.Value);
            if (categoriaId.HasValue) query = query.Where(t => t.CategoriaId == categoriaId.Value);

            var entradas = await query
                .Where(t => t.Tipo == Domain.Enums.TipoTransacao.Receita)
                .SumAsync(t => (decimal?)t.Valor) ?? 0m;
            var saidas = await query
                .Where(t => t.Tipo == Domain.Enums.TipoTransacao.Despesa)
                .SumAsync(t => (decimal?)t.Valor) ?? 0m;
            // Versões "caixa" — excluem UsadoComoCredito. Cards visíveis usam isso
            // pra bater com o Dashboard e com SaldoPeriodo.
            var entradasCaixa = await query
                .Where(t => t.Tipo == Domain.Enums.TipoTransacao.Receita && !t.UsadoComoCredito)
                .SumAsync(t => (decimal?)t.Valor) ?? 0m;
            var saidasCaixa = await query
                .Where(t => t.Tipo == Domain.Enums.TipoTransacao.Despesa && !t.UsadoComoCredito)
                .SumAsync(t => (decimal?)t.Valor) ?? 0m;
            var saldoPeriodo = entradasCaixa - saidasCaixa;
            var qtd = await query.CountAsync();

            return new DTOs.Transacao.TransacaoStatsDto
            {
                Entradas = entradas,
                Saidas = saidas,
                EntradasCaixa = entradasCaixa,
                SaidasCaixa = saidasCaixa,
                SaldoPeriodo = saldoPeriodo,
                QtdTransacoes = qtd,
            };
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

            if (dados.Valor <= 0)
                throw new ArgumentException("O valor da transação deve ser positivo.");

            // Mesma regra do CriarTransacaoAsync: data futura só é proibida pra lançamento
            // JÁ efetivado em CONTA. Previsão (salário do próximo mês) e compra de CRÉDITO
            // pós-datada podem ser futuras — de propósito. O update não altera CartaoCreditoId
            // nem StatusTransacao, então usa o estado atual do registro + a data nova.
            // (Editar qualquer campo desses lançamentos legítimos não pode voltar a dar 400.)
            if (!transacao.CartaoCreditoId.HasValue
                && transacao.StatusTransacao == Domain.Enums.StatusTransacao.Executado
                && dados.Data.Date > DateTime.UtcNow.Date)
                throw new ArgumentException("A data da transação não pode ser futura.");

            // Categoria/subcategoria vêm do cliente: global ou do próprio usuário.
            if (dados.CategoriaId.HasValue)
                await DonoRecursos.ExigirCategoriaAsync(_context, dados.CategoriaId.Value, usuarioId);
            if (dados.SubcategoriaId.HasValue)
                await DonoRecursos.ExigirSubcategoriaAsync(_context, dados.SubcategoriaId.Value, usuarioId);

            transacao.Descricao = dados.Descricao;
            transacao.Valor = dados.Valor;
            transacao.Tipo = dados.Tipo;
            transacao.CategoriaId = dados.CategoriaId;
            transacao.SubcategoriaId = dados.SubcategoriaId;
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

            // Soft delete (entidade financeira: nunca remover fisicamente — preserva
            // histórico e a referência do FinancialEventLog). O filtro global de Transacao
            // exclui a cancelada de toda query, então o saldo calculado se corrige sozinho.
            transacao.Ativo = false;
            transacao.StatusTransacao = StatusTransacao.Cancelado;
            transacao.CanceladoEm = DateTime.UtcNow;
            transacao.MotivoCancelamento = "Transação excluída pelo usuário";
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<ResumoFinanceiroDto> ObterResumoPorContaAsync(Guid contaId, Guid usuarioId)
        {
            var conta = await _context.Contas
                .FirstOrDefaultAsync(c => c.Id == contaId && c.UsuarioIdProprietario == usuarioId);

            if (conta == null)
                throw new KeyNotFoundException("Conta não encontrada.");

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

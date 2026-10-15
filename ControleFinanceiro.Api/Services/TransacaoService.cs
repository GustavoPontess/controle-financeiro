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
        private readonly FinancialEventLogService _eventLog;

        public TransacaoService(AppDbContext context, FaturaService faturaService, FinancialEventLogService eventLog)
        {
            _context = context;
            _faturaService = faturaService;
            _eventLog = eventLog;
        }

        // Compra no cartão compõe o total da fatura: excluir ou baixar o valor dela baixa o total SEM pagamento
        // → reconcilia o estado da fatura (pode virar Paga, coberta pelo já pago) e registra FaturaPagaTotal.
        // Regra de dinheiro do CLAUDE.md; antes só cancelar parcela/parcelamento reconciliava. Não salva.
        // Usa o usuário da REQUISIÇÃO (não o dono do cartão): mantém o filtro de dono da reconciliação valendo
        // mesmo pra dado legado com conta de um e cartão de outro (revisão de segurança do #288, P3).
        private Task ReconciliarFaturaAsync(Transacao transacao, Guid usuarioId, Guid correlationId) =>
            transacao.FaturaId is { } faturaId && transacao.CartaoCreditoId.HasValue
                ? RegrasFinanceiras.ReconciliarFaturasAposCancelamentoAsync(
                    _context, _eventLog, new[] { faturaId }, usuarioId, correlationId, DateTime.UtcNow)
                : Task.CompletedTask;

        // Pagamento de fatura e perna de transferência não se editam por aqui: mudar só esta linha desemparelha o
        // outro lado (ValorPago da fatura / a outra perna). Antes passava: excluir o pagamento devolvia o dinheiro
        // à conta com a fatura seguindo paga (dinheiro do nada). Revisão de segurança do #288 (P1).
        internal static void ExigirEditavel(Transacao transacao)
        {
            if (transacao.EhPagamentoFatura)
                throw new InvalidOperationException(
                    "Pagamento de fatura não pode ser editado nem excluído por aqui — ele está ligado ao que a fatura já recebeu. Para desfazer, use Estornar pagamento.");
            if (transacao.EhTransferencia)
                throw new InvalidOperationException(
                    "Transferência não se edita por aqui — exclua e lance de novo.");
        }

        /// <summary>
        /// Cria uma transação simples (à vista) e, se for de crédito, associa automaticamente
        /// à fatura correta. Para parcelamento, use CriarParcelamentoAsync.
        /// </summary>
        public const string OperacaoCriarTransacao = "CriarTransacao";
        public const string OperacaoCriarParcelamento = "CriarParcelamento";

        // idempotencyKey (opcional): com chave, repetir o pedido (duplo clique, retry de rede) devolve a transação
        // original em vez de lançar outra; a mesma chave com outros dados → 409.
        public async Task<Transacao> CriarTransacaoAsync(Transacao transacao, Guid usuarioId, string? idempotencyKey = null)
        {
            Idempotencia.ExigirTamanho(idempotencyKey);
            if (!string.IsNullOrWhiteSpace(idempotencyKey))
            {
                var anterior = await BuscarCriacaoPorChaveAsync(usuarioId, idempotencyKey, transacao);
                if (anterior != null)
                    return anterior;
            }

            // Lançamento é de uma conta OU de um cartão (mesma regra da Recorrente). Com os dois, o cartão
            // passava sem conferir o dono e o lançamento caía na lista do cartão de outro usuário.
            if (transacao.ContaId.HasValue && transacao.CartaoCreditoId.HasValue)
                throw new ArgumentException("Informe uma conta ou um cartão de crédito, não os dois.");
            if (transacao.ContaId.HasValue)
                await DonoRecursos.ExigirContaAsync(_context, transacao.ContaId.Value, usuarioId);
            else if (transacao.CartaoCreditoId.HasValue)
                await DonoRecursos.ExigirCartaoAsync(_context, transacao.CartaoCreditoId.Value, usuarioId);
            else
                throw new ArgumentException("Informe uma conta ou um cartão de crédito.");

            // Crédito só existe no cartão. Em conta, a flag tirava o lançamento do Entrou/Saiu, mas ele
            // seguia mexendo no saldo (e não estava em fatura nenhuma).
            if (transacao.UsadoComoCredito && !transacao.CartaoCreditoId.HasValue)
                throw new ArgumentException("Compra no crédito precisa de um cartão.");

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
                && transacao.Data > DateOnly.FromDateTime(DateTime.UtcNow))
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
            // Chave no MESMO SaveChanges da transação: a 2ª requisição concorrente estoura o índice e vira replay.
            if (!string.IsNullOrWhiteSpace(idempotencyKey))
                _context.RegistrosIdempotencia.Add(Idempotencia.Novo(usuarioId, OperacaoCriarTransacao, idempotencyKey, transacao.Id));
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (!string.IsNullOrWhiteSpace(idempotencyKey) && Idempotencia.EhViolacaoDeUnicidade(ex))
            {
                _context.ChangeTracker.Clear();
                var vencedora = await BuscarCriacaoPorChaveAsync(usuarioId, idempotencyKey!, transacao);
                if (vencedora != null)
                    return vencedora;
                throw;
            }

            return transacao;
        }

        /// <summary>
        /// Transação já criada com esta chave (replay) ou null se a chave é nova. 409 se a chave já criou algo que
        /// não existe mais (excluída depois) ou um pedido com outros dados.
        /// </summary>
        private async Task<Transacao?> BuscarCriacaoPorChaveAsync(Guid usuarioId, string chave, Transacao pedido)
        {
            var registro = await Idempotencia.BuscarAsync(_context, usuarioId, OperacaoCriarTransacao, chave);
            if (registro == null)
                return null;
            var original = await _context.Transacoes
                .Include(t => t.Conta)
                .Include(t => t.CartaoCredito)
                .FirstOrDefaultAsync(t => t.Id == registro.ReferenciaId && t.CriadoPor == usuarioId)
                ?? throw new InvalidOperationException(Idempotencia.MensagemChaveConsumida);
            if (original.Descricao != pedido.Descricao || original.Valor != pedido.Valor || original.Data != pedido.Data
                || original.Tipo != pedido.Tipo || original.ContaId != pedido.ContaId || original.CartaoCreditoId != pedido.CartaoCreditoId)
                throw new InvalidOperationException(Idempotencia.MensagemChaveComOutrosDados);
            return original;
        }

        /// <summary>
        /// Cria um parcelamento: N transações distribuídas em N faturas consecutivas.
        /// </summary>
        public async Task<List<Transacao>> CriarParcelamentoAsync(CriarTransacaoDto dto, Guid usuarioId, string? idempotencyKey = null)
        {
            Idempotencia.ExigirTamanho(idempotencyKey);
            if (!string.IsNullOrWhiteSpace(idempotencyKey))
            {
                var anterior = await BuscarParcelamentoPorChaveAsync(usuarioId, idempotencyKey, dto);
                if (anterior != null)
                    return anterior;
            }
            if (!dto.CartaoCreditoId.HasValue)
                throw new ArgumentException("Parcelamento requer cartão de crédito.");

            var cartao = await _context.CartoesCredito
                .FirstOrDefaultAsync(c => c.Id == dto.CartaoCreditoId && c.CriadoPor == usuarioId)
                ?? throw new KeyNotFoundException("Cartão não encontrado.");

            if (dto.CategoriaId != Guid.Empty)
                await DonoRecursos.ExigirCategoriaAsync(_context, dto.CategoriaId, usuarioId);
            if (dto.SubcategoriaId.HasValue)
                await DonoRecursos.ExigirSubcategoriaAsync(_context, dto.SubcategoriaId.Value, usuarioId);

            // Com chave, as parcelas e o registro da chave vão no mesmo commit (ou nada).
            var proprioTx = !string.IsNullOrWhiteSpace(idempotencyKey) && _context.Database.CurrentTransaction is null;
            await using var tx = proprioTx ? await _context.Database.BeginTransactionAsync() : null;
            try
            {
                var parcelas = await _faturaService.CriarParcelamentoAsync(
                    cartao.Id,
                    dto.CategoriaId == Guid.Empty ? null : (Guid?)dto.CategoriaId,
                    dto.Descricao,
                    dto.Valor,
                    dto.Parcelas!.Value,
                    dto.Data,
                    usuarioId,
                    dto.SubcategoriaId);
                if (!string.IsNullOrWhiteSpace(idempotencyKey))
                {
                    _context.RegistrosIdempotencia.Add(Idempotencia.Novo(usuarioId, OperacaoCriarParcelamento, idempotencyKey, parcelas[0].Id));
                    await _context.SaveChangesAsync();
                }
                if (tx != null)
                    await tx.CommitAsync();
                return parcelas;
            }
            catch (DbUpdateException ex) when (!string.IsNullOrWhiteSpace(idempotencyKey) && Idempotencia.EhViolacaoDeUnicidade(ex))
            {
                if (tx != null)
                    await tx.RollbackAsync();
                _context.ChangeTracker.Clear();
                var vencedor = await BuscarParcelamentoPorChaveAsync(usuarioId, idempotencyKey!, dto);
                if (vencedor != null)
                    return vencedor;
                throw;
            }
            catch
            {
                if (tx != null)
                    await tx.RollbackAsync();
                throw;
            }
        }

        /// <summary>
        /// Parcelado já criado com esta chave (replay) ou null. O crédito parcelado deste fluxo é o antigo: N
        /// transações soltas, sem entidade de grupo — a chave referencia a 1ª parcela e o grupo é remontado pelo
        /// nome fixo "X (i/N)", cartão e datas mensais (exato, não aproximado). Parcela que sumiu → 409.
        /// </summary>
        private async Task<List<Transacao>?> BuscarParcelamentoPorChaveAsync(Guid usuarioId, string chave, CriarTransacaoDto dto)
        {
            var registro = await Idempotencia.BuscarAsync(_context, usuarioId, OperacaoCriarParcelamento, chave);
            if (registro == null)
                return null;
            var primeira = await _context.Transacoes.AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == registro.ReferenciaId && t.CriadoPor == usuarioId)
                ?? throw new InvalidOperationException(Idempotencia.MensagemChaveConsumida);
            var n = dto.Parcelas ?? 0;
            if (primeira.CartaoCreditoId != dto.CartaoCreditoId || primeira.Data != dto.Data
                || primeira.Descricao != $"{dto.Descricao} (1/{n})")
                throw new InvalidOperationException(Idempotencia.MensagemChaveComOutrosDados);
            var parcelas = new List<Transacao>();
            for (var i = 1; i <= n; i++)
            {
                var descricao = $"{dto.Descricao} ({i}/{n})";
                var data = dto.Data.AddMonths(i - 1);
                var parcela = await _context.Transacoes
                    .Include(t => t.Conta)
                    .Include(t => t.CartaoCredito)
                    .FirstOrDefaultAsync(t => t.CriadoPor == usuarioId && t.CartaoCreditoId == dto.CartaoCreditoId
                                              && t.Descricao == descricao && t.Data == data)
                    ?? throw new InvalidOperationException(Idempotencia.MensagemChaveConsumida);
                parcelas.Add(parcela);
            }
            if (parcelas.Sum(p => p.Valor) != dto.Valor)
                throw new InvalidOperationException(Idempotencia.MensagemChaveComOutrosDados);
            return parcelas;
        }

        public async Task<DTOs.Common.PagedResult<Transacao>> ListarAsync(
            Guid usuarioId,
            int page = 1,
            int pageSize = 25,
            DateOnly? from = null,
            DateOnly? to = null,
            Guid? categoriaId = null,
            string? q = null,
            int? tipo = null,
            Guid? contaId = null,
            Guid? cartaoId = null,
            decimal? valorMin = null,
            decimal? valorMax = null,
            int? status = null,
            string? ordenacao = null,
            bool apenasCaixa = false,
            int? meioPagamento = null,
            string? natureza = null)
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

            // Escopo "extrato de caixa": só o que mexe no saldo da conta. Compra
            // no crédito tem só CartaoCreditoId (vive na fatura/aba Cartão) → cai
            // fora. Pagamento de fatura e pernas de transferência têm ContaId →
            // ficam. Saldo inicial é patrimônio de abertura, não movimento → fora.
            if (apenasCaixa)
                query = query.Where(t => t.ContaId.HasValue && !t.EhSaldoInicial);

            // Filtros opcionais aplicados no banco — só assim a paginação serve
            // pra UI: o front pagina o conjunto JÁ filtrado (por mês, categoria
            // etc), em vez de pedir tudo e filtrar no cliente.
            if (from.HasValue) query = query.Where(t => t.Data >= from.Value);
            if (to.HasValue) query = query.Where(t => t.Data < to.Value);
            if (categoriaId.HasValue) query = query.Where(t => t.CategoriaId == categoriaId.Value);
            if (tipo.HasValue) query = query.Where(t => (int)t.Tipo == tipo.Value);
            if (contaId.HasValue) query = query.Where(t => t.ContaId == contaId.Value);
            if (cartaoId.HasValue) query = query.Where(t => t.CartaoCreditoId == cartaoId.Value);
            if (meioPagamento.HasValue) query = query.Where(t => t.MeioPagamento != null && (int)t.MeioPagamento == meioPagamento.Value);
            // Natureza do lançamento — bate 1:1 com a coluna do extrato (entrada/saída
            // de conta, transferência entre contas, pagamento de fatura).
            query = natureza switch
            {
                "entrada" => query.Where(t => t.Tipo == Domain.Enums.TipoTransacao.Receita && !t.EhTransferencia && !t.EhPagamentoFatura && !t.EhSaldoInicial),
                "saida" => query.Where(t => t.Tipo == Domain.Enums.TipoTransacao.Despesa && !t.EhTransferencia && !t.EhPagamentoFatura),
                "transferencia" => query.Where(t => t.EhTransferencia),
                "fatura" => query.Where(t => t.EhPagamentoFatura),
                _ => query,
            };
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

            // Ordenação (default: data desc). Dentro do dia: quem tem hora vem antes de quem não tem —
            // sem hora conta como 00:00 no DESC e como 23:59 no ASC (COALESCE), senão o Postgres põe
            // NULL primeiro no DESC e o lançamento sem hora pulava pro topo do dia. O empate (mesma
            // hora, ou os dois sem hora — caso do extrato importado) sai pela ordem de criação, que
            // preserva a ordem do extrato. Sem isso a ordem dentro do dia era aleatória.
            var semHoraNoFimDesc = TimeOnly.MinValue;
            var semHoraNoFimAsc = TimeOnly.MaxValue;
            var ordered = ordenacao switch
            {
                "data_asc"  => query.OrderBy(t => t.Data).ThenBy(t => t.Hora ?? semHoraNoFimAsc).ThenBy(t => t.CriadoEm),
                "valor_desc" => query.OrderByDescending(t => t.Valor).ThenByDescending(t => t.Data).ThenByDescending(t => t.Hora ?? semHoraNoFimDesc).ThenByDescending(t => t.CriadoEm),
                "valor_asc"  => query.OrderBy(t => t.Valor).ThenByDescending(t => t.Data).ThenByDescending(t => t.Hora ?? semHoraNoFimDesc).ThenByDescending(t => t.CriadoEm),
                _            => query.OrderByDescending(t => t.Data).ThenByDescending(t => t.Hora ?? semHoraNoFimDesc).ThenByDescending(t => t.CriadoEm),
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
        /// KPIs agregados (entradas, saídas, saldo) calculados no banco. Exclui soft-deleted e o que
        /// não entra no resultado (<see cref="RegrasFinanceiras.EntraNoResultado"/>: transferência,
        /// pagamento de fatura, saldo inicial, ajuste de reconciliação, Pix no Crédito) — mesma regra
        /// contábil de saldo×P&amp;L (#128). Exato pra qualquer volume.
        /// </summary>
        public async Task<DTOs.Transacao.TransacaoStatsDto> ObterStatsAsync(
            Guid usuarioId,
            DateOnly? from = null,
            DateOnly? to = null,
            Guid? categoriaId = null)
        {
            var query = _context.Transacoes
                .Where(t =>
                    (t.ContaId.HasValue && t.Conta!.UsuarioIdProprietario == usuarioId) ||
                    (t.CartaoCreditoId.HasValue && t.CartaoCredito!.CriadoPor == usuarioId))
                .Where(t => t.Ativo
                            && t.StatusTransacao == Domain.Enums.StatusTransacao.Executado)
                .Where(RegrasFinanceiras.EntraNoResultado)
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

        /// <summary>
        /// Edita o lançamento no lugar. Além dos campos de sempre, troca conta/cartão (<paramref name="dados"/> com
        /// ContaId OU CartaoCreditoId; os dois nulos = mantém a origem) e o status (<paramref name="efetivado"/>;
        /// null = mantém). Cartão = compra no crédito: entra na fatura do período da data e sai da antiga (que é
        /// reconciliada como num cancelamento); conta = sai da fatura. Parcela de parcelamento não muda de origem.
        /// </summary>
        public async Task<bool> AtualizarAsync(Guid id, Transacao dados, Guid usuarioId, bool? efetivado = null)
        {
            var transacao = await _context.Transacoes
                .Where(t => t.Id == id && (
                    (t.ContaId.HasValue && t.Conta!.UsuarioIdProprietario == usuarioId) ||
                    (t.CartaoCreditoId.HasValue && t.CartaoCredito!.CriadoPor == usuarioId)))
                .Include(t => t.Conta)
                .Include(t => t.CartaoCredito)
                .FirstOrDefaultAsync();

            if (transacao is null) return false;
            ExigirEditavel(transacao);

            if (dados.Valor <= 0)
                throw new ArgumentException("O valor da transação deve ser positivo.");

            // Origem nova (conta OU cartão). Sem nenhuma das duas, fica a atual — o app atual manda só os campos de sempre.
            if (dados.ContaId.HasValue && dados.CartaoCreditoId.HasValue)
                throw new ArgumentException("Informe uma conta ou um cartão de crédito, não os dois.");
            var trocaOrigem = (dados.ContaId.HasValue || dados.CartaoCreditoId.HasValue)
                && (dados.ContaId != transacao.ContaId || dados.CartaoCreditoId != transacao.CartaoCreditoId);
            var contaNova = trocaOrigem ? dados.ContaId : transacao.ContaId;
            var cartaoNovo = trocaOrigem ? dados.CartaoCreditoId : transacao.CartaoCreditoId;
            if (trocaOrigem)
            {
                if (transacao.ParcelamentoId != null || transacao.ParcelaTransacaoId != null)
                    throw new ArgumentException("Parcela de parcelamento não muda de conta nem de cartão. Cancele o parcelamento e lance de novo.");
                if (transacao.EhSaldoInicial || transacao.EhAjusteReconciliacao)
                    throw new ArgumentException("Saldo inicial e ajuste de reconciliação não mudam de conta.");
                if (contaNova.HasValue)
                    await DonoRecursos.ExigirContaAsync(_context, contaNova.Value, usuarioId);
                else
                    await DonoRecursos.ExigirCartaoAsync(_context, cartaoNovo!.Value, usuarioId);
            }
            var creditoNovo = cartaoNovo.HasValue;
            // No cartão não existe previsão: a compra vai pra fatura.
            var statusNovo = creditoNovo ? StatusTransacao.Executado
                : efetivado is { } ef ? (ef ? StatusTransacao.Executado : StatusTransacao.Previsao)
                : transacao.StatusTransacao;

            // Mesma regra do CriarTransacaoAsync: data futura só é proibida pra lançamento efetivado em CONTA.
            // Previsão (salário do próximo mês) e compra de crédito pós-datada podem ser futuras — de propósito.
            if (!creditoNovo && statusNovo == StatusTransacao.Executado
                && dados.Data > DateOnly.FromDateTime(DateTime.UtcNow))
                throw new ArgumentException("A data da transação não pode ser futura.");

            // Categoria/subcategoria vêm do cliente: global ou do próprio usuário.
            if (dados.CategoriaId.HasValue)
                await DonoRecursos.ExigirCategoriaAsync(_context, dados.CategoriaId.Value, usuarioId);
            if (dados.SubcategoriaId.HasValue)
                await DonoRecursos.ExigirSubcategoriaAsync(_context, dados.SubcategoriaId.Value, usuarioId);

            // Fatura de destino: no mesmo cartão a compra fica na fatura atual enquanto a data nova cai no período
            // dela (dado antigo com período fora do padrão não é mexido à toa); fora do período, ou em outro cartão,
            // vai pra fatura do período da data (ObterOuCriarFaturaAsync salva — resolvido ANTES de alterar os campos).
            var dataAntes = transacao.Data;
            Guid? faturaAnteriorId = transacao.UsadoComoCredito ? transacao.FaturaId : null;
            Guid? faturaNovaId = null;
            if (creditoNovo)
            {
                var mesmoCartao = transacao.UsadoComoCredito && cartaoNovo == transacao.CartaoCreditoId;
                if (mesmoCartao && transacao.FaturaId is { } faturaAtualId)
                {
                    faturaNovaId = faturaAtualId;
                    if (dados.Data != transacao.Data)
                    {
                        var atual = await _context.Faturas.AsNoTracking().FirstOrDefaultAsync(f => f.Id == faturaAtualId);
                        var dia = dados.Data.ToDateTime(TimeOnly.MinValue);
                        if (atual is null || dia < atual.DataInicio || dia >= atual.DataFechamento)
                            faturaNovaId = (await _faturaService.ObterOuCriarFaturaAsync(cartaoNovo!.Value, dados.Data, usuarioId)).Id;
                    }
                }
                else
                    faturaNovaId = (await _faturaService.ObterOuCriarFaturaAsync(cartaoNovo!.Value, dados.Data, usuarioId)).Id;
            }
            var trocaFatura = faturaAnteriorId != faturaNovaId;

            var valorAntes = transacao.Valor;
            var statusAntes = transacao.StatusTransacao;
            var contaAntes = transacao.ContaId;
            var cartaoAntes = transacao.CartaoCreditoId;
            transacao.Descricao = dados.Descricao;
            transacao.Valor = dados.Valor;
            transacao.Tipo = dados.Tipo;
            transacao.CategoriaId = dados.CategoriaId;
            transacao.SubcategoriaId = dados.SubcategoriaId;
            transacao.Data = dados.Data;
            transacao.Hora = dados.Hora;
            transacao.ContaId = contaNova;
            transacao.CartaoCreditoId = cartaoNovo;
            transacao.UsadoComoCredito = creditoNovo;
            transacao.MeioPagamento = creditoNovo ? Domain.Enums.MeioPagamento.Credito : dados.MeioPagamento;
            transacao.StatusTransacao = statusNovo;
            transacao.FaturaId = faturaNovaId;
            // Ocorrência de conta fixa editada à mão (valor, dia…): alterar a conta fixa e o realinhamento
            // não desfazem mais a edição. A competência (o mês que ela cobre) não muda com a data.
            if (transacao.RecorrenteOrigemId != null)
                transacao.EditadaPeloUsuario = true;

            var correlationId = Guid.NewGuid();
            // Troca de fatura: grava a compra no destino ANTES de reconciliar a antiga, numa transação (atômico).
            // Com a troca só em memória, o Include da antiga ainda traz a compra e o total dela não baixava.
            // Dentro de uma transação de quem chamou (edição completa), participa dela.
            var proprioTx = trocaFatura && _context.Database.CurrentTransaction is null;
            await using var tx = proprioTx ? await _context.Database.BeginTransactionAsync() : null;
            if (trocaFatura)
            {
                await _context.SaveChangesAsync();
                // A fatura de onde a compra saiu perdeu o valor sem pagamento: reconcilia como num cancelamento
                // (pode ficar coberta pelo já pago e virar Pago). A que recebeu passa a dever mais pelo restante.
                if (faturaAnteriorId is { } faturaAnterior)
                    await RegrasFinanceiras.ReconciliarFaturasAposCancelamentoAsync(
                        _context, _eventLog, new[] { faturaAnterior }, usuarioId, correlationId, DateTime.UtcNow);
            }
            else if (dados.Valor < valorAntes)
                await ReconciliarFaturaAsync(transacao, usuarioId, correlationId);
            _eventLog.Registrar(
                usuarioId: usuarioId,
                tipo: FinancialEventType.TransacaoAtualizada,
                entidade: "Transacao",
                entidadeId: transacao.Id,
                correlationId: correlationId,
                origemAcao: "API",
                valorAntes: valorAntes,
                valorDepois: transacao.Valor,
                payload: new
                {
                    faturaId = transacao.FaturaId,
                    faturaAnteriorId,
                    dataAntes = dataAntes.ToString("yyyy-MM-dd"),
                    dataDepois = transacao.Data.ToString("yyyy-MM-dd"),
                    contaAntes,
                    contaDepois = transacao.ContaId,
                    cartaoAntes,
                    cartaoDepois = transacao.CartaoCreditoId,
                    statusAntes = statusAntes.ToString(),
                    statusDepois = transacao.StatusTransacao.ToString(),
                });

            await _context.SaveChangesAsync();
            if (tx != null)
                await tx.CommitAsync();
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

            if (transacao.EhPagamentoFatura)
                ExigirEditavel(transacao); // recusa (409) — ver ExigirEditavel

            // Perna de transferência: exclui a transferência inteira (as DUAS pernas), não só a clicada.
            if (transacao.EhTransferencia)
            {
                var transferencia = await _context.Transferencias.FirstOrDefaultAsync(tr =>
                    tr.CriadoPor == usuarioId && (tr.TransacaoOrigemId == transacao.Id || tr.TransacaoDestinoId == transacao.Id));
                if (transferencia != null)
                {
                    await TransferenciaService.CancelarComAsPernasAsync(_context, transferencia);
                    _eventLog.Registrar(
                        usuarioId: usuarioId,
                        tipo: FinancialEventType.TransacaoCancelada,
                        entidade: "Transferencia",
                        entidadeId: transferencia.Id,
                        correlationId: Guid.NewGuid(),
                        origemAcao: "API",
                        valorAntes: transferencia.Valor,
                        valorDepois: 0m,
                        payload: new { motivo = "Transferência excluída", transacaoClicada = transacao.Id });
                    await _context.SaveChangesAsync();
                    return true;
                }
                // Perna sem o registro de transferência (dado antigo): segue como lançamento avulso.
            }

            // Soft delete (entidade financeira: nunca remover fisicamente — preserva
            // histórico e a referência do FinancialEventLog). O filtro global de Transacao
            // exclui a cancelada de toda query, então o saldo calculado se corrige sozinho.
            transacao.Ativo = false;
            transacao.StatusTransacao = StatusTransacao.Cancelado;
            transacao.CanceladoEm = DateTime.UtcNow;
            transacao.MotivoCancelamento = "Transação excluída pelo usuário";

            var correlationId = Guid.NewGuid();
            await ReconciliarFaturaAsync(transacao, usuarioId, correlationId);
            _eventLog.Registrar(
                usuarioId: usuarioId,
                tipo: FinancialEventType.TransacaoCancelada,
                entidade: "Transacao",
                entidadeId: transacao.Id,
                correlationId: correlationId,
                origemAcao: "API",
                valorAntes: transacao.Valor,
                valorDepois: 0m,
                payload: new { motivo = transacao.MotivoCancelamento, faturaId = transacao.FaturaId });

            await _context.SaveChangesAsync();
            return true;
        }

        /// <summary>
        /// Entradas, saídas e saldo REAL da conta — mesma regra (e mesmo número) da tela de contas e
        /// do dashboard. Antes somava também as previsões: o método é anterior ao StatusTransacao e
        /// nunca foi atualizado, então o "Saldo" daqui divergia do saldo real sem ninguém querer.
        /// Saldo projetado (com previsões), se um dia for preciso, ganha função com nome próprio.
        /// </summary>
        public async Task<ResumoFinanceiroDto> ObterResumoPorContaAsync(Guid contaId, Guid usuarioId)
        {
            var conta = await _context.Contas
                .FirstOrDefaultAsync(c => c.Id == contaId && c.UsuarioIdProprietario == usuarioId);

            if (conta == null)
                throw new KeyNotFoundException("Conta não encontrada.");

            var movimento = await RegrasFinanceiras.SaldoDaContaAsync(_context, contaId, usuarioId);

            return new ResumoFinanceiroDto
            {
                ContaId = contaId,
                TotalReceitas = movimento.Receitas,
                TotalDespesas = movimento.Despesas,
            };
        }
    }
}

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
                    "Pagamento de fatura não pode ser editado nem excluído por aqui: ele está ligado ao que a fatura já recebeu. Para desfazer, use Estornar pagamento.");
            if (transacao.EhTransferencia)
                throw new InvalidOperationException(
                    "Transferência não se edita por aqui. Exclua e lance de novo.");
            if (transacao.EhAcerto)
                throw new InvalidOperationException(
                    "Esse lançamento é dinheiro que passou entre vocês na família. Pra desfazer, use Desfazer em Entre vocês.");
        }

        /// <summary>
        /// Cria uma transação simples (à vista) e, se for de crédito, associa automaticamente
        /// à fatura correta. Compra parcelada é um parcelamento de verdade:
        /// <see cref="ParcelamentoService.CriarDoLancamentoAsync"/>.
        /// </summary>
        public const string OperacaoCriarTransacao = "CriarTransacao";

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
                await DonoRecursos.ExigirContaAbertaAsync(_context, transacao.ContaId.Value, usuarioId);
            else if (transacao.CartaoCreditoId.HasValue)
                await DonoRecursos.ExigirCartaoAsync(_context, transacao.CartaoCreditoId.Value, usuarioId);
            else
                throw new ArgumentException("Informe uma conta ou um cartão de crédito.");

            // Crédito só existe no cartão. Em conta, a flag tirava o lançamento do Entrou/Saiu, mas ele
            // seguia mexendo no saldo (e não estava em fatura nenhuma).
            if (transacao.UsadoComoCredito && !transacao.CartaoCreditoId.HasValue)
                throw new ArgumentException("Compra no crédito precisa de um cartão.");
            // E no cartão é sempre crédito (débito é na conta, com a forma Débito), a mesma regra da edição. Sem a
            // flag, a compra ficava sem conta e sem fatura: sumia do saldo e da fatura e escapava da trava de limite.
            if (transacao.CartaoCreditoId.HasValue)
            {
                transacao.UsadoComoCredito = true;
                transacao.MeioPagamento = MeioPagamento.Credito;
            }

            if (transacao.CategoriaId.HasValue)
            {
                // Global (UsuarioId nulo) ou do próprio usuário — nunca de outro.
                var categoria = await _context.Categorias
                    .FirstOrDefaultAsync(c => c.Id == transacao.CategoriaId && (c.UsuarioId == null || c.UsuarioId == usuarioId));

                if (categoria == null)
                    throw new KeyNotFoundException("Categoria não encontrada.");

                // Investimento aceita os dois: aporte sai (despesa), resgate volta (receita).
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
                && transacao.Data > HorarioBrasil.Hoje())
                throw new ArgumentException("A data da transação não pode ser futura.");

            // Compra no cartão só entra se o limite disponível cobre (mesma trava da compra parcelada).
            if (transacao.UsadoComoCredito && transacao.CartaoCreditoId.HasValue
                && transacao.Tipo == TipoTransacao.Despesa && transacao.StatusTransacao == StatusTransacao.Executado)
                await RegrasFinanceiras.ExigirLimiteDisponivelAsync(_context, transacao.CartaoCreditoId.Value, usuarioId, transacao.Valor);

            // Transação de crédito → associar à fatura correspondente (invariante 2)
            if (transacao.UsadoComoCredito && transacao.CartaoCreditoId.HasValue)
            {
                var fatura = await _faturaService.ObterOuCriarFaturaAsync(
                    transacao.CartaoCreditoId.Value, transacao.Data, usuarioId);
                transacao.FaturaId = fatura.Id;
            }

            transacao.CriadoPor = usuarioId;
            // Conta/cartão da casa: a despesa já nasce dividida com a família (regra única, também no extrato).
            await new RateioService(_context).DividirSeForDaCasaAsync(transacao);
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

            var query = TransacoesFiltradas(usuarioId, from, to, categoriaId, q, tipo, contaId, cartaoId,
                    valorMin, valorMax, status, apenasCaixa, meioPagamento, natureza)
                .Include(t => t.Conta)
                .Include(t => t.CartaoCredito)
                .Include(t => t.Categoria);

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

        /// <summary>Uma linha da visão Gastos: um lançamento OU uma compra parcelada (o parcelamento inteiro).</summary>
        public sealed record LinhaDeGasto(Transacao? Transacao, Parcelamento? Parcelamento);

        /// <summary>
        /// Visão "Gastos" de Transações (regime de competência, como o "Todos os lançamentos" do Organizze): o que a
        /// pessoa gastou, na data em que gastou, em conta e no cartão. Despesa que entra no resultado
        /// (<see cref="RegrasFinanceiras.EntraNoResultado"/>: fora pagamento de fatura e transferência, senão o
        /// cartão contaria duas vezes) + cada compra parcelada UMA vez, na data da compra, com o total (as parcelas
        /// moram nas faturas). Mesmos filtros da visão Saldo; busca, filtro, ordem e página no banco (UNION ALL).
        /// </summary>
        public async Task<DTOs.Common.PagedResult<LinhaDeGasto>> ListarGastosAsync(
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
            int? meioPagamento = null,
            string? natureza = null)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var uniao = LinhasDeGasto(usuarioId, from, to, categoriaId, q, tipo, contaId, cartaoId, valorMin, valorMax, status,
                meioPagamento, natureza);

            // Mesma ordem da visão Saldo (sem hora: 00:00 no DESC, 23:59 no ASC; empate pela criação).
            var semHoraNoFimDesc = TimeOnly.MinValue;
            var semHoraNoFimAsc = TimeOnly.MaxValue;
            var ordenada = ordenacao switch
            {
                "data_asc"  => uniao.OrderBy(l => l.Data).ThenBy(l => l.Hora ?? semHoraNoFimAsc).ThenBy(l => l.CriadoEm),
                "valor_desc" => uniao.OrderByDescending(l => l.Valor).ThenByDescending(l => l.Data).ThenByDescending(l => l.Hora ?? semHoraNoFimDesc).ThenByDescending(l => l.CriadoEm),
                "valor_asc"  => uniao.OrderBy(l => l.Valor).ThenByDescending(l => l.Data).ThenByDescending(l => l.Hora ?? semHoraNoFimDesc).ThenByDescending(l => l.CriadoEm),
                _            => uniao.OrderByDescending(l => l.Data).ThenByDescending(l => l.Hora ?? semHoraNoFimDesc).ThenByDescending(l => l.CriadoEm),
            };
            var total = await uniao.CountAsync();
            var pagina = await ordenada.Skip((page - 1) * pageSize).Take(pageSize)
                .Select(l => new { l.Id, l.EhParcelamento }).ToListAsync();

            // A página traz só as chaves; os registros vêm em duas consultas e voltam na ordem da página.
            var idsT = pagina.Where(l => !l.EhParcelamento).Select(l => l.Id).ToList();
            var idsP = pagina.Where(l => l.EhParcelamento).Select(l => l.Id).ToList();
            var transacoes = await _context.Transacoes
                .Where(t => idsT.Contains(t.Id))
                .Include(t => t.Conta).Include(t => t.CartaoCredito).Include(t => t.Categoria)
                .ToDictionaryAsync(t => t.Id);
            var compradas = await _context.Parcelamentos
                .Where(p => idsP.Contains(p.Id))
                .Include(p => p.CartaoCredito)
                .ToDictionaryAsync(p => p.Id);

            return new DTOs.Common.PagedResult<LinhaDeGasto>
            {
                Items = pagina.Select(l => l.EhParcelamento
                    ? new LinhaDeGasto(null, compradas[l.Id])
                    : new LinhaDeGasto(transacoes[l.Id], null)).ToList(),
                Total = total,
                Page = page,
                PageSize = pageSize,
            };
        }

        /// <summary>
        /// O topo da visão Gastos (decisão do Gustavo, 2026-10-21: o topo muda conforme a visão): o total do que a
        /// lista mostra, com os MESMOS filtros e a mesma regra (<see cref="LinhasDeGasto"/>), e quanto disso foi em
        /// conta e quanto no cartão (compra parcelada pelo total). Somado no banco.
        /// </summary>
        public async Task<ResumoGastosDto> ResumirGastosAsync(
            Guid usuarioId, DateOnly? from = null, DateOnly? to = null, Guid? categoriaId = null, string? q = null,
            int? tipo = null, Guid? contaId = null, Guid? cartaoId = null, decimal? valorMin = null, decimal? valorMax = null,
            int? status = null, int? meioPagamento = null, string? natureza = null)
        {
            var linhas = LinhasDeGasto(usuarioId, from, to, categoriaId, q, tipo, contaId, cartaoId, valorMin, valorMax, status,
                meioPagamento, natureza);
            var noCartao = await linhas.Where(l => l.NoCartao).SumAsync(l => l.Valor);
            var emConta = await linhas.Where(l => !l.NoCartao).SumAsync(l => l.Valor);
            return new ResumoGastosDto(emConta + noCartao, emConta, noCartao);
        }

        /// <summary>
        /// As linhas da visão Gastos (regra única da lista e do resumo): despesa que entra no resultado, em conta ou
        /// à vista no cartão, e cada compra parcelada UMA vez, pelo total, na data da compra. UNION ALL no banco.
        /// </summary>
        private IQueryable<ChaveDeLinha> LinhasDeGasto(
            Guid usuarioId, DateOnly? from, DateOnly? to, Guid? categoriaId, string? q, int? tipo, Guid? contaId,
            Guid? cartaoId, decimal? valorMin, decimal? valorMax, int? status, int? meioPagamento, string? natureza)
        {
            var lancamentos = TransacoesFiltradas(usuarioId, from, to, categoriaId, q, tipo, contaId, cartaoId,
                    valorMin, valorMax, status, apenasCaixa: false, meioPagamento, natureza)
                .Where(t => t.Tipo == TipoTransacao.Despesa)
                .Where(RegrasFinanceiras.EntraNoResultado)
                .Select(t => new ChaveDeLinha
                {
                    Id = t.Id, EhParcelamento = false, Data = t.Data, Hora = t.Hora, CriadoEm = t.CriadoEm, Valor = t.Valor,
                    NoCartao = t.CartaoCreditoId != null,
                });

            // Compra parcelada: só despesa, só no cartão, sempre efetivada, meio Crédito.
            var semParcelamento = (tipo.HasValue && tipo.Value != (int)TipoTransacao.Despesa)
                || contaId.HasValue
                || (status.HasValue && status.Value != (int)StatusTransacao.Executado)
                || (meioPagamento.HasValue && meioPagamento.Value != (int)MeioPagamento.Credito)
                || (!string.IsNullOrEmpty(natureza) && natureza != "saida");
            var parcelamentos = _context.Parcelamentos
                .Where(p => p.CriadoPor == usuarioId && p.CartaoCredito!.CriadoPor == usuarioId && p.Ativo
                            && p.Tipo != TipoParcelamento.Recorrente && !semParcelamento);
            if (from.HasValue) { var de = from.Value.ToDateTime(TimeOnly.MinValue); parcelamentos = parcelamentos.Where(p => p.DataCompra >= de); }
            if (to.HasValue) { var ate = to.Value.ToDateTime(TimeOnly.MinValue); parcelamentos = parcelamentos.Where(p => p.DataCompra < ate); }
            // Guid.Empty = "sem categoria" (Relatórios › Classificar leva pra cá filtrado).
            if (categoriaId == Guid.Empty) parcelamentos = parcelamentos.Where(p => p.CategoriaId == null);
            else if (categoriaId.HasValue) parcelamentos = parcelamentos.Where(p => p.CategoriaId == categoriaId.Value);
            if (cartaoId.HasValue) parcelamentos = parcelamentos.Where(p => p.CartaoCreditoId == cartaoId.Value);
            if (valorMin.HasValue) parcelamentos = parcelamentos.Where(p => (p.ValorComJuros ?? p.ValorTotal) >= valorMin.Value);
            if (valorMax.HasValue) parcelamentos = parcelamentos.Where(p => (p.ValorComJuros ?? p.ValorTotal) <= valorMax.Value);
            if (!string.IsNullOrWhiteSpace(q))
            {
                var termo = $"%{q.Trim().ToLower()}%";
                parcelamentos = parcelamentos.Where(p => EF.Functions.Like(p.Descricao.ToLower(), termo));
            }
            var compras = parcelamentos.Select(p => new ChaveDeLinha
            {
                Id = p.Id, EhParcelamento = true, Data = DateOnly.FromDateTime(p.DataCompra), Hora = null,
                CriadoEm = p.CriadoEm, Valor = p.ValorComJuros ?? p.ValorTotal, NoCartao = true,
            });
            return lancamentos.Concat(compras);
        }

        /// <summary>Chave de ordenação de uma linha da lista (lançamento ou compra parcelada) pro UNION.</summary>
        private sealed class ChaveDeLinha
        {
            public Guid Id { get; set; }
            public bool EhParcelamento { get; set; }
            public DateOnly Data { get; set; }
            public TimeOnly? Hora { get; set; }
            public DateTime CriadoEm { get; set; }
            public decimal Valor { get; set; }
            /// <summary>Gasto no cartão (à vista ou compra parcelada); senão, em conta.</summary>
            public bool NoCartao { get; set; }
        }

        /// <summary>Lançamentos do usuário com os filtros da lista (conta dele ou cartão dele). Filtro no banco.</summary>
        private IQueryable<Transacao> TransacoesFiltradas(
            Guid usuarioId, DateOnly? from, DateOnly? to, Guid? categoriaId, string? q, int? tipo, Guid? contaId,
            Guid? cartaoId, decimal? valorMin, decimal? valorMax, int? status, bool apenasCaixa, int? meioPagamento,
            string? natureza)
        {
            var query = _context.Transacoes
                .Where(t =>
                    (t.ContaId.HasValue && t.Conta!.UsuarioIdProprietario == usuarioId) ||
                    (t.CartaoCreditoId.HasValue && t.CartaoCredito!.CriadoPor == usuarioId));

            // Escopo "extrato de caixa": só o que mexe no saldo da conta. Compra
            // no crédito tem só CartaoCreditoId (vive na fatura/aba Cartão) → cai
            // fora. Pagamento de fatura e pernas de transferência têm ContaId →
            // ficam. Saldo inicial é patrimônio de abertura, não movimento → fora.
            if (apenasCaixa)
                query = query.Where(t => t.ContaId.HasValue && !t.EhSaldoInicial);

            // Caixinha de meta: o lado de dentro da meta não aparece na lista geral. "Guardado em X" fica uma vez
            // só, na conta de onde o dinheiro saiu (como o extrato do Nubank); o histórico da meta mora em Metas.
            if (!contaId.HasValue)
                query = query.Where(t => t.ContaId == null || t.Conta!.Tipo != Domain.Enums.TipoConta.Caixinha);

            // Filtros opcionais aplicados no banco — só assim a paginação serve
            // pra UI: o front pagina o conjunto JÁ filtrado (por mês, categoria
            // etc), em vez de pedir tudo e filtrar no cliente.
            if (from.HasValue) query = query.Where(t => t.Data >= from.Value);
            if (to.HasValue) query = query.Where(t => t.Data < to.Value);
            if (categoriaId == Guid.Empty) query = query.Where(t => t.CategoriaId == null); // "sem categoria"
            else if (categoriaId.HasValue) query = query.Where(t => t.CategoriaId == categoriaId.Value);
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
            return query;
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
            if (categoriaId == Guid.Empty) query = query.Where(t => t.CategoriaId == null); // "sem categoria"
            else if (categoriaId.HasValue) query = query.Where(t => t.CategoriaId == categoriaId.Value);

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
                    await DonoRecursos.ExigirContaAbertaAsync(_context, contaNova.Value, usuarioId);
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
                && dados.Data > HorarioBrasil.Hoje())
                throw new ArgumentException("A data da transação não pode ser futura.");

            // Categoria/subcategoria vêm do cliente: global ou do próprio usuário.
            if (dados.CategoriaId.HasValue)
                await DonoRecursos.ExigirCategoriaAsync(_context, dados.CategoriaId.Value, usuarioId);
            if (dados.SubcategoriaId.HasValue)
                await DonoRecursos.ExigirSubcategoriaAsync(_context, dados.SubcategoriaId.Value, usuarioId);

            // Trava de limite: o que a edição põe A MAIS no cartão (no mesmo cartão, só o aumento; vindo de conta ou
            // de outro cartão, o valor todo) tem que caber no disponível. Baixar o valor ou tirar do cartão sempre passa.
            if (creditoNovo && dados.Tipo == TipoTransacao.Despesa)
            {
                var jaUsava = transacao.UsadoComoCredito && transacao.CartaoCreditoId == cartaoNovo
                    && transacao.Tipo == TipoTransacao.Despesa && transacao.StatusTransacao == StatusTransacao.Executado;
                await RegrasFinanceiras.ExigirLimiteDisponivelAsync(_context, cartaoNovo!.Value, usuarioId,
                    jaUsava ? dados.Valor - transacao.Valor : dados.Valor);
            }

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
            // Despesa dividida com valor novo: as partes acompanham (mesmo % de cada um), senão não somam o valor.
            if (dados.Valor != valorAntes)
                await new RateioService(_context).RegravarPeloValorAsync(transacao);

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

            if (transacao.EhPagamentoFatura || transacao.EhAcerto)
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

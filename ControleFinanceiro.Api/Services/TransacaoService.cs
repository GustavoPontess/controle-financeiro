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
        private static void ExigirEditavel(Transacao transacao)
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
        public async Task<Transacao> CriarTransacaoAsync(Transacao transacao, Guid usuarioId)
        {
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
            ExigirEditavel(transacao);

            if (dados.Valor <= 0)
                throw new ArgumentException("O valor da transação deve ser positivo.");

            // Mesma regra do CriarTransacaoAsync: data futura só é proibida pra lançamento
            // JÁ efetivado em CONTA. Previsão (salário do próximo mês) e compra de CRÉDITO
            // pós-datada podem ser futuras — de propósito. O update não altera CartaoCreditoId
            // nem StatusTransacao, então usa o estado atual do registro + a data nova.
            // (Editar qualquer campo desses lançamentos legítimos não pode voltar a dar 400.)
            if (!transacao.CartaoCreditoId.HasValue
                && transacao.StatusTransacao == Domain.Enums.StatusTransacao.Executado
                && dados.Data > DateOnly.FromDateTime(DateTime.UtcNow))
                throw new ArgumentException("A data da transação não pode ser futura.");

            // Categoria/subcategoria vêm do cliente: global ou do próprio usuário.
            if (dados.CategoriaId.HasValue)
                await DonoRecursos.ExigirCategoriaAsync(_context, dados.CategoriaId.Value, usuarioId);
            if (dados.SubcategoriaId.HasValue)
                await DonoRecursos.ExigirSubcategoriaAsync(_context, dados.SubcategoriaId.Value, usuarioId);

            // Compra no cartão com a data nova FORA do período da fatura dela vai pra fatura desse período — a
            // mesma regra de quando é lançada (ObterOuCriarFaturaAsync). Antes a data mudava e o FaturaId não:
            // a compra seguia cobrada na fatura velha. Dentro do período, fica onde está (dado antigo com
            // período fora do padrão do cartão não é mexido à toa). Resolvido ANTES de alterar os campos:
            // ObterOuCriarFaturaAsync salva (cria a fatura), e não pode levar a edição pela metade junto.
            var dataAntes = transacao.Data;
            Guid? faturaAnteriorId = null;
            Guid? faturaNovaId = null;
            if (transacao.UsadoComoCredito && transacao.CartaoCreditoId is { } cartaoId
                && transacao.FaturaId is { } faturaAtualId && dados.Data != transacao.Data)
            {
                var atual = await _context.Faturas.AsNoTracking().FirstOrDefaultAsync(f => f.Id == faturaAtualId);
                var dia = dados.Data.ToDateTime(TimeOnly.MinValue);
                if (atual is null || dia < atual.DataInicio || dia >= atual.DataFechamento)
                {
                    var nova = await _faturaService.ObterOuCriarFaturaAsync(cartaoId, dados.Data, usuarioId);
                    if (nova.Id != faturaAtualId)
                        (faturaAnteriorId, faturaNovaId) = (faturaAtualId, nova.Id);
                }
            }

            var valorAntes = transacao.Valor;
            transacao.Descricao = dados.Descricao;
            transacao.Valor = dados.Valor;
            transacao.Tipo = dados.Tipo;
            transacao.CategoriaId = dados.CategoriaId;
            transacao.SubcategoriaId = dados.SubcategoriaId;
            transacao.MeioPagamento = dados.MeioPagamento;
            transacao.Data = dados.Data;
            transacao.Hora = dados.Hora;
            // Ocorrência de conta fixa editada à mão (valor, dia…): alterar a conta fixa e o realinhamento
            // não desfazem mais a edição. A competência (o mês que ela cobre) não muda com a data.
            if (transacao.RecorrenteOrigemId != null)
                transacao.EditadaPeloUsuario = true;

            var correlationId = Guid.NewGuid();
            // Troca de fatura: grava a compra na nova ANTES de reconciliar a antiga, numa transação (atômico).
            // Com a troca só em memória, o Include da antiga ainda traz a compra (a linha no banco segue com o
            // FaturaId velho e o EF devolve a instância rastreada) e o total dela não baixava.
            await using var tx = faturaNovaId is null ? null : await _context.Database.BeginTransactionAsync();
            if (faturaNovaId is { } faturaNova)
            {
                // A fatura de onde a compra saiu perdeu o valor sem pagamento: reconcilia como num
                // cancelamento (pode ficar coberta pelo já pago e virar Pago). A que recebeu passa a dever
                // mais pelo restante — mesma regra de compra nova numa fatura já paga.
                transacao.FaturaId = faturaNova;
                await _context.SaveChangesAsync();
                await RegrasFinanceiras.ReconciliarFaturasAposCancelamentoAsync(
                    _context, _eventLog, new[] { faturaAnteriorId!.Value }, usuarioId, correlationId, DateTime.UtcNow);
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

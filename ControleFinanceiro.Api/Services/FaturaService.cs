using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.DTOs.Fatura;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ControleFinanceiro.Api.Services;

public class FaturaService
{
    private readonly AppDbContext _context;
    private readonly FinancialEventLogService _eventLog;

    public FaturaService(AppDbContext context)
    {
        _context = context;
        // Helper sem estado próprio (só escreve no mesmo contexto) — instanciado aqui pra não mudar
        // a assinatura do construtor, usada por vários services, jobs e testes.
        _eventLog = new FinancialEventLogService(context);
    }

    // ── Cálculo de período ────────────────────────────────────────────────────

    /// <summary>
    /// Dado uma data de transação e o dia de fechamento do cartão,
    /// retorna o início e o fechamento do período da fatura correspondente.
    /// </summary>
    public static (DateTime inicio, DateTime fechamento) CalcularPeriodo(DateTime dataTransacao, int? diaFechamento)
    {
        // Sem dia de fechamento → usa mês calendário completo
        if (!diaFechamento.HasValue)
        {
            var primeiroDia = new DateTime(dataTransacao.Year, dataTransacao.Month, 1);
            var ultimoDia = new DateTime(dataTransacao.Year, dataTransacao.Month,
                DateTime.DaysInMonth(dataTransacao.Year, dataTransacao.Month));
            return (primeiroDia, ultimoDia);
        }

        int dia = diaFechamento.Value;
        int diasNoMes = DateTime.DaysInMonth(dataTransacao.Year, dataTransacao.Month);
        int diaEfetivo = Math.Min(dia, diasNoMes);
        var fechamentoDoMes = new DateTime(dataTransacao.Year, dataTransacao.Month, diaEfetivo);

        if (dataTransacao.Day < diaEfetivo)
        {
            // Transação ANTES do fechamento → pertence à fatura que fecha neste mês.
            // A fatura começa no mesmo dia de fechamento do mês anterior (inclusive).
            var mesAnterior = dataTransacao.AddMonths(-1);
            int diasMesAnterior = DateTime.DaysInMonth(mesAnterior.Year, mesAnterior.Month);
            int diaAnteriorEfetivo = Math.Min(dia, diasMesAnterior);
            var inicioFatura = new DateTime(mesAnterior.Year, mesAnterior.Month, diaAnteriorEfetivo);
            return (inicioFatura, fechamentoDoMes);
        }
        else
        {
            // Transação NO DIA DO FECHAMENTO ou depois → pertence à NOVA fatura.
            // A nova fatura começa no próprio dia do fechamento deste mês.
            var proximoMes = dataTransacao.AddMonths(1);
            int diasProximoMes = DateTime.DaysInMonth(proximoMes.Year, proximoMes.Month);
            int diaProximoEfetivo = Math.Min(dia, diasProximoMes);
            var fechamentoProximo = new DateTime(proximoMes.Year, proximoMes.Month, diaProximoEfetivo);
            return (fechamentoDoMes, fechamentoProximo);
        }
    }

    /// <summary>
    /// Um dia DENTRO do ciclo que fecha no mês (<paramref name="ano"/>, <paramref name="mes"/>): a véspera
    /// do fechamento. Serve pra achar/criar "a fatura de outubro" passando por <see cref="CalcularPeriodo"/>
    /// — o rótulo da fatura na tela Cartões é o mês em que ela FECHA, e a regra de período continua num
    /// lugar só. Véspera porque o próprio dia do fechamento já cai no ciclo seguinte. O dia é limitado ao
    /// fim do mês (fecha dia 31 → em fevereiro fecha dia 28/29); sem dia de fechamento, mês calendário
    /// (a véspera do último dia está dentro dele). Fecha dia 1 → a véspera é o último dia do mês anterior,
    /// que pertence ao ciclo que fecha no dia 1 deste mês.
    /// </summary>
    public static DateTime DataNoCicloQueFechaEm(int ano, int mes, int? diaFechamento)
    {
        int diasNoMes = DateTime.DaysInMonth(ano, mes);
        int diaDoFechamento = Math.Min(diaFechamento ?? diasNoMes, diasNoMes);
        return new DateTime(ano, mes, diaDoFechamento).AddDays(-1);
    }

    /// <summary>
    /// Calcula a data de vencimento com base no fechamento e no dia de vencimento do cartão.
    /// O vencimento é sempre APÓS o fechamento (mesmo mês ou próximo mês).
    /// </summary>
    public static DateTime CalcularVencimento(DateTime fechamento, int? diaVencimento)
    {
        if (!diaVencimento.HasValue)
            return fechamento.AddDays(10);

        int diasNoMes = DateTime.DaysInMonth(fechamento.Year, fechamento.Month);
        int diaEfetivo = Math.Min(diaVencimento.Value, diasNoMes);
        var vencimentoMesmo = new DateTime(fechamento.Year, fechamento.Month, diaEfetivo);

        if (vencimentoMesmo > fechamento)
            return vencimentoMesmo;

        // Dia de vencimento é anterior ao fechamento → vai para o próximo mês
        var proximo = fechamento.AddMonths(1);
        int diasProximo = DateTime.DaysInMonth(proximo.Year, proximo.Month);
        return new DateTime(proximo.Year, proximo.Month, Math.Min(diaVencimento.Value, diasProximo));
    }

    // ── Busca ou criação de fatura ────────────────────────────────────────────

    /// <summary>
    /// Retorna a fatura existente para o período da data da transação,
    /// ou cria uma nova se não existir (lançamentos retroativos incluídos).
    /// Respeita o invariante: faturas fechadas/pagas não são modificadas.
    /// </summary>
    public async Task<Fatura> ObterOuCriarFaturaAsync(Guid cartaoCreditoId, DateOnly dataTransacao, Guid usuarioId)
    {
        var cartao = await _context.CartoesCredito.FindAsync(cartaoCreditoId)
            ?? throw new KeyNotFoundException("Cartão de crédito não encontrado.");
        // Defesa em profundidade: todo chamador passa o dono do cartão; se um dia não passar, a fatura
        // (e o lançamento nela) não nasce no cartão de outro usuário. Mesma mensagem do não-encontrado.
        if (cartao.CriadoPor != usuarioId)
            throw new KeyNotFoundException("Cartão de crédito não encontrado.");

        var (inicio, fechamento) = CalcularPeriodo(dataTransacao.ToDateTime(TimeOnly.MinValue), cartao.DiaFechamento);

        // Busca pelo fechamento (que sempre foi calculado corretamente).
        // Corrige DataInicio caso tenha sido salvo com lógica anterior (bug: +1 dia).
        var fatura = await _context.Faturas
            .FirstOrDefaultAsync(f =>
                f.CartaoCreditoId == cartaoCreditoId &&
                f.DataFechamento == fechamento);

        if (fatura != null)
        {
            if (fatura.DataInicio != inicio)
            {
                fatura.DataInicio = inicio;
                await _context.SaveChangesAsync();
            }
            return fatura;
        }

        var vencimento = CalcularVencimento(fechamento, cartao.DiaVencimento);

        fatura = new Fatura
        {
            Id = Guid.NewGuid(),
            CartaoCreditoId = cartaoCreditoId,
            DataInicio = inicio,
            DataFechamento = fechamento,
            DataVencimento = vencimento,
            EstadoCiclo = EstadoCicloFatura.Aberta,
            EstadoPagamento = EstadoPagamentoFatura.NaoPago,
            EstaAtrasada = false,
            ValorPago = 0,
            CriadoPor = usuarioId,
        };

        _context.Faturas.Add(fatura);
        await _context.SaveChangesAsync();
        return fatura;
    }

    // ── Parcelamento ──────────────────────────────────────────────────────────

    /// <summary>
    /// Cria N transações distribuídas em N faturas consecutivas (parcelamento).
    /// A primeira parcela cai na fatura da data informada; as demais, nos meses seguintes.
    /// </summary>
    public async Task<List<Transacao>> CriarParcelamentoAsync(
        Guid cartaoCreditoId,
        Guid? categoriaId,
        string descricaoBase,
        decimal valorTotal,
        int numParcelas,
        DateOnly dataBase,
        Guid usuarioId,
        Guid? subcategoriaId = null)
    {
        if (numParcelas < 2)
            throw new ArgumentException("Parcelamento requer no mínimo 2 parcelas.");

        var valorParcela = Math.Round(valorTotal / numParcelas, 2);
        var resto = valorTotal - valorParcela * numParcelas; // centavos residuais vão para a última parcela

        var transacoes = new List<Transacao>();
        Guid primeiraTransacaoId = Guid.NewGuid();

        for (int i = 1; i <= numParcelas; i++)
        {
            var dataTransacao = dataBase.AddMonths(i - 1);
            var fatura = await ObterOuCriarFaturaAsync(cartaoCreditoId, dataTransacao, usuarioId);

            decimal valorDaParcela = (i == numParcelas) ? valorParcela + resto : valorParcela;

            var transacao = new Transacao
            {
                Id = i == 1 ? primeiraTransacaoId : Guid.NewGuid(),
                Descricao = $"{descricaoBase} ({i}/{numParcelas})",
                Valor = valorDaParcela,
                Tipo = TipoTransacao.Despesa,
                CategoriaId = categoriaId,
                SubcategoriaId = subcategoriaId,
                CartaoCreditoId = cartaoCreditoId,
                FaturaId = fatura.Id,
                UsadoComoCredito = true,
                MeioPagamento = MeioPagamento.Credito,
                Data = dataTransacao,
                Hora = null, // parcela de crédito não tem hora real — cai na fatura pela data
                CriadoPor = usuarioId,
            };

            _context.Transacoes.Add(transacao);
            transacoes.Add(transacao);
        }

        await _context.SaveChangesAsync();
        return transacoes;
    }

    // ── Pagamento de fatura ───────────────────────────────────────────────────

    /// <summary>Operação no <see cref="RegistroIdempotencia"/> (espaço de chaves do pagamento de fatura).</summary>
    public const string OperacaoPagarFatura = "PagarFatura";

    /// <summary>
    /// Paga total ou parcialmente uma fatura.
    /// Debita o valor da conta informada e atualiza o status da fatura.
    /// Invariante: só impacta o saldo da conta no momento do pagamento.
    /// Idempotente por <paramref name="idempotencyKey"/> (header Idempotency-Key, obrigatório): a
    /// mesma chave nunca paga 2x — o replay devolve o pagamento original; mesma chave com OUTROS
    /// dados → InvalidOperationException (409). Concorrência otimista na Fatura (xmin): pagamento
    /// simultâneo com outra chave → DbUpdateConcurrencyException (409).
    /// </summary>
    public async Task<Transacao> PagarFaturaAsync(
        Guid faturaId, PagarFaturaDto dto, Guid usuarioId, string? idempotencyKey)
    {
        // Pagar fatura debita a conta → operação transacional (CLAUDE.md): sem chave, um duplo clique
        // ou um retry de rede pagaria (e debitaria) 2x. O único chamador (modal do front) sempre manda
        // o header, então ele é obrigatório. Valida antes de tocar no banco; o limite evita estourar
        // a coluna (varchar 100) e virar 500.
        if (string.IsNullOrWhiteSpace(idempotencyKey))
            throw new ArgumentException("O header Idempotency-Key é obrigatório para pagar a fatura.");
        if (idempotencyKey.Length > RegistroIdempotencia.ChaveMaxLength)
            throw new ArgumentException(
                $"O header Idempotency-Key aceita no máximo {RegistroIdempotencia.ChaveMaxLength} caracteres.");

        // Dono já no filtro da busca: fatura de OUTRO usuário e fatura inexistente dão o MESMO 404
        // (CLAUDE.md, "dono do recurso"). Antes a de outro usuário dava 403 — a diferença de status
        // confirmava pra quem chuta ids que aquela fatura existe.
        var fatura = await _context.Faturas
            .Include(f => f.CartaoCredito)
            .Include(f => f.Transacoes)
            .Include(f => f.ParcelasTransacao)
            .FirstOrDefaultAsync(f => f.Id == faturaId && f.CartaoCredito.CriadoPor == usuarioId)
            ?? throw new KeyNotFoundException("Fatura não encontrada.");

        // Replay ANTES das regras de negócio: se o 1º pagamento quitou a fatura, o retry cairia em
        // "já foi paga" (409) e o cliente acharia que falhou — o certo é devolver o mesmo sucesso.
        var pagamentoAnterior = await BuscarPagamentoPorChaveAsync(usuarioId, idempotencyKey, faturaId, dto);
        if (pagamentoAnterior != null)
            return pagamentoAnterior;

        var conta = await _context.Contas
            .FirstOrDefaultAsync(c => c.Id == dto.ContaId && c.UsuarioIdProprietario == usuarioId)
            ?? throw new KeyNotFoundException("Conta não encontrada.");

        // Crédito à vista (legacy) + parcelas do sistema novo — regra única (parcela cancelada fora)
        var valorTotal = RegrasFinanceiras.ValorTotalFatura(fatura);

        var valorRestante = RegrasFinanceiras.ValorRestanteFatura(valorTotal, fatura.ValorPago);
        // "Já paga" pelo RESTANTE, não pelo rótulo: compra nova que cai numa fatura marcada Pago (ciclo
        // aberto quitado, compra retroativa, recorrente) deixa restante > 0 — recusar pelo rótulo travava
        // a fatura pra sempre (não pagava, e o limite dessa compra nunca voltava).
        if (valorRestante <= 0)
            throw new InvalidOperationException("Esta fatura já foi paga integralmente.");
        if (dto.Valor <= 0 || dto.Valor > valorRestante)
            throw new ArgumentException($"Valor inválido. Restante a pagar: {valorRestante:C}.");
        // Pagamento debita a conta na hora: data futura seria dinheiro que ainda não saiu (mesma regra da
        // transferência e do lançamento efetivado em conta). O front já barra; o back também.
        if (DateOnly.FromDateTime(dto.DataPagamento) > DateOnly.FromDateTime(DateTime.UtcNow))
            throw new ArgumentException("A data do pagamento não pode ser futura.");

        // Cria transação de débito na conta (aqui o saldo da conta é afetado — invariante 5)
        var pagamento = new Transacao
        {
            Id = Guid.NewGuid(),
            Descricao = $"Pagamento fatura {fatura.CartaoCredito.Nome} " +
                        $"({fatura.DataFechamento:MM/yyyy})",
            Valor = dto.Valor,
            Tipo = TipoTransacao.Despesa,
            ContaId = dto.ContaId,
            // Pagamento usa FaturaPagaId (não FaturaId) → fora do total da fatura e dos
            // relatórios de P&L (a despesa real foi a compra, não o pagamento).
            EhPagamentoFatura = true,
            FaturaPagaId = fatura.Id,
            MeioPagamento = (MeioPagamento)dto.MeioPagamento,
            Data = DateOnly.FromDateTime(dto.DataPagamento),
            Hora = null, // pagamento de fatura é datado (sem hora específica)
            CriadoPor = usuarioId,
        };

        // Limite antes do pagamento (lido do banco, que ainda não tem este pagamento), pra trilha de
        // auditoria registrar o que ele soltou (abaixo).
        var usadoCartaoAntes = await RegrasFinanceiras.LimiteUsadoDoCartaoAsync(_context, fatura.CartaoCreditoId, usuarioId);
        var usadoFaturaAntes = RegrasFinanceiras.LimiteUsadoDaFatura(fatura);

        var valorPagoAntes = fatura.ValorPago;
        fatura.ValorPago += dto.Valor;
        if (fatura.ValorPago >= valorTotal)
        {
            fatura.EstadoPagamento = EstadoPagamentoFatura.Pago;
            fatura.DataPagamentoTotal = DateTime.UtcNow;
            fatura.EstaAtrasada = false;
        }
        else if (fatura.ValorPago > 0)
        {
            fatura.EstadoPagamento = EstadoPagamentoFatura.Parcial;
        }

        _context.Transacoes.Add(pagamento);

        // Chave gravada no MESMO SaveChanges do pagamento: ou os dois existem, ou nenhum. Uma
        // tentativa que falhou (validação, 409) não "gasta" a chave — o retry pode seguir normal.
        var registro = new RegistroIdempotencia
        {
            Id = Guid.NewGuid(),
            UsuarioId = usuarioId,
            Operacao = OperacaoPagarFatura,
            Chave = idempotencyKey,
            ReferenciaId = pagamento.Id,
            CriadoEm = DateTime.UtcNow,
        };
        _context.RegistrosIdempotencia.Add(registro);

        // FinancialEventLog (CLAUDE.md: toda operação que afeta saldo) — mesmo evento que o
        // pagamento de parcela já grava. Sem idempotencyKey no payload de propósito: a chave deste
        // fluxo mora no RegistroIdempotencia, e o LIKE dos outros fluxos não deve enxergá-la.
        var log = _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: fatura.EstadoPagamento == EstadoPagamentoFatura.Pago
                ? FinancialEventType.FaturaPagaTotal
                : FinancialEventType.FaturaPagaParcial,
            entidade: "Fatura",
            entidadeId: fatura.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            valorAntes: valorPagoAntes,
            valorDepois: fatura.ValorPago,
            payload: new
            {
                pagamentoId = pagamento.Id,
                contaId = dto.ContaId,
                valor = dto.Valor,
                valorTotal,
                estadoPagamento = fatura.EstadoPagamento.ToString(),
            });

        // Limite: o usado segue o pago da fatura, então pagar solta limite (mesmo em parte). Solta o que a
        // fatura segurava até o valor pago — a parte que cobre previsão ou passa do efetivado não solta
        // nada. Antes/depois = limite usado do CARTÃO; só esta fatura mudou, então a queda dela é a do
        // cartão. Mesmo SaveChanges do pagamento: ou os dois ficam, ou nenhum.
        var limiteLiberado = usadoFaturaAntes - RegrasFinanceiras.LimiteUsadoDaFatura(fatura);
        var logLimite = limiteLiberado > 0
            ? _eventLog.Registrar(
                usuarioId: usuarioId,
                tipo: FinancialEventType.LimiteLiberado,
                entidade: "CartaoCredito",
                entidadeId: fatura.CartaoCreditoId,
                correlationId: log.CorrelationId,
                origemAcao: "API",
                valorAntes: usadoCartaoAntes,
                valorDepois: usadoCartaoAntes - limiteLiberado,
                payload: new
                {
                    faturaId = fatura.Id,
                    pagamentoId = pagamento.Id,
                    delta = -limiteLiberado,
                })
            : null;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex is DbUpdateConcurrencyException || EhViolacaoDeUnicidade(ex))
        {
            // Corrida: entre a nossa leitura e o nosso UPDATE, outra requisição alterou esta fatura
            // (xmin mudou → concorrência) ou gravou a MESMA chave antes (índice único → 23505). Nada
            // desta tentativa foi persistido (SaveChanges é atômico). Se quem ganhou usou a mesma
            // chave, é o duplo clique/retry → replay com o pagamento dela (se os dados baterem — senão
            // 409, igual ao replay normal). Senão foi outra operação (outro pagamento, parcela, job)
            // → propaga; o middleware devolve 409 e o cliente recarrega.
            foreach (var pendente in new object?[] { pagamento, registro, log, logLimite, fatura })
                if (pendente != null)
                    _context.Entry(pendente).State = EntityState.Detached;

            var vencedor = await BuscarPagamentoPorChaveAsync(usuarioId, idempotencyKey, faturaId, dto);
            if (vencedor != null)
                return vencedor;
            throw;
        }

        return pagamento;
    }

    /// <summary>
    /// Mensagem do 409 quando a chave já pagou com OUTROS dados (conta, valor, data ou meio).
    /// Segura pro cliente: não revela os dados do pagamento original.
    /// </summary>
    public const string MensagemChaveComOutrosDados =
        "Este pagamento já foi registrado com outros dados. Recarregue a fatura antes de pagar de novo.";

    /// <summary>
    /// Pagamento já feito com esta chave (replay) ou null se a chave é nova pra este usuário.
    /// Lança <see cref="InvalidOperationException"/> (409) se a chave já foi usada em outra fatura ou
    /// com dados diferentes dos de <paramref name="dto"/>.
    /// </summary>
    private async Task<Transacao?> BuscarPagamentoPorChaveAsync(
        Guid usuarioId, string chave, Guid faturaId, PagarFaturaDto dto)
    {
        var registro = await _context.RegistrosIdempotencia
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.UsuarioId == usuarioId
                                      && r.Operacao == OperacaoPagarFatura
                                      && r.Chave == chave);
        if (registro == null)
            return null;

        // IgnoreQueryFilters: se o pagamento foi estornado depois (soft delete), a chave continua
        // consumida — o retry dela não pode virar um pagamento novo.
        var pagamento = await _context.Transacoes
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == registro.ReferenciaId && t.CriadoPor == usuarioId);

        // Mesma chave reaproveitada em OUTRA fatura (bug de cliente): não dá pra devolver o pagamento
        // de outra fatura como se fosse desta, nem pagar de novo com uma chave já consumida.
        if (pagamento == null || pagamento.FaturaPagaId != faturaId)
            throw new InvalidOperationException(
                "Esta Idempotency-Key já foi usada em outra operação. Gere uma nova chave e tente de novo.");

        // Mesma chave com dados DIFERENTES não é o mesmo pedido: ex.: pagou R$300 da conta A, a
        // resposta se perdeu, o usuário trocou pra R$100 da conta B no modal ainda aberto (mesma
        // chave) e confirmou. Devolver 204 diria "pago" pra algo que NÃO foi feito — saíram R$300 da
        // A. Draft IETF httpapi-idempotency-key e Stripe tratam payload divergente como erro, não
        // replay. Sem coluna de hash do payload: a própria Transacao original guarda o que foi pedido.
        if (!MesmosDadosDoPagamento(pagamento, dto))
            throw new InvalidOperationException(MensagemChaveComOutrosDados);

        return pagamento;
    }

    /// <summary>
    /// O retry traz o mesmo pedido que gerou <paramref name="original"/>? Compara com os valores
    /// como foram GRAVADOS no INSERT (mesmas conversões), pra um retry legítimo não virar 409.
    /// </summary>
    private static bool MesmosDadosDoPagamento(Transacao original, PagarFaturaDto dto) =>
        original.ContaId == dto.ContaId
        && original.Valor == dto.Valor
        // Só o dia: pagamento de fatura é datado (Data = date, Hora null). Mesma conversão do INSERT.
        && original.Data == DateOnly.FromDateTime(dto.DataPagamento)
        // Nullable na Transacao: pagamento sem meio gravado não tem o que comparar.
        && (original.MeioPagamento == null || (int)original.MeioPagamento.Value == dto.MeioPagamento);

    /// <summary>Violação de índice único no Postgres (SqlState 23505) dentro do DbUpdateException.</summary>
    private static bool EhViolacaoDeUnicidade(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    // ── Estorno de pagamento ──────────────────────────────────────────────────

    /// <summary>Operação no <see cref="RegistroIdempotencia"/> (espaço de chaves do estorno).</summary>
    public const string OperacaoEstornarPagamento = "EstornarPagamentoFatura";

    /// <summary>
    /// Desfaz um pagamento de fatura (feito por engano, ou o banco devolveu): o lançamento do pagamento é
    /// cancelado (soft delete — o dinheiro volta pra conta e o registro fica), a fatura volta a dever o valor
    /// (estado recalculado pelo restante) e o limite volta a ser ocupado. Antes não havia volta: a tela de
    /// Transações bloqueia editar/excluir pagamento (revisão do #288), e um pagamento errado ficava pra
    /// sempre. Pagamento de parcela antecipada devolve a parcela pra Pendente — ou Cancelada, se o
    /// parcelamento já foi cancelado (é o reembolso de uma compra desfeita; Pendente a cobraria de novo).
    /// Idempotente pela chave (<see cref="RegistroIdempotencia"/>, no mesmo SaveChanges); concorrência otimista
    /// na fatura (xmin → 409). Pagamento inexistente, de outro usuário ou que não é de fatura → 404 (mesma
    /// resposta); já estornado → 409. Juros/multa: se a fatura voltar a dever vencida, o FaturaAtrasoJob a
    /// marca de novo e RECALCULA sobre o restante (atribui, não soma).
    /// </summary>
    public async Task<EstornoPagamentoResultadoDto> EstornarPagamentoAsync(
        Guid pagamentoId, EstornarPagamentoDto dto, Guid usuarioId, string? idempotencyKey)
    {
        if (string.IsNullOrWhiteSpace(idempotencyKey))
            throw new ArgumentException("O header Idempotency-Key é obrigatório para estornar o pagamento.");
        if (idempotencyKey.Length > RegistroIdempotencia.ChaveMaxLength)
            throw new ArgumentException(
                $"O header Idempotency-Key aceita no máximo {RegistroIdempotencia.ChaveMaxLength} caracteres.");

        // Replay antes das regras: o retry de um estorno que deu certo cairia em "já estornado".
        var anterior = await BuscarEstornoPorChaveAsync(usuarioId, idempotencyKey, pagamentoId);
        if (anterior != null)
            return anterior;

        // IgnoreQueryFilters pra distinguir "já estornado" (409) de "não existe" (404). Dono pela CONTA do
        // pagamento aqui e pelo CARTÃO da fatura abaixo: os dois têm que ser do usuário.
        var pagamento = await _context.Transacoes
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == pagamentoId && t.EhPagamentoFatura && t.FaturaPagaId != null
                                      && t.CriadoPor == usuarioId && t.Conta!.UsuarioIdProprietario == usuarioId)
            ?? throw new KeyNotFoundException("Pagamento não encontrado.");
        if (!pagamento.Ativo || pagamento.StatusTransacao == StatusTransacao.Cancelado)
            throw new InvalidOperationException("Este pagamento já foi estornado.");

        var fatura = await _context.Faturas
            .Include(f => f.Transacoes)
            .Include(f => f.ParcelasTransacao)
            .FirstOrDefaultAsync(f => f.Id == pagamento.FaturaPagaId && f.CartaoCredito.CriadoPor == usuarioId)
            ?? throw new KeyNotFoundException("Pagamento não encontrado.");
        if (fatura.ValorPago < pagamento.Valor)
            throw new InvalidOperationException(
                "A fatura registra menos pago do que este pagamento — confira a fatura antes de estornar.");

        ParcelaTransacao? parcela = null;
        if (pagamento.ParcelaTransacaoId is { } parcelaId)
            parcela = await _context.ParcelasTransacao
                .Include(p => p.Parcelamento)
                .FirstOrDefaultAsync(p => p.Id == parcelaId && p.Parcelamento!.CriadoPor == usuarioId);

        var agora = DateTime.UtcNow;
        var usadoCartaoAntes = await RegrasFinanceiras.LimiteUsadoDoCartaoAsync(_context, fatura.CartaoCreditoId, usuarioId);
        var usadoFaturaAntes = RegrasFinanceiras.LimiteUsadoDaFatura(fatura);
        var valorPagoAntes = fatura.ValorPago;
        var motivo = string.IsNullOrWhiteSpace(dto.Motivo) ? "Pagamento estornado" : $"Estorno: {dto.Motivo.Trim()}";

        pagamento.Ativo = false;
        pagamento.StatusTransacao = StatusTransacao.Cancelado;
        pagamento.CanceladoEm = agora;
        pagamento.MotivoCancelamento = motivo;

        var parcelaCancelada = false;
        if (parcela is { Status: StatusParcela.Paga })
        {
            if (parcela.Parcelamento!.Ativo)
            {
                parcela.Status = StatusParcela.Pendente;
                parcela.PagoEm = null;
            }
            else
            {
                parcela.Status = StatusParcela.Cancelada;
                parcela.CanceladoEm = agora;
                parcela.MotivoCancelamento = motivo;
                parcelaCancelada = true;
            }
        }

        // A fatura volta a dever: estado pelo RESTANTE (regra única). Ainda coberta (o estorno de parcela de
        // parcelamento cancelado baixa o pago e o total juntos) → o estado fica. Zerada sem pagamento → NaoPago.
        fatura.ValorPago -= pagamento.Valor;
        var restante = RegrasFinanceiras.ValorRestanteFatura(fatura);
        if (restante > 0 || fatura.ValorPago <= 0)
        {
            fatura.EstadoPagamento = fatura.ValorPago > 0 ? EstadoPagamentoFatura.Parcial : EstadoPagamentoFatura.NaoPago;
            fatura.DataPagamentoTotal = null;
        }

        var correlationId = Guid.NewGuid();
        var log = _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.FaturaPagamentoEstornado,
            entidade: "Fatura",
            entidadeId: fatura.Id,
            correlationId: correlationId,
            origemAcao: "API",
            valorAntes: valorPagoAntes,
            valorDepois: fatura.ValorPago,
            payload: new
            {
                pagamentoId,
                contaId = pagamento.ContaId,
                valor = pagamento.Valor,
                motivo = dto.Motivo,
                parcelaId = parcela?.Id,
                parcelaStatus = parcela?.Status.ToString(),
                estadoPagamento = fatura.EstadoPagamento.ToString(),
            });
        if (parcelaCancelada)
            _eventLog.Registrar(
                usuarioId: usuarioId,
                tipo: FinancialEventType.ParcelaCancelada,
                entidade: "ParcelaTransacao",
                entidadeId: parcela!.Id,
                correlationId: correlationId,
                origemAcao: "API",
                valorAntes: parcela.ValorComJuros ?? parcela.Valor,
                valorDepois: 0m,
                payload: new { parcelamentoId = parcela.ParcelamentoId, numero = parcela.Numero, pagamentoId });

        // Limite: o usado segue o pago da fatura, então o estorno volta a ocupar o que o pagamento tinha
        // soltado. Antes/depois = limite usado do CARTÃO; só esta fatura mudou.
        var limiteBloqueado = RegrasFinanceiras.LimiteUsadoDaFatura(fatura) - usadoFaturaAntes;
        if (limiteBloqueado > 0)
            _eventLog.Registrar(
                usuarioId: usuarioId,
                tipo: FinancialEventType.LimiteBloqueado,
                entidade: "CartaoCredito",
                entidadeId: fatura.CartaoCreditoId,
                correlationId: correlationId,
                origemAcao: "API",
                valorAntes: usadoCartaoAntes,
                valorDepois: usadoCartaoAntes + limiteBloqueado,
                payload: new { faturaId = fatura.Id, pagamentoId, delta = limiteBloqueado });

        _context.RegistrosIdempotencia.Add(new RegistroIdempotencia
        {
            Id = Guid.NewGuid(),
            UsuarioId = usuarioId,
            Operacao = OperacaoEstornarPagamento,
            Chave = idempotencyKey,
            ReferenciaId = pagamento.Id,
            CriadoEm = agora,
        });

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex is DbUpdateConcurrencyException || EhViolacaoDeUnicidade(ex))
        {
            // Corrida (outra operação mexeu na fatura, ou a MESMA chave gravou antes): nada desta tentativa
            // ficou. Mesma chave → replay do estorno vencedor; senão propaga (409, o cliente recarrega).
            _context.ChangeTracker.Clear();
            var vencedor = await BuscarEstornoPorChaveAsync(usuarioId, idempotencyKey, pagamentoId);
            if (vencedor != null)
                return vencedor;
            throw;
        }

        return new EstornoPagamentoResultadoDto
        {
            PagamentoId = pagamento.Id,
            FaturaId = fatura.Id,
            ValorEstornado = pagamento.Valor,
            ValorPagoFatura = fatura.ValorPago,
            RestanteFatura = restante,
        };
    }

    /// <summary>
    /// Estorno já feito com esta chave (replay, com a fatura como está agora) ou null se a chave é nova.
    /// Chave usada em OUTRO pagamento → 409.
    /// </summary>
    private async Task<EstornoPagamentoResultadoDto?> BuscarEstornoPorChaveAsync(
        Guid usuarioId, string chave, Guid pagamentoId)
    {
        var registro = await _context.RegistrosIdempotencia
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.UsuarioId == usuarioId
                                      && r.Operacao == OperacaoEstornarPagamento
                                      && r.Chave == chave);
        if (registro == null)
            return null;
        if (registro.ReferenciaId != pagamentoId)
            throw new InvalidOperationException(
                "Esta Idempotency-Key já foi usada em outra operação. Gere uma nova chave e tente de novo.");

        var pagamento = await _context.Transacoes.IgnoreQueryFilters().AsNoTracking()
            .FirstAsync(t => t.Id == pagamentoId);
        var fatura = await _context.Faturas
            .Include(f => f.Transacoes)
            .Include(f => f.ParcelasTransacao)
            .AsNoTracking()
            .FirstAsync(f => f.Id == pagamento.FaturaPagaId);
        return new EstornoPagamentoResultadoDto
        {
            PagamentoId = pagamento.Id,
            FaturaId = fatura.Id,
            ValorEstornado = pagamento.Valor,
            ValorPagoFatura = fatura.ValorPago,
            RestanteFatura = RegrasFinanceiras.ValorRestanteFatura(fatura),
        };
    }

    // ── Consultas ─────────────────────────────────────────────────────────────

    public async Task<List<FaturaDto>> ListarPorCartaoAsync(Guid cartaoCreditoId, Guid usuarioId)
    {
        var cartao = await _context.CartoesCredito
            .FirstOrDefaultAsync(c => c.Id == cartaoCreditoId && c.CriadoPor == usuarioId)
            ?? throw new KeyNotFoundException("Cartão não encontrado.");

        var faturas = await _context.Faturas
            .Where(f => f.CartaoCreditoId == cartaoCreditoId)
            .Include(f => f.Transacoes)
            .Include(f => f.ParcelasTransacao)
            .OrderByDescending(f => f.DataFechamento)
            .AsNoTracking()
            .ToListAsync();

        return faturas.Select(f => ToDto(f, cartao.Nome)).ToList();
    }

    public async Task<FaturaDetalheDto> DetalheAsync(Guid faturaId, Guid usuarioId)
    {
        var fatura = await _context.Faturas
            .Where(f => f.Id == faturaId && f.CartaoCredito.CriadoPor == usuarioId)
            .Include(f => f.CartaoCredito)
            .Include(f => f.Transacoes)
                .ThenInclude(t => t.Categoria)
            // Parcelamento (descrição/data da compra) e categoria vêm na MESMA consulta — sem N+1 por parcela.
            .Include(f => f.ParcelasTransacao)
                .ThenInclude(p => p.Parcelamento!)
                    .ThenInclude(pa => pa.Categoria)
            .AsNoTracking()
            .FirstOrDefaultAsync()
            ?? throw new KeyNotFoundException("Fatura não encontrada.");

        var dto = new FaturaDetalheDto();
        PreencherDto(dto, fatura, fatura.CartaoCredito.Nome);
        // A lista usa o MESMO filtro do total (RegrasFinanceiras): compras + parcelas listadas somam
        // exatamente o ValorTotal. Previsão (assinatura expandida pelo job, UsadoComoCredito) entra nos
        // dois lados — a regra do total não olha StatusTransacao.
        dto.Transacoes = fatura.Transacoes
            .Where(RegrasFinanceiras.CompoeTotalFatura)
            .OrderByDescending(t => t.CriadoEm)
            .Select(t => new FaturaTransacaoDto
            {
                Id = t.Id,
                Descricao = t.Descricao,
                Valor = t.Valor,
                Data = t.Data.ToDateTime(t.Hora ?? TimeOnly.MinValue),
                CriadoEm = t.CriadoEm,
                CategoriaId = t.CategoriaId,
                CategoriaDescricao = t.Categoria?.Descricao,
            }).ToList();

        // Parcelas do parcelamento que caíram nesta fatura. Antes só entravam no total: a fatura cobrava
        // R$ 450 e a lista dizia "nenhuma transação". Isolamento: vêm pela fatura, já filtrada pelo dono
        // do cartão (mesmo critério das compras acima). Data = compra do parcelamento (convenção do
        // extrato de cartão); a linha do tempo ordena por CriadoEm, como as compras.
        dto.Parcelas = fatura.ParcelasTransacao
            .Where(RegrasFinanceiras.CompoeTotalFatura)
            .OrderByDescending(p => p.CriadoEm)
            .ThenBy(p => p.Numero)
            .Select(p => new FaturaParcelaDto
            {
                Id = p.Id,
                ParcelamentoId = p.ParcelamentoId,
                Descricao = p.Parcelamento?.Descricao ?? string.Empty,
                Numero = p.Numero,
                QuantidadeTotal = p.QuantidadeTotal,
                Valor = RegrasFinanceiras.ValorDevidoParcela(p),
                Data = p.Parcelamento?.DataCompra ?? p.DataVencimento,
                CriadoEm = p.CriadoEm,
                CategoriaId = p.Parcelamento?.CategoriaId,
                CategoriaDescricao = p.Parcelamento?.Categoria?.Descricao,
                Status = (int)p.Status,
            }).ToList();

        // Pagamentos: transações de pagamento desta fatura (FaturaPagaId, não FaturaId).
        // Materializa antes do switch (árvore de expressão EF não aceita switch).
        var pags = await _context.Transacoes
            .Where(t => t.FaturaPagaId == faturaId && t.Ativo)
            .OrderBy(t => t.Data).ThenBy(t => t.Hora)
            .Select(t => new { t.Id, t.Valor, t.Data, t.Hora, t.CriadoEm, t.MeioPagamento })
            .ToListAsync();
        dto.Pagamentos = pags.Select(t => new FaturaPagamentoDto
        {
            Id = t.Id,
            Valor = t.Valor,
            Data = t.Data.ToDateTime(t.Hora ?? TimeOnly.MinValue),
            CriadoEm = t.CriadoEm,
            MeioPagamento = t.MeioPagamento.HasValue ? (int)t.MeioPagamento.Value : 0,
            MeioPagamentoDescricao = t.MeioPagamento switch
            {
                Domain.Enums.MeioPagamento.Dinheiro => "Dinheiro",
                Domain.Enums.MeioPagamento.Debito   => "Débito",
                Domain.Enums.MeioPagamento.Credito  => "Crédito",
                Domain.Enums.MeioPagamento.Pix      => "Pix",
                Domain.Enums.MeioPagamento.Ted      => "TED/DOC",
                Domain.Enums.MeioPagamento.Boleto   => "Boleto",
                _ => "—",
            },
        }).ToList();

        return dto;
    }

    public const string TipoCompra = "compra";
    public const string TipoParcela = "parcela";
    public const string TipoPagamento = "pagamento";

    /// <summary>
    /// Lançamentos da fatura numa lista só (compras à vista, parcelas e pagamentos), do mais recente pro
    /// mais antigo, com busca por texto (descrição, categoria, meio do pagamento), filtro por tipo e
    /// paginação — o que a tela mostra. A fatura é um mês: os itens dela cabem na memória, então filtra
    /// e pagina em cima do mesmo detalhe (mesmas regras de total), não numa consulta à parte.
    /// </summary>
    public async Task<PagedResult<LancamentoFaturaDto>> ListarLancamentosAsync(
        Guid faturaId, Guid usuarioId, string? q = null, string? tipo = null, int page = 1, int pageSize = 25)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var d = await DetalheAsync(faturaId, usuarioId);

        IEnumerable<LancamentoFaturaDto> todos = d.Transacoes.Select(t => new LancamentoFaturaDto
            {
                Id = t.Id, Tipo = TipoCompra, Descricao = t.Descricao, Valor = t.Valor, Data = t.Data, CriadoEm = t.CriadoEm,
                CategoriaId = t.CategoriaId, CategoriaDescricao = t.CategoriaDescricao,
            })
            .Concat(d.Parcelas.Select(p => new LancamentoFaturaDto
            {
                Id = p.Id, Tipo = TipoParcela, Descricao = p.Descricao, Valor = p.Valor, Data = p.Data, CriadoEm = p.CriadoEm,
                CategoriaId = p.CategoriaId, CategoriaDescricao = p.CategoriaDescricao,
                Numero = p.Numero, QuantidadeTotal = p.QuantidadeTotal, ParcelamentoId = p.ParcelamentoId,
            }))
            .Concat(d.Pagamentos.Select(p => new LancamentoFaturaDto
            {
                Id = p.Id, Tipo = TipoPagamento, Descricao = "Pagamento", Valor = p.Valor, Data = p.Data, CriadoEm = p.CriadoEm,
                MeioPagamentoDescricao = p.MeioPagamentoDescricao,
            }));

        if (!string.IsNullOrWhiteSpace(tipo))
        {
            var t = tipo.Trim();
            todos = todos.Where(l => string.Equals(l.Tipo, t, StringComparison.OrdinalIgnoreCase));
        }
        if (!string.IsNullOrWhiteSpace(q))
        {
            var termo = q.Trim();
            todos = todos.Where(l => l.Descricao.Contains(termo, StringComparison.OrdinalIgnoreCase)
                || (l.CategoriaDescricao?.Contains(termo, StringComparison.OrdinalIgnoreCase) ?? false)
                || (l.MeioPagamentoDescricao?.Contains(termo, StringComparison.OrdinalIgnoreCase) ?? false));
        }

        var lista = todos.OrderByDescending(l => l.Data.Date).ThenByDescending(l => l.CriadoEm).ToList();
        return new PagedResult<LancamentoFaturaDto>
        {
            Items = lista.Skip((page - 1) * pageSize).Take(pageSize).ToList(),
            Total = lista.Count,
            Page = page,
            PageSize = pageSize,
        };
    }

    // ── Helpers privados ──────────────────────────────────────────────────────

    private static FaturaDto ToDto(Fatura f, string cartaoNome)
    {
        var dto = new FaturaDto();
        PreencherDto(dto, f, cartaoNome);
        return dto;
    }

    private static void PreencherDto(FaturaDto dto, Fatura f, string cartaoNome)
    {
        var valorTotal = RegrasFinanceiras.ValorTotalFatura(f);
        dto.Id = f.Id;
        dto.CartaoCreditoId = f.CartaoCreditoId;
        dto.CartaoCreditoNome = cartaoNome;
        dto.DataInicio = f.DataInicio;
        dto.DataFechamento = f.DataFechamento;
        dto.DataVencimento = f.DataVencimento;
        // 3 flags ortogonais
        dto.EstadoCiclo       = (int)f.EstadoCiclo;
        dto.EstadoPagamento   = (int)f.EstadoPagamento;
        dto.EstaAtrasada      = f.EstaAtrasada;
        dto.DataPagamentoTotal = f.DataPagamentoTotal;
        dto.ValorTotal    = valorTotal;
        dto.ValorPago     = f.ValorPago;
        dto.ValorRestante = RegrasFinanceiras.ValorRestanteFatura(valorTotal, f.ValorPago);
        // "Vencida" (badge da tela) = passou do vencimento e AINDA RESTA pagar. Deriva do restante, não
        // do EstadoPagamento: fatura coberta que ficou Parcial após cancelamento, ou zerada sem
        // pagamento, não deve nada — mesma regra do FaturaAtrasoJob.
        dto.Vencida = dto.ValorRestante > 0
                      && DateTime.UtcNow.Date > f.DataVencimento.Date;
    }
}

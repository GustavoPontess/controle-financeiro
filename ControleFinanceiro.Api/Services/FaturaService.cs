using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
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
    public async Task<Fatura> ObterOuCriarFaturaAsync(Guid cartaoCreditoId, DateTime dataTransacao, Guid usuarioId)
    {
        var cartao = await _context.CartoesCredito.FindAsync(cartaoCreditoId)
            ?? throw new KeyNotFoundException("Cartão de crédito não encontrado.");
        // Defesa em profundidade: todo chamador passa o dono do cartão; se um dia não passar, a fatura
        // (e o lançamento nela) não nasce no cartão de outro usuário. Mesma mensagem do não-encontrado.
        if (cartao.CriadoPor != usuarioId)
            throw new KeyNotFoundException("Cartão de crédito não encontrado.");

        var (inicio, fechamento) = CalcularPeriodo(dataTransacao.Date, cartao.DiaFechamento);

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
        DateTime dataBase,
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
    /// mesma chave nunca paga 2x — o replay devolve o pagamento original. Concorrência otimista na
    /// Fatura (xmin): pagamento simultâneo com outra chave → DbUpdateConcurrencyException (409).
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

        var fatura = await _context.Faturas
            .Include(f => f.CartaoCredito)
            .Include(f => f.Transacoes)
            .Include(f => f.ParcelasTransacao)
            .FirstOrDefaultAsync(f => f.Id == faturaId)
            ?? throw new KeyNotFoundException("Fatura não encontrada.");

        if (fatura.CartaoCredito.CriadoPor != usuarioId)
            throw new ForbiddenAccessException("Você não tem permissão para pagar esta fatura.");

        // Replay ANTES das regras de negócio: se o 1º pagamento quitou a fatura, o retry cairia em
        // "já foi paga" (409) e o cliente acharia que falhou — o certo é devolver o mesmo sucesso.
        var pagamentoAnterior = await BuscarPagamentoPorChaveAsync(usuarioId, idempotencyKey, faturaId);
        if (pagamentoAnterior != null)
            return pagamentoAnterior;

        if (fatura.EstadoPagamento == EstadoPagamentoFatura.Pago)
            throw new InvalidOperationException("Esta fatura já foi paga integralmente.");

        var conta = await _context.Contas
            .FirstOrDefaultAsync(c => c.Id == dto.ContaId && c.UsuarioIdProprietario == usuarioId)
            ?? throw new KeyNotFoundException("Conta não encontrada.");

        // Inclui crédito à vista (legacy) + parcelas do sistema novo
        var valorTotal = CalcularValorTotal(fatura);

        var valorRestante = valorTotal - fatura.ValorPago;
        if (dto.Valor <= 0 || dto.Valor > valorRestante)
            throw new ArgumentException($"Valor inválido. Restante a pagar: {valorRestante:C}.");

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
            Data = dto.DataPagamento.ToUniversalTime(),
            CriadoPor = usuarioId,
        };

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

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex is DbUpdateConcurrencyException || EhViolacaoDeUnicidade(ex))
        {
            // Corrida: entre a nossa leitura e o nosso UPDATE, outra requisição alterou esta fatura
            // (xmin mudou → concorrência) ou gravou a MESMA chave antes (índice único → 23505). Nada
            // desta tentativa foi persistido (SaveChanges é atômico). Se quem ganhou usou a mesma
            // chave, é o duplo clique/retry → replay com o pagamento dela. Senão foi outra operação
            // (outro pagamento, parcela, job) → propaga; o middleware devolve 409 e o cliente recarrega.
            foreach (var pendente in new object[] { pagamento, registro, log, fatura })
                _context.Entry(pendente).State = EntityState.Detached;

            var vencedor = await BuscarPagamentoPorChaveAsync(usuarioId, idempotencyKey, faturaId);
            if (vencedor != null)
                return vencedor;
            throw;
        }

        return pagamento;
    }

    /// <summary>
    /// Pagamento já feito com esta chave (replay) ou null se a chave é nova pra este usuário.
    /// </summary>
    private async Task<Transacao?> BuscarPagamentoPorChaveAsync(Guid usuarioId, string chave, Guid faturaId)
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

        return pagamento;
    }

    /// <summary>Violação de índice único no Postgres (SqlState 23505) dentro do DbUpdateException.</summary>
    private static bool EhViolacaoDeUnicidade(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

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
            .Include(f => f.ParcelasTransacao)
            .AsNoTracking()
            .FirstOrDefaultAsync()
            ?? throw new KeyNotFoundException("Fatura não encontrada.");

        var dto = new FaturaDetalheDto();
        PreencherDto(dto, fatura, fatura.CartaoCredito.Nome);
        dto.Transacoes = fatura.Transacoes
            .Where(t => t.UsadoComoCredito)
            .OrderByDescending(t => t.CriadoEm)
            .Select(t => new FaturaTransacaoDto
            {
                Id = t.Id,
                Descricao = t.Descricao,
                Valor = t.Valor,
                Data = t.Data,
                CriadoEm = t.CriadoEm,
                CategoriaId = t.CategoriaId,
                CategoriaDescricao = t.Categoria?.Descricao,
            }).ToList();

        // Pagamentos: transações de pagamento desta fatura (FaturaPagaId, não FaturaId).
        // Materializa antes do switch (árvore de expressão EF não aceita switch).
        var pags = await _context.Transacoes
            .Where(t => t.FaturaPagaId == faturaId && t.Ativo)
            .OrderBy(t => t.Data)
            .Select(t => new { t.Id, t.Valor, t.Data, t.CriadoEm, t.MeioPagamento })
            .ToListAsync();
        dto.Pagamentos = pags.Select(t => new FaturaPagamentoDto
        {
            Id = t.Id,
            Valor = t.Valor,
            Data = t.Data,
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

    // ── Helpers privados ──────────────────────────────────────────────────────

    private static FaturaDto ToDto(Fatura f, string cartaoNome)
    {
        var dto = new FaturaDto();
        PreencherDto(dto, f, cartaoNome);
        return dto;
    }

    private static void PreencherDto(FaturaDto dto, Fatura f, string cartaoNome)
    {
        var valorTotal = CalcularValorTotal(f);
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
        dto.ValorRestante = Math.Max(0m, valorTotal - f.ValorPago);
        dto.Vencida = f.EstadoPagamento != EstadoPagamentoFatura.Pago
                      && DateTime.UtcNow.Date > f.DataVencimento.Date;
    }

    /// <summary>
    /// Total da fatura = crédito à vista (legacy) + parcelas do sistema novo.
    /// Sem dupla contagem: transações de pagamento têm FaturaPagaId, não FaturaId.
    /// </summary>
    private static decimal CalcularValorTotal(Fatura f)
    {
        var legacyTotal = f.Transacoes
            .Where(t => t.UsadoComoCredito && t.Ativo)
            .Sum(t => t.Valor);
        var parcelasTotal = f.ParcelasTransacao
            .Sum(p => p.ValorComJuros ?? p.Valor);
        return legacyTotal + parcelasTotal;
    }
}

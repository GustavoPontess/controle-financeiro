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

        if (fatura.EstadoPagamento == EstadoPagamentoFatura.Pago)
            throw new InvalidOperationException("Esta fatura já foi paga integralmente.");

        var conta = await _context.Contas
            .FirstOrDefaultAsync(c => c.Id == dto.ContaId && c.UsuarioIdProprietario == usuarioId)
            ?? throw new KeyNotFoundException("Conta não encontrada.");

        // Crédito à vista (legacy) + parcelas do sistema novo — regra única (parcela cancelada fora)
        var valorTotal = RegrasFinanceiras.ValorTotalFatura(fatura);

        var valorRestante = RegrasFinanceiras.ValorRestanteFatura(valorTotal, fatura.ValorPago);
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
            // chave, é o duplo clique/retry → replay com o pagamento dela (se os dados baterem — senão
            // 409, igual ao replay normal). Senão foi outra operação (outro pagamento, parcela, job)
            // → propaga; o middleware devolve 409 e o cliente recarrega.
            foreach (var pendente in new object[] { pagamento, registro, log, fatura })
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
        // Só a data: o front grava a hora do clique ("hoje → agora"), então o retry do mesmo pedido
        // chega com outro horário no mesmo dia. ToUniversalTime = a mesma conversão do INSERT.
        && original.Data.Date == dto.DataPagamento.ToUniversalTime().Date
        // Nullable na Transacao: pagamento sem meio gravado não tem o que comparar.
        && (original.MeioPagamento == null || (int)original.MeioPagamento.Value == dto.MeioPagamento);

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
                Data = t.Data,
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

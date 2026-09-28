using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.DTOs.Recorrente;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

public class RecorrenteService
{
    private readonly AppDbContext _context;
    private readonly FaturaService _faturaService;
    private readonly FinancialEventLogService _eventLogService;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public RecorrenteService(AppDbContext context, FaturaService faturaService, FinancialEventLogService eventLogService, IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _faturaService = faturaService;
        _eventLogService = eventLogService;
        _httpContextAccessor = httpContextAccessor;
    }

    private static DateTime ProximaData(DateTime atual, FrequenciaRecorrencia freq) => freq switch
    {
        FrequenciaRecorrencia.Semanal => atual.AddDays(7),
        FrequenciaRecorrencia.Mensal => atual.AddMonths(1),
        FrequenciaRecorrencia.Anual => atual.AddYears(1),
        _ => atual.AddMonths(1)
    };

    private static string DescricaoFrequencia(FrequenciaRecorrencia freq) => freq switch
    {
        FrequenciaRecorrencia.Semanal => "Semanal",
        FrequenciaRecorrencia.Mensal => "Mensal",
        FrequenciaRecorrencia.Anual => "Anual",
        _ => freq.ToString()
    };

    // Conta, cartão e categoria vêm do cliente: todos têm que ser do usuário (categoria pode ser global).
    private async Task ExigirReferenciasDoUsuarioAsync(Guid? contaId, Guid? cartaoId, Guid? categoriaId, Guid usuarioId)
    {
        if (contaId.HasValue) await DonoRecursos.ExigirContaAsync(_context, contaId.Value, usuarioId);
        if (cartaoId.HasValue) await DonoRecursos.ExigirCartaoAsync(_context, cartaoId.Value, usuarioId);
        if (categoriaId.HasValue) await DonoRecursos.ExigirCategoriaAsync(_context, categoriaId.Value, usuarioId);
    }

    private string? ObterIdempotencyKey()
    {
        var idempotencyKey = _httpContextAccessor.HttpContext?.Items["IdempotencyKey"] as string;
        return !string.IsNullOrWhiteSpace(idempotencyKey) ? idempotencyKey : null;
    }

    public async Task GerarPendentesAsync(Guid usuarioId)
    {
        var hoje = DateTime.UtcNow.Date;
        var recorrentes = await _context.Recorrentes
            .Where(r => r.CriadoPor == usuarioId && r.Ativo &&
                        (r.DataFim == null || r.DataFim.Value.Date >= hoje))
            .ToListAsync();

        bool houveMudanca = false;
        foreach (var r in recorrentes)
        {
            var proxima = (r.DataProximaGeracao ?? r.DataInicio).Date;
            try
            {
                while (proxima <= hoje && (r.DataFim == null || proxima <= r.DataFim.Value.Date))
                {
                    // Ocorrência no cartão é compra no crédito: entra na fatura do período, como no
                    // ExpandirRecorrentesJob. Antes era gravada sem FaturaId — nenhuma fatura cobrava,
                    // pagar a fatura não soltava o limite e ela ficava usada pra sempre.
                    Guid? faturaId = null;
                    if (r.CartaoCreditoId.HasValue)
                        faturaId = (await _faturaService.ObterOuCriarFaturaAsync(
                            r.CartaoCreditoId.Value, proxima, usuarioId)).Id;

                    _context.Transacoes.Add(new Transacao
                    {
                        Id = Guid.NewGuid(),
                        Descricao = r.Descricao,
                        Valor = r.Valor,
                        Tipo = r.Tipo,
                        CategoriaId = r.CategoriaId,
                        ContaId = r.ContaId,
                        CartaoCreditoId = r.CartaoCreditoId,
                        FaturaId = faturaId,
                        UsadoComoCredito = r.CartaoCreditoId.HasValue,
                        StatusTransacao = StatusTransacao.Executado,
                        Ativo = true,
                        CriadoPor = usuarioId,
                        Data = proxima,
                        RecorrenteOrigemId = r.Id,
                        CriadoEm = DateTime.UtcNow
                    });
                    proxima = ProximaData(proxima, r.Frequencia);
                    houveMudanca = true;
                }
            }
            catch (KeyNotFoundException)
            {
                // Cartão que não é do usuário (dado gravado antes da checagem de dono): pula a
                // recorrente, como o ExpandirRecorrentesJob faz — sem isso uma linha ruim derrubava a
                // listagem de recorrentes. O cartão falha já na 1ª ocorrência, então nada dela entrou.
                continue;
            }
            r.DataProximaGeracao = proxima;
        }

        if (houveMudanca)
            await _context.SaveChangesAsync();
    }

    /// <summary>
    /// KPIs agregados — ativas, custo mensal das despesas mensais, próximas 30 dias, total.
    /// Calculado no banco, exato pra qualquer volume.
    /// </summary>
    public async Task<RecorrenteStatsDto> ObterStatsAsync(Guid usuarioId)
    {
        var query = _context.Recorrentes.Where(r => r.CriadoPor == usuarioId);
        var ativas = query.Where(r => r.Ativo);

        var qtdAtivas = await ativas.CountAsync();
        var custoMensal = await ativas
            .Where(r => r.Frequencia == FrequenciaRecorrencia.Mensal
                        && r.Tipo == TipoTransacao.Despesa)
            .SumAsync(r => (decimal?)r.Valor) ?? 0m;
        // Cutoff +30d calculado no servidor pra não vazar lógica de tempo pro cliente.
        // EF traduz `<=` em SQL nativo.
        var cutoff = DateTime.UtcNow.AddDays(30);
        var proximas30 = await ativas
            .Where(r => r.DataProximaGeracao != null && r.DataProximaGeracao <= cutoff)
            .CountAsync();
        var qtdTotal = await query.CountAsync();

        return new RecorrenteStatsDto
        {
            Ativas = qtdAtivas,
            CustoMensalDespesas = custoMensal,
            Proximas30Dias = proximas30,
            QtdTotal = qtdTotal,
        };
    }

    public async Task<PagedResult<RecorrenteDto>> ListarAsync(Guid usuarioId, int page = 1, int pageSize = 25)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _context.Recorrentes
            .Where(r => r.CriadoPor == usuarioId)
            .Include(r => r.Categoria)
            .Include(r => r.Conta)
            .Include(r => r.CartaoCredito)
            .OrderByDescending(r => r.Ativo)
            .ThenBy(r => r.Descricao)
            .AsNoTracking();

        var total = await query.CountAsync();
        var lista = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<RecorrenteDto>
        {
            Items = lista.Select(r => new RecorrenteDto
            {
                Id = r.Id,
                Descricao = r.Descricao,
                Valor = r.Valor,
                Tipo = (int)r.Tipo,
                TipoDescricao = r.Tipo == TipoTransacao.Receita ? "Receita" : "Despesa",
                CategoriaId = r.CategoriaId,
                CategoriaNome = r.Categoria?.Descricao,
                ContaId = r.ContaId,
                ContaNome = r.Conta?.Nome,
                CartaoCreditoId = r.CartaoCreditoId,
                CartaoCreditoNome = r.CartaoCredito?.Nome,
                Frequencia = (int)r.Frequencia,
                FrequenciaDescricao = DescricaoFrequencia(r.Frequencia),
                Dia = r.Dia,
                DataInicio = r.DataInicio,
                DataFim = r.DataFim,
                Ativo = r.Ativo,
                DataProximaGeracao = r.DataProximaGeracao,
                CanceladoEm = r.CanceladoEm,
                MotivoCancelamento = r.MotivoCancelamento
            }),
            Total = total,
            Page = page,
            PageSize = pageSize,
        };
    }

    public async Task<RecorrenteDto> CriarAsync(CriarRecorrenteDto dto, Guid usuarioId)
    {
        // Validar ContaId XOR CartaoCreditoId
        if ((dto.ContaId == null && dto.CartaoCreditoId == null) ||
            (dto.ContaId != null && dto.CartaoCreditoId != null))
            throw new ArgumentException("Recorrente deve ter exatamente uma origem: ContaId OU CartaoCreditoId.");

        Guid recorrenteId = Guid.NewGuid();
        var correlationId = Guid.NewGuid();
        var dataInicio = dto.DataInicio.ToUniversalTime();
        var idempotencyKey = ObterIdempotencyKey();

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // Validar idempotência
            if (!string.IsNullOrEmpty(idempotencyKey))
            {
                var prevEvent = await _eventLogService.BuscarPorIdempotencyKeyAsync(usuarioId, idempotencyKey);
                if (prevEvent != null)
                    return (await ListarAsync(usuarioId)).Items.FirstOrDefault(r => r.Id == recorrenteId)
                        ?? throw new InvalidOperationException("Idempotência: evento anterior encontrado mas recorrente não existe.");
            }

            // Origem (conta/cartão) e categoria vêm do cliente — todas têm que ser do usuário.
            await ExigirReferenciasDoUsuarioAsync(dto.ContaId, dto.CartaoCreditoId, dto.CategoriaId, usuarioId);

            // Criar recorrente com janela de 3 meses
            var dataFimJanela = dataInicio.AddMonths(3);
            var recorrente = new Recorrente
            {
                Id = recorrenteId,
                Descricao = dto.Descricao,
                Valor = dto.Valor,
                Tipo = (TipoTransacao)dto.Tipo,
                CategoriaId = dto.CategoriaId,
                ContaId = dto.ContaId,
                CartaoCreditoId = dto.CartaoCreditoId,
                Frequencia = (FrequenciaRecorrencia)dto.Frequencia,
                Dia = dto.Dia,
                DataInicio = dataInicio,
                DataFim = dto.DataFim?.ToUniversalTime(),
                Ativo = true,
                CriadoPor = usuarioId,
                DataProximaGeracao = dataFimJanela,
                CriadoEm = DateTime.UtcNow
            };

            _context.Recorrentes.Add(recorrente);
            await _context.SaveChangesAsync();

            // Materializar 3 meses de transações Previsão
            var proxima = dataInicio.Date;
            while (proxima < dataFimJanela && (dto.DataFim == null || proxima <= dto.DataFim.Value.Date))
            {
                Guid? faturaId = null;
                if (dto.CartaoCreditoId.HasValue)
                {
                    var fatura = await _faturaService.ObterOuCriarFaturaAsync(dto.CartaoCreditoId.Value, proxima, usuarioId);
                    faturaId = fatura.Id;
                }

                var transacao = new Transacao
                {
                    Id = Guid.NewGuid(),
                    Descricao = dto.Descricao,
                    Valor = dto.Valor,
                    Tipo = (TipoTransacao)dto.Tipo,
                    CategoriaId = dto.CategoriaId,
                    ContaId = dto.ContaId,
                    CartaoCreditoId = dto.CartaoCreditoId,
                    FaturaId = faturaId,
                    // Mesmo molde do ExpandirRecorrentesJob. Sem a flag a ocorrência ficava fora do total
                    // da fatura (não dava pra pagar) e, efetivada pelo ExecutarRecorrentesJob, fora do
                    // limite usado — compra feita no cartão sem usar limite.
                    UsadoComoCredito = dto.CartaoCreditoId.HasValue,
                    StatusTransacao = StatusTransacao.Previsao,
                    Ativo = true,
                    CriadoPor = usuarioId,
                    Data = proxima,
                    RecorrenteOrigemId = recorrenteId,
                    CriadoEm = DateTime.UtcNow
                };

                _context.Transacoes.Add(transacao);
                proxima = ProximaData(proxima, (FrequenciaRecorrencia)dto.Frequencia);
            }

            await _context.SaveChangesAsync();

            // Log evento
            _eventLogService.Registrar(
                usuarioId,
                FinancialEventType.RecorrenteCriada,
                "Recorrente",
                recorrenteId,
                correlationId,
                "Service:RecorrenteService",
                payload: new { descricao = recorrente.Descricao, valor = recorrente.Valor, idempotencyKey });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return (await ListarAsync(usuarioId)).Items.First(r => r.Id == recorrenteId);
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task EditarProximaOcorrenciaAsync(Guid id, EditarProximaOcorrenciaDto dto, Guid usuarioId)
    {
        var recorrente = await _context.Recorrentes.FindAsync(id)
            ?? throw new KeyNotFoundException("Recorrente não encontrado.");
        if (recorrente.CriadoPor != usuarioId)
            throw new ForbiddenAccessException("Sem permissão.");

        var proxima = await _context.Transacoes
            .Where(t => t.RecorrenteOrigemId == id &&
                        t.StatusTransacao == StatusTransacao.Previsao &&
                        t.Ativo)
            .OrderBy(t => t.Data)
            .FirstOrDefaultAsync()
            ?? throw new KeyNotFoundException("Nenhuma ocorrência futura encontrada.");

        if (dto.Valor.HasValue)
        {
            if (dto.Valor.Value <= 0)
                throw new ArgumentException("Valor deve ser positivo.");
            proxima.Valor = dto.Valor.Value;
        }
        if (dto.Descricao != null)
            proxima.Descricao = dto.Descricao;
        if (dto.CategoriaId.HasValue)
        {
            await DonoRecursos.ExigirCategoriaAsync(_context, dto.CategoriaId.Value, usuarioId);
            proxima.CategoriaId = dto.CategoriaId;
        }

        await _context.SaveChangesAsync();
    }

    public async Task<object> CancelarAsync(Guid id, CancelarRecorrenteDto dto, Guid usuarioId)
    {
        var recorrente = await _context.Recorrentes.FindAsync(id)
            ?? throw new KeyNotFoundException("Recorrente não encontrado.");
        if (recorrente.CriadoPor != usuarioId)
            throw new ForbiddenAccessException("Sem permissão.");

        var motivo = dto.Motivo;
        if (string.IsNullOrWhiteSpace(motivo))
            throw new ArgumentException("Motivo do cancelamento é obrigatório.");

        var correlationId = Guid.NewGuid();
        var idempotencyKey = ObterIdempotencyKey();

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // Validar idempotência
            if (!string.IsNullOrEmpty(idempotencyKey))
            {
                var prevEvent = await _eventLogService.BuscarPorIdempotencyKeyAsync(usuarioId, idempotencyKey);
                if (prevEvent != null)
                    return new { canceladoEm = recorrente.CanceladoEm, motivo = recorrente.MotivoCancelamento };
            }

            // Soft delete recorrente
            recorrente.Ativo = false;
            recorrente.CanceladoEm = DateTime.UtcNow;
            recorrente.MotivoCancelamento = motivo;

            // Cancelar transações futuras (Previsão)
            var transacoesFuturas = await _context.Transacoes
                .Where(t => t.RecorrenteOrigemId == id && t.StatusTransacao == StatusTransacao.Previsao)
                .ToListAsync();

            foreach (var t in transacoesFuturas)
            {
                t.Ativo = false;
                t.CanceladoEm = DateTime.UtcNow;
                t.MotivoCancelamento = motivo;
            }

            await _context.SaveChangesAsync();

            // Log evento
            _eventLogService.Registrar(
                usuarioId,
                FinancialEventType.RecorrenteCancelada,
                "Recorrente",
                id,
                correlationId,
                "Service:RecorrenteService",
                payload: new { motivo, transacoesCanceladas = transacoesFuturas.Count, idempotencyKey });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return new { canceladoEm = recorrente.CanceladoEm, motivo = recorrente.MotivoCancelamento };
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task AtualizarAsync(Guid id, CriarRecorrenteDto dto, Guid usuarioId)
    {
        var r = await _context.Recorrentes.FindAsync(id)
            ?? throw new KeyNotFoundException("Recorrente não encontrado.");
        if (r.CriadoPor != usuarioId)
            throw new ForbiddenAccessException("Sem permissão.");

        // Mesmas regras do CriarAsync. Sem isso, editar a recorrente trocava a conta/cartão por um de
        // OUTRO usuário e a geração de ocorrências lançava no saldo dele.
        if ((dto.ContaId == null && dto.CartaoCreditoId == null) ||
            (dto.ContaId != null && dto.CartaoCreditoId != null))
            throw new ArgumentException("Recorrente deve ter exatamente uma origem: ContaId OU CartaoCreditoId.");
        await ExigirReferenciasDoUsuarioAsync(dto.ContaId, dto.CartaoCreditoId, dto.CategoriaId, usuarioId);

        r.Descricao = dto.Descricao;
        r.Valor = dto.Valor;
        r.Tipo = (TipoTransacao)dto.Tipo;
        r.CategoriaId = dto.CategoriaId;
        r.ContaId = dto.ContaId;
        r.CartaoCreditoId = dto.CartaoCreditoId;
        r.Frequencia = (FrequenciaRecorrencia)dto.Frequencia;
        r.Dia = dto.Dia;
        r.DataFim = dto.DataFim?.ToUniversalTime();

        await _context.SaveChangesAsync();
    }

    public async Task ToggleAtivoAsync(Guid id, Guid usuarioId)
    {
        var r = await _context.Recorrentes.FindAsync(id)
            ?? throw new KeyNotFoundException("Recorrente não encontrado.");
        if (r.CriadoPor != usuarioId)
            throw new ForbiddenAccessException("Sem permissão.");

        r.Ativo = !r.Ativo;
        await _context.SaveChangesAsync();
    }

    public async Task DeletarAsync(Guid id, Guid usuarioId)
    {
        var r = await _context.Recorrentes.FindAsync(id)
            ?? throw new KeyNotFoundException("Recorrente não encontrado.");
        if (r.CriadoPor != usuarioId)
            throw new ForbiddenAccessException("Sem permissão.");

        _context.Recorrentes.Remove(r);
        await _context.SaveChangesAsync();
    }
}

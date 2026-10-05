using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.DTOs.Recorrente;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

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

    // Conta fixa do usuário. Excluída não existe mais pra ele (404); de outro usuário segue 403 (contrato atual).
    private async Task<Recorrente> BuscarDoUsuarioAsync(Guid id, Guid usuarioId)
    {
        var r = await _context.Recorrentes.FindAsync(id);
        if (r == null || r.ExcluidoEm != null)
            throw new KeyNotFoundException("Recorrente não encontrado.");
        if (r.CriadoPor != usuarioId)
            throw new ForbiddenAccessException("Sem permissão.");
        return r;
    }

    /// <summary>
    /// Gera as ocorrências da conta fixa a partir do cursor (<c>DataProximaGeracao</c>; sem cursor, do início)
    /// até <paramref name="ateExclusivo"/> e até a <c>DataFim</c>, no compasso do <see cref="AgendaRecorrente"/>,
    /// e avança o cursor pra próxima data. Molde ÚNICO: criar, expansão diária, lançar o que passou, retomar e
    /// alterar. Ocorrência no cartão é compra no crédito: entra na fatura do período com <c>UsadoComoCredito</c>
    /// (sem a flag ficava fora do total e do limite). Dia que já tem ocorrência VIVA dessa conta fixa
    /// (efetivada ou prevista) é pulado — retomar/alterar no dia em que a de hoje já foi efetivada não cobra de
    /// novo. Retorna quantas criou. Não salva.
    /// </summary>
    public async Task<int> GerarOcorrenciasAsync(Recorrente r, DateOnly ateExclusivo, StatusTransacao status)
    {
        var inicio = DateOnly.FromDateTime(r.DataInicio);
        DateOnly? fim = r.DataFim is { } df ? DateOnly.FromDateTime(df) : null;
        var proxima = AgendaRecorrente.ProximaEmOuDepois(
            r.DataProximaGeracao is { } cursor ? DateOnly.FromDateTime(cursor) : inicio, inicio, r.Dia, r.Frequencia);

        // Do banco E da memória: cancelada agora (ainda não salva) não conta; criada agora conta.
        var doBanco = await _context.Transacoes
            .Where(t => t.RecorrenteOrigemId == r.Id && t.Data >= proxima)
            .ToListAsync();
        var ocupadas = doBanco
            .Concat(_context.Transacoes.Local.Where(t => t.RecorrenteOrigemId == r.Id))
            .Where(t => t.Ativo)
            .Select(t => t.Data)
            .ToHashSet();

        var criadas = 0;
        while (proxima < ateExclusivo && (fim == null || proxima <= fim))
        {
            if (!ocupadas.Contains(proxima))
            {
                Guid? faturaId = null;
                if (r.CartaoCreditoId.HasValue)
                    faturaId = (await _faturaService.ObterOuCriarFaturaAsync(r.CartaoCreditoId.Value, proxima, r.CriadoPor)).Id;

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
                    StatusTransacao = status,
                    Ativo = true,
                    CriadoPor = r.CriadoPor,
                    Data = proxima,
                    Hora = null, // ocorrência de conta fixa é datada (sem hora de relógio)
                    RecorrenteOrigemId = r.Id,
                    CriadoEm = DateTime.UtcNow
                });
                ocupadas.Add(proxima);
                criadas++;
            }
            proxima = AgendaRecorrente.Seguinte(proxima, inicio, r.Dia, r.Frequencia);
        }

        r.DataProximaGeracao = proxima.ToDateTime(TimeOnly.MinValue);
        return criadas;
    }

    // Cancela (exclusão lógica) as previsões dessa conta fixa que ainda não viraram cobrança — todas, ou só as
    // de `aPartirDe` em diante. Devolve as canceladas (pra reconciliar a fatura do cartão). Não salva.
    private async Task<List<Transacao>> CancelarPrevisoesAsync(Guid recorrenteId, string motivo, DateTime agora, DateOnly? aPartirDe = null)
    {
        var query = _context.Transacoes.Where(t => t.RecorrenteOrigemId == recorrenteId
                                                   && t.StatusTransacao == StatusTransacao.Previsao
                                                   && t.Ativo);
        if (aPartirDe is { } desde)
            query = query.Where(t => t.Data >= desde);
        var canceladas = await query.ToListAsync();
        foreach (var t in canceladas)
        {
            t.Ativo = false;
            t.CanceladoEm = agora;
            t.MotivoCancelamento = motivo;
        }
        return canceladas;
    }

    // Previsão de conta fixa no cartão entra no total da fatura (RegrasFinanceiras.CompoeTotalFatura): cancelar
    // baixa o total SEM pagamento → reconcilia o estado da fatura (regra de dinheiro do CLAUDE.md).
    private Task ReconciliarFaturasDasCanceladasAsync(IEnumerable<Transacao> canceladas, Guid usuarioId, Guid correlationId, DateTime agora) =>
        RegrasFinanceiras.ReconciliarFaturasAposCancelamentoAsync(
            _context, _eventLogService,
            canceladas.Where(t => t.FaturaId != null).Select(t => t.FaturaId!.Value),
            usuarioId, correlationId, agora);

    /// <summary>
    /// Conserto de dado, idempotente (sem nada torto não mexe) — roda na expansão diária, ANTES de expandir e
    /// antes do ExecutarRecorrentesJob: (1) previsão pendente de conta fixa que não deve mais cobrar (pausada,
    /// cancelada, excluída, ou apagada antes da exclusão lógica) é cancelada; (2) conta fixa ativa com previsão
    /// futura FORA do dia certo (gerada antes da regra do <c>Dia</c>) tem as futuras canceladas e o cursor volta
    /// pra próxima data certa a partir de hoje — a expansão logo depois gera de novo no compasso. Não salva.
    /// Devolve quantas previsões cancelou.
    /// </summary>
    public async Task<int> RealinharAsync(DateOnly hoje)
    {
        var agora = DateTime.UtcNow;
        var pendentes = await _context.Transacoes
            .Where(t => t.RecorrenteOrigemId != null && t.StatusTransacao == StatusTransacao.Previsao && t.Ativo)
            .ToListAsync();
        if (pendentes.Count == 0) return 0;

        var ids = pendentes.Select(t => t.RecorrenteOrigemId!.Value).Distinct().ToList();
        var recorrentes = await _context.Recorrentes.Where(r => ids.Contains(r.Id)).ToDictionaryAsync(r => r.Id);

        var canceladas = new List<Transacao>();
        void Cancelar(IEnumerable<Transacao> lista, string motivo)
        {
            foreach (var t in lista)
            {
                t.Ativo = false;
                t.CanceladoEm = agora;
                t.MotivoCancelamento = motivo;
                canceladas.Add(t);
            }
        }

        foreach (var grupo in pendentes.GroupBy(t => t.RecorrenteOrigemId!.Value))
        {
            recorrentes.TryGetValue(grupo.Key, out var r);
            if (r == null || !r.Ativo || r.CanceladoEm != null || r.ExcluidoEm != null)
            {
                Cancelar(grupo, "Conta fixa não está mais ativa");
                continue;
            }

            var inicio = DateOnly.FromDateTime(r.DataInicio);
            var futuras = grupo.Where(t => t.Data >= hoje).ToList();
            if (futuras.All(t => AgendaRecorrente.NoCompasso(t.Data, inicio, r.Dia, r.Frequencia)))
                continue;

            Cancelar(futuras, "Realinhada ao dia da conta fixa");
            r.DataProximaGeracao = AgendaRecorrente.ProximaEmOuDepois(hoje, inicio, r.Dia, r.Frequencia).ToDateTime(TimeOnly.MinValue);
        }

        foreach (var doUsuario in canceladas.GroupBy(t => t.CriadoPor))
            await ReconciliarFaturasDasCanceladasAsync(doUsuario, doUsuario.Key, Guid.NewGuid(), agora);
        return canceladas.Count;
    }

    public async Task GerarPendentesAsync(Guid usuarioId)
    {
        var hoje = DateTime.UtcNow.Date;
        var amanha = DateOnly.FromDateTime(hoje).AddDays(1);
        var recorrentes = await _context.Recorrentes
            .Where(r => r.CriadoPor == usuarioId && r.Ativo && r.ExcluidoEm == null &&
                        (r.DataFim == null || r.DataFim.Value.Date >= hoje))
            .ToListAsync();

        bool houveMudanca = false;
        foreach (var r in recorrentes)
        {
            try
            {
                // O que já venceu e ainda não foi gerado (até hoje, inclusive) entra como EFETIVADO.
                houveMudanca |= await GerarOcorrenciasAsync(r, amanha, StatusTransacao.Executado) > 0;
            }
            catch (KeyNotFoundException)
            {
                // Cartão que não é do usuário (dado gravado antes da checagem de dono): pula a
                // recorrente, como o ExpandirRecorrentesJob faz — sem isso uma linha ruim derrubava a
                // listagem de recorrentes. O cartão falha já na 1ª ocorrência, então nada dela entrou.
                continue;
            }
        }

        if (houveMudanca)
            await _context.SaveChangesAsync();
    }

    /// <summary>
    /// KPIs agregados — ativas, custo mensal/anual das despesas (todas as frequências), próximas 30 dias, total.
    /// Calculado no banco, exato pra qualquer volume.
    /// </summary>
    public async Task<RecorrenteStatsDto> ObterStatsAsync(Guid usuarioId)
    {
        var hoje = DateTime.UtcNow.Date;
        var query = _context.Recorrentes.Where(r => r.CriadoPor == usuarioId && r.ExcluidoEm == null);
        // "Ativas" do hero = em vigor (MESMA regra da aba Ativas / do rótulo Situacao) e não pausada
        // (pausada não gera cobrança nem pesa no custo). Só `Ativo` não bastava: ninguém desliga o
        // Ativo quando a DataFim passa, e o hero somava no custo mensal uma conta fixa que a lista
        // logo abaixo já mostrava como "Encerrada".
        var ativas = query.Where(EmVigor(hoje)).Where(r => r.Ativo);

        var qtdAtivas = await ativas.CountAsync();
        // Custo das despesas de TODAS as frequências, levadas pro mesmo período antes de somar (semanal
        // acontece 52× no ano, mensal 12×, anual 1×). Antes só a mensal entrava: semanal e anual sumiam do
        // "custo mensal" e do "por ano" (que a tela fazia mensal × 12).
        var somaPorFrequencia = await ativas
            .Where(r => r.Tipo == TipoTransacao.Despesa)
            .GroupBy(r => r.Frequencia)
            .Select(g => new { Frequencia = g.Key, Soma = g.Sum(r => r.Valor) })
            .ToListAsync();
        decimal SomaDe(FrequenciaRecorrencia f) => somaPorFrequencia.Where(x => x.Frequencia == f).Sum(x => x.Soma);
        var custoAnual = SomaDe(FrequenciaRecorrencia.Semanal) * 52m
                         + SomaDe(FrequenciaRecorrencia.Mensal) * 12m
                         + SomaDe(FrequenciaRecorrencia.Anual);
        var custoMensal = Math.Round(custoAnual / 12m, 2, MidpointRounding.AwayFromZero);
        // Próximos 30 dias = conta fixa com cobrança PREVISTA de hoje a hoje+30 (antes olhava o cursor interno
        // da geração, que é o fim da janela gerada, não a próxima cobrança). Calculado no servidor.
        var hojeD = DateOnly.FromDateTime(hoje);
        var limite30 = hojeD.AddDays(30);
        var proximas30 = await ativas
            .Where(r => _context.Transacoes.Any(t => t.RecorrenteOrigemId == r.Id && t.Ativo
                                                     && t.StatusTransacao == StatusTransacao.Previsao
                                                     && t.Data >= hojeD && t.Data <= limite30))
            .CountAsync();
        var qtdTotal = await query.CountAsync();

        return new RecorrenteStatsDto
        {
            Ativas = qtdAtivas,
            CustoMensalDespesas = custoMensal,
            CustoAnualDespesas = custoAnual,
            Proximas30Dias = proximas30,
            QtdTotal = qtdTotal,
        };
    }

    // Regra ÚNICA de "em vigor" (não cancelada e a DataFim não passou): filtro ?status= do
    // ListarAsync, rótulo Situacao do DTO e KPIs do hero saem TODOS daqui — eram cópias e divergiram
    // (o hero contava como ativa a que a lista já mostrava "Encerrada"). Expression pra o EF
    // traduzir em SQL; em memória, compilada. `hoje` à meia-noite UTC: DataFim < hoje ⇔ o último dia
    // já passou (igual ao GerarPendentesAsync, que ainda gera no próprio dia da DataFim).
    private static Expression<Func<Recorrente, bool>> EmVigor(DateTime hoje) =>
        r => r.CanceladoEm == null && (r.DataFim == null || r.DataFim >= hoje);

    // Aba "Encerradas" = negação exata do EmVigor, montada da MESMA árvore (não reescrita à mão).
    private static Expression<Func<Recorrente, bool>> NaoEmVigor(DateTime hoje)
    {
        var emVigor = EmVigor(hoje);
        return Expression.Lambda<Func<Recorrente, bool>>(Expression.Not(emVigor.Body), emVigor.Parameters);
    }

    // Situação de UMA conta fixa (rótulo do DTO), a partir do EmVigor já compilado.
    private static string CalcularSituacao(Recorrente r, Func<Recorrente, bool> emVigor) =>
        r.CanceladoEm != null ? SituacaoRecorrente.Cancelada
        : !emVigor(r) ? SituacaoRecorrente.Encerrada
        : !r.Ativo ? SituacaoRecorrente.Pausada
        : SituacaoRecorrente.Ativa;

    /// <summary>
    /// Lista paginada das contas fixas do usuário. `status` opcional: "ativas" (ativas + pausadas) ou
    /// "encerradas" (canceladas + DataFim passada); ausente = todas (compatível com quem já chamava sem
    /// filtro); outro valor → 400. `busca` opcional: contém (sem diferenciar maiúsculas) na descrição,
    /// categoria, conta ou cartão.
    /// </summary>
    public async Task<PagedResult<RecorrenteDto>> ListarAsync(
        Guid usuarioId, int page = 1, int pageSize = 25, string? status = null, string? busca = null)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var hoje = DateTime.UtcNow.Date;

        var query = _context.Recorrentes.Where(r => r.CriadoPor == usuarioId && r.ExcluidoEm == null);

        // Filtro de situação no SERVIDOR: a lista é paginada, então filtrar só a página carregada
        // no front esconderia itens das outras páginas e o total ficaria errado.
        var statusNormalizado = status?.Trim().ToLowerInvariant();
        if (statusNormalizado == SituacaoRecorrente.FiltroAtivas)
            query = query.Where(EmVigor(hoje));
        else if (statusNormalizado == SituacaoRecorrente.FiltroEncerradas)
            query = query.Where(NaoEmVigor(hoje));
        else if (!string.IsNullOrEmpty(statusNormalizado))
            throw new ArgumentException("Status inválido. Use 'ativas' ou 'encerradas'.");

        // Busca server-side. ToLower().Contains() é portável (InMemory nos testes + lower()/LIKE no
        // Postgres); termo limitado pra não virar vetor de custo; EF parametriza (sem SQL injection).
        if (!string.IsNullOrWhiteSpace(busca))
        {
            var termo = busca.Trim().ToLower();
            if (termo.Length > 100) termo = termo[..100];
            query = query.Where(r =>
                r.Descricao.ToLower().Contains(termo)
                || (r.Categoria != null && r.Categoria.Descricao.ToLower().Contains(termo))
                || (r.Conta != null && r.Conta.Nome.ToLower().Contains(termo))
                || (r.CartaoCredito != null && r.CartaoCredito.Nome.ToLower().Contains(termo)));
        }

        query = query
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
        var emVigor = EmVigor(hoje).Compile();

        // Próxima cobrança = a previsão pendente mais próxima (hoje ou depois) de cada uma da página.
        var hojeD = DateOnly.FromDateTime(hoje);
        var idsPagina = lista.Select(r => (Guid?)r.Id).ToList();
        var proximaPorId = await _context.Transacoes
            .Where(t => idsPagina.Contains(t.RecorrenteOrigemId) && t.Ativo
                        && t.StatusTransacao == StatusTransacao.Previsao && t.Data >= hojeD)
            .GroupBy(t => t.RecorrenteOrigemId)
            .Select(g => new { Id = g.Key, Data = g.Min(t => t.Data) })
            .ToDictionaryAsync(x => x.Id!.Value, x => x.Data);

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
                ProximaCobranca = r.Ativo && r.CanceladoEm == null && proximaPorId.TryGetValue(r.Id, out var pc) ? pc : null,
                CanceladoEm = r.CanceladoEm,
                MotivoCancelamento = r.MotivoCancelamento,
                Situacao = CalcularSituacao(r, emVigor)
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
                DataProximaGeracao = null, // sem cursor: a geração abaixo começa do início, no Dia
                CriadoEm = DateTime.UtcNow
            };

            _context.Recorrentes.Add(recorrente);
            await _context.SaveChangesAsync();

            // Materializar 3 meses de previsões, no compasso do Dia (AgendaRecorrente)
            await GerarOcorrenciasAsync(recorrente, DateOnly.FromDateTime(dataFimJanela), StatusTransacao.Previsao);

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
        await BuscarDoUsuarioAsync(id, usuarioId);

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
        var recorrente = await BuscarDoUsuarioAsync(id, usuarioId);

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

            // Cancelar as previsões (o que ainda não virou cobrança) e reconciliar a fatura do cartão, cujo
            // total caiu sem pagamento.
            var transacoesFuturas = await CancelarPrevisoesAsync(id, motivo, recorrente.CanceladoEm.Value);
            await ReconciliarFaturasDasCanceladasAsync(transacoesFuturas, usuarioId, correlationId, recorrente.CanceladoEm.Value);

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
        var r = await BuscarDoUsuarioAsync(id, usuarioId);

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

        // As PRÓXIMAS cobranças seguem o que vale agora (dia, valor, conta…): cancela as previsões de hoje em
        // diante e gera de novo. Antes ficavam com o dia/valor antigos. Dia que já foi efetivado não repete.
        if (r.Ativo && r.CanceladoEm == null)
        {
            var agora = DateTime.UtcNow;
            var hoje = DateOnly.FromDateTime(agora);
            var canceladas = await CancelarPrevisoesAsync(r.Id, "Conta fixa alterada", agora, aPartirDe: hoje);
            await ReconciliarFaturasDasCanceladasAsync(canceladas, usuarioId, Guid.NewGuid(), agora);
            r.DataProximaGeracao = AgendaRecorrente.ProximaEmOuDepois(
                hoje, DateOnly.FromDateTime(r.DataInicio), r.Dia, r.Frequencia).ToDateTime(TimeOnly.MinValue);
            await GerarOcorrenciasAsync(r, AgendaRecorrente.HorizonteExpansao(hoje), StatusTransacao.Previsao);
        }

        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// Pausa ou retoma. PAUSAR cancela as previsões (o que ainda não virou cobrança) — antes só invertia o
    /// `Ativo` e o ExecutarRecorrentesJob seguia efetivando tudo. RETOMAR recomeça da próxima data a partir de
    /// HOJE: os meses parados não são cobrados depois.
    /// </summary>
    public async Task ToggleAtivoAsync(Guid id, Guid usuarioId)
    {
        var r = await BuscarDoUsuarioAsync(id, usuarioId);

        // Cancelar é definitivo (as previsões futuras já foram canceladas junto): só a PAUSADA volta.
        // Antes a tela oferecia "Ativar" numa cancelada e este toggle a religava — voltava a gerar
        // cobrança com o cancelamento ainda registrado. A tela já não oferece; aqui é a 2ª camada.
        if (r.CanceladoEm != null)
            throw new InvalidOperationException("Conta fixa cancelada não pode ser pausada nem retomada.");

        var agora = DateTime.UtcNow;
        var hoje = DateOnly.FromDateTime(agora);
        var correlationId = Guid.NewGuid();

        if (r.Ativo)
        {
            r.Ativo = false;
            var canceladas = await CancelarPrevisoesAsync(r.Id, "Conta fixa pausada", agora);
            await ReconciliarFaturasDasCanceladasAsync(canceladas, usuarioId, correlationId, agora);
            _eventLogService.Registrar(usuarioId, FinancialEventType.RecorrentePausada, "Recorrente", r.Id,
                correlationId, "Service:RecorrenteService", payload: new { previsoesCanceladas = canceladas.Count });
        }
        else
        {
            r.Ativo = true;
            r.DataProximaGeracao = AgendaRecorrente.ProximaEmOuDepois(
                hoje, DateOnly.FromDateTime(r.DataInicio), r.Dia, r.Frequencia).ToDateTime(TimeOnly.MinValue);
            var criadas = await GerarOcorrenciasAsync(r, AgendaRecorrente.HorizonteExpansao(hoje), StatusTransacao.Previsao);
            _eventLogService.Registrar(usuarioId, FinancialEventType.RecorrenteRetomada, "Recorrente", r.Id,
                correlationId, "Service:RecorrenteService", payload: new { previsoesCriadas = criadas });
        }

        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// Exclusão LÓGICA: some das listas e as previsões são canceladas; o que já foi cobrado fica no histórico.
    /// Antes apagava a linha (`Remove`) e as previsões ficavam soltas — e o ExecutarRecorrentesJob seguia
    /// cobrando. Excluída de novo = 404.
    /// </summary>
    public async Task DeletarAsync(Guid id, Guid usuarioId)
    {
        var r = await BuscarDoUsuarioAsync(id, usuarioId);
        var agora = DateTime.UtcNow;
        var correlationId = Guid.NewGuid();

        r.ExcluidoEm = agora;
        r.Ativo = false;
        var canceladas = await CancelarPrevisoesAsync(r.Id, "Conta fixa excluída", agora);
        await ReconciliarFaturasDasCanceladasAsync(canceladas, usuarioId, correlationId, agora);
        _eventLogService.Registrar(usuarioId, FinancialEventType.RecorrenteExcluida, "Recorrente", r.Id,
            correlationId, "Service:RecorrenteService", payload: new { previsoesCanceladas = canceladas.Count });

        await _context.SaveChangesAsync();
    }
}

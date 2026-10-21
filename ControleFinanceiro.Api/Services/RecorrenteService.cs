using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.DTOs.Recorrente;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Linq.Expressions;

namespace ControleFinanceiro.Api.Services;

public class RecorrenteService
{
    private readonly AppDbContext _context;
    private readonly FaturaService _faturaService;
    private readonly FinancialEventLogService _eventLogService;

    public RecorrenteService(AppDbContext context, FaturaService faturaService, FinancialEventLogService eventLogService)
    {
        _context = context;
        _faturaService = faturaService;
        _eventLogService = eventLogService;
    }

    private static string DescricaoFrequencia(FrequenciaRecorrencia freq) => freq switch
    {
        FrequenciaRecorrencia.Semanal => "Semanal",
        FrequenciaRecorrencia.Mensal => "Mensal",
        FrequenciaRecorrencia.Anual => "Anual",
        _ => freq.ToString()
    };

    public const string MensagemSubcategoriaDeOutraCategoria = "Subcategoria não pertence à categoria selecionada.";

    // Conta, cartão, categoria e subcategoria vêm do cliente: todos têm que ser do usuário (categoria e
    // subcategoria podem ser globais). A subcategoria ainda tem que ser DA categoria escolhida — senão a
    // cobrança ia sair "Moradia › Hortifruti".
    private async Task ExigirReferenciasDoUsuarioAsync(Guid? contaId, Guid? cartaoId, Guid? categoriaId, Guid? subcategoriaId, Guid usuarioId)
    {
        if (contaId.HasValue) await DonoRecursos.ExigirContaAbertaAsync(_context, contaId.Value, usuarioId);
        if (cartaoId.HasValue) await DonoRecursos.ExigirCartaoAsync(_context, cartaoId.Value, usuarioId);
        if (categoriaId.HasValue) await DonoRecursos.ExigirCategoriaAsync(_context, categoriaId.Value, usuarioId);
        if (subcategoriaId.HasValue)
        {
            await DonoRecursos.ExigirSubcategoriaAsync(_context, subcategoriaId.Value, usuarioId);
            var daCategoria = await _context.Subcategorias.AsNoTracking()
                .AnyAsync(s => s.Id == subcategoriaId.Value && s.CategoriaId == categoriaId);
            if (!daCategoria)
                throw new ArgumentException(MensagemSubcategoriaDeOutraCategoria);
        }
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
    /// (sem a flag ficava fora do total e do limite). PERÍODO (competência — mês/ano/semana, ver
    /// <see cref="AgendaRecorrente.Competencia"/>) que já tem ocorrência VIVA dessa conta fixa (efetivada ou
    /// prevista, em qualquer dia) é pulado: trocar o Dia de 5 pra 20 com o dia 5 já cobrado não cobra o mês de
    /// novo no dia 20 (antes conferia a data exata e cobrava). Toda ocorrência nova sai com a competência — o
    /// índice único parcial segura a corrida entre duas requisições. Percorre no máximo <see cref="AgendaRecorrente.MaxDatasPorGeracao"/> datas por chamada (o cursor
    /// fica onde parou). Retorna quantas criou. Não salva.
    /// </summary>
    public async Task<int> GerarOcorrenciasAsync(Recorrente r, DateOnly ateExclusivo, StatusTransacao status)
    {
        var inicio = DateOnly.FromDateTime(r.DataInicio);
        DateOnly? fim = r.DataFim is { } df ? DateOnly.FromDateTime(df) : null;
        var proxima = AgendaRecorrente.ProximaEmOuDepois(
            r.DataProximaGeracao is { } cursor ? DateOnly.FromDateTime(cursor) : inicio, inicio, r.Dia, r.Frequencia);

        // Em dia (nada a gerar até o limite): só normaliza o cursor, sem ir ao banco — é o caso de quase toda
        // conta fixa no GET da lista e no job diário.
        if (proxima >= ateExclusivo || (fim != null && proxima > fim))
        {
            r.DataProximaGeracao = proxima.ToDateTime(TimeOnly.MinValue);
            return 0;
        }

        // Períodos ocupados, do banco E da memória: ocorrência VIVA, ou que o USUÁRIO excluiu (status Cancelado —
        // o motor só desliga o Ativo, nunca põe Cancelado): mês que ele pulou não volta ao alterar/retomar.
        // Cancelada pelo motor agora (ainda não salva) não conta; criada agora conta. Carrega as entidades (não
        // projeção): a projeção leria o Ativo do BANCO e contaria a cancelada-ainda-não-salva. Todas, não só a
        // partir do cursor: a cobrança do período pode estar num dia antes dele. Ocorrência antiga sem
        // competência (de antes da coluna) conta pela data.
        var doBanco = await _context.Transacoes
            .IgnoreQueryFilters()
            .Where(t => t.RecorrenteOrigemId == r.Id && (t.Ativo || t.StatusTransacao == StatusTransacao.Cancelado))
            .ToListAsync();
        var ocupadas = doBanco
            .Concat(_context.Transacoes.Local.Where(t => t.RecorrenteOrigemId == r.Id))
            .Where(t => t.Ativo || t.StatusTransacao == StatusTransacao.Cancelado)
            .Select(t => t.Competencia ?? AgendaRecorrente.Competencia(t.Data, inicio, r.Frequencia))
            .ToHashSet();

        // Conta fixa da casa: cada cobrança nasce dividida (parte gravada pela regra da família). Quem saiu da
        // família (ou virou "só vê"), ou família dissolvida: a cobrança sai só da pessoa.
        var casa = await FamiliaParaDividirAsync(r);
        var criadas = 0;
        var percorridas = 0;
        while (proxima < ateExclusivo && (fim == null || proxima <= fim)
               && percorridas++ < AgendaRecorrente.MaxDatasPorGeracao)
        {
            var competencia = AgendaRecorrente.Competencia(proxima, inicio, r.Frequencia);
            if (!ocupadas.Contains(competencia))
            {
                Guid? faturaId = null;
                if (r.CartaoCreditoId.HasValue)
                    faturaId = (await _faturaService.ObterOuCriarFaturaAsync(r.CartaoCreditoId.Value, proxima, r.CriadoPor)).Id;

                var ocorrencia = new Transacao
                {
                    Id = Guid.NewGuid(),
                    Descricao = r.Descricao,
                    Valor = r.Valor,
                    Tipo = r.Tipo,
                    CategoriaId = r.CategoriaId,
                    SubcategoriaId = r.SubcategoriaId,
                    ContaId = r.ContaId,
                    CartaoCreditoId = r.CartaoCreditoId,
                    FaturaId = faturaId,
                    UsadoComoCredito = r.CartaoCreditoId.HasValue,
                    MeioPagamento = r.MeioPagamento ?? (r.CartaoCreditoId.HasValue ? MeioPagamento.Credito : null),
                    StatusTransacao = status,
                    Ativo = true,
                    CriadoPor = r.CriadoPor,
                    Data = proxima,
                    Hora = null, // ocorrência de conta fixa é datada (sem hora de relógio)
                    RecorrenteOrigemId = r.Id,
                    Competencia = competencia,
                    CriadoEm = DateTime.UtcNow
                };
                _context.Transacoes.Add(ocorrencia);
                if (casa is { } c)
                {
                    // Combinada uma vez ao marcar a conta fixa: a cobrança não passa de novo pela aprovação.
                    ocorrencia.FamiliaId = c.FamiliaId;
                    ocorrencia.StatusAprovacao = StatusAprovacaoDespesa.NaoRequerida;
                    await new RateioService(_context).AplicarPartesAsync(ocorrencia, c.FamiliaId, c.Modo, null);
                }
                else
                    // Conta fixa só da pessoa, mas paga numa conta/cartão da casa: a cobrança nasce dividida mesmo assim.
                    await new RateioService(_context).DividirSeForDaCasaAsync(ocorrencia);
                ocupadas.Add(competencia);
                criadas++;
            }
            proxima = AgendaRecorrente.Seguinte(proxima, inicio, r.Dia, r.Frequencia);
        }

        r.DataProximaGeracao = proxima.ToDateTime(TimeOnly.MinValue);
        return criadas;
    }

    /// <summary>A família com quem a cobrança nasce dividida, e o jeito (o padrão dela; "Do meu jeito" começa igual):
    /// só se a conta fixa é da casa, é conta a pagar, a família está ativa e quem criou ainda lança nela.</summary>
    private async Task<(Guid FamiliaId, ModoRateio Modo)?> FamiliaParaDividirAsync(Recorrente r)
    {
        if (r.FamiliaId is not { } fid || r.Tipo != TipoTransacao.Despesa) return null;
        var familia = await _context.Familias.Where(f => f.Id == fid && f.Ativa)
            .Select(f => new { f.ModoRateioPadrao }).FirstOrDefaultAsync();
        if (familia is null) return null;
        return await FamiliaPermissoes.LancaNaFamiliaAsync(_context, fid, r.CriadoPor)
            ? (fid, RateioService.ModoAoDividir(familia.ModoRateioPadrao)) : null;
    }

    /// <summary>A família pedida no cadastro da conta fixa (conta da casa): só conta a pagar, de família ativa em que
    /// a pessoa lança. Null = só dela.</summary>
    private async Task<Guid?> FamiliaDoCadastroAsync(CriarRecorrenteDto dto, Guid usuarioId)
    {
        if (dto.FamiliaId is not { } fid) return null;
        if ((TipoTransacao)dto.Tipo != TipoTransacao.Despesa)
            throw new ArgumentException("Só conta a pagar se divide com a família.");
        await FamiliaPermissoes.ExigirLancarAsync(_context, fid, usuarioId);
        if (!await _context.Familias.AnyAsync(f => f.Id == fid && f.Ativa))
            throw new KeyNotFoundException("Família não encontrada.");
        return fid;
    }

    // Cancela (exclusão lógica) as previsões dessa conta fixa que ainda não viraram cobrança — todas, ou só as
    // de `aPartirDe` em diante. `preservarEditadas`: a ocorrência que o usuário alterou fica (alterar a conta
    // fixa não apaga a edição dele). Devolve as canceladas (pra reconciliar a fatura do cartão). Não salva.
    private async Task<List<Transacao>> CancelarPrevisoesAsync(
        Guid recorrenteId, string motivo, DateTime agora, DateOnly? aPartirDe = null, bool preservarEditadas = false)
    {
        var query = _context.Transacoes.Where(t => t.RecorrenteOrigemId == recorrenteId
                                                   && t.StatusTransacao == StatusTransacao.Previsao
                                                   && t.Ativo);
        if (aPartirDe is { } desde)
            query = query.Where(t => t.Data >= desde);
        if (preservarEditadas)
            query = query.Where(t => !t.EditadaPeloUsuario);
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
    /// Quem o realinhamento precisa ver hoje — duas consultas que normalmente voltam VAZIAS (antes carregava toda
    /// previsão pendente de todos os usuários, todo dia): (1) conta fixa com previsão pendente que não deve mais
    /// cobrar (pausada, cancelada, excluída, ou sem a linha); (2) conta fixa ativa que ainda não passou pelo
    /// conserto único de legado (<see cref="Recorrente.RealinhadoEm"/> nulo).
    /// </summary>
    public async Task<List<Guid>> IdsParaRealinharAsync()
    {
        var naoDeveCobrar = await _context.Transacoes
            .Where(t => t.RecorrenteOrigemId != null && t.StatusTransacao == StatusTransacao.Previsao && t.Ativo
                        && !_context.Recorrentes.Any(r => r.Id == t.RecorrenteOrigemId
                                                          && r.Ativo && r.CanceladoEm == null && r.ExcluidoEm == null))
            .Select(t => t.RecorrenteOrigemId!.Value)
            .Distinct()
            .ToListAsync();
        var semConserto = await _context.Recorrentes
            .Where(r => r.RealinhadoEm == null && r.Ativo && r.CanceladoEm == null && r.ExcluidoEm == null)
            .Select(r => r.Id)
            .ToListAsync();
        return naoDeveCobrar.Union(semConserto).ToList();
    }

    /// <summary>
    /// Conserto de dado de UMA conta fixa (unidade do job: cada uma grava sozinha, conflito numa não adia as
    /// outras). Roda na expansão diária, ANTES de expandir e antes do ExecutarRecorrentesJob: (1) não deve mais
    /// cobrar (pausada, cancelada, excluída, ou apagada antes da exclusão lógica) → cancela as previsões
    /// pendentes; (2) ativa sem o conserto único → se tem previsão futura FORA do dia certo (gerada antes da
    /// regra do <c>Dia</c>), cancela as futuras e volta o cursor pro INÍCIO DO PERÍODO atual — a expansão logo
    /// depois gera de novo no compasso, só nos períodos sem cobrança (o mês já cobrado no dia antigo não é
    /// cobrado de novo; o que ficou sem ganha a sua, mesmo com o dia já passado — o ExecutarRecorrentesJob
    /// efetiva); e marca <see cref="Recorrente.RealinhadoEm"/> (não repete). Ocorrência que o usuário alterou
    /// fica como ele deixou. Não salva. Devolve quantas previsões cancelou.
    /// </summary>
    public async Task<int> RealinharAsync(Guid recorrenteOrigemId, DateOnly hoje)
    {
        var agora = DateTime.UtcNow;
        var r = await _context.Recorrentes.FirstOrDefaultAsync(x => x.Id == recorrenteOrigemId);
        var pendentes = await _context.Transacoes
            .Where(t => t.RecorrenteOrigemId == recorrenteOrigemId && t.StatusTransacao == StatusTransacao.Previsao && t.Ativo)
            .ToListAsync();

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

        if (r == null || !r.Ativo || r.CanceladoEm != null || r.ExcluidoEm != null)
        {
            Cancelar(pendentes, "Conta fixa não está mais ativa");
        }
        else if (r.RealinhadoEm == null)
        {
            var inicio = DateOnly.FromDateTime(r.DataInicio);
            var futuras = pendentes.Where(t => t.Data >= hoje && !t.EditadaPeloUsuario).ToList();
            if (!futuras.All(t => AgendaRecorrente.NoCompasso(t.Data, inicio, r.Dia, r.Frequencia)))
            {
                Cancelar(futuras, "Realinhada ao dia da conta fixa");
                r.DataProximaGeracao = AgendaRecorrente.ProximaEmOuDepois(
                    AgendaRecorrente.InicioDoPeriodo(hoje, inicio, r.Frequencia), inicio, r.Dia, r.Frequencia)
                    .ToDateTime(TimeOnly.MinValue);
            }
            r.RealinhadoEm = agora;
        }

        foreach (var doUsuario in canceladas.GroupBy(t => t.CriadoPor))
            await ReconciliarFaturasDasCanceladasAsync(doUsuario, doUsuario.Key, Guid.NewGuid(), agora);
        return canceladas.Count;
    }

    /// <summary>Realinha todas as que precisam (<see cref="IdsParaRealinharAsync"/>), sem salvar. O job usa a
    /// versão por conta fixa pra gravar uma a uma.</summary>
    public async Task<int> RealinharAsync(DateOnly hoje)
    {
        var total = 0;
        foreach (var id in await IdsParaRealinharAsync())
            total += await RealinharAsync(id, hoje);
        return total;
    }

    public async Task GerarPendentesAsync(Guid usuarioId)
    {
        var hoje = HorarioBrasil.HojeData();
        var amanha = DateOnly.FromDateTime(hoje).AddDays(1);
        var recorrentes = await _context.Recorrentes
            .Where(r => r.CriadoPor == usuarioId && r.Ativo && r.ExcluidoEm == null &&
                        (r.DataFim == null || r.DataFim.Value.Date >= hoje) &&
                        // Só as que têm cobrança vencida a lançar (cursor até hoje) — as em dia nem são lidas.
                        (r.DataProximaGeracao == null || r.DataProximaGeracao <= hoje))
            .ToListAsync();

        bool houveMudanca = false;
        foreach (var r in recorrentes)
        {
            try
            {
                // O que já venceu e ainda não foi gerado (até hoje, inclusive) entra como EFETIVADO. No cartão nasce
                // prevista e é cobrada logo abaixo pela regra do limite (a que não cabe fica prevista; o job avisa).
                houveMudanca |= await GerarOcorrenciasAsync(r, amanha,
                    r.CartaoCreditoId.HasValue ? StatusTransacao.Previsao : StatusTransacao.Executado) > 0;
            }
            catch (KeyNotFoundException)
            {
                // Cartão que não é do usuário (dado gravado antes da checagem de dono): pula a
                // recorrente, como o ExpandirRecorrentesJob faz — sem isso uma linha ruim derrubava a
                // listagem de recorrentes. O cartão falha já na 1ª ocorrência, então nada dela entrou.
                continue;
            }
        }

        if (!houveMudanca) return;
        var vencidasNoCartao = _context.ChangeTracker.Entries<Transacao>()
            .Where(e => e.State == EntityState.Added).Select(e => e.Entity)
            .Where(t => t.RecorrenteOrigemId != null && t.CartaoCreditoId != null
                        && t.StatusTransacao == StatusTransacao.Previsao && t.Data < amanha)
            .ToList();
        if (vencidasNoCartao.Count > 0)
            await RegrasFinanceiras.CobrarOcorrenciasAsync(_context, vencidasNoCartao);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex is DbUpdateConcurrencyException || EhViolacaoDeUnicidade(ex))
        {
            // Corrida GET×GET (duas abas abrindo a lista) ou GET×job: a outra já gerou as MESMAS ocorrências
            // (índice único da competência) ou mexeu no cursor (xmin). Nada desta tentativa foi gravado
            // (SaveChanges é atômico) — descarta e segue; a lista lê o que a outra gravou.
            _context.ChangeTracker.Clear();
        }
    }

    // Grava a operação do usuário. Ocorrência repetida no mesmo período (índice único — duas requisições
    // gerando ao mesmo tempo) vira o mesmo 409 da concorrência otimista, não 500.
    private async Task SalvarAsync()
    {
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex is not DbUpdateConcurrencyException && EhViolacaoDeUnicidade(ex))
        {
            throw new DbUpdateConcurrencyException("Conta fixa alterada por outra operação ao mesmo tempo.", ex);
        }
    }

    /// <summary>Violação de índice único no Postgres (SqlState 23505) dentro do DbUpdateException.</summary>
    private static bool EhViolacaoDeUnicidade(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    /// <summary>
    /// KPIs agregados — ativas, custo mensal/anual das despesas (todas as frequências), próximas 30 dias, total.
    /// Calculado no banco, exato pra qualquer volume.
    /// </summary>
    public async Task<RecorrenteStatsDto> ObterStatsAsync(Guid usuarioId)
    {
        var hoje = HorarioBrasil.HojeData();
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
        var hoje = HorarioBrasil.HojeData();

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
            .Include(r => r.Subcategoria)
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
            Items = lista.Select(r => ParaDto(r, emVigor, proximaPorId)),
            Total = total,
            Page = page,
            PageSize = pageSize,
        };
    }

    /// <summary>
    /// UMA conta fixa do usuário, no mesmo formato da lista. O criar devolvia a recém-criada procurando
    /// na 1ª página da lista (25, por ordem de nome): com mais contas fixas ela podia cair fora, e a API
    /// respondia erro DEPOIS de gravar — o usuário tentava de novo e duplicava.
    /// </summary>
    public async Task<RecorrenteDto> ObterAsync(Guid id, Guid usuarioId)
    {
        var r = await _context.Recorrentes
            .Include(x => x.Categoria)
            .Include(x => x.Subcategoria)
            .Include(x => x.Conta)
            .Include(x => x.CartaoCredito)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.CriadoPor == usuarioId && x.ExcluidoEm == null)
            ?? throw new KeyNotFoundException("Recorrente não encontrado.");

        var hoje = HorarioBrasil.HojeData();
        var hojeD = DateOnly.FromDateTime(hoje);
        var proxima = await _context.Transacoes
            .Where(t => t.RecorrenteOrigemId == id && t.Ativo
                        && t.StatusTransacao == StatusTransacao.Previsao && t.Data >= hojeD)
            .OrderBy(t => t.Data)
            .Select(t => (DateOnly?)t.Data)
            .FirstOrDefaultAsync();
        var proximaPorId = proxima is { } d ? new Dictionary<Guid, DateOnly> { [id] = d } : new Dictionary<Guid, DateOnly>();

        return ParaDto(r, EmVigor(hoje).Compile(), proximaPorId);
    }

    private static RecorrenteDto ParaDto(Recorrente r, Func<Recorrente, bool> emVigor, IReadOnlyDictionary<Guid, DateOnly> proximaPorId) => new()
    {
        Id = r.Id,
        Descricao = r.Descricao,
        Valor = r.Valor,
        Tipo = (int)r.Tipo,
        TipoDescricao = r.Tipo == TipoTransacao.Receita ? "Receita" : "Despesa",
        CategoriaId = r.CategoriaId,
        CategoriaNome = r.Categoria?.Descricao,
        SubcategoriaId = r.SubcategoriaId,
        SubcategoriaNome = r.Subcategoria?.Nome,
        ContaId = r.ContaId,
        ContaNome = r.Conta?.Nome,
        CartaoCreditoId = r.CartaoCreditoId,
        CartaoCreditoNome = r.CartaoCredito?.Nome,
        MeioPagamento = r.MeioPagamento.HasValue ? (int)r.MeioPagamento.Value : null,
        MeioPagamentoDescricao = r.MeioPagamento.Descricao(),
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
        Situacao = CalcularSituacao(r, emVigor),
        FamiliaId = r.FamiliaId,
    };

    /// <summary>Operação no <see cref="RegistroIdempotencia"/> (espaço de chaves da criação de conta fixa).</summary>
    public const string OperacaoCriarContaFixa = "CriarContaFixa";

    /// <summary>Mensagem do 409 quando a chave já criou uma conta fixa com OUTROS dados.</summary>
    public const string MensagemChaveComOutrosDados =
        "Esta conta fixa já foi registrada com outros dados. Recarregue a lista antes de criar de novo.";

    /// <summary>
    /// Cria a conta fixa e materializa 3 meses de previsões. Idempotente por <paramref name="idempotencyKey"/>
    /// (<see cref="RegistroIdempotencia"/>, no mesmo SaveChanges da conta fixa): a mesma chave devolve a
    /// conta fixa original em vez de criar outra (e as previsões em dobro); mesma chave com outros dados
    /// → 409. O controller exige a chave; sem ela (chamada interna) não há proteção contra repetição.
    /// </summary>
    public async Task<RecorrenteDto> CriarAsync(CriarRecorrenteDto dto, Guid usuarioId, string? idempotencyKey = null)
    {
        if (idempotencyKey?.Length > RegistroIdempotencia.ChaveMaxLength)
            throw new ArgumentException(
                $"O header Idempotency-Key aceita no máximo {RegistroIdempotencia.ChaveMaxLength} caracteres.");

        // Replay ANTES das regras: o retry de um pedido que já gravou devolve o mesmo sucesso.
        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            var anterior = await BuscarCriacaoPorChaveAsync(usuarioId, idempotencyKey, dto);
            if (anterior != null)
                return anterior;
        }

        // Validar ContaId XOR CartaoCreditoId
        if ((dto.ContaId == null && dto.CartaoCreditoId == null) ||
            (dto.ContaId != null && dto.CartaoCreditoId != null))
            throw new ArgumentException("Recorrente deve ter exatamente uma origem: ContaId OU CartaoCreditoId.");

        var meio = MeioDaContaFixa(dto);
        Guid recorrenteId = Guid.NewGuid();
        var correlationId = Guid.NewGuid();
        var dataInicio = dto.DataInicio.ToUniversalTime();
        AgendaRecorrente.ValidarPeriodo(
            DateOnly.FromDateTime(dataInicio),
            dto.DataFim is { } fimDto ? DateOnly.FromDateTime(fimDto.ToUniversalTime()) : null,
            HorarioBrasil.Hoje());

        // Dentro de uma transação de quem chamou (edição que vira conta fixa), participa dela.
        var proprioTx = _context.Database.CurrentTransaction is null;
        await using var transaction = proprioTx ? await _context.Database.BeginTransactionAsync() : null;
        try
        {
            // Origem (conta/cartão) e categoria vêm do cliente — todas têm que ser do usuário.
            await ExigirReferenciasDoUsuarioAsync(dto.ContaId, dto.CartaoCreditoId, dto.CategoriaId, dto.SubcategoriaId, usuarioId);
            var familiaId = await FamiliaDoCadastroAsync(dto, usuarioId);

            var recorrente = new Recorrente
            {
                Id = recorrenteId,
                Descricao = dto.Descricao,
                Valor = dto.Valor,
                Tipo = (TipoTransacao)dto.Tipo,
                CategoriaId = dto.CategoriaId,
                SubcategoriaId = dto.SubcategoriaId,
                ContaId = dto.ContaId,
                CartaoCreditoId = dto.CartaoCreditoId,
                MeioPagamento = meio,
                Frequencia = (FrequenciaRecorrencia)dto.Frequencia,
                Dia = dto.Dia,
                DataInicio = dataInicio,
                DataFim = dto.DataFim?.ToUniversalTime(),
                Ativo = true,
                CriadoPor = usuarioId,
                DataProximaGeracao = null, // sem cursor: a geração abaixo começa do início, no Dia
                RealinhadoEm = DateTime.UtcNow, // nasce no motor novo: não tem legado pra consertar
                CriadoEm = DateTime.UtcNow,
                FamiliaId = familiaId,
            };

            _context.Recorrentes.Add(recorrente);

            // Chave no MESMO SaveChanges da conta fixa (e na mesma transação das previsões): duas
            // requisições simultâneas com a mesma chave → o índice único estoura na 2ª e ela vira
            // replay. Tentativa que falha antes daqui não gasta a chave.
            if (!string.IsNullOrWhiteSpace(idempotencyKey))
                _context.RegistrosIdempotencia.Add(new RegistroIdempotencia
                {
                    Id = Guid.NewGuid(),
                    UsuarioId = usuarioId,
                    Operacao = OperacaoCriarContaFixa,
                    Chave = idempotencyKey,
                    ReferenciaId = recorrenteId,
                    CriadoEm = DateTime.UtcNow,
                });
            await _context.SaveChangesAsync();

            // O que já venceu (início no passado) entra EFETIVADO, como o "lançar o que passou" da edição e o
            // GerarPendentesAsync; a de hoje fica prevista (o ExecutarRecorrentesJob efetiva). No cartão nasce
            // prevista e passa pela regra do limite. Antes tudo nascia previsto e o saldo ficava errado até o job
            // rodar. Depois, as previsões até o horizonte da edição e do ExpandirRecorrentesJob (1º de janeiro do
            // ano que vem), ou 3 meses a contar do início, se for mais longe (início no futuro). Só os 3 meses do
            // início deixavam "Aluguel desde agosto" sem as cobranças de novembro em diante até o job da madrugada.
            var hoje = HorarioBrasil.Hoje();
            await GerarOcorrenciasAsync(recorrente, hoje,
                recorrente.CartaoCreditoId.HasValue ? StatusTransacao.Previsao : StatusTransacao.Executado);
            var vencidasNoCartao = _context.ChangeTracker.Entries<Transacao>()
                .Where(e => e.State == EntityState.Added).Select(e => e.Entity)
                .Where(t => t.RecorrenteOrigemId == recorrente.Id && t.CartaoCreditoId != null
                            && t.StatusTransacao == StatusTransacao.Previsao && t.Data < hoje)
                .ToList();
            if (vencidasNoCartao.Count > 0)
                await RegrasFinanceiras.CobrarOcorrenciasAsync(_context, vencidasNoCartao);
            var tresMeses = DateOnly.FromDateTime(dataInicio.AddMonths(3));
            var horizonte = AgendaRecorrente.HorizonteExpansao(hoje);
            await GerarOcorrenciasAsync(recorrente, tresMeses > horizonte ? tresMeses : horizonte, StatusTransacao.Previsao);

            await _context.SaveChangesAsync();

            // Log evento. Sem idempotencyKey no payload de propósito: a chave deste fluxo mora no
            // RegistroIdempotencia, e o LIKE dos fluxos antigos não deve enxergá-la.
            _eventLogService.Registrar(
                usuarioId,
                FinancialEventType.RecorrenteCriada,
                "Recorrente",
                recorrenteId,
                correlationId,
                "Service:RecorrenteService",
                payload: new { descricao = recorrente.Descricao, valor = recorrente.Valor });

            await _context.SaveChangesAsync();
            if (transaction != null)
                await transaction.CommitAsync();
        }
        catch (DbUpdateException ex) when (!string.IsNullOrWhiteSpace(idempotencyKey) && EhViolacaoDeUnicidade(ex))
        {
            // Corrida: outra requisição com a MESMA chave gravou primeiro. Nada desta foi persistido
            // (rollback) — devolve a conta fixa vencedora como replay (ou 409 se os dados divergem).
            if (transaction != null)
                await transaction.RollbackAsync();
            _context.ChangeTracker.Clear();
            var vencedora = await BuscarCriacaoPorChaveAsync(usuarioId, idempotencyKey, dto);
            if (vencedora != null)
                return vencedora;
            throw;
        }
        catch
        {
            if (transaction != null)
                await transaction.RollbackAsync();
            throw;
        }

        return await ObterAsync(recorrenteId, usuarioId);
    }

    /// <summary>
    /// Conta fixa já criada com esta chave (replay) ou null se a chave é nova pra este usuário.
    /// 409 (<see cref="InvalidOperationException"/>) se a chave já criou outra coisa — conta fixa
    /// excluída depois, ou com dados diferentes de <paramref name="dto"/>.
    /// </summary>
    private async Task<RecorrenteDto?> BuscarCriacaoPorChaveAsync(Guid usuarioId, string chave, CriarRecorrenteDto dto)
    {
        var registro = await _context.RegistrosIdempotencia
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.UsuarioId == usuarioId
                                      && r.Operacao == OperacaoCriarContaFixa
                                      && r.Chave == chave);
        if (registro == null)
            return null;

        var original = await _context.Recorrentes
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == registro.ReferenciaId && r.CriadoPor == usuarioId);

        // Criada e depois excluída: a chave segue consumida — o retry não pode recriar a conta fixa.
        if (original == null || original.ExcluidoEm != null)
            throw new InvalidOperationException(
                "Esta Idempotency-Key já foi usada. Gere uma nova chave e tente de novo.");

        // Mesma chave com dados DIFERENTES não é o mesmo pedido (draft IETF httpapi-idempotency-key):
        // devolver a original diria "criada" pra algo que não foi feito.
        if (!MesmosDadosDaContaFixa(original, dto))
            throw new InvalidOperationException(MensagemChaveComOutrosDados);

        return await ObterAsync(original.Id, usuarioId);
    }

    /// <summary>
    /// Como a conta fixa é paga: no cartão é sempre Crédito; numa conta, qualquer meio menos Crédito (crédito
    /// numa conta não existe — é cartão). Valor fora do enum → 400.
    /// </summary>
    private static MeioPagamento? MeioDaContaFixa(CriarRecorrenteDto dto)
    {
        var meio = MeioPagamentoExtensions.DoCliente(dto.MeioPagamento);
        if (dto.CartaoCreditoId.HasValue) return MeioPagamento.Credito;
        if (meio == MeioPagamento.Credito)
            throw new ArgumentException("Crédito é no cartão: escolha o cartão em vez da conta.");
        return meio;
    }

    /// <summary>
    /// O retry traz o mesmo pedido que criou <paramref name="original"/>? Compara com o que foi GRAVADO
    /// (mesmas conversões do INSERT). Datas só pelo dia: a agenda da conta fixa é por dia.
    /// </summary>
    private static bool MesmosDadosDaContaFixa(Recorrente original, CriarRecorrenteDto dto) =>
        original.Descricao == dto.Descricao
        && original.Valor == dto.Valor
        && (int)original.Tipo == dto.Tipo
        && original.CategoriaId == dto.CategoriaId
        && original.SubcategoriaId == dto.SubcategoriaId
        && original.ContaId == dto.ContaId
        && original.CartaoCreditoId == dto.CartaoCreditoId
        && original.MeioPagamento == MeioDaContaFixa(dto)
        && (int)original.Frequencia == dto.Frequencia
        && original.Dia == dto.Dia
        && DateOnly.FromDateTime(original.DataInicio) == DateOnly.FromDateTime(dto.DataInicio.ToUniversalTime())
        && (original.DataFim is { } fim ? DateOnly.FromDateTime(fim) : (DateOnly?)null)
           == (dto.DataFim is { } fimDto ? DateOnly.FromDateTime(fimDto.ToUniversalTime()) : null);

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
            // Cobrança da casa: as partes acompanham o valor novo (mesmo % de cada um).
            await new RateioService(_context).RegravarPeloValorAsync(proxima);
        }
        if (dto.Descricao != null)
            proxima.Descricao = dto.Descricao;
        // Editada à mão: alterar a conta fixa e o realinhamento não desfazem (antes regeravam por cima).
        proxima.EditadaPeloUsuario = true;
        if (dto.CategoriaId.HasValue)
        {
            await DonoRecursos.ExigirCategoriaAsync(_context, dto.CategoriaId.Value, usuarioId);
            // A subcategoria herdada é da categoria antiga: trocou a categoria, ela cai.
            if (proxima.CategoriaId != dto.CategoriaId) proxima.SubcategoriaId = null;
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

        // Cancelar é idempotente pelo próprio estado: já cancelada (duplo clique, retry de rede) devolve
        // o cancelamento que vale, sem mexer de novo nem registrar outro evento. Antes a idempotência era
        // a busca da chave no JSON do FinancialEventLog — que achava a chave de QUALQUER operação e
        // então pulava o cancelamento sem cancelar nada.
        if (recorrente.CanceladoEm != null)
            return new { canceladoEm = recorrente.CanceladoEm, motivo = recorrente.MotivoCancelamento };

        var correlationId = Guid.NewGuid();

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
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
                payload: new { motivo, transacoesCanceladas = transacoesFuturas.Count });

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
        await ExigirReferenciasDoUsuarioAsync(dto.ContaId, dto.CartaoCreditoId, dto.CategoriaId, dto.SubcategoriaId, usuarioId);
        // Marcar/desmarcar da casa vale pras PRÓXIMAS cobranças (as previsões são geradas de novo abaixo).
        r.FamiliaId = await FamiliaDoCadastroAsync(dto, usuarioId);
        // O início não muda na edição (fica o do cadastro); só o fim é conferido contra ele.
        AgendaRecorrente.ValidarPeriodo(
            DateOnly.FromDateTime(r.DataInicio),
            dto.DataFim is { } fimDto ? DateOnly.FromDateTime(fimDto.ToUniversalTime()) : null,
            HorarioBrasil.Hoje(), validarInicio: false);

        r.Descricao = dto.Descricao;
        r.Valor = dto.Valor;
        r.Tipo = (TipoTransacao)dto.Tipo;
        r.CategoriaId = dto.CategoriaId;
        r.SubcategoriaId = dto.SubcategoriaId;
        r.ContaId = dto.ContaId;
        r.CartaoCreditoId = dto.CartaoCreditoId;
        r.MeioPagamento = MeioDaContaFixa(dto);
        r.Frequencia = (FrequenciaRecorrencia)dto.Frequencia;
        r.Dia = dto.Dia;
        r.DataFim = dto.DataFim?.ToUniversalTime();

        // As PRÓXIMAS cobranças seguem o que vale agora (dia, valor, conta…): cancela as previsões de hoje em
        // diante (menos a que o usuário editou — a edição dele vale pra ela, e o período dela segue ocupado) e
        // gera de novo. Antes ficavam com o dia/valor antigos. Recomeça do INÍCIO DO PERÍODO atual, não
        // de hoje: período já cobrado não repete (Dia 5→20 com o 5 efetivado), e o que ficou sem cobrança ganha
        // a sua (Dia 20→5 no dia 10: o dia 5 deste mês entra como efetivado, igual ao "lançar o que passou";
        // a de HOJE fica prevista — o ExecutarRecorrentesJob efetiva, como sempre).
        if (r.Ativo && r.CanceladoEm == null)
        {
            var agora = DateTime.UtcNow;
            var hoje = HorarioBrasil.Hoje();
            var inicio = DateOnly.FromDateTime(r.DataInicio);
            var canceladas = await CancelarPrevisoesAsync(r.Id, "Conta fixa alterada", agora, aPartirDe: hoje, preservarEditadas: true);
            await ReconciliarFaturasDasCanceladasAsync(canceladas, usuarioId, Guid.NewGuid(), agora);
            r.DataProximaGeracao = AgendaRecorrente.ProximaEmOuDepois(
                AgendaRecorrente.InicioDoPeriodo(hoje, inicio, r.Frequencia), inicio, r.Dia, r.Frequencia)
                .ToDateTime(TimeOnly.MinValue);
            await GerarOcorrenciasAsync(r, hoje, StatusTransacao.Executado);
            await GerarOcorrenciasAsync(r, AgendaRecorrente.HorizonteExpansao(hoje), StatusTransacao.Previsao);
        }

        await SalvarAsync();
    }

    /// <summary>
    /// Pausa ou retoma. PAUSAR cancela as previsões (o que ainda não virou cobrança) — antes só invertia o
    /// `Ativo` e o ExecutarRecorrentesJob seguia efetivando tudo. RETOMAR recomeça da próxima data a partir de
    /// HOJE: os meses parados não são cobrados depois (o período que já tem cobrança viva não repete).
    /// <paramref name="ativo"/> = o estado PEDIDO (pausar = false, retomar = true): se já está nele, não faz
    /// nada — o duplo clique em "Retomar" não vira retomar + pausar. Sem ele, inverte (compatível).
    /// </summary>
    public async Task ToggleAtivoAsync(Guid id, Guid usuarioId, bool? ativo = null)
    {
        var r = await BuscarDoUsuarioAsync(id, usuarioId);

        // Cancelar é definitivo (as previsões futuras já foram canceladas junto): só a PAUSADA volta.
        // Antes a tela oferecia "Ativar" numa cancelada e este toggle a religava — voltava a gerar
        // cobrança com o cancelamento ainda registrado. A tela já não oferece; aqui é a 2ª camada.
        if (r.CanceladoEm != null)
            throw new InvalidOperationException("Conta fixa cancelada não pode ser pausada nem retomada.");

        if (ativo is { } pedido && pedido == r.Ativo)
            return;

        var agora = DateTime.UtcNow;
        var hoje = HorarioBrasil.Hoje();
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

        await SalvarAsync();
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

using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ControleFinanceiro.Api.Infrastructure.Jobs;

public class ExpandirRecorrentesJob
{
    private readonly AppDbContext _context;
    private readonly FaturaService _faturaService;
    private readonly RecorrenteService _recorrenteService;
    private readonly ILogger<ExpandirRecorrentesJob> _logger;

    public ExpandirRecorrentesJob(AppDbContext context, FaturaService faturaService, RecorrenteService recorrenteService, ILogger<ExpandirRecorrentesJob> logger)
    {
        _context = context;
        _faturaService = faturaService;
        _recorrenteService = recorrenteService;
        _logger = logger;
    }

    public async Task ExecuteAsync()
    {
        var hoje = HorarioBrasil.HojeData();
        var hojeD = DateOnly.FromDateTime(hoje);
        var horizonte = AgendaRecorrente.HorizonteExpansao(hojeD); // previsão até o fim do ano corrente (inclusive Dez/31)

        // Conserto de dado antigo (ocorrência no cartão sem fatura) — roda todo dia, é barato quando não há nada.
        // Antes de expandir (e antes do ExecutarRecorrentesJob, 30 min depois): cancela previsão de conta fixa
        // que não deve mais cobrar e faz o conserto único de legado (geradas no dia errado). Idempotente.
        // Cada etapa/conta fixa grava sozinha: conflito com uma requisição do usuário no meio (xmin da conta
        // fixa/fatura, índice único da competência) perde só aquela — tenta de novo amanhã —, não o job de todos
        // os usuários (mesma regra do FaturaAtrasoJob).
        await AnexarOcorrenciasSemFaturaAsync();
        await SalvarOuDescartarAsync("anexar ocorrências sem fatura");

        foreach (var id in await _recorrenteService.IdsParaRealinharAsync())
        {
            await _recorrenteService.RealinharAsync(id, hojeD);
            await SalvarOuDescartarAsync($"realinhar conta fixa {id}");
        }

        // Só as que ainda não foram expandidas até o horizonte (as em dia nem são lidas).
        var horizonteDt = horizonte.ToDateTime(TimeOnly.MinValue);
        var recorrentes = await _context.Recorrentes
            .Where(r => r.Ativo && r.CanceladoEm == null && r.ExcluidoEm == null
                        && (r.DataFim == null || r.DataFim.Value.Date >= hoje)
                        && (r.DataProximaGeracao == null || r.DataProximaGeracao < horizonteDt))
            .ToListAsync();

        foreach (var r in recorrentes)
        {
            try
            {
                await _recorrenteService.GerarOcorrenciasAsync(r, horizonte, StatusTransacao.Previsao);
                await SalvarOuDescartarAsync($"expandir conta fixa {r.Id}");
            }
            catch (KeyNotFoundException ex)
            {
                // Referência inválida (ex.: cartão de outro usuário gravado antes da checagem de dono, ou
                // cartão apagado). Pula só esta recorrente — sem isso uma linha ruim derrubava a expansão
                // de todos os usuários. O cartão falha já na 1ª iteração, então nada dela ficou pendente.
                _logger.LogWarning(ex, "Recorrente {RecorrenteId} ignorada na expansão: {Motivo}", r.Id, ex.Message);
                Descartar();
            }
        }
    }

    // Grava o que está pendente; conflito (concorrência ou unicidade) descarta só isso e segue.
    private async Task SalvarOuDescartarAsync(string etapa)
    {
        if (!_context.ChangeTracker.HasChanges()) return;
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex is DbUpdateConcurrencyException
                                           || ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            _logger.LogWarning(ex, "Conflito ao {Etapa}; descartado, tenta de novo na próxima execução.", etapa);
            Descartar();
        }
    }

    // Solta do contexto o que não foi gravado (o que já foi gravado fica como está).
    private void Descartar()
    {
        foreach (var e in _context.ChangeTracker.Entries().Where(e => e.State != EntityState.Unchanged).ToList())
            e.State = EntityState.Detached;
    }

    /// <summary>
    /// Põe na fatura do período as ocorrências de recorrente lançadas no cartão SEM fatura — era assim
    /// que <c>RecorrenteService.GerarPendentesAsync</c> gravava antes da correção. Sem fatura nenhuma
    /// cobrava a compra: não aparecia na fatura, não dava pra pagar e o limite ficava preso pra sempre
    /// (<c>RegrasFinanceiras.ConsultaComprasSemFatura</c>). A fatura sai da mesma regra da compra
    /// (<c>ObterOuCriarFaturaAsync</c>, que cria a do período se faltar). Depois da 1ª execução não
    /// sobra nenhuma: a consulta volta vazia.
    /// DECISÃO — fatura já <c>Pago</c>: a ocorrência entra nela SEM <c>UsadoComoCredito</c>, fora do total,
    /// como sempre esteve. A fatura foi dada por quitada sem ela; cobrá-la agora deixaria restante numa
    /// fatura que não aceita mais pagamento (<c>PagarFaturaAsync</c> recusa Pago) e o limite preso do mesmo
    /// jeito. É o mesmo tratamento da migration <c>BackfillCreditoRecorrenteCartao</c> pras ocorrências
    /// que já tinham fatura.
    /// </summary>
    private async Task<bool> AnexarOcorrenciasSemFaturaAsync()
    {
        var semFatura = await _context.Transacoes
            .Where(t => t.RecorrenteOrigemId != null
                        && t.CartaoCreditoId != null
                        && t.FaturaId == null
                        && t.ContaId == null
                        && !t.EhPagamentoFatura
                        && t.Ativo)
            .ToListAsync();

        var anexou = false;
        foreach (var t in semFatura)
        {
            try
            {
                // Dono do lançamento = dono do cartão, senão ObterOuCriarFaturaAsync recusa (KeyNotFound).
                var fatura = await _faturaService.ObterOuCriarFaturaAsync(t.CartaoCreditoId!.Value, t.Data, t.CriadoPor);
                t.FaturaId = fatura.Id;
                t.UsadoComoCredito = fatura.EstadoPagamento != EstadoPagamentoFatura.Pago;
                anexou = true;
            }
            catch (KeyNotFoundException ex)
            {
                // Cartão de outro usuário (dado gravado antes da checagem de dono): fica como está — fora
                // do limite dos dois, a regra exige o mesmo dono no lançamento e no cartão — e não trava
                // as demais. Mesmo tratamento da expansão no ExecuteAsync.
                _logger.LogWarning(ex, "Ocorrência {TransacaoId} sem fatura não foi anexada: {Motivo}", t.Id, ex.Message);
            }
        }
        return anexou;
    }
}

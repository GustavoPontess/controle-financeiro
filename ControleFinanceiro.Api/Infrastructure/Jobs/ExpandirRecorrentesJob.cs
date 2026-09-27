using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Infrastructure.Jobs;

public class ExpandirRecorrentesJob
{
    private readonly AppDbContext _context;
    private readonly FaturaService _faturaService;
    private readonly ILogger<ExpandirRecorrentesJob> _logger;

    public ExpandirRecorrentesJob(AppDbContext context, FaturaService faturaService, ILogger<ExpandirRecorrentesJob> logger)
    {
        _context = context;
        _faturaService = faturaService;
        _logger = logger;
    }

    public async Task ExecuteAsync()
    {
        var hoje = DateTime.UtcNow.Date;
        var dataProximaJanela = new DateTime(hoje.Year + 1, 1, 1); // previsão até o fim do ano corrente (inclusive Dez/31)

        var recorrentes = await _context.Recorrentes
            .Where(r => r.Ativo && (r.DataFim == null || r.DataFim.Value.Date >= hoje))
            .ToListAsync();

        bool houveMudanca = false;

        foreach (var r in recorrentes)
        {
            try
            {
                houveMudanca |= await ExpandirAsync(r, dataProximaJanela);
            }
            catch (KeyNotFoundException ex)
            {
                // Referência inválida (ex.: cartão de outro usuário gravado antes da checagem de dono, ou
                // cartão apagado). Pula só esta recorrente — sem isso uma linha ruim derrubava a expansão
                // de todos os usuários. O cartão falha já na 1ª iteração, então nada dela ficou pendente.
                _logger.LogWarning(ex, "Recorrente {RecorrenteId} ignorada na expansão: {Motivo}", r.Id, ex.Message);
            }
        }

        if (houveMudanca)
            await _context.SaveChangesAsync();
    }

    // Gera as previsões desta recorrente até o fim da janela. Retorna se criou alguma.
    private async Task<bool> ExpandirAsync(Recorrente r, DateTime dataProximaJanela)
    {
        var criou = false;
        var proxima = (r.DataProximaGeracao ?? r.DataInicio).Date;

        while (proxima < dataProximaJanela && (r.DataFim == null || proxima <= r.DataFim.Value.Date))
        {
            Guid? faturaId = null;
            if (r.CartaoCreditoId.HasValue)
            {
                var fatura = await _faturaService.ObterOuCriarFaturaAsync(r.CartaoCreditoId.Value, proxima, r.CriadoPor);
                faturaId = fatura.Id;
            }

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
                UsadoComoCredito = r.CartaoCreditoId.HasValue, // sem isso DetalheAsync exclui o lançamento da fatura
                StatusTransacao = StatusTransacao.Previsao,
                Ativo = true,
                CriadoPor = r.CriadoPor,
                Data = proxima,
                RecorrenteOrigemId = r.Id,
                CriadoEm = DateTime.UtcNow
            });
            proxima = ProximaData(proxima, r.Frequencia);
            criou = true;
        }

        r.DataProximaGeracao = proxima;
        return criou;
    }

    private static DateTime ProximaData(DateTime atual, FrequenciaRecorrencia freq) => freq switch
    {
        FrequenciaRecorrencia.Semanal => atual.AddDays(7),
        FrequenciaRecorrencia.Mensal => atual.AddMonths(1),
        FrequenciaRecorrencia.Anual => atual.AddYears(1),
        _ => atual.AddMonths(1)
    };
}

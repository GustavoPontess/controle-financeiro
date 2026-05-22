using ControleFinanceiro.Api.DTOs.Relatorios;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text;

namespace ControleFinanceiro.Api.Services;

public class RelatorioService
{
    private readonly AppDbContext _context;

    public RelatorioService(AppDbContext context)
    {
        _context = context;
    }

    // ── Relatório por período customizado ────────────────────────────────────

    /// <summary>
    /// Relatório com filtros flexíveis: período, categoria, tipo e conta/cartão.
    /// </summary>
    public async Task<RelatorioPeriodoDto> GetRelatorioPeriodoAsync(
        Guid usuarioId,
        DateTime dataInicio,
        DateTime dataFim,
        Guid? categoriaId = null,
        int? tipo = null,
        Guid? contaId = null)
    {
        if (dataFim < dataInicio)
            throw new ArgumentException("dataFim deve ser maior ou igual a dataInicio.");

        // Limite máximo de 2 anos para evitar queries pesadas
        if ((dataFim - dataInicio).TotalDays > 730)
            throw new ArgumentException("O período não pode exceder 2 anos.");

        var query = _context.Transacoes
            .Where(t => t.Data >= dataInicio && t.Data <= dataFim &&
                        (t.Conta!.UsuarioIdProprietario == usuarioId ||
                         t.CartaoCredito!.CriadoPor == usuarioId))
            .Include(t => t.Categoria)
            .Include(t => t.Conta)
            .Include(t => t.CartaoCredito)
            .AsNoTracking();

        if (categoriaId.HasValue)
            query = query.Where(t => t.CategoriaId == categoriaId.Value);

        if (tipo.HasValue)
            query = query.Where(t => (int)t.Tipo == tipo.Value);

        if (contaId.HasValue)
            query = query.Where(t => t.ContaId == contaId.Value || t.CartaoCreditoId == contaId.Value);

        var transacoes = await query.OrderBy(t => t.Data).ToListAsync();

        var cultura = new CultureInfo("pt-BR");

        var totalDespesas = transacoes.Where(t => t.Tipo == TipoTransacao.Despesa).Sum(t => t.Valor);
        var totalReceitas = transacoes.Where(t => t.Tipo == TipoTransacao.Receita).Sum(t => t.Valor);

        var gastosPorCategoria = transacoes
            .Where(t => t.Tipo == TipoTransacao.Despesa)
            .GroupBy(t => t.Categoria?.Descricao ?? "Sem categoria")
            .Select(g => new GastoPorCategoriaDto
            {
                Descricao = g.Key,
                Valor = g.Sum(t => t.Valor),
                Percentual = totalDespesas > 0 ? Math.Round(g.Sum(t => t.Valor) / totalDespesas * 100, 1) : 0
            })
            .OrderByDescending(g => g.Valor)
            .ToList();

        var gastosPorMeio = transacoes
            .Where(t => t.Tipo == TipoTransacao.Despesa)
            .GroupBy(t => MeioPagamentoLabel(t.MeioPagamento))
            .Select(g => new GastoPorMeioPagamentoDto
            {
                MeioPagamento = g.Key,
                Valor = g.Sum(t => t.Valor),
                Percentual = totalDespesas > 0 ? Math.Round(g.Sum(t => t.Valor) / totalDespesas * 100, 1) : 0
            })
            .OrderByDescending(g => g.Valor)
            .ToList();

        var evolucaoDiaria = transacoes
            .GroupBy(t => DateOnly.FromDateTime(t.Data.Date))
            .Select(g => new EvolucaoDiariaDto
            {
                Data = g.Key,
                Receitas = g.Where(t => t.Tipo == TipoTransacao.Receita).Sum(t => t.Valor),
                Despesas = g.Where(t => t.Tipo == TipoTransacao.Despesa).Sum(t => t.Valor),
            })
            .OrderBy(e => e.Data)
            .ToList();

        var linhas = transacoes.Select(t => new TransacaoRelatorioDto
        {
            Id = t.Id,
            Data = t.Data,
            Descricao = t.Descricao,
            Valor = t.Valor,
            Tipo = t.Tipo == TipoTransacao.Receita ? "Receita" : "Despesa",
            Categoria = t.Categoria?.Descricao,
            Conta = t.Conta?.Nome ?? t.CartaoCredito?.Nome,
            MeioPagamento = MeioPagamentoLabel(t.MeioPagamento),
        }).ToList();

        return new RelatorioPeriodoDto
        {
            DataInicio = dataInicio,
            DataFim = dataFim,
            TotalReceitas = totalReceitas,
            TotalDespesas = totalDespesas,
            TotalTransacoes = transacoes.Count,
            GastosPorCategoria = gastosPorCategoria,
            GastosPorMeioPagamento = gastosPorMeio,
            EvolucaoDiaria = evolucaoDiaria,
            Transacoes = linhas,
        };
    }

    // ── Export CSV ───────────────────────────────────────────────────────────

    /// <summary>
    /// Gera um arquivo CSV com todas as transações do período (mesmos filtros do relatório).
    /// </summary>
    public async Task<byte[]> ExportarCsvAsync(
        Guid usuarioId,
        DateTime dataInicio,
        DateTime dataFim,
        Guid? categoriaId = null,
        int? tipo = null,
        Guid? contaId = null)
    {
        var relatorio = await GetRelatorioPeriodoAsync(usuarioId, dataInicio, dataFim, categoriaId, tipo, contaId);

        var sb = new StringBuilder();
        sb.AppendLine("Id,Data,Descricao,Valor,Tipo,Categoria,Conta,MeioPagamento");

        foreach (var t in relatorio.Transacoes)
        {
            sb.AppendLine(string.Join(",",
                t.Id,
                t.Data.ToString("yyyy-MM-dd"),
                SafeCsvText(t.Descricao),
                t.Valor.ToString("F2", CultureInfo.InvariantCulture),
                SafeCsvText(t.Tipo),
                SafeCsvText(t.Categoria),
                SafeCsvText(t.Conta),
                SafeCsvText(t.MeioPagamento)
            ));
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    private static string SafeCsvText(string? value)
    {
        var normalized = (value ?? string.Empty)
            .Replace("\r\n", " ")
            .Replace("\r", " ")
            .Replace("\n", " ");

        var firstContentIndex = normalized.TakeWhile(char.IsWhiteSpace).Count();
        if (firstContentIndex < normalized.Length && IsFormulaPrefix(normalized[firstContentIndex]))
            normalized = normalized.Insert(firstContentIndex, "'");

        return $"\"{normalized.Replace("\"", "\"\"")}\"";
    }

    private static bool IsFormulaPrefix(char value) => value is '=' or '+' or '-' or '@';

    private static string MeioPagamentoLabel(MeioPagamento? meio) => meio switch
    {
        MeioPagamento.Dinheiro => "Dinheiro",
        MeioPagamento.Debito   => "Débito",
        MeioPagamento.Credito  => "Crédito",
        MeioPagamento.Pix      => "Pix",
        MeioPagamento.Ted      => "TED/DOC",
        MeioPagamento.Boleto   => "Boleto",
        _                      => "Não informado"
    };

    // ── Relatório anual (existente) ──────────────────────────────────────────

    public async Task<RelatorioMensalDto> GetRelatorioAsync(Guid usuarioId, int ano)
    {
        var transacoes = await _context.Transacoes
            .Where(t => t.Data.Year == ano &&
                        (t.Conta!.UsuarioIdProprietario == usuarioId ||
                         t.CartaoCredito!.CriadoPor == usuarioId))
            .Include(t => t.Categoria)
            .AsNoTracking()
            .ToListAsync();

        var cultura = new CultureInfo("pt-BR");
        var mesesNomes = cultura.DateTimeFormat.AbbreviatedMonthNames;

        var evolucaoMensal = Enumerable.Range(1, 12).Select(mes =>
        {
            var doMes = transacoes.Where(t => t.Data.Month == mes).ToList();
            var receitas = doMes.Where(t => t.Tipo == TipoTransacao.Receita).Sum(t => t.Valor);
            var despesas = doMes.Where(t => t.Tipo == TipoTransacao.Despesa).Sum(t => t.Valor);
            var receitasCaixa = doMes.Where(t => t.Tipo == TipoTransacao.Receita && !t.UsadoComoCredito).Sum(t => t.Valor);
            var despesasCaixa = doMes.Where(t => t.Tipo == TipoTransacao.Despesa && !t.UsadoComoCredito).Sum(t => t.Valor);
            return new EvolucaoMensalDto
            {
                Ano = ano,
                Mes = mes,
                MesLabel = char.ToUpper(mesesNomes[mes - 1][0]) + mesesNomes[mes - 1][1..],
                Receitas = receitas,
                Despesas = despesas,
                Saldo = receitasCaixa - despesasCaixa
            };
        }).ToList();

        var totalDespesas = transacoes.Where(t => t.Tipo == TipoTransacao.Despesa).Sum(t => t.Valor);

        var gastosPorCategoria = transacoes
            .Where(t => t.Tipo == TipoTransacao.Despesa && t.Categoria != null)
            .GroupBy(t => t.Categoria!.Descricao)
            .Select(g => new GastoPorCategoriaDto
            {
                Descricao = g.Key,
                Valor = g.Sum(t => t.Valor),
                Percentual = totalDespesas > 0 ? Math.Round(g.Sum(t => t.Valor) / totalDespesas * 100, 1) : 0
            })
            .OrderByDescending(g => g.Valor)
            .ToList();

        var comparacao = evolucaoMensal
            .Where(m => m.Receitas > 0 || m.Despesas > 0)
            .TakeLast(6)
            .Select(m => new ComparacaoMesDto
            {
                MesLabel = m.MesLabel,
                Receitas = m.Receitas,
                Despesas = m.Despesas
            })
            .ToList();

        return new RelatorioMensalDto
        {
            EvolucaoMensal = evolucaoMensal,
            GastosPorCategoria = gastosPorCategoria,
            ComparacaoUltimosMeses = comparacao
        };
    }
}

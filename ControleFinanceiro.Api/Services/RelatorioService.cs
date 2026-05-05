using ControleFinanceiro.Api.DTOs.Relatorios;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace ControleFinanceiro.Api.Services;

public class RelatorioService
{
    private readonly AppDbContext _context;

    public RelatorioService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<RelatorioMensalDto> GetRelatorioAsync(Guid usuarioId, int ano)
    {
        var transacoes = await _context.Transacoes
            .Where(t => t.Conta!.UsuarioIdProprietario == usuarioId && t.Data.Year == ano)
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
            return new EvolucaoMensalDto
            {
                Ano = ano,
                Mes = mes,
                MesLabel = char.ToUpper(mesesNomes[mes - 1][0]) + mesesNomes[mes - 1][1..],
                Receitas = receitas,
                Despesas = despesas,
                Saldo = receitas - despesas
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

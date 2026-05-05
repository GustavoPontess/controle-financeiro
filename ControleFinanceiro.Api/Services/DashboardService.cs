using ControleFinanceiro.Api.DTOs.Dashboard;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

public class DashboardService
{
    private readonly AppDbContext _context;

    public DashboardService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<DashboardDto> GetResumoAsync(Guid usuarioId, int ano, int mes)
    {
        var contas = await _context.Contas
            .Where(c => c.UsuarioIdProprietario == usuarioId)
            .Include(c => c.Transacoes)
            .ThenInclude(t => t.Categoria)
            .AsNoTracking()
            .ToListAsync();

        var cartoes = await _context.CartoesCredito
            .Where(c => c.CriadoPor == usuarioId)
            .Include(c => c.Transacoes)
            .ThenInclude(t => t.Categoria)
            .AsNoTracking()
            .ToListAsync();

        var todasTransacoes = contas.SelectMany(c => c.Transacoes)
            .Concat(cartoes.SelectMany(c => c.Transacoes))
            .ToList();

        var transacoesMes = todasTransacoes
            .Where(t => t.Data.Year == ano && t.Data.Month == mes)
            .ToList();

        var receitasMes = transacoesMes
            .Where(t => t.Tipo == TipoTransacao.Receita)
            .Sum(t => t.Valor);

        var despesasMes = transacoesMes
            .Where(t => t.Tipo == TipoTransacao.Despesa)
            .Sum(t => t.Valor);

        // SaldoMes usa apenas movimentos de caixa — crédito só entra quando a fatura é paga.
        var receitasCaixaMes = transacoesMes
            .Where(t => t.Tipo == TipoTransacao.Receita && !t.UsadoComoCredito)
            .Sum(t => t.Valor);

        var despesasCaixaMes = transacoesMes
            .Where(t => t.Tipo == TipoTransacao.Despesa && !t.UsadoComoCredito)
            .Sum(t => t.Valor);

        var inicioDoPeriodo = new DateTime(ano, mes, 1);
        var saldoAnteriorAoMes = todasTransacoes
            .Where(t => t.Data < inicioDoPeriodo && !t.UsadoComoCredito)
            .Sum(t => t.Tipo == TipoTransacao.Receita ? t.Valor : -t.Valor);

        var saldoContas = contas.Select(c =>
        {
            var receitas = c.Transacoes.Where(t => t.Tipo == TipoTransacao.Receita).Sum(t => t.Valor);
            var despesas = c.Transacoes.Where(t => t.Tipo == TipoTransacao.Despesa).Sum(t => t.Valor);
            return new SaldoContaDto
            {
                Id = c.Id,
                Nome = c.Nome,
                Saldo = receitas - despesas,
                Tipo = (int)c.Tipo,
                TipoDescricao = c.Tipo.ToString()
            };
        }).ToList();

        var saldoTotal = saldoContas.Sum(c => c.Saldo);

        var topCategorias = transacoesMes
            .Where(t => t.Tipo == TipoTransacao.Despesa && t.Categoria != null)
            .GroupBy(t => t.Categoria!.Descricao)
            .Select(g => new { Descricao = g.Key, Valor = g.Sum(t => t.Valor) })
            .OrderByDescending(g => g.Valor)
            .Take(5)
            .ToList();

        var categoriasDtos = topCategorias.Select(c => new CategoriaGastoDto
        {
            Descricao = c.Descricao,
            Valor = c.Valor,
            Percentual = despesasMes > 0 ? Math.Round(c.Valor / despesasMes * 100, 1) : 0
        }).ToList();

        var recentes = todasTransacoes
            .OrderByDescending(t => t.Data)
            .Take(7)
            .Select(t => new TransacaoRecenteDto
            {
                Id = t.Id,
                Descricao = t.Descricao,
                Valor = t.Valor,
                Tipo = (int)t.Tipo,
                CategoriaId = t.CategoriaId,
                Categoria = t.Categoria?.Descricao,
                ContaId = t.ContaId,
                CartaoCreditoId = t.CartaoCreditoId,
                Conta = t.ContaId.HasValue
                    ? contas.FirstOrDefault(c => c.Id == t.ContaId)?.Nome
                    : cartoes.FirstOrDefault(c => c.Id == t.CartaoCreditoId)?.Nome,
                MeioPagamento = t.MeioPagamento.HasValue ? (int)t.MeioPagamento.Value : null,
                MeioPagamentoDescricao = t.MeioPagamento switch
                {
                    Domain.Enums.MeioPagamento.Dinheiro => "Dinheiro",
                    Domain.Enums.MeioPagamento.Debito   => "Débito",
                    Domain.Enums.MeioPagamento.Credito  => "Crédito",
                    Domain.Enums.MeioPagamento.Pix      => "Pix",
                    Domain.Enums.MeioPagamento.Ted      => "TED/DOC",
                    Domain.Enums.MeioPagamento.Boleto   => "Boleto",
                    _ => null
                },
                Data = t.Data
            }).ToList();

        return new DashboardDto
        {
            SaldoTotal = saldoTotal,
            ReceitasMes = receitasMes,
            DespesasMes = despesasMes,
            SaldoMes = saldoAnteriorAoMes + receitasCaixaMes - despesasCaixaMes,
            TopCategorias = categoriasDtos,
            TransacoesRecentes = recentes,
            SaldoContas = saldoContas
        };
    }
}

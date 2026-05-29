using ControleFinanceiro.Api.DTOs.Dashboard;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

public class DashboardService
{
    private readonly AppDbContext _context;
    private readonly LimiteCalculatorService _limiteCalc;

    public DashboardService(AppDbContext context, LimiteCalculatorService limiteCalc)
    {
        _context = context;
        _limiteCalc = limiteCalc;
    }

    public async Task<DashboardDto> GetResumoAsync(Guid usuarioId, int ano, int mes)
    {
        var contas = await _context.Contas
            .Where(c => c.UsuarioIdProprietario == usuarioId)
            .Include(c => c.Banco)
            .Include(c => c.Transacoes)
            .ThenInclude(t => t.Categoria)
            .AsNoTracking()
            .ToListAsync();

        var cartoes = await _context.CartoesCredito
            .Where(c => c.CriadoPor == usuarioId)
            .Include(c => c.Banco)
            .Include(c => c.Transacoes)
            .ThenInclude(t => t.Categoria)
            .AsNoTracking()
            .ToListAsync();

        var todasTransacoes = contas.SelectMany(c => c.Transacoes)
            .Concat(cartoes.SelectMany(c => c.Transacoes))
            .ToList();

        // Considera só transações vivas e não canceladas nos KPIs do mês.
        var transacoesMes = todasTransacoes
            .Where(t => t.Data.Year == ano && t.Data.Month == mes)
            .Where(t => t.Ativo && t.StatusTransacao != StatusTransacao.Cancelado)
            .ToList();

        // P&L: receita/despesa REAL exclui o que só move saldo (transferência, pagamento de
        // fatura, saldo inicial). Saldo/caixa abaixo continuam contando esses.
        static bool EhPnl(Domain.Entities.Transacao t) =>
            !t.EhTransferencia && !t.EhPagamentoFatura && !t.EhSaldoInicial;

        // 6 KPIs (#81): Executado = realizado (Recebido/Pago);
        // Previsao = futuro (A receber / A pagar). Receitas = Recebido + AReceber.
        var recebido = transacoesMes
            .Where(t => EhPnl(t) && t.Tipo == TipoTransacao.Receita && t.StatusTransacao == StatusTransacao.Executado)
            .Sum(t => t.Valor);
        var aReceber = transacoesMes
            .Where(t => EhPnl(t) && t.Tipo == TipoTransacao.Receita && t.StatusTransacao == StatusTransacao.Previsao)
            .Sum(t => t.Valor);
        var pago = transacoesMes
            .Where(t => EhPnl(t) && t.Tipo == TipoTransacao.Despesa && t.StatusTransacao == StatusTransacao.Executado)
            .Sum(t => t.Valor);
        var aPagar = transacoesMes
            .Where(t => EhPnl(t) && t.Tipo == TipoTransacao.Despesa && t.StatusTransacao == StatusTransacao.Previsao)
            .Sum(t => t.Valor);

        var receitasMes = recebido + aReceber;
        var despesasMes = pago + aPagar;

        // SaldoMes usa apenas movimentos de caixa — crédito só entra quando a fatura é paga.
        var receitasCaixaMes = transacoesMes
            .Where(t => t.Tipo == TipoTransacao.Receita && !t.UsadoComoCredito)
            .Sum(t => t.Valor);

        var despesasCaixaMes = transacoesMes
            .Where(t => t.Tipo == TipoTransacao.Despesa && !t.UsadoComoCredito)
            .Sum(t => t.Valor);

        var inicioDoPeriodo = new DateTime(ano, mes, 1);
        var saldoAnteriorAoMes = todasTransacoes
            .Where(t => t.Data < inicioDoPeriodo && !t.UsadoComoCredito
                        && t.Ativo && t.StatusTransacao == StatusTransacao.Executado)
            .Sum(t => t.Tipo == TipoTransacao.Receita ? t.Valor : -t.Valor);

        // Saldo conta = movimento real (Ativo + Executado). Inclui transferência/saldo
        // inicial/pagamento (movem dinheiro); exclui canceladas (soft delete) e previsões.
        static bool EhSaldo(Domain.Entities.Transacao t) =>
            t.Ativo && t.StatusTransacao == StatusTransacao.Executado;

        var saldoContas = contas.Select(c =>
        {
            var receitas = c.Transacoes.Where(t => EhSaldo(t) && t.Tipo == TipoTransacao.Receita).Sum(t => t.Valor);
            var despesas = c.Transacoes.Where(t => EhSaldo(t) && t.Tipo == TipoTransacao.Despesa).Sum(t => t.Valor);
            return new SaldoContaDto
            {
                Id = c.Id,
                Nome = c.Nome,
                Saldo = receitas - despesas,
                Tipo = (int)c.Tipo,
                TipoDescricao = c.Tipo.ToString(),
                IsCarteira = c.IsCarteira,
                BancoNome = c.Banco?.NomeFantasia,
                LogoUrl = c.Banco?.LogoUrl,
                Cor = c.Banco?.Cor
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

        // Evolução do saldo de caixa: 6 meses terminando no mês selecionado.
        var caixaExecutado = todasTransacoes
            .Where(t => t.Ativo && t.StatusTransacao == StatusTransacao.Executado && !t.UsadoComoCredito)
            .ToList();
        var meses = new[] { "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez" };
        var evolucao = new List<EvolucaoMesDto>();
        for (var i = 5; i >= 0; i--)
        {
            var refDate = new DateTime(ano, mes, 1).AddMonths(-i);
            var fimDoMes = refDate.AddMonths(1);
            var saldoAteFim = caixaExecutado
                .Where(t => t.Data < fimDoMes)
                .Sum(t => t.Tipo == TipoTransacao.Receita ? t.Valor : -t.Valor);
            evolucao.Add(new EvolucaoMesDto
            {
                Label = $"{meses[refDate.Month - 1]}/{refDate:yy}",
                Ano = refDate.Year,
                Mes = refDate.Month,
                Saldo = saldoAteFim
            });
        }

        // Saldo no fim do mês anterior — usado pelo hero pra mostrar variação.
        // O `evolucao` já tem 6 pontos terminando no mês selecionado; pego o penúltimo.
        var saldoMesAnterior = evolucao.Count >= 2 ? evolucao[^2].Saldo : 0m;

        // Top 3 cartões ativos por % limite usado (desc). Mostra quem está mais
        // "pressionado" no widget do dashboard.
        var cartoesResumo = new List<CartaoResumoDto>();
        var hoje = DateTime.UtcNow.Date;
        var cartoesAtivosComCredito = cartoes
            .Where(c => c.Ativo && c.TemCredito && (c.LimiteTotal ?? 0m) > 0m)
            .ToList();
        foreach (var cartao in cartoesAtivosComCredito)
        {
            // Recalcula limite via LimiteCalculatorService (fonte da verdade — não
            // duplicar lógica aqui). Falha em algum cartão pula só ele, não derruba
            // o dashboard inteiro.
            try
            {
                var snap = await _limiteCalc.CalcularAsync(cartao.Id, usuarioId);
                var limiteUsado = snap.LimiteTotal - snap.LimiteDisponivel;
                var pct = snap.LimiteTotal > 0
                    ? Math.Round(limiteUsado / snap.LimiteTotal * 100, 1)
                    : 0m;

                // Próximo fechamento: se DiaFechamento >= hoje no mês corrente, é esse;
                // senão é no próximo mês. Defensivo com Math.Min pro Feb (29 → 28).
                DateTime? proximoFechamento = null;
                int? diasAteFechamento = null;
                if (cartao.DiaFechamento.HasValue)
                {
                    var dia = cartao.DiaFechamento.Value;
                    var anoCorr = hoje.Year;
                    var mesCorr = hoje.Month;
                    var diaSafe = Math.Min(dia, DateTime.DaysInMonth(anoCorr, mesCorr));
                    var candidato = new DateTime(anoCorr, mesCorr, diaSafe);
                    if (candidato < hoje)
                    {
                        var prox = new DateTime(anoCorr, mesCorr, 1).AddMonths(1);
                        var diaSafe2 = Math.Min(dia, DateTime.DaysInMonth(prox.Year, prox.Month));
                        candidato = new DateTime(prox.Year, prox.Month, diaSafe2);
                    }
                    proximoFechamento = candidato;
                    diasAteFechamento = (candidato - hoje).Days;
                }

                cartoesResumo.Add(new CartaoResumoDto
                {
                    Id = cartao.Id,
                    Nome = cartao.Nome,
                    BancoNome = cartao.Banco?.NomeFantasia,
                    BancoLogoUrl = cartao.Banco?.LogoUrl,
                    BancoCor = cartao.Banco?.Cor,
                    LimiteTotal = snap.LimiteTotal,
                    LimiteUsado = limiteUsado,
                    LimiteDisponivel = snap.LimiteDisponivel,
                    PercentualUsado = pct,
                    ProximoFechamento = proximoFechamento,
                    DiasAteFechamento = diasAteFechamento,
                });
            }
            catch
            {
                // Cartão sem limite ou sem TemCredito — ignora silenciosamente.
            }
        }
        var topCartoes = cartoesResumo
            .OrderByDescending(c => c.PercentualUsado)
            .Take(3)
            .ToList();

        return new DashboardDto
        {
            SaldoTotal = saldoTotal,
            SaldoMesAnterior = saldoMesAnterior,
            ReceitasMes = receitasMes,
            DespesasMes = despesasMes,
            SaldoMes = saldoAnteriorAoMes + receitasCaixaMes - despesasCaixaMes,
            Recebido = recebido,
            AReceber = aReceber,
            Pago = pago,
            APagar = aPagar,
            EvolucaoSaldo = evolucao,
            TopCategorias = categoriasDtos,
            TransacoesRecentes = recentes,
            SaldoContas = saldoContas,
            CartoesResumo = topCartoes,
        };
    }
}

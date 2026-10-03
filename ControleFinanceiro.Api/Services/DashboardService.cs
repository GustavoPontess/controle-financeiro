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

        // DistinctBy: uma transação ligada a conta E a cartão viria pelos dois Includes e contaria 2×.
        var todasTransacoes = contas.SelectMany(c => c.Transacoes)
            .Concat(cartoes.SelectMany(c => c.Transacoes))
            .DistinctBy(t => t.Id)
            .ToList();

        var hoje = DateTime.UtcNow.Date;
        var hojeDia = DateOnly.FromDateTime(hoje);

        // Movimento REAL das contas (mesma regra do saldo: Ativo + Executado, só o que tem conta).
        // É a base do saldo no tempo — hero, variação e gráfico falam o mesmo número.
        var movimentoDasContas = todasTransacoes
            .Where(t => t.ContaId != null && t.Ativo && t.StatusTransacao == StatusTransacao.Executado)
            .ToList();
        static decimal ComSinal(Domain.Entities.Transacao t) =>
            t.Tipo == TipoTransacao.Receita ? t.Valor : -t.Valor;

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

        // Caixa do mês anterior — pros cards "Entrou/Saiu" mostrarem variação % (#1.3).
        // Mesma base do EntradasCaixa/SaidasCaixa (Executado, exclui crédito não-pago,
        // transferência, pagamento de fatura e saldo inicial).
        var inicioMesAnterior = new DateTime(ano, mes, 1).AddMonths(-1);
        var transacoesMesAnterior = todasTransacoes
            .Where(t => t.Data.Year == inicioMesAnterior.Year && t.Data.Month == inicioMesAnterior.Month)
            .Where(t => t.Ativo && t.StatusTransacao == StatusTransacao.Executado && !t.UsadoComoCredito
                        && !t.EhTransferencia && !t.EhPagamentoFatura && !t.EhSaldoInicial)
            .ToList();
        var entradasCaixaMesAnterior = transacoesMesAnterior
            .Where(t => t.Tipo == TipoTransacao.Receita).Sum(t => t.Valor);
        var saidasCaixaMesAnterior = transacoesMesAnterior
            .Where(t => t.Tipo == TipoTransacao.Despesa).Sum(t => t.Valor);

        // SaldoMes usa apenas movimentos de caixa — crédito só entra quando a fatura é paga.
        // Também filtra Ativo + Executado pra bater com /transacoes/stats.
        var receitasCaixaMes = transacoesMes
            .Where(t => t.Tipo == TipoTransacao.Receita && !t.UsadoComoCredito
                        && t.StatusTransacao == StatusTransacao.Executado
                        && !t.EhTransferencia && !t.EhPagamentoFatura && !t.EhSaldoInicial)
            .Sum(t => t.Valor);

        // As saídas de caixa do mês — a lista fica à mão porque "Maiores gastos" usa a MESMA base
        // (o donut tem que somar o "Saiu").
        var saidasDeCaixaDoMes = transacoesMes
            .Where(t => t.Tipo == TipoTransacao.Despesa && !t.UsadoComoCredito
                        && t.StatusTransacao == StatusTransacao.Executado
                        && !t.EhTransferencia && !t.EhPagamentoFatura && !t.EhSaldoInicial)
            .ToList();
        var despesasCaixaMes = saidasDeCaixaDoMes.Sum(t => t.Valor);

        var inicioDoPeriodo = DateOnly.FromDateTime(new DateTime(ano, mes, 1));
        var saldoAnteriorAoMes = todasTransacoes
            .Where(t => t.Data < inicioDoPeriodo && !t.UsadoComoCredito
                        && t.Ativo && t.StatusTransacao == StatusTransacao.Executado)
            .Sum(t => t.Tipo == TipoTransacao.Receita ? t.Valor : -t.Valor);

        // Saldo conta = movimento real (Ativo + Executado). Inclui transferência/saldo
        // inicial/pagamento (movem dinheiro); exclui canceladas (soft delete) e previsões.
        // Regra única, agregada no banco — o mesmo número da tela de contas.
        var saldosPorConta = await RegrasFinanceiras.SaldosDasContasAsync(
            _context, contas.Select(c => c.Id), usuarioId);

        var saldoContas = contas.Select(c => new SaldoContaDto
        {
            Id = c.Id,
            Nome = c.Nome,
            Saldo = saldosPorConta[c.Id].Saldo,
            Tipo = (int)c.Tipo,
            TipoDescricao = c.Tipo.Descricao(),
            IsCarteira = c.IsCarteira,
            BancoNome = c.Banco?.NomeFantasia,
            LogoUrl = c.Banco?.LogoUrl,
            Cor = c.Banco?.Cor
        }).ToList();

        var saldoTotal = saldoContas.Sum(c => c.Saldo);

        // Maiores gastos = as saídas de caixa do mês por categoria. Mesma base do "Saiu" e sem
        // descartar nada: quem não tem categoria vira "Sem categoria" e, passando de 5 grupos, o
        // resto vira "Outros" — assim as fatias somam 100% e o total bate com o "Saiu".
        const int MaxFatias = 5;
        var gastosPorCategoria = saidasDeCaixaDoMes
            .GroupBy(t => t.Categoria?.Descricao ?? "Sem categoria")
            .Select(g => new { Descricao = g.Key, Valor = g.Sum(t => t.Valor) })
            .OrderByDescending(g => g.Valor)
            .ToList();
        var topCategorias = gastosPorCategoria.Count <= MaxFatias
            ? gastosPorCategoria
            : gastosPorCategoria.Take(MaxFatias - 1)
                .Append(new { Descricao = "Outros", Valor = gastosPorCategoria.Skip(MaxFatias - 1).Sum(g => g.Valor) })
                .ToList();

        var categoriasDtos = topCategorias.Select(c => new CategoriaGastoDto
        {
            Descricao = c.Descricao,
            Valor = c.Valor,
            Percentual = despesasCaixaMes > 0 ? Math.Round(c.Valor / despesasCaixaMes * 100, 1) : 0
        }).ToList();

        // Recentes = o que JÁ aconteceu: só efetivadas, até hoje, sem o saldo de abertura. Previsão
        // (recorrente gerada pra frente) tem data futura e furava a fila na frente de tudo.
        var recentes = todasTransacoes
            .Where(t => t.Ativo && t.StatusTransacao == StatusTransacao.Executado
                        && !t.EhSaldoInicial && t.Data <= hojeDia)
            .OrderByDescending(t => t.Data)
            .ThenByDescending(t => t.Hora ?? TimeOnly.MinValue)
            .ThenByDescending(t => t.CriadoEm)
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
                Data = t.Data,
                Hora = t.Hora,
                EhTransferencia = t.EhTransferencia,
                EhPagamentoFatura = t.EhPagamentoFatura,
            }).ToList();

        // Evolução do saldo das contas: 6 meses terminando no mês selecionado. Mesma base do saldo
        // do hero — o ponto do mês corrente é o próprio saldo total.
        var meses = new[] { "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez" };
        var evolucao = new List<EvolucaoMesDto>();
        for (var i = 5; i >= 0; i--)
        {
            var refDate = new DateTime(ano, mes, 1).AddMonths(-i);
            var fimDoMes = DateOnly.FromDateTime(refDate.AddMonths(1));
            var saldoAteFim = movimentoDasContas
                .Where(t => t.Data < fimDoMes)
                .Sum(ComSinal);
            evolucao.Add(new EvolucaoMesDto
            {
                Label = $"{meses[refDate.Month - 1]}/{refDate:yy}",
                Ano = refDate.Year,
                Mes = refDate.Month,
                Saldo = saldoAteFim
            });
        }

        // Saldo das contas no fim do mês PASSADO (em relação a hoje, não ao mês navegado) — o hero
        // mostra o saldo de hoje, então a variação tem que partir do mesmo relógio e da mesma base.
        // Antes vinha do gráfico (mês navegado, outra base) e comparava coisas diferentes.
        var inicioDoMesAtual = new DateOnly(hoje.Year, hoje.Month, 1);
        var saldoMesAnterior = movimentoDasContas
            .Where(t => t.Data < inicioDoMesAtual)
            .Sum(ComSinal);

        // Top 3 cartões ativos por % limite usado (desc). Mostra quem está mais
        // "pressionado" no widget do dashboard.
        var cartoesResumo = new List<CartaoResumoDto>();
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
                    UltimosDigitos = cartao.UltimosDigitos,
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
            EntradasCaixaMesAnterior = entradasCaixaMesAnterior,
            SaidasCaixaMesAnterior = saidasCaixaMesAnterior,
            SaldoMes = saldoAnteriorAoMes + receitasCaixaMes - despesasCaixaMes,
            Recebido = recebido,
            AReceber = aReceber,
            Pago = pago,
            APagar = aPagar,
            EntradasCaixa = receitasCaixaMes,
            SaidasCaixa = despesasCaixaMes,
            SaldoCaixaMes = receitasCaixaMes - despesasCaixaMes,
            EvolucaoSaldo = evolucao,
            TopCategorias = categoriasDtos,
            TransacoesRecentes = recentes,
            SaldoContas = saldoContas,
            CartoesResumo = topCartoes,
        };
    }
}

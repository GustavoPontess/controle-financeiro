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
        // Só os cadastros vêm pra memória; os lançamentos são somados no banco (antes vinham TODOS, com a
        // categoria de cada um, a cada abertura da Visão geral; numa conta com anos de extrato pesava).
        // Ordem estável (pelo id), a mesma que a consulta antiga devolvia.
        var contas = await _context.Contas
            .Where(c => c.UsuarioIdProprietario == usuarioId)
            .Include(c => c.Banco)
            .OrderBy(c => c.Id)
            .AsNoTracking()
            .ToListAsync();

        var cartoes = await _context.CartoesCredito
            .Where(c => c.CriadoPor == usuarioId)
            .Include(c => c.Banco)
            .OrderBy(c => c.Id)
            .AsNoTracking()
            .ToListAsync();

        // Os lançamentos da pessoa: de uma conta dela ou de um cartão dela (o filtro global já tira os excluídos).
        var lancamentos = _context.Transacoes.AsNoTracking()
            .Where(t => (t.ContaId != null && t.Conta!.UsuarioIdProprietario == usuarioId)
                        || (t.CartaoCreditoId != null && t.CartaoCredito!.CriadoPor == usuarioId));

        var hoje = HorarioBrasil.HojeData();
        var hojeDia = DateOnly.FromDateTime(hoje);
        var inicioDoMes = new DateOnly(ano, mes, 1);
        var fimDoMes = inicioDoMes.AddMonths(1);
        var inicioMesAnterior = inicioDoMes.AddMonths(-1);

        // P&L: receita/despesa REAL exclui o que só move saldo (transferência, pagamento de fatura, saldo
        // inicial, ajuste de reconciliação, Pix no Crédito) — regra única em RegrasFinanceiras.
        var doMes = lancamentos
            .Where(t => t.Data >= inicioDoMes && t.Data < fimDoMes)
            .Where(t => t.Ativo && t.StatusTransacao != StatusTransacao.Cancelado);
        // Com os juros dos pagamentos de empréstimo, cada lançamento pelo ValorNoResultado (o resto do empréstimo vai e volta).
        var resultadoDoMes = doMes.Where(RegrasFinanceiras.EntraNoResultadoComJuros);

        // 6 KPIs (#81): Executado = realizado (Recebido/Pago); Previsao = futuro (A receber / A pagar).
        var porTipoEStatus = await resultadoDoMes
            .GroupBy(t => new { t.Tipo, t.StatusTransacao })
            .Select(g => new { g.Key.Tipo, g.Key.StatusTransacao, Valor = g.Sum(t => t.EhEmprestimo ? (t.ValorJuros ?? 0m) : t.Valor) })
            .ToListAsync();
        decimal Soma(TipoTransacao tipo, StatusTransacao status) =>
            porTipoEStatus.Where(x => x.Tipo == tipo && x.StatusTransacao == status).Sum(x => x.Valor);
        var recebido = Soma(TipoTransacao.Receita, StatusTransacao.Executado);
        var aReceber = Soma(TipoTransacao.Receita, StatusTransacao.Previsao);
        var pago = Soma(TipoTransacao.Despesa, StatusTransacao.Executado);
        var aPagar = Soma(TipoTransacao.Despesa, StatusTransacao.Previsao);

        var receitasMes = recebido + aReceber;
        var despesasMes = pago + aPagar;

        // Caixa do mês e do anterior (cards "Entrou/Saiu" com variação, #1.3): Executado, fora o crédito não
        // pago e o que não entra no resultado. Também bate com /transacoes/stats.
        async Task<(decimal Entradas, decimal Saidas)> CaixaAsync(DateOnly de, DateOnly ate)
        {
            var linhas = await lancamentos
                .Where(t => t.Data >= de && t.Data < ate)
                .Where(t => t.Ativo && t.StatusTransacao == StatusTransacao.Executado && !t.UsadoComoCredito)
                .Where(RegrasFinanceiras.EntraNoResultadoComJuros)
                .GroupBy(t => t.Tipo)
                .Select(g => new { Tipo = g.Key, Valor = g.Sum(t => t.EhEmprestimo ? (t.ValorJuros ?? 0m) : t.Valor) })
                .ToListAsync();
            return (linhas.Where(l => l.Tipo == TipoTransacao.Receita).Sum(l => l.Valor),
                    linhas.Where(l => l.Tipo == TipoTransacao.Despesa).Sum(l => l.Valor));
        }
        var (receitasCaixaMes, despesasCaixaMes) = await CaixaAsync(inicioDoMes, fimDoMes);
        var (entradasCaixaMesAnterior, saidasCaixaMesAnterior) = await CaixaAsync(inicioMesAnterior, inicioDoMes);

        var saldoAnteriorAoMes = await lancamentos
            .Where(t => t.Data < inicioDoMes && !t.UsadoComoCredito
                        && t.Ativo && t.StatusTransacao == StatusTransacao.Executado)
            .SumAsync(t => t.Tipo == TipoTransacao.Receita ? t.Valor : -t.Valor);

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
        var gastosPorCategoria = (await doMes
                .Where(t => t.Tipo == TipoTransacao.Despesa && !t.UsadoComoCredito && t.StatusTransacao == StatusTransacao.Executado)
                .Where(RegrasFinanceiras.EntraNoResultadoComJuros)
                .GroupBy(t => t.Categoria != null ? t.Categoria.Descricao : null)
                .Select(g => new { Descricao = g.Key, Valor = g.Sum(t => t.EhEmprestimo ? (t.ValorJuros ?? 0m) : t.Valor) })
                .ToListAsync())
            .GroupBy(g => g.Descricao ?? "Sem categoria")
            .Select(g => new { Descricao = g.Key, Valor = g.Sum(x => x.Valor) })
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
        // Caixinha de meta: o lado de dentro da meta não entra (a mesma regra da lista de Transações); guardar,
        // resgatar e concluir aparecem uma vez só, na conta de onde o dinheiro saiu ou pra onde voltou.
        var recentes = (await lancamentos
                .Where(t => t.Ativo && t.StatusTransacao == StatusTransacao.Executado
                            && !t.EhSaldoInicial && t.Data <= hojeDia
                            && (t.ContaId == null || t.Conta!.Tipo != TipoConta.Caixinha))
                .OrderByDescending(t => t.Data)
                .ThenByDescending(t => t.Hora ?? TimeOnly.MinValue)
                .ThenByDescending(t => t.CriadoEm)
                .Take(7)
                .Select(t => new
                {
                    t.Id, t.Descricao, t.Valor, t.Tipo, t.CategoriaId, Categoria = t.Categoria != null ? t.Categoria.Descricao : null,
                    t.ContaId, t.CartaoCreditoId, Conta = t.Conta != null ? t.Conta.Nome : null,
                    Cartao = t.CartaoCredito != null ? t.CartaoCredito.Nome : null,
                    t.MeioPagamento, t.Data, t.Hora, t.EhTransferencia, t.EhPagamentoFatura,
                })
                .ToListAsync())
            .Select(t => new TransacaoRecenteDto
            {
                Id = t.Id,
                Descricao = t.Descricao,
                Valor = t.Valor,
                Tipo = (int)t.Tipo,
                CategoriaId = t.CategoriaId,
                Categoria = t.Categoria,
                ContaId = t.ContaId,
                CartaoCreditoId = t.CartaoCreditoId,
                Conta = t.ContaId.HasValue ? t.Conta : t.Cartao,
                MeioPagamento = t.MeioPagamento.HasValue ? (int)t.MeioPagamento.Value : null,
                MeioPagamentoDescricao = Domain.Enums.MeioPagamentoExtensions.Descricao(t.MeioPagamento),
                Data = t.Data,
                Hora = t.Hora,
                EhTransferencia = t.EhTransferencia,
                EhPagamentoFatura = t.EhPagamentoFatura,
            }).ToList();

        // Movimento REAL das contas (mesma regra do saldo: Ativo + Executado, só o que tem conta), somado por
        // mês no banco. É a base do saldo no tempo — o gráfico e a variação do hero falam o mesmo número.
        var movimentoPorMes = await lancamentos
            .Where(t => t.ContaId != null && t.Ativo && t.StatusTransacao == StatusTransacao.Executado)
            .GroupBy(t => new { t.Data.Year, t.Data.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Valor = g.Sum(t => t.Tipo == TipoTransacao.Receita ? t.Valor : -t.Valor) })
            .ToListAsync();
        decimal SaldoAntesDe(DateOnly data) =>
            movimentoPorMes.Where(m => new DateOnly(m.Year, m.Month, 1) < data).Sum(m => m.Valor);

        // Evolução do saldo das contas: 6 meses terminando no mês selecionado. Mesma base do saldo
        // do hero — o ponto do mês corrente é o próprio saldo total.
        var meses = new[] { "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez" };
        var evolucao = new List<EvolucaoMesDto>();
        for (var i = 5; i >= 0; i--)
        {
            var refDate = new DateTime(ano, mes, 1).AddMonths(-i);
            evolucao.Add(new EvolucaoMesDto
            {
                Label = $"{meses[refDate.Month - 1]}/{refDate:yy}",
                Ano = refDate.Year,
                Mes = refDate.Month,
                Saldo = SaldoAntesDe(DateOnly.FromDateTime(refDate.AddMonths(1)))
            });
        }

        // Saldo das contas no fim do mês PASSADO (em relação a hoje, não ao mês navegado) — o hero
        // mostra o saldo de hoje, então a variação tem que partir do mesmo relógio e da mesma base.
        // Antes vinha do gráfico (mês navegado, outra base) e comparava coisas diferentes.
        var saldoMesAnterior = SaldoAntesDe(new DateOnly(hoje.Year, hoje.Month, 1));

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

        var comprasCartaoMes = await ComprasNoCartaoDoMesAsync(usuarioId, inicioDoMes, fimDoMes);

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
            GastoCartaoMes = comprasCartaoMes.Sum(c => c.Valor),
            ComprasCartaoMes = comprasCartaoMes,
        };
    }

    /// <summary>
    /// O que foi passado no cartão no mês, À PARTE do caixa (decisão do Gustavo, 2026-10-03). Mesmas
    /// regras do total da fatura (<see cref="RegrasFinanceiras"/>): crédito à vista vivo pela data da
    /// compra (o parcelamento antigo grava uma transação por parcela, já datada no mês dela) + parcela
    /// não cancelada do parcelamento novo no mês da fatura dela (o "mês da parcela" da tela Cartões).
    /// Nunca o total da compra parcelada — só a parcela do mês, com o número.
    /// </summary>
    private async Task<List<CompraCartaoDto>> ComprasNoCartaoDoMesAsync(Guid usuarioId, DateOnly inicioDoMes, DateOnly fimDoMes)
    {
        int ano = inicioDoMes.Year, mes = inicioDoMes.Month;
        // Crédito à vista do mês (CompoeTotalFatura: no crédito e vivo; o filtro global já tira o excluído).
        var aVista = (await _context.Transacoes.AsNoTracking()
                .Where(t => t.CartaoCreditoId != null && t.CartaoCredito!.CriadoPor == usuarioId && t.UsadoComoCredito
                            && t.Data >= inicioDoMes && t.Data < fimDoMes)
                .Select(t => new { t.Descricao, t.Valor, t.Data, Cartao = t.CartaoCredito!.Nome, Categoria = t.Categoria != null ? t.Categoria.Descricao : null })
                .ToListAsync())
            .Select(x => new CompraCartaoDto
            {
                Descricao = x.Descricao,
                Valor = x.Valor,
                Data = x.Data,
                Cartao = x.Cartao,
                Categoria = x.Categoria,
            });

        var parcelas = (await _context.ParcelasTransacao
                .Where(p => p.Parcelamento!.CriadoPor == usuarioId
                            && p.Fatura!.DataFechamento.Year == ano && p.Fatura.DataFechamento.Month == mes)
                .Include(p => p.Parcelamento!).ThenInclude(pc => pc.Categoria)
                .Include(p => p.Parcelamento!).ThenInclude(pc => pc.CartaoCredito)
                .AsNoTracking()
                .ToListAsync())
            .Where(RegrasFinanceiras.CompoeTotalFatura)
            .Select(p => new CompraCartaoDto
            {
                Descricao = p.Parcelamento!.Descricao,
                Valor = RegrasFinanceiras.ValorDevidoParcela(p),
                Data = DateOnly.FromDateTime(p.Parcelamento.DataCompra),
                Parcela = p.Numero,
                TotalParcelas = p.QuantidadeTotal,
                Cartao = p.Parcelamento.CartaoCredito?.Nome,
                Categoria = p.Parcelamento.Categoria?.Descricao,
            });

        return aVista.Concat(parcelas)
            .OrderByDescending(c => c.Data)
            .ThenBy(c => c.Descricao)
            .ToList();
    }
}

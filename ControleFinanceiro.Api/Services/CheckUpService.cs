using System.Globalization;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.DinheiroDoMes;
using ControleFinanceiro.Api.DTOs.Relatorios;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// O check-up do mês (Relatórios do v2; plano em docs/features/relatorios/plano.md): a soma das respostas das outras
/// telas, numa página. Quanto entrou, saiu e sobrou; pra onde foi o dinheiro, cada categoria contra o normal dela; onde
/// dá pra cortar; quanto da renda já tem dono (contas fixas, parcelas, faturas, folga, metas); os últimos 12 meses; e
/// quantos meses o dinheiro de hoje cobre. Nenhuma conta nova: tudo pelas regras únicas (gasto do mês =
/// <see cref="RegrasFinanceiras.GastosPorCategoriaPorMesAsync"/>, renda = <see cref="RendaService"/>, contas fixas = o
/// custo por mês da tela Contas fixas, parcelas, faturas, saldos, folga = <see cref="ViabilidadeMetaService"/>).
/// Os avisos das outras telas (limites, metas, empréstimos…) vêm à parte, de <see cref="SinaisDoMesService"/>.
/// </summary>
public class CheckUpService
{
    private const int MesesNaSerie = 12;
    private const int MesesDoNormal = 3;
    private const int MaioresContasFixas = 5;
    private const int MaxCortes = 3;
    /// <summary>Faixas do comprometido (% da renda): até 40 tranquilo, até 60 atenção, acima alerta.</summary>
    public const decimal FaixaAtencao = 40m, FaixaAlerta = 60m;
    /// <summary>Passou do normal quando é pelo menos 30% e R$ 50 a mais (mesma régua da frase da categoria).</summary>
    private const decimal AcimaPct = 30m, AcimaReais = 50m;

    private readonly AppDbContext _context;
    private readonly RendaService _renda;
    private readonly RecorrenteService _recorrentes;
    private readonly ViabilidadeMetaService _viabilidade;

    public CheckUpService(AppDbContext context, RendaService renda, RecorrenteService recorrentes, ViabilidadeMetaService? viabilidade = null)
    {
        _context = context;
        _renda = renda;
        _recorrentes = recorrentes;
        _viabilidade = viabilidade ?? new ViabilidadeMetaService(context, renda, new MetaService(context, new TransferenciaService(context)));
    }

    public async Task<CheckUpDto> CalcularAsync(Guid usuarioId, int ano, int mes)
    {
        if (mes is < 1 or > 12 || ano is < 2000 or > 2100)
            throw new ArgumentException("Mês inválido.");
        var hoje = HorarioBrasil.HojeData();
        var inicio = new DateTime(ano, mes, 1);
        if (inicio > new DateTime(hoje.Year, hoje.Month, 1))
            throw new ArgumentException("Esse mês ainda não chegou.");
        var mesAtual = ano == hoje.Year && mes == hoje.Month;
        var nomeMes = MesesPt.Nome(mes);

        // A série: a renda que entrou e o gasto de cada mês (gasto numa consulta só). O gráfico mês a mês mostra uma
        // janela FIXA de 12 meses que termina no mês atual (escolher um mês dentro dela não some com os depois dele);
        // só um mês mais antigo que a janela leva ela junto. A série começa cedo o bastante pro mês anterior e o normal.
        var esteMes = new DateTime(hoje.Year, hoje.Month, 1);
        var fim = inicio.AddMonths(MesesNaSerie - 1) < esteMes ? inicio.AddMonths(MesesNaSerie - 1) : esteMes;
        var primeiro = fim.AddMonths(-(MesesNaSerie - 1));
        if (inicio.AddMonths(-MesesDoNormal) < primeiro) primeiro = inicio.AddMonths(-MesesDoNormal);
        var meses = (fim.Year - primeiro.Year) * 12 + fim.Month - primeiro.Month + 1;
        var gastosPorMes = await RegrasFinanceiras.GastosPorCategoriaPorMesAsync(_context, usuarioId, primeiro, meses);
        var investidoPorMes = await RegrasFinanceiras.InvestidoPorMesAsync(_context, usuarioId, primeiro, meses);
        var planejadoPorMes = await OrcamentoService.PlanejadoPorMesAsync(_context, usuarioId, primeiro, meses);
        var serie = new List<(int Ano, int Mes, decimal Entrou, decimal RendaEsperada, Dictionary<Guid, RegrasFinanceiras.GastoCategoria> Gastos)>();
        var idx = (inicio.Year - primeiro.Year) * 12 + inicio.Month - primeiro.Month;
        decimal rendaEsperadaDoMes = 0m;
        for (var i = 0; i < meses; i++)
        {
            var m = primeiro.AddMonths(i);
            var renda = await _renda.ObterMesAsync(usuarioId, m.Year, m.Month);
            if (i == idx) rendaEsperadaDoMes = renda.Previsto;
            serie.Add((m.Year, m.Month, renda.Recebido, renda.Previsto, gastosPorMes.GetValueOrDefault((m.Year, m.Month)) ?? new()));
        }
        static decimal Gasto(Dictionary<Guid, RegrasFinanceiras.GastoCategoria> g) => g.Values.Sum(x => x.Gasto);

        var doMes = serie[idx];
        var anterior = serie[idx - 1];
        var entrou = doMes.Entrou;
        var saiu = Gasto(doMes.Gastos);
        var sobrou = entrou - saiu;
        static decimal? Contra(decimal valor, decimal antes) => antes > 0 ? Math.Round((valor - antes) * 100m / antes, 0) : null;

        // O normal: a média dos meses anteriores (até 3) em que a pessoa teve algum gasto. Mês sem nada lançado não
        // puxa a média pra baixo (quem começou a usar o app agora não tem "normal" zerado). Com as parcelas (decisão do
        // Gustavo, 2026-10-28: enquanto paga, a parcela faz parte do mês normal).
        var mesesDoNormal = serie.Take(idx).Reverse().Take(MesesDoNormal).Where(m => Gasto(m.Gastos) > 0).ToList();
        decimal? gastoNormal = mesesDoNormal.Count > 0 ? Math.Round(mesesDoNormal.Average(m => Gasto(m.Gastos)), 2) : null;
        decimal? NormalDa(Guid categoria) => mesesDoNormal.Count > 0
            ? Math.Round(mesesDoNormal.Sum(m => m.Gastos.GetValueOrDefault(categoria).Gasto) / mesesDoNormal.Count, 2)
            : null;

        // Pra onde foi: todas as categorias do mês, as maiores primeiro (a tela mostra as 5 maiores e recolhe o resto, sem
        // esconder nenhuma); "Sem categoria" fica fora do ranking (vem à parte, com ação).
        decimal PctDoGasto(decimal v) => saiu > 0 ? Math.Round(v * 100m / saiu, 1) : 0m;
        static decimal? Variacao(decimal valor, decimal? normal) =>
            normal is > 0 ? Math.Round((valor - normal.Value) * 100m / normal.Value, 0) : null;
        var porCategoria = doMes.Gastos.Where(kv => kv.Key != RegrasFinanceiras.SemCategoria && (kv.Value.Gasto > 0 || kv.Value.Previsto > 0))
            .OrderByDescending(kv => kv.Value.Gasto).ThenByDescending(kv => kv.Value.Previsto).ToList();
        var ids = porCategoria.Select(kv => kv.Key).ToList();
        var nomes = await _context.Categorias.AsNoTracking().Where(c => ids.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Descricao);
        var praOndeFoi = porCategoria
            .Select(kv =>
            {
                var normal = NormalDa(kv.Key);
                return new CategoriaDoCheckUpDto(kv.Key, nomes.GetValueOrDefault(kv.Key, "Categoria"), kv.Value.Gasto, PctDoGasto(kv.Value.Gasto),
                    normal, Variacao(kv.Value.Gasto, normal), kv.Value.Previsto);
            })
            .ToList();
        var semCategoriaValor = doMes.Gastos.GetValueOrDefault(RegrasFinanceiras.SemCategoria).Gasto;
        SemCategoriaDto? semCategoria = semCategoriaValor > 0
            ? new SemCategoriaDto(semCategoriaValor, PctDoGasto(semCategoriaValor),
                await RegrasFinanceiras.QuantidadeSemCategoriaDoMesAsync(_context, usuarioId, ano, mes))
            : null;

        // Comprometido: contas fixas (o custo por mês da tela Contas fixas) + as parcelas que caem no mês, contra a
        // renda do mês (a maior entre a esperada e a que entrou, como no cartão da renda).
        var stats = await _recorrentes.ObterStatsAsync(usuarioId);
        var contasFixas = stats.CustoMensalDespesas;
        var parcelas = (await RegrasFinanceiras.ParcelasPorMesAsync(_context, usuarioId, inicio, 1, soPendentes: false)).Sum(p => p.Valor);
        var rendaBase = Math.Max(rendaEsperadaDoMes, entrou);
        decimal? comprometido = rendaBase > 0 ? Math.Round((contasFixas + parcelas) * 100m / rendaBase, 0) : null;
        var detalhe = await ComprometidoAsync(usuarioId, inicio, ano, mes, mesAtual, comprometido, contasFixas, parcelas, rendaBase, stats.QtdTotal);

        // Reserva: o dinheiro disponível hoje (contas abertas, sem as caixinhas das metas) contra o gasto de um mês normal.
        var dinheiro = await RegrasFinanceiras.SaldoDisponivelAsync(_context, usuarioId);
        var nasMetas = await RegrasFinanceiras.GuardadoNasCaixinhasAsync(_context, usuarioId);
        decimal? mesesDeReserva = gastoNormal is > 0 && dinheiro > 0 ? Math.Round(dinheiro / gastoNormal.Value, 1) : null;

        var mesAMes = serie.TakeLast(MesesNaSerie)
            .Select(m =>
            {
                var planejado = planejadoPorMes.GetValueOrDefault((m.Ano, m.Mes));
                return new MesDoCheckUpDto(m.Ano, m.Mes, m.Entrou, Gasto(m.Gastos), m.Entrou - Gasto(m.Gastos), investidoPorMes.GetValueOrDefault((m.Ano, m.Mes)),
                    m.RendaEsperada, planejado.Despesas, planejado.Investimentos);
            })
            .ToList();
        decimal? pctQueSobrou = entrou > 0 ? Math.Round(sobrou * 100m / entrou, 0) : null;

        var corte = gastoNormal is null ? null : await CorteAsync(usuarioId, ano, mes, nomeMes, sobrou, praOndeFoi);
        var resposta = Responder(mes, mesAtual, entrou, saiu, sobrou, pctQueSobrou, comprometido, mesesDeReserva, rendaEsperadaDoMes, praOndeFoi,
            gastoNormal, semCategoria, LinkSemCategoria(ano, mes));
        // O que a manchete já pede (Classificar, Dizer a renda) não repete na lista de avisos.
        var jaPedido = resposta.Acoes.Select(a => a.Rotulo).ToHashSet();
        var sinais = SeusDados(ano, mes, nomeMes, mesAtual, saiu, semCategoria, rendaEsperadaDoMes, stats.QtdTotal)
            .Where(si => !si.Resposta.Acoes.Any(a => jaPedido.Contains(a.Rotulo))).ToList();

        return new CheckUpDto(ano, mes, mesAtual, entrou, saiu, sobrou, pctQueSobrou,
            Contra(entrou, anterior.Entrou), Contra(saiu, Gasto(anterior.Gastos)), anterior.Entrou - Gasto(anterior.Gastos),
            contasFixas, parcelas, comprometido, praOndeFoi, semCategoria, mesAMes,
            dinheiro, nasMetas, gastoNormal, mesesDeReserva, ResponderReserva(mesesDeReserva, dinheiro, gastoNormal),
            detalhe, corte, sinais, resposta);
    }

    /// <summary>
    /// O "Ano completo": de janeiro até o mês de hoje (ano atual) ou dezembro (ano passado), pelas mesmas regras do mês.
    /// Cada mês = a linha do tempo (realizado e planejado); o ano = a soma dos meses; cada categoria = o gasto somado, contra
    /// o mesmo período do ano anterior (o normal do ano) e a soma do limite vigente em cada mês. Sem categoria, à parte.
    /// </summary>
    public async Task<AnoDoCheckUpDto> AnoAsync(Guid usuarioId, int ano)
    {
        var hoje = HorarioBrasil.HojeData();
        if (ano < 2000 || ano > hoje.Year)
            throw new ArgumentException("Esse ano ainda não chegou.");
        var anoAtual = ano == hoje.Year;
        var ateMes = anoAtual ? hoje.Month : 12;
        var inicio = new DateTime(ano, 1, 1);
        // Um ano antes também, pro normal (o mesmo período do ano anterior), numa consulta só.
        var gastosPorMes = await RegrasFinanceiras.GastosPorCategoriaPorMesAsync(_context, usuarioId, inicio.AddYears(-1), 12 + ateMes);
        var investidoPorMes = await RegrasFinanceiras.InvestidoPorMesAsync(_context, usuarioId, inicio, ateMes);
        var planejadoPorMes = await OrcamentoService.PlanejadoPorMesAsync(_context, usuarioId, inicio, 12);
        var limites = await OrcamentoService.LimitesPorCategoriaAsync(_context, usuarioId, inicio, ateMes);

        var meses = new List<MesDoCheckUpDto>();
        var doAno = new Dictionary<Guid, decimal>();
        var antes = new Dictionary<Guid, decimal>();
        var semCategoriaQtd = 0;
        for (var mes = 1; mes <= ateMes; mes++)
        {
            var renda = await _renda.ObterMesAsync(usuarioId, ano, mes);
            var gastos = gastosPorMes.GetValueOrDefault((ano, mes)) ?? new();
            var saiu = gastos.Values.Sum(g => g.Gasto);
            var planejado = planejadoPorMes.GetValueOrDefault((ano, mes));
            meses.Add(new MesDoCheckUpDto(ano, mes, renda.Recebido, saiu, renda.Recebido - saiu, investidoPorMes.GetValueOrDefault((ano, mes)),
                renda.Previsto, planejado.Despesas, planejado.Investimentos));
            foreach (var (categoria, g) in gastos) doAno[categoria] = doAno.GetValueOrDefault(categoria) + g.Gasto;
            foreach (var (categoria, g) in gastosPorMes.GetValueOrDefault((ano - 1, mes)) ?? new()) antes[categoria] = antes.GetValueOrDefault(categoria) + g.Gasto;
            if (gastos.GetValueOrDefault(RegrasFinanceiras.SemCategoria).Gasto > 0)
                semCategoriaQtd += await RegrasFinanceiras.QuantidadeSemCategoriaDoMesAsync(_context, usuarioId, ano, mes);
        }
        // Os totais e o planejado do ano são até o mês de hoje (comparar o que aconteceu com o planejado do mesmo período).
        // A linha do tempo vai sempre até dezembro: os meses que ainda não chegaram trazem só o planejado.
        for (var mes = ateMes + 1; mes <= 12; mes++)
        {
            var renda = await _renda.ObterMesAsync(usuarioId, ano, mes);
            var planejado = planejadoPorMes.GetValueOrDefault((ano, mes));
            meses.Add(new MesDoCheckUpDto(ano, mes, 0m, 0m, 0m, 0m, renda.Previsto, planejado.Despesas, planejado.Investimentos));
        }
        var ateHoje = meses.Where(m => m.Mes <= ateMes).ToList();
        var totalSaiu = ateHoje.Sum(m => m.Saiu);
        var temAnoAnterior = antes.Values.Any(v => v > 0);
        decimal Pct(decimal v) => totalSaiu > 0 ? Math.Round(v * 100m / totalSaiu, 1) : 0m;

        // As categorias com gasto ou limite no ano (as maiores primeiro); Sem categoria fica à parte, com a ação.
        var ids = doAno.Where(kv => kv.Value > 0).Select(kv => kv.Key).Union(limites.Keys).Where(id => id != RegrasFinanceiras.SemCategoria).ToList();
        var nomes = await _context.Categorias.AsNoTracking().Where(c => ids.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Descricao);
        var categorias = ids.Select(id =>
            {
                var valor = doAno.GetValueOrDefault(id);
                decimal? normal = temAnoAnterior ? antes.GetValueOrDefault(id) : null;
                decimal? variacao = normal is > 0 ? Math.Round((valor - normal.Value) * 100m / normal.Value, 0) : null;
                return new CategoriaDoAnoDto(id, nomes.GetValueOrDefault(id, "Categoria"), valor, Pct(valor), normal, variacao,
                    limites.TryGetValue(id, out var l) ? l : null);
            })
            .OrderByDescending(c => c.Valor).ThenByDescending(c => c.Limite ?? 0m).ToList();
        var semCategoriaValor = doAno.GetValueOrDefault(RegrasFinanceiras.SemCategoria);

        var entrou = ateHoje.Sum(m => m.Entrou);
        var primeiroLancamento = await _context.Transacoes.AsNoTracking().Where(t => t.CriadoPor == usuarioId && t.Ativo)
            .MinAsync(t => (DateOnly?)t.Data);
        var primeiroAno = Math.Min(primeiroLancamento?.Year ?? hoje.Year, hoje.Year);
        return new AnoDoCheckUpDto(ano, ateMes, anoAtual, entrou, totalSaiu, entrou - totalSaiu, ateHoje.Sum(m => m.Investido),
            ateHoje.Sum(m => m.RendaEsperada), ateHoje.Sum(m => m.DespesasPlanejadas), ateHoje.Sum(m => m.InvestimentosPlanejados),
            meses, categorias, semCategoriaValor > 0 ? new SemCategoriaDto(semCategoriaValor, Pct(semCategoriaValor), semCategoriaQtd) : null,
            primeiroAno);
    }

    /// <summary>Transações filtrada pela URL: o que ficou sem categoria no mês (a tela lê os parâmetros e mostra o filtro).</summary>
    public static string LinkSemCategoria(int ano, int mes) => $"/transacoes?categoriaId={Guid.Empty}&mes={ano:D4}-{mes:D2}";

    /// <summary>Transações filtrada pela categoria e pelo mês.</summary>
    public static string LinkCategoria(Guid categoriaId, int ano, int mes) => $"/transacoes?categoriaId={categoriaId}&mes={ano:D4}-{mes:D2}";

    private async Task<ComprometidoDto> ComprometidoAsync(Guid usuarioId, DateTime inicio, int ano, int mes, bool mesAtual,
        decimal? comprometido, decimal contasFixas, decimal parcelas, decimal rendaBase, int qtdContasFixas)
    {
        var (maiores, total) = await _recorrentes.MaioresContasFixasAsync(usuarioId, MaioresContasFixas);

        // Parcelas já compradas pros próximos meses (as que faltam pagar), 3 meses e até quando vão.
        var futuras = (await RegrasFinanceiras.ParcelasPorMesAsync(_context, usuarioId, inicio.AddMonths(1), 60, soPendentes: true))
            .GroupBy(p => (p.Ano, p.Mes)).Select(g => new ParcelasNoMesDto(g.Key.Ano, g.Key.Mes, g.Sum(p => p.Valor)))
            .OrderBy(p => p.Ano).ThenBy(p => p.Mes).ToList();
        var ultima = futuras.LastOrDefault();

        // A compra parcelada cuja última parcela cai no mês seguinte: a partir do outro, sobra esse valor todo mês.
        var seguinte = inicio.AddMonths(1);
        var fimDasParcelas = await _context.ParcelasTransacao.AsNoTracking()
            .Where(p => p.Parcelamento!.CriadoPor == usuarioId && p.Parcelamento.Ativo && p.Status != StatusParcela.Cancelada)
            .GroupBy(p => new { p.ParcelamentoId, p.Parcelamento!.Descricao })
            .Select(g => new { g.Key.Descricao, Ultima = g.Max(p => p.DataVencimento), Valor = g.Max(p => p.ValorComJuros ?? p.Valor) })
            .ToListAsync();
        var acaba = fimDasParcelas.Where(p => p.Ultima.Year == seguinte.Year && p.Ultima.Month == seguinte.Month)
            .OrderByDescending(p => p.Valor).FirstOrDefault();

        var faturas = (await RegrasFinanceiras.FaturasAPagarNoMesAsync(_context, usuarioId, ano, mes))
            .Select(f => new FaturaDoCheckUpDto(f.CartaoId, f.Cartao, f.DataVencimento, f.Total, f.Pago, f.Restante, f.Atrasada)).ToList();

        // Folga por mês e o que as metas pedem: são de hoje (renda esperada, gasto normal, parcelas que faltam).
        decimal? folga = null;
        var metasPedem = 0m;
        if (mesAtual)
        {
            var dasMetas = await _viabilidade.DasMetasAsync(usuarioId);
            folga = dasMetas.Folga;
            metasPedem = dasMetas.PedemPorMes;
        }

        return new ComprometidoDto(
            maiores.Select(m => new ContaFixaDoCheckUpDto(m.Id, m.Descricao, m.PorMes)).ToList(), total,
            futuras.Take(3).ToList(), ultima?.Ano, ultima?.Mes,
            acaba is null ? null : new ParcelaQueAcabaDto(acaba.Descricao, acaba.Ultima.Year, acaba.Ultima.Month, acaba.Valor),
            faturas, folga, metasPedem, FaixaAtencao, FaixaAlerta,
            ResponderComprometido(mes, mesAtual, comprometido, contasFixas, parcelas, rendaBase, qtdContasFixas));
    }

    /// <summary>A frase do comprometido: nunca some (sem renda ou sem conta fixa, diz o que fazer).</summary>
    public static RespostaDto? ResponderComprometido(int mes, bool mesAtual, decimal? comprometido, decimal contasFixas, decimal parcelas,
        decimal rendaBase, int qtdContasFixas)
    {
        if (comprometido is null)
            return mesAtual
                ? new RespostaDto("neutro", "Diga quanto você espera receber pra saber quanto da renda já tem dono.", [new AcaoDto("Dizer a renda", "/orcamento")])
                : new RespostaDto("neutro", $"Sem renda em {MesesPt.Nome(mes)}.", []);
        if (contasFixas == 0 && parcelas == 0)
            return qtdContasFixas == 0
                ? new RespostaDto("neutro", "Nenhuma conta fixa cadastrada.", [new AcaoDto("Cadastrar conta fixa", "/contas-fixas/nova")])
                : null;
        var c = comprometido.Value;
        var texto = $"Contas fixas e parcelas levam {Reais.Formatar(contasFixas + parcelas)} dos {Reais.Formatar(rendaBase)} da renda ({c}%).";
        return c > FaixaAlerta ? new RespostaDto("alerta", texto + " Pouca coisa sobra pro resto do mês.", [new AcaoDto("Ver contas fixas", "/contas-fixas")])
            : c > FaixaAtencao ? new RespostaDto("neutro", texto, [])
            : new RespostaDto("positivo", texto, []);
    }

    /// <summary>A frase da reserva: quantos meses o que está nas contas cobre e quanto falta pra 3.</summary>
    public static RespostaDto? ResponderReserva(decimal? meses, decimal dinheiro, decimal? gastoNormal)
    {
        if (meses is not { } m || gastoNormal is not { } g) return null;
        var cobre = $"O que está nas contas cobre {Duracao(m)} do seu gasto normal.";
        if (m >= 6) return new RespostaDto("positivo", cobre, []);
        if (m >= 3) return new RespostaDto("neutro", cobre, []);
        return new RespostaDto("alerta", $"{cobre} Pra cobrir 3 meses, faltam {Reais.Formatar(Math.Max(0m, g * 3m - dinheiro))}.",
            [new AcaoDto("Ver metas", "/metas")]);
    }

    /// <summary>
    /// "Dá pra cortar onde?" (versão 1, sem o dado "essencial"): as categorias que mais passaram do normal (até 3,
    /// ordem do quanto a mais) e as contas fixas que começaram no mês. Sem categoria fica de fora (tem o seu aviso).
    /// </summary>
    private async Task<CorteDto> CorteAsync(Guid usuarioId, int ano, int mes, string nomeMes, decimal sobrou, List<CategoriaDoCheckUpDto> praOndeFoi)
    {
        var categorias = praOndeFoi
            .Where(c => c.CategoriaId is not null && c.Normal is { } n && c.VariacaoPercentual >= AcimaPct && c.Valor - n >= AcimaReais)
            .OrderByDescending(c => c.Valor - c.Normal!.Value).Take(MaxCortes)
            .Select(c => new ItemDeCorteDto("categoria", c.CategoriaId, c.Nome, c.Valor, c.Normal, c.Valor - c.Normal!.Value, c.Previsto))
            .ToList();
        var inicio = new DateTime(ano, mes, 1);
        var fim = inicio.AddMonths(1);
        var novas = await _context.Recorrentes.AsNoTracking()
            .Where(r => r.CriadoPor == usuarioId && r.ExcluidoEm == null && r.Ativo && r.Tipo == TipoTransacao.Despesa
                        && r.DataInicio >= inicio && r.DataInicio < fim)
            .OrderByDescending(r => r.Valor)
            .Select(r => new { r.Id, r.Descricao, r.Valor })
            .Take(MaxCortes)
            .ToListAsync();
        var itens = categorias.Concat(novas.Select(n => new ItemDeCorteDto("conta-fixa", n.Id, n.Descricao, n.Valor, null, n.Valor, 0m))).ToList();

        if (categorias.Count == 0)
            return new CorteDto(new RespostaDto("positivo", $"Nenhuma categoria passou do normal em {nomeMes}.", []), itens);
        var aMais = categorias.Sum(c => c.AMais);
        var quantas = categorias.Count == 1 ? $"{categorias[0].Nome} passou do normal" : $"{Extenso(categorias.Count)} categorias passaram do normal";
        var texto = $"{quantas} em {nomeMes}: {Reais.Formatar(aMais)} a mais{(categorias.Count > 1 ? ", no total" : "")}.";
        if (sobrou < 0)
            texto += $" Pra fechar o mês no azul faltam {Reais.Formatar(-sobrou)}.";
        return new CorteDto(new RespostaDto(sobrou < 0 ? "alerta" : "neutro", texto, []), itens);
    }

    /// <summary>"Seus dados": o que falta pro app responder melhor (sem categoria, renda não dita), sempre com a ação que arruma.</summary>
    public static List<SinalDto> SeusDados(int ano, int mes, string nomeMes, bool mesAtual, decimal saiu, SemCategoriaDto? semCategoria,
        decimal rendaEsperada, int qtdContasFixas)
    {
        var sinais = new List<SinalDto>();
        if (semCategoria is { } sc)
            sinais.Add(new SinalDto($"sem-categoria-{ano}-{mes}", "dados", sc.Valor, false, new RespostaDto("neutro",
                $"{sc.Quantidade} {(sc.Quantidade == 1 ? "lançamento" : "lançamentos")} de {nomeMes} ainda sem categoria ({Reais.Formatar(sc.Valor)}).",
                [new AcaoDto("Classificar", LinkSemCategoria(ano, mes))])));
        if (mesAtual && rendaEsperada <= 0)
            sinais.Add(new SinalDto("renda-nao-dita", "dados", 0m, true, new RespostaDto("neutro",
                "Você ainda não disse quanto espera receber.", [new AcaoDto("Dizer a renda", "/orcamento")])));
        // "Nenhuma conta fixa cadastrada" não entra aqui: o Comprometido já diz, com a ação, logo abaixo.
        return sinais;
    }

    /// <summary>O check-up em uma frase (fato, sem julgamento) e o que dá pra fazer.</summary>
    public static RespostaDto Responder(int mes, bool mesAtual, decimal entrou, decimal saiu, decimal sobrou, decimal? pctQueSobrou,
        decimal? comprometido, decimal? mesesDeReserva, decimal rendaEsperada, List<CategoriaDoCheckUpDto> praOndeFoi,
        decimal? gastoNormal = null, SemCategoriaDto? semCategoria = null, string? linkSemCategoria = null)
    {
        var nome = MesesPt.Nome(mes);
        if (entrou == 0 && saiu == 0)
            return new RespostaDto("neutro", $"Nada lançado em {nome} ainda.",
                [new AcaoDto("Nova transação", "/transacoes/nova"), new AcaoDto("Importar extrato", "/importar")]);

        var quando = mesAtual ? $"Em {nome}, até agora," : $"Em {nome}";
        var frases = new List<string>();
        string tom;
        if (entrou <= 0)
        {
            frases.Add($"{quando} saíram {Reais.Formatar(saiu)} e não entrou renda.");
            tom = "alerta";
        }
        else if (sobrou >= 0)
        {
            frases.Add($"{quando} entraram {Reais.Formatar(entrou)} e saíram {Reais.Formatar(saiu)}: sobraram {Reais.Formatar(sobrou)} ({pctQueSobrou}% do que entrou).");
            tom = pctQueSobrou >= 10 ? "positivo" : "neutro";
        }
        else
        {
            frases.Add($"{quando} entraram {Reais.Formatar(entrou)} e saíram {Reais.Formatar(saiu)}: {Reais.Formatar(-sobrou)} a mais do que entrou.");
            tom = "negativo";
        }
        var acoes = new List<AcaoDto>();

        // O total do mês passou do normal (mesma régua da categoria), antes de dizer qual categoria puxou.
        if (gastoNormal is { } gn && gn > 0 && saiu - gn >= AcimaReais && (saiu - gn) * 100m / gn >= AcimaPct)
            frases.Add($"Saiu {Math.Round((saiu - gn) * 100m / gn, 0)}% a mais que o normal dos últimos meses.");
        // Sem conta fixa nem parcela, "levam 0% da renda" não diz nada: a frase sai (o Comprometido diz o que fazer).
        if (comprometido is { } c && c > 0)
            frases.Add($"As contas fixas e as parcelas levam {c}% da renda.");
        if (mesesDeReserva is { } r)
            frases.Add($"O dinheiro de hoje cobre {Duracao(r)} do seu gasto normal.");

        // A categoria que mais passou do normal (pelo menos 30% e R$ 50 a mais): o que a pessoa mais quer saber.
        var acima = praOndeFoi
            .Where(x => x.CategoriaId is not null && x.VariacaoPercentual >= AcimaPct && x.Normal is { } n && x.Valor - n >= AcimaReais)
            .OrderByDescending(x => x.Valor - x.Normal!.Value)
            .FirstOrDefault();
        if (acima is not null)
        {
            frases.Add($"{acima.Nome} veio {acima.VariacaoPercentual}% acima do normal.");
            acoes.Add(new AcaoDto("Ver o planejado", "/orcamento"));
        }
        // Muita coisa sem categoria: os números de categoria não dizem muito até classificar.
        if (semCategoria is { } sc && saiu > 0 && sc.Valor * 100m / saiu > AcimaPct && linkSemCategoria is not null)
        {
            frases.Add($"{Reais.Formatar(sc.Valor)} do mês ainda sem categoria.");
            acoes.Insert(0, new AcaoDto("Classificar", linkSemCategoria));
        }
        if (rendaEsperada <= 0)
            acoes.Add(new AcaoDto("Dizer a renda", "/orcamento"));
        return new RespostaDto(tom, string.Join(" ", frases), acoes);
    }

    private static string Extenso(int n) => n switch { 2 => "Duas", 3 => "Três", _ => n.ToString(CultureInfo.InvariantCulture) };

    /// <summary>
    /// Quanto tempo o dinheiro dura, sem número vago: menos de um mês em dias ("12 dias"), depois em meses com uma casa
    /// ("4,6 meses"). Texto de dinheiro passa confiança sendo exato (pedido do Gustavo, 2026-10-29: nada de "uns").
    /// </summary>
    public static string Duracao(decimal meses)
    {
        if (meses < 1m)
        {
            var dias = Math.Max(1, (int)Math.Round(meses * 30m, MidpointRounding.AwayFromZero));
            return dias == 1 ? "1 dia" : $"{dias} dias";
        }
        return meses == 1m ? "1 mês" : $"{Numero(meses)} meses";
    }

    /// <summary>"2,5" / "3" (vírgula, sem depender da cultura da máquina).</summary>
    private static string Numero(decimal v) => v.ToString("0.#", CultureInfo.InvariantCulture).Replace('.', ',');
}

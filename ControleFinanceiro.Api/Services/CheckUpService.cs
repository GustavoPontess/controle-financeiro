using System.Globalization;
using ControleFinanceiro.Api.DTOs.DinheiroDoMes;
using ControleFinanceiro.Api.DTOs.Relatorios;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// O check-up do mês (Relatórios do v2; docs/features/respostas/visao.md, camada 3): a soma das respostas das outras
/// telas, numa página. Quanto entrou, saiu e sobrou; quanto da renda as contas fixas e as parcelas já levam; pra onde
/// foi o dinheiro, cada categoria contra o normal dela; os últimos 12 meses; e quantos meses o dinheiro de hoje cobre.
/// Nenhuma conta nova: tudo pelas regras únicas (gasto do mês = <see cref="RegrasFinanceiras.GastosPorCategoriaDoMesAsync"/>,
/// renda = <see cref="RendaService"/>, contas fixas = o custo por mês da tela Contas fixas, parcelas, saldos).
/// </summary>
public class CheckUpService
{
    private const int MesesNaSerie = 12;
    private const int MesesDoNormal = 3;
    private const int MaxCategorias = 6;

    private readonly AppDbContext _context;
    private readonly RendaService _renda;
    private readonly RecorrenteService _recorrentes;

    public CheckUpService(AppDbContext context, RendaService renda, RecorrenteService recorrentes)
    {
        _context = context;
        _renda = renda;
        _recorrentes = recorrentes;
    }

    public async Task<CheckUpDto> CalcularAsync(Guid usuarioId, int ano, int mes)
    {
        if (mes is < 1 or > 12 || ano is < 2000 or > 2100)
            throw new ArgumentException("Mês inválido.");
        var hoje = HorarioBrasil.HojeData();
        var mesAtual = ano == hoje.Year && mes == hoje.Month;
        var inicio = new DateTime(ano, mes, 1);

        // A série: os 12 meses que terminam neste, com a renda que entrou e o gasto de cada um (efetivado).
        var serie = new List<(int Ano, int Mes, decimal Entrou, Dictionary<Guid, RegrasFinanceiras.GastoCategoria> Gastos)>();
        decimal rendaEsperadaDoMes = 0m;
        for (var i = MesesNaSerie - 1; i >= 0; i--)
        {
            var m = inicio.AddMonths(-i);
            var renda = await _renda.ObterMesAsync(usuarioId, m.Year, m.Month);
            if (i == 0) rendaEsperadaDoMes = renda.Previsto;
            var gastos = await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(_context, usuarioId, m.Year, m.Month);
            serie.Add((m.Year, m.Month, renda.Recebido, gastos));
        }
        static decimal Gasto(Dictionary<Guid, RegrasFinanceiras.GastoCategoria> g) => g.Values.Sum(x => x.Gasto);

        var doMes = serie[^1];
        var entrou = doMes.Entrou;
        var saiu = Gasto(doMes.Gastos);
        var sobrou = entrou - saiu;

        // O normal: a média dos meses anteriores (até 3) em que a pessoa teve algum gasto. Mês sem nada lançado não
        // puxa a média pra baixo (quem começou a usar o app agora não tem "normal" zerado).
        var mesesDoNormal = serie.Take(serie.Count - 1).Reverse().Take(MesesDoNormal).Where(m => Gasto(m.Gastos) > 0).ToList();
        decimal? gastoNormal = mesesDoNormal.Count > 0 ? Math.Round(mesesDoNormal.Average(m => Gasto(m.Gastos)), 2) : null;
        decimal? NormalDa(Guid categoria) => mesesDoNormal.Count > 0
            ? Math.Round(mesesDoNormal.Sum(m => m.Gastos.GetValueOrDefault(categoria).Gasto) / mesesDoNormal.Count, 2)
            : null;

        // Pra onde foi: as maiores categorias do mês; passando de 6, o resto vira "Outras".
        var porCategoria = doMes.Gastos.Where(kv => kv.Value.Gasto > 0).OrderByDescending(kv => kv.Value.Gasto).ToList();
        var ids = porCategoria.Select(kv => kv.Key).Where(id => id != RegrasFinanceiras.SemCategoria).ToList();
        var nomes = await _context.Categorias.AsNoTracking().Where(c => ids.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Descricao);
        decimal PctDoGasto(decimal v) => saiu > 0 ? Math.Round(v * 100m / saiu, 1) : 0m;
        static decimal? Variacao(decimal valor, decimal? normal) =>
            normal is > 0 ? Math.Round((valor - normal.Value) * 100m / normal.Value, 0) : null;
        var praOndeFoi = porCategoria.Take(porCategoria.Count > MaxCategorias ? MaxCategorias - 1 : MaxCategorias)
            .Select(kv =>
            {
                var id = kv.Key == RegrasFinanceiras.SemCategoria ? (Guid?)null : kv.Key;
                var normal = NormalDa(kv.Key);
                return new CategoriaDoCheckUpDto(id, id is null ? "Sem categoria" : nomes.GetValueOrDefault(id.Value, "Categoria"),
                    kv.Value.Gasto, PctDoGasto(kv.Value.Gasto), normal, Variacao(kv.Value.Gasto, normal));
            })
            .ToList();
        if (porCategoria.Count > MaxCategorias)
        {
            var resto = porCategoria.Skip(MaxCategorias - 1).ToList();
            var valor = resto.Sum(kv => kv.Value.Gasto);
            decimal? normal = mesesDoNormal.Count > 0 ? resto.Sum(kv => NormalDa(kv.Key) ?? 0m) : null;
            praOndeFoi.Add(new CategoriaDoCheckUpDto(null, "Outras", valor, PctDoGasto(valor), normal, Variacao(valor, normal)));
        }

        // Comprometido: contas fixas (o custo por mês da tela Contas fixas) + as parcelas que caem no mês, contra a
        // renda do mês (a maior entre a esperada e a que entrou, como no cartão da renda).
        var contasFixas = (await _recorrentes.ObterStatsAsync(usuarioId)).CustoMensalDespesas;
        var parcelas = (await RegrasFinanceiras.ParcelasPorMesAsync(_context, usuarioId, inicio, 1, soPendentes: false)).Sum(p => p.Valor);
        var rendaBase = Math.Max(rendaEsperadaDoMes, entrou);
        decimal? comprometido = rendaBase > 0 ? Math.Round((contasFixas + parcelas) * 100m / rendaBase, 0) : null;

        // Reserva: o dinheiro de hoje (contas e caixinhas) contra o gasto de um mês normal.
        var contas = await _context.Contas.AsNoTracking().Where(c => c.UsuarioIdProprietario == usuarioId).Select(c => c.Id).ToListAsync();
        var dinheiro = (await RegrasFinanceiras.SaldosDasContasAsync(_context, contas, usuarioId)).Values.Sum(s => s.Saldo);
        decimal? mesesDeReserva = gastoNormal is > 0 && dinheiro > 0 ? Math.Round(dinheiro / gastoNormal.Value, 1) : null;

        var mesAMes = serie.Select(m => new MesDoCheckUpDto(m.Ano, m.Mes, m.Entrou, Gasto(m.Gastos), m.Entrou - Gasto(m.Gastos))).ToList();
        decimal? pctQueSobrou = entrou > 0 ? Math.Round(sobrou * 100m / entrou, 0) : null;

        return new CheckUpDto(ano, mes, mesAtual, entrou, saiu, sobrou, pctQueSobrou, contasFixas, parcelas, comprometido,
            praOndeFoi, mesAMes, dinheiro, gastoNormal, mesesDeReserva,
            Responder(mes, mesAtual, entrou, saiu, sobrou, pctQueSobrou, comprometido, mesesDeReserva, rendaEsperadaDoMes, praOndeFoi));
    }

    /// <summary>O check-up em uma frase (fato, sem julgamento) e o que dá pra fazer.</summary>
    public static RespostaDto Responder(int mes, bool mesAtual, decimal entrou, decimal saiu, decimal sobrou, decimal? pctQueSobrou,
        decimal? comprometido, decimal? mesesDeReserva, decimal rendaEsperada, List<CategoriaDoCheckUpDto> praOndeFoi)
    {
        var nome = MesesPt.Nome(mes);
        if (entrou == 0 && saiu == 0)
            return new RespostaDto("neutro", $"Nada lançado em {nome} ainda.", [new AcaoDto("Lançar", "/transacoes/nova")]);

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
        // Sem conta fixa nem parcela, "levam 0% da renda" não diz nada: a frase sai.
        if (comprometido is { } c && c > 0)
            frases.Add($"As contas fixas e as parcelas levam {c}% da renda.");
        if (mesesDeReserva is { } r)
            frases.Add($"O dinheiro de hoje cobre {Numero(r)} {(r == 1m ? "mês" : "meses")} do seu gasto normal.");

        var acoes = new List<AcaoDto>();
        // A categoria que mais passou do normal (pelo menos 30% e R$ 50 a mais): o que a pessoa mais quer saber.
        var acima = praOndeFoi
            .Where(x => x.CategoriaId is not null && x.VariacaoPercentual >= 30 && x.Normal is { } n && x.Valor - n >= 50m)
            .OrderByDescending(x => x.Valor - x.Normal!.Value)
            .FirstOrDefault();
        if (acima is not null)
        {
            frases.Add($"{acima.Nome} veio {acima.VariacaoPercentual}% acima do normal.");
            acoes.Add(new AcaoDto("Ver o planejado", "/orcamento"));
        }
        if (rendaEsperada <= 0)
            acoes.Add(new AcaoDto("Dizer a renda", "/orcamento"));
        return new RespostaDto(tom, string.Join(" ", frases), acoes);
    }

    /// <summary>"2,5" / "3" (vírgula, sem depender da cultura da máquina).</summary>
    private static string Numero(decimal v) => v.ToString("0.#", CultureInfo.InvariantCulture).Replace('.', ',');
}

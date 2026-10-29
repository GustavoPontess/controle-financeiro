using ControleFinanceiro.Api.DTOs.DinheiroDoMes;
using ControleFinanceiro.Api.DTOs.Meta;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>Um trecho seguido de meses com a mesma folga (o que sobra por mês pra guardar).</summary>
public sealed record Degrau(DateTime De, DateTime Ate, decimal Folga);

/// <summary>
/// "Essa meta cabe?" (docs/features/respostas/visao.md), na hora de criar ou editar: compara quanto a meta pede por
/// mês com o que de fato sobra no mês da pessoa, a renda esperada (Renda; sem ela, a média do que caiu) menos o gasto
/// típico (média dos 3 meses antes que tiveram gasto, pela regra única) menos o que as outras metas já pedem. Avisa,
/// não proíbe: a pessoa cria do jeito que quiser. E "as metas juntas cabem?" na lista de Metas
/// (<see cref="DasMetasAsync"/>), com a mesma base.
/// </summary>
public class ViabilidadeMetaService
{
    private readonly AppDbContext _context;
    private readonly RendaService _renda;
    private readonly MetaService _metas;

    public ViabilidadeMetaService(AppDbContext context, RendaService renda, MetaService metas)
    {
        _context = context;
        _renda = renda;
        _metas = metas;
    }

    /// <param name="metaId">Editando: a própria meta não conta nas "outras" e o que ela já tem guardado sai do que falta.</param>
    public async Task<ViabilidadeMetaDto> CalcularAsync(Guid usuarioId, decimal valorAlvo, DateTime? dataLimite, Guid? metaId, DateTime? agora = null)
    {
        if (valorAlvo <= 0 || valorAlvo > 999_999_999.99m)
            throw new ArgumentException("Diga quanto quer juntar.");
        var hoje = agora ?? HorarioBrasil.Agora();
        var inicioMes = new DateTime(hoje.Year, hoje.Month, 1);
        var (rendaEsperada, gastoTipico) = await RendaEGastoNormalAsync(usuarioId, hoje);

        var metas = await _metas.ListarAsync(usuarioId, soPessoais: true, agora: hoje);
        var outras = metas.Where(m => m.Id != metaId && !m.Concluida).Sum(m => m.PorMes ?? 0m);
        var guardado = metaId is { } id ? metas.FirstOrDefault(m => m.Id == id)?.Guardado ?? 0m : 0m;
        var falta = Math.Max(0m, valorAlvo - guardado);

        var meses = dataLimite is null ? (int?)null : Math.Max(1, MetaService.MesesAte(dataLimite, hoje)!.Value);
        decimal? porMes = meses is { } n ? Math.Ceiling(falta / n * 100m) / 100m : null;
        // Parcelas já compradas: a média por mês no período da meta (até o prazo; sem prazo, os próximos 12 meses).
        var parcelasPorMes = await ParcelasPorMesAsync(usuarioId, inicioMes, meses ?? 12);
        decimal? folga = rendaEsperada is { } r && gastoTipico is { } g ? r - g - parcelasPorMes - outras : null;
        // Guardando a folga todo mês, em quantos meses chega (contando este). Mais de 50 anos não vira data.
        int? mesesPraChegar = folga is > 0 && falta > 0 ? (int)Math.Min(int.MaxValue, Math.Ceiling(falta / folga.Value)) : null;
        var longeDemais = mesesPraChegar > MaxMesesPraChegar;
        DateTime? prazoQueCabe = mesesPraChegar is { } mp && !longeDemais && (porMes is null || porMes > folga)
            ? new DateTime(hoje.Year, hoje.Month, 1).AddMonths(mp - 1)
            : null;

        var degraus = rendaEsperada is { } rd && gastoTipico is { } gt
            ? await DegrausAsync(usuarioId, inicioMes, meses ?? 12, rd - gt - outras) : [];
        return new ViabilidadeMetaDto(porMes, meses, folga, rendaEsperada, gastoTipico, outras, parcelasPorMes, prazoQueCabe,
            Responder(porMes, meses, folga, rendaEsperada, gastoTipico, outras, prazoQueCabe, longeDemais, dataLimite, parcelasPorMes, degraus));
    }

    /// <summary>
    /// A base das duas perguntas: a renda esperada (Renda; sem ela, a média do que caiu) e o gasto normal (média dos
    /// 3 meses antes que tiveram gasto, SEM as parcelas: essas entram à parte, pelo que já está comprado).
    /// </summary>
    private async Task<(decimal? Renda, decimal? GastoNormal)> RendaEGastoNormalAsync(Guid usuarioId, DateTime hoje)
    {
        var renda = await _renda.ObterMesAsync(usuarioId, hoje.Year, hoje.Month);
        decimal? rendaEsperada = renda.Previsto > 0 ? renda.Previsto : renda.SugestaoMedia3Meses;

        var inicioMes = new DateTime(hoje.Year, hoje.Month, 1);
        var parcelasPassadas = await RegrasFinanceiras.ParcelasPorMesAsync(_context, usuarioId, inicioMes.AddMonths(-3), 3, soPendentes: false);
        var meses3 = new List<decimal>();
        for (var i = 1; i <= 3; i++)
        {
            var m = inicioMes.AddMonths(-i);
            var gasto = (await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(_context, usuarioId, m.Year, m.Month)).Values.Sum(g => g.Gasto);
            var parcelas = parcelasPassadas.Where(p => p.Ano == m.Year && p.Mes == m.Month).Sum(p => p.Valor);
            if (gasto > 0) meses3.Add(gasto - parcelas);
        }
        return (rendaEsperada, meses3.Count > 0 ? Math.Round(meses3.Average(), 2) : null);
    }

    /// <summary>
    /// A folga MÊS A MÊS no horizonte (antes de tirar as parcelas: <paramref name="semParcelas"/>), juntando os meses
    /// seguidos que sobram o mesmo. A folga da resposta é a média do prazo, que acerta o total mas promete demais
    /// quando uma parcela acaba no meio (geladeira até dezembro, meta até junho: a média diz R$ 900 e até dezembro só
    /// cabem R$ 700; achado do Gustavo, 2026-10-28). Com dois degraus ou mais, a frase fala de cada um.
    /// </summary>
    private async Task<List<Degrau>> DegrausAsync(Guid usuarioId, DateTime inicioMes, int horizonte, decimal semParcelas)
    {
        var parcelas = (await RegrasFinanceiras.ParcelasPorMesAsync(_context, usuarioId, inicioMes, horizonte, soPendentes: false))
            .GroupBy(p => new DateTime(p.Ano, p.Mes, 1)).ToDictionary(g => g.Key, g => g.Sum(p => p.Valor));
        return Degraus(Enumerable.Range(0, horizonte).Select(i => inicioMes.AddMonths(i))
            .Select(m => (m, semParcelas - parcelas.GetValueOrDefault(m))));
    }

    /// <summary>Junta os meses seguidos com a mesma folga em degraus (de, até, folga).</summary>
    public static List<Degrau> Degraus(IEnumerable<(DateTime Mes, decimal Folga)> meses)
    {
        var degraus = new List<Degrau>();
        foreach (var (mes, folga) in meses)
            if (degraus.Count > 0 && degraus[^1].Folga == folga) degraus[^1] = degraus[^1] with { Ate = mes };
            else degraus.Add(new Degrau(mes, mes, folga));
        return degraus;
    }

    /// <summary>
    /// "sobram R$ 700,00 por mês até dezembro de 2026 e R$ 1.000,00 de janeiro de 2027 em diante" (null com um
    /// degrau só: a folga é a mesma todo mês e a frase de sempre já diz).
    /// </summary>
    public static string? DegrausTexto(List<Degrau>? degraus)
    {
        if (degraus is not { Count: > 1 }) return null;
        static string Quanto(decimal f) => f > 0 ? Uns(f) : Reais.Formatar(0m);
        var partes = degraus.Select((d, i) =>
            i == 0 ? $"{Quanto(d.Folga)} por mês até {MesAno(d.Ate)}"
            : i == degraus.Count - 1 ? $"{Quanto(d.Folga)} de {MesAno(d.De)} em diante"
            : $"{Quanto(d.Folga)} de {MesAno(d.De)} a {MesAno(d.Ate)}").ToList();
        var lista = partes.Count == 2 ? $"{partes[0]} e {partes[1]}" : string.Join(", ", partes[..^1]) + " e " + partes[^1];
        return "sobram " + lista;
    }

    /// <summary>Parcelas já compradas: a média por mês nos próximos <paramref name="horizonte"/> meses (contando este).</summary>
    private async Task<decimal> ParcelasPorMesAsync(Guid usuarioId, DateTime inicioMes, int horizonte) =>
        Math.Round((await RegrasFinanceiras.ParcelasPorMesAsync(_context, usuarioId, inicioMes, horizonte, soPendentes: false))
            .Sum(p => p.Valor) / horizonte, 2);

    /// <summary>
    /// "As metas juntas cabem?" (lista de Metas): o que as metas em andamento pedem por mês, somado, contra a folga do
    /// mês (renda esperada − gasto normal − parcelas já compradas, média dos próximos 12 meses). Não cabendo, sugere
    /// esticar o prazo da que mais pede até o mês que faz caber. Sem meta pedindo nada por mês, não há o que dizer.
    /// </summary>
    public async Task<ViabilidadeDasMetasDto> DasMetasAsync(Guid usuarioId, DateTime? agora = null)
    {
        var hoje = agora ?? HorarioBrasil.Agora();
        var metas = (await _metas.ListarAsync(usuarioId, soPessoais: true, agora: hoje))
            .Where(m => !m.Concluida && m.PorMes > 0).ToList();
        var pedem = metas.Sum(m => m.PorMes!.Value);
        if (metas.Count == 0)
            return new ViabilidadeDasMetasDto(0m, null, null);

        var inicioMes = new DateTime(hoje.Year, hoje.Month, 1);
        var (renda, gasto) = await RendaEGastoNormalAsync(usuarioId, hoje);
        var parcelas = await ParcelasPorMesAsync(usuarioId, inicioMes, 12);
        decimal? folga = renda is { } r && gasto is { } g ? r - g - parcelas : null;
        var degraus = renda is { } rd && gasto is { } gd ? await DegrausAsync(usuarioId, inicioMes, 12, rd - gd) : [];
        return new ViabilidadeDasMetasDto(pedem, folga, ResponderDasMetas(metas, pedem, folga, renda, gasto, parcelas, inicioMes, degraus));
    }

    public static RespostaDto ResponderDasMetas(List<MetaDto> metas, decimal pedem, decimal? folga, decimal? renda,
        decimal? gastoTipico, decimal parcelas, DateTime inicioMes, List<Degrau>? degraus = null)
    {
        var pedemTxt = $"As metas pedem {Reais.Formatar(pedem)} por mês";
        var emDegraus = DegrausTexto(degraus);
        if (renda is null)
            return new RespostaDto("neutro", $"{pedemTxt}. Diga quanto você espera receber pra saber se cabem.",
                [new AcaoDto("Dizer a renda", "/orcamento")]);
        if (gastoTipico is not { } g)
            return new RespostaDto("neutro", $"{pedemTxt}. Pra saber se cabem, lance os gastos de pelo menos um mês.", []);
        if (folga is not > 0)
            return g >= renda
                ? new RespostaDto("negativo", $"{pedemTxt}, e hoje não sobra nada: o seu gasto normal ({Reais.Formatar(g)} por mês) já " +
                    $"{(g > renda ? "passa da" : "leva toda a")} renda ({Reais.Formatar(renda.Value)}).", [new AcaoDto("Ver o orçamento", "/orcamento")])
                : new RespostaDto("negativo", $"{pedemTxt}, e hoje não sobra nada: depois do gasto normal sobram {Uns(renda.Value - g)}, " +
                    $"e as parcelas já compradas levam {Reais.Formatar(parcelas)} por mês.", [new AcaoDto("Ver os cartões", "/cartoes")]);
        if (pedem <= folga && emDegraus is not null)
            return pedem <= degraus!.Min(d => d.Folga)
                ? new RespostaDto("positivo", $"{pedemTxt} e cabem: depois dos gastos e das parcelas {emDegraus}.", [])
                : new RespostaDto("neutro", $"{pedemTxt}: não cabem todo mês, mas no ano dá: {emDegraus}. Guarde o que sobrar em cada mês.", []);
        if (pedem <= folga)
            return new RespostaDto("positivo",
                $"{pedemTxt} e cabem: depois dos gastos{(parcelas > 0 ? " e das parcelas" : "")} sobram {Uns(folga.Value)}, " +
                $"e ainda ficam {Uns(folga.Value - pedem)} livres.", []);

        // Não cabe: a que mais pede vai até o mês em que o que sobra pra ela (a folga menos as outras) dá conta.
        var maior = metas.MaxBy(m => m.PorMes!.Value)!;
        var praEla = folga.Value - (pedem - maior.PorMes!.Value);
        var meses = praEla > 0 ? Math.Ceiling(maior.Falta / praEla) : decimal.MaxValue;
        var sugestao = meses <= MaxMesesPraChegar
            ? ($" Pra caber, estique o prazo de {maior.Nome} pra {MesAno(inicioMes.AddMonths((int)meses - 1))}.",
               new List<AcaoDto> { new($"Ajustar {maior.Nome}", $"/metas/{maior.Id}/editar") })
            : (" Pra caber, estique os prazos ou guarde menos em alguma delas.", new List<AcaoDto>());
        return new RespostaDto("alerta", $"{pedemTxt}, mas {emDegraus ?? $"sobram {Uns(folga.Value)}"}." + sugestao.Item1, sugestao.Item2);
    }

    /// <summary>50 anos: daí pra frente a resposta não vira data.</summary>
    public const int MaxMesesPraChegar = 600;

    private static string MesAno(DateTime d) => $"{MesesPt.Nome(d.Month)} de {d.Year}";
    /// <summary>
    /// A folga escrita com o valor exato. Antes arredondava pra dezena com "uns R$ 1.230,00"; texto de dinheiro vago não
    /// passa confiança (Gustavo, 2026-10-29). O nome ficou pra não mexer em todas as frases.
    /// </summary>
    private static string Uns(decimal v) => Reais.Formatar(v);

    public static RespostaDto Responder(decimal? porMes, int? meses, decimal? folga, decimal? renda, decimal? gastoTipico, decimal outras,
        DateTime? prazoQueCabe, bool longeDemais, DateTime? prazo, decimal parcelas = 0m, List<Degrau>? degraus = null)
    {
        var emDegraus = DegrausTexto(degraus);
        var temGasto = gastoTipico is not null;
        var pede = porMes is { } p ? $"Precisa guardar {Reais.Formatar(p)} por mês" : null;
        var chega = folga is not { } f0 || f0 <= 0 ? null
            : longeDemais ? $"Guardando o que sobra ({Uns(f0)} por mês), levaria mais de 50 anos."
            : prazoQueCabe is { } c ? $"Guardando o que sobra ({Uns(f0)} por mês), chega lá em {MesAno(c)}." : null;

        if (renda is null)
            return new RespostaDto("neutro", (pede is null ? "" : pede + ". ") + "Diga quanto você espera receber pra saber se cabe.",
                [new AcaoDto("Dizer a renda", "/orcamento")]);
        if (porMes > renda)
            return new RespostaDto("negativo", $"{pede}, mais do que você recebe ({Reais.Formatar(renda.Value)})." + (chega is null ? "" : " " + chega), []);
        if (!temGasto)
            return new RespostaDto("neutro", pede is null
                ? "Lance os gastos de um mês pra saber em quanto tempo dá."
                : pede + ". Pra saber se cabe, lance os gastos de pelo menos um mês.", []);
        if (folga is not > 0)
        {
            // O que está apertando: o gasto normal sozinho, as parcelas já compradas em cima dele, ou as outras metas.
            var g = gastoTipico!.Value;
            var (porque, acao) = g >= renda
                ? ($"o seu gasto normal ({Reais.Formatar(g)} por mês) já {(g > renda ? "passa da" : "leva toda a")} renda ({Reais.Formatar(renda.Value)}).",
                   new AcaoDto("Ver o orçamento", "/orcamento"))
                : g + parcelas >= renda
                ? ($"depois do gasto normal sobram {Uns(renda.Value - g)}, e as parcelas já compradas levam {Reais.Formatar(parcelas)} por mês.",
                   new AcaoDto("Ver os cartões", "/cartoes"))
                : ($"depois do gasto normal{(parcelas > 0 ? " e das parcelas" : "")} sobram {Uns(renda.Value - g - parcelas)}, e as outras metas já pedem {Reais.Formatar(outras)} por mês.",
                   new AcaoDto("Ver as metas", "/metas"));
            return new RespostaDto("negativo", (pede is null ? "Hoje" : pede + ", e hoje") + " não sobra nada: " + porque, [acao]);
        }
        if (porMes is null)
            return new RespostaDto("positivo", chega ?? "Guardando o que sobra, chega lá logo.", []);
        if (porMes <= folga && emDegraus is not null)
            // Cabe no total, mas o que sobra muda no caminho: se não cabe em algum mês, guardar o que sobra em cada um.
            return porMes <= degraus!.Min(d => d.Folga)
                ? new RespostaDto("positivo", $"{pede}. Cabe: {emDegraus}, depois dos gastos, das parcelas e das outras metas.", [])
                : new RespostaDto("neutro", $"{pede}. Não cabe todo mês, mas no total dá: {emDegraus}. Guardando o que sobra em cada mês, " +
                    $"chega lá até {MesAno(prazo!.Value)}.", []);
        if (porMes <= folga)
            return new RespostaDto("positivo",
                $"{pede}. Cabe: sobram {Uns(folga.Value)} por mês depois dos gastos{(parcelas > 0 ? ", das parcelas" : "")} e das outras metas.", []);
        return new RespostaDto("alerta",
            $"{pede}, mas {emDegraus ?? $"sobram {Uns(folga.Value)}"}. Até {MesAno(prazo!.Value)} você junta {Uns(folga.Value * meses!.Value)}." +
            (longeDemais ? " Nesse ritmo levaria mais de 50 anos." : prazoQueCabe is { } q ? $" Nesse ritmo chega lá em {MesAno(q)}." : ""), []);
    }
}

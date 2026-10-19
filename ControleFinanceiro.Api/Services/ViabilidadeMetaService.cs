using ControleFinanceiro.Api.DTOs.DinheiroDoMes;
using ControleFinanceiro.Api.DTOs.Meta;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// "Essa meta cabe?" (docs/features/respostas/visao.md), na hora de criar ou editar: compara quanto a meta pede por
/// mês com o que de fato sobra no mês da pessoa, a renda esperada (Renda; sem ela, a média do que caiu) menos o gasto
/// típico (média dos 3 meses antes que tiveram gasto, pela regra única) menos o que as outras metas já pedem. Avisa,
/// não proíbe: a pessoa cria do jeito que quiser.
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
        var hoje = agora ?? DateTime.UtcNow;

        var renda = await _renda.ObterMesAsync(usuarioId, hoje.Year, hoje.Month);
        decimal? rendaEsperada = renda.Previsto > 0 ? renda.Previsto : renda.SugestaoMedia3Meses;

        var meses3 = new List<decimal>();
        for (var i = 1; i <= 3; i++)
        {
            var m = new DateTime(hoje.Year, hoje.Month, 1).AddMonths(-i);
            var gasto = (await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(_context, usuarioId, m.Year, m.Month)).Values.Sum(g => g.Gasto);
            if (gasto > 0) meses3.Add(gasto);
        }
        decimal? gastoTipico = meses3.Count > 0 ? Math.Round(meses3.Average(), 2) : null;

        var metas = await _metas.ListarAsync(usuarioId, soPessoais: true, agora: hoje);
        var outras = metas.Where(m => m.Id != metaId && !m.Concluida).Sum(m => m.PorMes ?? 0m);
        var guardado = metaId is { } id ? metas.FirstOrDefault(m => m.Id == id)?.Guardado ?? 0m : 0m;
        var falta = Math.Max(0m, valorAlvo - guardado);

        var meses = dataLimite is null ? (int?)null : Math.Max(1, MetaService.MesesAte(dataLimite, hoje)!.Value);
        decimal? porMes = meses is { } n ? Math.Ceiling(falta / n * 100m) / 100m : null;
        decimal? folga = rendaEsperada is { } r && gastoTipico is { } g ? r - g - outras : null;
        // Guardando a folga todo mês, em quantos meses chega (contando este). Mais de 50 anos não vira data.
        int? mesesPraChegar = folga is > 0 && falta > 0 ? (int)Math.Min(int.MaxValue, Math.Ceiling(falta / folga.Value)) : null;
        var longeDemais = mesesPraChegar > MaxMesesPraChegar;
        DateTime? prazoQueCabe = mesesPraChegar is { } mp && !longeDemais && (porMes is null || porMes > folga)
            ? new DateTime(hoje.Year, hoje.Month, 1).AddMonths(mp - 1)
            : null;

        return new ViabilidadeMetaDto(porMes, meses, folga, rendaEsperada, gastoTipico, outras, prazoQueCabe,
            Responder(porMes, meses, folga, rendaEsperada, gastoTipico, outras, prazoQueCabe, longeDemais, dataLimite));
    }

    /// <summary>50 anos: daí pra frente a resposta não vira data.</summary>
    public const int MaxMesesPraChegar = 600;

    private static string MesAno(DateTime d) => $"{MesesPt.Nome(d.Month)} de {d.Year}";
    /// <summary>A folga é estimativa: arredonda pra dezena ("uns R$ 1.230,00").</summary>
    private static string Uns(decimal v) => $"uns {Reais.Formatar(Math.Floor(v / 10m) * 10m)}";

    public static RespostaDto Responder(decimal? porMes, int? meses, decimal? folga, decimal? renda, decimal? gastoTipico, decimal outras,
        DateTime? prazoQueCabe, bool longeDemais, DateTime? prazo)
    {
        var temGasto = gastoTipico is not null;
        var pede = porMes is { } p ? $"Precisa guardar {Reais.Formatar(p)} por mês" : null;
        var chega = folga is not { } f0 || f0 <= 0 ? null
            : longeDemais ? $"Guardando o que sobra ({Uns(f0)} por mês), levaria mais de 50 anos."
            : prazoQueCabe is { } c ? $"Guardando o que sobra ({Uns(f0)} por mês), chega lá em {MesAno(c)}." : null;

        if (renda is null)
            return new RespostaDto("neutro", (pede is null ? "" : pede + ". ") + "Diga quanto você espera receber pra saber se cabe.",
                [new AcaoDto("Dizer a renda", "/renda")]);
        if (porMes > renda)
            return new RespostaDto("negativo", $"{pede}, mais do que você recebe ({Reais.Formatar(renda.Value)})." + (chega is null ? "" : " " + chega), []);
        if (!temGasto)
            return new RespostaDto("neutro", pede is null
                ? "Lance os gastos de um mês pra saber em quanto tempo dá."
                : pede + ". Pra saber se cabe, lance os gastos de pelo menos um mês.", []);
        if (folga is not > 0)
        {
            // O que está apertando: o gasto normal sozinho, ou as outras metas em cima do que sobra dele.
            var porque = gastoTipico >= renda
                ? $"o seu gasto normal ({Reais.Formatar(gastoTipico!.Value)} por mês) já {(gastoTipico > renda ? "passa da" : "leva toda a")} renda ({Reais.Formatar(renda.Value)})."
                : $"depois do gasto normal sobram {Uns(renda.Value - gastoTipico!.Value)}, e as outras metas já pedem {Reais.Formatar(outras)} por mês.";
            return new RespostaDto("negativo", (pede is null ? "Hoje" : pede + ", e hoje") + " não sobra nada: " + porque,
                [new AcaoDto(gastoTipico >= renda ? "Ver os limites" : "Ver as metas", gastoTipico >= renda ? "/limites" : "/metas")]);
        }
        if (porMes is null)
            return new RespostaDto("positivo", chega ?? "Guardando o que sobra, chega lá logo.", []);
        if (porMes <= folga)
            return new RespostaDto("positivo", $"{pede}. Cabe: sobram {Uns(folga.Value)} por mês depois dos gastos e das outras metas.", []);
        return new RespostaDto("alerta",
            $"{pede}, mas sobram {Uns(folga.Value)}. Até {MesAno(prazo!.Value)} você junta {Uns(folga.Value * meses!.Value)}." +
            (longeDemais ? " Nesse ritmo levaria mais de 50 anos." : prazoQueCabe is { } q ? $" Nesse ritmo chega lá em {MesAno(q)}." : ""), []);
    }
}

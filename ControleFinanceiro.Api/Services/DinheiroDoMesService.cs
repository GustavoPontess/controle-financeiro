using ControleFinanceiro.Api.DTOs.DinheiroDoMes;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// O dinheiro do mês da pessoa, num lugar só (docs/features/respostas/visao.md): quanto entra (a renda da
/// <see cref="RendaService"/>), quanto já saiu (<see cref="RegrasFinanceiras.GastosPorCategoriaDoMesAsync"/>), o que
/// ainda vem (<see cref="RegrasFinanceiras.PrevistosDoMesAsync"/>) e a resposta em uma frase. As telas (Início, Renda,
/// Relatórios) mostram isto; nenhuma faz a conta sozinha.
/// </summary>
public class DinheiroDoMesService
{
    /// <summary>Pedaços com nome na barra; o resto vira "Outras".</summary>
    public const int MaxPartes = 5;
    /// <summary>Até quantos meses pra frente olhar as parcelas já compradas (5 anos).</summary>
    public const int MesesDeParcelas = 60;
    /// <summary>Abaixo disto do que entra, "sobra pouco".</summary>
    private const decimal FolgaApertada = 0.10m;

    private readonly AppDbContext _context;
    private readonly RendaService _renda;

    public DinheiroDoMesService(AppDbContext context, RendaService renda)
    {
        _context = context;
        _renda = renda;
    }

    public async Task<DinheiroDoMesDto> CalcularAsync(Guid usuarioId, int ano, int mes)
    {
        var renda = await _renda.ObterMesAsync(usuarioId, ano, mes);
        var gastos = await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(_context, usuarioId, ano, mes);
        var previstos = await RegrasFinanceiras.PrevistosDoMesAsync(_context, usuarioId, ano, mes);
        var faturas = (await RegrasFinanceiras.FaturasAPagarNoMesAsync(_context, usuarioId, ano, mes))
            .Select(f => new FaturaDoMesDto(f.FaturaId, f.CartaoId, f.Cartao, f.DataInicio, f.DataFechamento, f.DataVencimento,
                f.Total, f.Pago, f.Restante, f.Atrasada))
            .ToList();

        var ids = gastos.Keys.Concat(previstos.Where(p => p.CategoriaId.HasValue).Select(p => p.CategoriaId!.Value)).Distinct().ToList();
        var nomes = await _context.Categorias.AsNoTracking().Where(c => ids.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Descricao);
        string Nome(Guid? id) => id is null || id == RegrasFinanceiras.SemCategoria ? "Sem categoria" : nomes.GetValueOrDefault(id.Value, "Categoria");

        var baseRenda = Math.Max(renda.Previsto, renda.Recebido);
        decimal Pct(decimal v) => baseRenda > 0 ? Math.Round(v * 100m / baseRenda, 1) : 0m;

        var porCategoria = gastos.Where(kv => kv.Value.Gasto > 0)
            .Select(kv => (Id: kv.Key == RegrasFinanceiras.SemCategoria ? (Guid?)null : kv.Key, Valor: kv.Value.Gasto))
            .OrderByDescending(x => x.Valor).ToList();
        var partes = porCategoria.Take(MaxPartes).Select(x => new ParteDoMesDto(x.Id, Nome(x.Id), x.Valor, Pct(x.Valor))).ToList();
        var outras = porCategoria.Skip(MaxPartes).Sum(x => x.Valor);
        if (outras > 0)
            partes.Add(new ParteDoMesDto(null, "Outras", outras, Pct(outras)));

        var aindaVem = previstos.Select(p => new AindaVemDto(p.TransacaoId, p.ContaFixaId, p.Descricao, p.Data, p.CategoriaId, Nome(p.CategoriaId), p.Valor)).ToList();
        var jaSaiu = porCategoria.Sum(x => x.Valor);
        var vem = aindaVem.Sum(a => a.Valor);
        var livre = baseRenda - jaSaiu - vem;

        return new DinheiroDoMesDto(ano, mes, renda.Previsto, renda.Recebido, baseRenda, jaSaiu, vem, livre, Pct(jaSaiu + vem),
            partes, aindaVem, Responder(baseRenda, jaSaiu, vem, livre, porCategoria.Count > 0 ? (Nome(porCategoria[0].Id), porCategoria[0].Valor, porCategoria[0].Id is null) : null),
            faturas, faturas.Sum(f => f.Restante), await ParcelasFuturasAsync(usuarioId, ano, mes));
    }

    /// <summary>As parcelas ainda não pagas dos meses DEPOIS deste (as do mês já contam no que saiu).</summary>
    private async Task<ParcelasFuturasDto> ParcelasFuturasAsync(Guid usuarioId, int ano, int mes)
    {
        var linhas = await RegrasFinanceiras.ParcelasPorMesAsync(_context, usuarioId, new DateTime(ano, mes, 1).AddMonths(1), MesesDeParcelas, soPendentes: true);
        var porMes = linhas.GroupBy(l => (l.Ano, l.Mes)).Select(g => new ParcelaFuturaDto(g.Key.Ano, g.Key.Mes, g.Sum(l => l.Valor))).ToList();
        return new ParcelasFuturasDto(porMes.Sum(p => p.Valor), porMes.LastOrDefault()?.Ano, porMes.LastOrDefault()?.Mes, porMes);
    }

    /// <summary>A pergunta do mês: "vai dar?". Uma frase com o número e o que dá pra fazer.</summary>
    public static RespostaDto Responder(decimal baseRenda, decimal jaSaiu, decimal aindaVem, decimal livre, (string Nome, decimal Valor, bool SemCategoria)? maior)
    {
        if (baseRenda <= 0)
            return new RespostaDto("neutro", "Diga quanto você espera receber por mês pra saber se o mês fecha.",
                [new AcaoDto("Dizer a renda", "/orcamento")]);

        string? Peso() => maior is { } m ? $" O maior peso é {m.Nome} ({Reais.Formatar(m.Valor)})." : null;
        List<AcaoDto> AcoesDoPeso() => maior is { SemCategoria: true }
            ? [new AcaoDto("Classificar lançamentos", "/transacoes")]
            : [new AcaoDto("Ver o orçamento", "/orcamento")];

        if (jaSaiu > baseRenda)
        {
            var texto = $"Saiu mais do que entrou: {Reais.Formatar(jaSaiu - baseRenda)} acima da renda.{Peso()}";
            if (aindaVem > 0) texto += $" E ainda vem {Reais.Formatar(aindaVem)} de contas este mês.";
            return new RespostaDto("negativo", texto, AcoesDoPeso());
        }
        if (livre < 0)
            return new RespostaDto("alerta",
                $"Com o que ainda vem ({Reais.Formatar(aindaVem)} em contas), o mês passa {Reais.Formatar(-livre)} da renda.",
                [new AcaoDto("Ver contas fixas", "/contas-fixas")]);
        if (livre < baseRenda * FolgaApertada)
            return new RespostaDto("alerta",
                $"Sobra pouco: {Reais.Formatar(livre)} até o fim do mês, contando o que ainda entra e sai.", AcoesDoPeso());
        return new RespostaDto("positivo",
            aindaVem > 0
                ? $"Fecha o mês com {Reais.Formatar(livre)} sobrando, contando o que ainda entra e sai."
                : $"Fecha o mês com {Reais.Formatar(livre)} sobrando.",
            []);
    }
}

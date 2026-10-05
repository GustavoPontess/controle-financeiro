using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Datas de cobrança de conta fixa — regra ÚNICA, usada em todo lugar que gera ocorrência (criar,
/// expansão diária, lançar o que passou, retomar depois de pausar, realinhar). Antes cada lugar somava
/// "data de início + 1 mês" e o <c>Dia</c> escolhido era ignorado: Aluguel "dia 5" criado em 28/09
/// cobrava 28/10, 28/11…
/// <para>Compasso: <b>mensal</b> = todo mês no <c>Dia</c>; <b>anual</b> = todo ano no <c>Dia</c> do mês
/// de início; <b>semanal</b> = a cada 7 dias a partir do início (o <c>Dia</c> não se aplica). Mês curto:
/// dia 31 em fevereiro cai no último dia (28/29) — e o mês seguinte VOLTA pro 31 (recalcula do
/// <c>Dia</c>, não arrasta o 28).</para>
/// </summary>
public static class AgendaRecorrente
{
    /// <summary>Primeira cobrança em <paramref name="aPartirDe"/> ou depois (nunca antes do início).</summary>
    public static DateOnly ProximaEmOuDepois(DateOnly aPartirDe, DateOnly inicio, int dia, FrequenciaRecorrencia freq)
    {
        dia = DiaEfetivo(dia, inicio);
        var desde = aPartirDe < inicio ? inicio : aPartirDe;
        switch (freq)
        {
            case FrequenciaRecorrencia.Semanal:
                var resto = (desde.DayNumber - inicio.DayNumber) % 7;
                return resto == 0 ? desde : desde.AddDays(7 - resto);
            case FrequenciaRecorrencia.Anual:
                var noAno = NoDia(desde.Year, inicio.Month, dia);
                return noAno >= desde ? noAno : NoDia(desde.Year + 1, inicio.Month, dia);
            default: // Mensal
                var noMes = NoDia(desde.Year, desde.Month, dia);
                if (noMes >= desde) return noMes;
                var seguinte = desde.AddMonths(1);
                return NoDia(seguinte.Year, seguinte.Month, dia);
        }
    }

    /// <summary>Cobrança seguinte a <paramref name="atual"/> (que já é uma data do compasso).</summary>
    public static DateOnly Seguinte(DateOnly atual, DateOnly inicio, int dia, FrequenciaRecorrencia freq)
    {
        dia = DiaEfetivo(dia, inicio);
        switch (freq)
        {
            case FrequenciaRecorrencia.Semanal:
                return atual.AddDays(7);
            case FrequenciaRecorrencia.Anual:
                return NoDia(atual.Year + 1, inicio.Month, dia);
            default: // Mensal
                var mes = atual.AddMonths(1);
                return NoDia(mes.Year, mes.Month, dia);
        }
    }

    /// <summary>
    /// Período (competência) que uma cobrança na <paramref name="data"/> cobre: <b>mensal</b> <c>M2026-10</c>,
    /// <b>anual</b> <c>A2026</c>, <b>semanal</b> <c>S{n}</c> (n-ésimo bloco de 7 dias desde o início). Uma conta
    /// fixa cobra no máximo uma vez por período — é isso que o gerador confere, não a data exata (com a data,
    /// trocar o Dia de 5 pra 20 com o dia 5 já cobrado cobrava o mês de novo no dia 20).
    /// <para>A migration <c>AddCompetenciaTransacao</c> preenche as antigas com a MESMA conta em SQL — mudar
    /// o formato aqui exige mudar lá.</para>
    /// </summary>
    public static string Competencia(DateOnly data, DateOnly inicio, FrequenciaRecorrencia freq) => freq switch
    {
        FrequenciaRecorrencia.Semanal => $"S{(data.DayNumber - inicio.DayNumber) / 7}",
        FrequenciaRecorrencia.Anual => $"A{data.Year:D4}",
        _ => $"M{data.Year:D4}-{data.Month:D2}",
    };

    /// <summary>
    /// Primeiro dia do período de <paramref name="hoje"/> (mês, ano, ou bloco de 7 dias desde o início). Alterar
    /// e realinhar recomeçam DAQUI, não de hoje: Dia 20→5 no dia 10 sem o mês cobrado gera o dia 5 deste mês
    /// (de hoje, o mês sumia — próxima seria só o mês que vem).
    /// </summary>
    public static DateOnly InicioDoPeriodo(DateOnly hoje, DateOnly inicio, FrequenciaRecorrencia freq) => freq switch
    {
        FrequenciaRecorrencia.Semanal when hoje >= inicio => inicio.AddDays((hoje.DayNumber - inicio.DayNumber) / 7 * 7),
        FrequenciaRecorrencia.Semanal => hoje,
        FrequenciaRecorrencia.Anual => new DateOnly(hoje.Year, 1, 1),
        _ => new DateOnly(hoje.Year, hoje.Month, 1),
    };

    /// <summary>A data cai no compasso da conta fixa (dia certo)?</summary>
    public static bool NoCompasso(DateOnly data, DateOnly inicio, int dia, FrequenciaRecorrencia freq) =>
        data >= inicio && ProximaEmOuDepois(data, inicio, dia, freq) == data;

    /// <summary>Quanto pra trás a data de início pode ir (lança como efetivado o que já passou).</summary>
    public const int MesesRetroativosMax = 12;

    /// <summary>Quanto pra frente a data de início pode ir.</summary>
    public const int AnosFuturosMax = 5;

    /// <summary>
    /// Teto de datas percorridas numa geração. Com a faixa da data de início, o pior caso real (semanal, 12
    /// meses pra trás até o fim do ano seguinte) fica em ~120; o teto segura dado antigo de antes da faixa
    /// (início no ano 1 gerava ~105 mil lançamentos numa requisição) — a próxima chamada continua de onde parou.
    /// </summary>
    public const int MaxDatasPorGeracao = 400;

    /// <summary>
    /// Valida o período da conta fixa: início entre hoje − <see cref="MesesRetroativosMax"/> meses e hoje +
    /// <see cref="AnosFuturosMax"/> anos (só ao criar — <paramref name="validarInicio"/>); fim, se houver, não
    /// antes do início. Fora disso → <see cref="ArgumentException"/> (400).
    /// </summary>
    public static void ValidarPeriodo(DateOnly inicio, DateOnly? fim, DateOnly hoje, bool validarInicio = true)
    {
        if (validarInicio && (inicio < hoje.AddMonths(-MesesRetroativosMax) || inicio > hoje.AddYears(AnosFuturosMax)))
            throw new ArgumentException(
                $"Data de início deve estar entre {MesesRetroativosMax} meses atrás e {AnosFuturosMax} anos à frente.");
        if (fim is { } f && f < inicio)
            throw new ArgumentException("Data fim não pode ser antes da data de início.");
    }

    /// <summary>Até onde a expansão gera previsões: o fim do ano corrente (exclusivo = 1º de janeiro seguinte).</summary>
    public static DateOnly HorizonteExpansao(DateOnly hoje) => new(hoje.Year + 1, 1, 1);

    // Dia no mês, respeitando mês curto.
    private static DateOnly NoDia(int ano, int mes, int dia) =>
        new(ano, mes, Math.Min(dia, DateTime.DaysInMonth(ano, mes)));

    // Dado antigo sem Dia válido (0) cai no dia do início, em vez de quebrar a data.
    private static int DiaEfetivo(int dia, DateOnly inicio) => dia is >= 1 and <= 31 ? dia : inicio.Day;
}

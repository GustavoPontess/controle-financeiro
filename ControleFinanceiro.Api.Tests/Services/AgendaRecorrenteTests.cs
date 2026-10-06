using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Services;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Regra ÚNICA de datas de cobrança da conta fixa (unitário puro, datas FIXAS — não depende do dia em que roda).
/// Bug que originou: Aluguel "dia 5" criado em 28/09 cobrava 28/10, 28/11… (o <c>Dia</c> era ignorado, tudo
/// somava "data de início + 1 mês"). Mensal = todo mês no Dia; anual = todo ano no Dia do MÊS de início;
/// semanal = a cada 7 dias a partir do início; mês curto cai no último dia e o mês seguinte VOLTA ao Dia.
/// </summary>
public class AgendaRecorrenteTests
{
    private const FrequenciaRecorrencia Mensal = FrequenciaRecorrencia.Mensal;
    private const FrequenciaRecorrencia Anual = FrequenciaRecorrencia.Anual;
    private const FrequenciaRecorrencia Semanal = FrequenciaRecorrencia.Semanal;

    private static DateOnly D(int ano, int mes, int dia) => new(ano, mes, dia);

    // Primeira data da agenda a partir do início, seguida das N seguintes.
    private static List<DateOnly> Agenda(DateOnly inicio, int dia, FrequenciaRecorrencia freq, int quantas)
    {
        var lista = new List<DateOnly> { AgendaRecorrente.ProximaEmOuDepois(inicio, inicio, dia, freq) };
        while (lista.Count < quantas)
            lista.Add(AgendaRecorrente.Seguinte(lista[^1], inicio, dia, freq));
        return lista;
    }

    // ── Mensal ────────────────────────────────────────────────────────────────

    [Fact]
    public void Mensal_Dia5_ComecandoEm28_CobraNoDia5_NaoNo28()
    {
        // O caso do bug: criado em 28/09 com Dia 5 → 05/10, 05/11, 05/12, 05/01 (e não 28/10, 28/11…).
        var agenda = Agenda(D(2026, 9, 28), 5, Mensal, 4);

        Assert.Equal(new[] { D(2026, 10, 5), D(2026, 11, 5), D(2026, 12, 5), D(2027, 1, 5) }, agenda);
    }

    [Fact]
    public void Mensal_DiaDepoisDoInicioNoMesmoMes_PrimeiraCobrancaEhNoProprioMesDoInicio()
    {
        // Início 28/09, Dia 30 → 30/09 (ainda dá tempo no mesmo mês), depois 30/10.
        var agenda = Agenda(D(2026, 9, 28), 30, Mensal, 2);

        Assert.Equal(new[] { D(2026, 9, 30), D(2026, 10, 30) }, agenda);
    }

    [Fact]
    public void Mensal_InicioNoProprioDia_ContaOInicio()
    {
        Assert.Equal(D(2026, 9, 5), AgendaRecorrente.ProximaEmOuDepois(D(2026, 9, 5), D(2026, 9, 5), 5, Mensal));
    }

    [Theory]
    [InlineData(2026, 3, 10, 2026, 3, 15)] // antes do dia → neste mês
    [InlineData(2026, 3, 15, 2026, 3, 15)] // no dia → o próprio dia
    [InlineData(2026, 3, 16, 2026, 4, 15)] // depois do dia → mês seguinte
    [InlineData(2026, 12, 20, 2027, 1, 15)] // vira o ano
    public void Mensal_ProximaEmOuDepois_RespeitaODia(int ay, int am, int ad, int ey, int em, int ed)
    {
        var proxima = AgendaRecorrente.ProximaEmOuDepois(D(ay, am, ad), D(2026, 1, 1), 15, Mensal);

        Assert.Equal(D(ey, em, ed), proxima);
    }

    // ── Mês curto: dia 29/30/31 ───────────────────────────────────────────────

    [Fact]
    public void Mensal_Dia31_FevereiroCaiNoUltimoDia_EMarcoVoltaPro31()
    {
        // Ano comum: jan 31 → fev 28 → mar 31 → abr 30 → mai 31 (o mês seguinte NÃO arrasta o 28).
        var agenda = Agenda(D(2026, 1, 31), 31, Mensal, 5);

        Assert.Equal(new[] { D(2026, 1, 31), D(2026, 2, 28), D(2026, 3, 31), D(2026, 4, 30), D(2026, 5, 31) }, agenda);
    }

    [Fact]
    public void Mensal_Dia31_AnoBissexto_FevereiroCaiNo29()
    {
        var agenda = Agenda(D(2028, 1, 31), 31, Mensal, 3);

        Assert.Equal(new[] { D(2028, 1, 31), D(2028, 2, 29), D(2028, 3, 31) }, agenda);
    }

    [Theory]
    [InlineData(29, 2026, 2, 28)] // ano comum
    [InlineData(30, 2026, 2, 28)]
    [InlineData(29, 2028, 2, 29)] // bissexto
    [InlineData(30, 2028, 2, 29)]
    public void Mensal_Dia29e30_EmFevereiro_CaemNoUltimoDiaDoMes(int dia, int ano, int mes, int esperado)
    {
        var data = AgendaRecorrente.ProximaEmOuDepois(D(ano, mes, 1), D(ano, 1, 1), dia, Mensal);

        Assert.Equal(D(ano, mes, esperado), data);
    }

    [Fact]
    public void Mensal_Dia31_AteOFimDoAno_CadaMesNoSeuUltimoDiaPossivel()
    {
        var agenda = Agenda(D(2026, 1, 31), 31, Mensal, 12);

        Assert.Equal(
            new[]
            {
                D(2026, 1, 31), D(2026, 2, 28), D(2026, 3, 31), D(2026, 4, 30), D(2026, 5, 31), D(2026, 6, 30),
                D(2026, 7, 31), D(2026, 8, 31), D(2026, 9, 30), D(2026, 10, 31), D(2026, 11, 30), D(2026, 12, 31),
            },
            agenda);
    }

    [Fact]
    public void Mensal_Seguinte_ViraOAno()
    {
        Assert.Equal(D(2027, 1, 31), AgendaRecorrente.Seguinte(D(2026, 12, 31), D(2026, 1, 31), 31, Mensal));
    }

    // ── Anual ─────────────────────────────────────────────────────────────────

    [Fact]
    public void Anual_Dia10_CobraTodoAnoNoDia10DoMesDeInicio()
    {
        // Início 20/06/2025: o dia 10/06/2025 já passou → 1ª cobrança 10/06/2026; depois 10/06/2027, 10/06/2028.
        var agenda = Agenda(D(2025, 6, 20), 10, Anual, 3);

        Assert.Equal(new[] { D(2026, 6, 10), D(2027, 6, 10), D(2028, 6, 10) }, agenda);
    }

    [Fact]
    public void Anual_DiaAindaNaoPassouNoMesDoInicio_CobraNoProprioAnoDoInicio()
    {
        var agenda = Agenda(D(2025, 6, 5), 10, Anual, 2);

        Assert.Equal(new[] { D(2025, 6, 10), D(2026, 6, 10) }, agenda);
    }

    [Theory]
    [InlineData(2026, 1, 1, 2026, 6, 10)]
    [InlineData(2026, 6, 10, 2026, 6, 10)] // no dia
    [InlineData(2026, 6, 11, 2027, 6, 10)] // depois do dia → ano seguinte
    public void Anual_ProximaEmOuDepois(int ay, int am, int ad, int ey, int em, int ed)
    {
        var proxima = AgendaRecorrente.ProximaEmOuDepois(D(ay, am, ad), D(2025, 6, 20), 10, Anual);

        Assert.Equal(D(ey, em, ed), proxima);
    }

    [Fact]
    public void Anual_29DeFevereiro_CaiNo28NosAnosComunsEVoltaNoBissexto()
    {
        var agenda = Agenda(D(2024, 2, 29), 29, Anual, 5);

        Assert.Equal(
            new[] { D(2024, 2, 29), D(2025, 2, 28), D(2026, 2, 28), D(2027, 2, 28), D(2028, 2, 29) },
            agenda);
    }

    // ── Semanal ───────────────────────────────────────────────────────────────

    [Fact]
    public void Semanal_CobraACada7DiasAPartirDoInicio_IgnorandoODia()
    {
        var inicio = D(2026, 9, 28);

        var comDia1 = Agenda(inicio, 1, Semanal, 4);
        var comDia31 = Agenda(inicio, 31, Semanal, 4);

        var esperado = new[] { D(2026, 9, 28), D(2026, 10, 5), D(2026, 10, 12), D(2026, 10, 19) };
        Assert.Equal(esperado, comDia1);
        Assert.Equal(esperado, comDia31); // o Dia não se aplica à semanal
    }

    [Theory]
    [InlineData(2026, 9, 28, 2026, 9, 28)] // no início
    [InlineData(2026, 9, 29, 2026, 10, 5)] // 1 dia depois → próxima semana
    [InlineData(2026, 10, 5, 2026, 10, 5)] // exatamente +7
    [InlineData(2026, 10, 6, 2026, 10, 12)]
    [InlineData(2026, 10, 12, 2026, 10, 12)]
    public void Semanal_ProximaEmOuDepois_FicaNoCompassoDe7Dias(int ay, int am, int ad, int ey, int em, int ed)
    {
        var proxima = AgendaRecorrente.ProximaEmOuDepois(D(ay, am, ad), D(2026, 9, 28), 0, Semanal);

        Assert.Equal(D(ey, em, ed), proxima);
    }

    [Fact]
    public void Semanal_Seguinte_Soma7Dias_AtravessandoMesEAno()
    {
        Assert.Equal(D(2027, 1, 2), AgendaRecorrente.Seguinte(D(2026, 12, 26), D(2026, 9, 28), 0, Semanal));
    }

    // ── Nunca antes do início ─────────────────────────────────────────────────

    [Theory]
    [InlineData(FrequenciaRecorrencia.Mensal)]
    [InlineData(FrequenciaRecorrencia.Anual)]
    [InlineData(FrequenciaRecorrencia.Semanal)]
    public void ProximaEmOuDepois_NuncaAntesDoInicio(FrequenciaRecorrencia freq)
    {
        var inicio = D(2026, 9, 28);

        // aPartirDe muito antes do início e dias que (se ignorassem o início) cairiam antes dele.
        foreach (var dia in new[] { 1, 5, 28, 31 })
        {
            var proxima = AgendaRecorrente.ProximaEmOuDepois(D(2020, 1, 1), inicio, dia, freq);

            Assert.True(proxima >= inicio, $"{freq} dia {dia}: {proxima} veio antes do início {inicio}");
        }
    }

    [Fact]
    public void Mensal_ProximaEmOuDepois_AntesDoInicio_ComecaNoPrimeiroDiaCertoDepoisDoInicio()
    {
        // Dia 5 com início 28/09: o 05/09 é anterior ao início → vale o 05/10.
        Assert.Equal(D(2026, 10, 5), AgendaRecorrente.ProximaEmOuDepois(D(2020, 1, 1), D(2026, 9, 28), 5, Mensal));
    }

    [Fact]
    public void Semanal_ProximaEmOuDepois_AntesDoInicio_VaiParaOInicio()
    {
        Assert.Equal(D(2026, 9, 28), AgendaRecorrente.ProximaEmOuDepois(D(2020, 1, 1), D(2026, 9, 28), 0, Semanal));
    }

    // ── NoCompasso ────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(2026, 11, 5, true)]
    [InlineData(2026, 11, 6, false)]
    [InlineData(2026, 11, 4, false)]
    [InlineData(2026, 10, 5, true)]
    [InlineData(2026, 9, 5, false)] // o dia bate, mas é ANTES do início (28/09)
    [InlineData(2026, 9, 28, false)] // o início em si não é dia 5
    public void NoCompasso_Mensal(int ano, int mes, int dia, bool esperado)
    {
        Assert.Equal(esperado, AgendaRecorrente.NoCompasso(D(ano, mes, dia), D(2026, 9, 28), 5, Mensal));
    }

    [Theory]
    [InlineData(2026, 2, 28, true)] // fevereiro cai no último dia
    [InlineData(2026, 2, 27, false)]
    [InlineData(2026, 3, 28, false)] // março volta pro 31 — o 28 NÃO é compasso
    [InlineData(2026, 3, 31, true)]
    [InlineData(2026, 4, 30, true)]
    [InlineData(2026, 4, 29, false)]
    public void NoCompasso_Mensal_Dia31_MesCurto(int ano, int mes, int dia, bool esperado)
    {
        Assert.Equal(esperado, AgendaRecorrente.NoCompasso(D(ano, mes, dia), D(2026, 1, 31), 31, Mensal));
    }

    [Theory]
    [InlineData(2026, 9, 28, true)]
    [InlineData(2026, 10, 12, true)]  // +14
    [InlineData(2026, 10, 5, true)]   // +7
    [InlineData(2026, 10, 7, false)]  // +9
    [InlineData(2026, 9, 21, false)]  // -7: antes do início
    public void NoCompasso_Semanal(int ano, int mes, int dia, bool esperado)
    {
        Assert.Equal(esperado, AgendaRecorrente.NoCompasso(D(ano, mes, dia), D(2026, 9, 28), 0, Semanal));
    }

    [Theory]
    [InlineData(2026, 6, 10, true)]
    [InlineData(2027, 6, 10, true)]
    [InlineData(2027, 7, 10, false)]  // outro mês
    [InlineData(2027, 6, 11, false)]  // outro dia
    [InlineData(2025, 6, 10, false)]  // antes do início (20/06/2025)
    public void NoCompasso_Anual(int ano, int mes, int dia, bool esperado)
    {
        Assert.Equal(esperado, AgendaRecorrente.NoCompasso(D(ano, mes, dia), D(2025, 6, 20), 10, Anual));
    }

    // ── Dia inválido ──────────────────────────────────────────────────────────

    [Theory]
    [InlineData(0)]
    [InlineData(-3)]
    [InlineData(32)]
    public void DiaInvalido_UsaODiaDoInicio(int diaInvalido)
    {
        var inicio = D(2026, 9, 28);

        var agenda = Agenda(inicio, diaInvalido, Mensal, 3);

        Assert.Equal(new[] { D(2026, 9, 28), D(2026, 10, 28), D(2026, 11, 28) }, agenda);
        Assert.True(AgendaRecorrente.NoCompasso(D(2026, 12, 28), inicio, diaInvalido, Mensal));
        Assert.False(AgendaRecorrente.NoCompasso(D(2026, 12, 5), inicio, diaInvalido, Mensal));
    }

    [Fact]
    public void DiaZero_ComInicioNoDia31_SegueOCompassoDoMesCurto()
    {
        var agenda = Agenda(D(2026, 1, 31), 0, Mensal, 3);

        Assert.Equal(new[] { D(2026, 1, 31), D(2026, 2, 28), D(2026, 3, 31) }, agenda);
    }

    [Fact]
    public void DiaZero_Anual_UsaODiaDoInicio()
    {
        var agenda = Agenda(D(2026, 9, 28), 0, Anual, 2);

        Assert.Equal(new[] { D(2026, 9, 28), D(2027, 9, 28) }, agenda);
    }

    // ── Coerência entre as funções ────────────────────────────────────────────

    [Theory]
    [InlineData(FrequenciaRecorrencia.Mensal, 5)]
    [InlineData(FrequenciaRecorrencia.Mensal, 29)]
    [InlineData(FrequenciaRecorrencia.Mensal, 30)]
    [InlineData(FrequenciaRecorrencia.Mensal, 31)]
    [InlineData(FrequenciaRecorrencia.Anual, 15)]
    [InlineData(FrequenciaRecorrencia.Anual, 29)]
    [InlineData(FrequenciaRecorrencia.Semanal, 1)]
    public void Cadeia_CadaDataEhDoCompasso_EEstritamenteCrescente_EBateComProximaEmOuDepois(FrequenciaRecorrencia freq, int dia)
    {
        // Inícios em fevereiro de ano bissexto e em fim de mês: onde o clamp de mês curto mais pode quebrar.
        foreach (var inicio in new[] { D(2024, 2, 29), D(2026, 1, 31), D(2026, 9, 28) })
        {
            var atual = AgendaRecorrente.ProximaEmOuDepois(inicio, inicio, dia, freq);
            for (var i = 0; i < 60; i++)
            {
                Assert.True(AgendaRecorrente.NoCompasso(atual, inicio, dia, freq), $"{freq}/{dia}/{inicio}: {atual} fora do compasso");

                var seguinte = AgendaRecorrente.Seguinte(atual, inicio, dia, freq);
                Assert.True(seguinte > atual, $"{freq}/{dia}/{inicio}: {seguinte} não é depois de {atual}");
                // Pedir "a partir de amanhã" tem que cair exatamente na seguinte (nada pulado, nada repetido).
                Assert.Equal(seguinte, AgendaRecorrente.ProximaEmOuDepois(atual.AddDays(1), inicio, dia, freq));
                atual = seguinte;
            }
        }
    }

    [Fact]
    public void Cadeia_Mensal_CadaDataTemODiaPedido_OuOUltimoDiaDoMes()
    {
        foreach (var dia in new[] { 29, 30, 31 })
        {
            foreach (var data in Agenda(D(2026, 1, 31), dia, Mensal, 48))
                Assert.Equal(Math.Min(dia, DateTime.DaysInMonth(data.Year, data.Month)), data.Day);
        }
    }

    // ── Horizonte da expansão ─────────────────────────────────────────────────

    [Theory]
    [InlineData(2026, 10, 5, 2027, 1, 1)]
    [InlineData(2026, 1, 1, 2027, 1, 1)]
    [InlineData(2026, 12, 31, 2027, 1, 1)] // último dia do ano → o ano que vem
    [InlineData(2028, 2, 29, 2029, 1, 1)]
    public void HorizonteExpansao_EhOPrimeiroDeJaneiroDoAnoSeguinte(int ay, int am, int ad, int ey, int em, int ed)
    {
        Assert.Equal(D(ey, em, ed), AgendaRecorrente.HorizonteExpansao(D(ay, am, ad)));
    }

    // ── Faixa do período (P1-3: início sem faixa = DoS) ───────────────────────

    [Theory]
    [InlineData(2025, 10, 5)]  // exatamente 12 meses atrás
    [InlineData(2026, 10, 5)]  // hoje
    [InlineData(2031, 10, 5)]  // exatamente 5 anos à frente
    public void ValidarPeriodo_InicioNaFaixa_Passa(int y, int m, int d)
    {
        AgendaRecorrente.ValidarPeriodo(D(y, m, d), null, D(2026, 10, 5));
    }

    [Theory]
    [InlineData(1, 1, 1)]      // o caso do ataque: semanal desde o ano 1 gerava ~105 mil lançamentos
    [InlineData(2025, 10, 4)]  // um dia antes do limite de trás
    [InlineData(2031, 10, 6)]  // um dia depois do limite da frente
    [InlineData(9999, 12, 31)]
    public void ValidarPeriodo_InicioForaDaFaixa_Lanca(int y, int m, int d)
    {
        Assert.Throws<ArgumentException>(() => AgendaRecorrente.ValidarPeriodo(D(y, m, d), null, D(2026, 10, 5)));
    }

    [Fact]
    public void ValidarPeriodo_FimAntesDoInicio_Lanca_FimIgualAoInicio_Passa()
    {
        var hoje = D(2026, 10, 5);
        Assert.Throws<ArgumentException>(() => AgendaRecorrente.ValidarPeriodo(hoje, hoje.AddDays(-1), hoje));
        AgendaRecorrente.ValidarPeriodo(hoje, hoje, hoje);
    }

    [Fact]
    public void ValidarPeriodo_SemValidarInicio_AceitaInicioAntigo_MasConfereOFim()
    {
        // Edição: o início é o do cadastro (pode ser dado antigo) — só o fim é conferido.
        var hoje = D(2026, 10, 5);
        AgendaRecorrente.ValidarPeriodo(D(2020, 1, 1), null, hoje, validarInicio: false);
        Assert.Throws<ArgumentException>(() =>
            AgendaRecorrente.ValidarPeriodo(D(2020, 1, 1), D(2019, 12, 31), hoje, validarInicio: false));
    }

    // ── Competência (P1-1: deduplicar por período, não por data) ─────────────

    [Fact]
    public void Competencia_Mensal_EhOMes_QualquerDia()
    {
        var inicio = D(2026, 1, 15);
        Assert.Equal("M2026-10", AgendaRecorrente.Competencia(D(2026, 10, 5), inicio, Mensal));
        Assert.Equal("M2026-10", AgendaRecorrente.Competencia(D(2026, 10, 20), inicio, Mensal)); // dia 5 e 20 = mesmo mês
        Assert.Equal("M2026-11", AgendaRecorrente.Competencia(D(2026, 11, 1), inicio, Mensal));
        Assert.Equal("M0987-03", AgendaRecorrente.Competencia(D(987, 3, 1), inicio, Mensal));   // sempre 4 dígitos (igual ao SQL)
    }

    [Fact]
    public void Competencia_Anual_EhOAno()
    {
        Assert.Equal("A2026", AgendaRecorrente.Competencia(D(2026, 3, 1), D(2025, 3, 1), Anual));
        Assert.Equal("A2026", AgendaRecorrente.Competencia(D(2026, 12, 31), D(2025, 3, 1), Anual));
    }

    [Fact]
    public void Competencia_Semanal_EhOBlocoDe7DiasDesdeOInicio()
    {
        var inicio = D(2026, 10, 1);
        Assert.Equal("S0", AgendaRecorrente.Competencia(D(2026, 10, 1), inicio, Semanal));
        Assert.Equal("S0", AgendaRecorrente.Competencia(D(2026, 10, 7), inicio, Semanal));
        Assert.Equal("S1", AgendaRecorrente.Competencia(D(2026, 10, 8), inicio, Semanal));
        Assert.Equal("S52", AgendaRecorrente.Competencia(D(2027, 9, 30), inicio, Semanal));
    }

    [Theory]
    [InlineData(Mensal)]
    [InlineData(Anual)]
    [InlineData(Semanal)]
    public void Competencia_CadaCobrancaDoCompasso_TemPeriodoProprio(FrequenciaRecorrencia freq)
    {
        // Duas cobranças seguidas nunca caem no mesmo período (senão o gerador pularia uma de verdade).
        foreach (var dia in new[] { 1, 15, 28, 31 })
        {
            var datas = Agenda(D(2026, 1, 31), dia, freq, 60);
            var periodos = datas.Select(d => AgendaRecorrente.Competencia(d, D(2026, 1, 31), freq)).ToList();
            Assert.Equal(periodos.Count, periodos.Distinct().Count());
        }
    }

    [Fact]
    public void InicioDoPeriodo_MesAnoESemana()
    {
        Assert.Equal(D(2026, 10, 1), AgendaRecorrente.InicioDoPeriodo(D(2026, 10, 10), D(2025, 1, 20), Mensal));
        Assert.Equal(D(2026, 1, 1), AgendaRecorrente.InicioDoPeriodo(D(2026, 10, 10), D(2025, 1, 20), Anual));
        // Semanal: blocos de 7 dias desde 01/10 → 08/10 a 14/10 é o bloco do dia 10.
        Assert.Equal(D(2026, 10, 8), AgendaRecorrente.InicioDoPeriodo(D(2026, 10, 10), D(2026, 10, 1), Semanal));
        Assert.Equal(D(2026, 10, 1), AgendaRecorrente.InicioDoPeriodo(D(2026, 10, 1), D(2026, 10, 1), Semanal));
        // Início no futuro: não há período corrente — fica o próprio dia (o gerador nunca vai antes do início).
        Assert.Equal(D(2026, 10, 10), AgendaRecorrente.InicioDoPeriodo(D(2026, 10, 10), D(2026, 12, 1), Semanal));
    }
}

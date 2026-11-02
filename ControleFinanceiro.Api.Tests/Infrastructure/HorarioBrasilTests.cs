using System.Text.RegularExpressions;
using ControleFinanceiro.Api.Infrastructure;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// "Hoje" do app é o dia no Brasil (2026-10-21). Com o dia UTC, das 21h à meia-noite de Brasília o servidor já estava
/// no dia seguinte: aceitava lançamento efetivado com a data de amanhã, cobrava a conta fixa de amanhã. A trava lê o
/// código da API e dos testes e falha se alguém voltar a decidir o dia pelo relógio UTC ou da máquina.
/// </summary>
public class HorarioBrasilTests
{
    [Fact]
    public void As22h30DeBrasilia_JaEhOutroDiaEmUtc_MasHojeAindaEhOMesmo()
    {
        var utc = new DateTime(2026, 10, 21, 1, 30, 0, DateTimeKind.Utc); // 22h30 de 20/10 em Brasília

        Assert.Equal(new DateTime(2026, 10, 20, 22, 30, 0), HorarioBrasil.DeUtc(utc));
        Assert.Equal(DateTimeKind.Unspecified, HorarioBrasil.DeUtc(utc).Kind);
        Assert.Equal(new DateTime(2026, 10, 20), HorarioBrasil.DiaMaisCedo(utc)); // Acre, UTC−5
    }

    [Fact]
    public void Hoje_EhODiaDeAgoraEmBrasilia()
    {
        var antes = DateOnly.FromDateTime(HorarioBrasil.DeUtc(TimeProvider.System.GetUtcNow().UtcDateTime));
        var hoje = HorarioBrasil.Hoje();
        var depois = DateOnly.FromDateTime(HorarioBrasil.DeUtc(TimeProvider.System.GetUtcNow().UtcDateTime));
        Assert.True(hoje == antes || hoje == depois);
    }

    [Fact]
    public async Task FixarParaTeste_MudaAgoraEHoje_InclusiveDepoisDeAwait_EODisposeVolta()
    {
        var real = HorarioBrasil.Hoje();
        using (HorarioBrasil.FixarParaTeste(new DateTime(2026, 11, 1, 2, 30, 0, DateTimeKind.Utc))) // 23h30 de 31/10
        {
            Assert.Equal(new DateTime(2026, 10, 31, 23, 30, 0), HorarioBrasil.Agora());
            Assert.Equal(new DateOnly(2026, 10, 31), HorarioBrasil.Hoje()); // em UTC já é 01/11: o mês não vira
            await Task.Yield();
            Assert.Equal(new DateOnly(2026, 10, 31), await Task.Run(HorarioBrasil.Hoje));

            using (HorarioBrasil.FixarParaTeste(new DateTime(2030, 1, 15, 15, 0, 0, DateTimeKind.Utc)))
                Assert.Equal(new DateOnly(2030, 1, 15), HorarioBrasil.Hoje());
            Assert.Equal(new DateOnly(2026, 10, 31), HorarioBrasil.Hoje()); // o de dentro devolve o de fora
        }
        Assert.True(HorarioBrasil.Hoje() >= real);
        Assert.Same(TimeProvider.System, HorarioBrasil.Relogio);
    }

    [Fact]
    public async Task UsarFuso_HojeEhODiaDaPessoa_AcreNoronhaEViagem_EODisposeVoltaPraBrasilia()
    {
        // 02/11 às 01h30 UTC = 22h30 de 01/11 em Brasília, 20h30 no Acre e 23h30 em Noronha; em Lisboa (UTC+0) já é 02/11.
        using var _ = HorarioBrasil.FixarParaTeste(new DateTime(2026, 11, 2, 1, 30, 0, DateTimeKind.Utc));
        Assert.Equal(new DateOnly(2026, 11, 1), HorarioBrasil.Hoje()); // sem fuso na conta: Brasília

        using (HorarioBrasil.UsarFuso("America/Rio_Branco"))
        {
            Assert.Equal(new DateTime(2026, 11, 1, 20, 30, 0), HorarioBrasil.Agora());
            await Task.Yield();
            Assert.Equal(new DateOnly(2026, 11, 1), await Task.Run(HorarioBrasil.Hoje)); // vale depois de await
        }
        using (HorarioBrasil.UsarFuso("America/Noronha"))
            Assert.Equal(new DateTime(2026, 11, 1, 23, 30, 0), HorarioBrasil.Agora());
        using (HorarioBrasil.UsarFuso("Europe/Lisbon"))
            Assert.Equal(new DateOnly(2026, 11, 2), HorarioBrasil.Hoje());

        // Fuso vazio ou desconhecido = Brasília (nunca o dia UTC).
        using (HorarioBrasil.UsarFuso("Marte/Olympus"))
            Assert.Equal(new DateOnly(2026, 11, 1), HorarioBrasil.Hoje());
        Assert.Null(HorarioBrasil.Resolver(" "));
        Assert.Equal(new DateTime(2026, 11, 1, 22, 30, 0), HorarioBrasil.Agora()); // o Dispose devolveu Brasília
    }

    // Decidir o dia (ou o mês, o ano) pelo relógio UTC ou pelo da máquina. Carimbo (DateTime.UtcNow, .AddDays de prazo)
    // continua livre: o que a trava pega é virar "que dia é".
    private static readonly Regex DiaPeloRelogioErrado = new(
        @"DateTime\.UtcNow\.(Date|Year|Month|Day)\b|DateOnly\.FromDateTime\(\s*DateTime\.UtcNow|DateTime\.Now\b|DateTime\.Today\b",
        RegexOptions.Compiled);

    // A API e os testes (desde 2026-11-01): teste que monta "ontem" pelo dia UTC falhava das 21h à meia-noite de
    // Brasília, porque a API já usa o dia do Brasil.
    [Theory]
    [InlineData("ControleFinanceiro.Api")]
    [InlineData("ControleFinanceiro.Api.Tests")]
    public void Codigo_NaoDecideODiaPeloRelogioUtcNemDaMaquina(string projeto)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "controle-financeiro.sln")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        var raiz = Path.Combine(dir!.FullName, projeto);
        var sep = Path.DirectorySeparatorChar;
        var achados = Directory.EnumerateFiles(raiz, "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Contains($"{sep}bin{sep}") && !f.Contains($"{sep}obj{sep}") && !f.Contains($"{sep}Migrations{sep}")
                        && !Path.GetFileName(f).StartsWith("MeuCenario") && Path.GetFileName(f) != "HorarioBrasil.cs")
            .SelectMany(f => File.ReadLines(f).Select((linha, i) => (Arquivo: Path.GetRelativePath(raiz, f), Linha: i + 1, Texto: linha.Trim())))
            .Where(l => !l.Texto.StartsWith("//") && DiaPeloRelogioErrado.IsMatch(l.Texto))
            .Select(l => $"{l.Arquivo}:{l.Linha}: {l.Texto}")
            .ToList();

        Assert.True(achados.Count == 0, "Use HorarioBrasil.Hoje()/HojeData()/Agora() pra decidir que dia é:\n" + string.Join("\n", achados));
    }
}

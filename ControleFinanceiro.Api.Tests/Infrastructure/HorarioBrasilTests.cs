using System.Text.RegularExpressions;
using ControleFinanceiro.Api.Infrastructure;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// "Hoje" do app é o dia no Brasil (2026-10-21). Com o dia UTC, das 21h à meia-noite de Brasília o servidor já estava
/// no dia seguinte: aceitava lançamento efetivado com a data de amanhã, cobrava a conta fixa de amanhã. A trava lê o
/// código da API e falha se alguém voltar a decidir o dia pelo relógio UTC ou da máquina.
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
        var antes = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(-3));
        var hoje = HorarioBrasil.Hoje();
        var depois = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(-3));
        Assert.True(hoje == antes || hoje == depois);
    }

    private static readonly Regex DiaPeloRelogioErrado = new(
        @"DateTime\.UtcNow\.Date\b|DateOnly\.FromDateTime\(\s*DateTime\.UtcNow|DateTime\.Now\b|DateTime\.Today\b",
        RegexOptions.Compiled);

    [Fact]
    public void CodigoDaApi_NaoDecideODiaPeloRelogioUtcNemDaMaquina()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "controle-financeiro.sln")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        var api = Path.Combine(dir!.FullName, "ControleFinanceiro.Api");
        var sep = Path.DirectorySeparatorChar;
        var achados = Directory.EnumerateFiles(api, "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Contains($"{sep}bin{sep}") && !f.Contains($"{sep}obj{sep}") && !f.Contains($"{sep}Migrations{sep}")
                        && !Path.GetFileName(f).StartsWith("MeuCenario") && Path.GetFileName(f) != "HorarioBrasil.cs")
            .SelectMany(f => File.ReadLines(f).Select((linha, i) => (Arquivo: Path.GetRelativePath(api, f), Linha: i + 1, Texto: linha.Trim())))
            .Where(l => !l.Texto.StartsWith("//") && DiaPeloRelogioErrado.IsMatch(l.Texto))
            .Select(l => $"{l.Arquivo}:{l.Linha}: {l.Texto}")
            .ToList();

        Assert.True(achados.Count == 0, "Use HorarioBrasil.Hoje()/HojeData()/Agora() pra decidir que dia é:\n" + string.Join("\n", achados));
    }
}

using System.Text.RegularExpressions;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Trava (2026-10-19): a imagem de produção (alpine) roda com globalização invariante. Lá <c>{valor:C}</c> sai
/// "¤1,000.00" e <c>new CultureInfo("pt-BR")</c> lança erro. Valor em reais vai por <c>Reais.Formatar</c> e nome
/// de mês por <c>MesesPt</c>. Este teste lê o código da API e falha se alguém voltar a usar o jeito antigo.
/// </summary>
public class SemCulturaNasMensagensTests
{
    private static readonly Regex Proibido = new(
        @"\{[^{}]*:C\d?\}|ToString\(\s*""C\d?""|new\s+CultureInfo\(\s*""pt|GetCultureInfo\(\s*""pt",
        RegexOptions.Compiled);

    private static string PastaDaApi()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "controle-financeiro.sln")))
            dir = dir.Parent;
        Assert.NotNull(dir); // o teste roda de dentro do repositório
        return Path.Combine(dir!.FullName, "ControleFinanceiro.Api");
    }

    [Fact]
    public void CodigoDaApi_NaoFormataReaisNemMesPelaCulturaDaMaquina()
    {
        var api = PastaDaApi();
        var achados = Directory.EnumerateFiles(api, "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}")
                        && !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}")
                        && !f.Contains($"{Path.DirectorySeparatorChar}Migrations{Path.DirectorySeparatorChar}")
                        // O único lugar que formata "C": com o formato montado à mão, não o da máquina.
                        && Path.GetFileName(f) != "Reais.cs")
            .SelectMany(f => File.ReadLines(f).Select((linha, i) => (Arquivo: Path.GetRelativePath(api, f), Linha: i + 1, Texto: linha.Trim())))
            .Where(l => !l.Texto.StartsWith("//") && Proibido.IsMatch(l.Texto))
            .Select(l => $"{l.Arquivo}:{l.Linha}: {l.Texto}")
            .ToList();

        Assert.True(achados.Count == 0,
            "Use Reais.Formatar(x) e MesesPt em vez da cultura da máquina:\n" + string.Join("\n", achados));
    }
}

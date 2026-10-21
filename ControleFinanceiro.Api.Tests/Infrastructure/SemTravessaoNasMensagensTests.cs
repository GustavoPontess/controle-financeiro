using System.Text.RegularExpressions;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Trava (2026-10-20, pedido do Gustavo: travessão em texto que a pessoa lê é "marca de IA"): nenhum texto da API
/// (mensagem de erro, notificação, descrição de lançamento, nome no lugar de alguém) leva "—". Usar ponto, vírgula
/// ou dois-pontos. Este teste lê o código da API e falha se um texto entre aspas voltar a ter travessão; comentário
/// pode (não chega na tela).
/// </summary>
public class SemTravessaoNasMensagensTests
{
    private static readonly Regex TextoComTravessao = new(@"""[^""]*—[^""]*""", RegexOptions.Compiled);

    private static string PastaDaApi()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "controle-financeiro.sln")))
            dir = dir.Parent;
        Assert.NotNull(dir); // o teste roda de dentro do repositório
        return Path.Combine(dir!.FullName, "ControleFinanceiro.Api");
    }

    [Fact]
    public void TextosDaApi_NaoTemTravessao()
    {
        var api = PastaDaApi();
        var sep = Path.DirectorySeparatorChar;
        var achados = Directory.EnumerateFiles(api, "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Contains($"{sep}bin{sep}") && !f.Contains($"{sep}obj{sep}") && !f.Contains($"{sep}Migrations{sep}")
                        // Seeder pessoal de dogfooding (gitignored, dados do dono do checkout): não é do produto.
                        && !Path.GetFileName(f).StartsWith("MeuCenario"))
            .SelectMany(f => File.ReadLines(f).Select((linha, i) => (Arquivo: Path.GetRelativePath(api, f), Linha: i + 1, Texto: linha.Trim())))
            .Where(l => !l.Texto.StartsWith("//") && !l.Texto.StartsWith("*") && TextoComTravessao.IsMatch(l.Texto))
            .Select(l => $"{l.Arquivo}:{l.Linha}: {l.Texto}")
            .ToList();

        Assert.True(achados.Count == 0,
            "Texto da API com travessão (use ponto, vírgula ou dois-pontos):\n" + string.Join("\n", achados));
    }
}

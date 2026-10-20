using System.Text.RegularExpressions;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Trava (2026-10-19, pedido do Gustavo antes do cartão compartilhado): "quem pode o quê" na família mora SÓ em
/// <c>Services/FamiliaPermissoes.cs</c> (tabela em docs/PERMISSOES.md). Este teste lê o código da API e falha se alguém
/// reescrever a regra na mão em outro lugar: perguntar ao banco se é membro (<c>MembrosFamilia.AnyAsync</c>), comparar
/// papel com "só vê" (<c>PapelFamilia.Dependente</c>) ou chamar o <c>ExigirPapelAsync</c> genérico. Use as perguntas
/// com nome: <c>EhMembroAsync</c>, <c>LancaNaFamiliaAsync</c>, <c>QuemLanca</c>, <c>Lanca</c>, <c>DividemFamiliaAsync</c>,
/// <c>VeRendaDosOutros</c>, <c>ExigirMembroAsync</c>, <c>ExigirLancarAsync</c>, <c>ExigirAdminAsync</c>.
/// </summary>
public class PermissoesCentralizadasTests
{
    private static readonly (string Nome, Regex Regra)[] Proibidos =
    [
        ("pergunta ao banco se é membro (use FamiliaPermissoes.EhMembroAsync / LancaNaFamiliaAsync)",
            new Regex(@"MembrosFamilia\s*\.\s*AnyAsync", RegexOptions.Compiled)),
        ("compara papel com 'só vê' (use FamiliaPermissoes.Lanca / QuemLanca / VeRendaDosOutros)",
            new Regex(@"(PapelPermissao|\bpapel)\s*[!=]=\s*PapelFamilia\.Dependente", RegexOptions.Compiled)),
        ("ExigirPapelAsync genérico (use ExigirMembroAsync / ExigirLancarAsync / ExigirAdminAsync)",
            new Regex(@"ExigirPapelAsync\s*\(", RegexOptions.Compiled)),
    ];

    private static string PastaDaApi()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "controle-financeiro.sln")))
            dir = dir.Parent;
        Assert.NotNull(dir); // o teste roda de dentro do repositório
        return Path.Combine(dir!.FullName, "ControleFinanceiro.Api");
    }

    [Fact]
    public void RegraDeQuemPodeOQue_SoMoraEmFamiliaPermissoes()
    {
        var api = PastaDaApi();
        var sep = Path.DirectorySeparatorChar;
        var arquivos = Directory.EnumerateFiles(api, "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Contains($"{sep}bin{sep}") && !f.Contains($"{sep}obj{sep}") && !f.Contains($"{sep}Migrations{sep}")
                        && Path.GetFileName(f) != "FamiliaPermissoes.cs");
        var achados = new List<string>();
        foreach (var f in arquivos)
        {
            // O arquivo inteiro (a consulta pode quebrar linha), sem os comentários de linha.
            var texto = string.Join('\n', File.ReadLines(f).Select(l => l.TrimStart().StartsWith("//") ? "" : l));
            foreach (var (nome, regra) in Proibidos)
                foreach (Match m in regra.Matches(texto))
                {
                    var linha = texto[..m.Index].Count(c => c == '\n') + 1;
                    achados.Add($"{Path.GetRelativePath(api, f)}:{linha}: {nome}");
                }
        }
        Assert.True(achados.Count == 0, "Regra de permissão fora de FamiliaPermissoes:\n" + string.Join('\n', achados));
    }
}

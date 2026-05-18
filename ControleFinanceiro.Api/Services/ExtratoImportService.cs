using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace ControleFinanceiro.Api.Services;

/// <summary>Issue #27 — leitura de extratos bancários OFX e CSV. Só faz parsing;
/// dedup, sugestão de categoria e persistência ficam no ImportacaoService.</summary>
public class ExtratoImportService
{
    /// <summary>Uma transação crua lida do arquivo, antes de qualquer tratamento.</summary>
    public record LinhaExtrato(DateTime Data, string Descricao, decimal Valor, string? FitId);

    /// <summary>Lê o conteúdo do extrato, escolhendo o parser pela extensão.</summary>
    public List<LinhaExtrato> Parse(string nomeArquivo, string conteudo)
    {
        var ext = Path.GetExtension(nomeArquivo).ToLowerInvariant();
        return ext switch
        {
            ".ofx" => ParseOfx(conteudo),
            ".csv" => ParseCsv(conteudo),
            _ => throw new ArgumentException("Formato não suportado. Envie um arquivo .ofx ou .csv."),
        };
    }

    // ── OFX ──

    /// <summary>Parser tolerante de OFX 1.x (SGML) e 2.x (XML): extrai os blocos
    /// STMTTRN e os campos DTPOSTED, TRNAMT, FITID, MEMO/NAME.</summary>
    public List<LinhaExtrato> ParseOfx(string conteudo)
    {
        var linhas = new List<LinhaExtrato>();
        var blocos = Regex.Matches(
            conteudo, "<STMTTRN>(.*?)</STMTTRN>",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);

        foreach (Match bloco in blocos)
        {
            var corpo = bloco.Groups[1].Value;

            var dtposted = TagOfx(corpo, "DTPOSTED");
            var trnamt = TagOfx(corpo, "TRNAMT");
            if (dtposted is null || trnamt is null)
                continue;

            if (!TryParseDataOfx(dtposted, out var data))
                continue;
            if (!decimal.TryParse(trnamt, NumberStyles.Number, CultureInfo.InvariantCulture, out var valor))
                continue;

            var descricao = TagOfx(corpo, "MEMO") ?? TagOfx(corpo, "NAME") ?? "Sem descrição";
            var fitId = TagOfx(corpo, "FITID");

            linhas.Add(new LinhaExtrato(data, descricao.Trim(), valor, fitId?.Trim()));
        }

        if (linhas.Count == 0)
            throw new ArgumentException("Nenhuma transação encontrada no arquivo OFX.");

        return linhas;
    }

    /// <summary>Valor de uma tag SGML/XML: o texto após &lt;TAG&gt; até o próximo
    /// &lt; ou fim de linha (tags OFX 1.x normalmente não têm fechamento).</summary>
    private static string? TagOfx(string corpo, string tag)
    {
        var m = Regex.Match(corpo, $"<{tag}>([^<\r\n]*)", RegexOptions.IgnoreCase);
        return m.Success ? m.Groups[1].Value : null;
    }

    private static bool TryParseDataOfx(string raw, out DateTime data)
    {
        // DTPOSTED: YYYYMMDD ou YYYYMMDDHHMMSS[.XXX][TZ]
        data = default;
        var limpo = raw.Trim();
        if (limpo.Length < 8)
            return false;

        return DateTime.TryParseExact(
            limpo[..8], "yyyyMMdd", CultureInfo.InvariantCulture,
            DateTimeStyles.None, out data);
    }

    // ── CSV ──

    /// <summary>Parser de CSV: detecta o delimitador, identifica as colunas pelo
    /// cabeçalho (com fallback posicional data/descrição/valor).</summary>
    public List<LinhaExtrato> ParseCsv(string conteudo)
    {
        var todasLinhas = conteudo
            .Replace("\r\n", "\n").Replace('\r', '\n')
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();

        if (todasLinhas.Count == 0)
            throw new ArgumentException("Arquivo CSV vazio.");

        var delim = todasLinhas[0].Count(c => c == ';') >= todasLinhas[0].Count(c => c == ',')
            ? ';' : ',';

        var primeira = SplitCsv(todasLinhas[0], delim);
        var temCabecalho = !TryParseDataCsv(primeira.ElementAtOrDefault(0) ?? "", out _);

        int idxData = 0, idxDesc = 1, idxValor = 2;
        if (temCabecalho)
        {
            for (var i = 0; i < primeira.Length; i++)
            {
                var col = primeira[i].ToLowerInvariant();
                if (col.Contains("data")) idxData = i;
                else if (col.Contains("desc") || col.Contains("histórico")
                    || col.Contains("historico") || col.Contains("lançamento")
                    || col.Contains("lancamento")) idxDesc = i;
                else if (col.Contains("valor") || col.Contains("montante")) idxValor = i;
            }
        }

        var linhas = new List<LinhaExtrato>();
        foreach (var linha in todasLinhas.Skip(temCabecalho ? 1 : 0))
        {
            var campos = SplitCsv(linha, delim);
            if (campos.Length <= Math.Max(idxData, Math.Max(idxDesc, idxValor)))
                continue;

            if (!TryParseDataCsv(campos[idxData], out var data))
                continue;
            if (!TryParseValorCsv(campos[idxValor], out var valor))
                continue;

            var descricao = campos[idxDesc].Trim();
            if (string.IsNullOrWhiteSpace(descricao))
                descricao = "Sem descrição";

            linhas.Add(new LinhaExtrato(data, descricao, valor, null));
        }

        if (linhas.Count == 0)
            throw new ArgumentException("Nenhuma transação reconhecida no arquivo CSV.");

        return linhas;
    }

    private static string[] SplitCsv(string linha, char delim)
    {
        // Suporta campos entre aspas (que podem conter o delimitador).
        var campos = new List<string>();
        var sb = new StringBuilder();
        var dentroAspas = false;

        foreach (var c in linha)
        {
            if (c == '"')
                dentroAspas = !dentroAspas;
            else if (c == delim && !dentroAspas)
            {
                campos.Add(sb.ToString());
                sb.Clear();
            }
            else
                sb.Append(c);
        }
        campos.Add(sb.ToString());
        return campos.Select(x => x.Trim().Trim('"').Trim()).ToArray();
    }

    private static bool TryParseDataCsv(string raw, out DateTime data)
    {
        string[] formatos = { "dd/MM/yyyy", "yyyy-MM-dd", "dd-MM-yyyy", "dd/MM/yy", "MM/dd/yyyy" };
        return DateTime.TryParseExact(
            raw.Trim(), formatos, CultureInfo.InvariantCulture,
            DateTimeStyles.None, out data);
    }

    private static bool TryParseValorCsv(string raw, out decimal valor)
    {
        valor = 0m;
        var limpo = raw.Trim()
            .Replace("R$", "", StringComparison.OrdinalIgnoreCase)
            .Replace(" ", "")
            .Replace(" ", "");
        if (limpo.Length == 0)
            return false;

        var temVirgula = limpo.Contains(',');
        var temPonto = limpo.Contains('.');

        if (temVirgula && temPonto)
            // Formato BR: ponto = milhar, vírgula = decimal.
            limpo = limpo.Replace(".", "").Replace(',', '.');
        else if (temVirgula)
            // Só vírgula = separador decimal.
            limpo = limpo.Replace(',', '.');
        // Só ponto (ou nenhum): já está em formato invariável.

        return decimal.TryParse(
            limpo, NumberStyles.Number, CultureInfo.InvariantCulture, out valor);
    }
}

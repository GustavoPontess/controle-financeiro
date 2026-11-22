using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Issue #27 — leitura de extratos bancários OFX e CSV. Só faz parsing; dedup, sugestão de categoria e
/// persistência ficam no ImportacaoService.
///
/// Planilha de banco não tem documentação: cada um exporta do seu jeito e muda sem avisar. Por isso o CSV
/// não tem "se for o banco X": vira uma <see cref="TabelaCsv"/> (separador, preâmbulo e cabeçalho
/// detectados) e um <see cref="MapeamentoCsv"/> diz qual coluna é o quê. O mapeamento vem (1) do que a
/// pessoa já escolheu pra aquela conta e aquele cabeçalho, (2) dos nomes das colunas (<see cref="Sinonimos"/>,
/// a "lista de bancos" em forma de dado) ou (3) do conteúdo. Sem confiança, a tela pergunta. Tudo termina na
/// mesma <see cref="LinhaExtrato"/> — daí pra frente o banco não importa. OFX é padrão aberto: um leitor só.
/// </summary>
public class ExtratoImportService
{
    /// <summary>Uma transação crua lida do arquivo, antes de qualquer tratamento.</summary>
    public record LinhaExtrato(DateTime Data, string Descricao, decimal Valor, string? FitId);

    /// <summary>O CSV como tabela: colunas (do cabeçalho ou "Coluna N"), as linhas de dado e a assinatura do
    /// cabeçalho (chave pra lembrar o mapeamento da conta).</summary>
    public record TabelaCsv(char Delimitador, string[] Colunas, List<string[]> Linhas, bool TemCabecalho, string Assinatura);

    /// <summary>Qual coluna (índice) é o quê. Valor assinado OU Entrada + Saída. Id vira o FITID quando é
    /// único no arquivo. <c>InverterSinal</c>: banco que mostra saída positiva.</summary>
    /// <summary><c>Tipo</c>: coluna com o tipo do lançamento ("Pix enviado"), em banco que separa tipo e nome (Inter);
    /// entra na frente da descrição pra o leitor do lugar separar os dois.</summary>
    public record MapeamentoCsv(int Data, int Descricao, int? Valor, int? Entrada, int? Saida, int? Id, bool InverterSinal, int? Tipo = null);

    /// <summary>Resultado da leitura. CSV sem mapeamento confiável volta <c>PrecisaMapear</c> (sem linhas) e a
    /// tela pergunta qual coluna é o quê.</summary>
    public record LeituraExtrato(string Formato, List<LinhaExtrato> Linhas, TabelaCsv? Tabela, MapeamentoCsv? Mapeamento, bool PrecisaMapear);

    public const int DescricaoMax = 255;
    public const int FitIdMax = 255;
    public const string MensagemNaoReconhecido =
        "Não deu pra reconhecer as colunas do arquivo. Diga qual coluna é a data, a descrição e o valor.";

    /// <summary>Lê o conteúdo do extrato, escolhendo o parser pela extensão. Lança se o CSV precisar de mapeamento.</summary>
    public List<LinhaExtrato> Parse(string nomeArquivo, string conteudo)
    {
        var leitura = Ler(nomeArquivo, conteudo, null);
        if (leitura.PrecisaMapear)
            throw new ArgumentException(MensagemNaoReconhecido);
        return leitura.Linhas;
    }

    /// <summary>Lê OFX ou CSV. No CSV, usa o <paramref name="mapeamento"/> dado; sem ele, tenta sugerir.</summary>
    public LeituraExtrato Ler(string nomeArquivo, string conteudo, MapeamentoCsv? mapeamento)
    {
        var ext = Path.GetExtension(nomeArquivo).ToLowerInvariant();
        switch (ext)
        {
            case ".ofx":
                return new LeituraExtrato("ofx", ParseOfx(conteudo), null, null, false);
            case ".csv":
                var tabela = LerTabela(conteudo);
                var mapa = mapeamento ?? SugerirMapeamento(tabela);
                if (mapa is null)
                    return new LeituraExtrato("csv", new(), tabela, null, true);
                if (mapeamento is not null)
                    ValidarMapeamento(mapeamento, tabela);
                var linhas = Aplicar(tabela, mapa);
                // Mapeamento escolhido pela pessoa que não lê nada também volta pra tela (ela troca as colunas).
                return linhas.Count == 0
                    ? new LeituraExtrato("csv", new(), tabela, mapa, true)
                    : new LeituraExtrato("csv", linhas, tabela, mapa, false);
            default:
                throw new ArgumentException("Formato não suportado. Envie um arquivo .ofx ou .csv.");
        }
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

            linhas.Add(new LinhaExtrato(data, Cortar(descricao.Trim(), DescricaoMax), valor, Cortar(fitId?.Trim(), FitIdMax)));
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

    /// <summary>CSV com mapeamento sugerido (nomes das colunas ou conteúdo). Lança se não reconhecer.</summary>
    public List<LinhaExtrato> ParseCsv(string conteudo) => Parse("extrato.csv", conteudo);

    /// <summary>
    /// O CSV como tabela. Separador: o que dá o mesmo número de colunas no maior número de linhas (; , tab |).
    /// Banco costuma pôr preâmbulo (nome, agência, período): a primeira linha de DADO é a primeira que tem uma
    /// data e um valor; a de cima, se não tiver data, é o cabeçalho; o resto acima é ignorado.
    /// </summary>
    public TabelaCsv LerTabela(string conteudo)
    {
        var brutas = conteudo.TrimStart('﻿')
            .Replace("\r\n", "\n").Replace('\r', '\n')
            .Split('\n')
            .Where(l => !string.IsNullOrWhiteSpace(l))
            .ToList();
        if (brutas.Count == 0)
            throw new ArgumentException("Arquivo CSV vazio.");

        var delim = DetectarDelimitador(brutas);
        var linhas = brutas.Select(l => SplitCsv(l, delim)).ToList();

        var inicio = linhas.FindIndex(EhLinhaDeDado);
        if (inicio < 0)
            throw new ArgumentException("Nenhuma transação reconhecida no arquivo CSV.");

        var temCabecalho = inicio > 0 && !linhas[inicio - 1].Any(c => TryParseData(c, out _));
        var dados = linhas.Skip(inicio).ToList();
        var largura = Math.Max(dados.Max(l => l.Length), temCabecalho ? linhas[inicio - 1].Length : 0);
        string[] Completar(string[] l) => l.Length >= largura ? l : l.Concat(Enumerable.Repeat("", largura - l.Length)).ToArray();

        var colunas = temCabecalho
            ? Completar(linhas[inicio - 1]).Select((c, i) => string.IsNullOrWhiteSpace(c) ? $"Coluna {i + 1}" : c.Trim()).ToArray()
            : Enumerable.Range(1, largura).Select(i => $"Coluna {i}").ToArray();
        var assinatura = temCabecalho
            ? string.Join("|", colunas.Select(Normalizar))
            : $"sem-cabecalho:{largura}";

        return new TabelaCsv(delim, colunas, dados.Select(Completar).ToList(), temCabecalho, Cortar(assinatura, 300)!);
    }

    private static bool EhLinhaDeDado(string[] celulas)
    {
        var data = Array.FindIndex(celulas, c => TryParseData(c, out _));
        return data >= 0 && celulas.Where((c, i) => i != data).Any(c => TryParseValor(c, out var v) && v != 0);
    }

    private static char DetectarDelimitador(List<string> linhas)
    {
        char[] candidatos = { ';', '\t', ',', '|' };
        var amostra = linhas.Take(30).ToList();
        var melhor = ';';
        var melhorPontos = -1;
        foreach (var d in candidatos)
        {
            // Quantas linhas têm a contagem mais comum (≥1) desse separador.
            var contagens = amostra.Select(l => SplitCsv(l, d).Length - 1).Where(n => n > 0).ToList();
            if (contagens.Count == 0) continue;
            var moda = contagens.GroupBy(n => n).OrderByDescending(g => g.Count()).First();
            var pontos = moda.Count() * 10 + moda.Key;
            if (pontos > melhorPontos) { melhorPontos = pontos; melhor = d; }
        }
        return melhor;
    }

    /// <summary>
    /// Nomes de coluna que dizem o que ela é (sem acento, minúsculo, "contém"). É a lista de bancos em forma de
    /// dado: banco novo com nome de coluna diferente entra aqui, não num <c>if</c>.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string[]> Sinonimos = new Dictionary<string, string[]>
    {
        ["data"] = new[] { "data", "date", "dt " },
        ["descricao"] = new[] { "descricao", "historico", "title", "detalhe", "memo", "estabelecimento", "favorecido", "lancamento" },
        ["valor"] = new[] { "valor", "amount", "montante", "quantia", "value" },
        ["entrada"] = new[] { "entrada", "credito", "credit", "recebido" },
        ["saida"] = new[] { "saida", "debito", "debit", "pago" },
        ["id"] = new[] { "identificador", "id", "codigo", "documento", "doc" },
        // Só quando sobra uma segunda coluna de texto além da descrição (Inter: Histórico + Descrição).
        ["tipo"] = new[] { "tipo", "historico", "lancamento", "operacao", "transacao" },
    };

    /// <summary>
    /// Sugere o mapeamento: primeiro pelos nomes das colunas, o que faltar pelo conteúdo. Null quando não dá
    /// pra confiar (a tela pergunta): sem data, sem descrição ou sem valor, ou se menos de 90% das linhas com
    /// data viram lançamento.
    /// </summary>
    public MapeamentoCsv? SugerirMapeamento(TabelaCsv t)
    {
        var usadas = new HashSet<int>();
        int? PorNome(string papel, Func<int, bool>? extra = null)
        {
            if (!t.TemCabecalho) return null;
            foreach (var sinonimo in Sinonimos[papel])
                for (var i = 0; i < t.Colunas.Length; i++)
                {
                    var nome = Normalizar(t.Colunas[i]) + " ";
                    var casa = sinonimo.EndsWith(' ') ? nome.StartsWith(sinonimo) : nome.Contains(sinonimo);
                    if (casa && !usadas.Contains(i) && (extra?.Invoke(i) ?? true)) { usadas.Add(i); return i; }
                }
            return null;
        }
        double Fracao(int col, Func<string, bool> ok) =>
            t.Linhas.Count == 0 ? 0 : t.Linhas.Count(l => ok(l[col])) / (double)t.Linhas.Count;

        var data = PorNome("data", i => Fracao(i, c => TryParseData(c, out _)) >= 0.5)
                   ?? MelhorColuna(t, usadas, c => TryParseData(c, out _));
        if (data is null) return null;
        usadas.Add(data.Value);

        var valor = PorNome("valor", i => Fracao(i, c => TryParseValor(c, out _)) >= 0.5);
        int? entrada = null, saida = null;
        if (valor is null)
        {
            entrada = PorNome("entrada");
            saida = PorNome("saida");
            if (entrada is null || saida is null)
            {
                if (entrada is { } e) usadas.Remove(e);
                if (saida is { } s) usadas.Remove(s);
                entrada = saida = null;
                valor = MelhorColuna(t, usadas, c => TryParseValor(c, out var v) && v != 0, preferirNegativo: true);
                if (valor is { } v) usadas.Add(v);
            }
        }
        if (valor is null && entrada is null) return null;

        var descricao = PorNome("descricao", i => Fracao(i, c => !string.IsNullOrWhiteSpace(c) && !TryParseValor(c, out _)) >= 0.5)
                        ?? ColunaDeTexto(t, usadas);
        if (descricao is null) return null;
        usadas.Add(descricao.Value);

        var id = PorNome("id");
        var tipo = PorNome("tipo", i => Fracao(i, c => !string.IsNullOrWhiteSpace(c) && !TryParseValor(c, out _) && !TryParseData(c, out _)) >= 0.5);
        var mapa = new MapeamentoCsv(data.Value, descricao.Value, valor, entrada, saida, id, false, tipo);

        var comData = t.Linhas.Count(l => TryParseData(l[data.Value], out _));
        var lidas = Aplicar(t, mapa, contarSaldo: true).Count;
        return comData > 0 && lidas >= comData * 0.9 ? mapa : null;
    }

    /// <summary>
    /// Por que cada coluna é o que é (2026-11-21: a escolha fica à vista, não escondida). <paramref name="origem"/>:
    /// "lembrado" (o que a pessoa escolheu antes pra esta conta), "escolhido" (agora) ou null (o app sugeriu: pelo
    /// nome da coluna, quando casa com um <see cref="Sinonimos"/> do papel, senão pelo conteúdo).
    /// </summary>
    public static string[] Motivos(TabelaCsv t, MapeamentoCsv? m, string? origem)
    {
        var motivos = new string[t.Colunas.Length];
        for (var i = 0; i < motivos.Length; i++)
        {
            var papel = m is null ? null
                : i == m.Data ? "data" : i == m.Descricao ? "descricao" : i == m.Valor ? "valor"
                : i == m.Entrada ? "entrada" : i == m.Saida ? "saida" : i == m.Id ? "id" : i == m.Tipo ? "tipo" : null;
            var nome = Normalizar(t.Colunas[i]) + " ";
            motivos[i] = papel is null
                ? (nome.Contains("saldo") ? "é o saldo" : "não usada")
                : origem == "lembrado" ? "lembrado desta conta"
                : origem == "escolhido" ? "você escolheu"
                : t.TemCabecalho && Sinonimos[papel].Any(s => s.EndsWith(' ') ? nome.StartsWith(s) : nome.Contains(s)) ? "pelo nome da coluna"
                : "pelo conteúdo";
        }
        return motivos;
    }

    private static int? MelhorColuna(TabelaCsv t, HashSet<int> usadas, Func<string, bool> ok, bool preferirNegativo = false)
    {
        int? melhor = null;
        var melhorNota = 0.0;
        for (var i = 0; i < t.Colunas.Length; i++)
        {
            if (usadas.Contains(i) || t.Linhas.Count == 0) continue;
            var nota = t.Linhas.Count(l => ok(l[i])) / (double)t.Linhas.Count;
            if (preferirNegativo && t.Linhas.Any(l => TryParseValor(l[i], out var v) && v < 0)) nota += 0.25;
            if (nota > melhorNota) { melhorNota = nota; melhor = i; }
        }
        return melhorNota >= 0.6 ? melhor : null;
    }

    // Descrição pelo conteúdo: a coluna livre com mais texto (não número, não data).
    private static int? ColunaDeTexto(TabelaCsv t, HashSet<int> usadas)
    {
        int? melhor = null;
        var melhorMedia = 0.0;
        for (var i = 0; i < t.Colunas.Length; i++)
        {
            if (usadas.Contains(i)) continue;
            var textos = t.Linhas.Select(l => l[i]).Where(c => !string.IsNullOrWhiteSpace(c) && !TryParseValor(c, out _) && !TryParseData(c, out _)).ToList();
            if (textos.Count < t.Linhas.Count * 0.5) continue;
            var media = textos.Average(c => c.Length);
            if (media > melhorMedia) { melhorMedia = media; melhor = i; }
        }
        return melhor;
    }

    // A descrição, com o tipo na frente quando o banco manda numa coluna à parte ("Pix enviado" + "Fulano"). Tipo que
    // já está no começo da descrição não repete.
    private static string ComTipo(string[] l, MapeamentoCsv m)
    {
        var descricao = l[m.Descricao].Trim();
        if (m.Tipo is not { } ct) return descricao;
        var tipo = l[ct].Trim();
        if (tipo.Length == 0 || descricao.StartsWith(tipo, StringComparison.OrdinalIgnoreCase)) return descricao;
        return descricao.Length == 0 ? tipo : $"{tipo} {descricao}";
    }

    private static void ValidarMapeamento(MapeamentoCsv m, TabelaCsv t)
    {
        bool Ok(int? i) => i is null || (i >= 0 && i < t.Colunas.Length);
        if (!Ok(m.Data) || !Ok(m.Descricao) || !Ok(m.Valor) || !Ok(m.Entrada) || !Ok(m.Saida) || !Ok(m.Id) || !Ok(m.Tipo))
            throw new ArgumentException("Coluna fora do arquivo.");
        if (m.Valor is null && (m.Entrada is null || m.Saida is null))
            throw new ArgumentException("Diga a coluna do valor, ou as de entrada e de saída.");
        var principais = new[] { (int?)m.Data, m.Descricao, m.Valor, m.Entrada, m.Saida, m.Tipo }.Where(i => i.HasValue).ToList();
        if (principais.Distinct().Count() != principais.Count)
            throw new ArgumentException("Cada papel precisa de uma coluna diferente.");
    }

    /// <summary>
    /// Aplica o mapeamento. Pula linha sem data, sem valor, com valor zero e as de saldo ("Saldo anterior",
    /// "Saldo do dia" — saldo não é lançamento). O formato da data é o que lê mais linhas da coluna (dia/mês
    /// antes de mês/dia no empate). Id só vira FITID se for único no arquivo (número de documento que se
    /// repete faria lançamentos diferentes parecerem o mesmo).
    /// </summary>
    public List<LinhaExtrato> Aplicar(TabelaCsv t, MapeamentoCsv m) => Aplicar(t, m, contarSaldo: false);

    private static List<LinhaExtrato> Aplicar(TabelaCsv t, MapeamentoCsv m, bool contarSaldo)
    {
        var formato = MelhorFormatoData(t.Linhas.Select(l => l[m.Data]));
        var ids = m.Id is { } colId ? t.Linhas.Select(l => l[colId].Trim()).Where(x => x.Length > 0).ToList() : new();
        var usarId = m.Id is not null && ids.Count > 0 && ids.Distinct().Count() == ids.Count;

        var linhas = new List<LinhaExtrato>();
        foreach (var l in t.Linhas)
        {
            if (!TryParseData(l[m.Data], out var data, formato)) continue;
            var descricao = ComTipo(l, m);
            if (EhSaldo(descricao))
            {
                // Na sugestão, linha de saldo conta como lida (senão um extrato com saldo diário nunca é confiável).
                if (contarSaldo) linhas.Add(new LinhaExtrato(data, descricao, 0, null));
                continue;
            }

            decimal valor;
            if (m.Valor is { } cv)
            {
                if (!TryParseValor(l[cv], out valor)) continue;
            }
            else
            {
                var temEntrada = TryParseValor(l[m.Entrada!.Value], out var e) && e != 0;
                var temSaida = TryParseValor(l[m.Saida!.Value], out var s) && s != 0;
                if (!temEntrada && !temSaida) continue;
                valor = temEntrada ? Math.Abs(e) : -Math.Abs(s);
            }
            if (valor == 0) continue;
            if (m.InverterSinal) valor = -valor;

            linhas.Add(new LinhaExtrato(data, Cortar(string.IsNullOrWhiteSpace(descricao) ? "Sem descrição" : descricao, DescricaoMax)!,
                valor, usarId ? Cortar(l[m.Id!.Value].Trim(), FitIdMax) : null));
        }
        return linhas;
    }

    private static bool EhSaldo(string descricao)
    {
        var d = Normalizar(descricao);
        return d.StartsWith("saldo") || d == "s a l d o";
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

    private static readonly string[] FormatosData =
        { "dd/MM/yyyy", "dd/MM/yy", "yyyy-MM-dd", "dd-MM-yyyy", "dd.MM.yyyy", "yyyy/MM/dd", "MM/dd/yyyy" };

    private static string? MelhorFormatoData(IEnumerable<string> celulas)
    {
        var lista = celulas.ToList();
        string? melhor = null;
        var melhorConta = 0;
        foreach (var f in FormatosData) // dia/mês vem antes: ganha no empate
        {
            var conta = lista.Count(c => TryParseData(c, out _, f));
            if (conta > melhorConta) { melhorConta = conta; melhor = f; }
        }
        return melhor;
    }

    /// <summary>Data numa célula: só a parte do dia ("10/05/2026 14:32" e "2026-05-10T14:32:00" valem).</summary>
    private static bool TryParseData(string raw, out DateTime data, string? formato = null)
    {
        var s = raw.Trim();
        var corte = s.IndexOfAny(new[] { ' ', 'T' });
        if (corte >= 8) s = s[..corte];
        return formato is null
            ? DateTime.TryParseExact(s, FormatosData, CultureInfo.InvariantCulture, DateTimeStyles.None, out data)
            : DateTime.TryParseExact(s, formato, CultureInfo.InvariantCulture, DateTimeStyles.None, out data);
    }

    /// <summary>
    /// Valor em formato BR ou internacional: "R$ -1.234,56", "1,234.56", "-50.00", "150,00 D" (débito),
    /// "150,00 C", "150,00-". Vazio não é valor.
    /// </summary>
    private static bool TryParseValor(string raw, out decimal valor)
    {
        valor = 0m;
        var limpo = raw.Trim()
            .Replace("R$", "", StringComparison.OrdinalIgnoreCase)
            .Replace(" ", "")
            .Replace(" ", "");
        if (limpo.Length == 0)
            return false;

        var negativo = false;
        if (limpo.EndsWith('D') || limpo.EndsWith('d')) { negativo = true; limpo = limpo[..^1]; }
        else if (limpo.EndsWith('C') || limpo.EndsWith('c')) limpo = limpo[..^1];
        if (limpo.EndsWith('-')) { negativo = true; limpo = limpo[..^1]; }
        if (limpo.StartsWith('(') && limpo.EndsWith(')')) { negativo = true; limpo = limpo[1..^1]; }
        if (limpo.Length == 0 || !Regex.IsMatch(limpo, @"^[+-]?[\d.,]+$"))
            return false;

        var virgula = limpo.LastIndexOf(',');
        var ponto = limpo.LastIndexOf('.');
        if (virgula >= 0 && ponto >= 0)
            // O separador que vem por último é o decimal; o outro é milhar.
            limpo = virgula > ponto ? limpo.Replace(".", "").Replace(',', '.') : limpo.Replace(",", "");
        else if (virgula >= 0)
            limpo = limpo.Replace(',', '.');

        if (!decimal.TryParse(limpo, NumberStyles.Number, CultureInfo.InvariantCulture, out valor))
            return false;
        if (negativo) valor = -Math.Abs(valor);
        return true;
    }

    /// <summary>Minúsculo, sem acento, espaços simples — pra comparar nome de coluna e descrição.</summary>
    private static string Normalizar(string s)
    {
        var decomposto = s.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in decomposto)
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
        return Regex.Replace(sb.ToString(), @"\s+", " ");
    }

    private static string? Cortar(string? s, int max) => s is null ? null : s.Length <= max ? s : s[..max];
}

using System.Text;
using System.Text.RegularExpressions;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Quem está do outro lado de um lançamento do extrato (2026-11-03, pra categorizar por grupo): o mesmo
/// estabelecimento ou a mesma pessoa vira UMA chave, e a categoria escolhida pra ela vale pras próximas
/// (<c>RegraCategoria</c>). Sem "se for o banco X": tira o que todo extrato põe em volta do nome (o tipo do
/// movimento antes, documento, banco, agência e conta depois) e deixa o nome.
/// </summary>
public static class Estabelecimento
{
    public const int ChaveMaxLength = 120;

    private static readonly Regex Documento = new(@"\b\d{2}\.\d{3}\.\d{3}(/\d{4}-\d{2})?\b|\b\d{6,}\b", RegexOptions.Compiled);
    private static readonly Regex SufixoEmpresa = new(@"\b(ltda|s\s?a|me|eireli|epp)\b\.?\s*$", RegexOptions.Compiled);
    private static readonly Regex Espacos = new(@"\s+", RegexOptions.Compiled);

    // ── Ler a descrição (2026-11-21: regras genéricas, nenhuma frase de banco) ──────────────────────────────
    // Todo banco escreve em volta do nome as mesmas COISAS, cada um com as suas palavras: o tipo do movimento antes
    // (Pix, TED, compra no débito, pagto boleto) e, antes ou depois, data, hora, CPF, CNPJ, agência, conta e códigos.
    // A descrição vira palavras; as do começo que são movimento viram o TIPO, as que são número/documento/data viram
    // RESTO, e o nome é o trecho entre elas. Texto entre aspas (o Inter põe o nome ali) é lido por dentro.

    // Palavras de movimento (sem acento, minúsculas). Só contam ANTES do nome: dentro dele são parte do nome ("Ponto
    // de Venda", "Uber do Brasil").
    private static readonly HashSet<string> PalavrasMovimento = new(StringComparer.Ordinal)
    {
        "pix", "ted", "doc", "tef", "transf", "transferencia", "transferencias", "trans", "enviada", "enviado", "envio", "env",
        "recebida", "recebido", "recebimento", "receb", "rec", "compra", "compras", "debito", "deb", "credito", "cred",
        "cartao", "card", "pagto", "pgto", "pag", "pagamento", "pagamentos", "pgt", "rem", "dest", "remetente",
        "destinatario", "favorecido", "boleto", "boletos", "efetuado", "efetuada", "realizado", "realizada", "via", "nupay",
        "automatico", "aut", "elo", "visa", "master", "mastercard", "maestro", "eletron", "electron", "internet", "mobile",
        "app", "qr", "qrcode", "estorno", "p/", "no", "na", "de", "do", "da", "pelo", "pela", "para", "p", "a", "em", "int",
    };
    // Palavras que, depois do nome, dizem que dali pra frente é banco, agência ou documento.
    private static readonly HashSet<string> PalavrasDepois = new(StringComparer.Ordinal)
    {
        "cpf", "cnpj", "ag", "agencia", "conta", "cc", "c/c", "banco", "bco", "docto", "nsu", "autenticacao", "cp",
    };
    // Instituição logo depois de um " - " (o Nubank põe "Fulano - NU PAGAMENTOS - IP (0260)"): o nome acabou.
    private static readonly HashSet<string> Instituicao = new(StringComparer.Ordinal) { "banco", "bco", "nu", "instituicao", "cooperativa" };
    // Nome que sozinho não diz quem é: aí o nome é a descrição inteira ("Pagamento de fatura", "Tarifa").
    private static readonly HashSet<string> NomeGenerico = new(StringComparer.Ordinal)
    {
        "fatura", "tarifa", "tarifas", "saque", "rendimento", "rendimentos", "juros", "iof", "anuidade", "cesta", "mensalidade",
        // Termos da Febraban (2024) pra saque e depósito.
        "troco", "dep", "deposito",
    };
    private static readonly Regex Data = new(@"^\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?$", RegexOptions.Compiled);
    private static readonly Regex Hora = new(@"^\d{1,2}[:h]\d{2}(:\d{2})?$", RegexOptions.Compiled);
    // CPF (com ou sem máscara: "•••.321.654-••", "***.123.456-**", "123.456.789-01") e CNPJ.
    private static readonly Regex Cpf = new(@"^[•*x\d]{3}\.[•*\d]{3}\.[•*\d]{3}-[•*\d]{2}$", RegexOptions.Compiled);
    private static readonly Regex Cnpj = new(@"^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$", RegexOptions.Compiled);
    private static readonly Regex Mascara = new(@"^[•*]{2,}", RegexOptions.Compiled);
    // Número de conta, código, protocolo: só algarismos (e . - / entre eles), com parênteses ou não.
    private static readonly Regex Numero = new(@"^\(?\d[\d.\-/]*\)?$", RegexOptions.Compiled);
    // A palavra: aspas soltas, ":" no começo e "12345-" grudado num nome ("18236120-Fulano") viram pedaços próprios.
    private static readonly Regex Palavra = new(@"[""“”]|(?<![^\s""“”]):|\d+-(?=\p{L})|[^\s""“”]+?(?=:(?!\d)|[""“”]|\s|$)|[^\s""“”]+", RegexOptions.Compiled);

    /// <summary>Um pedaço da descrição como o banco escreveu: <c>tipo</c> (o movimento), <c>nome</c> ou <c>resto</c>.
    /// Os pedaços juntos dão a descrição de volta, letra por letra (espaços inclusos).</summary>
    public sealed record Pedaco(string Texto, string Parte);

    /// <summary>A descrição lida: os pedaços, o nome, o tipo do movimento ("Pix", "Débito"…) e o documento (CPF sempre
    /// mascarado; CNPJ como veio, é de empresa).</summary>
    public sealed record Leitura(IReadOnlyList<Pedaco> Pedacos, string Nome, string? Tipo, string? Documento);

    private enum P { Tipo, Nome, Resto }
    private sealed record Tok(int Ini, int Fim, string Texto, string N);

    private static string Norm(string t) => Simples(t).Trim('"', '“', '”', ':', ',', ';', '.', '(', ')');
    private static bool EhSeparador(Tok t) => t.Texto.All(c => !char.IsLetterOrDigit(c) && c != '•');
    private static bool EhDoc(Tok t) => Cpf.IsMatch(t.Texto.TrimEnd(',', ';')) || Cnpj.IsMatch(t.Texto.TrimEnd(',', ';', '.')) || Mascara.IsMatch(t.Texto);
    private static bool EhResto(Tok t)
    {
        var s = t.Texto.TrimEnd(',', ';', ':');
        if (Data.IsMatch(s) || Hora.IsMatch(s) || EhDoc(t) || PalavrasDepois.Contains(t.N)) return true;
        // Número de 5 algarismos ou mais é conta/código/protocolo; "(0077)" é código de banco.
        return Numero.IsMatch(s) && (s.Count(char.IsDigit) >= 5 || s.StartsWith('('));
    }
    // Antes do nome, número curto também é código (agência "0412", banco "341"); "99" fica (é nome: o app 99).
    private static bool EhRestoAntes(Tok t) => EhResto(t) || (Numero.IsMatch(t.Texto.TrimEnd(':', '-')) && t.Texto.Count(char.IsDigit) >= 3);

    /// <summary>Lê a descrição: o que é o tipo do movimento, o nome e o resto (regras genéricas, ver acima).</summary>
    public static Leitura Ler(string descricao, IReadOnlyList<PadraoNome>? padroes = null)
    {
        var texto = Espacos.Replace(descricao.Trim(), " ");
        var toks = Palavra.Matches(texto).Select(m => new Tok(m.Index, m.Index + m.Length, m.Value, Norm(m.Value))).ToList();
        var partes = new P[toks.Count];

        // O que a pessoa ensinou vale antes das regras (2026-11-21).
        if (padroes is { Count: > 0 } && Ensinado(toks, padroes) is var (eIni, eFim) && eIni >= 0)
        {
            for (var i = 0; i < toks.Count; i++)
                partes[i] = i >= eIni && i <= eFim ? P.Nome : i < eIni && PalavrasMovimento.Contains(toks[i].N) ? P.Tipo : P.Resto;
            var nomeEnsinado = texto[toks[eIni].Ini..toks[eFim].Fim].Trim(' ', '-', '.', '"', '“', '”');
            if (nomeEnsinado.Length > 0)
                return new Leitura(Pedacos(texto, toks, partes), nomeEnsinado, TipoDoMovimento(toks, partes), DocumentoDe(toks, partes));
            partes = new P[toks.Count];
        }

        // Entre aspas é onde está o nome (Inter); fora delas, o começo é o tipo e o fim é resto.
        var aspas = toks.Select((t, i) => (t, i)).Where(x => x.t.Texto is "\"" or "“" or "”").Select(x => x.i).ToList();
        int de = 0, ate = toks.Count;
        if (aspas.Count >= 2 && aspas[1] > aspas[0] + 1)
        {
            // Antes das aspas, só as primeiras palavras de movimento são o tipo ("Deb Pag Seguro Pix:" é Pagamento,
            // não Pix: o "Pix" ali já é o nome do produto).
            var noTipo = true;
            for (var i = 0; i <= aspas[0]; i++)
            {
                if (!EhSeparador(toks[i]) && !PalavrasMovimento.Contains(toks[i].N)) noTipo = false;
                partes[i] = noTipo && PalavrasMovimento.Contains(toks[i].N) ? P.Tipo : P.Resto;
            }
            for (var i = aspas[1]; i < toks.Count; i++) partes[i] = P.Resto;
            de = aspas[0] + 1; ate = aspas[1];
        }

        int ini = -1, fim = -1;
        var fase = 0; // 0 antes do nome, 1 no nome, 2 depois
        for (var i = de; i < ate; i++)
        {
            var t = toks[i];
            if (fase == 0)
            {
                if (EhSeparador(t) || EhRestoAntes(t)) partes[i] = P.Resto;
                else if (PalavrasMovimento.Contains(t.N)) partes[i] = P.Tipo;
                else { fase = 1; ini = i; fim = i; partes[i] = P.Nome; }
                continue;
            }
            if (fase == 1)
            {
                var proxima = toks.Skip(i + 1).Take(ate - i - 1).FirstOrDefault(x => !EhSeparador(x));
                var acabou = EhResto(t)
                    || t.Texto == ":"
                    || (EhSeparador(t) && proxima is not null && (EhResto(proxima) || Instituicao.Contains(proxima.N)));
                if (acabou) { fase = 2; partes[i] = P.Resto; continue; }
                partes[i] = P.Nome;
                if (!EhSeparador(t)) fim = i;
                continue;
            }
            partes[i] = P.Resto;
        }
        // Pontuação no fim do nome ("LTDA ." / "LTDA -") fica de fora.
        if (ini >= 0) for (var i = fim + 1; i < ate && partes[i] == P.Nome; i++) partes[i] = P.Resto;

        // Sem nome, ou um nome que começa por uma palavra que não diz quem ("fatura", "saque din cartao", "dep cheque"):
        // o nome é a descrição inteira.
        var generico = ini >= 0 && NomeGenerico.Contains(toks[ini].N);
        if (ini < 0 || generico)
        {
            for (var i = 0; i < toks.Count; i++) partes[i] = P.Nome;
            ini = 0; fim = toks.Count - 1;
        }

        var nome = toks.Count == 0 ? texto : texto[toks[ini].Ini..toks[fim].Fim].Trim(' ', '-', '.', '"', '“', '”');
        if (nome.Length == 0) nome = texto;
        return new Leitura(Pedacos(texto, toks, partes), nome, TipoDoMovimento(toks, partes), DocumentoDe(toks, partes));
    }

    /// <summary>
    /// O nome como aparece pra pessoa ("MP *PHLANCHESLTDA", "Fulana de Tal"). Sem nome reconhecível, a própria
    /// descrição.
    /// </summary>
    public static string Nome(string descricao, IReadOnlyList<PadraoNome>? padroes = null) => Ler(descricao, padroes).Nome;

    // ── Ensinar o nome (2026-11-21) ──────────────────────────────────────────────────────────────────────────
    // A pessoa marca na descrição as palavras que são o nome; o app guarda a FORMA do que vem antes e do que vem logo
    // depois (palavras de movimento como estão; número, data, hora, documento e outras palavras viram uma classe), nunca
    // as palavras do nome nem nenhum dado: "TED RECEBIDA # # # [nome] DOC". Descrição com o mesmo começo usa o padrão.

    /// <summary>O padrão ensinado: a forma das palavras antes do nome e a forma da primeira depois dele (null = vai até
    /// o fim).</summary>
    public sealed record PadraoNome(string[] Antes, string? Depois);

    public const int PadraoMaxLength = 300;

    // Separador como está; data D, hora H, documento DOC, número #; palavra de movimento ou de banco/conta como está;
    // qualquer outra palavra, W (sem guardar a palavra).
    private static string Forma(Tok t)
    {
        var s = t.Texto.TrimEnd(',', ';', ':');
        if (EhSeparador(t)) return t.Texto;
        if (Data.IsMatch(s)) return "D";
        if (Hora.IsMatch(s)) return "H";
        if (EhDoc(t)) return "DOC";
        if (Numero.IsMatch(s)) return "#";
        if (PalavrasMovimento.Contains(t.N) || PalavrasDepois.Contains(t.N)) return t.N;
        return "W";
    }

    private static (int Ini, int Fim) Ensinado(List<Tok> toks, IReadOnlyList<PadraoNome> padroes)
    {
        var formas = toks.Select(Forma).ToList();
        // O padrão com o começo mais comprido que casa vence (o mais específico).
        foreach (var p in padroes.OrderByDescending(p => p.Antes.Length))
        {
            if (p.Antes.Length == 0 || p.Antes.Length >= toks.Count) continue;
            if (!p.Antes.SequenceEqual(formas.Take(p.Antes.Length))) continue;
            var ini = p.Antes.Length;
            var fim = toks.Count - 1;
            if (p.Depois is { } d)
            {
                var corte = formas.FindIndex(ini + 1, f => f == d);
                if (corte < 0) continue;
                fim = corte - 1;
            }
            while (fim > ini && EhSeparador(toks[fim])) fim--;
            if (EhSeparador(toks[ini])) continue;
            return (ini, fim);
        }
        return (-1, -1);
    }

    /// <summary>
    /// O padrão de uma descrição em que a pessoa disse qual é o nome (as palavras dele, seguidas, como estão na
    /// descrição). Null quando o nome não está na descrição, começa nela (aí não há o que guardar: o começo é o nome)
    /// ou o padrão passaria do tamanho.
    /// </summary>
    public static PadraoNome? PadraoDe(string descricao, string nome)
    {
        var texto = Espacos.Replace(descricao.Trim(), " ");
        var toks = Palavra.Matches(texto).Select(m => new Tok(m.Index, m.Index + m.Length, m.Value, Norm(m.Value))).ToList();
        var alvo = Palavra.Matches(Espacos.Replace(nome.Trim(), " ")).Select(m => m.Value).ToList();
        if (alvo.Count == 0) return null;
        for (var ini = 1; ini + alvo.Count <= toks.Count; ini++)
        {
            if (!alvo.SequenceEqual(toks.Skip(ini).Take(alvo.Count).Select(t => t.Texto))) continue;
            var antes = toks.Take(ini).Select(Forma).ToArray();
            var depois = ini + alvo.Count < toks.Count ? Forma(toks[ini + alvo.Count]) : null;
            if (string.Join(' ', antes).Length + (depois?.Length ?? 0) > PadraoMaxLength) return null;
            return new PadraoNome(antes, depois);
        }
        return null;
    }

    // Junta palavras vizinhas da mesma parte num pedaço; o espaço entre duas partes fica com a da esquerda.
    private static List<Pedaco> Pedacos(string texto, List<Tok> toks, P[] partes)
    {
        var lista = new List<Pedaco>();
        if (toks.Count == 0) return texto.Length == 0 ? lista : [new Pedaco(texto, "nome")];
        var comeco = 0;
        for (var i = 0; i < toks.Count; i++)
        {
            var ultimo = i == toks.Count - 1 || partes[i + 1] != partes[i];
            if (!ultimo) continue;
            var fim = i == toks.Count - 1 ? texto.Length : toks[i + 1].Ini;
            lista.Add(new Pedaco(texto[comeco..fim], partes[i].ToString().ToLowerInvariant()));
            comeco = fim;
        }
        return lista;
    }

    // O tipo pelas palavras de movimento (as do tipo; dentro do nome não contam). Ordem: o mais específico primeiro.
    private static string? TipoDoMovimento(List<Tok> toks, P[] partes)
    {
        var p = toks.Where((t, i) => partes[i] == P.Tipo).Select(t => t.N).ToHashSet();
        if (p.Contains("pix")) return "Pix";
        if (p.Contains("boleto") || p.Contains("boletos")) return "Boleto";
        if (p.Contains("automatico")) return "Débito automático";
        if (p.Overlaps(["ted", "doc", "tef", "transf", "transferencia", "transferencias", "trans"])) return "Transferência";
        if (p.Overlaps(["credito", "cred"])) return "Crédito";
        if (p.Overlaps(["pagto", "pgto", "pag", "pagamento", "pagamentos", "pgt"])) return "Pagamento";
        if (p.Overlaps(["debito", "deb", "compra", "compras", "cartao"])) return "Débito";
        if (p.Contains("estorno")) return "Estorno";
        return null;
    }

    // O primeiro CPF ou CNPJ fora do nome. CPF sai só com os 6 do meio (como os bancos mostram); CNPJ como veio.
    private static string? DocumentoDe(List<Tok> toks, P[] partes)
    {
        for (var i = 0; i < toks.Count; i++)
        {
            if (partes[i] == P.Nome) continue;
            var s = toks[i].Texto.TrimEnd(',', ';', '.');
            if (Cnpj.IsMatch(s)) return "CNPJ " + s;
            if (Cpf.IsMatch(s)) return $"CPF •••.{Mascarar(s[4..7])}.{Mascarar(s[8..11])}-••";
        }
        return null;
    }
    private static string Mascarar(string s) => new(s.Select(c => char.IsDigit(c) ? c : '•').ToArray());

    /// <summary>
    /// A chave do grupo: o nome em minúsculas, sem acento, sem documento, sem "LTDA" no fim e sem pontuação,
    /// com o tipo na frente (Pix que você mandou pra Ana e Pix que a Ana mandou são grupos diferentes).
    /// </summary>
    public static string Chave(string descricao, bool ehDespesa, IReadOnlyList<PadraoNome>? padroes = null)
    {
        var s = Simples(Nome(descricao, padroes));
        s = Documento.Replace(s, " ");
        s = Regex.Replace(s, @"[^a-z0-9 ]", " ");
        s = Espacos.Replace(s, " ").Trim();
        s = SufixoEmpresa.Replace(s, "").Trim();
        if (s.Length == 0) s = Espacos.Replace(Regex.Replace(Simples(descricao), @"[^a-z0-9 ]", " "), " ").Trim();
        var chave = (ehDespesa ? "d:" : "r:") + s;
        return chave.Length > ChaveMaxLength ? chave[..ChaveMaxLength] : chave;
    }

    // ── O que é óbvio, sem a pessoa ter dito ──────────────────────────────────────────────────────────────────
    // Palavras do nome → categoria PADRÃO (CategoriaSeeder). Só sugestão: a pessoa troca e a troca vira regra.
    // Lista curta e de propósito óbvia; nome de pessoa nunca entra aqui.
    private static readonly (Regex Palavras, bool Despesa, string Categoria)[] Conhecidos =
    {
        // A ordem importa: a primeira que casa vence ("mercado livre" é compra antes de "mercado" ser comida).
        (Palavras(@"netflix|spotify|youtube|google|apple|amazon prime|prime video|disney|hbo|globoplay|deezer|chatgpt|openai|anthropic|microsoft|icloud|dropbox|canva"), true, "Serviços digitais"),
        (Palavras(@"amazon|mercado livre|mercadolivre|shopee|aliexpress|magalu|magazine luiza|americanas|shein|renner|riachuelo|zara|variedades|lojas?"), true, "Compras"),
        (Palavras(@"seguro|seguros|porto seguro"), true, "Seguros"),
        (Palavras(@"ifood|ifd|99food|rappi|ze delivery|delivery|mc ?donalds|burger king|subway|outback|habibs|giraffas"), true, "Alimentação"),
        // Comida e bebida pelo tipo do lugar (2026-11-04, ampliado com o extrato de 10 meses do Gustavo: o que é
        // genérico de verdade, nunca nome de pessoa).
        (Palavras(@"supermercados?|mercado|mercearia|hortifruti|sacolao|quitanda|frutaria|acougue|casa de carne|peixaria|padaria|padoca|panificadora|confeitaria|doces|doceria|bolos|cakes?|lanches?|lanchonete|restaurante|churrascaria|pizza|pizzaria|hamburgueria|burgue(r|ria|sia)|sorvete(ria)?|gelateria|acai|acaiteria|pastel|pastelaria|salgados|esfiha|esfiharia|sushi|temaki|tapioca|tapiocaria|creperia|cantina|bistro|grill|espet(o|os|inho|aria)|feijoada|panini|marmita(ria)?|self ?service|rotisseria|cafeteria|bar|boteco|buteco|butiquim|choperia|chopp|cerveja(ria)?|beer|bebidas|distribuidora|emporio|garapa|caldo de cana|atacadao|assai|carrefour|super nosso|epa"), true, "Alimentação"),
        (Palavras(@"uber|99|99 tecnologia|cabify|posto|auto posto|combustive(l|is)|shell|ipiranga|petrobras|estacionamento|park|parking|zona azul|rotativo|allpark|estapar|sem parar|conectcar|veloe|pedagio|lava ?jato|lava ?rapido|borracharia|pneus|oficina|auto ?center|mecanica|localiza|movida|unidas|buser|clickbus|latam"), true, "Transporte"),
        (Palavras(@"drogaria|farmacia|drogasil|droga raia|araujo|pague menos|panvel|academia|fitness|smart ?fit|bodytech|bluefit|selfit|crossfit|pilates|yoga|clinica|laboratorio|odonto|dentista|hospital|unimed|otica|oticas|psicolog[ao]|terapia|fisioterapia|nutricionista"), true, "Saúde e bem-estar"),
        (Palavras(@"cinema|cinemark|ingresse|ingresso|ingressos|sympla|eventim|teatro|steam|playstation|xbox|nintendo|zig|zigpay|zig lab|parque|boliche|karaoke|tarot|tarolog[ao]"), true, "Lazer e entretenimento"),
        (Palavras(@"aluguel|condominio|cemig|copasa|sabesp|enel|energia|cimento|pre ?moldados?|materia(l|is) de construcao|madeireira|ferragens|eletrica|hidraulica|tintas|leroy|leroy merlin|telhanorte|serralheria|vidracaria|marcenaria|ultragaz|supergasbras"), true, "Moradia"),
        (Palavras(@"ipva|detran|iptu|darf|receita federal|prefeitura|estado de minas gerais|tarifa|anuidade|iof|inss|simples nacional|das simples"), true, "Impostos e taxas"),
        (Palavras(@"bet|bets|aposta|apostas|loteria|loterias|blaze|sportingbet|betano|bet365"), true, "Apostas e jogos"),
        (Palavras(@"escola|colegio|faculdade|universidade|curso|cursos|cursinho|aula|aulas|udemy|alura|coursera|duolingo|kumon|wizard|ccaa|fisk|cultura inglesa|livraria|lecione"), true, "Educação"),
        (Palavras(@"d4sign|dlocal|paypal|hotmart|kiwify|eduzz|github|vercel|hostinger|godaddy|registro br|cloudflare|aws|amazon web services|heroku|notion|figma|adobe|zoom|slack"), true, "Serviços digitais"),
        (Palavras(@"utilidades|bazar|papelaria|presentes|perfumaria|boticario|natura|avon|eudora|kalunga|decathlon|centauro|netshoes|nike|adidas|havaianas|c&a|marisa|pernambucanas|casas bahia|ponto frio|fast shop|kabum|pichau|terabyte"), true, "Compras"),
        // Pagar a fatura do cartão sem o cartão cadastrado: o dinheiro saiu, mas não é um gasto com nome. Com o cartão
        // cadastrado nem chega aqui (vira pagamento de fatura, sem categoria).
        (Palavras(@"pagamento de fatura|pagamento fatura|pgto fatura|pagamento recebido"), true, "Outros"),
        (Palavras(@"proventos|salario|pagamento de proventos|folha"), false, "Renda"),
        // Dinheiro que volta pra conta: não é renda.
        (Palavras(@"estorno|reembolso|cashback|devolucao|ajuste de compra"), false, "Dinheiro que volta"),
    };

    private static Regex Palavras(string alternativas) => new($@"(^| )({alternativas})( |$)", RegexOptions.Compiled);

    // Compra em loja: cartão de débito ou crédito ("Compra no débito - ", "Compra no crédito - ", estorno dessas).
    private static readonly Regex Compra = new(@"^(estorno\s*-\s*)?(ajuste de\s*)?compra\b", RegexOptions.Compiled);

    /// <summary>
    /// É compra em estabelecimento (cartão), e não Pix, TED, boleto ou débito automático? Só a categoria dada a uma
    /// COMPRA pode virar sugestão coletiva pros outros (2026-11-04): do outro lado de uma compra está uma loja; do outro
    /// lado de um Pix pode estar uma pessoa, e o nome dela é dado pessoal, nunca sai da conta de quem importou.
    /// </summary>
    public static bool EhCompra(string descricao) => Compra.IsMatch(Simples(descricao.Trim()));

    /// <summary>A categoria padrão óbvia pelo nome (só o nome da categoria; quem chama acha a da pessoa).</summary>
    public static string? CategoriaConhecida(string chave)
    {
        var despesa = chave.StartsWith("d:");
        var nome = chave.Length > 2 ? chave[2..] : "";
        foreach (var (palavras, ehDespesa, categoria) in Conhecidos)
            if (ehDespesa == despesa && palavras.IsMatch(nome))
                return categoria;
        return null;
    }

    // Minúsculas sem acento, sem Normalize/CultureInfo (a imagem de produção roda com globalização invariante).
    // Troca caractere por caractere: o tamanho não muda.
    internal static string Simples(string texto)
    {
        var sb = new StringBuilder(texto.Length);
        foreach (var c in texto.ToLowerInvariant())
            sb.Append(c switch
            {
                'á' or 'à' or 'â' or 'ã' or 'ä' => 'a',
                'é' or 'è' or 'ê' or 'ë' => 'e',
                'í' or 'ì' or 'î' or 'ï' => 'i',
                'ó' or 'ò' or 'ô' or 'õ' or 'ö' => 'o',
                'ú' or 'ù' or 'û' or 'ü' => 'u',
                'ç' => 'c',
                _ => c,
            });
        return sb.ToString();
    }
}

using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Fatura;
using ControleFinanceiro.Api.DTOs.Importacao;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>Issue #27 — orquestra a importação de extrato: parse, deduplicação,
/// sugestão de categoria (preview) e criação das transações (confirmar).</summary>
public class ImportacaoService
{
    private readonly AppDbContext _context;
    private readonly ExtratoImportService _extratoImport;
    private readonly TransacaoService _transacaoService;
    private readonly FaturaService _faturaService;

    public ImportacaoService(
        AppDbContext context,
        ExtratoImportService extratoImport,
        TransacaoService transacaoService)
    {
        _context = context;
        _extratoImport = extratoImport;
        _transacaoService = transacaoService;
        // Só escreve no mesmo contexto — instanciado aqui pra não mudar a assinatura do construtor.
        _faturaService = new FaturaService(context);
    }

    private record LinhaParaRegra(DateOnly Data, decimal Valor, TipoTransacao Tipo, string Descricao);

    // ── O que o sinal não diz (P2, 2026-11-01) ─────────────────────────────────────────────────────────────────
    // O extrato só traz entrada e saída. Três movimentos não são ganho nem gasto (partidas dobradas): dinheiro entre
    // contas suas (só muda de lugar), empréstimo (o capital vai e volta; os juros, o Empréstimo separa) e aplicação ou
    // resgate de investimento (o aplicado volta). Antes todos entravam como receita/despesa pelo sinal: os 3 Pix do
    // Gustavo pra ele mesmo viravam R$ 5.454 de "renda".

    public enum NaturezaExtrato { Comum, EntreSuasContas, Emprestimo, Investimento }

    private static readonly Regex PalavraEmprestimo = new(@"\bemprestimo\b", RegexOptions.Compiled);
    private static readonly Regex PalavraTransferencia = new(@"\b(pix|ted|doc|transferencia)\b", RegexOptions.Compiled);
    private static readonly Regex PalavraInvestimento =
        new(@"\b(rdb|cdb|lci|lca|tesouro|caixinha|aplicacao|resgate|investimento)\b", RegexOptions.Compiled);

    /// <summary>A outra perna de uma transferência entre suas contas fica até estes dias de distância.</summary>
    public const int DiasDoPar = 5;

    /// <summary>Agência e número de uma OUTRA conta da pessoa (pra reconhecer a transferência pelo que o banco escreve).</summary>
    public sealed record ContaSua(string? Agencia, string? Numero);

    private static readonly Regex Numeros = new(@"\d[\d.\-/]*\d|\d", RegexOptions.Compiled);

    /// <summary>
    /// A natureza pela descrição. Empréstimo: a palavra "empréstimo". Entre suas contas: Pix, TED ou transferência com o
    /// nome do titular (todas as partes do nome com 3+ letras, e pelo menos duas: "GUSTAVO NUNES PONTES") ou com o
    /// número de uma outra conta da pessoa (e a agência, quando ela guardou): "Swile ... Agência: 1 Conta: 12345-6".
    /// Investimento: RDB, CDB, caixinha, aplicação, resgate, Tesouro…
    /// </summary>
    public static NaturezaExtrato NaturezaDaLinha(string descricao, string? nomeDoTitular, IReadOnlyCollection<ContaSua>? outrasContas = null)
    {
        var d = Simples(descricao);
        if (PalavraEmprestimo.IsMatch(d)) return NaturezaExtrato.Emprestimo;
        var partes = Simples(nomeDoTitular ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries).Where(p => p.Length >= 3).ToList();
        if (PalavraTransferencia.IsMatch(d)
            && ((partes.Count >= 2 && partes.All(d.Contains)) || CitaUmaContaSua(descricao, outrasContas)))
            return NaturezaExtrato.EntreSuasContas;
        if (PalavraInvestimento.IsMatch(d)) return NaturezaExtrato.Investimento;
        return NaturezaExtrato.Comum;
    }

    // O número da conta (4+ dígitos, sem zero à esquerda, com ou sem o dígito separado) aparece inteiro na descrição;
    // com agência guardada, ela também. Número curto não conta: "3" casaria com qualquer coisa.
    private static bool CitaUmaContaSua(string descricao, IReadOnlyCollection<ContaSua>? contas)
    {
        if (contas is null || contas.Count == 0) return false;
        static string SoDigitos(string? s) => new string((s ?? "").Where(char.IsAsciiDigit).ToArray()).TrimStart('0');
        var numeros = Numeros.Matches(descricao).Select(m => SoDigitos(m.Value)).Where(n => n.Length > 0).ToHashSet();
        foreach (var conta in contas)
        {
            var numero = SoDigitos(conta.Numero);
            if (numero.Length < 4 || !numeros.Contains(numero)) continue;
            var agencia = SoDigitos(conta.Agencia);
            if (agencia.Length > 0 && !numeros.Contains(agencia)) continue;
            return true;
        }
        return false;
    }

    private async Task<List<ContaSua>> OutrasContasAsync(Guid usuarioId, Guid? contaId) =>
        await _context.Contas.AsNoTracking()
            .Where(c => c.UsuarioIdProprietario == usuarioId && c.Id != contaId && c.Tipo != TipoConta.Caixinha && c.NumeroConta != null)
            .Select(c => new ContaSua(c.Agencia, c.NumeroConta))
            .ToListAsync();

    private static string? NaturezaParaTela(NaturezaExtrato n) => n switch
    {
        NaturezaExtrato.EntreSuasContas => "entre-contas",
        NaturezaExtrato.Emprestimo => "emprestimo",
        NaturezaExtrato.Investimento => "investimento",
        _ => null,
    };

    // Minúsculas sem acento, sem Normalize/CultureInfo (a imagem de produção roda com globalização invariante).
    private static string Simples(string texto)
    {
        var sb = new StringBuilder(texto.Length);
        foreach (var c in texto.ToLowerInvariant())
            sb.Append(c switch
            {
                'á' or 'à' or 'â' or 'ã' or 'ä' or 'Á' or 'À' or 'Â' or 'Ã' or 'Ä' => 'a',
                'é' or 'è' or 'ê' or 'ë' or 'É' or 'È' or 'Ê' or 'Ë' => 'e',
                'í' or 'ì' or 'î' or 'ï' or 'Í' or 'Ì' or 'Î' or 'Ï' => 'i',
                'ó' or 'ò' or 'ô' or 'õ' or 'ö' or 'Ó' or 'Ò' or 'Ô' or 'Õ' or 'Ö' => 'o',
                'ú' or 'ù' or 'û' or 'ü' or 'Ú' or 'Ù' or 'Û' or 'Ü' => 'u',
                'ç' or 'Ç' => 'c',
                _ => c,
            });
        return sb.ToString();
    }

    private Task<string?> NomeDoTitularAsync(Guid usuarioId) =>
        _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => (string?)u.Nome).FirstOrDefaultAsync();

    private sealed record ParCandidato(Guid Id, string ContaNome, DateOnly Data, decimal Valor, TipoTransacao Tipo);

    /// <summary>
    /// A outra perna de cada linha "entre suas contas": o mesmo valor, com o sinal oposto, em outra conta sua (não
    /// caixinha), até <see cref="DiasDoPar"/> dias de distância; a mais perto vence e cada lançamento junta com uma linha
    /// só. É como os apps de finanças acham transferência (valor + sinal + data, com a descrição desempatando). Sem par:
    /// a outra conta não está no app, e a linha entra como transferência solta (fora do resultado do mesmo jeito).
    /// </summary>
    private async Task<Dictionary<int, ParCandidato>> ParesEntreContasAsync(
        Guid contaId, Guid usuarioId, IReadOnlyList<LinhaParaRegra> linhas, IReadOnlyList<NaturezaExtrato> naturezas)
    {
        var resultado = new Dictionary<int, ParCandidato>();
        var indices = Enumerable.Range(0, linhas.Count).Where(i => naturezas[i] == NaturezaExtrato.EntreSuasContas).ToList();
        if (indices.Count == 0) return resultado;

        var de = indices.Min(i => linhas[i].Data).AddDays(-DiasDoPar);
        var ate = indices.Max(i => linhas[i].Data).AddDays(DiasDoPar);
        var valores = indices.Select(i => linhas[i].Valor).Distinct().ToList();
        var candidatos = await _context.Transacoes.AsNoTracking()
            .Where(t => t.ContaId != null && t.ContaId != contaId && t.Conta!.UsuarioIdProprietario == usuarioId
                        && t.Conta.Tipo != TipoConta.Caixinha && t.Ativo && t.StatusTransacao == StatusTransacao.Executado
                        && t.FamiliaId == null && !t.EhPagamentoFatura && !t.EhSaldoInicial
                        // Transferência SOLTA (entrou por extrato sem a outra conta no app) ainda espera o par; a que
                        // já tem Transferencia ligando as duas pernas, não.
                        && (!t.EhTransferencia || !_context.Transferencias.Any(tr => tr.TransacaoOrigemId == t.Id || tr.TransacaoDestinoId == t.Id))
                        && !t.EhAjusteReconciliacao && !t.EhPixNoCredito && !t.EhEmprestimo && !t.EhAcerto
                        && t.Data >= de && t.Data <= ate && valores.Contains(t.Valor))
            .Select(t => new ParCandidato(t.Id, t.Conta!.Nome, t.Data, t.Valor, t.Tipo))
            .ToListAsync();

        var usados = new HashSet<Guid>();
        foreach (var i in indices.OrderBy(i => linhas[i].Data).ThenBy(i => i))
        {
            var l = linhas[i];
            var par = candidatos
                .Where(c => !usados.Contains(c.Id) && c.Valor == l.Valor && c.Tipo != l.Tipo
                            && Math.Abs(c.Data.DayNumber - l.Data.DayNumber) <= DiasDoPar)
                .OrderBy(c => Math.Abs(c.Data.DayNumber - l.Data.DayNumber))
                .FirstOrDefault();
            if (par is null) continue;
            usados.Add(par.Id);
            resultado[i] = par;
        }
        return resultado;
    }

    /// <summary>Lê o extrato e devolve a preview: linhas parseadas, deduplicadas
    /// e com sugestão de categoria. Nada é persistido.</summary>
    /// <summary>Operação no <see cref="RegistroIdempotencia"/> da confirmação.</summary>
    public const string OperacaoImportarExtrato = "ImportarExtrato";

    /// <summary>Teto de linhas por confirmação (um extrato de anos cabe; o arquivo já tem limite de 2 MB).</summary>
    public const int MaxLinhasPorConfirmacao = 5000;

    /// <summary>
    /// Lê o extrato e devolve a prévia (nada é salvo). No CSV, as colunas vêm do <paramref name="mapeamento"/>
    /// que a tela mandou; senão do que a pessoa já escolheu nessa conta pra esse cabeçalho; senão da sugestão.
    /// Sem confiança, volta <c>PrecisaMapear</c> com as colunas e a amostra pra tela perguntar.
    /// </summary>
    public async Task<PreviewImportacaoDto> PreviewAsync(
        Guid? contaId, Guid usuarioId, string nomeArquivo, string conteudo, MapeamentoCsvDto? mapeamento = null)
    {
        // Sem conta (2026-11-06: a pessoa escolhe a conta na prévia, não antes): a leitura é a mesma, só não dá pra dizer
        // o que já está no app, qual fatura o pagamento quita, com que conta a transferência junta, nem lembrar colunas.
        if (contaId is { } c0) await ExigirContaAsync(c0, usuarioId);

        var ehCsv = Path.GetExtension(nomeArquivo).Equals(".csv", StringComparison.OrdinalIgnoreCase);
        ExtratoImportService.TabelaCsv? tabela = ehCsv ? _extratoImport.LerTabela(conteudo) : null;
        var mapa = mapeamento is null ? null : ParaMapa(mapeamento);
        var lembrado = false;
        if (tabela is not null && mapa is null)
        {
            var salvo = contaId is null ? null : await _context.ModelosImportacao.AsNoTracking()
                .FirstOrDefaultAsync(m => m.UsuarioId == usuarioId && m.ContaId == contaId && m.Assinatura == tabela.Assinatura);
            if (salvo is not null) { mapa = ParaMapa(salvo); lembrado = true; }
        }

        var leitura = _extratoImport.Ler(nomeArquivo, conteudo, mapa);
        var amostra = tabela?.Linhas.Take(5).Select(l => l.Select(c => c.Length > 80 ? c[..80] : c).ToArray()).ToList();
        PreviewImportacaoDto ComTabela(PreviewImportacaoDto p) => tabela is null ? p : p with
        {
            Formato = "csv",
            Colunas = tabela.Colunas,
            Amostra = amostra,
            Mapeamento = leitura.Mapeamento is { } m ? ParaDto(m) : null,
            Assinatura = tabela.Assinatura,
            MapeamentoLembrado = lembrado,
            Motivos = ExtratoImportService.Motivos(tabela, leitura.Mapeamento, mapeamento is not null ? "escolhido" : lembrado ? "lembrado" : null),
        };
        if (leitura.PrecisaMapear)
            return ComTabela(new PreviewImportacaoDto(new(), 0, 0, PrecisaMapear: true));

        return ComTabela(await MontarPreviaAsync(contaId, usuarioId, leitura.Linhas.Select(l => (l, (string?)null)).ToList()));
    }

    /// <summary>
    /// Teto de arquivos numa leitura: 24 extratos (dois anos mês a mês), cada um em OFX e CSV. A tela conta o que a
    /// pessoa vê (o par do mesmo mês é um cartão só) e trava em 24; aqui o teto é de arquivos, o dobro.
    /// </summary>
    public const int MaxArquivos = 48;
    /// <summary>Quantas importações a lista "Importações anteriores" mostra (as mais novas).</summary>
    public const int MaxAnteriores = 20;

    /// <summary>
    /// Vários arquivos da mesma conta numa prévia só (2026-11-03: a Nubank só exporta mês a mês). Cada arquivo é lido
    /// como se viesse sozinho (CSV com as colunas lembradas da conta ou reconhecidas); o que não deu pra ler fica de
    /// fora com o motivo em <c>Arquivos</c>, e o resto segue. O mesmo lançamento em dois arquivos (OFX e CSV do mesmo
    /// mês, períodos que se cruzam) entra uma vez: pelo código do banco, ou por data, valor e descrição sem ele.
    /// <b>Colunas (2026-11-04):</b> quando todos os CSV do envio têm o MESMO cabeçalho (os meses do mesmo banco), as
    /// colunas valem pra todos: a prévia volta com a tabela (colunas, amostra, o que foi usado) pra tela mostrar
    /// "Trocar colunas", o <paramref name="mapeamento"/> que a pessoa escolher lê todos e, se o app não reconheceu,
    /// volta <c>PrecisaMapear</c> pra tela perguntar (como no arquivo sozinho). CSV de cabeçalhos diferentes: cada um
    /// segue com as colunas lembradas ou reconhecidas, sem troca.
    /// </summary>
    public async Task<PreviewImportacaoDto> PreviewVariosAsync(
        Guid? contaId, Guid usuarioId, IReadOnlyList<(string Nome, string Conteudo)> arquivos, MapeamentoCsvDto? mapeamento = null)
    {
        if (contaId is { } c0) await ExigirContaAsync(c0, usuarioId);
        if (arquivos.Count == 0) throw new ArgumentException("Envie um arquivo de extrato.");
        if (arquivos.Count > MaxArquivos) throw new ArgumentException($"Envie no máximo {MaxArquivos} arquivos por vez.");

        // A tabela de cada CSV (o que não dá pra abrir como tabela fica sem, e o leitor diz o motivo mais abaixo).
        var tabelas = new Dictionary<string, ExtratoImportService.TabelaCsv>();
        foreach (var (nome, conteudo) in arquivos.Where(a => Path.GetExtension(a.Nome).Equals(".csv", StringComparison.OrdinalIgnoreCase)))
        {
            try { tabelas[nome] = _extratoImport.LerTabela(conteudo); }
            catch (Exception e) when (e is ArgumentException or FormatException or InvalidOperationException) { }
        }
        // Um cabeçalho só no envio = um banco só: a tabela de quem tem mais linhas é a que a tela mostra.
        var doLote = tabelas.Values.Select(t => t.Assinatura).Distinct().Count() == 1
            ? tabelas.Values.OrderByDescending(t => t.Linhas.Count).First()
            : null;
        var escolhido = doLote is not null && mapeamento is not null ? ParaMapa(mapeamento) : null;
        ExtratoImportService.MapeamentoCsv? usado = null;
        var lembrado = false;
        var faltaMapear = false;

        var lidas = new List<(ExtratoImportService.LinhaExtrato Linha, string? Arquivo)>();
        var resumo = new List<ArquivoLidoDto>();
        foreach (var (nome, conteudo) in arquivos)
        {
            // Arquivo vazio (0 bytes) no meio dos outros: só ele fica de fora (antes derrubava o envio inteiro).
            if (string.IsNullOrWhiteSpace(conteudo))
            {
                resumo.Add(new ArquivoLidoDto(nome, 0, "O arquivo está vazio."));
                continue;
            }
            ExtratoImportService.LeituraExtrato leitura;
            try
            {
                var mapa = tabelas.ContainsKey(nome) ? escolhido : null;
                if (mapa is null && tabelas.TryGetValue(nome, out var tabela))
                {
                    var salvo = contaId is null ? null : await _context.ModelosImportacao.AsNoTracking()
                        .FirstOrDefaultAsync(m => m.UsuarioId == usuarioId && m.ContaId == contaId && m.Assinatura == tabela.Assinatura);
                    if (salvo is not null) { mapa = ParaMapa(salvo); lembrado = true; }
                }
                leitura = _extratoImport.Ler(nome, conteudo, mapa);
            }
            // Arquivo vazio (o mês que ainda não teve nada), sem lançamento ou estragado: só ele fica de fora, com a
            // frase do leitor ("Nenhuma transação encontrada no arquivo OFX.").
            catch (ArgumentException e)
            {
                resumo.Add(new ArquivoLidoDto(nome, 0, e.Message));
                continue;
            }
            catch (Exception e) when (e is FormatException or InvalidOperationException)
            {
                resumo.Add(new ArquivoLidoDto(nome, 0, "Não deu pra ler esse arquivo."));
                continue;
            }
            if (leitura.PrecisaMapear)
            {
                faltaMapear = true;
                resumo.Add(new ArquivoLidoDto(nome, 0, doLote is not null
                    ? "Não reconhecemos as colunas."
                    : "Não reconhecemos as colunas. Importe esse arquivo sozinho pra escolher."));
                continue;
            }
            if (tabelas.ContainsKey(nome)) usado ??= leitura.Mapeamento;
            resumo.Add(new ArquivoLidoDto(nome, leitura.Linhas.Count));
            lidas.AddRange(leitura.Linhas.Select(l => (l, (string?)nome)));
        }

        var fitIds = new HashSet<string>();
        var semCodigo = new HashSet<(DateTime, decimal, string)>();
        var unicas = new List<(ExtratoImportService.LinhaExtrato, string?)>();
        foreach (var (linha, arquivo) in lidas.OrderBy(x => x.Linha.Data))
        {
            var chave = (linha.Data.Date, linha.Valor, linha.Descricao.Trim());
            var repetida = linha.FitId is not null ? !fitIds.Add(linha.FitId) : semCodigo.Contains(chave);
            semCodigo.Add(chave);
            if (!repetida) unicas.Add((linha, arquivo));
        }

        PreviewImportacaoDto ComTabela(PreviewImportacaoDto p) => doLote is null ? p : p with
        {
            Formato = "csv",
            Colunas = doLote.Colunas,
            Amostra = doLote.Linhas.Take(5).Select(l => l.Select(c => c.Length > 80 ? c[..80] : c).ToArray()).ToList(),
            Mapeamento = usado is { } m ? ParaDto(m) : null,
            Assinatura = doLote.Assinatura,
            MapeamentoLembrado = lembrado && escolhido is null,
            Motivos = ExtratoImportService.Motivos(doLote, usado, escolhido is not null ? "escolhido" : lembrado ? "lembrado" : null),
        };
        // Os CSV são do mesmo banco e as colunas não foram reconhecidas: a tela pergunta e manda tudo de novo.
        if (doLote is not null && faltaMapear)
            return ComTabela(new PreviewImportacaoDto(new(), 0, 0, PrecisaMapear: true)) with { Arquivos = resumo };

        var previa = await MontarPreviaAsync(contaId, usuarioId, unicas);
        return ComTabela(previa) with { Arquivos = resumo };
    }

    /// <summary>A prévia das linhas lidas (de um arquivo ou de vários): o que já está no app, pagamento de fatura,
    /// Pix no crédito, o que o sinal não diz e a categoria sugerida pra cada estabelecimento.</summary>
    private async Task<PreviewImportacaoDto> MontarPreviaAsync(
        Guid? contaId, Guid usuarioId, List<(ExtratoImportService.LinhaExtrato Linha, string? Arquivo)> entrada)
    {
        var lidas = entrada.Select(x => x.Linha).ToList();

        // Transações ativas da conta para deduplicação (sem conta ainda, nada é "já no app").
        var existentes = await _context.Transacoes
            .Where(t => contaId != null && t.ContaId == contaId && t.Ativo)
            .Select(t => new { t.Data, t.Valor, t.Descricao, t.Tipo, t.ImportacaoFitId })
            .ToListAsync();

        var fitIdsExistentes = existentes
            .Where(e => e.ImportacaoFitId != null)
            .Select(e => e.ImportacaoFitId!)
            .ToHashSet();

        var categorias = await _context.Categorias
            .Where(c => c.UsuarioId == usuarioId || c.UsuarioId == null)
            .Select(c => new CategoriaResumo(c.Id, c.Descricao, c.Finalidade))
            .ToListAsync();

        var paraRegra = lidas
            .Select(l => new LinhaParaRegra(DateOnly.FromDateTime(l.Data), Math.Abs(l.Valor),
                                            l.Valor < 0 ? TipoTransacao.Despesa : TipoTransacao.Receita, l.Descricao))
            .ToList();
        var paresPix = ParesDePixNoCredito(paraRegra.Select(l => (l.Data, l.Valor, l.Tipo, l.Descricao)).ToList());
        var pixNoCredito = paresPix.Select(p => p >= 0).ToArray();
        var faturasPagas = contaId is { } c1 ? await ResolverPagamentosDeFaturaAsync(c1, usuarioId, paraRegra) : new Dictionary<int, Fatura>();
        var titular = await NomeDoTitularAsync(usuarioId);
        var outrasContas = await OutrasContasAsync(usuarioId, contaId);
        var naturezas = paraRegra.Select(l => NaturezaDaLinha(l.Descricao, titular, outrasContas)).ToList();
        var pares = contaId is { } c2 ? await ParesEntreContasAsync(c2, usuarioId, paraRegra, naturezas) : new Dictionary<int, ParCandidato>();
        // Aplicação/resgate vai pra uma categoria de investimento (o que marca EhInvestimento e tira do resultado).
        var deInvestimento = categorias.Where(c => c.Finalidade == Finalidade.Investimento)
            .OrderBy(c => c.Descricao == "Renda fixa" ? 0 : 1).FirstOrDefault();
        var regras = await _context.RegrasCategoria.AsNoTracking()
            .Where(r => r.UsuarioId == usuarioId)
            .ToDictionaryAsync(r => r.Chave, r => r.CategoriaId);
        var padroes = await PadroesAsync(usuarioId);
        var chavesDoExtrato = lidas.Select(l => Estabelecimento.Chave(l.Descricao, l.Valor < 0, padroes)).Distinct().ToList();
        var sugerir = await SugestorAsync(usuarioId, categorias, regras, chavesDoExtrato, padroes);

        // Pagamento de fatura já registrado no app (pela tela, ou importado de outro arquivo sem FITID): o
        // mesmo valor perto da mesma data. Importar de novo debitaria a conta 2x.
        var pagamentosNoApp = await _context.Transacoes
            .Where(t => contaId != null && t.ContaId == contaId && t.Ativo && t.EhPagamentoFatura)
            .Select(t => new { t.Data, t.Valor })
            .ToListAsync();

        var linhas = new List<ExtratoLinhaDto>();
        foreach (var (linha, i) in lidas.Select((l, i) => (l, i)))
        {
            var tipo = linha.Valor < 0 ? TipoTransacao.Despesa : TipoTransacao.Receita;
            var valor = Math.Abs(linha.Valor);

            var duplicada = linha.FitId is not null
                ? fitIdsExistentes.Contains(linha.FitId)
                : existentes.Any(e =>
                    e.Data == DateOnly.FromDateTime(linha.Data)
                    && e.Valor == valor
                    && e.Tipo == tipo
                    && e.Descricao == linha.Descricao);
            if (!duplicada && tipo == TipoTransacao.Despesa && EhPagamentoDeFatura(linha.Descricao))
                duplicada = pagamentosNoApp.Any(p =>
                    p.Valor == valor && Math.Abs(p.Data.DayNumber - paraRegra[i].Data.DayNumber) <= 3);

            var faturaPaga = faturasPagas.GetValueOrDefault(i);
            var pagaFatura = tipo == TipoTransacao.Despesa && EhPagamentoDeFatura(linha.Descricao);
            // Pix no crédito: a entrada do cartão é só registro; o Pix que ela pagou é o gasto (com categoria).
            var entradaDoCartao = pixNoCredito[i] && tipo == TipoTransacao.Receita;
            var natureza = pagaFatura || entradaDoCartao ? NaturezaExtrato.Comum : naturezas[i];
            // Só registro (mexe no saldo, não é ganho nem gasto): pagamento de fatura, a entrada do cartão e dinheiro
            // entre suas contas. Sem categoria e sem grupo pra categorizar. Empréstimo tem categoria (2026-11-04).
            var semCategoria = pagaFatura || entradaDoCartao || natureza is NaturezaExtrato.EntreSuasContas;
            var chave = semCategoria ? null : Estabelecimento.Chave(linha.Descricao, tipo == TipoTransacao.Despesa, padroes);
            var (categoria, origem) = semCategoria ? (null, null)
                : natureza == NaturezaExtrato.Investimento && deInvestimento is not null && !regras.ContainsKey(chave!)
                    ? (deInvestimento, "conhecido")
                    : sugerir(chave!, linha.Descricao, tipo);

            var leitura = Estabelecimento.Ler(linha.Descricao, padroes);
            linhas.Add(new ExtratoLinhaDto(
                linha.Data, linha.Descricao, valor, tipo, linha.FitId, duplicada,
                categoria?.Id, categoria?.Descricao, entradaDoCartao, faturaPaga?.DataFechamento,
                pagaFatura ? "pagamento-fatura" : NaturezaParaTela(natureza), pares.GetValueOrDefault(i)?.ContaNome,
                semCategoria ? null : leitura.Nome, chave, origem, entrada[i].Arquivo,
                PagoNoCredito: pixNoCredito[i] && !entradaDoCartao,
                ParPixNoCredito: pixNoCredito[i] && paresPix[i] != i ? paresPix[i] : null,
                MeioSugerido: MeioDoTexto(linha.Descricao, tipo),
                Pedacos: leitura.Pedacos.ToList(), TipoMovimento: leitura.Tipo, Documento: leitura.Documento));
        }

        return new PreviewImportacaoDto(linhas, linhas.Count, linhas.Count(l => l.Duplicada));
    }

    // ── Categoria por estabelecimento (2026-11-03) ──────────────────────────────────────────────────────────────
    // A pessoa não quer categorizar, quer saber pra onde o dinheiro foi: o app sugere pelo que ela já disse daquele
    // estabelecimento (a regra aprendida ao importar), senão pelo que ela já fez com ele nos lançamentos, senão pelo
    // que outras pessoas disseram daquela loja (coletivo, só compra em loja e categoria padrão), senão pela lista do
    // óbvio (iFood é comida), senão pelo nome da categoria na descrição.

    /// <summary>Quantos lançamentos com categoria olhar pra aprender do histórico (os mais recentes).</summary>
    private const int HistoricoParaAprender = 3000;

    /// <summary>
    /// Sugestão coletiva (2026-11-04): quantas pessoas DIFERENTES precisam ter dado a mesma categoria a um
    /// estabelecimento pra ela valer como sugestão pros outros, e que parte delas (6 em 10) tem que concordar.
    /// Só regra compartilhável (compra em loja, nunca Pix pra pessoa) e só categoria padrão (a categoria que a pessoa
    /// criou é dela). O que atravessa a conta é só "estabelecimento → categoria" agregado: nunca quem disse.
    /// </summary>
    public const int MinimoPessoasColetivo = 3;

    private async Task<Func<string, string, TipoTransacao, (CategoriaResumo?, string?)>> SugestorAsync(
        Guid usuarioId, List<CategoriaResumo> categorias, Dictionary<string, Guid> regras, List<string> chavesDoExtrato,
        IReadOnlyList<Estabelecimento.PadraoNome> padroes)
    {
        var porId = categorias.ToDictionary(c => c.Id);
        var coletivo = (await _context.RegrasCategoria.AsNoTracking()
                .Where(r => r.Compartilhavel && r.UsuarioId != usuarioId && chavesDoExtrato.Contains(r.Chave)
                            && _context.Categorias.Any(c => c.Id == r.CategoriaId && c.UsuarioId == null))
                .Select(r => new { r.Chave, r.UsuarioId, r.CategoriaId })
                .ToListAsync())
            .GroupBy(r => r.Chave)
            .Select(g =>
            {
                var pessoas = g.Select(r => r.UsuarioId).Distinct().Count();
                var maioria = g.GroupBy(r => r.CategoriaId)
                    .Select(c => (CategoriaId: c.Key, Pessoas: c.Select(r => r.UsuarioId).Distinct().Count()))
                    .OrderByDescending(c => c.Pessoas).First();
                return (g.Key, maioria.CategoriaId, Vale: maioria.Pessoas >= MinimoPessoasColetivo && maioria.Pessoas * 10 >= pessoas * 6);
            })
            .Where(x => x.Vale)
            .ToDictionary(x => x.Key, x => x.CategoriaId);
        var historico = (await _context.Transacoes.AsNoTracking()
                .Where(t => t.CategoriaId != null && t.ContaId != null && t.Conta!.UsuarioIdProprietario == usuarioId
                            && t.FamiliaId == null)
                .OrderByDescending(t => t.Data)
                .Take(HistoricoParaAprender)
                .Select(t => new { t.Descricao, t.Tipo, CategoriaId = t.CategoriaId!.Value })
                .ToListAsync())
            .GroupBy(t => Estabelecimento.Chave(t.Descricao, t.Tipo == TipoTransacao.Despesa, padroes))
            .ToDictionary(g => g.Key, g => g.GroupBy(t => t.CategoriaId).OrderByDescending(c => c.Count()).First().Key);

        CategoriaResumo? Valida(Guid? id, TipoTransacao tipo) =>
            id is { } x && porId.TryGetValue(x, out var c) && Compativel(c, tipo) ? c : null;

        return (chave, descricao, tipo) =>
        {
            if (Valida(regras.GetValueOrDefault(chave), tipo) is { } r) return (r, "regra");
            if (Valida(historico.GetValueOrDefault(chave), tipo) is { } h) return (h, "historico");
            if (Valida(coletivo.GetValueOrDefault(chave), tipo) is { } col) return (col, "coletivo");
            if (Estabelecimento.CategoriaConhecida(chave) is { } nome
                && categorias.FirstOrDefault(c => c.Descricao == nome && Compativel(c, tipo)) is { } k)
                return (k, "conhecido");
            return SugerirCategoria(descricao, tipo, categorias) is { } n ? (n, "nome") : (null, null);
        };
    }

    /// <summary>
    /// A categoria que o app sugere pra cada descrição (fatura de cartão importada sem a fila: "jogo os extratos aqui e
    /// ele se vira"). Mesma ordem do sugestor (regra, histórico, coletivo, conhecido), mas o palpite pelo nome da
    /// categoria NÃO vale aqui: sem a pessoa conferir, ficar pendente é melhor que errar.
    /// </summary>
    public async Task<List<Guid?>> CategoriasSugeridasAsync(Guid usuarioId, IReadOnlyList<(string Descricao, TipoTransacao Tipo)> linhas)
    {
        if (linhas.Count == 0) return [];
        var categorias = await _context.Categorias.AsNoTracking()
            .Where(c => c.UsuarioId == usuarioId || c.UsuarioId == null)
            .Select(c => new CategoriaResumo(c.Id, c.Descricao, c.Finalidade))
            .ToListAsync();
        var regras = await _context.RegrasCategoria.AsNoTracking()
            .Where(r => r.UsuarioId == usuarioId)
            .ToDictionaryAsync(r => r.Chave, r => r.CategoriaId);
        var padroes = await PadroesAsync(usuarioId);
        var chaves = linhas.Select(l => Estabelecimento.Chave(l.Descricao, l.Tipo == TipoTransacao.Despesa, padroes)).ToList();
        var sugerir = await SugestorAsync(usuarioId, categorias, regras, chaves.Distinct().ToList(), padroes);
        return linhas.Select((l, i) =>
        {
            var (c, origem) = sugerir(chaves[i], l.Descricao, l.Tipo);
            return origem == "nome" ? null : c?.Id;
        }).ToList();
    }

    private static bool Compativel(CategoriaResumo c, TipoTransacao tipo) => tipo == TipoTransacao.Despesa
        ? c.Finalidade is Finalidade.Despesa or Finalidade.Ambas or Finalidade.Investimento
        : c.Finalidade is Finalidade.Receita or Finalidade.Ambas or Finalidade.Investimento;

    /// <summary>
    /// Aprende com o que entrou: pra cada estabelecimento, a categoria que a pessoa deixou na maioria dos lançamentos
    /// vira a regra dele (a mais nova vale). Assim a próxima importação já vem categorizada. Na mesma transação da
    /// confirmação.
    /// </summary>
    private async Task AprenderRegrasAsync(Guid usuarioId, List<(string Descricao, TipoTransacao Tipo, Guid CategoriaId)> gravadas)
    {
        if (gravadas.Count == 0) return;
        var padroes = await PadroesAsync(usuarioId);
        var grupos = gravadas
            .GroupBy(g => Estabelecimento.Chave(g.Descricao, g.Tipo == TipoTransacao.Despesa, padroes))
            .Select(g => (Chave: g.Key, g.First().Descricao, g.First().Tipo,
                CategoriaId: g.GroupBy(x => x.CategoriaId).OrderByDescending(c => c.Count()).First().Key,
                // Só vira sugestão coletiva se TODO lançamento do grupo foi compra em loja (um Pix no meio e fica só seu).
                Compartilhavel: g.All(x => Estabelecimento.EhCompra(x.Descricao))))
            .ToList();
        var chaves = grupos.Select(g => g.Chave).ToList();
        var existentes = await _context.RegrasCategoria
            .Where(r => r.UsuarioId == usuarioId && chaves.Contains(r.Chave))
            .ToDictionaryAsync(r => r.Chave);
        foreach (var g in grupos)
        {
            if (!existentes.TryGetValue(g.Chave, out var regra))
            {
                regra = new RegraCategoria { Id = Guid.NewGuid(), UsuarioId = usuarioId, Chave = g.Chave };
                _context.RegrasCategoria.Add(regra);
            }
            else if (regra.CategoriaId == g.CategoriaId && regra.Compartilhavel == g.Compartilhavel) continue;
            var nome = Estabelecimento.Nome(g.Descricao, padroes);
            regra.Nome = nome.Length > 255 ? nome[..255] : nome;
            regra.Tipo = g.Tipo;
            regra.CategoriaId = g.CategoriaId;
            regra.Compartilhavel = g.Compartilhavel;
            regra.AtualizadoEm = DateTime.UtcNow;
        }
        await _context.SaveChangesAsync();
    }

    private static ExtratoImportService.MapeamentoCsv ParaMapa(MapeamentoCsvDto m) =>
        new(m.Data, m.Descricao, m.Valor, m.Entrada, m.Saida, m.Id, m.InverterSinal, m.Tipo);

    private static ExtratoImportService.MapeamentoCsv ParaMapa(ModeloImportacao m) =>
        new(m.ColunaData, m.ColunaDescricao, m.ColunaValor, m.ColunaEntrada, m.ColunaSaida, m.ColunaId, m.InverterSinal, m.ColunaTipo);

    private static MapeamentoCsvDto ParaDto(ExtratoImportService.MapeamentoCsv m) =>
        new(m.Data, m.Descricao, m.Valor, m.Entrada, m.Saida, m.Id, m.InverterSinal, m.Tipo);

    /// <summary>
    /// Cria as transações aprovadas pelo usuário na conta indicada — tudo ou nada, numa transação só do banco
    /// (antes eram N gravações soltas: uma falha no meio deixava meio extrato importado). Com
    /// <paramref name="idempotencyKey"/> (o controller exige), a mesma confirmação repetida (clique duplo,
    /// rede que caiu depois de gravar) não importa de novo: a chave é gravada ANTES das linhas, no índice único,
    /// então a segunda requisição simultânea espera a primeira e vira replay. Linha com FITID que já está na conta
    /// é pulada aqui no servidor, mesmo que a prévia tenha mandado.
    /// </summary>
    public async Task<ResultadoImportacaoDto> ConfirmarAsync(
        ConfirmarImportacaoDto dto, Guid usuarioId, string? idempotencyKey = null)
    {
        await ExigirContaAsync(dto.ContaId, usuarioId);
        Idempotencia.ExigirTamanho(idempotencyKey);

        if (dto.Linhas.Count == 0)
            throw new ArgumentException("Nenhuma linha selecionada para importação.");
        if (dto.Linhas.Count > MaxLinhasPorConfirmacao)
            throw new ArgumentException($"Importe no máximo {MaxLinhasPorConfirmacao} linhas por vez.");

        if (dto.Linhas.Any(l => l.Valor <= 0))
            throw new ArgumentException("O valor de cada transação deve ser positivo.");
        foreach (var l in dto.Linhas) MeioDaLinha(l.MeioPagamento);

        if (!string.IsNullOrWhiteSpace(idempotencyKey)
            && await Idempotencia.BuscarAsync(_context, usuarioId, OperacaoImportarExtrato, idempotencyKey) is not null)
            return new ResultadoImportacaoDto(0, Repetido: true);

        var proprioTx = _context.Database.CurrentTransaction is null && _context.Database.IsRelational();
        await using var tx = proprioTx ? await _context.Database.BeginTransactionAsync() : null;
        try
        {
            if (!string.IsNullOrWhiteSpace(idempotencyKey))
            {
                _context.RegistrosIdempotencia.Add(Idempotencia.Novo(usuarioId, OperacaoImportarExtrato, idempotencyKey, dto.ContaId));
                await _context.SaveChangesAsync();
            }
            var resultado = await GravarLinhasAsync(dto, usuarioId);
            if (dto.Mapeamento is not null && !string.IsNullOrWhiteSpace(dto.Assinatura))
                await LembrarMapeamentoAsync(dto.ContaId, usuarioId, dto.Assinatura, dto.Mapeamento);
            if (tx is not null) await tx.CommitAsync();
            return resultado;
        }
        catch (DbUpdateException e) when (!string.IsNullOrWhiteSpace(idempotencyKey) && Idempotencia.EhViolacaoDeUnicidade(e))
        {
            // Outra requisição com a mesma chave gravou primeiro: o extrato já entrou (este pedido não gravou nada).
            return new ResultadoImportacaoDto(0, Repetido: true);
        }
    }

    private async Task LembrarMapeamentoAsync(Guid contaId, Guid usuarioId, string assinatura, MapeamentoCsvDto m)
    {
        var modelo = await _context.ModelosImportacao
            .FirstOrDefaultAsync(x => x.UsuarioId == usuarioId && x.ContaId == contaId && x.Assinatura == assinatura);
        if (modelo is null)
        {
            modelo = new ModeloImportacao { Id = Guid.NewGuid(), UsuarioId = usuarioId, ContaId = contaId, Assinatura = assinatura };
            _context.ModelosImportacao.Add(modelo);
        }
        modelo.ColunaData = m.Data;
        modelo.ColunaDescricao = m.Descricao;
        modelo.ColunaValor = m.Valor;
        modelo.ColunaEntrada = m.Entrada;
        modelo.ColunaSaida = m.Saida;
        modelo.ColunaId = m.Id;
        modelo.ColunaTipo = m.Tipo;
        modelo.InverterSinal = m.InverterSinal;
        modelo.AtualizadoEm = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }

    private async Task<ResultadoImportacaoDto> GravarLinhasAsync(ConfirmarImportacaoDto dto, Guid usuarioId)
    {
        // FITID que já está na conta (lançamento vivo) não entra de novo — nem repetido dentro do mesmo envio.
        var fitIds = dto.Linhas.Where(l => l.FitId != null).Select(l => l.FitId!).Distinct().ToList();
        var jaNaConta = (await _context.Transacoes
                .Where(t => t.ContaId == dto.ContaId && t.ImportacaoFitId != null && fitIds.Contains(t.ImportacaoFitId))
                .Select(t => t.ImportacaoFitId!)
                .ToListAsync())
            .ToHashSet();
        var jaExistiam = 0;

        // Detecta de novo aqui, no servidor — as marcas da prévia são só pra mostrar.
        var paraRegra = dto.Linhas
            .Select(l => new LinhaParaRegra(DateOnly.FromDateTime(l.Data), l.Valor, l.Tipo, l.Descricao))
            .ToList();
        var pixNoCredito = PernasDePixNoCredito(paraRegra.Select(l => (l.Data, l.Valor, l.Tipo, l.Descricao)).ToList());
        var faturasPagas = await ResolverPagamentosDeFaturaAsync(dto.ContaId, usuarioId, paraRegra);
        var titular = await NomeDoTitularAsync(usuarioId);
        var outrasContas = await OutrasContasAsync(usuarioId, dto.ContaId);
        var naturezas = paraRegra.Select(l => NaturezaDaLinha(l.Descricao, titular, outrasContas)).ToList();
        var pares = await ParesEntreContasAsync(dto.ContaId, usuarioId, paraRegra, naturezas);

        var importadas = 0;
        var ids = new List<Guid?>(); // o lançamento de cada linha, na ordem (null = não virou lançamento próprio)
        var dias = new List<DateOnly>(); // o dia de cada lançamento que entrou (pro registro da importação)
        var gravadas = new List<(string Descricao, TipoTransacao Tipo, Guid CategoriaId)>();
        foreach (var (linha, i) in dto.Linhas.Select((l, i) => (l, i)))
        {
            if (linha.FitId is not null && !jaNaConta.Add(linha.FitId))
            {
                jaExistiam++;
                ids.Add(null);
                continue;
            }
            var ponto = AnexoTransacaoService.Ponto(linha.Latitude, linha.Longitude);
            if (faturasPagas.TryGetValue(i, out var fatura))
            {
                ids.Add(null);
                await PagarFaturaDoExtratoAsync(dto.ContaId, usuarioId, fatura, linha);
                importadas++;
                dias.Add(DateOnly.FromDateTime(linha.Data));
                continue;
            }

            // As mesmas regras da prévia. Pagamento de fatura que chega aqui não achou fatura no app: fica o registro
            // (sai da conta, não é gasto; os gastos do cartão são as compras, na fatura).
            var pagaFatura = linha.Tipo == TipoTransacao.Despesa && EhPagamentoDeFatura(linha.Descricao);
            var entradaDoCartao = pixNoCredito[i] && linha.Tipo == TipoTransacao.Receita;
            var natureza = pagaFatura || entradaDoCartao ? NaturezaExtrato.Comum : naturezas[i];
            var soRegistro = pagaFatura || entradaDoCartao || natureza == NaturezaExtrato.EntreSuasContas;
            var categoria = soRegistro ? null : linha.CategoriaId;
            var transacao = new Transacao
            {
                Id = Guid.NewGuid(),
                // O nome que a pessoa conferiu na ficha; vazio = o do banco. A detecção acima e a regra do lugar usam
                // sempre o texto do banco.
                Descricao = string.IsNullOrWhiteSpace(linha.DescricaoEditada) ? linha.Descricao : linha.DescricaoEditada.Trim(),
                Valor = linha.Valor,
                Tipo = linha.Tipo,
                Data = DateOnly.FromDateTime(linha.Data),
                Hora = linha.Hora,
                MeioPagamento = MeioDaLinha(linha.MeioPagamento),
                ContaId = dto.ContaId,
                CategoriaId = categoria,
                // Subcategoria só com a categoria (o CriarTransacaoAsync confere que é dela e de quem).
                SubcategoriaId = categoria is null ? null : linha.SubcategoriaId,
                StatusTransacao = StatusTransacao.Executado,
                Ativo = true,
                ImportacaoFitId = linha.FitId,
                EhPixNoCredito = entradaDoCartao,
                EhPagamentoFatura = pagaFatura,
                EhTransferencia = natureza == NaturezaExtrato.EntreSuasContas,
                EhEmprestimo = natureza == NaturezaExtrato.Emprestimo,
                Latitude = ponto?.Latitude,
                Longitude = ponto?.Longitude,
            };

            await _transacaoService.CriarTransacaoAsync(transacao, usuarioId);
            ids.Add(transacao.Id);
            if (transacao.CategoriaId is { } categoriaId && !linha.NaoLembrar)
                gravadas.Add((linha.Descricao, linha.Tipo, categoriaId));
            // A outra perna já está no app: as duas viram uma transferência de verdade (editável pela tela dela).
            if (natureza == NaturezaExtrato.EntreSuasContas && pares.TryGetValue(i, out var par))
                await TransferenciaService.JuntarPernasAsync(_context, usuarioId, transacao.Id, par.Id, linha.Descricao);
            importadas++;
            dias.Add(transacao.Data);
        }

        await AprenderRegrasAsync(usuarioId, gravadas);
        // O registro da importação (a lista "Importações anteriores"), na mesma transação: só quando entrou alguma coisa.
        if (importadas > 0)
        {
            _context.ImportacoesExtrato.Add(new ImportacaoExtrato
            {
                Id = Guid.NewGuid(), UsuarioId = usuarioId, ContaId = dto.ContaId, CriadoEm = DateTime.UtcNow,
                De = dias.Min(), Ate = dias.Max(), Quantidade = importadas,
            });
            await _context.SaveChangesAsync();
        }
        return new ResultadoImportacaoDto(importadas, jaExistiam, Ids: ids);
    }

    /// <summary>As importações que a pessoa já fez, da mais nova pra mais antiga (até <see cref="MaxAnteriores"/>):
    /// responde "até onde eu já importei?" na primeira tela de Importar extrato. Só as dela.</summary>
    // ── Ensinar o nome (2026-11-21) ──────────────────────────────────────────────────────────────────────────

    /// <summary>Os padrões de nome que a pessoa ensinou (ver <see cref="Estabelecimento.PadraoNome"/>).</summary>
    public async Task<List<Estabelecimento.PadraoNome>> PadroesAsync(Guid usuarioId) =>
        (await _context.PadroesNomeImportacao.AsNoTracking()
            .Where(p => p.UsuarioId == usuarioId)
            .Select(p => new { p.Antes, p.Depois })
            .ToListAsync())
        .Select(p => new Estabelecimento.PadraoNome(p.Antes.Split(' '), p.Depois))
        .ToList();

    /// <summary>
    /// A pessoa disse qual parte da descrição é o nome: guarda a forma (um padrão por começo; o mais novo vale) e
    /// devolve o nome que sai agora. A tela lê o extrato de novo e os lançamentos com a mesma forma se juntam.
    /// </summary>
    public async Task<EnsinarNomeResultadoDto> EnsinarNomeAsync(Guid usuarioId, EnsinarNomeDto dto)
    {
        var padrao = Estabelecimento.PadraoDe(dto.Descricao, dto.Nome)
            ?? throw new ArgumentException("Marque palavras seguidas da descrição, sem ser o começo dela.");
        var antes = string.Join(' ', padrao.Antes);
        var salvo = await _context.PadroesNomeImportacao
            .FirstOrDefaultAsync(p => p.UsuarioId == usuarioId && p.Antes == antes);
        if (salvo is null)
        {
            salvo = new PadraoNomeImportacao { Id = Guid.NewGuid(), UsuarioId = usuarioId, Antes = antes };
            _context.PadroesNomeImportacao.Add(salvo);
        }
        salvo.Depois = padrao.Depois;
        salvo.AtualizadoEm = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return new EnsinarNomeResultadoDto(Estabelecimento.Nome(dto.Descricao, [padrao]));
    }

    public async Task<List<ImportacaoAnteriorDto>> ListarAnterioresAsync(Guid usuarioId) =>
        await _context.ImportacoesExtrato.AsNoTracking()
            .Where(i => i.UsuarioId == usuarioId)
            .Join(_context.Contas, i => i.ContaId, c => c.Id, (i, c) => new { i, c.Nome })
            .OrderByDescending(x => x.i.CriadoEm)
            .Take(MaxAnteriores)
            .Select(x => new ImportacaoAnteriorDto(x.i.Id, x.i.ContaId, x.Nome, x.i.CriadoEm, x.i.De, x.i.Ate, x.i.Quantidade))
            .ToListAsync();

    // ── Fila de pendentes (2026-11-22) ──────────────────────────────────────────────────────────────────────
    // "A ideia é categorizar tudo" (Gustavo): o que entra sem categoria não pode se perder. Pendente = lançamento da
    // pessoa, vivo, que conta como gasto ou renda (transferência, pagamento de fatura, empréstimo etc. não levam
    // categoria) e está sem categoria. A fila mostra por lugar (a mesma leitura da importação) e categorizar um lugar
    // vale pros lançamentos dele e vira a regra do lugar.

    /// <summary>Quantos lançamentos a fila traz por vez (os mais recentes). O total vem à parte.</summary>
    public const int MaximoPendentes = 300;

    /// <summary>
    /// Os lançamentos pendentes de <paramref name="usuarioId"/>: da conta ou do cartão DELE (o mesmo dono do
    /// <c>TransacaoService.BuscarPorIdAsync</c>), sem categoria, despesa ou receita que entra no resultado.
    /// Regra única: a lista, a contagem e o categorizar partem daqui.
    /// </summary>
    private IQueryable<Transacao> PendentesDe(Guid usuarioId) => _context.Transacoes
        .Where(t => (t.ContaId.HasValue && t.Conta!.UsuarioIdProprietario == usuarioId)
                 || (t.CartaoCreditoId.HasValue && t.CartaoCredito!.CriadoPor == usuarioId))
        .Where(t => t.Ativo && t.CategoriaId == null && t.StatusTransacao != StatusTransacao.Cancelado
                    && (t.Tipo == TipoTransacao.Despesa || t.Tipo == TipoTransacao.Receita))
        .Where(RegrasFinanceiras.EntraNoResultado);

    public Task<int> QuantidadePendentesAsync(Guid usuarioId) => PendentesDe(usuarioId).CountAsync();

    public async Task<PendentesDto> ListarPendentesAsync(Guid usuarioId)
    {
        var total = await PendentesDe(usuarioId).CountAsync();
        if (total == 0) return new PendentesDto(0, []);
        var lancamentos = await PendentesDe(usuarioId).AsNoTracking()
            .OrderByDescending(t => t.Data).ThenByDescending(t => t.Hora).ThenBy(t => t.Id)
            .Take(MaximoPendentes)
            .Select(t => new
            {
                t.Id, t.Data, t.Hora, t.Descricao, t.Valor, t.Tipo, t.MeioPagamento, t.Latitude, t.Longitude,
                Origem = t.ContaId != null ? t.Conta!.Nome : t.CartaoCredito!.Nome,
            })
            .ToListAsync();

        var categorias = await _context.Categorias.AsNoTracking()
            .Where(c => c.UsuarioId == usuarioId || c.UsuarioId == null)
            .Select(c => new CategoriaResumo(c.Id, c.Descricao, c.Finalidade))
            .ToListAsync();
        var regras = await _context.RegrasCategoria.AsNoTracking()
            .Where(r => r.UsuarioId == usuarioId)
            .ToDictionaryAsync(r => r.Chave, r => r.CategoriaId);
        var padroes = await PadroesAsync(usuarioId);
        var chaveDe = lancamentos.ToDictionary(l => l.Id, l => Estabelecimento.Chave(l.Descricao, l.Tipo == TipoTransacao.Despesa, padroes));
        var sugerir = await SugestorAsync(usuarioId, categorias, regras, chaveDe.Values.Distinct().ToList(), padroes);

        var itens = lancamentos.Select(l =>
        {
            var chave = chaveDe[l.Id];
            var leitura = Estabelecimento.Ler(l.Descricao, padroes);
            var (categoria, _) = sugerir(chave, l.Descricao, l.Tipo);
            return new PendenteDto(l.Id, l.Data, l.Hora, l.Descricao, l.Valor, l.Tipo, l.Origem, l.MeioPagamento,
                leitura.Nome, chave, categoria?.Id, categoria?.Descricao, leitura.Pedacos.ToList(), l.Latitude, l.Longitude);
        }).ToList();
        return new PendentesDto(total, itens);
    }

    /// <summary>
    /// Dá a categoria aos lançamentos pendentes pedidos, tudo ou nada. Confere, no servidor: a categoria (e a
    /// subcategoria, que tem que ser DELA) são da pessoa ou padrão; cada lançamento é dela e AINDA está pendente
    /// (id de outro usuário, inexistente ou já categorizado → 404, igual pra "não existe"); a categoria serve pro tipo
    /// de cada um. Não mexe em valor, conta nem data: o saldo não muda. Com <c>Lembrar</c>, a escolha vira a regra do
    /// lugar na mesma transação.
    /// </summary>
    public async Task<CategorizarPendentesResultadoDto> CategorizarPendentesAsync(Guid usuarioId, CategorizarPendentesDto dto)
    {
        var ids = dto.TransacaoIds.Distinct().ToList();
        if (ids.Count == 0) throw new ArgumentException("Escolha ao menos um lançamento.");
        if (ids.Count > 500) throw new ArgumentException("Lançamentos demais de uma vez.");
        await DonoRecursos.ExigirCategoriaAsync(_context, dto.CategoriaId, usuarioId);
        if (dto.SubcategoriaId is { } subId)
        {
            await DonoRecursos.ExigirSubcategoriaAsync(_context, subId, usuarioId);
            if (!await _context.Subcategorias.AnyAsync(s => s.Id == subId && s.CategoriaId == dto.CategoriaId))
                throw new ArgumentException("Essa subcategoria não é dessa categoria.");
        }
        var categoria = await _context.Categorias.AsNoTracking()
            .Where(c => c.Id == dto.CategoriaId)
            .Select(c => new CategoriaResumo(c.Id, c.Descricao, c.Finalidade))
            .FirstAsync();

        var lancamentos = await PendentesDe(usuarioId).Where(t => ids.Contains(t.Id)).ToListAsync();
        if (lancamentos.Count != ids.Count) throw new KeyNotFoundException("Lançamento não encontrado entre os pendentes.");
        if (lancamentos.Any(t => !Compativel(categoria, t.Tipo)))
            throw new InvalidOperationException("Essa categoria não serve pra esse tipo de lançamento.");

        // Os acertos de cada lançamento (descrição, hora, forma de pagamento), conferidos ANTES de gravar qualquer coisa.
        // Só vale acerto de lançamento que está no pedido. A forma de pagamento passa pela mesma regra da importação
        // (fora do enum → 400; crédito não, o lançamento é de conta) e não se mexe em compra de cartão.
        var porId = lancamentos.ToDictionary(t => t.Id);
        var ajustes = (dto.Ajustes ?? []).Where(a => porId.ContainsKey(a.TransacaoId))
            .GroupBy(a => a.TransacaoId).Select(g => g.Last())
            .Select(a =>
            {
                var descricao = a.Descricao?.Trim();
                if (a.Descricao is not null && string.IsNullOrEmpty(descricao)) throw new ArgumentException("Informe a descrição.");
                if (descricao is { Length: > 255 }) throw new ArgumentException("A descrição passa de 255 caracteres.");
                var meio = porId[a.TransacaoId].CartaoCreditoId is null ? MeioDaLinha(a.MeioPagamento) : null;
                return (a.TransacaoId, Descricao: descricao, a.Hora, Meio: meio);
            }).ToList();
        // A regra do lugar se aprende pela descrição que veio do banco, não pela que a pessoa escreveu por cima.
        var paraAprender = lancamentos.Select(t => (t.Descricao, t.Tipo, dto.CategoriaId)).ToList();

        var proprioTx = _context.Database.CurrentTransaction == null && _context.Database.IsRelational();
        await using var tx = proprioTx ? await _context.Database.BeginTransactionAsync() : null;
        foreach (var t in lancamentos)
        {
            t.CategoriaId = dto.CategoriaId;
            t.SubcategoriaId = dto.SubcategoriaId;
        }
        foreach (var a in ajustes)
        {
            var t = porId[a.TransacaoId];
            if (a.Descricao is not null) t.Descricao = a.Descricao;
            if (a.Hora is not null) t.Hora = a.Hora;
            if (a.Meio is not null) t.MeioPagamento = a.Meio;
        }
        await _context.SaveChangesAsync();
        if (dto.Lembrar)
            await AprenderRegrasAsync(usuarioId, paraAprender);
        if (tx != null) await tx.CommitAsync();
        return new CategorizarPendentesResultadoDto(lancamentos.Count, await PendentesDe(usuarioId).CountAsync());
    }

    /// <summary>
    /// "Foi pagamento de cartão" (fatura-a-detalhar.md, passo 2): a saída da conta pagou a fatura de um cartão e o
    /// texto do banco não foi reconhecido. Vira registro de pagamento de fatura (fora do resultado, sem categoria), e o
    /// valor passa a contar como "Cartão (a detalhar)" até a fatura entrar. Tudo ou nada: só saída de CONTA da pessoa
    /// que ainda está pendente (de outro, inexistente, já categorizado ou compra de cartão → 404). Saldo não muda.
    /// </summary>
    public async Task<CategorizarPendentesResultadoDto> MarcarPagamentoDeCartaoAsync(Guid usuarioId, PagamentoDeCartaoDto dto)
    {
        var ids = dto.TransacaoIds.Distinct().ToList();
        if (ids.Count == 0) throw new ArgumentException("Escolha ao menos um lançamento.");
        if (ids.Count > 500) throw new ArgumentException("Lançamentos demais de uma vez.");
        var lancamentos = await PendentesDe(usuarioId)
            .Where(t => ids.Contains(t.Id) && t.ContaId != null && t.Tipo == TipoTransacao.Despesa)
            .ToListAsync();
        if (lancamentos.Count != ids.Count) throw new KeyNotFoundException("Lançamento não encontrado entre os pendentes.");
        foreach (var t in lancamentos)
        {
            t.EhPagamentoFatura = true;
            t.SubcategoriaId = null;
        }
        await _context.SaveChangesAsync();
        return new CategorizarPendentesResultadoDto(lancamentos.Count, await PendentesDe(usuarioId).CountAsync());
    }

    private record CategoriaResumo(Guid Id, string Descricao, Finalidade Finalidade);

    /// <summary>A forma de pagamento que a pessoa conferiu: passa pelo <see cref="MeioPagamentoExtensions.DoCliente"/>
    /// (fora do enum → 400). Crédito não: o extrato é de uma conta (compra no cartão entra pela fatura).</summary>
    internal static MeioPagamento? MeioDaLinha(int? valor)
    {
        var meio = MeioPagamentoExtensions.DoCliente(valor);
        if (meio == MeioPagamento.Credito)
            throw new ArgumentException("Crédito é forma de pagamento do cartão; o extrato é de uma conta.");
        return meio;
    }

    /// <summary>
    /// A forma de pagamento que o texto do banco diz (2026-11-05: a ficha da importação vem preenchida como uma
    /// transação nova). Só o que o texto afirma: "Pix", "débito automático", "débito", "boleto", "TED/DOC"; sem
    /// palavra, null (a pessoa escolhe). Débito automático é de quem paga (receita nunca).
    /// </summary>
    internal static MeioPagamento? MeioDoTexto(string descricao, TipoTransacao tipo)
    {
        var t = descricao.ToLowerInvariant().Replace("é", "e");
        static bool Palavra(string texto, string p) => Regex.IsMatch(texto, $@"(^|[^\p{{L}}]){p}([^\p{{L}}]|$)");
        if (Palavra(t, "pix")) return MeioPagamento.Pix;
        if (t.Contains("debito automatico") || Palavra(t, "deb aut")) return tipo == TipoTransacao.Despesa ? MeioPagamento.DebitoAutomatico : null;
        if (Palavra(t, "debito")) return MeioPagamento.Debito;
        if (Palavra(t, "boleto")) return MeioPagamento.Boleto;
        if (Palavra(t, "ted") || Palavra(t, "doc")) return MeioPagamento.Ted;
        return null;
    }

    // ── Pagamento de fatura no extrato ─────────────────────────────────────────

    // Como cada banco escreve, no extrato da CONTA, a saída que paga o cartão (docs/features/cartao-credito/
    // fatura-a-detalhar.md, passo 2). É dado, não "se for o banco X": banco novo com outro texto entra numa destas
    // listas. Precisa de uma palavra de pagamento E uma do cartão, em qualquer ordem ("Pagamento de fatura" no Nubank,
    // "PAGTO CARTAO CREDITO", "Pgto fatura cartão", "Deb aut fatura"...). Compra no débito ("pagamento com cartão",
    // "cartão de débito") não é.
    private static readonly string[] PalavrasDePagamento = ["pagamento", "pagto", "pgto", "pag", "pg", "deb aut", "debito automatico", "liquidacao"];
    private static readonly string[] PalavrasDoCartao = ["fatura", "cartao de credito", "cartao credito", "cartao", "card"];
    private static readonly string[] NaoEPagamentoDeFatura = ["com cartao", "cartao de debito", "cartao debito", "no cartao"];

    /// <summary>A saída da conta que paga a fatura do cartão (pelas listas acima; sem acento e sem diferenciar maiúscula).</summary>
    public static bool EhPagamentoDeFatura(string descricao)
    {
        var t = Regex.Replace(SemAcento(descricao.ToLowerInvariant()), @"[^\p{L}\p{N}]+", " ").Trim();
        static bool Tem(string texto, string p) => Regex.IsMatch(texto, $@"(^| ){p}( |$)");
        return PalavrasDePagamento.Any(p => Tem(t, p)) && PalavrasDoCartao.Any(p => Tem(t, p))
            && !NaoEPagamentoDeFatura.Any(p => Tem(t, p));
    }

    private static string SemAcento(string s)
    {
        var sb = new System.Text.StringBuilder(s.Length);
        foreach (var c in s.Normalize(System.Text.NormalizationForm.FormD))
            if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark) sb.Append(c);
        return sb.ToString();
    }

    /// <summary>
    /// Qual fatura do APP cada "Pagamento de fatura" do extrato quita (índice da linha → fatura). Linha fora
    /// do mapa fica como despesa comum. Antes toda linha virava despesa: com as compras do cartão também no
    /// app, o gasto contava 2x (na compra e no pagamento) e a fatura seguia em aberto. Regra, na ordem em que
    /// o banco abate (pagamentos do lote em ordem de data, o restante de cada fatura descontando os
    /// anteriores):
    /// 1. a fatura FECHADA mais antiga que ainda deve;
    /// 2. senão, até o vencimento da que fechou por último, o pagamento é dela — se ela não está no app, é
    ///    fatura de antes do app e o pagamento fica despesa (é o único registro daquele gasto);
    /// 3. senão (depois do vencimento, ou a anterior já quitada no app), adiantamento da fatura aberta.
    /// Fica despesa também: pagamento maior que o restante da fatura (o excedente vira crédito no banco, que o
    /// app não representa) e conta sem exatamente UM cartão de crédito ligado (não dá pra saber qual pagou).
    /// </summary>
    private async Task<Dictionary<int, Fatura>> ResolverPagamentosDeFaturaAsync(
        Guid contaId, Guid usuarioId, IReadOnlyList<LinhaParaRegra> linhas)
    {
        var resultado = new Dictionary<int, Fatura>();
        var pagamentos = Enumerable.Range(0, linhas.Count)
            .Where(i => linhas[i].Tipo == TipoTransacao.Despesa && EhPagamentoDeFatura(linhas[i].Descricao))
            .OrderBy(i => linhas[i].Data).ThenBy(i => i)
            .ToList();
        if (pagamentos.Count == 0)
            return resultado;

        var cartoes = await _context.CartoesCredito
            .Where(c => c.CriadoPor == usuarioId && c.ContaId == contaId && c.TemCredito && c.Ativo)
            .ToListAsync();
        if (cartoes.Count != 1)
            return resultado;
        var cartao = cartoes[0];

        var faturas = await _context.Faturas
            .Include(f => f.Transacoes)
            .Include(f => f.ParcelasTransacao)
            .Where(f => f.CartaoCreditoId == cartao.Id && f.CriadoPor == usuarioId)
            .OrderBy(f => f.DataFechamento)
            .ToListAsync();
        var restante = faturas.ToDictionary(f => f.Id, f => RegrasFinanceiras.ValorRestanteFatura(f));

        foreach (var i in pagamentos)
        {
            var dia = linhas[i].Data.ToDateTime(TimeOnly.MinValue);
            var alvo = faturas.FirstOrDefault(f => f.DataFechamento <= dia && restante[f.Id] > 0);
            if (alvo is null)
            {
                var (fechouPorUltimo, fechaAgora) = FaturaService.CalcularPeriodo(dia, cartao.DiaFechamento);
                var anteriorNoApp = faturas.Any(f => f.DataFechamento == fechouPorUltimo);
                if (!anteriorNoApp && dia <= FaturaService.CalcularVencimento(fechouPorUltimo, cartao.DiaVencimento))
                    continue;
                alvo = faturas.FirstOrDefault(f => f.DataFechamento == fechaAgora && restante[f.Id] > 0);
                if (alvo is null)
                    continue;
            }
            if (linhas[i].Valor > restante[alvo.Id])
                continue;

            restante[alvo.Id] -= linhas[i].Valor;
            resultado[i] = alvo;
        }
        return resultado;
    }

    /// <summary>
    /// Paga a fatura pelo mesmo caminho da tela (<see cref="FaturaService.PagarFaturaAsync"/>: débito na conta,
    /// limite, log, concorrência). A chave de idempotência sai da linha do extrato (FITID, ou data+valor+texto
    /// no CSV): importar o mesmo arquivo de novo devolve o pagamento original em vez de pagar 2x.
    /// </summary>
    private async Task PagarFaturaDoExtratoAsync(Guid contaId, Guid usuarioId, Fatura fatura, LinhaImportarDto linha)
    {
        var origem = linha.FitId ?? $"{linha.Data:yyyy-MM-dd}|{linha.Valor}|{linha.Descricao}";
        var chave = "importacao-" + Convert.ToHexString(
            SHA256.HashData(Encoding.UTF8.GetBytes($"{contaId}|{origem}")));

        var pagamento = await _faturaService.PagarFaturaAsync(fatura.Id, new PagarFaturaDto
        {
            ContaId = contaId,
            Valor = linha.Valor,
            DataPagamento = linha.Data.Date,
            MeioPagamento = (int)MeioPagamento.Debito,
        }, usuarioId, chave);

        // FITID no pagamento: a próxima importação do mesmo extrato já o reconhece como duplicado.
        var gravado = await _context.Transacoes.FirstAsync(t => t.Id == pagamento.Id);
        if (gravado.ImportacaoFitId != linha.FitId)
        {
            gravado.ImportacaoFitId = linha.FitId;
            await _context.SaveChangesAsync();
        }
    }

    /// <summary>
    /// Pix no Crédito (Nubank): o cartão põe o valor na conta — "Valor adicionado na conta por cartão de
    /// crédito - Valor adicionado para Pix no Crédito" — e o Pix sai no mesmo dia com o mesmo valor. As duas
    /// pernas se anulam no saldo. Desde 2026-11-04 (pedido do Gustavo: "é gasto do cartão, tem que ter categoria"):
    /// a ENTRADA é só registro (<c>Transacao.EhPixNoCredito</c>, fora do resultado) e o PIX que ela pagou é o gasto,
    /// com categoria, no dia em que saiu. Pagamento de fatura nunca é gasto (senão o Pix contaria 2x: nele e no
    /// pagamento). Quem chama separa as pernas pelo tipo. A entrada é marcada pelo texto; cada uma leva junto o Pix
    /// enviado do mesmo dia e valor que ainda estiver livre (o mais perto depois dela, senão antes). Só
    /// dentro do mesmo lote: entrada e Pix são do mesmo dia, então vêm no mesmo extrato.
    /// </summary>
    public static bool[] PernasDePixNoCredito(
        IReadOnlyList<(DateOnly Data, decimal Valor, TipoTransacao Tipo, string Descricao)> linhas) =>
        ParesDePixNoCredito(linhas).Select(p => p >= 0).ToArray();

    /// <summary>
    /// As pernas do Pix no Crédito com o par de cada uma: o índice da outra perna (a entrada aponta pro Pix que ela
    /// pagou e o Pix pra entrada). Entrada sem Pix no arquivo aponta pra ela mesma; -1 = não é Pix no crédito. A tela
    /// mostra cada entrada junto do gasto dela.
    /// </summary>
    public static int[] ParesDePixNoCredito(
        IReadOnlyList<(DateOnly Data, decimal Valor, TipoTransacao Tipo, string Descricao)> linhas)
    {
        var par = Enumerable.Repeat(-1, linhas.Count).ToArray();
        for (var i = 0; i < linhas.Count; i++)
        {
            var entrada = linhas[i];
            if (entrada.Tipo != TipoTransacao.Receita || !EhEntradaDePixNoCredito(entrada.Descricao))
                continue;
            par[i] = i;

            var pix = Enumerable.Range(0, linhas.Count)
                .Where(k => par[k] < 0
                            && linhas[k].Tipo == TipoTransacao.Despesa
                            && linhas[k].Data == entrada.Data
                            && linhas[k].Valor == entrada.Valor
                            && linhas[k].Descricao.Contains("pix", StringComparison.OrdinalIgnoreCase))
                .OrderBy(k => k > i ? k - i : linhas.Count + (i - k))
                .DefaultIfEmpty(-1)
                .First();
            if (pix >= 0)
            {
                par[i] = pix;
                par[pix] = i;
            }
        }
        return par;
    }

    // Sem Normalize/CultureInfo: a imagem de produção roda com globalização invariante.
    private static bool EhEntradaDePixNoCredito(string descricao) =>
        descricao.Contains("valor adicionado", StringComparison.OrdinalIgnoreCase)
        && (descricao.Contains("pix no crédito", StringComparison.OrdinalIgnoreCase)
            || descricao.Contains("pix no credito", StringComparison.OrdinalIgnoreCase));

    /// <summary>Sugere uma categoria casando o nome dela (substring) com a
    /// descrição da transação. Filtra pela finalidade compatível com o tipo.</summary>
    private static CategoriaResumo? SugerirCategoria(
        string descricao, TipoTransacao tipo, List<CategoriaResumo> categorias)
    {
        var descLower = descricao.ToLowerInvariant();
        foreach (var c in categorias)
        {
            var compativel = tipo == TipoTransacao.Despesa
                ? c.Finalidade is Finalidade.Despesa or Finalidade.Ambas or Finalidade.Investimento
                : c.Finalidade is Finalidade.Receita or Finalidade.Ambas or Finalidade.Investimento;
            if (!compativel)
                continue;

            if (c.Descricao.Length >= 3 && descLower.Contains(c.Descricao.ToLowerInvariant()))
                return c;
        }
        return null;
    }

    private async Task ExigirContaAsync(Guid contaId, Guid usuarioId)
    {
        var existe = await _context.Contas
            .AnyAsync(c => c.Id == contaId && c.UsuarioIdProprietario == usuarioId);
        if (!existe)
            throw new KeyNotFoundException("Conta não encontrada.");
    }
}

using System.Text.RegularExpressions;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Importacao;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Importar a fatura do cartão (docs/features/cartao-credito/fatura-a-detalhar.md, passo 3; Gustavo 2026-11-22: "eu
/// jogo os extratos aqui, ele já se vira"). Lê CSV/OFX de fatura com o MESMO leitor do extrato de conta (colunas
/// reconhecidas pelo nome ou conteúdo; banco novo entra como dado, nunca "se for o banco X") e:
/// <list type="bullet">
/// <item>compra à vista vira lançamento no cartão (na fatura do ciclo dela), com a categoria que o app sabe (regra,
/// histórico, coletivo, conhecido); sem certeza, fica sem categoria e cai na fila de Pendentes;</item>
/// <item>"Loja - 3/10" vira UM parcelamento (regra do projeto: compra parcelada nunca é N lançamentos soltos), com as
/// parcelas que a fatura mostrou nas faturas delas e as que faltam nas seguintes; as de antes do primeiro arquivo
/// contam como pagas antes;</item>
/// <item>"Pagamento recebido" fica de fora (é o outro lado do pagamento que saiu da conta) e crédito/estorno do cartão
/// também, por enquanto (o total da fatura do app ainda não desconta crédito);</item>
/// <item>o pagamento de fatura que veio do extrato da conta sem fatura (o "Cartão a detalhar") é ligado à fatura que
/// ele pagou, senão contava duas vezes; fatura que já venceu e o banco já cobrou fica paga (fora do app).</item>
/// </list>
/// O sinal do arquivo não é o mesmo em todo banco: o lado com MAIS linhas é o das compras.
/// A compra veio da fatura do banco, então o limite do app não barra (já aconteceu).
/// </summary>
public class ImportacaoCartaoService
{
    public const string OperacaoImportarFatura = "ImportarFatura";
    /// <summary>Um pagamento é da fatura que vence até 5 dias antes dele (fim de semana, compensação) ou depois.</summary>
    private const int ToleranciaPagamentoDias = 5;

    private readonly AppDbContext _context;
    private readonly ExtratoImportService _leitor;
    private readonly TransacaoService _transacoes;
    private readonly ImportacaoService _importacao;
    private readonly FaturaService _faturas;
    private readonly FinancialEventLogService _eventLog;

    public ImportacaoCartaoService(AppDbContext context, ExtratoImportService leitor, TransacaoService transacoes,
        ImportacaoService importacao, FinancialEventLogService eventLog)
    {
        _context = context;
        _leitor = leitor;
        _transacoes = transacoes;
        _importacao = importacao;
        _faturas = new FaturaService(context);
        _eventLog = eventLog;
    }

    // ── Leitura ─────────────────────────────────────────────────────────────────────────────────────────────

    internal enum TipoLinha { Compra, Credito, PagamentoRecebido, PixNoCredito }

    internal sealed record Linha(DateOnly Data, string Descricao, decimal Valor, string? FitId, TipoLinha Tipo,
        string Base, int? Parcela, int? DeParcelas);

    internal sealed class Grupo
    {
        public required string Base { get; init; }
        public required int N { get; init; }
        public required decimal ValorRef { get; set; }
        public SortedDictionary<int, Linha> Conhecidas { get; } = new();
    }

    internal sealed record Leitura(List<Linha> AVista, List<Grupo> Parcelados, List<Linha> PixNoCredito, int Pagamentos,
        int Creditos, decimal ValorCreditos, List<ArquivoLidoDto> Arquivos);

    /// <summary>
    /// "Pix no Crédito - Fulano" (Nubank): o cartão pagou um Pix. O GASTO é o Pix, que já entra pelo extrato da conta
    /// (a entrada do cartão lá é só registro, <c>Transacao.EhPixNoCredito</c>). Na fatura ele entra do mesmo jeito: no
    /// total da fatura (o banco cobra), fora do gasto, sem categoria e sem virar parcelamento (as parcelas, "- 1/2",
    /// entram uma a uma, como o banco cobra). Senão o mesmo Pix contava duas vezes.
    /// </summary>
    internal static bool EhPixNoCredito(string descricao) =>
        Regex.IsMatch(descricao.Trim(), @"^pix\s+(no\s+)?cr[eé]dito\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static readonly Regex RegexParcela = new(
        @"^(?<base>.*?)[\s\-–]*(?:parcela\s*)?(?<k>\d{1,2})\s*/\s*(?<n>\d{1,2})\s*$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(200));

    /// <summary>"Loja - 3/10" → ("Loja", 3, 10). Só vale 1 ≤ k ≤ n, 2 ≤ n ≤ 36 (o teto do parcelamento).</summary>
    internal static (string Base, int K, int N)? LerParcela(string descricao)
    {
        var m = RegexParcela.Match(descricao.Trim());
        if (!m.Success) return null;
        var k = int.Parse(m.Groups["k"].Value);
        var n = int.Parse(m.Groups["n"].Value);
        var b = m.Groups["base"].Value.Trim().TrimEnd('-', '–', ' ');
        if (n < 2 || n > 36 || k < 1 || k > n || b.Length == 0) return null;
        return (b, k, n);
    }

    /// <summary>O "Pagamento recebido" da fatura: o pagamento que saiu da conta, visto do lado do cartão.</summary>
    internal static bool EhPagamentoRecebido(string descricao)
    {
        var d = descricao.ToLowerInvariant();
        return (d.Contains("pagamento") || d.Contains("pagto") || d.StartsWith("pag "))
               && (d.Contains("recebido") || d.Contains("efetuado") || d.Contains("fatura") || d.Contains("obrigado"));
    }

    internal Leitura Ler(IReadOnlyList<(string Nome, string Conteudo)> arquivos)
    {
        if (arquivos.Count == 0) throw new ArgumentException("Envie o arquivo da fatura.");
        if (arquivos.Count > ImportacaoService.MaxArquivos)
            throw new ArgumentException($"Envie no máximo {ImportacaoService.MaxArquivos} arquivos por vez.");

        var relatorio = new List<ArquivoLidoDto>();
        var todas = new List<Linha>();
        var vistas = new HashSet<string>();
        foreach (var (nome, conteudo) in arquivos)
        {
            if (string.IsNullOrWhiteSpace(conteudo)) { relatorio.Add(new ArquivoLidoDto(nome, 0, "O arquivo está vazio.")); continue; }
            ExtratoImportService.LeituraExtrato leitura;
            try { leitura = _leitor.Ler(nome, conteudo, null); }
            catch (ArgumentException e) { relatorio.Add(new ArquivoLidoDto(nome, 0, e.Message)); continue; }
            catch (Exception e) when (e is FormatException or InvalidOperationException)
            {
                relatorio.Add(new ArquivoLidoDto(nome, 0, "Não deu pra ler esse arquivo."));
                continue;
            }
            if (leitura.PrecisaMapear)
            {
                relatorio.Add(new ArquivoLidoDto(nome, 0, "Não reconhecemos as colunas desse arquivo."));
                continue;
            }
            // O lado das compras é o que tem mais linhas (cada banco usa um sinal).
            var positivas = leitura.Linhas.Count(l => l.Valor > 0);
            var compraPositiva = positivas * 2 >= leitura.Linhas.Count(l => l.Valor != 0);
            var doArquivo = 0;
            var noArquivo = new Dictionary<string, int>();
            foreach (var l in leitura.Linhas.Where(l => l.Valor != 0))
            {
                // O mesmo lançamento em dois arquivos entra uma vez; duas compras iguais no mesmo arquivo (dois cafés)
                // são duas: a chave leva quantas vezes ela já apareceu NESTE arquivo.
                var chave = l.FitId ?? $"{l.Data:yyyy-MM-dd}|{l.Valor}|{l.Descricao.Trim()}";
                var vez = noArquivo[chave] = noArquivo.GetValueOrDefault(chave) + 1;
                if (!vistas.Add($"{chave}#{vez}")) continue;
                var descricao = l.Descricao.Trim();
                var ehCompra = l.Valor > 0 == compraPositiva;
                var tipo = !ehCompra ? (EhPagamentoRecebido(descricao) ? TipoLinha.PagamentoRecebido : TipoLinha.Credito)
                    : EhPixNoCredito(descricao) ? TipoLinha.PixNoCredito : TipoLinha.Compra;
                var parcela = tipo == TipoLinha.Compra ? LerParcela(descricao) : null;
                todas.Add(new Linha(DateOnly.FromDateTime(l.Data), descricao.Length > 255 ? descricao[..255] : descricao,
                    Math.Abs(l.Valor), l.FitId, tipo, parcela?.Base ?? descricao, parcela?.K, parcela?.N));
                doArquivo++;
            }
            relatorio.Add(new ArquivoLidoDto(nome, doArquivo));
        }

        var grupos = new List<Grupo>();
        foreach (var l in todas.Where(l => l.Tipo == TipoLinha.Compra && l.Parcela is not null).OrderBy(l => l.Data))
        {
            var g = grupos.FirstOrDefault(g => g.N == l.DeParcelas && !g.Conhecidas.ContainsKey(l.Parcela!.Value)
                && string.Equals(g.Base, l.Base, StringComparison.OrdinalIgnoreCase)
                && Math.Abs(g.ValorRef - l.Valor) <= Math.Max(0.10m, l.Valor * 0.02m));
            if (g is null)
            {
                g = new Grupo { Base = l.Base, N = l.DeParcelas!.Value, ValorRef = l.Valor };
                grupos.Add(g);
            }
            g.Conhecidas[l.Parcela!.Value] = l;
        }
        var credito = todas.Where(l => l.Tipo == TipoLinha.Credito).ToList();
        return new Leitura(
            todas.Where(l => l.Tipo == TipoLinha.Compra && l.Parcela is null).ToList(),
            grupos,
            todas.Where(l => l.Tipo == TipoLinha.PixNoCredito).ToList(),
            todas.Count(l => l.Tipo == TipoLinha.PagamentoRecebido),
            credito.Count, credito.Sum(l => l.Valor), relatorio);
    }

    /// <summary>Dia da compra de um parcelamento: o da parcela 1, ou o da menor conhecida voltando um mês por parcela.</summary>
    internal static DateOnly DataDaCompra(Grupo g)
    {
        var (k, l) = g.Conhecidas.First();
        return l.Data.AddMonths(-(k - 1));
    }

    /// <summary>Valor de cada parcela (a conhecida, senão a da última conhecida) e o total.</summary>
    internal static decimal ValorDaParcela(Grupo g, int k) =>
        g.Conhecidas.TryGetValue(k, out var l) ? l.Valor : g.Conhecidas.Last().Value.Valor;

    /// <summary>Um dia no ciclo da parcela k: o dela, senão o da conhecida mais perto andando os meses.</summary>
    internal static DateOnly DiaDaParcela(Grupo g, int k)
    {
        if (g.Conhecidas.TryGetValue(k, out var l)) return l.Data;
        var perto = g.Conhecidas.OrderBy(x => Math.Abs(x.Key - k)).First();
        return perto.Value.Data.AddMonths(k - perto.Key);
    }

    // ── Pagamentos da conta ─────────────────────────────────────────────────────────────────────────────────

    internal sealed record Pagamento(Guid Id, DateOnly Data, decimal Valor);

    /// <summary>
    /// De que fatura é cada pagamento (índice do pagamento → índice da fatura). Em ordem de data, o pagamento vai pra
    /// fatura de vencimento mais antigo que ainda deve e cujo ciclo já começou no dia dele, até 5 dias depois do
    /// vencimento (fim de semana, compensação). Pagar ANTES do fechamento vale (o Nubank e outros deixam adiantar: o
    /// dinheiro abate a fatura aberta). Só fica de fora o pagamento que cai na janela de pagar uma fatura que NÃO veio
    /// nos arquivos (fechou há pouco e não está na lista): ele é dela, e segue "a detalhar" em vez de quitar a errada.
    /// </summary>
    internal static Dictionary<int, int> Atribuir(IReadOnlyList<Pagamento> pagamentos,
        IReadOnlyList<(DateOnly Fechamento, DateOnly Vencimento, decimal Restante)> faturas)
    {
        var restante = faturas.Select(f => f.Restante).ToArray();
        var ordem = Enumerable.Range(0, faturas.Count).OrderBy(i => faturas[i].Vencimento).ToList();
        var fechamentos = faturas.Select(f => f.Fechamento).ToHashSet();
        var resultado = new Dictionary<int, int>();
        foreach (var p in Enumerable.Range(0, pagamentos.Count).OrderBy(i => pagamentos[i].Data))
        {
            var dia = pagamentos[p].Data;
            var alvo = ordem.FirstOrDefault(i => restante[i] > 0
                && faturas[i].Fechamento.AddMonths(-1) < dia
                && faturas[i].Vencimento >= dia.AddDays(-ToleranciaPagamentoDias), -1);
            if (alvo < 0) continue;
            // Ainda na janela de pagar a fatura anterior, e ela não veio nos arquivos: o pagamento é dela.
            var anterior = faturas[alvo].Fechamento.AddMonths(-1);
            if (dia <= faturas[alvo].Vencimento.AddMonths(-1).AddDays(ToleranciaPagamentoDias) && !fechamentos.Contains(anterior))
                continue;
            resultado[p] = alvo;
            restante[alvo] = Math.Max(0m, restante[alvo] - pagamentos[p].Valor);
        }
        return resultado;
    }

    private async Task<CartaoCredito> CartaoAsync(Guid cartaoId, Guid usuarioId)
    {
        await DonoRecursos.ExigirCartaoAsync(_context, cartaoId, usuarioId);
        var cartao = await _context.CartoesCredito.FirstAsync(c => c.Id == cartaoId);
        if (!cartao.TemCredito) throw new InvalidOperationException("Esse cartão não tem crédito.");
        if (!cartao.Ativo) throw new InvalidOperationException("Esse cartão está desativado.");
        return cartao;
    }

    /// <summary>
    /// Os pagamentos de fatura que vieram do extrato da conta sem fatura no app (o "Cartão a detalhar"). Só da conta
    /// ligada ao cartão; cartão sem conta ligada só usa quando ele é o único cartão de crédito da pessoa (senão não dá
    /// pra saber de qual cartão foi o pagamento).
    /// </summary>
    private async Task<List<Transacao>> PagamentosSoltosAsync(CartaoCredito cartao, Guid usuarioId, DateOnly de, DateOnly ate)
    {
        var query = _context.Transacoes.Where(t => t.CriadoPor == usuarioId && t.EhPagamentoFatura && t.FaturaPagaId == null
            && t.Ativo && t.StatusTransacao == StatusTransacao.Executado && t.Tipo == TipoTransacao.Despesa
            && t.Data >= de && t.Data <= ate && t.ContaId != null);
        if (cartao.ContaId is { } contaId)
            query = query.Where(t => t.ContaId == contaId);
        else if (await _context.CartoesCredito.CountAsync(c => c.CriadoPor == usuarioId && c.Ativo && c.TemCredito) != 1)
            return [];
        return await query.OrderBy(t => t.Data).ThenBy(t => t.CriadoEm).ToListAsync();
    }

    private (DateTime Fechamento, DateOnly Vencimento) CicloDe(CartaoCredito cartao, DateOnly dia)
    {
        var (_, fechamento) = FaturaService.CalcularPeriodo(dia.ToDateTime(TimeOnly.MinValue), cartao.DiaFechamento);
        return (fechamento, DateOnly.FromDateTime(FaturaService.CalcularVencimento(fechamento, cartao.DiaVencimento)));
    }

    // ── Prévia ──────────────────────────────────────────────────────────────────────────────────────────────

    public async Task<PreviewFaturaDto> PreviewAsync(Guid cartaoId, Guid usuarioId, IReadOnlyList<(string Nome, string Conteudo)> arquivos)
    {
        var cartao = await CartaoAsync(cartaoId, usuarioId);
        var leitura = Ler(arquivos);
        var (novas, gruposNovos, jaNoApp) = await SepararNovasAsync(cartao, usuarioId, leitura);

        // As faturas que os arquivos tocam: compra à vista no ciclo da data dela; parcela no ciclo do dia dela.
        var porFatura = new Dictionary<DateTime, (DateOnly Venc, int Qtd, decimal Valor)>();
        void Somar(DateOnly dia, decimal valor)
        {
            var (fech, venc) = CicloDe(cartao, dia);
            var atual = porFatura.GetValueOrDefault(fech, (venc, 0, 0m));
            porFatura[fech] = (venc, atual.Item2 + 1, atual.Item3 + valor);
        }
        foreach (var l in novas) Somar(l.Data, l.Valor);
        foreach (var g in gruposNovos)
            for (var k = g.Conhecidas.First().Key; k <= g.N; k++) Somar(DiaDaParcela(g, k), ValorDaParcela(g, k));

        var lista = porFatura.OrderBy(kv => kv.Value.Venc)
            .Select(kv => (Fech: DateOnly.FromDateTime(kv.Key), kv.Value.Venc, kv.Value.Qtd, kv.Value.Valor)).ToList();
        var pagas = new decimal[lista.Count];
        if (lista.Count > 0)
        {
            var soltos = await PagamentosSoltosAsync(cartao, usuarioId,
                lista[0].Fech.AddMonths(-1), lista[^1].Venc.AddDays(ToleranciaPagamentoDias));
            var pagamentos = soltos.Select(t => new Pagamento(t.Id, t.Data, t.Valor)).ToList();
            foreach (var (p, f) in Atribuir(pagamentos, lista.Select(f => (f.Fech, f.Venc, f.Valor)).ToList()))
                pagas[f] += pagamentos[p].Valor;
        }
        var hoje = HorarioBrasil.Hoje();
        var faturas = lista.Select((f, i) => new FaturaLidaDto(f.Venc, f.Qtd, f.Valor,
            pagas[i] > 0 ? "paga-pela-conta" : f.Venc < hoje ? "paga" : "a-pagar", pagas[i])).ToList();

        var compras = novas.Where(l => l.Tipo == TipoLinha.Compra).ToList();
        var sugestoes = await _importacao.CategoriasSugeridasAsync(usuarioId,
            compras.Select(l => (l.Descricao, TipoTransacao.Despesa)).ToList());
        return new PreviewFaturaDto(novas.Count, novas.Sum(l => l.Valor), gruposNovos.Count, jaNoApp,
            leitura.Pagamentos, leitura.Creditos, leitura.ValorCreditos, sugestoes.Count(s => s is null),
            faturas, leitura.Arquivos);
    }

    /// <summary>O que ainda não está no cartão: compra à vista pelo código do banco ou por data, valor e texto;
    /// parcelamento pela descrição, número de parcelas e dia da compra (até 40 dias de diferença).</summary>
    private async Task<(List<Linha> Novas, List<Grupo> Grupos, int JaNoApp)> SepararNovasAsync(CartaoCredito cartao, Guid usuarioId, Leitura leitura)
    {
        var existentes = await _context.Transacoes.AsNoTracking()
            .Where(t => t.CartaoCreditoId == cartao.Id && t.Ativo)
            .Select(t => new { t.Data, t.Valor, t.Descricao, t.ImportacaoFitId })
            .ToListAsync();
        var fitIds = existentes.Where(e => e.ImportacaoFitId != null).Select(e => e.ImportacaoFitId!).ToHashSet();
        var chaves = existentes.Select(e => (e.Data, e.Valor, e.Descricao)).ToHashSet();
        // À vista e Pix no Crédito: os dois viram um lançamento por linha no cartão (o Pix marcado, fora do gasto).
        var linhas = leitura.AVista.Concat(leitura.PixNoCredito).ToList();
        var novas = linhas.Where(l => !(l.FitId is not null && fitIds.Contains(l.FitId)) && !chaves.Contains((l.Data, l.Valor, l.Descricao))).ToList();

        var parcelamentos = await _context.Parcelamentos.AsNoTracking()
            .Where(p => p.CartaoCreditoId == cartao.Id && p.CriadoPor == usuarioId && p.Ativo)
            .Select(p => new { p.Descricao, p.QuantidadeParcelas, p.DataCompra })
            .ToListAsync();
        var grupos = leitura.Parcelados.Where(g =>
        {
            var compra = DataDaCompra(g).ToDateTime(TimeOnly.MinValue);
            return !parcelamentos.Any(p => p.QuantidadeParcelas == g.N
                && string.Equals(p.Descricao, g.Base, StringComparison.OrdinalIgnoreCase)
                && Math.Abs((p.DataCompra - compra).TotalDays) <= 40);
        }).ToList();
        var jaNoApp = linhas.Count - novas.Count
            + leitura.Parcelados.Except(grupos).Sum(g => g.Conhecidas.Count);
        return (novas, grupos, jaNoApp);
    }

    // ── Importar ────────────────────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Grava tudo numa transação só (tudo ou nada). Relê os arquivos aqui (nada da prévia é confiado). Exige
    /// Idempotency-Key: repetir a mesma importação não grava de novo.
    /// </summary>
    public async Task<ResultadoFaturaDto> ImportarAsync(Guid cartaoId, Guid usuarioId,
        IReadOnlyList<(string Nome, string Conteudo)> arquivos, string? idempotencyKey)
    {
        if (string.IsNullOrWhiteSpace(idempotencyKey))
            throw new ArgumentException("O header Idempotency-Key é obrigatório para importar a fatura.");
        Idempotencia.ExigirTamanho(idempotencyKey);
        var cartao = await CartaoAsync(cartaoId, usuarioId);
        if (await Idempotencia.BuscarAsync(_context, usuarioId, OperacaoImportarFatura, idempotencyKey) is not null)
            return new ResultadoFaturaDto(0, 0, 0, 0, 0, 0, Repetido: true);

        var leitura = Ler(arquivos);
        var proprioTx = _context.Database.CurrentTransaction is null && _context.Database.IsRelational();
        await using var tx = proprioTx ? await _context.Database.BeginTransactionAsync() : null;
        try
        {
            _context.RegistrosIdempotencia.Add(Idempotencia.Novo(usuarioId, OperacaoImportarFatura, idempotencyKey, cartao.Id));
            await _context.SaveChangesAsync();

            var (novas, grupos, jaNoApp) = await SepararNovasAsync(cartao, usuarioId, leitura);
            var tocadas = new HashSet<Guid>();
            var sugestoes = await _importacao.CategoriasSugeridasAsync(usuarioId,
                novas.Select(l => (l.Descricao, TipoTransacao.Despesa))
                    .Concat(grupos.Select(g => (g.Base, TipoTransacao.Despesa))).ToList());
            var semCategoria = 0;

            foreach (var (l, i) in novas.Select((l, i) => (l, i)))
            {
                // Pix no Crédito: o gasto já é o PIX que saiu da conta (extrato da conta); aqui é só o que a fatura
                // cobra, sem categoria e fora do resultado, pra não contar o mesmo dinheiro duas vezes.
                var pix = l.Tipo == TipoLinha.PixNoCredito;
                var t = new Transacao
                {
                    Id = Guid.NewGuid(), Descricao = l.Descricao, Valor = l.Valor, Tipo = TipoTransacao.Despesa, Data = l.Data,
                    CartaoCreditoId = cartao.Id, CategoriaId = pix ? null : sugestoes[i], StatusTransacao = StatusTransacao.Executado,
                    Ativo = true, ImportacaoFitId = l.FitId, EhPixNoCredito = pix,
                };
                await _transacoes.CriarTransacaoAsync(t, usuarioId, conferirLimite: false);
                if (t.FaturaId is { } f) tocadas.Add(f);
                if (t.CategoriaId is null && !pix) semCategoria++;
            }

            // Parcelamento só aceita categoria de despesa (ou "ambas").
            var paraParcela = await _context.Categorias.AsNoTracking()
                .Where(c => c.Finalidade == Finalidade.Despesa || c.Finalidade == Finalidade.Ambas)
                .Select(c => c.Id).ToListAsync();
            var correlacao = Guid.NewGuid();
            foreach (var (g, j) in grupos.Select((g, j) => (g, j)))
            {
                var sugerida = sugestoes[novas.Count + j];
                var categoria = sugerida is { } s && paraParcela.Contains(s) ? sugerida : null;
                var primeira = g.Conhecidas.First().Key;
                var total = Enumerable.Range(1, g.N).Sum(k => ValorDaParcela(g, k));
                var parcelamento = new Parcelamento
                {
                    Id = Guid.NewGuid(), CriadoPor = usuarioId, Tipo = TipoParcelamento.CompraParcelada,
                    Descricao = g.Base.Length > 255 ? g.Base[..255] : g.Base,
                    DataCompra = DataDaCompra(g).ToDateTime(TimeOnly.MinValue), ValorTotal = total,
                    QuantidadeParcelas = g.N, ParcelasPagasAntes = primeira - 1, CartaoCreditoId = cartao.Id,
                    CategoriaId = categoria, Ativo = true, CriadoEm = DateTime.UtcNow,
                };
                _context.Parcelamentos.Add(parcelamento);
                for (var k = primeira; k <= g.N; k++)
                {
                    var fatura = await _faturas.ObterOuCriarFaturaAsync(cartao.Id, DiaDaParcela(g, k), usuarioId);
                    tocadas.Add(fatura.Id);
                    _context.ParcelasTransacao.Add(new ParcelaTransacao
                    {
                        Id = Guid.NewGuid(), ParcelamentoId = parcelamento.Id, Numero = k, QuantidadeTotal = g.N,
                        DataVencimento = fatura.DataVencimento, Valor = ValorDaParcela(g, k), FaturaId = fatura.Id,
                        Status = StatusParcela.Pendente, CriadoPor = usuarioId, CriadoEm = DateTime.UtcNow,
                    });
                }
                if (categoria is null) semCategoria++;
                _eventLog.Registrar(usuarioId, FinancialEventType.ParcelamentoCriado, "Parcelamento", parcelamento.Id,
                    correlacao, "ImportacaoFatura", null, total,
                    new { parcelas = g.N, parcelasJaPagas = primeira - 1, cartaoCreditoId = cartao.Id });
            }
            await _context.SaveChangesAsync();

            var (ligados, pagas) = await AcertarFaturasAsync(cartao, usuarioId, tocadas, correlacao);
            await _context.SaveChangesAsync();
            if (tx is not null) await tx.CommitAsync();
            return new ResultadoFaturaDto(novas.Count, grupos.Count, jaNoApp, ligados, pagas, semCategoria);
        }
        catch (DbUpdateException e) when (Idempotencia.EhViolacaoDeUnicidade(e))
        {
            return new ResultadoFaturaDto(0, 0, 0, 0, 0, 0, Repetido: true);
        }
    }

    /// <summary>
    /// Depois de pôr as compras nas faturas: fatura que já fechou fica fechada; o pagamento solto que saiu da conta é
    /// ligado à fatura que ele pagou (soma no pago dela e sai do "Cartão a detalhar"); e a fatura que já venceu e ainda
    /// ficou devendo conta como paga fora do app (o banco já cobrou; se tivesse ficado em aberto, viriam juros na fatura
    /// seguinte, que entram como compra). Não cobra nada: só o registro.
    /// </summary>
    private async Task<(int Ligados, int Pagas)> AcertarFaturasAsync(CartaoCredito cartao, Guid usuarioId, HashSet<Guid> tocadas, Guid correlacao)
    {
        if (tocadas.Count == 0) return (0, 0);
        var faturas = await _context.Faturas
            .Include(f => f.Transacoes).Include(f => f.ParcelasTransacao)
            .Where(f => tocadas.Contains(f.Id))
            .OrderBy(f => f.DataVencimento)
            .ToListAsync();
        var agora = DateTime.UtcNow;
        var hoje = HorarioBrasil.HojeData();
        foreach (var f in faturas.Where(f => f.DataFechamento <= hoje && f.EstadoCiclo == EstadoCicloFatura.Aberta))
            f.EstadoCiclo = EstadoCicloFatura.Fechada;

        var soltos = await PagamentosSoltosAsync(cartao, usuarioId,
            DateOnly.FromDateTime(faturas[0].DataFechamento).AddMonths(-1),
            DateOnly.FromDateTime(faturas[^1].DataVencimento).AddDays(ToleranciaPagamentoDias));
        var atribuicao = Atribuir(soltos.Select(t => new Pagamento(t.Id, t.Data, t.Valor)).ToList(),
            faturas.Select(f => (DateOnly.FromDateTime(f.DataFechamento), DateOnly.FromDateTime(f.DataVencimento),
                RegrasFinanceiras.ValorRestanteFatura(f))).ToList());
        foreach (var (p, i) in atribuicao.OrderBy(x => soltos[x.Key].Data))
        {
            var pagamento = soltos[p];
            var fatura = faturas[i];
            var antes = fatura.ValorPago;
            pagamento.FaturaPagaId = fatura.Id;
            fatura.ValorPago += pagamento.Valor;
            var quitou = RegrasFinanceiras.ValorRestanteFatura(fatura) == 0;
            if (!RegrasFinanceiras.ReconciliarEstadoPagamento(fatura, agora) && !quitou)
                fatura.EstadoPagamento = EstadoPagamentoFatura.Parcial;
            _eventLog.Registrar(usuarioId, quitou ? FinancialEventType.FaturaPagaTotal : FinancialEventType.FaturaPagaParcial,
                "Fatura", fatura.Id, correlacao, "ImportacaoFatura", antes, fatura.ValorPago,
                new { motivo = "PagamentoDoExtratoLigado", transacaoId = pagamento.Id });
        }

        var pagas = 0;
        foreach (var f in faturas.Where(f => f.DataVencimento < hoje && RegrasFinanceiras.ValorRestanteFatura(f) > 0))
        {
            f.ValorPago += RegrasFinanceiras.ValorRestanteFatura(f);
            if (RegrasFinanceiras.ReconciliarEstadoPagamento(f, agora))
                RegrasFinanceiras.RegistrarQuitacaoSemPagamentoNovo(_eventLog, f, usuarioId, correlacao, "ImportacaoFatura", "FaturaAntigaDoBanco");
            pagas++;
        }
        return (atribuicao.Count, pagas);
    }
}

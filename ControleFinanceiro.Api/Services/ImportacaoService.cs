using System.Security.Cryptography;
using System.Text;
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
        Guid contaId, Guid usuarioId, string nomeArquivo, string conteudo, MapeamentoCsvDto? mapeamento = null)
    {
        await ExigirContaAsync(contaId, usuarioId);

        var ehCsv = Path.GetExtension(nomeArquivo).Equals(".csv", StringComparison.OrdinalIgnoreCase);
        ExtratoImportService.TabelaCsv? tabela = ehCsv ? _extratoImport.LerTabela(conteudo) : null;
        var mapa = mapeamento is null ? null : ParaMapa(mapeamento);
        var lembrado = false;
        if (tabela is not null && mapa is null)
        {
            var salvo = await _context.ModelosImportacao.AsNoTracking()
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
        };
        if (leitura.PrecisaMapear)
            return ComTabela(new PreviewImportacaoDto(new(), 0, 0, PrecisaMapear: true));

        var lidas = leitura.Linhas;

        // Transações ativas da conta para deduplicação.
        var existentes = await _context.Transacoes
            .Where(t => t.ContaId == contaId && t.Ativo)
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
        var pixNoCredito = PernasDePixNoCredito(paraRegra.Select(l => (l.Data, l.Valor, l.Tipo, l.Descricao)).ToList());
        var faturasPagas = await ResolverPagamentosDeFaturaAsync(contaId, usuarioId, paraRegra);

        // Pagamento de fatura já registrado no app (pela tela, ou importado de outro arquivo sem FITID): o
        // mesmo valor perto da mesma data. Importar de novo debitaria a conta 2x.
        var pagamentosNoApp = await _context.Transacoes
            .Where(t => t.ContaId == contaId && t.Ativo && t.EhPagamentoFatura)
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
            var categoria = faturaPaga is null ? SugerirCategoria(linha.Descricao, tipo, categorias) : null;

            linhas.Add(new ExtratoLinhaDto(
                linha.Data, linha.Descricao, valor, tipo, linha.FitId, duplicada,
                categoria?.Id, categoria?.Descricao, pixNoCredito[i], faturaPaga?.DataFechamento));
        }

        return ComTabela(new PreviewImportacaoDto(
            linhas, linhas.Count, linhas.Count(l => l.Duplicada)));
    }

    private static ExtratoImportService.MapeamentoCsv ParaMapa(MapeamentoCsvDto m) =>
        new(m.Data, m.Descricao, m.Valor, m.Entrada, m.Saida, m.Id, m.InverterSinal);

    private static ExtratoImportService.MapeamentoCsv ParaMapa(ModeloImportacao m) =>
        new(m.ColunaData, m.ColunaDescricao, m.ColunaValor, m.ColunaEntrada, m.ColunaSaida, m.ColunaId, m.InverterSinal);

    private static MapeamentoCsvDto ParaDto(ExtratoImportService.MapeamentoCsv m) =>
        new(m.Data, m.Descricao, m.Valor, m.Entrada, m.Saida, m.Id, m.InverterSinal);

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

        var importadas = 0;
        foreach (var (linha, i) in dto.Linhas.Select((l, i) => (l, i)))
        {
            if (linha.FitId is not null && !jaNaConta.Add(linha.FitId))
            {
                jaExistiam++;
                continue;
            }
            if (faturasPagas.TryGetValue(i, out var fatura))
            {
                await PagarFaturaDoExtratoAsync(dto.ContaId, usuarioId, fatura, linha);
                importadas++;
                continue;
            }

            var transacao = new Transacao
            {
                Id = Guid.NewGuid(),
                Descricao = linha.Descricao,
                Valor = linha.Valor,
                Tipo = linha.Tipo,
                Data = DateOnly.FromDateTime(linha.Data),
                Hora = null, // lançamento importado de extrato é datado (sem hora de relógio)
                ContaId = dto.ContaId,
                CategoriaId = linha.CategoriaId,
                StatusTransacao = StatusTransacao.Executado,
                Ativo = true,
                ImportacaoFitId = linha.FitId,
                EhPixNoCredito = pixNoCredito[i],
            };

            await _transacaoService.CriarTransacaoAsync(transacao, usuarioId);
            importadas++;
        }

        return new ResultadoImportacaoDto(importadas, jaExistiam);
    }

    private record CategoriaResumo(Guid Id, string Descricao, Finalidade Finalidade);

    // ── Pagamento de fatura no extrato ─────────────────────────────────────────

    /// <summary>"Pagamento de fatura" (Nubank), "Pagto fatura"… — a saída da conta que paga o cartão.</summary>
    private static bool EhPagamentoDeFatura(string descricao) =>
        descricao.Contains("fatura", StringComparison.OrdinalIgnoreCase)
        && (descricao.Contains("pagamento", StringComparison.OrdinalIgnoreCase)
            || descricao.Contains("pagto", StringComparison.OrdinalIgnoreCase)
            || descricao.StartsWith("pag ", StringComparison.OrdinalIgnoreCase));

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
    /// pernas se anulam no saldo e nenhuma é receita/despesa: o gasto é do cartão (a compra na fatura; no
    /// histórico sem a fatura, o pagamento dela). Contar as duas inflava receitas E despesas — a despesa em
    /// dobro (o Pix + o pagamento da fatura). A entrada é marcada pelo texto; cada uma leva junto o Pix
    /// enviado do mesmo dia e valor que ainda estiver livre (o mais perto depois dela, senão antes). Só
    /// dentro do mesmo lote: entrada e Pix são do mesmo dia, então vêm no mesmo extrato.
    /// </summary>
    public static bool[] PernasDePixNoCredito(
        IReadOnlyList<(DateOnly Data, decimal Valor, TipoTransacao Tipo, string Descricao)> linhas)
    {
        var marcadas = new bool[linhas.Count];
        for (var i = 0; i < linhas.Count; i++)
        {
            var entrada = linhas[i];
            if (entrada.Tipo != TipoTransacao.Receita || !EhEntradaDePixNoCredito(entrada.Descricao))
                continue;
            marcadas[i] = true;

            var pix = Enumerable.Range(0, linhas.Count)
                .Where(k => !marcadas[k]
                            && linhas[k].Tipo == TipoTransacao.Despesa
                            && linhas[k].Data == entrada.Data
                            && linhas[k].Valor == entrada.Valor
                            && linhas[k].Descricao.Contains("pix", StringComparison.OrdinalIgnoreCase))
                .OrderBy(k => k > i ? k - i : linhas.Count + (i - k))
                .DefaultIfEmpty(-1)
                .First();
            if (pix >= 0)
                marcadas[pix] = true;
        }
        return marcadas;
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
                ? c.Finalidade is Finalidade.Despesa or Finalidade.Ambas
                : c.Finalidade is Finalidade.Receita or Finalidade.Ambas;
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

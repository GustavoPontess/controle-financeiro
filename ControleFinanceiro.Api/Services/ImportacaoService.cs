using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
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

    public ImportacaoService(
        AppDbContext context,
        ExtratoImportService extratoImport,
        TransacaoService transacaoService)
    {
        _context = context;
        _extratoImport = extratoImport;
        _transacaoService = transacaoService;
    }

    /// <summary>Lê o extrato e devolve a preview: linhas parseadas, deduplicadas
    /// e com sugestão de categoria. Nada é persistido.</summary>
    public async Task<PreviewImportacaoDto> PreviewAsync(
        Guid contaId, Guid usuarioId, string nomeArquivo, string conteudo)
    {
        await ExigirContaAsync(contaId, usuarioId);

        var lidas = _extratoImport.Parse(nomeArquivo, conteudo);

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

        var pixNoCredito = PernasDePixNoCredito(lidas
            .Select(l => (DateOnly.FromDateTime(l.Data), Math.Abs(l.Valor),
                          l.Valor < 0 ? TipoTransacao.Despesa : TipoTransacao.Receita, l.Descricao))
            .ToList());

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

            var categoria = SugerirCategoria(linha.Descricao, tipo, categorias);

            linhas.Add(new ExtratoLinhaDto(
                linha.Data, linha.Descricao, valor, tipo, linha.FitId, duplicada,
                categoria?.Id, categoria?.Descricao, pixNoCredito[i]));
        }

        return new PreviewImportacaoDto(
            linhas, linhas.Count, linhas.Count(l => l.Duplicada));
    }

    /// <summary>Cria as transações aprovadas pelo usuário na conta indicada.</summary>
    public async Task<ResultadoImportacaoDto> ConfirmarAsync(
        ConfirmarImportacaoDto dto, Guid usuarioId)
    {
        await ExigirContaAsync(dto.ContaId, usuarioId);

        if (dto.Linhas.Count == 0)
            throw new ArgumentException("Nenhuma linha selecionada para importação.");

        // Detecta de novo aqui, no servidor — a flag da prévia é só pra mostrar.
        var pixNoCredito = PernasDePixNoCredito(dto.Linhas
            .Select(l => (DateOnly.FromDateTime(l.Data), l.Valor, l.Tipo, l.Descricao))
            .ToList());

        var importadas = 0;
        foreach (var (linha, i) in dto.Linhas.Select((l, i) => (l, i)))
        {
            if (linha.Valor <= 0)
                throw new ArgumentException("O valor de cada transação deve ser positivo.");

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

        return new ResultadoImportacaoDto(importadas);
    }

    private record CategoriaResumo(Guid Id, string Descricao, Finalidade Finalidade);

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

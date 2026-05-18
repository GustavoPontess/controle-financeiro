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

        var linhas = new List<ExtratoLinhaDto>();
        foreach (var linha in lidas)
        {
            var tipo = linha.Valor < 0 ? TipoTransacao.Despesa : TipoTransacao.Receita;
            var valor = Math.Abs(linha.Valor);

            var duplicada = linha.FitId is not null
                ? fitIdsExistentes.Contains(linha.FitId)
                : existentes.Any(e =>
                    e.Data.Date == linha.Data.Date
                    && e.Valor == valor
                    && e.Tipo == tipo
                    && e.Descricao == linha.Descricao);

            var categoria = SugerirCategoria(linha.Descricao, tipo, categorias);

            linhas.Add(new ExtratoLinhaDto(
                linha.Data, linha.Descricao, valor, tipo, linha.FitId, duplicada,
                categoria?.Id, categoria?.Descricao));
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

        var importadas = 0;
        foreach (var linha in dto.Linhas)
        {
            if (linha.Valor <= 0)
                throw new ArgumentException("O valor de cada transação deve ser positivo.");

            var transacao = new Transacao
            {
                Id = Guid.NewGuid(),
                Descricao = linha.Descricao,
                Valor = linha.Valor,
                Tipo = linha.Tipo,
                Data = linha.Data,
                ContaId = dto.ContaId,
                CategoriaId = linha.CategoriaId,
                StatusTransacao = StatusTransacao.Executado,
                Ativo = true,
                ImportacaoFitId = linha.FitId,
            };

            await _transacaoService.CriarTransacaoAsync(transacao, usuarioId);
            importadas++;
        }

        return new ResultadoImportacaoDto(importadas);
    }

    private record CategoriaResumo(Guid Id, string Descricao, Finalidade Finalidade);

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

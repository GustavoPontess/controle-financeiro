using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>Uma cobrança que se repete no cartão e pode virar conta fixa. <c>Proxima</c>: um mês depois da última (a
/// conta fixa começa nela, pra não gerar de novo a cobrança que já está na fatura).</summary>
public record SugestaoContaFixaDto(string Chave, string Nome, string Descricao, decimal Valor, DateOnly Ultima, DateOnly Proxima,
    int Meses, Guid? CategoriaId, Guid? SubcategoriaId);

public record DispensarSugestaoDto([System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.MaxLength(Estabelecimento.ChaveMaxLength)] string Chave);

/// <summary>
/// Assinaturas do cartão viram sugestão de conta fixa (fatura-a-detalhar.md, passo 5; Gustavo 2026-11-22: as
/// recorrentes dele moram quase todas no crédito). O app só SUGERE: aceitar abre o formulário de Nova conta fixa já
/// preenchido (a pessoa confere e salva); dispensar não mostra mais aquele lugar naquele cartão. Nunca cria sozinho.
/// <para>Regra: o mesmo lugar (<see cref="Estabelecimento.Chave"/>) cobrado em 3 ou mais faturas SEGUIDAS, até 2 vezes
/// por fatura, com valor até 10% do da última, e a última há no máximo 62 dias. Lugar que já é conta fixa ativa nesse
/// cartão ou que a pessoa dispensou fica fora.</para>
/// </summary>
public class ContaFixaDoCartaoService
{
    public const int MinimoFaturasSeguidas = 3;
    private const decimal Tolerancia = 0.10m;
    private const int UltimaHaNoMaximoDias = 62;

    private readonly AppDbContext _context;
    private readonly ImportacaoService _importacao;

    public ContaFixaDoCartaoService(AppDbContext context, ImportacaoService importacao)
    {
        _context = context;
        _importacao = importacao;
    }

    public async Task<List<SugestaoContaFixaDto>> SugestoesAsync(Guid cartaoId, Guid usuarioId)
    {
        await DonoRecursos.ExigirCartaoAsync(_context, cartaoId, usuarioId);
        var hoje = HorarioBrasil.Hoje();
        var desde = hoje.AddMonths(-14);
        var compras = await _context.Transacoes.AsNoTracking()
            .Where(t => t.CartaoCreditoId == cartaoId && t.Ativo && t.UsadoComoCredito && !t.EhPixNoCredito && t.Tipo == TipoTransacao.Despesa
                        && t.StatusTransacao == StatusTransacao.Executado && t.FaturaId != null && t.Data >= desde)
            .Join(_context.Faturas, t => t.FaturaId, f => f.Id, (t, f) => new
            {
                t.Descricao, t.Valor, t.Data, t.CategoriaId, t.SubcategoriaId, f.DataFechamento,
            })
            .ToListAsync();
        if (compras.Count == 0) return [];

        var padroes = await _importacao.PadroesAsync(usuarioId);
        var recorrentes = await _context.Recorrentes.AsNoTracking()
            .Where(r => r.CriadoPor == usuarioId && r.CartaoCreditoId == cartaoId && r.Ativo && r.ExcluidoEm == null && r.CanceladoEm == null)
            .Select(r => r.Descricao).ToListAsync();
        var jaSaoFixas = recorrentes.Select(d => Estabelecimento.Chave(d, true, padroes)).ToHashSet();
        var dispensadas = (await _context.SugestoesContaFixaDispensadas.AsNoTracking()
            .Where(s => s.UsuarioId == usuarioId && s.CartaoCreditoId == cartaoId)
            .Select(s => s.Chave).ToListAsync()).ToHashSet();

        var resultado = new List<SugestaoContaFixaDto>();
        foreach (var grupo in compras.GroupBy(c => Estabelecimento.Chave(c.Descricao, true, padroes)))
        {
            if (jaSaoFixas.Contains(grupo.Key) || dispensadas.Contains(grupo.Key)) continue;
            var ultima = grupo.OrderByDescending(c => c.Data).First();
            if (ultima.Data < hoje.AddDays(-UltimaHaNoMaximoDias)) continue;
            var porFatura = grupo.GroupBy(c => c.DataFechamento.Year * 12 + c.DataFechamento.Month)
                .ToDictionary(g => g.Key, g => g.ToList());
            bool Parecido(decimal v) => Math.Abs(v - ultima.Valor) <= ultima.Valor * Tolerancia;
            var mes = ultima.DataFechamento.Year * 12 + ultima.DataFechamento.Month;
            var seguidas = 0;
            while (porFatura.TryGetValue(mes, out var daFatura) && daFatura.Count <= 2 && daFatura.Any(c => Parecido(c.Valor)))
            {
                seguidas++;
                mes--;
            }
            if (seguidas < MinimoFaturasSeguidas) continue;
            resultado.Add(new SugestaoContaFixaDto(grupo.Key, Estabelecimento.Nome(ultima.Descricao, padroes), ultima.Descricao,
                ultima.Valor, ultima.Data, ultima.Data.AddMonths(1), seguidas, ultima.CategoriaId, ultima.SubcategoriaId));
        }
        return resultado.OrderByDescending(s => s.Valor).ToList();
    }

    /// <summary>"Não é conta fixa": a sugestão desse lugar não volta nesse cartão. Repetir não duplica.</summary>
    public async Task DispensarAsync(Guid cartaoId, Guid usuarioId, string chave)
    {
        await DonoRecursos.ExigirCartaoAsync(_context, cartaoId, usuarioId);
        chave = chave.Trim();
        if (chave.Length == 0 || chave.Length > Estabelecimento.ChaveMaxLength) throw new ArgumentException("Sugestão inválida.");
        if (await _context.SugestoesContaFixaDispensadas.AnyAsync(s => s.UsuarioId == usuarioId && s.CartaoCreditoId == cartaoId && s.Chave == chave))
            return;
        _context.SugestoesContaFixaDispensadas.Add(new SugestaoContaFixaDispensada
        {
            Id = Guid.NewGuid(), UsuarioId = usuarioId, CartaoCreditoId = cartaoId, Chave = chave,
        });
        try { await _context.SaveChangesAsync(); }
        catch (DbUpdateException e) when (Idempotencia.EhViolacaoDeUnicidade(e)) { /* outra requisição gravou primeiro */ }
    }
}

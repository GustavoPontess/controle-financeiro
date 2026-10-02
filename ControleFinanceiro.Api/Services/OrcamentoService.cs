using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Orcamento;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

public class OrcamentoService
{
    private readonly AppDbContext _context;

    public OrcamentoService(AppDbContext context)
    {
        _context = context;
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

    public async Task<List<OrcamentoDto>> ListarAsync(Guid usuarioId, int mes, int ano)
    {
        var orcamentos = await _context.Orcamentos
            .Where(o => o.UsuarioId == usuarioId && o.Mes == mes && o.Ano == ano)
            .Include(o => o.Categoria)
            .AsNoTracking()
            .ToListAsync();

        var gastos = await ObterGastosAsync(usuarioId, mes, ano, orcamentos.Select(o => o.CategoriaId).ToList());

        return orcamentos.Select(o => ToDto(o, gastos)).ToList();
    }

    public async Task<OrcamentoDto> CriarAsync(CriarOrcamentoDto dto, Guid usuarioId)
    {
        ValidarDto(dto);

        // Verifica duplicidade
        var existe = await _context.Orcamentos.AnyAsync(o =>
            o.UsuarioId == usuarioId &&
            o.CategoriaId == dto.CategoriaId &&
            o.Mes == dto.Mes &&
            o.Ano == dto.Ano);

        if (existe)
            throw new InvalidOperationException(
                "Já existe um orçamento para esta categoria/período. Use PUT para atualizar.");

        var orcamento = new Orcamento
        {
            Id = Guid.NewGuid(),
            UsuarioId = usuarioId,
            CategoriaId = dto.CategoriaId,
            Mes = dto.Mes,
            Ano = dto.Ano,
            ValorLimite = dto.ValorLimite,
            PercentualAlerta = dto.PercentualAlerta,
            CriadoEm = DateTime.UtcNow,
            AtualizadoEm = DateTime.UtcNow,
        };

        _context.Orcamentos.Add(orcamento);
        await _context.SaveChangesAsync();

        // Reload com include
        await _context.Entry(orcamento).Reference(o => o.Categoria).LoadAsync();

        var gastos = await ObterGastosAsync(usuarioId, dto.Mes, dto.Ano, [dto.CategoriaId]);
        return ToDto(orcamento, gastos);
    }

    public async Task<OrcamentoDto> AtualizarAsync(Guid id, CriarOrcamentoDto dto, Guid usuarioId)
    {
        ValidarDto(dto);

        var orcamento = await _context.Orcamentos
            .Include(o => o.Categoria)
            .FirstOrDefaultAsync(o => o.Id == id && o.UsuarioId == usuarioId)
            ?? throw new KeyNotFoundException("Orçamento não encontrado.");

        orcamento.ValorLimite = dto.ValorLimite;
        orcamento.PercentualAlerta = dto.PercentualAlerta;
        orcamento.AtualizadoEm = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var gastos = await ObterGastosAsync(usuarioId, orcamento.Mes, orcamento.Ano, [orcamento.CategoriaId]);
        return ToDto(orcamento, gastos);
    }

    public async Task DeletarAsync(Guid id, Guid usuarioId)
    {
        var orcamento = await _context.Orcamentos
            .FirstOrDefaultAsync(o => o.Id == id && o.UsuarioId == usuarioId)
            ?? throw new KeyNotFoundException("Orçamento não encontrado.");

        _context.Orcamentos.Remove(orcamento);
        await _context.SaveChangesAsync();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static void ValidarDto(CriarOrcamentoDto dto)
    {
        if (dto.ValorLimite <= 0)
            throw new ArgumentException("ValorLimite deve ser positivo.");
        if (dto.Mes < 1 || dto.Mes > 12)
            throw new ArgumentException("Mes deve ser entre 1 e 12.");
        if (dto.Ano < 2000 || dto.Ano > 2100)
            throw new ArgumentException("Ano inválido.");
        if (dto.PercentualAlerta < 1 || dto.PercentualAlerta > 100)
            throw new ArgumentException("PercentualAlerta deve ser entre 1 e 100.");
    }

    /// <summary>
    /// Retorna gastos do mês agrupados por CategoriaId (string da Guid ou "null").
    /// </summary>
    private async Task<Dictionary<string, decimal>> ObterGastosAsync(
        Guid usuarioId, int mes, int ano, IEnumerable<Guid?> categoriaIds)
    {
        var inicio = DateOnly.FromDateTime(new DateTime(ano, mes, 1));
        var fim = inicio.AddMonths(1);

        var gastos = await _context.Transacoes
            .Where(t => t.CriadoPor == usuarioId &&
                        t.Tipo == TipoTransacao.Despesa &&
                        t.Ativo &&
                        t.StatusTransacao == StatusTransacao.Executado &&
                        !t.EhTransferencia &&
                        !t.EhSaldoInicial &&
                        !t.EhPagamentoFatura &&
                        t.Data >= inicio && t.Data < fim)
            .GroupBy(t => t.CategoriaId)
            .Select(g => new { CategoriaId = g.Key, Total = g.Sum(t => t.Valor) })
            .ToListAsync();

        return gastos.ToDictionary(
            g => g.CategoriaId.HasValue ? g.CategoriaId.Value.ToString() : "null",
            g => g.Total);
    }

    private static OrcamentoDto ToDto(Orcamento o, Dictionary<string, decimal> gastos)
    {
        // CategoriaId null = orçamento geral: soma tudo
        var key = o.CategoriaId.HasValue ? o.CategoriaId.Value.ToString() : "null";
        var gasto = o.CategoriaId.HasValue
            ? gastos.GetValueOrDefault(key)
            : gastos.Values.Sum();

        return new OrcamentoDto
        {
            Id = o.Id,
            CategoriaId = o.CategoriaId,
            CategoriaNome = o.Categoria?.Descricao,
            Mes = o.Mes,
            Ano = o.Ano,
            ValorLimite = o.ValorLimite,
            PercentualAlerta = o.PercentualAlerta,
            ValorGasto = gasto,
        };
    }
}

using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Orcamento;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Limites de gasto por categoria (tela Limites). Um limite VALE TODO MÊS até a pessoa mudar (ver
/// <see cref="Orcamento"/>): o do mês M é a linha mais recente da categoria até M. Mudar ou tirar só vale do mês
/// atual em diante; mês passado fica como estava. O gasto vem da regra única
/// <see cref="RegrasFinanceiras.GastosPorCategoriaDoMesAsync"/> (inclui a parcela do mês das compras parceladas).
/// </summary>
public class OrcamentoService
{
    private readonly AppDbContext _context;

    public OrcamentoService(AppDbContext context)
    {
        _context = context;
    }

    private static int Chave(int ano, int mes) => ano * 12 + mes;

    // ── Ler ──────────────────────────────────────────────────────────────────

    /// <summary>Limites que valem no mês, com gasto e previsto, e as categorias que gastaram sem limite.</summary>
    public async Task<LimitesDoMesDto> DoMesAsync(Guid usuarioId, int ano, int mes, DateTime? agora = null)
    {
        ValidarMes(ano, mes);
        var vigentes = await VigentesAsync(usuarioId, ano, mes);
        var gastos = await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(_context, usuarioId, ano, mes);

        var ids = vigentes.Where(o => o.CategoriaId.HasValue).Select(o => o.CategoriaId!.Value)
            .Concat(gastos.Keys.Where(k => k != RegrasFinanceiras.SemCategoria)).Distinct().ToList();
        var nomes = await _context.Categorias.AsNoTracking().Where(c => ids.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Descricao);
        string Nome(Guid? id) => id is null ? "Todos os gastos"
            : id == RegrasFinanceiras.SemCategoria ? "Sem categoria" : nomes.GetValueOrDefault(id.Value, "Categoria");

        var limites = vigentes.Select(o =>
        {
            var g = o.CategoriaId is { } c ? gastos.GetValueOrDefault(c)
                : new RegrasFinanceiras.GastoCategoria(gastos.Values.Sum(x => x.Gasto), gastos.Values.Sum(x => x.Previsto));
            var pct = Math.Round(g.Gasto * 100m / o.ValorLimite, 1);
            var situacao = g.Gasto > o.ValorLimite ? "passou" : pct >= o.PercentualAlerta ? "perto" : "ok";
            return new LimiteDoMesDto(o.CategoriaId, Nome(o.CategoriaId), o.ValorLimite, g.Gasto, g.Previsto,
                o.ValorLimite - g.Gasto, pct, situacao, o.Ano, o.Mes);
        })
            // O que precisa de atenção primeiro: quem passou, depois quem está mais perto.
            .OrderByDescending(l => l.Percentual).ThenBy(l => l.Categoria, StringComparer.CurrentCulture)
            .ToList();

        var comLimite = vigentes.Where(o => o.CategoriaId.HasValue).Select(o => o.CategoriaId!.Value).ToHashSet();
        var semLimite = gastos.Where(kv => kv.Value.Gasto > 0 && !comLimite.Contains(kv.Key))
            .Select(kv => new GastoSemLimiteDto(kv.Key == RegrasFinanceiras.SemCategoria ? null : kv.Key, Nome(kv.Key), kv.Value.Gasto))
            .OrderByDescending(s => s.Gasto)
            .ToList();

        var deCategoria = limites.Where(l => l.CategoriaId.HasValue).ToList();
        return new LimitesDoMesDto(ano, mes, Editavel(ano, mes, agora ?? DateTime.UtcNow),
            deCategoria.Sum(l => l.Limite), deCategoria.Sum(l => l.Gasto), deCategoria.Sum(l => l.Previsto),
            limites, semLimite);
    }

    /// <summary>Média do gasto da categoria nos 3 meses antes de <paramref name="mes"/> (pra sugerir o limite).</summary>
    public async Task<SugestaoLimiteDto> SugestaoAsync(Guid usuarioId, Guid? categoriaId, int ano, int mes)
    {
        ValidarMes(ano, mes);
        if (categoriaId.HasValue)
            await DonoRecursos.ExigirCategoriaAsync(_context, categoriaId.Value, usuarioId);
        var total = 0m;
        var inicio = new DateTime(ano, mes, 1);
        for (var i = 1; i <= 3; i++)
        {
            var m = inicio.AddMonths(-i);
            var gastos = await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(_context, usuarioId, m.Year, m.Month);
            total += categoriaId is { } c ? gastos.GetValueOrDefault(c).Gasto : gastos.Values.Sum(g => g.Gasto);
        }
        return new SugestaoLimiteDto(total > 0 ? Math.Round(total / 3m, 2) : null);
    }

    // ── Escrever ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Põe ou muda o limite da categoria do mês em diante: grava a linha do mês e apaga as dos meses depois
    /// (o novo valor vale pra frente). Mês passado é recusado.
    /// </summary>
    public async Task<LimitesDoMesDto> DefinirAsync(DefinirLimiteDto dto, Guid usuarioId, DateTime? agora = null)
    {
        ValidarMes(dto.Ano, dto.Mes);
        if (dto.Valor <= 0 || dto.Valor > 999_999_999.99m)
            throw new ArgumentException("Diga o limite.");
        ExigirEditavel(dto.Ano, dto.Mes, agora ?? DateTime.UtcNow);
        if (dto.CategoriaId.HasValue)
            await ExigirCategoriaDeGastoAsync(dto.CategoriaId.Value, usuarioId);

        var chave = Chave(dto.Ano, dto.Mes);
        var linhas = await _context.Orcamentos
            .Where(o => o.UsuarioId == usuarioId && o.CategoriaId == dto.CategoriaId && o.Ano * 12 + o.Mes >= chave)
            .ToListAsync();
        var doMes = linhas.FirstOrDefault(o => Chave(o.Ano, o.Mes) == chave);
        _context.Orcamentos.RemoveRange(linhas.Where(o => o != doMes));
        if (doMes is null)
            _context.Orcamentos.Add(new Orcamento
            {
                Id = Guid.NewGuid(), UsuarioId = usuarioId, CategoriaId = dto.CategoriaId, Ano = dto.Ano, Mes = dto.Mes,
                ValorLimite = dto.Valor,
            });
        else
        {
            doMes.ValorLimite = dto.Valor;
            doMes.AtualizadoEm = DateTime.UtcNow;
        }
        await _context.SaveChangesAsync();
        return await DoMesAsync(usuarioId, dto.Ano, dto.Mes, agora);
    }

    /// <summary>Tira o limite da categoria do mês em diante (os meses passados guardam o que tinham).</summary>
    public async Task<LimitesDoMesDto> TirarAsync(Guid? categoriaId, int ano, int mes, Guid usuarioId, DateTime? agora = null)
    {
        ValidarMes(ano, mes);
        ExigirEditavel(ano, mes, agora ?? DateTime.UtcNow);
        var chave = Chave(ano, mes);
        var daCategoria = await _context.Orcamentos
            .Where(o => o.UsuarioId == usuarioId && o.CategoriaId == categoriaId)
            .ToListAsync();
        var vigenteAntes = daCategoria.Where(o => Chave(o.Ano, o.Mes) < chave).MaxBy(o => Chave(o.Ano, o.Mes));
        var doMesEmDiante = daCategoria.Where(o => Chave(o.Ano, o.Mes) >= chave).ToList();
        if (doMesEmDiante.Count == 0 && (vigenteAntes is null || vigenteAntes.ValorLimite == 0))
            throw new KeyNotFoundException("Essa categoria não tem limite neste mês.");

        _context.Orcamentos.RemoveRange(doMesEmDiante);
        // Vinha valendo de antes: grava "sem limite" a partir deste mês, pros passados continuarem com o limite.
        if (vigenteAntes is { ValorLimite: > 0 })
            _context.Orcamentos.Add(new Orcamento
            {
                Id = Guid.NewGuid(), UsuarioId = usuarioId, CategoriaId = categoriaId, Ano = ano, Mes = mes, ValorLimite = 0m,
            });
        await _context.SaveChangesAsync();
        return await DoMesAsync(usuarioId, ano, mes, agora);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /// <summary>A linha que vale em cada categoria no mês (a mais recente até ele), sem as "sem limite".</summary>
    private async Task<List<Orcamento>> VigentesAsync(Guid usuarioId, int ano, int mes)
    {
        var chave = Chave(ano, mes);
        var linhas = await _context.Orcamentos.AsNoTracking()
            .Where(o => o.UsuarioId == usuarioId && o.Ano * 12 + o.Mes <= chave)
            .ToListAsync();
        return linhas.GroupBy(o => o.CategoriaId)
            .Select(g => g.MaxBy(o => Chave(o.Ano, o.Mes))!)
            .Where(o => o.ValorLimite > 0)
            .ToList();
    }

    /// <summary>Mês atual ou futuro. Um dia de folga pro fuso: o mês em UTC vira antes do de Brasília.</summary>
    private static bool Editavel(int ano, int mes, DateTime agora)
    {
        var hoje = agora.AddDays(-1);
        return Chave(ano, mes) >= Chave(hoje.Year, hoje.Month);
    }

    private static void ExigirEditavel(int ano, int mes, DateTime agora)
    {
        if (!Editavel(ano, mes, agora))
            throw new InvalidOperationException("Mês que já passou fica como estava. Mude o limite a partir deste mês.");
    }

    private static void ValidarMes(int ano, int mes)
    {
        if (mes < 1 || mes > 12) throw new ArgumentException("Mês inválido.");
        if (ano < 2000 || ano > 2100) throw new ArgumentException("Ano inválido.");
    }

    /// <summary>Categoria da pessoa (ou padrão) que aceita gasto: limite em categoria só de receita não faz sentido.</summary>
    private async Task ExigirCategoriaDeGastoAsync(Guid categoriaId, Guid usuarioId)
    {
        await DonoRecursos.ExigirCategoriaAsync(_context, categoriaId, usuarioId);
        if (await _context.Categorias.AnyAsync(c => c.Id == categoriaId && c.Finalidade == Finalidade.Receita))
            throw new ArgumentException("Limite é pra categoria de gasto.");
    }
}

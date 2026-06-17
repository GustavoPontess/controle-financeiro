using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

public class DespesaCompartilhadaService
{
    private readonly AppDbContext _context;
    private readonly NotificacaoService _notificacaoService;

    public DespesaCompartilhadaService(AppDbContext context, NotificacaoService notificacaoService)
    {
        _context = context;
        _notificacaoService = notificacaoService;
    }

    /// <summary>Marca uma transação como despesa compartilhada com uma família.</summary>
    public async Task CompartilharAsync(Guid transacaoId, Guid familiaId, Guid usuarioId)
    {
        var transacao = await _context.Transacoes
            .FirstOrDefaultAsync(t => t.Id == transacaoId && t.Ativo)
            ?? throw new KeyNotFoundException("Transação não encontrada.");

        if (transacao.CriadoPor != usuarioId)
            throw new ForbiddenAccessException("Você só pode compartilhar suas próprias transações.");

        if (transacao.Tipo != TipoTransacao.Despesa)
            throw new InvalidOperationException("Apenas despesas podem ser compartilhadas.");

        await ExigirMembroAsync(familiaId, usuarioId);

        transacao.FamiliaId = familiaId;
        await _context.SaveChangesAsync();

        // Issue #30 — notifica os demais membros ativos da família.
        var outrosMembros = await _context.MembrosFamilia
            .Where(m => m.FamiliaId == familiaId && m.Ativo && m.UsuarioId != usuarioId)
            .Select(m => m.UsuarioId)
            .ToListAsync();

        foreach (var membroId in outrosMembros)
        {
            await _notificacaoService.CriarAsync(
                membroId,
                TipoNotificacao.DespesaCompartilhada,
                "Nova despesa compartilhada",
                $"\"{transacao.Descricao}\" foi compartilhada na família.",
                "/familias");
        }
    }

    /// <summary>Desfaz o compartilhamento — a transação volta a ser pessoal.</summary>
    public async Task DescompartilharAsync(Guid transacaoId, Guid usuarioId)
    {
        var transacao = await _context.Transacoes
            .FirstOrDefaultAsync(t => t.Id == transacaoId && t.Ativo)
            ?? throw new KeyNotFoundException("Transação não encontrada.");

        if (transacao.CriadoPor != usuarioId)
            throw new ForbiddenAccessException("Você só pode alterar suas próprias transações.");

        transacao.FamiliaId = null;
        await _context.SaveChangesAsync();
    }

    /// <summary>Feed de despesas compartilhadas da família no mês/ano.</summary>
    public async Task<List<DespesaCompartilhadaDto>> ListarDespesasAsync(
        Guid familiaId, Guid usuarioId, int mes, int ano)
    {
        await ExigirMembroAsync(familiaId, usuarioId);

        var despesas = await QueryDespesasDoMes(familiaId, mes, ano)
            .Select(t => new
            {
                t.Id, t.Descricao, t.Valor, t.Data,
                CategoriaNome = t.Categoria != null ? t.Categoria.Descricao : null,
                t.CriadoPor,
            })
            .ToListAsync();

        var pagadorIds = despesas.Select(d => d.CriadoPor).Distinct().ToList();
        var nomes = await _context.Usuarios
            .Where(u => pagadorIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Nome);

        return despesas
            .Select(d => new DespesaCompartilhadaDto(
                d.Id, d.Descricao, d.Valor, d.Data, d.CategoriaNome,
                d.CriadoPor, nomes.GetValueOrDefault(d.CriadoPor, "—")))
            .ToList();
    }

    /// <summary>Balanço mensal: quem pagou quanto vs a cota devida. A cota de cada
    /// membro respeita o modo de rateio efetivo de cada despesa (Issue #25).</summary>
    public async Task<BalancoFamiliaDto> ObterBalancoAsync(
        Guid familiaId, Guid usuarioId, int mes, int ano)
    {
        await ExigirMembroAsync(familiaId, usuarioId);

        var familia = await _context.Familias
            .FirstOrDefaultAsync(f => f.Id == familiaId && f.Ativa)
            ?? throw new KeyNotFoundException("Família não encontrada.");

        var membros = await _context.MembrosFamilia
            .Where(m => m.FamiliaId == familiaId && m.Ativo)
            .Select(m => new { m.UsuarioId, m.Usuario!.Nome, m.RendaMensal })
            .ToListAsync();

        var despesas = await QueryDespesasDoMes(familiaId, mes, ano)
            .Select(t => new { t.Id, t.Valor, t.CriadoPor, t.ModoRateio })
            .ToListAsync();

        var despesaIds = despesas.Select(d => d.Id).ToList();
        var rateios = await _context.RateiosTransacao
            .Where(r => despesaIds.Contains(r.TransacaoId))
            .ToListAsync();

        // TransacaoId → (UsuarioId → Percentual).
        var rateioPorDespesa = rateios
            .GroupBy(r => r.TransacaoId)
            .ToDictionary(
                g => g.Key,
                g => g.ToDictionary(r => r.UsuarioId, r => r.Percentual));

        var total = despesas.Sum(d => d.Valor);
        var membroIds = membros.Select(m => m.UsuarioId).ToList();
        var cotaIgualitaria = membros.Count > 0 ? total / membros.Count : 0m;
        var somaRenda = membros.Sum(m => m.RendaMensal ?? 0m);

        // Cota devida acumulada por membro.
        var cotaDevida = membroIds.ToDictionary(id => id, _ => 0m);

        foreach (var despesa in despesas)
        {
            if (membros.Count == 0) break;
            var modo = despesa.ModoRateio ?? familia.ModoRateioPadrao;
            rateioPorDespesa.TryGetValue(despesa.Id, out var itens);

            foreach (var m in membros)
            {
                cotaDevida[m.UsuarioId] += modo switch
                {
                    ModoRateio.Proporcional when somaRenda > 0 =>
                        despesa.Valor * ((m.RendaMensal ?? 0m) / somaRenda),
                    ModoRateio.Personalizado when itens is { Count: > 0 } =>
                        despesa.Valor * (itens.GetValueOrDefault(m.UsuarioId, 0m) / 100m),
                    // Igualitário, ou fallback quando não há renda/itens definidos.
                    _ => despesa.Valor / membros.Count,
                };
            }
        }

        // Acertos ativos do mês (Issue #26): o pagador "abate" da dívida, o
        // recebedor tem o saldo reduzido pelo que já recebeu.
        var acertos = await _context.AcertosContas
            .Where(a => a.FamiliaId == familiaId && a.Ativo && a.Mes == mes && a.Ano == ano)
            .Select(a => new { a.DeUsuarioId, a.ParaUsuarioId, a.Valor })
            .ToListAsync();

        var saldos = membros
            .Select(m =>
            {
                var pagou = despesas.Where(d => d.CriadoPor == m.UsuarioId).Sum(d => d.Valor);
                var cota = cotaDevida[m.UsuarioId];
                var acertosPagos = acertos.Where(a => a.DeUsuarioId == m.UsuarioId).Sum(a => a.Valor);
                var acertosRecebidos = acertos.Where(a => a.ParaUsuarioId == m.UsuarioId).Sum(a => a.Valor);
                var saldo = pagou - cota + acertosPagos - acertosRecebidos;
                return new SaldoMembroDto(m.UsuarioId, m.Nome, pagou, cota, saldo);
            })
            .ToList();

        return new BalancoFamiliaDto(mes, ano, familia.ModoRateioPadrao, total, cotaIgualitaria, saldos);
    }

    private IQueryable<Domain.Entities.Transacao> QueryDespesasDoMes(Guid familiaId, int mes, int ano)
    {
        return _context.Transacoes
            .Where(t => t.FamiliaId == familiaId
                && t.Ativo
                && t.StatusTransacao == StatusTransacao.Executado
                && t.Tipo == TipoTransacao.Despesa
                && t.Data.Month == mes
                && t.Data.Year == ano);
    }

    private async Task ExigirMembroAsync(Guid familiaId, Guid usuarioId)
    {
        var ehMembro = await _context.MembrosFamilia
            .AnyAsync(m => m.FamiliaId == familiaId && m.UsuarioId == usuarioId && m.Ativo);
        if (!ehMembro)
            throw new KeyNotFoundException("Família não encontrada.");
    }
}

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

        await ExigirEscritaAsync(familiaId, usuarioId);

        var familia = await _context.Familias
            .FirstOrDefaultAsync(f => f.Id == familiaId && f.Ativa)
            ?? throw new KeyNotFoundException("Família não encontrada.");

        // Feature 2.4 — despesa ≥ limite da família entra Pendente (não conta no balanço
        // até outro membro aprovar). Sem limite, ou abaixo dele, entra direto.
        var requerAprovacao = familia.LimiteAprovacao is { } limite && transacao.Valor >= limite;

        transacao.FamiliaId = familiaId;
        transacao.StatusAprovacao = requerAprovacao
            ? StatusAprovacaoDespesa.Pendente
            : StatusAprovacaoDespesa.NaoRequerida;
        transacao.AprovadoPorUsuarioId = null;
        transacao.AprovadoEm = null;
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
                requerAprovacao ? TipoNotificacao.DespesaAprovacaoPendente : TipoNotificacao.DespesaCompartilhada,
                requerAprovacao ? "Despesa aguardando aprovação" : "Nova despesa compartilhada",
                requerAprovacao
                    ? $"\"{transacao.Descricao}\" ({transacao.Valor:C}) precisa da sua aprovação."
                    : $"\"{transacao.Descricao}\" foi compartilhada na família.",
                "/familias");
        }
    }

    /// <summary>Feature 2.4 — aprova uma despesa pendente (membro ≠ criador).</summary>
    public async Task AprovarAsync(Guid familiaId, Guid transacaoId, Guid usuarioId) =>
        await AvaliarAsync(familiaId, transacaoId, usuarioId, aprovar: true);

    /// <summary>Feature 2.4 — rejeita uma despesa pendente (membro ≠ criador).</summary>
    public async Task RejeitarAsync(Guid familiaId, Guid transacaoId, Guid usuarioId) =>
        await AvaliarAsync(familiaId, transacaoId, usuarioId, aprovar: false);

    private async Task AvaliarAsync(Guid familiaId, Guid transacaoId, Guid usuarioId, bool aprovar)
    {
        await ExigirEscritaAsync(familiaId, usuarioId);

        var transacao = await _context.Transacoes
            .FirstOrDefaultAsync(t => t.Id == transacaoId && t.FamiliaId == familiaId && t.Ativo)
            ?? throw new KeyNotFoundException("Despesa compartilhada não encontrada.");

        if (transacao.StatusAprovacao != StatusAprovacaoDespesa.Pendente)
            throw new InvalidOperationException("Só despesas pendentes podem ser avaliadas.");

        if (transacao.CriadoPor == usuarioId)
            throw new ForbiddenAccessException("Você não pode aprovar a própria despesa.");

        transacao.StatusAprovacao = aprovar
            ? StatusAprovacaoDespesa.Aprovada
            : StatusAprovacaoDespesa.Rejeitada;
        transacao.AprovadoPorUsuarioId = usuarioId;
        transacao.AprovadoEm = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var avaliador = await _context.Usuarios
            .Where(u => u.Id == usuarioId).Select(u => u.Nome).FirstOrDefaultAsync() ?? "Um membro";

        await _notificacaoService.CriarAsync(
            transacao.CriadoPor,
            aprovar ? TipoNotificacao.DespesaAprovada : TipoNotificacao.DespesaRejeitada,
            aprovar ? "Despesa aprovada" : "Despesa rejeitada",
            $"{avaliador} {(aprovar ? "aprovou" : "rejeitou")} \"{transacao.Descricao}\".",
            "/familias");
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

    /// <summary>Feed de despesas compartilhadas da família no mês/ano.
    /// Feature 2.1 — opcionalmente filtra por membro responsável.</summary>
    public async Task<List<DespesaCompartilhadaDto>> ListarDespesasAsync(
        Guid familiaId, Guid usuarioId, int mes, int ano, Guid? responsavelId = null)
    {
        await ExigirMembroAsync(familiaId, usuarioId);

        var query = QueryDespesasDoMes(familiaId, mes, ano);
        if (responsavelId is { } rid)
            query = query.Where(t => t.ResponsavelUsuarioId == rid);

        var despesas = await query
            .Select(t => new
            {
                t.Id, t.Descricao, t.Valor, t.Data,
                CategoriaNome = t.Categoria != null ? t.Categoria.Descricao : null,
                t.CriadoPor, t.StatusAprovacao, t.AprovadoPorUsuarioId, t.ResponsavelUsuarioId,
            })
            .ToListAsync();

        // Nomes do pagador (2.4: aprovador, 2.1: responsável).
        var nomeIds = despesas.Select(d => d.CriadoPor)
            .Concat(despesas.Where(d => d.AprovadoPorUsuarioId != null).Select(d => d.AprovadoPorUsuarioId!.Value))
            .Concat(despesas.Where(d => d.ResponsavelUsuarioId != null).Select(d => d.ResponsavelUsuarioId!.Value))
            .Distinct().ToList();
        var nomes = await _context.Usuarios
            .Where(u => nomeIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Nome);

        return despesas
            .Select(d => new DespesaCompartilhadaDto(
                d.Id, d.Descricao, d.Valor, d.Data, d.CategoriaNome,
                d.CriadoPor, nomes.GetValueOrDefault(d.CriadoPor, "—"),
                d.StatusAprovacao,
                d.AprovadoPorUsuarioId is { } aid ? nomes.GetValueOrDefault(aid) : null,
                d.ResponsavelUsuarioId,
                d.ResponsavelUsuarioId is { } rid2 ? nomes.GetValueOrDefault(rid2) : null))
            .ToList();
    }

    /// <summary>Feature 2.1 — atribui (ou limpa) o membro responsável por uma despesa
    /// compartilhada. Qualquer membro ativo pode atribuir; o responsável deve ser membro ativo.</summary>
    public async Task AtribuirResponsavelAsync(
        Guid familiaId, Guid transacaoId, Guid? responsavelUsuarioId, Guid usuarioId)
    {
        await ExigirEscritaAsync(familiaId, usuarioId);

        var transacao = await _context.Transacoes
            .FirstOrDefaultAsync(t => t.Id == transacaoId && t.FamiliaId == familiaId && t.Ativo)
            ?? throw new KeyNotFoundException("Despesa compartilhada não encontrada.");

        if (responsavelUsuarioId is { } rid)
        {
            var ehMembro = await _context.MembrosFamilia
                .AnyAsync(m => m.FamiliaId == familiaId && m.UsuarioId == rid && m.Ativo);
            if (!ehMembro)
                throw new ArgumentException("O responsável deve ser um membro ativo da família.");
        }

        transacao.ResponsavelUsuarioId = responsavelUsuarioId;
        await _context.SaveChangesAsync();
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

        // Feature 2.4 — só despesas contabilizáveis entram no rateio (Pendente/Rejeitada fora).
        var despesas = await QueryDespesasDoMes(familiaId, mes, ano)
            .Where(t => t.StatusAprovacao == StatusAprovacaoDespesa.NaoRequerida
                     || t.StatusAprovacao == StatusAprovacaoDespesa.Aprovada)
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

    // Leitura (listar/balanço): qualquer membro. Escrita: bloqueia Dependente (2.3).
    private Task ExigirMembroAsync(Guid familiaId, Guid usuarioId)
        => FamiliaPermissoes.ExigirMembroAsync(_context, familiaId, usuarioId);

    private Task ExigirEscritaAsync(Guid familiaId, Guid usuarioId)
        => FamiliaPermissoes.ExigirPapelAsync(_context, familiaId, usuarioId, PapelFamilia.Membro);
}

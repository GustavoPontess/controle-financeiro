using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

public class DespesaCompartilhadaService
{
    private readonly AppDbContext _context;
    private readonly NotificacaoService _notificacaoService;
    private readonly RateioService _rateio;

    public DespesaCompartilhadaService(AppDbContext context, NotificacaoService notificacaoService, RateioService rateio)
    {
        _context = context;
        _notificacaoService = notificacaoService;
        _rateio = rateio;
    }

    /// <summary>Antes de criar uma despesa já dividida: a pessoa pode dividir nessa família (membro que lança) e é uma
    /// despesa. Mesmas recusas do <see cref="CompartilharAsync"/>, só que antes de gravar qualquer coisa.</summary>
    public async Task ExigirPodeDividirAsync(Guid familiaId, Guid usuarioId, Domain.Entities.Transacao transacao)
    {
        if (transacao.Tipo != TipoTransacao.Despesa)
            throw new InvalidOperationException("Apenas despesas podem ser compartilhadas.");
        await ExigirEscritaAsync(familiaId, usuarioId);
        if (!await _context.Familias.AnyAsync(f => f.Id == familiaId && f.Ativa))
            throw new KeyNotFoundException("Família não encontrada.");
    }

    /// <summary>Marca uma transação como despesa compartilhada com uma família e GRAVA a parte de cada um pela regra
    /// da família de hoje (<see cref="RateioService.CalcularPartesAsync"/>): daí em diante nada muda sozinho.</summary>
    public async Task CompartilharAsync(Guid transacaoId, Guid familiaId, Guid usuarioId)
    {
        var transacao = await _context.Transacoes
            .Include(t => t.Rateios)
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
        await _rateio.AplicarPartesAsync(transacao, familiaId, RateioService.ModoAoDividir(familia.ModoRateioPadrao), null);
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
                    ? $"\"{transacao.Descricao}\" ({Reais.Formatar(transacao.Valor)}) precisa da sua aprovação."
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
            aprovar ? "Despesa aprovada" : "Despesa recusada",
            $"{avaliador} {(aprovar ? "aprovou" : "recusou")} \"{transacao.Descricao}\".",
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
        transacao.ModoRateio = null;
        transacao.StatusAprovacao = StatusAprovacaoDespesa.NaoRequerida;
        _context.RateiosTransacao.RemoveRange(_context.RateiosTransacao.Where(r => r.TransacaoId == transacao.Id));
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
                t.Id, t.Descricao, t.Valor, t.Data, t.Hora,
                CategoriaNome = t.Categoria != null ? t.Categoria.Descricao : null,
                t.CriadoPor, t.StatusAprovacao, t.AprovadoPorUsuarioId, t.ResponsavelUsuarioId,
                MinhaParte = t.Rateios.Where(r => r.UsuarioId == usuarioId).Select(r => (decimal?)r.Valor).FirstOrDefault(),
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
                d.Id, d.Descricao, d.Valor, d.Data.ToDateTime(d.Hora ?? TimeOnly.MinValue), d.CategoriaNome,
                d.CriadoPor, nomes.GetValueOrDefault(d.CriadoPor, "—"),
                d.StatusAprovacao,
                d.AprovadoPorUsuarioId is { } aid ? nomes.GetValueOrDefault(aid) : null,
                d.ResponsavelUsuarioId,
                d.ResponsavelUsuarioId is { } rid2 ? nomes.GetValueOrDefault(rid2) : null,
                d.MinhaParte))
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

    /// <summary>Equilíbrio do mês: quem pagou quanto × a parte de cada um, pelas PARTES GRAVADAS em cada despesa
    /// (<see cref="RateioTransacao"/>): mudar a regra da família depois não mexe aqui, e quem saiu da família continua
    /// nos meses em que dividiu (com <c>SaiuEm</c>). Quem "só vê" não entra. Despesa gravada antes das partes (sem
    /// item) divide igual entre os ativos, como era. Pendente/Rejeitada ficam fora.</summary>
    public async Task<BalancoFamiliaDto> ObterBalancoAsync(
        Guid familiaId, Guid usuarioId, int mes, int ano)
    {
        await ExigirMembroAsync(familiaId, usuarioId);

        var familia = await _context.Familias
            .FirstOrDefaultAsync(f => f.Id == familiaId && f.Ativa)
            ?? throw new KeyNotFoundException("Família não encontrada.");

        var membrosFamilia = await _context.MembrosFamilia
            .Where(m => m.FamiliaId == familiaId)
            .Select(m => new { m.UsuarioId, m.Usuario!.Nome, m.Ativo, m.SaiuEm, m.PapelPermissao })
            .ToListAsync();
        var ativos = membrosFamilia.Where(m => m.Ativo && m.PapelPermissao != PapelFamilia.Dependente).ToList();

        // Feature 2.4 — só despesas contabilizáveis entram no rateio (Pendente/Rejeitada fora).
        var despesas = await QueryDespesasDoMes(familiaId, mes, ano)
            .Where(t => t.StatusAprovacao == StatusAprovacaoDespesa.NaoRequerida
                     || t.StatusAprovacao == StatusAprovacaoDespesa.Aprovada)
            .Select(t => new { t.Id, t.Valor, t.CriadoPor })
            .ToListAsync();
        var despesaIds = despesas.Select(d => d.Id).ToList();
        var partes = await _context.RateiosTransacao
            .Where(r => despesaIds.Contains(r.TransacaoId))
            .Select(r => new { r.TransacaoId, r.UsuarioId, r.Valor })
            .ToListAsync();
        var comPartes = partes.Select(p => p.TransacaoId).ToHashSet();

        // Quem entra no equilíbrio: os ativos + quem tem parte gravada ou pagou no mês (quem saiu continua).
        var pessoas = ativos.Select(m => m.UsuarioId)
            .Concat(partes.Select(p => p.UsuarioId))
            .Concat(despesas.Select(d => d.CriadoPor))
            .Distinct().ToList();
        var cota = pessoas.ToDictionary(id => id, _ => 0m);
        foreach (var p in partes)
            cota[p.UsuarioId] += p.Valor;
        // Despesa gravada antes das partes (sem item): a regra de antes, ao vivo (modo da despesa ou o padrão da
        // família de hoje; pela renda = renda prevista do mês). Depois da migration isso não existe mais.
        var semPartes = despesas.Where(d => !comPartes.Contains(d.Id)).ToList();
        if (semPartes.Count > 0 && ativos.Count > 0)
        {
            var modos = await _context.Transacoes.Where(t => semPartes.Select(d => d.Id).Contains(t.Id))
                .Select(t => new { t.Id, t.ModoRateio }).ToDictionaryAsync(t => t.Id, t => t.ModoRateio);
            var pesos = await new RendaService(_context).PesosAsync(familiaId, ano, mes);
            var somaRenda = ativos.Sum(m => pesos.GetValueOrDefault(m.UsuarioId));
            foreach (var d in semPartes)
            {
                var modo = modos.GetValueOrDefault(d.Id) ?? familia.ModoRateioPadrao;
                foreach (var m in ativos)
                    cota[m.UsuarioId] += modo == ModoRateio.Proporcional && somaRenda > 0
                        ? d.Valor * (pesos.GetValueOrDefault(m.UsuarioId) / somaRenda)
                        : d.Valor / ativos.Count;
            }
        }

        var total = despesas.Sum(d => d.Valor);
        var cotaIgualitaria = ativos.Count > 0 ? total / ativos.Count : 0m;

        // Acertos ativos do mês (Issue #26): o acerto entra no saldo de quem passou (soma) e de quem
        // recebeu (subtrai); as contas de cada um não mudam.
        var acertos = await _context.AcertosContas
            .Where(a => a.FamiliaId == familiaId && a.Ativo && a.Mes == mes && a.Ano == ano)
            .Select(a => new { a.DeUsuarioId, a.ParaUsuarioId, a.Valor })
            .ToListAsync();

        var membroPorId = membrosFamilia.GroupBy(m => m.UsuarioId).ToDictionary(g => g.Key, g => g.OrderByDescending(m => m.Ativo).First());
        var faltamNome = pessoas.Where(id => !membroPorId.ContainsKey(id)).ToList();
        var nomesSoltos = faltamNome.Count == 0 ? new Dictionary<Guid, string>()
            : await _context.Usuarios.Where(u => faltamNome.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Nome);

        var saldos = pessoas
            .OrderBy(id => membroPorId.TryGetValue(id, out var m) && m.Ativo ? 0 : 1)
            .ThenBy(id => membroPorId.TryGetValue(id, out var m) ? m.Nome : nomesSoltos.GetValueOrDefault(id, ""))
            .Select(id =>
            {
                membroPorId.TryGetValue(id, out var m);
                var nome = m?.Nome ?? nomesSoltos.GetValueOrDefault(id, "Membro que saiu");
                var pagou = despesas.Where(d => d.CriadoPor == id).Sum(d => d.Valor);
                var acertosPagos = acertos.Where(a => a.DeUsuarioId == id).Sum(a => a.Valor);
                var acertosRecebidos = acertos.Where(a => a.ParaUsuarioId == id).Sum(a => a.Valor);
                var saldo = pagou - cota[id] + acertosPagos - acertosRecebidos;
                return new SaldoMembroDto(id, nome, pagou, cota[id], saldo, m is { Ativo: false } ? m.SaiuEm ?? DateTime.MinValue : null);
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

using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

public class AcertoService
{
    private readonly AppDbContext _context;
    private readonly NotificacaoService _notificacaoService;
    private readonly FinancialEventLogService _eventLog;

    public AcertoService(
        AppDbContext context,
        NotificacaoService notificacaoService,
        FinancialEventLogService eventLog)
    {
        _context = context;
        _notificacaoService = notificacaoService;
        _eventLog = eventLog;
    }

    /// <summary>Registra um acerto: um membro pagou a outro o que devia.</summary>
    public async Task<AcertoContasDto> RegistrarAsync(
        Guid familiaId, Guid usuarioId, RegistrarAcertoDto dto)
    {
        await ExigirEscritaAsync(familiaId, usuarioId);

        // Idempotência — um acerto move dinheiro (afeta o balanço da família), então
        // o POST é transacional: um retry de cliente não pode duplicar a quitação.
        if (string.IsNullOrWhiteSpace(dto.IdempotencyKey))
            throw new InvalidOperationException("idempotencyKey é obrigatório.");

        var replay = await _eventLog.BuscarPorIdempotencyKeyAsync(usuarioId, dto.IdempotencyKey);
        if (replay != null && replay.Tipo == FinancialEventType.AcertoRegistrado)
        {
            var anterior = await _context.AcertosContas
                .FirstOrDefaultAsync(a => a.Id == replay.EntidadeId);
            if (anterior != null)
                return await MapToDtoAsync(anterior);
        }

        if (dto.DeUsuarioId == dto.ParaUsuarioId)
            throw new ArgumentException("O pagador e o recebedor devem ser pessoas diferentes.");

        if (dto.Valor <= 0)
            throw new ArgumentException("O valor do acerto deve ser positivo.");

        await ExigirParticipanteMembroAsync(familiaId, dto.DeUsuarioId);
        await ExigirParticipanteMembroAsync(familiaId, dto.ParaUsuarioId);

        var agora = DateTime.UtcNow;
        var acerto = new AcertoContas
        {
            Id = Guid.NewGuid(),
            FamiliaId = familiaId,
            DeUsuarioId = dto.DeUsuarioId,
            ParaUsuarioId = dto.ParaUsuarioId,
            Valor = dto.Valor,
            Mes = dto.Mes ?? agora.Month,
            Ano = dto.Ano ?? agora.Year,
            Observacao = dto.Observacao,
            CriadoPor = usuarioId,
        };

        _context.AcertosContas.Add(acerto);

        // FinancialEventLog: AcertoRegistrado (idempotencyKey no payload) — auditoria
        // append-only de mudança de balanço. Persiste na mesma SaveChanges do acerto.
        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.AcertoRegistrado,
            entidade: "AcertoContas",
            entidadeId: acerto.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            valorAntes: null,
            valorDepois: acerto.Valor,
            payload: new
            {
                idempotencyKey = dto.IdempotencyKey,
                familiaId,
                deUsuarioId = acerto.DeUsuarioId,
                paraUsuarioId = acerto.ParaUsuarioId,
                valor = acerto.Valor,
                mes = acerto.Mes,
                ano = acerto.Ano,
            });

        await _context.SaveChangesAsync();

        var resultado = await MapToDtoAsync(acerto);

        // Issue #30 — notifica quem recebeu o acerto (se não foi quem registrou).
        if (acerto.ParaUsuarioId != usuarioId)
        {
            await _notificacaoService.CriarAsync(
                acerto.ParaUsuarioId,
                Domain.Enums.TipoNotificacao.AcertoContas,
                "Acerto de contas recebido",
                $"{resultado.DeNome} registrou um acerto de {Reais.Formatar(resultado.Valor)} com você.",
                "/familias");
        }

        return resultado;
    }

    /// <summary>Lista os acertos ativos da família (opcionalmente filtrados por mês/ano).</summary>
    public async Task<List<AcertoContasDto>> ListarAsync(
        Guid familiaId, Guid usuarioId, int? mes, int? ano)
    {
        await ExigirMembroAsync(familiaId, usuarioId);

        var query = _context.AcertosContas
            .Where(a => a.FamiliaId == familiaId && a.Ativo);

        if (mes is not null)
            query = query.Where(a => a.Mes == mes);
        if (ano is not null)
            query = query.Where(a => a.Ano == ano);

        var acertos = await query
            .OrderByDescending(a => a.CriadoEm)
            .Select(a => new
            {
                a.Id, a.DeUsuarioId, DeNome = a.DeUsuario!.Nome,
                a.ParaUsuarioId, ParaNome = a.ParaUsuario!.Nome,
                a.Valor, a.Mes, a.Ano, a.Observacao, a.CriadoEm,
            })
            .ToListAsync();

        return acertos
            .Select(a => new AcertoContasDto(
                a.Id, a.DeUsuarioId, a.DeNome, a.ParaUsuarioId, a.ParaNome,
                a.Valor, a.Mes, a.Ano, a.Observacao, a.CriadoEm))
            .ToList();
    }

    /// <summary>Cancela um acerto (soft delete — preserva o histórico).</summary>
    public async Task CancelarAsync(Guid familiaId, Guid acertoId, Guid usuarioId)
    {
        await ExigirEscritaAsync(familiaId, usuarioId);

        var acerto = await _context.AcertosContas
            .FirstOrDefaultAsync(a => a.Id == acertoId && a.FamiliaId == familiaId && a.Ativo)
            ?? throw new KeyNotFoundException("Acerto não encontrado.");

        // Authz: só quem registrou o acerto ou as duas partes (pagador/recebedor)
        // podem cancelá-lo. Um terceiro membro da família não mexe no acerto alheio.
        var podeCancelar = usuarioId == acerto.CriadoPor
            || usuarioId == acerto.DeUsuarioId
            || usuarioId == acerto.ParaUsuarioId;
        if (!podeCancelar)
            throw new ForbiddenAccessException(
                "Só quem registrou o acerto ou as partes envolvidas podem cancelá-lo.");

        acerto.Ativo = false;

        // FinancialEventLog: AcertoCancelado — auditoria da reversão de balanço.
        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.AcertoCancelado,
            entidade: "AcertoContas",
            entidadeId: acerto.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            valorAntes: acerto.Valor,
            valorDepois: 0m,
            payload: new
            {
                familiaId,
                deUsuarioId = acerto.DeUsuarioId,
                paraUsuarioId = acerto.ParaUsuarioId,
                valor = acerto.Valor,
            });

        await _context.SaveChangesAsync();
    }

    private async Task<AcertoContasDto> MapToDtoAsync(AcertoContas acerto)
    {
        var nomes = await _context.Usuarios
            .Where(u => u.Id == acerto.DeUsuarioId || u.Id == acerto.ParaUsuarioId)
            .ToDictionaryAsync(u => u.Id, u => u.Nome);

        return new AcertoContasDto(
            acerto.Id,
            acerto.DeUsuarioId, nomes.GetValueOrDefault(acerto.DeUsuarioId, "—"),
            acerto.ParaUsuarioId, nomes.GetValueOrDefault(acerto.ParaUsuarioId, "—"),
            acerto.Valor, acerto.Mes, acerto.Ano, acerto.Observacao, acerto.CriadoEm);
    }

    // Leitura: qualquer membro. Escrita: bloqueia Dependente (2.3).
    private Task ExigirMembroAsync(Guid familiaId, Guid usuarioId)
        => FamiliaPermissoes.ExigirMembroAsync(_context, familiaId, usuarioId);

    private Task ExigirEscritaAsync(Guid familiaId, Guid usuarioId)
        => FamiliaPermissoes.ExigirPapelAsync(_context, familiaId, usuarioId, PapelFamilia.Membro);

    /// <summary>Valida que o pagador/recebedor é membro ativo (erro de input, não 404).</summary>
    private async Task ExigirParticipanteMembroAsync(Guid familiaId, Guid usuarioId)
    {
        var ehMembro = await _context.MembrosFamilia
            .AnyAsync(m => m.FamiliaId == familiaId && m.UsuarioId == usuarioId && m.Ativo);
        if (!ehMembro)
            throw new ArgumentException("Pagador e recebedor devem ser membros ativos da família.");
    }
}

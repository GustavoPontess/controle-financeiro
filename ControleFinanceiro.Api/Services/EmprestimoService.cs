using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.DTOs.Emprestimo;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;

namespace ControleFinanceiro.Api.Services;

public class EmprestimoService(
    AppDbContext context,
    NotificacaoService notificacaoService,
    FinancialEventLogService eventLog)
{
    private readonly AppDbContext _context = context;
    private readonly NotificacaoService _notificacaoService = notificacaoService;
    private readonly FinancialEventLogService _eventLog = eventLog;

    public async Task<PagedResult<EmprestimoDto>> ListarAsync(Guid usuarioId, int page = 1, int pageSize = 25)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = VisivelPara(usuarioId)
            .OrderBy(e => e.Quitado)
            .ThenBy(e => e.DataVencimento)
            .ThenBy(e => e.DataInicio);

        var total = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var nomes = await ObterNomesAsync(items);

        return new PagedResult<EmprestimoDto>
        {
            Items = items.Select(e => ToDto(e, usuarioId, nomes)),
            Total = total,
            Page = page,
            PageSize = pageSize,
        };
    }

    /// <summary>
    /// KPIs agregados — a receber/a pagar (restante dos ativos), qtd ativos e total.
    /// Calculado no banco, exato pra qualquer volume. Tipo invertido pra quem vê como contraparte.
    /// </summary>
    public async Task<EmprestimoStatsDto> ObterStatsAsync(Guid usuarioId)
    {
        var query = VisivelPara(usuarioId);
        var ativos = query.Where(e => !e.Quitado);

        var totalAReceber = await ativos
            .Where(e => (e.CriadoPor == usuarioId && e.Tipo == TipoEmprestimo.Emprestei)
                     || (e.CriadoPor != usuarioId && e.Tipo == TipoEmprestimo.PeguiEmprestado))
            .SumAsync(e => (decimal?)(e.ValorTotal - e.ValorPago)) ?? 0m;
        var totalAPagar = await ativos
            .Where(e => (e.CriadoPor == usuarioId && e.Tipo == TipoEmprestimo.PeguiEmprestado)
                     || (e.CriadoPor != usuarioId && e.Tipo == TipoEmprestimo.Emprestei))
            .SumAsync(e => (decimal?)(e.ValorTotal - e.ValorPago)) ?? 0m;
        var qtdAtivos = await ativos.CountAsync();
        var qtdTotal = await query.CountAsync();

        return new EmprestimoStatsDto
        {
            TotalAReceber = totalAReceber,
            TotalAPagar = totalAPagar,
            Ativos = qtdAtivos,
            QtdTotal = qtdTotal,
        };
    }

    public async Task<EmprestimoDto?> BuscarPorIdAsync(Guid id, Guid usuarioId)
    {
        var e = await VisivelPara(usuarioId).FirstOrDefaultAsync(x => x.Id == id);
        return e is null ? null : await ToDtoAsync(e, usuarioId);
    }

    public async Task<EmprestimoDto> CriarAsync(CriarEmprestimoDto dto, Guid usuarioId)
    {
        if (dto.ValorTotal <= 0)
            throw new ArgumentException("Valor total do empréstimo deve ser positivo.");

        if (dto.DataVencimento.HasValue && dto.DataVencimento.Value.Date < dto.DataInicio.Date)
            throw new ArgumentException("Data de vencimento não pode ser anterior à data de início.");

        if (string.IsNullOrWhiteSpace(dto.IdempotencyKey))
            throw new ArgumentException("idempotencyKey é obrigatório.");

        var replay = await _eventLog.BuscarPorIdempotencyKeyAsync(usuarioId, dto.IdempotencyKey);
        if (replay != null && replay.Tipo == FinancialEventType.EmprestimoCriado)
        {
            var anterior = await _context.Emprestimos.FirstOrDefaultAsync(x => x.Id == replay.EntidadeId);
            if (anterior != null)
                return await ToDtoAsync(anterior, usuarioId);
        }

        var emprestimo = new Emprestimo
        {
            Id = Guid.NewGuid(),
            Descricao = dto.Descricao,
            Pessoa = dto.Pessoa,
            ValorTotal = dto.ValorTotal,
            ValorPago = 0,
            Tipo = dto.Tipo,
            DataInicio = dto.DataInicio.ToUniversalTime(),
            DataVencimento = dto.DataVencimento.HasValue ? dto.DataVencimento.Value.ToUniversalTime() : null,
            Quitado = false,
            Observacao = dto.Observacao,
            CriadoPor = usuarioId,
        };

        _context.Emprestimos.Add(emprestimo);

        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.EmprestimoCriado,
            entidade: "Emprestimo",
            entidadeId: emprestimo.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            valorDepois: emprestimo.ValorTotal,
            payload: new { idempotencyKey = dto.IdempotencyKey, emprestimo.Id, emprestimo.ValorTotal });

        await _context.SaveChangesAsync();
        return await ToDtoAsync(emprestimo, usuarioId);
    }

    public async Task<bool> RegistrarPagamentoAsync(Guid id, decimal valor, Guid usuarioId)
    {
        if (valor <= 0)
            throw new ArgumentException("Valor do pagamento deve ser positivo.");

        var e = await BuscarParaConfirmacaoAsync(id, usuarioId);
        if (e is null || e.Quitado) return false;

        e.ValorPago = Math.Min(e.ValorPago + valor, e.ValorTotal);
        if (e.ValorPago >= e.ValorTotal) e.Quitado = true;

        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.EmprestimoPagamentoRegistrado,
            entidade: "Emprestimo",
            entidadeId: e.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            valorDepois: e.ValorPago,
            payload: new { e.Id, valor });

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> QuitarAsync(Guid id, Guid usuarioId)
    {
        var e = await BuscarParaConfirmacaoAsync(id, usuarioId);
        if (e is null) return false;

        var valorAntes = e.ValorPago;
        e.ValorPago = e.ValorTotal;
        e.Quitado = true;

        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.EmprestimoQuitado,
            entidade: "Emprestimo",
            entidadeId: e.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            valorAntes: valorAntes,
            valorDepois: e.ValorTotal,
            payload: new { e.Id });

        await _context.SaveChangesAsync();
        return true;
    }

    /// <summary>Soft delete — nunca hard-delete (CLAUDE.md). Bloqueado se já vinculado:
    /// ninguém apaga sozinho um registro que a outra parte já confirmou fazer parte.</summary>
    public async Task<bool> DeletarAsync(Guid id, Guid usuarioId)
    {
        var e = await _context.Emprestimos
            .FirstOrDefaultAsync(x => x.Id == id && x.CriadoPor == usuarioId && x.Ativo);
        if (e is null) return false;

        if (e.StatusVinculo == StatusVinculoEmprestimo.Vinculado)
            throw new ForbiddenAccessException(
                "Não é possível apagar um empréstimo vinculado — quite-o em vez disso.");

        e.Ativo = false;
        await _context.SaveChangesAsync();
        return true;
    }

    // ── Vínculo bilateral (docs/features/emprestimo-compartilhado/spec.md) ─────────────

    /// <summary>
    /// Propõe vínculo por e-mail. Resposta sempre igual, exista ou não a conta (anti-enumeração,
    /// mesmo padrão do C1 de reset-password) — só dispara notificação in-app se a conta existir.
    /// Sem envio de e-mail automático (projeto não tem SMTP real, mesmo padrão do ConviteFamilia):
    /// o link volta na resposta pro credor copiar/compartilhar por fora.
    /// </summary>
    public async Task<EmprestimoConviteResultadoDto> VincularAsync(
        Guid id, VincularEmprestimoDto dto, Guid usuarioId)
    {
        if (string.IsNullOrWhiteSpace(dto.Email))
            throw new ArgumentException("E-mail é obrigatório.");

        var emprestimo = await _context.Emprestimos
            .FirstOrDefaultAsync(e => e.Id == id && e.CriadoPor == usuarioId && e.Ativo)
            ?? throw new KeyNotFoundException("Empréstimo não encontrado.");

        if (emprestimo.StatusVinculo == StatusVinculoEmprestimo.Vinculado)
            throw new InvalidOperationException("Este empréstimo já está vinculado.");
        if (emprestimo.StatusVinculo == StatusVinculoEmprestimo.PendenteAceite)
            throw new InvalidOperationException(
                "Já existe um convite pendente — aguarde a resposta ou aguarde expirar (7 dias) antes de reenviar.");

        var email = dto.Email.Trim().ToLowerInvariant();
        var tokenBruto = GerarTokenOpaco();

        emprestimo.EmailContraparte = email;
        emprestimo.ConviteTokenHash = OpaqueTokenHasher.Hash(tokenBruto);
        emprestimo.ConviteExpiraEm = DateTime.UtcNow.AddDays(7);
        emprestimo.StatusVinculo = StatusVinculoEmprestimo.PendenteAceite;
        emprestimo.VinculoRespondidoEm = null;
        emprestimo.ContraparteUsuarioId = null;

        await _context.SaveChangesAsync();

        var contraparte = await _context.Usuarios.FirstOrDefaultAsync(u => u.Email.ToLower() == email);
        if (contraparte is not null)
        {
            var credor = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId);
            await _notificacaoService.CriarAsync(
                contraparte.Id,
                TipoNotificacao.EmprestimoVinculo,
                "Convite de empréstimo compartilhado",
                $"{credor?.Nome ?? "Alguém"} quer vincular um empréstimo com você.",
                "/emprestimos");
        }

        return new EmprestimoConviteResultadoDto($"/convite/emprestimo/{tokenBruto}");
    }

    /// <summary>Convites pendentes pro usuário logado — filtra por e-mail, igual ConviteFamilia.</summary>
    public async Task<List<EmprestimoConvitePendenteDto>> ListarConvitesPendentesAsync(Guid usuarioId)
    {
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");
        var email = usuario.Email.Trim().ToLowerInvariant();
        var agora = DateTime.UtcNow;

        var pendentes = await _context.Emprestimos
            .Where(e => e.Ativo
                && e.StatusVinculo == StatusVinculoEmprestimo.PendenteAceite
                && e.EmailContraparte == email
                && e.ConviteExpiraEm > agora)
            .ToListAsync();

        var criadoPorIds = pendentes.Select(e => e.CriadoPor).Distinct().ToList();
        var nomes = await _context.Usuarios
            .Where(u => criadoPorIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Nome);

        return pendentes.Select(e =>
        {
            // Perspectiva de quem recebe o convite: o Tipo inverte.
            var tipoEfetivo = e.Tipo == TipoEmprestimo.Emprestei
                ? TipoEmprestimo.PeguiEmprestado
                : TipoEmprestimo.Emprestei;

            return new EmprestimoConvitePendenteDto(
                e.Id,
                e.Descricao,
                e.ValorTotal,
                nomes.GetValueOrDefault(e.CriadoPor, "—"),
                tipoEfetivo == TipoEmprestimo.Emprestei ? "Emprestei" : "Peguei emprestado");
        }).ToList();
    }

    public async Task AceitarVinculoAsync(string token, Guid usuarioId)
    {
        var emprestimo = await BuscarPorTokenAsync(token);
        var usuario = await ExigirEmailDoConvidadoAsync(emprestimo, usuarioId);

        if (emprestimo.ConviteExpiraEm is null || emprestimo.ConviteExpiraEm <= DateTime.UtcNow)
            throw new InvalidOperationException("Convite expirado.");

        emprestimo.ContraparteUsuarioId = usuarioId;
        emprestimo.StatusVinculo = StatusVinculoEmprestimo.Vinculado;
        emprestimo.VinculoRespondidoEm = DateTime.UtcNow;
        emprestimo.ConviteTokenHash = null; // token de uso único

        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.EmprestimoVinculado,
            entidade: "Emprestimo",
            entidadeId: emprestimo.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            payload: new { emprestimo.Id, contraparteUsuarioId = usuarioId });

        await _context.SaveChangesAsync();

        if (emprestimo.CriadoPor != usuarioId)
        {
            await _notificacaoService.CriarAsync(
                emprestimo.CriadoPor,
                TipoNotificacao.EmprestimoVinculo,
                "Vínculo de empréstimo aceito",
                $"{usuario.Nome} aceitou o vínculo do empréstimo \"{emprestimo.Descricao}\".",
                "/emprestimos");
        }
    }

    public async Task RecusarVinculoAsync(string token, Guid usuarioId)
    {
        var emprestimo = await BuscarPorTokenAsync(token);
        await ExigirEmailDoConvidadoAsync(emprestimo, usuarioId);

        emprestimo.StatusVinculo = StatusVinculoEmprestimo.Recusado;
        emprestimo.VinculoRespondidoEm = DateTime.UtcNow;
        emprestimo.ConviteTokenHash = null;
        emprestimo.ContraparteUsuarioId = null;

        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.EmprestimoVinculoRecusado,
            entidade: "Emprestimo",
            entidadeId: emprestimo.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            payload: new { emprestimo.Id });

        await _context.SaveChangesAsync();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private IQueryable<Emprestimo> VisivelPara(Guid usuarioId) => _context.Emprestimos
        .Where(e => e.Ativo && (e.CriadoPor == usuarioId
            || (e.ContraparteUsuarioId == usuarioId && e.StatusVinculo == StatusVinculoEmprestimo.Vinculado)));

    /// <summary>Carrega o empréstimo só se usuarioId for o credor daquele registro específico
    /// (BOLA-safe: checa o objeto, não só "é o CriadoPor" — OWASP API1:2023). Estranho ao
    /// registro (nem criador nem contraparte) recebe null (404) — não confirma existência.
    /// Participante que não é credor recebe 403 — explica por que não pode.</summary>
    private async Task<Emprestimo?> BuscarParaConfirmacaoAsync(Guid id, Guid usuarioId)
    {
        var e = await _context.Emprestimos.FirstOrDefaultAsync(x => x.Id == id && x.Ativo
            && (x.CriadoPor == usuarioId || x.ContraparteUsuarioId == usuarioId));
        if (e is null) return null;

        if (!EhCredor(e, usuarioId))
            throw new ForbiddenAccessException(
                "Só o credor deste empréstimo pode confirmar pagamento ou quitação.");

        return e;
    }

    private static bool EhCredor(Emprestimo e, Guid usuarioId)
    {
        if (e.StatusVinculo != StatusVinculoEmprestimo.Vinculado)
            return usuarioId == e.CriadoPor;

        return e.Tipo == TipoEmprestimo.Emprestei
            ? usuarioId == e.CriadoPor
            : usuarioId == e.ContraparteUsuarioId;
    }

    private async Task<Emprestimo> BuscarPorTokenAsync(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            throw new KeyNotFoundException("Convite não encontrado.");

        var hash = OpaqueTokenHasher.Hash(token);
        var emprestimo = await _context.Emprestimos
            .FirstOrDefaultAsync(e => e.ConviteTokenHash == hash && e.Ativo)
            ?? throw new KeyNotFoundException("Convite não encontrado.");

        if (emprestimo.StatusVinculo != StatusVinculoEmprestimo.PendenteAceite)
            throw new InvalidOperationException("Este convite não está mais pendente.");

        return emprestimo;
    }

    private async Task<Usuario> ExigirEmailDoConvidadoAsync(Emprestimo emprestimo, Guid usuarioId)
    {
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");

        if (!string.Equals(usuario.Email.Trim(), emprestimo.EmailContraparte,
                StringComparison.OrdinalIgnoreCase))
            throw new ForbiddenAccessException("Este convite não é para o seu e-mail.");

        return usuario;
    }

    private async Task<EmprestimoDto> ToDtoAsync(Emprestimo e, Guid usuarioId)
    {
        var nomes = await ObterNomesAsync([e]);
        return ToDto(e, usuarioId, nomes);
    }

    private async Task<Dictionary<Guid, string>> ObterNomesAsync(List<Emprestimo> items)
    {
        var ids = items.Select(e => e.CriadoPor)
            .Concat(items.Where(e => e.ContraparteUsuarioId.HasValue).Select(e => e.ContraparteUsuarioId!.Value))
            .Distinct()
            .ToList();

        return await _context.Usuarios
            .Where(u => ids.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Nome);
    }

    /// <summary>Tudo relativo a quem está olhando (usuarioId), não ao CriadoPor — quem vê como
    /// contraparte enxerga Tipo/credor invertidos.</summary>
    private static EmprestimoDto ToDto(Emprestimo e, Guid usuarioId, IReadOnlyDictionary<Guid, string> nomes)
    {
        var restante = e.ValorTotal - e.ValorPago;
        var percentual = e.ValorTotal > 0 ? Math.Round(e.ValorPago / e.ValorTotal * 100, 1) : 0;
        var vencido = !e.Quitado && e.DataVencimento.HasValue && e.DataVencimento.Value.Date < DateTime.UtcNow.Date;

        var souCriador = usuarioId == e.CriadoPor;
        var vinculado = e.StatusVinculo == StatusVinculoEmprestimo.Vinculado;

        var tipoEfetivo = souCriador
            ? e.Tipo
            : (e.Tipo == TipoEmprestimo.Emprestei ? TipoEmprestimo.PeguiEmprestado : TipoEmprestimo.Emprestei);

        var souCredor = !vinculado
            ? souCriador
            : (e.Tipo == TipoEmprestimo.Emprestei ? usuarioId == e.CriadoPor : usuarioId == e.ContraparteUsuarioId);

        var pessoa = souCriador ? e.Pessoa : nomes.GetValueOrDefault(e.CriadoPor, e.Pessoa);
        var contraparteNome = souCriador
            ? (vinculado ? nomes.GetValueOrDefault(e.ContraparteUsuarioId ?? Guid.Empty) : e.Pessoa)
            : nomes.GetValueOrDefault(e.CriadoPor);

        return new EmprestimoDto
        {
            Id = e.Id,
            Descricao = e.Descricao,
            Pessoa = pessoa,
            ValorTotal = e.ValorTotal,
            ValorPago = e.ValorPago,
            ValorRestante = restante,
            PercentualPago = percentual,
            Tipo = (int)tipoEfetivo,
            TipoDescricao = tipoEfetivo == TipoEmprestimo.Emprestei ? "Emprestei" : "Peguei emprestado",
            DataInicio = e.DataInicio,
            DataVencimento = e.DataVencimento,
            Quitado = e.Quitado,
            Vencido = vencido,
            Observacao = e.Observacao,
            StatusVinculo = (int)e.StatusVinculo,
            ContraparteNome = contraparteNome,
            SouCredor = souCredor,
        };
    }

    private static string GerarTokenOpaco()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}

using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Admin;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Regras do admin sobre usuários — Módulo A (fila de aprovação: aprovar/recusar + métricas) e
/// Módulo B (gestão: listar, bloquear/reativar, forçar reset). Spec `docs/features/admin/spec.md`
/// §3-§4. Exclusão (soft/hard) é o Módulo C, fica noutro lugar. Admin nunca age sobre a própria
/// conta em ação sensível (§0.6). Transições da fila registram QUEM/QUANDO (AprovadoPor/AprovadoEm).
/// </summary>
public class AdminUsuarioService
{
    private readonly AppDbContext _context;
    private readonly IPasswordResetDispatcher _resetDispatcher;
    private readonly AdminAuditService _audit;
    private readonly NotificacaoAdminService _notificacaoAdmin;

    public AdminUsuarioService(AppDbContext context, IPasswordResetDispatcher resetDispatcher,
        AdminAuditService audit, NotificacaoAdminService notificacaoAdmin)
    {
        _context = context;
        _resetDispatcher = resetDispatcher;
        _audit = audit;
        _notificacaoAdmin = notificacaoAdmin;
    }

    /// <summary>Fila de cadastros aguardando decisão — mais antigos primeiro (ordem de chegada).</summary>
    public async Task<List<UsuarioAdminDto>> ListarPendentesAsync()
    {
        return await _context.Usuarios
            .Where(u => u.Status == StatusUsuario.AguardandoAprovacao)
            .OrderBy(u => u.CriadoEm)
            .Select(u => new UsuarioAdminDto
            {
                Id = u.Id,
                Email = u.Email,
                Nome = u.Nome,
                Status = u.Status,
                CriadoEm = u.CriadoEm,
                AprovadoEm = u.AprovadoEm,
                UltimoAcessoEm = u.UltimoAcessoEm,
                MarcadoExclusaoEm = u.MarcadoExclusaoEm,
            })
            .ToListAsync();
    }

    /// <summary>Aprova um cadastro pendente → <see cref="StatusUsuario.Ativo"/>. Só age sobre quem
    /// está <see cref="StatusUsuario.AguardandoAprovacao"/> (409 caso contrário — evita reaprovar/
    /// "ativar" um recusado ou bloqueado por engano; esses têm fluxo próprio nos módulos B/C).</summary>
    public async Task<UsuarioAdminDto> AprovarAsync(Guid usuarioId, Guid adminId, string adminEmail)
        => await DecidirAsync(usuarioId, adminId, adminEmail, StatusUsuario.Ativo, AcaoAdmin.AprovarCadastro);

    /// <summary>Recusa um cadastro pendente → <see cref="StatusUsuario.Recusado"/>. Mesma trava:
    /// só sobre pendentes.</summary>
    public async Task<UsuarioAdminDto> RecusarAsync(Guid usuarioId, Guid adminId, string adminEmail)
        => await DecidirAsync(usuarioId, adminId, adminEmail, StatusUsuario.Recusado, AcaoAdmin.RecusarCadastro);

    private async Task<UsuarioAdminDto> DecidirAsync(Guid usuarioId, Guid adminId, string adminEmail, StatusUsuario novoStatus, AcaoAdmin acao)
    {
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");

        if (usuario.Status != StatusUsuario.AguardandoAprovacao)
            throw new InvalidOperationException("Este cadastro não está aguardando aprovação.");

        usuario.Status = novoStatus;
        usuario.AprovadoPor = adminId;
        usuario.AprovadoEm = DateTime.UtcNow;
        usuario.AtualizadoEm = DateTime.UtcNow;

        _audit.Registrar(adminId, adminEmail, acao, "Usuario", usuario.Id, usuario.Email);
        // Cadastro tratado → dá baixa na notificação "novo cadastro" desse usuário (some do sino).
        await _notificacaoAdmin.MarcarLidasPorAlvoAsync(usuario.Id);
        await _context.SaveChangesAsync();

        return MapToDto(usuario);
    }

    /// <summary>Contagens do beta pro dashboard do admin.</summary>
    public async Task<MetricasAdminDto> ObterMetricasAsync()
    {
        var seteDiasAtras = DateTime.UtcNow.AddDays(-7);

        // Uma passada agregando por status — evita N queries de Count separadas.
        var porStatus = await _context.Usuarios
            .Where(u => u.Status != StatusUsuario.Removido)
            .GroupBy(u => u.Status)
            .Select(g => new { Status = g.Key, Qtd = g.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Qtd);

        int Contar(StatusUsuario s) => porStatus.TryGetValue(s, out var q) ? q : 0;

        return new MetricasAdminDto
        {
            Total = porStatus.Values.Sum(),
            Pendentes = Contar(StatusUsuario.AguardandoAprovacao),
            Ativos = Contar(StatusUsuario.Ativo),
            Recusados = Contar(StatusUsuario.Recusado),
            Bloqueados = Contar(StatusUsuario.Bloqueado),
            MarcadosParaExclusao = Contar(StatusUsuario.MarcadoParaExclusao),
            CadastrosUltimos7Dias = await _context.Usuarios.CountAsync(u => u.CriadoEm >= seteDiasAtras && u.Status != StatusUsuario.Removido),
            AtivosUltimos7Dias = await _context.Usuarios.CountAsync(
                u => u.Status == StatusUsuario.Ativo && u.UltimoAcessoEm != null && u.UltimoAcessoEm >= seteDiasAtras),
        };
    }

    // ── Módulo B — gestão de usuários ─────────────────────────────────────────────────────

    /// <summary>Lista usuários (gestão) — paginado e com busca SERVER-SIDE por nome/e-mail (contém,
    /// case-insensitive). Filtro/contagem/paginação na query (nunca no cliente), pra `Total` refletir
    /// o filtro e não trazer a tabela inteira pro browser. Mais recentes primeiro. Nunca expõe
    /// hash/segredo (usa o DTO enxuto). `pageSize` clampado em 1..100.</summary>
    public async Task<PagedResult<UsuarioAdminDto>> ListarUsuariosAsync(string? busca = null, int page = 1, int pageSize = 25)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        // "Membro que saiu" (conta excluída que ficou só no histórico da família) não é usuário de verdade.
        var q = _context.Usuarios.Where(u => u.Status != StatusUsuario.Removido);

        if (!string.IsNullOrWhiteSpace(busca))
        {
            var termo = busca.Trim().ToLower();
            q = q.Where(u => u.Nome.ToLower().Contains(termo) || u.Email.ToLower().Contains(termo));
        }

        q = q.OrderByDescending(u => u.CriadoEm);

        var total = await q.CountAsync();
        var items = await q
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new UsuarioAdminDto
            {
                Id = u.Id,
                Email = u.Email,
                Nome = u.Nome,
                Status = u.Status,
                CriadoEm = u.CriadoEm,
                AprovadoEm = u.AprovadoEm,
                UltimoAcessoEm = u.UltimoAcessoEm,
                MarcadoExclusaoEm = u.MarcadoExclusaoEm,
            })
            .ToListAsync();

        return new PagedResult<UsuarioAdminDto>
        {
            Items = items,
            Total = total,
            Page = page,
            PageSize = pageSize,
        };
    }

    /// <summary>Bloqueia um usuário Ativo → <see cref="StatusUsuario.Bloqueado"/> (não loga mais; dados
    /// preservados; reversível). Só sobre Ativo (409 caso contrário). Admin NÃO bloqueia a si mesmo
    /// (§0.6 — evita lockout): 403.</summary>
    public async Task<UsuarioAdminDto> BloquearAsync(Guid usuarioId, Guid adminId, string adminEmail)
    {
        if (usuarioId == adminId)
            throw new ForbiddenAccessException("Você não pode bloquear a própria conta.");

        var usuario = await BuscarOuFalharAsync(usuarioId);
        if (usuario.Status != StatusUsuario.Ativo)
            throw new InvalidOperationException("Só é possível bloquear um usuário ativo.");

        usuario.Status = StatusUsuario.Bloqueado;
        usuario.AtualizadoEm = DateTime.UtcNow;
        _audit.Registrar(adminId, adminEmail, AcaoAdmin.BloquearUsuario, "Usuario", usuario.Id, usuario.Email);
        await _context.SaveChangesAsync();
        return MapToDto(usuario);
    }

    /// <summary>Reativa um usuário bloqueado → <see cref="StatusUsuario.Ativo"/>. Só sobre Bloqueado (409).</summary>
    public async Task<UsuarioAdminDto> ReativarAsync(Guid usuarioId, Guid adminId, string adminEmail)
    {
        var usuario = await BuscarOuFalharAsync(usuarioId);
        if (usuario.Status != StatusUsuario.Bloqueado)
            throw new InvalidOperationException("Só é possível reativar um usuário bloqueado.");

        usuario.Status = StatusUsuario.Ativo;
        usuario.AtualizadoEm = DateTime.UtcNow;
        _audit.Registrar(adminId, adminEmail, AcaoAdmin.ReativarUsuario, "Usuario", usuario.Id, usuario.Email);
        await _context.SaveChangesAsync();
        return MapToDto(usuario);
    }

    /// <summary>Força o reset de senha de um usuário Ativo — dispara o MESMO fluxo do "esqueci a senha"
    /// (e-mail com link), reusando o dispatcher existente (rate-limit e hash de token já embutidos).
    /// Só faz sentido pra Ativo (o job de e-mail ignora não-Ativo): 409 caso contrário.</summary>
    public async Task ForcarResetSenhaAsync(Guid usuarioId, Guid adminId, string adminEmail)
    {
        var usuario = await BuscarOuFalharAsync(usuarioId);
        if (usuario.Status != StatusUsuario.Ativo)
            throw new InvalidOperationException("Só é possível forçar reset de um usuário ativo.");

        _resetDispatcher.Disparar(usuario.Email);
        _audit.Registrar(adminId, adminEmail, AcaoAdmin.ForcarResetSenha, "Usuario", usuario.Id, usuario.Email);
        await _context.SaveChangesAsync();
    }

    private async Task<Domain.Entities.Usuario> BuscarOuFalharAsync(Guid usuarioId)
        => await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId)
           ?? throw new KeyNotFoundException("Usuário não encontrado.");

    private static UsuarioAdminDto MapToDto(Domain.Entities.Usuario u) => UsuarioAdminDto.De(u);
}

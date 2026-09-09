using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Admin;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Regras da fila de aprovação do beta (Módulo A do admin — spec `docs/features/admin/spec.md` §3).
/// Aprovar/recusar são as únicas transições daqui; bloquear/exclusão são módulos B/C.
/// Toda transição registra QUEM (AprovadoPor) e QUANDO (AprovadoEm) — auditoria mínima da fila.
/// </summary>
public class AdminUsuarioService
{
    private readonly AppDbContext _context;

    public AdminUsuarioService(AppDbContext context) => _context = context;

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
            })
            .ToListAsync();
    }

    /// <summary>Aprova um cadastro pendente → <see cref="StatusUsuario.Ativo"/>. Só age sobre quem
    /// está <see cref="StatusUsuario.AguardandoAprovacao"/> (409 caso contrário — evita reaprovar/
    /// "ativar" um recusado ou bloqueado por engano; esses têm fluxo próprio nos módulos B/C).</summary>
    public async Task<UsuarioAdminDto> AprovarAsync(Guid usuarioId, Guid adminId)
        => await DecidirAsync(usuarioId, adminId, StatusUsuario.Ativo);

    /// <summary>Recusa um cadastro pendente → <see cref="StatusUsuario.Recusado"/>. Mesma trava:
    /// só sobre pendentes.</summary>
    public async Task<UsuarioAdminDto> RecusarAsync(Guid usuarioId, Guid adminId)
        => await DecidirAsync(usuarioId, adminId, StatusUsuario.Recusado);

    private async Task<UsuarioAdminDto> DecidirAsync(Guid usuarioId, Guid adminId, StatusUsuario novoStatus)
    {
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");

        if (usuario.Status != StatusUsuario.AguardandoAprovacao)
            throw new InvalidOperationException("Este cadastro não está aguardando aprovação.");

        usuario.Status = novoStatus;
        usuario.AprovadoPor = adminId;
        usuario.AprovadoEm = DateTime.UtcNow;
        usuario.AtualizadoEm = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return MapToDto(usuario);
    }

    /// <summary>Contagens do beta pro dashboard do admin.</summary>
    public async Task<MetricasAdminDto> ObterMetricasAsync()
    {
        var seteDiasAtras = DateTime.UtcNow.AddDays(-7);

        // Uma passada agregando por status — evita N queries de Count separadas.
        var porStatus = await _context.Usuarios
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
            CadastrosUltimos7Dias = await _context.Usuarios.CountAsync(u => u.CriadoEm >= seteDiasAtras),
            AtivosUltimos7Dias = await _context.Usuarios.CountAsync(
                u => u.Status == StatusUsuario.Ativo && u.UltimoAcessoEm != null && u.UltimoAcessoEm >= seteDiasAtras),
        };
    }

    private static UsuarioAdminDto MapToDto(Domain.Entities.Usuario u) => new()
    {
        Id = u.Id,
        Email = u.Email,
        Nome = u.Nome,
        Status = u.Status,
        CriadoEm = u.CriadoEm,
        AprovadoEm = u.AprovadoEm,
        UltimoAcessoEm = u.UltimoAcessoEm,
    };
}

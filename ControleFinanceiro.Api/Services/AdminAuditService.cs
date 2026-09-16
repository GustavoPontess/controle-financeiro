using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Admin;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Auditoria de ações de admin (Módulo D — spec `docs/features/admin/spec.md` §6). Append-only:
/// só escreve (<see cref="Registrar"/>) e lê (<see cref="ListarAsync"/>); nunca edita/apaga.
/// Grava snapshot denormalizado (e-mail do admin + descrição do alvo) pra ser legível sozinho.
/// </summary>
public class AdminAuditService
{
    private readonly AppDbContext _context;

    public AdminAuditService(AppDbContext context) => _context = context;

    /// <summary>Registra uma ação de admin. NÃO chama SaveChanges — é gravado junto com a transação
    /// da ação (o caller dá o SaveChanges), pra a auditoria e a mudança caírem atômicas.</summary>
    public void Registrar(Guid adminId, string adminEmail, AcaoAdmin acao,
        string? alvoTipo = null, Guid? alvoId = null, string? alvoDescricao = null, string? detalhe = null)
    {
        _context.AdminAuditLogs.Add(new AdminAuditLog
        {
            Id = Guid.NewGuid(),
            AdminUsuarioId = adminId,
            AdminEmail = adminEmail,
            Acao = acao,
            AlvoTipo = alvoTipo,
            AlvoId = alvoId,
            AlvoDescricao = alvoDescricao,
            Detalhe = detalhe,
            CriadoEm = DateTime.UtcNow,
        });
    }

    /// <summary>Ações de admin — paginado e com busca SERVER-SIDE (e-mail do admin ou descrição do alvo),
    /// mais recentes primeiro. Filtro/contagem/paginação na query (não no cliente), pra alcançar também
    /// registros antigos — antes havia um teto fixo de 200 que os deixava inacessíveis. `pageSize`
    /// clampado em 1..100.</summary>
    public async Task<PagedResult<AdminAuditLogDto>> ListarAsync(string? busca = null, int page = 1, int pageSize = 25)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var q = _context.AdminAuditLogs.AsQueryable();

        if (!string.IsNullOrWhiteSpace(busca))
        {
            var termo = busca.Trim().ToLower();
            q = q.Where(a => a.AdminEmail.ToLower().Contains(termo)
                || (a.AlvoDescricao != null && a.AlvoDescricao.ToLower().Contains(termo)));
        }

        q = q.OrderByDescending(a => a.CriadoEm);

        var total = await q.CountAsync();
        var items = await q
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AdminAuditLogDto
            {
                Id = a.Id,
                AdminEmail = a.AdminEmail,
                Acao = a.Acao,
                AlvoTipo = a.AlvoTipo,
                AlvoId = a.AlvoId,
                AlvoDescricao = a.AlvoDescricao,
                Detalhe = a.Detalhe,
                CriadoEm = a.CriadoEm,
            })
            .ToListAsync();

        return new PagedResult<AdminAuditLogDto>
        {
            Items = items,
            Total = total,
            Page = page,
            PageSize = pageSize,
        };
    }
}

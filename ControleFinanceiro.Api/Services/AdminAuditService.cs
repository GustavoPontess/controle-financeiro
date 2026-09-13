using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Admin;
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
    private const int MaxListagem = 200; // beta: volume baixo; paginação fica pra depois se precisar

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

    /// <summary>Últimas ações de admin, mais recentes primeiro.</summary>
    public async Task<List<AdminAuditLogDto>> ListarAsync()
    {
        return await _context.AdminAuditLogs
            .OrderByDescending(a => a.CriadoEm)
            .Take(MaxListagem)
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
    }
}

using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Data;

/// <summary>
/// Concede a flag <c>IsAdmin</c> aos e-mails listados na env var <c>ADMIN_EMAILS</c>
/// (separados por vírgula, mesmo padrão do <c>HANGFIRE_ADMIN_EMAILS</c>). É a ÚNICA forma
/// prevista de tornar alguém admin pela aplicação — nunca há endpoint que sete essa flag
/// (spec `docs/features/admin/spec.md` §0). Roda no boot.
///
/// Comportamento fail-safe:
/// - Sem a env var → não faz nada (ninguém vira admin por acidente).
/// - Só CONCEDE (seta true pros e-mails listados que já existem). NUNCA revoga automaticamente
///   quem não está na lista — revogar admin é operação manual (UPDATE no banco), pra evitar
///   lockout acidental por env var errada.
/// - Idempotente: só grava se algo mudou.
/// </summary>
public static class AdminSeeder
{
    public static async Task SeedAsync(AppDbContext context)
    {
        var raw = Environment.GetEnvironmentVariable("ADMIN_EMAILS");
        if (string.IsNullOrWhiteSpace(raw)) return;

        var emails = raw
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(e => e.ToLower())
            .Distinct()
            .ToList();
        if (emails.Count == 0) return;

        var candidatos = await context.Usuarios
            .Where(u => emails.Contains(u.Email) && !u.IsAdmin)
            .ToListAsync();

        if (candidatos.Count == 0) return;

        foreach (var u in candidatos)
        {
            u.IsAdmin = true;
            u.AtualizadoEm = DateTime.UtcNow;
        }

        await context.SaveChangesAsync();
    }
}

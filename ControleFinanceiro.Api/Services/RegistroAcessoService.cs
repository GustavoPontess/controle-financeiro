using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Store de registros de acesso à aplicação (retenção Marco Civil Art. 15). Append-only + purga de
/// retenção vencida. Store separado do usuário (sem FK) → sobrevive à purga LGPD da conta.
/// </summary>
public class RegistroAcessoService
{
    /// <summary>Prazo legal de guarda (Marco Civil Art. 15 = 6 meses). Passado esse prazo o registro
    /// DEVE ser eliminado (minimização LGPD) — não se guarda além do necessário.</summary>
    public const int RetencaoDias = 180;

    private readonly AppDbContext _context;

    public RegistroAcessoService(AppDbContext context) => _context = context;

    /// <summary>Registra um login concluído. SaveChanges próprio — é um append independente da
    /// transação do login (o caller trata falha como best-effort pra não derrubar o acesso).</summary>
    public async Task RegistrarLoginAsync(Guid usuarioId, string email, string ip)
    {
        _context.RegistrosAcesso.Add(new RegistroAcesso
        {
            Id = Guid.NewGuid(),
            UsuarioId = usuarioId,
            Email = email,
            Ip = string.IsNullOrWhiteSpace(ip) ? "desconhecido" : ip.Trim(),
            Tipo = TipoEventoAcesso.Login,
            CriadoEm = DateTime.UtcNow,
        });
        await _context.SaveChangesAsync();
    }

    /// <summary>Purga registros cuja retenção de 6 meses venceu. Retorna quantos foram apagados.</summary>
    public async Task<int> PurgarExpiradosAsync()
    {
        var limite = DateTime.UtcNow.AddDays(-RetencaoDias);
        var vencidos = await _context.RegistrosAcesso
            .Where(r => r.CriadoEm < limite)
            .ToListAsync();

        if (vencidos.Count == 0)
            return 0;

        _context.RegistrosAcesso.RemoveRange(vencidos);
        await _context.SaveChangesAsync();
        return vencidos.Count;
    }
}

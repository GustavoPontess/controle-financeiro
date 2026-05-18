using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

public class AcertoService
{
    private readonly AppDbContext _context;

    public AcertoService(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>Registra um acerto: um membro pagou a outro o que devia.</summary>
    public async Task<AcertoContasDto> RegistrarAsync(
        Guid familiaId, Guid usuarioId, RegistrarAcertoDto dto)
    {
        await ExigirMembroAsync(familiaId, usuarioId);

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
        await _context.SaveChangesAsync();

        return await MapToDtoAsync(acerto);
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
        await ExigirMembroAsync(familiaId, usuarioId);

        var acerto = await _context.AcertosContas
            .FirstOrDefaultAsync(a => a.Id == acertoId && a.FamiliaId == familiaId && a.Ativo)
            ?? throw new KeyNotFoundException("Acerto não encontrado.");

        acerto.Ativo = false;
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

    private async Task ExigirMembroAsync(Guid familiaId, Guid usuarioId)
    {
        var ehMembro = await _context.MembrosFamilia
            .AnyAsync(m => m.FamiliaId == familiaId && m.UsuarioId == usuarioId && m.Ativo);
        if (!ehMembro)
            throw new KeyNotFoundException("Família não encontrada.");
    }

    /// <summary>Valida que o pagador/recebedor é membro ativo (erro de input, não 404).</summary>
    private async Task ExigirParticipanteMembroAsync(Guid familiaId, Guid usuarioId)
    {
        var ehMembro = await _context.MembrosFamilia
            .AnyAsync(m => m.FamiliaId == familiaId && m.UsuarioId == usuarioId && m.Ativo);
        if (!ehMembro)
            throw new ArgumentException("Pagador e recebedor devem ser membros ativos da família.");
    }
}

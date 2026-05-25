using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.DTOs.Meta;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

public class MetaService
{
    private readonly AppDbContext _context;

    public MetaService(AppDbContext context)
    {
        _context = context;
    }

    // ── Criar ────────────────────────────────────────────────────────────────

    /// <summary>Cria uma nova meta para o usuário (ou família, se FamiliaId fornecido).</summary>
    public async Task<MetaDto> CriarAsync(CriarMetaDto dto, Guid usuarioId)
    {
        if (dto.FamiliaId.HasValue)
            await ExigirMembroAsync(dto.FamiliaId.Value, usuarioId);

        var meta = new Meta
        {
            Id = Guid.NewGuid(),
            Nome = dto.Nome,
            Descricao = dto.Descricao,
            ValorAlvo = dto.ValorAlvo,
            ValorAtual = 0m,
            DataLimite = dto.DataLimite?.ToUniversalTime(),
            UsuarioId = usuarioId,
            FamiliaId = dto.FamiliaId,
            CategoriaId = dto.CategoriaId,
        };

        _context.Metas.Add(meta);
        await _context.SaveChangesAsync();

        return MapToDto(meta);
    }

    // ── Listar ───────────────────────────────────────────────────────────────

    /// <summary>Lista metas ativas do usuário (pessoais + de família se pertencer).</summary>
    public async Task<List<MetaDto>> ListarAsync(Guid usuarioId)
    {
        var familiaIds = await _context.MembrosFamilia
            .Where(m => m.UsuarioId == usuarioId && m.Ativo)
            .Select(m => m.FamiliaId)
            .ToListAsync();

        return await _context.Metas
            .Where(m => m.Ativo && (m.UsuarioId == usuarioId
                || (m.FamiliaId != null && familiaIds.Contains(m.FamiliaId.Value))))
            .OrderBy(m => m.CriadoEm)
            .Select(m => MapToDto(m))
            .ToListAsync();
    }

    // ── Obter ────────────────────────────────────────────────────────────────

    /// <summary>Retorna uma meta pelo ID, verificando acesso.</summary>
    public async Task<MetaDto> ObterAsync(Guid metaId, Guid usuarioId)
    {
        var meta = await BuscarComAcessoAsync(metaId, usuarioId);
        return MapToDto(meta);
    }

    // ── Atualizar ────────────────────────────────────────────────────────────

    /// <summary>Atualiza dados da meta (somente o criador).</summary>
    public async Task<MetaDto> AtualizarAsync(Guid metaId, CriarMetaDto dto, Guid usuarioId)
    {
        var meta = await BuscarPropriaAsync(metaId, usuarioId);

        meta.Nome = dto.Nome;
        meta.Descricao = dto.Descricao;
        meta.ValorAlvo = dto.ValorAlvo;
        meta.DataLimite = dto.DataLimite?.ToUniversalTime();
        meta.CategoriaId = dto.CategoriaId;
        meta.AtualizadoEm = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return MapToDto(meta);
    }

    // ── Contribuir ───────────────────────────────────────────────────────────

    /// <summary>Adiciona (ou subtrai, se negativo) valor ao progresso da meta.</summary>
    public async Task<MetaDto> ContribuirAsync(Guid metaId, ContribuirMetaDto dto, Guid usuarioId)
    {
        var meta = await BuscarComAcessoAsync(metaId, usuarioId);

        meta.ValorAtual = Math.Max(0m, meta.ValorAtual + dto.Valor);
        meta.AtualizadoEm = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return MapToDto(meta);
    }

    // ── Excluir (soft delete) ────────────────────────────────────────────────

    /// <summary>Inativa a meta (soft delete). Somente o criador.</summary>
    public async Task ExcluirAsync(Guid metaId, Guid usuarioId)
    {
        var meta = await BuscarPropriaAsync(metaId, usuarioId);
        meta.Ativo = false;
        meta.AtualizadoEm = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async Task<Meta> BuscarPropriaAsync(Guid metaId, Guid usuarioId)
    {
        var meta = await _context.Metas
            .FirstOrDefaultAsync(m => m.Id == metaId && m.Ativo)
            ?? throw new KeyNotFoundException("Meta não encontrada.");

        if (meta.UsuarioId != usuarioId)
            throw new UnauthorizedAccessException("Você não tem permissão para editar esta meta.");

        return meta;
    }

    private async Task<Meta> BuscarComAcessoAsync(Guid metaId, Guid usuarioId)
    {
        var meta = await _context.Metas
            .FirstOrDefaultAsync(m => m.Id == metaId && m.Ativo)
            ?? throw new KeyNotFoundException("Meta não encontrada.");

        // Acesso: criador OU membro da família
        if (meta.UsuarioId == usuarioId)
            return meta;

        if (meta.FamiliaId.HasValue)
        {
            var ehMembro = await _context.MembrosFamilia
                .AnyAsync(m => m.FamiliaId == meta.FamiliaId && m.UsuarioId == usuarioId && m.Ativo);
            if (ehMembro) return meta;
        }

        throw new UnauthorizedAccessException("Você não tem acesso a esta meta.");
    }

    private async Task ExigirMembroAsync(Guid familiaId, Guid usuarioId)
    {
        var ehMembro = await _context.MembrosFamilia
            .AnyAsync(m => m.FamiliaId == familiaId && m.UsuarioId == usuarioId && m.Ativo);
        if (!ehMembro)
            throw new KeyNotFoundException("Família não encontrada ou sem permissão.");
    }

    private static MetaDto MapToDto(Meta m)
    {
        var pct = m.ValorAlvo > 0
            ? Math.Min(100m, Math.Round(m.ValorAtual * 100m / m.ValorAlvo, 2))
            : 0m;
        return new MetaDto(
            m.Id, m.Nome, m.Descricao,
            m.ValorAlvo, m.ValorAtual, pct,
            m.ValorAtual >= m.ValorAlvo,
            m.DataLimite, m.UsuarioId, m.FamiliaId, m.CategoriaId,
            m.Ativo, m.CriadoEm, m.AtualizadoEm);
    }
}

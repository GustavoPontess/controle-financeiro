using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

public class FamiliaService
{
    private readonly AppDbContext _context;

    public FamiliaService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<FamiliaDto> CriarAsync(CriarFamiliaDto dto, Guid usuarioId)
    {
        if (string.IsNullOrWhiteSpace(dto.Nome))
            throw new ArgumentException("Nome da família é obrigatório.");

        var familia = new Familia
        {
            Id = Guid.NewGuid(),
            Nome = dto.Nome.Trim(),
            CriadoPorUsuarioId = usuarioId,
            CriadoEm = DateTime.UtcNow,
            Ativa = true,
        };

        var membroAdmin = new MembroFamilia
        {
            Id = Guid.NewGuid(),
            FamiliaId = familia.Id,
            UsuarioId = usuarioId,
            Papel = "Administrador",
            EntrouEm = DateTime.UtcNow,
            Ativo = true,
        };

        _context.Familias.Add(familia);
        _context.MembrosFamilia.Add(membroAdmin);
        await _context.SaveChangesAsync();

        return new FamiliaDto(familia.Id, familia.Nome, familia.CriadoPorUsuarioId,
            familia.CriadoEm, EhAdmin: true, TotalMembros: 1);
    }

    public async Task<List<FamiliaDto>> ListarAsync(Guid usuarioId)
    {
        var familias = await _context.MembrosFamilia
            .Where(m => m.UsuarioId == usuarioId && m.Ativo)
            .Select(m => m.Familia!)
            .Where(f => f.Ativa)
            .Select(f => new FamiliaDto(
                f.Id,
                f.Nome,
                f.CriadoPorUsuarioId,
                f.CriadoEm,
                f.CriadoPorUsuarioId == usuarioId,
                f.Membros.Count(mm => mm.Ativo)))
            .AsNoTracking()
            .ToListAsync();

        return familias;
    }

    public async Task<FamiliaDetalheDto> ObterDetalheAsync(Guid familiaId, Guid usuarioId)
    {
        var familia = await _context.Familias
            .Include(f => f.Membros.Where(m => m.Ativo))
                .ThenInclude(m => m.Usuario)
            .Include(f => f.Convites.Where(c => c.Status == StatusConvite.Pendente))
            .FirstOrDefaultAsync(f => f.Id == familiaId && f.Ativa);

        if (familia == null || !familia.Membros.Any(m => m.UsuarioId == usuarioId && m.Ativo))
            throw new KeyNotFoundException("Família não encontrada.");

        var membros = familia.Membros
            .Select(m => new MembroFamiliaDto(
                m.Id, m.UsuarioId, m.Usuario!.Nome, m.Usuario.Email, m.Papel, m.EntrouEm))
            .ToList();

        var convites = familia.Convites
            .Select(c => new ConviteFamiliaDto(
                c.Id, c.FamiliaId, familia.Nome, c.EmailConvidado, c.Papel,
                c.Status, c.ExpiraEm, c.CriadoEm, c.Token))
            .ToList();

        return new FamiliaDetalheDto(familia.Id, familia.Nome, familia.CriadoPorUsuarioId,
            familia.CriadoEm, familia.CriadoPorUsuarioId == usuarioId, membros, convites);
    }

    public async Task DissolverAsync(Guid familiaId, Guid usuarioId)
    {
        var familia = await BuscarFamiliaAsync(familiaId);
        ExigirAdmin(familia, usuarioId);

        familia.Ativa = false;
        await _context.SaveChangesAsync();
    }

    public async Task<MembroFamiliaDto> EditarPapelAsync(
        Guid familiaId, Guid membroId, EditarPapelDto dto, Guid usuarioId)
    {
        if (string.IsNullOrWhiteSpace(dto.Papel))
            throw new ArgumentException("Papel é obrigatório.");

        var familia = await BuscarFamiliaAsync(familiaId);

        var membro = await _context.MembrosFamilia
            .Include(m => m.Usuario)
            .FirstOrDefaultAsync(m => m.Id == membroId && m.FamiliaId == familiaId && m.Ativo)
            ?? throw new KeyNotFoundException("Membro não encontrado.");

        // Admin edita qualquer um; membro edita apenas o próprio papel.
        var ehAdmin = familia.CriadoPorUsuarioId == usuarioId;
        if (!ehAdmin && membro.UsuarioId != usuarioId)
            throw new UnauthorizedAccessException("Você só pode editar o próprio papel.");

        membro.Papel = dto.Papel.Trim();
        await _context.SaveChangesAsync();

        return new MembroFamiliaDto(membro.Id, membro.UsuarioId, membro.Usuario!.Nome,
            membro.Usuario.Email, membro.Papel, membro.EntrouEm);
    }

    public async Task RemoverMembroAsync(Guid familiaId, Guid membroId, Guid usuarioId)
    {
        var familia = await BuscarFamiliaAsync(familiaId);

        var membro = await _context.MembrosFamilia
            .FirstOrDefaultAsync(m => m.Id == membroId && m.FamiliaId == familiaId && m.Ativo)
            ?? throw new KeyNotFoundException("Membro não encontrado.");

        var ehAdmin = familia.CriadoPorUsuarioId == usuarioId;
        if (!ehAdmin && membro.UsuarioId != usuarioId)
            throw new UnauthorizedAccessException("Você só pode remover a si mesmo.");

        // O admin não sai sem dissolver — caso contrário a família ficaria sem dono.
        if (membro.UsuarioId == familia.CriadoPorUsuarioId)
            throw new InvalidOperationException(
                "O administrador não pode sair da família. Dissolva a família.");

        membro.Ativo = false;
        await _context.SaveChangesAsync();
    }

    private async Task<Familia> BuscarFamiliaAsync(Guid familiaId)
    {
        return await _context.Familias.FirstOrDefaultAsync(f => f.Id == familiaId && f.Ativa)
            ?? throw new KeyNotFoundException("Família não encontrada.");
    }

    private static void ExigirAdmin(Familia familia, Guid usuarioId)
    {
        if (familia.CriadoPorUsuarioId != usuarioId)
            throw new UnauthorizedAccessException("Apenas o administrador pode executar esta ação.");
    }
}

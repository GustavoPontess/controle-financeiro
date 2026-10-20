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
            PapelPermissao = PapelFamilia.Admin, // o criador é Admin (2.3)
            EntrouEm = DateTime.UtcNow,
            Ativo = true,
        };

        _context.Familias.Add(familia);
        _context.MembrosFamilia.Add(membroAdmin);
        await _context.SaveChangesAsync();

        return new FamiliaDto(familia.Id, familia.Nome, familia.CriadoPorUsuarioId,
            familia.CriadoEm, EhAdmin: true, TotalMembros: 1, LimiteAprovacao: null);
    }

    public async Task<List<FamiliaDto>> ListarAsync(Guid usuarioId)
    {
        // ehAdmin agora vem do papel de permissão do próprio membro (2.3), não de "é o criador".
        var familias = await _context.MembrosFamilia
            .Where(m => m.UsuarioId == usuarioId && m.Ativo && m.Familia!.Ativa)
            .Select(m => new FamiliaDto(
                m.Familia!.Id,
                m.Familia.Nome,
                m.Familia.CriadoPorUsuarioId,
                m.Familia.CriadoEm,
                m.PapelPermissao == PapelFamilia.Admin,
                m.Familia.Membros.Count(mm => mm.Ativo),
                m.Familia.LimiteAprovacao))
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

        // Where de novo: membro já rastreado no contexto entra na navegação mesmo fora do Include filtrado.
        var membros = familia.Membros.Where(m => m.Ativo)
            .Select(m => ParaDto(m, usuarioId))
            .ToList();

        var convites = familia.Convites
            .Select(c => new ConviteFamiliaDto(
                c.Id, c.FamiliaId, familia.Nome, c.EmailConvidado, c.Papel,
                c.Status, c.ExpiraEm, c.CriadoEm, c.Token, c.PapelPermissao))
            .ToList();

        // ehAdmin = o papel do próprio usuário é Admin (2.3).
        var ehAdmin = familia.Membros
            .First(m => m.UsuarioId == usuarioId && m.Ativo).PapelPermissao == PapelFamilia.Admin;

        // Quem saiu continua no histórico (passo 7): aparece em Membros com a data. Quem voltou não conta.
        var ativosIds = familia.Membros.Where(m => m.Ativo).Select(m => m.UsuarioId).ToList();
        var quemSaiu = (await _context.MembrosFamilia
                .Where(m => m.FamiliaId == familiaId && !m.Ativo && !ativosIds.Contains(m.UsuarioId))
                .Select(m => new { m.UsuarioId, m.Usuario!.Nome, m.SaiuEm })
                .ToListAsync())
            .GroupBy(m => m.UsuarioId)
            .Select(g => g.OrderByDescending(m => m.SaiuEm).First())
            .OrderByDescending(m => m.SaiuEm)
            .Select(m => new ExMembroDto(m.UsuarioId, m.Nome, m.SaiuEm))
            .ToList();

        return new FamiliaDetalheDto(familia.Id, familia.Nome, familia.CriadoPorUsuarioId,
            familia.CriadoEm, ehAdmin,
            familia.ModoRateioPadrao, membros, convites, familia.LimiteAprovacao, quemSaiu);
    }

    /// <summary>Feature 2.4 — define/limpa o limite de aprovação (só admin). Valor negativo é inválido.</summary>
    public async Task DefinirLimiteAprovacaoAsync(Guid familiaId, Guid usuarioId, decimal? limite)
    {
        if (limite is < 0)
            throw new ArgumentException("O limite de aprovação não pode ser negativo.");

        var familia = await BuscarFamiliaAsync(familiaId);
        await FamiliaPermissoes.ExigirAdminAsync(_context, familiaId, usuarioId);

        familia.LimiteAprovacao = limite;
        await _context.SaveChangesAsync();
    }

    public async Task DissolverAsync(Guid familiaId, Guid usuarioId)
    {
        var familia = await BuscarFamiliaAsync(familiaId);
        FamiliaPermissoes.ExigirCriador(familia, usuarioId); // só o dono dissolve

        familia.Ativa = false;
        await _context.SaveChangesAsync();
    }

    public async Task<MembroFamiliaDto> EditarPapelAsync(
        Guid familiaId, Guid membroId, EditarPapelDto dto, Guid usuarioId)
    {
        if (string.IsNullOrWhiteSpace(dto.Papel))
            throw new ArgumentException("Papel é obrigatório.");

        await BuscarFamiliaAsync(familiaId);
        var papelEditor = await FamiliaPermissoes.ExigirMembroAsync(_context, familiaId, usuarioId);

        var membro = await _context.MembrosFamilia
            .Include(m => m.Usuario)
            .FirstOrDefaultAsync(m => m.Id == membroId && m.FamiliaId == familiaId && m.Ativo)
            ?? throw new KeyNotFoundException("Membro não encontrado.");

        // Admin edita o rótulo de qualquer um; membro edita só o próprio.
        if (papelEditor != PapelFamilia.Admin && membro.UsuarioId != usuarioId)
            throw new ForbiddenAccessException("Você só pode editar o próprio papel.");

        membro.Papel = dto.Papel.Trim();
        await _context.SaveChangesAsync();

        return ParaDto(membro, usuarioId);
    }

    public async Task RemoverMembroAsync(Guid familiaId, Guid membroId, Guid usuarioId)
    {
        var familia = await BuscarFamiliaAsync(familiaId);
        var papelRemovedor = await FamiliaPermissoes.ExigirMembroAsync(_context, familiaId, usuarioId);

        var membro = await _context.MembrosFamilia
            .FirstOrDefaultAsync(m => m.Id == membroId && m.FamiliaId == familiaId && m.Ativo)
            ?? throw new KeyNotFoundException("Membro não encontrado.");

        // Admin remove qualquer um; membro só remove a si mesmo (sair).
        if (papelRemovedor != PapelFamilia.Admin && membro.UsuarioId != usuarioId)
            throw new ForbiddenAccessException("Você só pode remover a si mesmo.");

        // O criador não sai sem dissolver — caso contrário a família ficaria sem dono.
        if (FamiliaPermissoes.EhCriador(familia, membro.UsuarioId))
            throw new InvalidOperationException(
                "O dono não pode sair da família. Dissolva a família.");

        // Fica no histórico: as despesas que dividiu continuam com as partes gravadas ("saiu em…").
        membro.Ativo = false;
        membro.SaiuEm = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }

    /// <summary>Feature 2.3 — admin promove/rebaixa a permissão de um membro. O criador
    /// não pode ser alterado (continua sempre Admin).</summary>
    public async Task<MembroFamiliaDto> EditarPermissaoAsync(
        Guid familiaId, Guid membroId, EditarPermissaoDto dto, Guid usuarioId)
    {
        var familia = await BuscarFamiliaAsync(familiaId);
        await FamiliaPermissoes.ExigirAdminAsync(_context, familiaId, usuarioId);

        var membro = await _context.MembrosFamilia
            .Include(m => m.Usuario)
            .FirstOrDefaultAsync(m => m.Id == membroId && m.FamiliaId == familiaId && m.Ativo)
            ?? throw new KeyNotFoundException("Membro não encontrado.");

        if (FamiliaPermissoes.EhCriador(familia, membro.UsuarioId))
            throw new InvalidOperationException("O dono da família é sempre Admin e não pode ser alterado.");

        membro.PapelPermissao = dto.PapelPermissao;
        await _context.SaveChangesAsync();

        return ParaDto(membro, usuarioId);
    }

    /// <summary>Monta o DTO do membro pra quem está vendo (<paramref name="quemVe"/>). Renda não vai aqui (é
    /// derivada e sai filtrada em <see cref="RendaService.ObterRendaFamiliaAsync"/>); a lista de quem vê o valor
    /// é configuração pessoal e só vai pro próprio membro.</summary>
    private static MembroFamiliaDto ParaDto(MembroFamilia m, Guid quemVe) =>
        new(m.Id, m.UsuarioId, m.Usuario!.Nome, m.Usuario.Email, m.Papel, m.EntrouEm,
            m.PapelPermissao, m.VisibilidadeRenda,
            m.UsuarioId == quemVe ? m.RendaVisivelPara.ToList() : null,
            m.Usuario.FotoPerfilEm);

    private async Task<Familia> BuscarFamiliaAsync(Guid familiaId)
    {
        return await _context.Familias.FirstOrDefaultAsync(f => f.Id == familiaId && f.Ativa)
            ?? throw new KeyNotFoundException("Família não encontrada.");
    }

}

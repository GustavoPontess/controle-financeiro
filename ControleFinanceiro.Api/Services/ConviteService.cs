using System.Security.Cryptography;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

public class ConviteService
{
    private const int LimiteConvitesPendentes = 20;
    private static readonly TimeSpan ValidadeConvite = TimeSpan.FromDays(7);

    private readonly AppDbContext _context;

    public ConviteService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<ConviteFamiliaDto> CriarAsync(Guid familiaId, CriarConviteDto dto, Guid usuarioId)
    {
        if (string.IsNullOrWhiteSpace(dto.Email))
            throw new ArgumentException("E-mail do convidado é obrigatório.");
        if (string.IsNullOrWhiteSpace(dto.Papel))
            throw new ArgumentException("Papel é obrigatório.");

        var email = dto.Email.Trim().ToLowerInvariant();

        var familia = await _context.Familias.FirstOrDefaultAsync(f => f.Id == familiaId && f.Ativa)
            ?? throw new KeyNotFoundException("Família não encontrada.");

        if (familia.CriadoPorUsuarioId != usuarioId)
            throw new UnauthorizedAccessException("Apenas o administrador pode convidar.");

        // E-mail já é membro ativo?
        var jaMembro = await _context.MembrosFamilia
            .AnyAsync(m => m.FamiliaId == familiaId && m.Ativo && m.Usuario!.Email.ToLower() == email);
        if (jaMembro)
            throw new InvalidOperationException("Esta pessoa já é membro da família.");

        // Convite pendente duplicado?
        var jaConvidado = await _context.ConvitesFamilia
            .AnyAsync(c => c.FamiliaId == familiaId && c.EmailConvidado == email
                && c.Status == StatusConvite.Pendente);
        if (jaConvidado)
            throw new InvalidOperationException("Já existe um convite pendente para este e-mail.");

        // Limite anti-spam
        var pendentes = await _context.ConvitesFamilia
            .CountAsync(c => c.FamiliaId == familiaId && c.Status == StatusConvite.Pendente);
        if (pendentes >= LimiteConvitesPendentes)
            throw new InvalidOperationException(
                $"Limite de {LimiteConvitesPendentes} convites pendentes atingido.");

        var convite = new ConviteFamilia
        {
            Id = Guid.NewGuid(),
            FamiliaId = familiaId,
            EmailConvidado = email,
            Papel = dto.Papel.Trim(),
            Token = GerarToken(),
            Status = StatusConvite.Pendente,
            ExpiraEm = DateTime.UtcNow.Add(ValidadeConvite),
            CriadoEm = DateTime.UtcNow,
            CriadoPorUsuarioId = usuarioId,
        };

        _context.ConvitesFamilia.Add(convite);
        await _context.SaveChangesAsync();

        return ToDto(convite, familia.Nome);
    }

    public async Task RevogarAsync(Guid familiaId, Guid conviteId, Guid usuarioId)
    {
        var familia = await _context.Familias.FirstOrDefaultAsync(f => f.Id == familiaId && f.Ativa)
            ?? throw new KeyNotFoundException("Família não encontrada.");

        if (familia.CriadoPorUsuarioId != usuarioId)
            throw new UnauthorizedAccessException("Apenas o administrador pode revogar convites.");

        var convite = await _context.ConvitesFamilia
            .FirstOrDefaultAsync(c => c.Id == conviteId && c.FamiliaId == familiaId)
            ?? throw new KeyNotFoundException("Convite não encontrado.");

        if (convite.Status != StatusConvite.Pendente)
            throw new InvalidOperationException("Só é possível revogar convites pendentes.");

        convite.Status = StatusConvite.Revogado;
        await _context.SaveChangesAsync();
    }

    public async Task<List<ConviteFamiliaDto>> ListarPendentesAsync(Guid usuarioId)
    {
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");
        var email = usuario.Email.Trim().ToLowerInvariant();
        var agora = DateTime.UtcNow;

        return await _context.ConvitesFamilia
            .Where(c => c.EmailConvidado == email
                && c.Status == StatusConvite.Pendente
                && c.ExpiraEm > agora)
            .Select(c => new ConviteFamiliaDto(
                c.Id, c.FamiliaId, c.Familia!.Nome, c.EmailConvidado, c.Papel,
                c.Status, c.ExpiraEm, c.CriadoEm, c.Token))
            .AsNoTracking()
            .ToListAsync();
    }

    public async Task AceitarAsync(string token, Guid usuarioId)
    {
        var convite = await BuscarConvitePorTokenAsync(token);
        var usuario = await ExigirEmailDoConvidadoAsync(convite, usuarioId);

        if (convite.ExpiraEm <= DateTime.UtcNow)
        {
            convite.Status = StatusConvite.Expirado;
            await _context.SaveChangesAsync();
            throw new InvalidOperationException("Convite expirado.");
        }

        // Reentrada: usuário pode ter saído antes — reativa o membro existente.
        var membro = await _context.MembrosFamilia
            .FirstOrDefaultAsync(m => m.FamiliaId == convite.FamiliaId && m.UsuarioId == usuarioId);

        if (membro != null)
        {
            if (membro.Ativo)
                throw new InvalidOperationException("Você já é membro desta família.");
            membro.Ativo = true;
            membro.Papel = convite.Papel;
            membro.EntrouEm = DateTime.UtcNow;
        }
        else
        {
            _context.MembrosFamilia.Add(new MembroFamilia
            {
                Id = Guid.NewGuid(),
                FamiliaId = convite.FamiliaId,
                UsuarioId = usuarioId,
                Papel = convite.Papel,
                EntrouEm = DateTime.UtcNow,
                Ativo = true,
            });
        }

        convite.Status = StatusConvite.Aceito;
        await _context.SaveChangesAsync();

        _ = usuario; // e-mail já validado em ExigirEmailDoConvidadoAsync
    }

    public async Task RecusarAsync(string token, Guid usuarioId)
    {
        var convite = await BuscarConvitePorTokenAsync(token);
        await ExigirEmailDoConvidadoAsync(convite, usuarioId);

        if (convite.Status != StatusConvite.Pendente)
            throw new InvalidOperationException("Este convite não está mais pendente.");

        convite.Status = StatusConvite.Recusado;
        await _context.SaveChangesAsync();
    }

    private async Task<ConviteFamilia> BuscarConvitePorTokenAsync(string token)
    {
        var convite = await _context.ConvitesFamilia
            .FirstOrDefaultAsync(c => c.Token == token)
            ?? throw new KeyNotFoundException("Convite não encontrado.");

        if (convite.Status != StatusConvite.Pendente)
            throw new InvalidOperationException("Este convite não está mais pendente.");

        return convite;
    }

    private async Task<Usuario> ExigirEmailDoConvidadoAsync(ConviteFamilia convite, Guid usuarioId)
    {
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");

        if (!string.Equals(usuario.Email.Trim(), convite.EmailConvidado,
                StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Este convite não é para o seu e-mail.");

        return usuario;
    }

    private static ConviteFamiliaDto ToDto(ConviteFamilia c, string nomeFamilia) =>
        new(c.Id, c.FamiliaId, nomeFamilia, c.EmailConvidado, c.Papel,
            c.Status, c.ExpiraEm, c.CriadoEm, c.Token);

    private static string GerarToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes)
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }
}

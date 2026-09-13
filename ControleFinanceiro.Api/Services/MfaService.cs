using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.DTOs.Auth;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// MFA opt-in (TOTP, RFC 6238) — NUNCA obrigatório, decisão do Gustavo (2026-08-23). Não é
/// exigência legal da LGPD (Art. 46 só pede "medidas de segurança aptas", sem nomear MFA),
/// é boa prática OWASP oferecida como opção. O fluxo de LOGIN com MFA (challenge + verificação
/// final que emite JWT) fica em <see cref="AuthService"/> — precisa dos helpers privados de
/// geração de token que já vivem lá. Esse service cuida só de ativar/desativar/status.
/// </summary>
public class MfaService
{
    private readonly AppDbContext _context;

    public MfaService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<MfaIniciarAtivacaoResponseDto> IniciarAtivacaoAsync(Guid usuarioId)
    {
        var usuario = await _context.Usuarios.FindAsync(usuarioId)
            ?? throw new KeyNotFoundException("Usuário não encontrado");

        if (usuario.MfaAtivo)
            throw new InvalidOperationException("MFA já está ativo. Desative antes de reconfigurar.");

        var secret = MfaTotpHelper.GerarSecret();
        var base32 = MfaTotpHelper.ParaBase32(secret);

        usuario.MfaSecretoPendenteCriptografado = MfaCrypto.Encrypt(base32);
        await _context.SaveChangesAsync();

        return new MfaIniciarAtivacaoResponseDto
        {
            SecretBase32 = base32,
            QrCodeUri = MfaTotpHelper.ProvisioningUri(usuario.Email, base32),
        };
    }

    public async Task<List<string>> ConfirmarAtivacaoAsync(Guid usuarioId, string codigo)
    {
        var usuario = await _context.Usuarios.FindAsync(usuarioId)
            ?? throw new KeyNotFoundException("Usuário não encontrado");

        if (string.IsNullOrEmpty(usuario.MfaSecretoPendenteCriptografado))
            throw new ArgumentException("Nenhuma ativação de MFA pendente — comece de novo.");

        var base32 = MfaCrypto.Decrypt(usuario.MfaSecretoPendenteCriptografado);
        var secret = MfaTotpHelper.DeBase32(base32);

        if (!MfaTotpHelper.VerificarCodigo(secret, codigo))
            throw new UnauthorizedAccessException("Código inválido.");

        usuario.MfaSecretoCriptografado = usuario.MfaSecretoPendenteCriptografado;
        usuario.MfaSecretoPendenteCriptografado = null;
        usuario.MfaAtivo = true;
        usuario.MfaAtivadoEm = DateTime.UtcNow;

        var codigosBrutos = MfaBackupCodeHelper.GerarLote();
        foreach (var bruto in codigosBrutos)
        {
            _context.MfaBackupCodes.Add(new MfaBackupCode
            {
                Id = Guid.NewGuid(),
                UsuarioId = usuarioId,
                CodigoHash = MfaBackupCodeHelper.Hash(bruto),
            });
        }

        await _context.SaveChangesAsync();
        return codigosBrutos;
    }

    public async Task DesativarAsync(Guid usuarioId, string senhaAtual, string codigo)
    {
        var usuario = await _context.Usuarios.FindAsync(usuarioId)
            ?? throw new KeyNotFoundException("Usuário não encontrado");

        if (!usuario.MfaAtivo)
            throw new InvalidOperationException("MFA não está ativo.");

        if (!PasswordHasher.VerifyPassword(senhaAtual, usuario.PasswordHash))
            throw new UnauthorizedAccessException("Senha atual inválida.");

        if (!await CodigoValidoParaUsuarioAsync(usuario, codigo))
            throw new UnauthorizedAccessException("Código inválido.");

        usuario.MfaAtivo = false;
        usuario.MfaSecretoCriptografado = null;
        usuario.MfaSecretoPendenteCriptografado = null;
        usuario.MfaAtivadoEm = null;

        var backupCodes = await _context.MfaBackupCodes.Where(c => c.UsuarioId == usuarioId).ToListAsync();
        _context.MfaBackupCodes.RemoveRange(backupCodes);

        await _context.SaveChangesAsync();
    }

    public async Task<MfaStatusDto> ObterStatusAsync(Guid usuarioId)
    {
        var usuario = await _context.Usuarios.FindAsync(usuarioId)
            ?? throw new KeyNotFoundException("Usuário não encontrado");

        var restantes = usuario.MfaAtivo
            ? await _context.MfaBackupCodes.CountAsync(c => c.UsuarioId == usuarioId && !c.Usado)
            : 0;

        return new MfaStatusDto
        {
            Ativo = usuario.MfaAtivo,
            AtivadoEm = usuario.MfaAtivadoEm,
            BackupCodesRestantes = restantes,
        };
    }

    /// <summary>Valida o código contra o TOTP ativo OU um backup code não usado (e marca o
    /// backup code como usado, se foi esse o caminho). Compartilhado entre desativar e o
    /// verify de login (chamado de <see cref="AuthService"/>).</summary>
    internal async Task<bool> CodigoValidoParaUsuarioAsync(Usuario usuario, string codigo)
    {
        if (!string.IsNullOrEmpty(usuario.MfaSecretoCriptografado))
        {
            var secret = MfaTotpHelper.DeBase32(MfaCrypto.Decrypt(usuario.MfaSecretoCriptografado));
            if (MfaTotpHelper.VerificarCodigo(secret, codigo))
                return true;
        }

        var hash = MfaBackupCodeHelper.Hash(codigo);
        var backupCode = await _context.MfaBackupCodes
            .FirstOrDefaultAsync(c => c.UsuarioId == usuario.Id && c.CodigoHash == hash && !c.Usado);

        if (backupCode is null) return false;

        backupCode.Usado = true;
        backupCode.UsadoEm = DateTime.UtcNow;
        // Não salva aqui — quem chama decide o SaveChanges (evita I/O duplicado quando o
        // caller já vai salvar outras mudanças na mesma transação lógica).
        return true;
    }
}

using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Auth;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Autoatendimento do TITULAR sobre a própria conta (LGPD Art. 18). Hoje: exclusão em 2 estágios
/// (soft-delete + carência de 30d, mesmo fluxo do admin, mas disparado pelo próprio usuário).
///
/// Segurança (pesquisa OWASP/NIST, ver `docs/SEGURANCA_BEST_PRACTICES.md`): exclusão é ação
/// destrutiva → step-up (reautenticação fresca), NÃO confiar só na sessão. Exige <b>senha atual +
/// 2º fator</b>: TOTP se o MFA está ativo; senão, PIN por e-mail (fallback fraco). Senha errada
/// responde 400 (não 401 — 401 faria o front deslogar). A purga física real acontece depois, pelo
/// job de carência (`AdminLgpdService.PurgarExpiradasAsync`), que pula contas com vínculo.
/// </summary>
public class MinhaContaService
{
    public const int JanelaCarenciaDias = AdminLgpdService.JanelaCarenciaDias;

    private readonly AppDbContext _context;
    private readonly EmailOtpService _emailOtp;
    private readonly MfaService _mfa;
    private readonly AdminAuditService _audit;
    private readonly IContaEmailSender _contaEmail;
    private readonly AdminLgpdService _lgpd;

    public MinhaContaService(AppDbContext context, EmailOtpService emailOtp, MfaService mfa,
        AdminAuditService audit, IContaEmailSender contaEmail, AdminLgpdService lgpd)
    {
        _context = context;
        _emailOtp = emailOtp;
        _mfa = mfa;
        _audit = audit;
        _contaEmail = contaEmail;
        _lgpd = lgpd;
    }

    /// <summary>Exporta os dados do próprio titular (LGPD acesso/portabilidade). Reusa o montador do
    /// admin (só os dados dele) e audita como ação do titular.</summary>
    public async Task<DTOs.Admin.ExportacaoUsuarioDto> ExportarMeusDadosAsync(Guid usuarioId)
    {
        var dto = await _lgpd.MontarExportacaoAsync(usuarioId);
        _audit.Registrar(usuarioId, dto.Perfil.Email, AcaoAdmin.AutoExportacaoDados, "Usuario", usuarioId, dto.Perfil.Email,
            "Exportação de dados solicitada pelo próprio titular.");
        await _context.SaveChangesAsync();
        return dto;
    }

    /// <summary>Reativa a própria conta dentro da carência (usuário não está logado — vem por
    /// credenciais). Só reativa se estiver <see cref="StatusUsuario.MarcadoParaExclusao"/> e a senha
    /// bater. Mensagem genérica (anti-enumeração). Depois o usuário loga normalmente (MFA se ativo).</summary>
    public async Task ReativarPorCredenciaisAsync(string email, string senha)
    {
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Email == (email ?? string.Empty).ToLower());
        if (usuario is null
            || usuario.Status != StatusUsuario.MarcadoParaExclusao
            || string.IsNullOrEmpty(senha)
            || !PasswordHasher.VerifyPassword(senha, usuario.PasswordHash))
            throw new ArgumentException("Não foi possível reativar a conta. Verifique os dados.");

        usuario.Status = StatusUsuario.Ativo;
        usuario.MarcadoExclusaoEm = null;
        usuario.AtualizadoEm = DateTime.UtcNow;
        _audit.Registrar(usuario.Id, usuario.Email, AcaoAdmin.AutoReativacaoConta, "Usuario", usuario.Id, usuario.Email,
            "Reativação solicitada pelo próprio titular na carência.");
        await _context.SaveChangesAsync();
    }

    /// <summary>Passo 1: confirma a senha atual e decide o 2º fator. Sem MFA → dispara o PIN por
    /// e-mail e pede "email". Com MFA → pede "totp" (o código vem do app, nada é enviado).</summary>
    public async Task<Metodo2FaResponse> IniciarExclusaoAsync(Guid usuarioId, string senhaAtual)
    {
        var usuario = await BuscarAtivoOuFalharAsync(usuarioId);
        VerificarSenhaOuFalhar(usuario, senhaAtual);

        if (usuario.MfaAtivo)
            return new Metodo2FaResponse("totp");

        await _emailOtp.GerarEnviarAsync(usuario, TipoOtpEmail.ExcluirConta);
        return new Metodo2FaResponse("email");
    }

    /// <summary>Passo 2: valida senha + 2º fator e faz o soft-delete (marca pra exclusão + carência),
    /// derruba as sessões (refresh tokens), audita como ação do próprio titular e avisa por e-mail.</summary>
    public async Task ExcluirMinhaContaAsync(Guid usuarioId, string senhaAtual, string codigo)
    {
        var usuario = await BuscarAtivoOuFalharAsync(usuarioId);
        VerificarSenhaOuFalhar(usuario, senhaAtual);

        var segundoFatorOk = usuario.MfaAtivo
            ? await _mfa.CodigoValidoParaUsuarioAsync(usuario, codigo)
            : await _emailOtp.ValidarAsync(usuarioId, TipoOtpEmail.ExcluirConta, codigo);

        if (!segundoFatorOk)
            throw new ArgumentException(usuario.MfaAtivo
                ? "Código de verificação inválido."
                : "Código do e-mail inválido ou expirado.");

        var agora = DateTime.UtcNow;
        usuario.Status = StatusUsuario.MarcadoParaExclusao;
        usuario.MarcadoExclusaoEm = agora;
        usuario.AtualizadoEm = agora;

        // Derruba todas as sessões (o acesso se encerra imediatamente).
        var tokens = await _context.RefreshTokens.Where(t => t.UsuarioId == usuarioId).ToListAsync();
        _context.RefreshTokens.RemoveRange(tokens);

        _audit.Registrar(usuarioId, usuario.Email, AcaoAdmin.AutoExclusaoConta, "Usuario", usuarioId, usuario.Email,
            "Exclusão solicitada pelo próprio titular (self-service).");

        await _context.SaveChangesAsync();

        // Aviso out-of-band (permite reagir a um pedido indevido). Best-effort — não derruba a operação.
        await _contaEmail.EnviarAvisoExclusaoAsync(usuario.Email, agora, JanelaCarenciaDias);
    }

    private async Task<Usuario> BuscarAtivoOuFalharAsync(Guid usuarioId)
    {
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");
        if (usuario.Status != StatusUsuario.Ativo)
            throw new InvalidOperationException("Esta conta não está ativa.");
        return usuario;
    }

    // 400 (ArgumentException), NÃO 401: o usuário está logado; senha errada aqui é erro de campo,
    // não sessão expirada — 401 faria o interceptor do front deslogar.
    private static void VerificarSenhaOuFalhar(Usuario usuario, string senhaAtual)
    {
        if (string.IsNullOrEmpty(senhaAtual) || !PasswordHasher.VerifyPassword(senhaAtual, usuario.PasswordHash))
            throw new ArgumentException("Senha atual inválida.");
    }
}

using System.Security.Cryptography;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Auth;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

public class AuthService
{
    private readonly AppDbContext _context;
    private readonly JwtTokenProvider _tokenProvider;
    private readonly IPasswordResetDispatcher _resetDispatcher;
    private readonly MfaService _mfaService;
    private readonly NotificacaoAdminService _notificacaoAdmin;

    private const int RefreshTokenDays = 7;
    private const int MfaChallengeMinutos = 5; // TTL do desafio entre senha certa e código MFA

    // Proteção contra força bruta por CONTA (OWASP Authentication Cheat Sheet) —
    // complementa o rate-limit por IP (Program.cs), que sozinho é contornável trocando de IP.
    private const int FalhasAntesDoDelay = 3;         // primeiras tentativas erradas não atrasam
    private const int SegundosDelayBase = 1;           // "starts as a very short period (e.g., one second)"
    private const int SegundosDelayMaximo = 300;        // teto de 5min — depois disso só o bloqueio permanente conta
    private const int FalhasParaBloqueioPermanente = 10; // "after that permanent account lockout" — exige reset de senha

    public AuthService(
        AppDbContext context,
        JwtTokenProvider tokenProvider,
        IPasswordResetDispatcher resetDispatcher,
        MfaService mfaService,
        NotificacaoAdminService notificacaoAdmin)
    {
        _context = context;
        _tokenProvider = tokenProvider;
        _resetDispatcher = resetDispatcher;
        _mfaService = mfaService;
        _notificacaoAdmin = notificacaoAdmin;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static string GerarTokenOpaco()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToHexString(bytes).ToLower();
    }

    // Mensagem amigável pra cada estado que barra o login. Usada em login/refresh — o usuário
    // precisa entender por que não entrou (pendente ≠ recusado ≠ bloqueado ≠ em exclusão).
    private static string MensagemStatusBloqueado(StatusUsuario status) => status switch
    {
        StatusUsuario.AguardandoAprovacao => "Sua conta está aguardando aprovação. Você receberá acesso assim que for liberada.",
        StatusUsuario.Recusado            => "Seu cadastro não foi aprovado para o beta.",
        StatusUsuario.Bloqueado           => "Sua conta está bloqueada. Fale com o suporte.",
        StatusUsuario.MarcadoParaExclusao => "Esta conta está marcada para exclusão.",
        _                                 => "Não é possível acessar esta conta.",
    };

    // Retorna (entidade, token BRUTO). O bruto vai pro cliente (cookie); no banco
    // guarda-se só o hash (igual ao reset token) — vazamento de DB não dá refresh tokens
    // reutilizáveis.
    private Task<(RefreshToken Entity, string TokenBruto)> CriarRefreshTokenAsync(Guid usuarioId)
    {
        var tokenBruto = GerarTokenOpaco();
        var rt = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UsuarioId = usuarioId,
            Token = OpaqueTokenHasher.Hash(tokenBruto),
            ExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenDays),
            Revogado = false,
            CriadoEm = DateTime.UtcNow,
        };
        _context.RefreshTokens.Add(rt);
        // Sem I/O aqui (o SaveChanges é do caller) — não precisa de async/await.
        return Task.FromResult((rt, tokenBruto));
    }

    public async Task<RegisterResponseDto> RegisterAsync(RegisterDto dto)
    {
        // Validate input
        if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
            throw new ArgumentException("Email e senha são obrigatórios");

        if (dto.Password != dto.ConfirmPassword)
            throw new ArgumentException("Senhas não conferem");

        PasswordPolicyService.ValidarOuLancar(dto.Password);

        // Check if email already exists (case-insensitive — email é sempre gravado em
        // lowercase abaixo; comparar sem normalizar deixava passar duplicata com case
        // diferente, que quebrava depois na constraint única do banco com um 500 feio).
        if (_context.Usuarios.Any(u => u.Email == dto.Email.ToLower()))
            throw new InvalidOperationException("Email já cadastrado");

        // GATE DO BETA: a conta nasce AguardandoAprovacao (default da entidade) e NÃO recebe sessão
        // aqui — nada de JWT nem refresh token. O usuário só loga depois que o admin aprova
        // (spec `docs/features/admin/spec.md` §3). `Status` é setado explicitamente pra deixar a
        // intenção clara no código, mesmo coincidindo com o default. NUNCA vem do DTO (blindagem
        // contra escalação — cliente não escolhe o próprio status).
        var usuario = new Usuario
        {
            Id = Guid.NewGuid(),
            Email = dto.Email.ToLower(),
            Nome = dto.Nome,
            DataNascimento = dto.DataNascimento,
            PasswordHash = PasswordHasher.HashPassword(dto.Password),
            Status = StatusUsuario.AguardandoAprovacao,
            CriadoEm = DateTime.UtcNow,
            AtualizadoEm = DateTime.UtcNow
        };

        _context.Usuarios.Add(usuario);

        _context.Contas.Add(new Conta
        {
            Id = Guid.NewGuid(),
            Nome = "Carteira",
            Tipo = TipoConta.ContaPoupanca,
            IsCarteira = true,
            UsuarioIdProprietario = usuario.Id
        });

        await _context.SaveChangesAsync();

        // Notifica o painel admin que há um novo cadastro na fila (stream de admin, best-effort).
        // Sem e-mail na mensagem (menor exposição de PII): só o nome; o e-mail (mascarado) fica a um
        // clique na fila. Ver docs/SEGURANCA_BEST_PRACTICES.md §0.
        await _notificacaoAdmin.CriarAsync(
            TipoNotificacaoAdmin.NovoCadastro,
            "Novo cadastro na fila",
            $"{usuario.Nome} está aguardando aprovação.",
            "/admin/pendentes");

        return new RegisterResponseDto
        {
            Status = usuario.Status,
            Mensagem = "Cadastro enviado! Sua conta está aguardando aprovação. "
                     + "Você receberá acesso assim que for liberada.",
        };
    }

    public async Task<LoginResultDto> LoginAsync(LoginDto dto)
    {
        // Validate input
        if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
            throw new ArgumentException("Email e senha são obrigatórios");

        // Find user
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Email == dto.Email.ToLower());
        if (usuario == null)
            throw new UnauthorizedAccessException("Email ou senha inválidos");

        // Bloqueio permanente (excedeu o teto de tentativas erradas) — só reset de senha libera.
        if (usuario.FalhasLoginConsecutivas >= FalhasParaBloqueioPermanente)
            throw new UnauthorizedAccessException("Muitas tentativas de login. Redefina sua senha pra continuar.");

        // Delay progressivo por conta — dobra a cada erro a partir da 3ª tentativa (OWASP:
        // "starts as a very short period... but doubles after each failed login attempt").
        if (usuario.FalhasLoginConsecutivas >= FalhasAntesDoDelay && usuario.UltimaFalhaLoginEm.HasValue)
        {
            var expoente = usuario.FalhasLoginConsecutivas - FalhasAntesDoDelay;
            var delaySegundos = Math.Min(SegundosDelayBase * Math.Pow(2, expoente), SegundosDelayMaximo);
            var liberaEm = usuario.UltimaFalhaLoginEm.Value.AddSeconds(delaySegundos);
            if (DateTime.UtcNow < liberaEm)
                throw new UnauthorizedAccessException("Muitas tentativas. Aguarde alguns instantes e tente novamente.");
        }

        // Verify password
        if (!PasswordHasher.VerifyPassword(dto.Password, usuario.PasswordHash))
        {
            usuario.FalhasLoginConsecutivas++;
            usuario.UltimaFalhaLoginEm = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Alerta de segurança no painel admin quando a conta ACABOU de bater o teto e virou
            // bloqueio permanente (== pra disparar só na transição, não a cada falha depois).
            if (usuario.FalhasLoginConsecutivas == FalhasParaBloqueioPermanente)
                await _notificacaoAdmin.CriarAsync(
                    TipoNotificacaoAdmin.Seguranca,
                    "Conta bloqueada por força bruta",
                    $"A conta de {usuario.Nome} atingiu {FalhasParaBloqueioPermanente} tentativas de login e foi bloqueada. Só reset de senha libera.",
                    "/admin/usuarios");

            throw new UnauthorizedAccessException("Email ou senha inválidos");
        }

        // GATE DE STATUS — só conta Ativa loga. Checado DEPOIS da senha (não vaza a situação da
        // conta pra quem não provou a senha). Mensagem específica por estado pro usuário entender.
        if (usuario.Status != StatusUsuario.Ativo)
            throw new UnauthorizedAccessException(MensagemStatusBloqueado(usuario.Status));

        // Login certo — zera o contador de força bruta e marca o último acesso (métrica do admin).
        usuario.FalhasLoginConsecutivas = 0;
        usuario.UltimaFalhaLoginEm = null;
        // MFA ativo: o acesso só se completa no 2º fator; UltimoAcessoEm é gravado lá.
        if (!usuario.MfaAtivo)
            usuario.UltimoAcessoEm = DateTime.UtcNow;

        // Rehash transparente: senha legada (PBKDF2 10k/20B) ou Argon2id com parâmetros
        // antigos é regravada com o esquema atual após verificação bem-sucedida — upgrade
        // gradual sem forçar reset (OWASP). Independe de ter MFA ou não (é sobre o hash da
        // senha, já provada correta agora). Persistido no SaveChanges abaixo.
        if (PasswordHasher.NeedsRehash(usuario.PasswordHash))
            usuario.PasswordHash = PasswordHasher.HashPassword(dto.Password);

        // MFA ativo — NÃO emite JWT ainda. Cria um desafio de curta duração; só depois de
        // VerificarMfaLoginAsync confirmar o código é que a sessão de verdade nasce.
        if (usuario.MfaAtivo)
        {
            var challengeBruto = GerarTokenOpaco();
            _context.MfaLoginChallenges.Add(new MfaLoginChallenge
            {
                Id = Guid.NewGuid(),
                UsuarioId = usuario.Id,
                TokenHash = OpaqueTokenHasher.Hash(challengeBruto),
                ExpiresAt = DateTime.UtcNow.AddMinutes(MfaChallengeMinutos),
            });
            await _context.SaveChangesAsync();

            return new LoginResultDto { MfaRequerido = true, MfaChallengeToken = challengeBruto };
        }

        var (rt, refreshBruto) = await CriarRefreshTokenAsync(usuario.Id);
        await _context.SaveChangesAsync();

        var token = _tokenProvider.GenerateToken(usuario.Id, usuario.Email, usuario.Nome);

        return new LoginResultDto
        {
            MfaRequerido = false,
            Auth = new AuthResponseDto
            {
                UsuarioId = usuario.Id,
                Email = usuario.Email,
                Nome = usuario.Nome,
                Token = token,
                RefreshToken = refreshBruto,
                RefreshTokenExpiresAt = rt.ExpiresAt,
            },
        };
    }

    /// <summary>
    /// Passo 2 do login com MFA — recebe o challenge do passo 1 (senha certa) + o código
    /// TOTP/backup, e só aí emite a sessão de verdade (JWT + refresh). Challenge é de uso
    /// único em caso de SUCESSO (deletado); código errado não consome o challenge, permite
    /// tentar de novo dentro do TTL (rate-limit por IP no endpoint cobre brute-force do código).
    /// </summary>
    public async Task<AuthResponseDto> VerificarMfaLoginAsync(string challengeTokenBruto, string codigo)
    {
        if (string.IsNullOrWhiteSpace(challengeTokenBruto) || string.IsNullOrWhiteSpace(codigo))
            throw new ArgumentException("Challenge e código são obrigatórios.");

        var hash = OpaqueTokenHasher.Hash(challengeTokenBruto);
        var challenge = await _context.MfaLoginChallenges
            .Include(c => c.Usuario)
            .FirstOrDefaultAsync(c => c.TokenHash == hash);

        if (challenge == null || challenge.ExpiresAt <= DateTime.UtcNow)
            throw new UnauthorizedAccessException("Sessão de login expirada. Faça login de novo.");

        if (!await _mfaService.CodigoValidoParaUsuarioAsync(challenge.Usuario, codigo))
            throw new UnauthorizedAccessException("Código inválido.");

        // Challenge é de uso único — remove assim que confirma, antes de emitir a sessão.
        _context.MfaLoginChallenges.Remove(challenge);

        // 2º fator confirmado = login completo → marca o último acesso (métrica do admin).
        challenge.Usuario.UltimoAcessoEm = DateTime.UtcNow;

        var (rt, refreshBruto) = await CriarRefreshTokenAsync(challenge.Usuario.Id);
        await _context.SaveChangesAsync();

        var token = _tokenProvider.GenerateToken(challenge.Usuario.Id, challenge.Usuario.Email, challenge.Usuario.Nome);

        return new AuthResponseDto
        {
            UsuarioId = challenge.Usuario.Id,
            Email = challenge.Usuario.Email,
            Nome = challenge.Usuario.Nome,
            Token = token,
            RefreshToken = refreshBruto,
            RefreshTokenExpiresAt = rt.ExpiresAt,
        };
    }

    // ── Refresh Token ────────────────────────────────────────────────────────

    /// <summary>
    /// Valida o refresh token, rotaciona (revoga o antigo, cria novo) e retorna novo par de tokens.
    /// </summary>
    public async Task<AuthResponseDto> RefreshAsync(string refreshToken)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
            throw new ArgumentException("Refresh token é obrigatório.");

        var tokenHash = OpaqueTokenHasher.Hash(refreshToken);
        var rt = await _context.RefreshTokens
            .Include(r => r.Usuario)
            .FirstOrDefaultAsync(r => r.Token == tokenHash);

        if (rt == null || rt.Revogado || rt.ExpiresAt <= DateTime.UtcNow)
            throw new UnauthorizedAccessException("Refresh token inválido ou expirado.");

        // Se a conta deixou de ser Ativa (bloqueada/marcada pra exclusão) entre um refresh e outro,
        // a sessão morre aqui — não renova. Fail-closed.
        if (rt.Usuario.Status != StatusUsuario.Ativo)
            throw new UnauthorizedAccessException(MensagemStatusBloqueado(rt.Usuario.Status));

        // Revogar o token atual (rotação)
        rt.Revogado = true;

        // Criar novo refresh token
        var (novoRt, refreshBruto) = await CriarRefreshTokenAsync(rt.UsuarioId);
        await _context.SaveChangesAsync();

        var jwtToken = _tokenProvider.GenerateToken(rt.Usuario.Id, rt.Usuario.Email, rt.Usuario.Nome);

        return new AuthResponseDto
        {
            UsuarioId = rt.Usuario.Id,
            Email = rt.Usuario.Email,
            Nome = rt.Usuario.Nome,
            Token = jwtToken,
            RefreshToken = refreshBruto,
            RefreshTokenExpiresAt = novoRt.ExpiresAt,
        };
    }

    /// <summary>
    /// Revoga o refresh token (logout). Silencioso se token não encontrado.
    /// </summary>
    public async Task LogoutAsync(string refreshToken)
    {
        if (string.IsNullOrWhiteSpace(refreshToken)) return;

        var tokenHash = OpaqueTokenHasher.Hash(refreshToken);
        var rt = await _context.RefreshTokens
            .FirstOrDefaultAsync(r => r.Token == tokenHash && !r.Revogado);

        if (rt != null)
        {
            rt.Revogado = true;
            await _context.SaveChangesAsync();
        }
    }

    // ── Forgot / Reset Password ───────────────────────────────────────────────

    /// <summary>
    /// Solicita o reset de senha. A geração do token e o envio do e-mail são disparados
    /// fire-and-forget (Hangfire), então a resposta é imediata e idêntica para qualquer
    /// e-mail — sem oráculo de timing/enumeração e sem vazar o token na resposta HTTP.
    /// O token só chega ao dono legítimo pelo e-mail.
    /// </summary>
    public Task<ForgotPasswordResponseDto> SolicitarResetSenhaAsync(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("E-mail é obrigatório.");

        _resetDispatcher.Disparar(email);

        return Task.FromResult(new ForgotPasswordResponseDto
        {
            Mensagem = "Se o e-mail existir, um link de recuperação será enviado.",
        });
    }

    /// <summary>
    /// Valida o token de reset e altera a senha do usuário.
    /// </summary>
    public async Task ResetSenhaAsync(ResetPasswordDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Token))
            throw new ArgumentException("Token é obrigatório.");

        if (string.IsNullOrWhiteSpace(dto.NovaSenha))
            throw new ArgumentException("Nova senha é obrigatória.");

        PasswordPolicyService.ValidarOuLancar(dto.NovaSenha);

        if (dto.NovaSenha != dto.ConfirmarNovaSenha)
            throw new ArgumentException("Senhas não conferem.");

        // O banco guarda só o hash do token; o usuário envia o token bruto.
        var tokenHash = OpaqueTokenHasher.Hash(dto.Token);
        var prt = await _context.PasswordResetTokens
            .Include(t => t.Usuario)
            .FirstOrDefaultAsync(t => t.Token == tokenHash);

        if (prt == null || prt.Usado || prt.ExpiresAt <= DateTime.UtcNow)
            throw new ArgumentException("Token inválido ou expirado.");

        // Só conta Ativa reseta senha — não faz sentido recuperar acesso de conta pendente/recusada/
        // bloqueada/em exclusão (o gate de login barraria depois de qualquer forma).
        if (prt.Usuario.Status != StatusUsuario.Ativo)
            throw new ArgumentException(MensagemStatusBloqueado(prt.Usuario.Status));

        // Alterar senha
        prt.Usuario.PasswordHash = PasswordHasher.HashPassword(dto.NovaSenha);
        prt.Usuario.AtualizadoEm = DateTime.UtcNow;

        // Reset de senha também libera o bloqueio por força bruta (outra via de recuperação).
        prt.Usuario.FalhasLoginConsecutivas = 0;
        prt.Usuario.UltimaFalhaLoginEm = null;

        // Invalidar token
        prt.Usado = true;

        // Revogar todos os refresh tokens do usuário (segurança pós-reset)
        var refreshTokens = await _context.RefreshTokens
            .Where(r => r.UsuarioId == prt.UsuarioId && !r.Revogado)
            .ToListAsync();
        foreach (var r in refreshTokens)
            r.Revogado = true;

        await _context.SaveChangesAsync();
    }

    public async Task<UsuarioDto?> GetUsuarioAsync(Guid usuarioId)
    {
        var usuario = await _context.Usuarios.FindAsync(usuarioId);
        if (usuario == null)
            return null;

        return new UsuarioDto
        {
            Id = usuario.Id,
            Email = usuario.Email,
            Nome = usuario.Nome,
            DataNascimento = usuario.DataNascimento,
            Status = usuario.Status,
            CriadoEm = usuario.CriadoEm,
            IsAdmin = usuario.IsAdmin
        };
    }

    public async Task<UsuarioDto> UpdateProfileAsync(Guid usuarioId, string nome, DateTime? dataNascimento)
    {
        var usuario = await _context.Usuarios.FindAsync(usuarioId);
        if (usuario == null)
            throw new KeyNotFoundException("Usuário não encontrado");

        usuario.Nome = nome;
        usuario.DataNascimento = dataNascimento;
        usuario.AtualizadoEm = DateTime.UtcNow;

        _context.Usuarios.Update(usuario);
        await _context.SaveChangesAsync();

        return new UsuarioDto
        {
            Id = usuario.Id,
            Email = usuario.Email,
            Nome = usuario.Nome,
            DataNascimento = usuario.DataNascimento,
            Status = usuario.Status,
            CriadoEm = usuario.CriadoEm,
            IsAdmin = usuario.IsAdmin
        };
    }

    public async Task ChangePasswordAsync(Guid usuarioId, string senhaAtual, string novaSenha)
    {
        var usuario = await _context.Usuarios.FindAsync(usuarioId);
        if (usuario == null)
            throw new KeyNotFoundException("Usuário não encontrado");

        if (!PasswordHasher.VerifyPassword(senhaAtual, usuario.PasswordHash))
            throw new UnauthorizedAccessException("Senha atual inválida");

        PasswordPolicyService.ValidarOuLancar(novaSenha);

        usuario.PasswordHash = PasswordHasher.HashPassword(novaSenha);
        usuario.AtualizadoEm = DateTime.UtcNow;

        _context.Usuarios.Update(usuario);
        await _context.SaveChangesAsync();
    }
}

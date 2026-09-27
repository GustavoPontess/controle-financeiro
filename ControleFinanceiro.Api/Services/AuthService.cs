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
    private readonly IHttpContextAccessor? _httpContextAccessor;

    private const int RefreshTokenDays = 7;
    private const int MfaChallengeMinutos = 5; // TTL do desafio entre senha certa e código MFA
    private const int TrustedDeviceDias = 30;  // "lembrar este dispositivo" — janela do skip do 2º fator (OWASP: curto)

    // Proteção contra força bruta por CONTA (OWASP Authentication Cheat Sheet) —
    // complementa o rate-limit por IP (Program.cs), que sozinho é contornável trocando de IP.
    private const int FalhasAntesDoDelay = 3;         // primeiras tentativas erradas não atrasam
    private const int SegundosDelayBase = 1;           // "starts as a very short period (e.g., one second)"
    private const int SegundosDelayMaximo = 300;        // teto de 5min — depois disso só o bloqueio permanente conta
    private const int FalhasParaBloqueioPermanente = 10; // "after that permanent account lockout" — exige reset de senha

    // Tolerância da reuse-detection pra CORRIDA do próprio cliente (ver ReapresentacaoEmCorridaAsync).
    // Cenário real: o jwt de 15min expira, a tela dispara vários GETs, todos tomam 401 e cada um manda
    // o MESMO refresh (duas abas abertas, ou um front sem single-flight). O 1º rotaciona; os outros
    // chegam com o token já rotacionado e a regra estrita comprometia a família → usuário deslogado +
    // alerta falso de roubo. 30s cobre com folga latência + fila do servidor numa rajada dessas.
    // Tradeoff consciente: o RFC 9700 §4.14.2 revoga a família em QUALQUER reapresentação e não prevê
    // janela; a janela é decisão de risco nossa, no molde do "reuse interval" do Auth0 — só que mais
    // estreita (exige o mesmo dispositivo) e mais conservadora (a reapresentação tolerada NÃO ganha
    // token novo, só leva 401). Fora dela, a regra estrita do RFC vale inteira.
    private const int SegundosToleranciaReuso = 30;

    public AuthService(
        AppDbContext context,
        JwtTokenProvider tokenProvider,
        IPasswordResetDispatcher resetDispatcher,
        MfaService mfaService,
        NotificacaoAdminService notificacaoAdmin,
        IHttpContextAccessor? httpContextAccessor = null)
    {
        _context = context;
        _tokenProvider = tokenProvider;
        _resetDispatcher = resetDispatcher;
        _mfaService = mfaService;
        _notificacaoAdmin = notificacaoAdmin;
        _httpContextAccessor = httpContextAccessor;
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
    // reutilizáveis. `familiaId` null = novo login (família nova); preenchido = rotação (herda a
    // família do antecessor, pra reuse-detection). Captura dispositivo/IP só pra exibir na UI de sessões.
    private Task<(RefreshToken Entity, string TokenBruto)> CriarRefreshTokenAsync(Guid usuarioId, Guid? familiaId = null, bool lembrarSessao = false)
    {
        var tokenBruto = GerarTokenOpaco();
        var (dispositivo, ip) = CapturarDispositivo();
        var rt = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UsuarioId = usuarioId,
            Token = OpaqueTokenHasher.Hash(tokenBruto),
            ExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenDays),
            Revogado = false,
            CriadoEm = DateTime.UtcNow,
            FamiliaId = familiaId ?? Guid.NewGuid(),
            DispositivoInfo = dispositivo,
            IpCriacao = ip,
            LembrarSessao = lembrarSessao,
        };
        _context.RefreshTokens.Add(rt);
        // Sem I/O aqui (o SaveChanges é do caller) — não precisa de async/await.
        return Task.FromResult((rt, tokenBruto));
    }

    // User-Agent (truncado) + IP da request atual, pra exibir o dispositivo na tela de sessões.
    // Minimização: sem fingerprint/parsing; só o que dá pra mostrar "de onde/quando". Null fora de
    // uma request (ex.: testes, jobs).
    private (string? Dispositivo, string? Ip) CapturarDispositivo()
    {
        var ctx = _httpContextAccessor?.HttpContext;
        if (ctx == null) return (null, null);

        var ua = ctx.Request.Headers.UserAgent.ToString();
        if (ua.Length > 256) ua = ua[..256];
        var ip = ctx.Connection.RemoteIpAddress?.ToString();
        return (string.IsNullOrWhiteSpace(ua) ? null : ua, string.IsNullOrWhiteSpace(ip) ? null : ip);
    }

    // ── Trusted devices (MFA "lembrar este dispositivo por X dias") ─────────────

    /// <summary>Device confiável VÁLIDO pra esta conta, ou null. Fail-closed + anti-cross-account: o
    /// token tem que existir, pertencer a ESTE usuário (<c>UsuarioId</c>), não estar revogado e não ter
    /// expirado. Num navegador compartilhado, device confiado por outra conta NUNCA casa aqui — é a
    /// razão de o trusted-device ter esperado o fix do multi-conta.</summary>
    private async Task<TrustedDevice?> ObterDispositivoConfiavelAsync(Guid usuarioId, string? tokenBruto)
    {
        if (string.IsNullOrWhiteSpace(tokenBruto)) return null;

        var hash = OpaqueTokenHasher.Hash(tokenBruto);
        var device = await _context.TrustedDevices.FirstOrDefaultAsync(d => d.TokenHash == hash);
        if (device is null || device.UsuarioId != usuarioId || device.Revogado || device.ExpiraEm <= DateTime.UtcNow)
            return null;

        return device;
    }

    /// <summary>Cria um device confiável pra este usuário e devolve o token BRUTO (vai pro cookie
    /// httpOnly `td`; o banco guarda só o hash). Chamado no 2º passo do login quando o usuário marcou
    /// "confiar neste dispositivo". Captura UA/IP só pra exibição.</summary>
    public async Task<string> CriarTrustedDeviceAsync(Guid usuarioId)
    {
        var tokenBruto = GerarTokenOpaco();
        var (dispositivo, ip) = CapturarDispositivo();
        _context.TrustedDevices.Add(new TrustedDevice
        {
            Id = Guid.NewGuid(),
            UsuarioId = usuarioId,
            TokenHash = OpaqueTokenHasher.Hash(tokenBruto),
            ExpiraEm = DateTime.UtcNow.AddDays(TrustedDeviceDias),
            CriadoEm = DateTime.UtcNow,
            DispositivoInfo = dispositivo,
            IpCriacao = ip,
        });
        await _context.SaveChangesAsync();
        return tokenBruto;
    }

    /// <summary>Revoga (soft) todos os devices confiáveis vivos do usuário. NÃO salva — o caller salva
    /// na mesma transação do evento de segurança (troca/reset de senha, desativar MFA).</summary>
    private async Task RevogarDevicesConfiaveisAsync(Guid usuarioId)
    {
        var devices = await _context.TrustedDevices
            .Where(d => d.UsuarioId == usuarioId && !d.Revogado)
            .ToListAsync();
        foreach (var d in devices)
            d.Revogado = true;
    }

    // Reuse-detection (RFC 9700 §4.14): um refresh JÁ ROTACIONADO reapresentado indica replay/roubo.
    // Revoga a FAMÍLIA inteira (mata a sessão do atacante E a legítima) e alerta o admin. Fail-closed:
    // o caller lança Unauthorized depois de chamar isto.
    private async Task ComprometerFamiliaAsync(RefreshToken tokenComprometido)
    {
        var familia = await _context.RefreshTokens
            .Where(r => r.FamiliaId == tokenComprometido.FamiliaId && !r.Revogado)
            .ToListAsync();
        foreach (var r in familia)
            r.Revogado = true;
        await _context.SaveChangesAsync();

        var quem = tokenComprometido.Usuario?.Nome ?? tokenComprometido.UsuarioId.ToString();
        await _notificacaoAdmin.CriarAsync(
            TipoNotificacaoAdmin.Seguranca,
            "Refresh token reutilizado (possível roubo)",
            $"Um refresh token já rotacionado da conta de {quem} foi reapresentado. A sessão foi encerrada por segurança (reuse-detection).",
            "/admin/usuarios");
    }

    // Reapresentação de refresh já rotacionado que tem cara de CORRIDA do próprio cliente, não de
    // replay: o sucessor nasceu há menos de SegundosToleranciaReuso E no mesmo dispositivo (User-Agent
    // + IP desta request = os gravados na criação do sucessor). Mesmo dispositivo não prova identidade
    // (UA é forjável, IP pode ser NAT compartilhado), mas tira da janela o caso típico de roubo — token
    // usado de outra máquina/rede —, que segue comprometendo a família mesmo dentro dos 30s, em
    // qualquer ordem (atacante antes ou depois do legítimo). Sem dispositivo pra comparar (fora de
    // request HTTP) ou sem sucessor → fail-closed: trata como replay.
    private async Task<bool> ReapresentacaoEmCorridaAsync(RefreshToken rt)
    {
        if (rt.SubstituidoPorId is not Guid sucessorId) return false;

        var (dispositivo, ip) = CapturarDispositivo();
        if (dispositivo is null || ip is null) return false;

        var sucessor = await _context.RefreshTokens.FirstOrDefaultAsync(r => r.Id == sucessorId);
        if (sucessor is null) return false;

        // Duration(): com mais de uma instância, relógio levemente adiantado não pode virar "fora da janela".
        var idadeDaRotacao = (DateTime.UtcNow - sucessor.CriadoEm).Duration();
        return idadeDaRotacao < TimeSpan.FromSeconds(SegundosToleranciaReuso)
            && sucessor.DispositivoInfo == dispositivo
            && sucessor.IpCriacao == ip;
    }

    public async Task<RegisterResponseDto> RegisterAsync(RegisterDto dto)
    {
        // Validate input
        if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
            throw new ArgumentException("Email e senha são obrigatórios");

        if (dto.Password != dto.ConfirmPassword)
            throw new ArgumentException("Senhas não conferem");

        PasswordPolicyService.ValidarOuLancar(dto.Password);

        // Anti-enumeração de usuário (OWASP, achado do pentest 2026-09-12): NÃO revelar se o e-mail
        // já existe. Antes lançava "Email já cadastrado" (409) → dava pra enumerar quem tem conta.
        // Agora, se já existe (case-insensitive — e-mail é gravado em lowercase abaixo), devolve a
        // MESMA resposta genérica de um cadastro novo, sem criar duplicata. Equaliza o timing fazendo
        // o mesmo trabalho caro (hash Argon2) e descartando, pra não vazar por tempo de resposta.
        if (_context.Usuarios.Any(u => u.Email == dto.Email.ToLower()))
        {
            _ = PasswordHasher.HashPassword(dto.Password);
            return RespostaCadastroRecebido();
        }

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
            "/admin/pendentes",
            alvoId: usuario.Id); // acionável: some do sino quando o cadastro for aprovado/recusado

        return RespostaCadastroRecebido();
    }

    // Resposta genérica do cadastro — idêntica para e-mail novo e já existente (anti-enumeração).
    private static RegisterResponseDto RespostaCadastroRecebido() => new()
    {
        Status = StatusUsuario.AguardandoAprovacao,
        Mensagem = "Cadastro enviado! Sua conta está aguardando aprovação. "
                 + "Você receberá acesso assim que for liberada.",
    };

    public async Task<LoginResultDto> LoginAsync(LoginDto dto, string? trustedDeviceToken = null, bool manterConectado = false)
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

        // Conta na CARÊNCIA de exclusão: senha provada → NÃO barra e NÃO emite sessão; sinaliza pro
        // front oferecer a reativação (autoatendimento). Zera o contador de força bruta antes.
        if (usuario.Status == StatusUsuario.MarcadoParaExclusao)
        {
            usuario.FalhasLoginConsecutivas = 0;
            usuario.UltimaFalhaLoginEm = null;
            await _context.SaveChangesAsync();

            int? dias = usuario.MarcadoExclusaoEm.HasValue
                ? Math.Max(0, AdminLgpdService.JanelaCarenciaDias - (int)(DateTime.UtcNow - usuario.MarcadoExclusaoEm.Value).TotalDays)
                : null;
            return new LoginResultDto { ContaMarcadaExclusao = true, DiasRestantesExclusao = dias };
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
            var deviceConfiavel = await ObterDispositivoConfiavelAsync(usuario.Id, trustedDeviceToken);
            if (deviceConfiavel is null)
            {
                // Sem device confiável → exige o 2º fator: cria o desafio de curta duração e para aqui.
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

            // Device confiável válido PRA ESTA conta → pula o 2º fator (nunca a senha). Marca o uso do
            // device e o último acesso (que, com MFA, só seria marcado no 2º passo). Persistido no
            // SaveChanges da criação de sessão abaixo.
            deviceConfiavel.UltimoUsoEm = DateTime.UtcNow;
            usuario.UltimoAcessoEm = DateTime.UtcNow;
        }

        var (rt, refreshBruto) = await CriarRefreshTokenAsync(usuario.Id, lembrarSessao: manterConectado);
        await _context.SaveChangesAsync();

        var token = _tokenProvider.GenerateToken(usuario.Id, usuario.Email, usuario.Nome, rt.FamiliaId);

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
                LembrarSessao = rt.LembrarSessao,
            },
        };
    }

    /// <summary>
    /// Passo 2 do login com MFA — recebe o challenge do passo 1 (senha certa) + o código
    /// TOTP/backup, e só aí emite a sessão de verdade (JWT + refresh). Challenge é de uso
    /// único em caso de SUCESSO (deletado); código errado não consome o challenge, permite
    /// tentar de novo dentro do TTL (rate-limit por IP no endpoint cobre brute-force do código).
    /// </summary>
    public async Task<AuthResponseDto> VerificarMfaLoginAsync(string challengeTokenBruto, string codigo, bool manterConectado = false)
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

        var (rt, refreshBruto) = await CriarRefreshTokenAsync(challenge.Usuario.Id, lembrarSessao: manterConectado);
        await _context.SaveChangesAsync();

        var token = _tokenProvider.GenerateToken(challenge.Usuario.Id, challenge.Usuario.Email, challenge.Usuario.Nome, rt.FamiliaId);

        return new AuthResponseDto
        {
            UsuarioId = challenge.Usuario.Id,
            Email = challenge.Usuario.Email,
            Nome = challenge.Usuario.Nome,
            Token = token,
            RefreshToken = refreshBruto,
            RefreshTokenExpiresAt = rt.ExpiresAt,
            LembrarSessao = rt.LembrarSessao,
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

        if (rt == null)
            throw new UnauthorizedAccessException("Refresh token inválido ou expirado.");

        // Reuse-detection: um refresh JÁ ROTACIONADO (SubstituidoPorId != null) reapresentado =
        // replay/roubo → compromete a família inteira. Revogado sem substituto (logout/reset) só falha.
        // Exceção: corrida do próprio cliente (mesmo dispositivo, rotação de segundos atrás) só falha ESTA
        // request (401), sem revogar nada — quem entrega os cookies novos é a request paralela que ganhou.
        if (rt.Revogado)
        {
            if (rt.SubstituidoPorId != null && !await ReapresentacaoEmCorridaAsync(rt))
                await ComprometerFamiliaAsync(rt);
            throw new UnauthorizedAccessException("Refresh token inválido ou expirado.");
        }

        if (rt.ExpiresAt <= DateTime.UtcNow)
            throw new UnauthorizedAccessException("Refresh token inválido ou expirado.");

        // Se a conta deixou de ser Ativa (bloqueada/marcada pra exclusão) entre um refresh e outro,
        // a sessão morre aqui — não renova. Fail-closed.
        if (rt.Usuario.Status != StatusUsuario.Ativo)
            throw new UnauthorizedAccessException(MensagemStatusBloqueado(rt.Usuario.Status));

        // Rotação: revoga o atual e cria o sucessor na MESMA família (reuse-detection).
        rt.Revogado = true;
        rt.UltimoUsoEm = DateTime.UtcNow;

        var (novoRt, refreshBruto) = await CriarRefreshTokenAsync(rt.UsuarioId, rt.FamiliaId, rt.LembrarSessao);
        rt.SubstituidoPorId = novoRt.Id;
        await _context.SaveChangesAsync();

        var jwtToken = _tokenProvider.GenerateToken(rt.Usuario.Id, rt.Usuario.Email, rt.Usuario.Nome, novoRt.FamiliaId);

        return new AuthResponseDto
        {
            UsuarioId = rt.Usuario.Id,
            Email = rt.Usuario.Email,
            Nome = rt.Usuario.Nome,
            Token = jwtToken,
            RefreshToken = refreshBruto,
            RefreshTokenExpiresAt = novoRt.ExpiresAt,
            LembrarSessao = novoRt.LembrarSessao,
        };
    }

    /// <summary>
    /// Troca a conta ativa (multi-sessão, Opção A). O <paramref name="refreshToken"/> vem do cookie
    /// httpOnly `rt_&lt;slot&gt;` da conta destino — a AUTORIDADE da troca é a posse desse token, não o
    /// <paramref name="accountId"/> do corpo, que é só SELETOR. Guard anti-IDOR explícito
    /// (<c>rt.UsuarioId == accountId</c>): quem não possui o refresh daquela conta não troca pra ela.
    /// Fail-closed (token ausente/inválido/revogado/expirado/conta não-Ativa → Unauthorized genérico).
    /// Rotaciona o refresh (revoga o antigo, cria novo), igual ao <see cref="RefreshAsync"/>.
    /// </summary>
    public async Task<AuthResponseDto> SwitchAsync(string? refreshToken, Guid accountId)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
            throw new UnauthorizedAccessException("Sessão inválida para esta conta.");

        var tokenHash = OpaqueTokenHasher.Hash(refreshToken);
        var rt = await _context.RefreshTokens
            .Include(r => r.Usuario)
            .FirstOrDefaultAsync(r => r.Token == tokenHash);

        if (rt == null)
            throw new UnauthorizedAccessException("Sessão inválida para esta conta.");

        // Reuse-detection (o switch é uma rotação): replay de token já rotacionado da conta pedida
        // compromete a família. Só dispara se pertence à conta (não vaza nada sobre outras contas).
        if (rt.Revogado)
        {
            if (rt.SubstituidoPorId != null && rt.UsuarioId == accountId)
                await ComprometerFamiliaAsync(rt);
            throw new UnauthorizedAccessException("Sessão inválida para esta conta.");
        }

        // Fail-closed + anti-IDOR: válido E pertence À conta pedida.
        if (rt.ExpiresAt <= DateTime.UtcNow || rt.UsuarioId != accountId)
            throw new UnauthorizedAccessException("Sessão inválida para esta conta.");

        if (rt.Usuario.Status != StatusUsuario.Ativo)
            throw new UnauthorizedAccessException(MensagemStatusBloqueado(rt.Usuario.Status));

        // Rotação na MESMA família (reuse-detection).
        rt.Revogado = true;
        rt.UltimoUsoEm = DateTime.UtcNow;
        var (novoRt, refreshBruto) = await CriarRefreshTokenAsync(rt.UsuarioId, rt.FamiliaId, rt.LembrarSessao);
        rt.SubstituidoPorId = novoRt.Id;
        await _context.SaveChangesAsync();

        var jwtToken = _tokenProvider.GenerateToken(rt.Usuario.Id, rt.Usuario.Email, rt.Usuario.Nome, novoRt.FamiliaId);

        return new AuthResponseDto
        {
            UsuarioId = rt.Usuario.Id,
            Email = rt.Usuario.Email,
            Nome = rt.Usuario.Nome,
            Token = jwtToken,
            RefreshToken = refreshBruto,
            RefreshTokenExpiresAt = novoRt.ExpiresAt,
            LembrarSessao = novoRt.LembrarSessao,
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

    /// <summary>
    /// Logout de TODAS as contas parqueadas no browser — revoga cada refresh token informado
    /// (os cookies `rt_*` que o controller enumerou). Silencioso para os que não existirem.
    /// </summary>
    public async Task LogoutAllAsync(IEnumerable<string> refreshTokens)
    {
        var hashes = refreshTokens
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(OpaqueTokenHasher.Hash)
            .ToList();
        if (hashes.Count == 0) return;

        var tokens = await _context.RefreshTokens
            .Where(r => hashes.Contains(r.Token) && !r.Revogado)
            .ToListAsync();
        foreach (var r in tokens)
            r.Revogado = true;

        if (tokens.Count > 0)
            await _context.SaveChangesAsync();
    }

    // ── Sessões ativas / dispositivos (Fase 2) ─────────────────────────────────

    /// <summary>Lista as sessões ativas (refresh não revogado/não expirado) do usuário, mais recente
    /// primeiro, marcando a atual (a que fez esta request, via o refresh bruto da conta ativa). Nunca
    /// devolve o token — só id + metadados de exibição.</summary>
    public async Task<List<SessaoDto>> ListarSessoesAsync(Guid usuarioId, string? refreshTokenAtual)
    {
        var hashAtual = string.IsNullOrWhiteSpace(refreshTokenAtual) ? null : OpaqueTokenHasher.Hash(refreshTokenAtual);
        var agora = DateTime.UtcNow;

        return await _context.RefreshTokens
            .Where(r => r.UsuarioId == usuarioId && !r.Revogado && r.ExpiresAt > agora)
            .OrderByDescending(r => r.UltimoUsoEm ?? r.CriadoEm)
            .Select(r => new SessaoDto
            {
                Id = r.Id,
                CriadoEm = r.CriadoEm,
                UltimoUsoEm = r.UltimoUsoEm,
                Dispositivo = r.DispositivoInfo,
                Ip = r.IpCriacao,
                Atual = hashAtual != null && r.Token == hashAtual,
            })
            .ToListAsync();
    }

    /// <summary>Revoga UMA sessão do usuário (encerra aquele dispositivo). Anti-IDOR: filtra por
    /// UsuarioId — não dá pra revogar sessão de terceiro. 404 se não for dele/já revogada.</summary>
    public async Task RevogarSessaoAsync(Guid usuarioId, Guid sessaoId)
    {
        var rt = await _context.RefreshTokens
            .FirstOrDefaultAsync(r => r.Id == sessaoId && r.UsuarioId == usuarioId && !r.Revogado);
        if (rt == null)
            throw new KeyNotFoundException("Sessão não encontrada.");

        rt.Revogado = true;
        await _context.SaveChangesAsync();
    }

    /// <summary>"Sair de todos os outros dispositivos": revoga todas as sessões do usuário EXCETO a
    /// atual (a que fez a request). Retorna quantas encerrou.</summary>
    public async Task<int> RevogarOutrasSessoesAsync(Guid usuarioId, string? refreshTokenAtual)
    {
        var hashAtual = string.IsNullOrWhiteSpace(refreshTokenAtual) ? null : OpaqueTokenHasher.Hash(refreshTokenAtual);

        var outras = await _context.RefreshTokens
            .Where(r => r.UsuarioId == usuarioId && !r.Revogado && (hashAtual == null || r.Token != hashAtual))
            .ToListAsync();
        foreach (var r in outras)
            r.Revogado = true;

        if (outras.Count > 0)
            await _context.SaveChangesAsync();
        return outras.Count;
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

        // Reset de senha também esquece os dispositivos confiáveis → força re-MFA em todos.
        await RevogarDevicesConfiaveisAsync(prt.UsuarioId);

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

        // Trocar a senha (evento sensível) esquece os dispositivos confiáveis → re-MFA em todos.
        await RevogarDevicesConfiaveisAsync(usuarioId);

        _context.Usuarios.Update(usuario);
        await _context.SaveChangesAsync();
    }
}

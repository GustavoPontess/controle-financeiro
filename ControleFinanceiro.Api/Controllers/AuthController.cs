using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Hosting;
using ControleFinanceiro.Api.DTOs.Auth;
using ControleFinanceiro.Api.Services;
using ControleFinanceiro.Api.Infrastructure.Identity;
using ControleFinanceiro.Api.Infrastructure.Security;

namespace ControleFinanceiro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;
    private readonly MfaService _mfaService;
    private readonly JwtTokenProvider _tokenProvider;
    private readonly CsrfTokenService _csrfTokenService;
    private readonly RegistroAcessoService _registroAcesso;
    private readonly MinhaContaService _contaService;
    private readonly RosterService _rosterService;
    private readonly IHostEnvironment _env;
    private readonly ILogger<AuthController> _logger;

    public AuthController(AuthService authService, MfaService mfaService, JwtTokenProvider tokenProvider,
        CsrfTokenService csrfTokenService, RegistroAcessoService registroAcesso, MinhaContaService contaService,
        RosterService rosterService, IHostEnvironment env, ILogger<AuthController> logger)
    {
        _authService = authService;
        _mfaService = mfaService;
        _tokenProvider = tokenProvider;
        _csrfTokenService = csrfTokenService;
        _registroAcesso = registroAcesso;
        _contaService = contaService;
        _rosterService = rosterService;
        _env = env;
        _logger = logger;
    }

    /// <summary>
    /// SÓ EM DEVELOPMENT: lista as contas do banco (e-mail + nome) pro painel de atalho do login.
    /// Em qualquer outro ambiente responde 404 — nunca expõe e-mails em produção.
    /// </summary>
    [HttpGet("dev/contas")]
    [AllowAnonymous]
    public async Task<IActionResult> DevContas()
    {
        if (!_env.IsDevelopment()) return NotFound();
        return Ok(await _authService.ListarContasDevAsync());
    }

    /// <summary>
    /// Registra o acesso à aplicação para retenção Marco Civil (Art. 15). Best-effort: uma falha ao
    /// gravar o log NÃO derruba o login do usuário (só loga o erro). O IP vem de
    /// <c>Connection.RemoteIpAddress</c>, que já reflete o X-Forwarded-For real atrás do proxy
    /// (ForwardedHeaders configurado no Program.cs).
    /// </summary>
    private async Task RegistrarAcessoAsync(Guid usuarioId, string email)
    {
        try
        {
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "desconhecido";
            await _registroAcesso.RegistrarLoginAsync(usuarioId, email, ip);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha ao gravar registro de acesso (Marco Civil) do usuário {UsuarioId}.", usuarioId);
        }
    }

    private Guid ExigirUsuarioId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !Guid.TryParse(claim.Value, out var usuarioId))
            throw new UnauthorizedAccessException("Usuário não identificado");
        return usuarioId;
    }

    // ── Cookies de sessão (multi-conta, Opção A) ─────────────────────────────────
    // Modelo: 1 conta ATIVA (cookie `jwt`, Path=/, identifica toda request) + N contas PARQUEADAS,
    // cada uma com seu refresh no cookie httpOnly `rt_<slot>` (Path do auth — NÃO vai em toda
    // request, só nos endpoints de auth: menor exposição). `active_acct` (httpOnly, path do auth)
    // diz qual conta está ativa pro /refresh achar o slot. O X-CSRF-Token (legível por JS, Path=/)
    // vive tanto quanto o refresh (7d) e é reemitido em TODO evento de auth (login/mfa/switch/
    // refresh) — anti session-fixation e fecha a janela CSRF (antes expirava em 1h e derrubava
    // /refresh e /switch). TODO o token (jwt/refresh) segue httpOnly — nunca legível por JS.
    private const string AuthPath = "/api/v1/auth";
    private const int SessionDays = 7;

    // Trusted-device (MFA "lembrar este dispositivo"): cookie opaco httpOnly, escopo do auth.
    private const string TrustedDeviceCookie = "td";
    private const int TrustedDeviceDias = 30; // alinhado a AuthService.TrustedDeviceDias

    // Roster / chooser pré-login: id opaco do NAVEGADOR. httpOnly + SameSite=Strict (imune a CSRF) +
    // escopo do auth. Só é setado quando o usuário opta por "manter conectado" — PC emprestado nunca
    // ganha o cookie nem entra na lista.
    private const string DeviceIdCookie = "rd";
    private const int DeviceIdDias = 180;

    // Teto de contas conectadas simultaneamente no mesmo navegador (blast-radius: cada conta
    // parqueada é mais um refresh de 7d exposto se o device for comprometido). Re-login da MESMA
    // conta já parqueada não conta. Ver docs/features/auth/multi-conta.md.
    private const int MaxContasConectadas = 5;

    /// <summary>Pode parquear esta conta? Re-login da mesma (slot já existe) sempre pode; conta nova
    /// só se ainda não bateu o teto de <see cref="MaxContasConectadas"/> cookies rt_*.</summary>
    private bool PodeParquearConta(Guid accountId)
    {
        if (Request.Cookies.ContainsKey(SlotCookieName(accountId))) return true;
        var conectadas = Request.Cookies.Keys.Count(k => k.StartsWith("rt_", StringComparison.Ordinal));
        return conectadas < MaxContasConectadas;
    }

    private ObjectResult LimiteContasResult() => Conflict(new
    {
        code = "limite_contas",
        message = $"Limite de {MaxContasConectadas} contas conectadas neste navegador. Saia de uma antes de adicionar outra.",
    });

    // Nome opaco do cookie de refresh por conta — hash do id, NÃO o GUID cru, pra não vazar no
    // devtools QUAIS contas estão conectadas. Determinístico: o servidor recomputa do accountId
    // pra ler/rotacionar/apagar o slot certo.
    private static string SlotCookieName(Guid accountId)
    {
        var hash = System.Security.Cryptography.SHA256.HashData(accountId.ToByteArray());
        return "rt_" + Convert.ToHexString(hash)[..16].ToLowerInvariant();
    }

    // "Manter-me conectado": persistente=true → cookies com Expires (sobrevivem a fechar o navegador,
    // reabrir já entra logado). persistente=false (padrão) → cookies de SESSÃO (Expires=null, morrem
    // ao fechar — OWASP default, seguro em PC compartilhado). Vale pra rt_/active_acct/csrf; o jwt é
    // curto (15min) de qualquer jeito.
    private void SetActiveSessionCookies(string jwtToken, Guid accountId, bool persistente)
    {
        var isSecure = Request.IsHttps;

        // Vida do cookie alinhada ao TTL do access token (15min, JWT_EXPIRATION_MINUTES). Quando
        // vence, o silent refresh renova pelo refresh (7d). Curto encurta a janela; a revogação
        // instantânea vem do OnTokenValidated (checagem de sessão viva por request).
        Response.Cookies.Append("jwt", jwtToken, new CookieOptions
        {
            HttpOnly = true, Secure = isSecure, SameSite = SameSiteMode.Strict, Path = "/",
            Expires = persistente ? DateTimeOffset.UtcNow.AddMinutes(15) : null,
        });

        var csrfToken = _csrfTokenService.GenerateToken();
        Response.Cookies.Append("X-CSRF-Token", csrfToken, new CookieOptions
        {
            HttpOnly = false, Secure = isSecure, SameSite = SameSiteMode.Strict, Path = "/",
            Expires = persistente ? DateTimeOffset.UtcNow.AddDays(SessionDays) : null,
        });

        Response.Cookies.Append("active_acct", accountId.ToString(), new CookieOptions
        {
            HttpOnly = true, Secure = isSecure, SameSite = SameSiteMode.Strict, Path = AuthPath,
            Expires = persistente ? DateTimeOffset.UtcNow.AddDays(SessionDays) : null,
        });
    }

    // Cookie do device confiável (MFA): opaco, httpOnly, escopo do auth (só vai nos endpoints de
    // auth = menor exposição). Vive ALÉM do logout de propósito — o device segue confiável pro
    // próximo login (modelo Google/Microsoft); só some ao expirar ou ser revogado no servidor.
    private void SetTrustedDeviceCookie(string token) =>
        Response.Cookies.Append(TrustedDeviceCookie, token, new CookieOptions
        {
            HttpOnly = true, Secure = Request.IsHttps, SameSite = SameSiteMode.Strict, Path = AuthPath,
            Expires = DateTimeOffset.UtcNow.AddDays(TrustedDeviceDias),
        });

    private CookieOptions DeviceIdCookieOptions() => new()
    {
        HttpOnly = true, Secure = Request.IsHttps, SameSite = SameSiteMode.Strict, Path = AuthPath,
        Expires = DateTimeOffset.UtcNow.AddDays(DeviceIdDias),
    };

    // Lê o id do navegador do cookie `rd`, ou cria um novo. Renova a validade (rolling) mantendo o id.
    private string EnsureDeviceIdCookie()
    {
        if (Request.Cookies.TryGetValue(DeviceIdCookie, out var existente) && !string.IsNullOrEmpty(existente))
        {
            Response.Cookies.Append(DeviceIdCookie, existente, DeviceIdCookieOptions());
            return existente;
        }
        var novo = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        Response.Cookies.Append(DeviceIdCookie, novo, DeviceIdCookieOptions());
        return novo;
    }

    // "Manter conectado" marcado → a conta entra no chooser pré-login deste navegador (opt-in).
    private async Task EnsureRosterAsync(Guid usuarioId, bool manterConectado)
    {
        if (!manterConectado) return;
        var deviceId = EnsureDeviceIdCookie();
        await _rosterService.LembrarAsync(deviceId, usuarioId);
    }

    private void ParkRefreshCookie(Guid accountId, string refreshToken, bool persistente)
    {
        Response.Cookies.Append(SlotCookieName(accountId), refreshToken, new CookieOptions
        {
            HttpOnly = true, Secure = Request.IsHttps, SameSite = SameSiteMode.Strict, Path = AuthPath,
            Expires = persistente ? DateTimeOffset.UtcNow.AddDays(SessionDays) : null,
        });
    }

    // Parqueia o refresh da conta e a torna ativa (jwt+csrf+active_acct). Usado em login/mfa/
    // switch/refresh — NÃO mexe nos slots das outras contas. A persistência (manter-conectado) vem
    // do refresh: no login/verify é o checkbox; no refresh/switch é herdada do token rotacionado.
    private void SetLoggedInCookies(AuthResponseDto auth)
    {
        ParkRefreshCookie(auth.UsuarioId, auth.RefreshToken, auth.LembrarSessao);
        SetActiveSessionCookies(auth.Token, auth.UsuarioId, auth.LembrarSessao);
    }

    private void DeleteCookie(string name, string path) =>
        Response.Cookies.Delete(name, new CookieOptions
        {
            Path = path, Secure = Request.IsHttps, SameSite = SameSiteMode.Strict,
        });

    // Encerra SÓ a conta ativa; mantém as outras parqueadas (o front escolhe a próxima).
    private void ClearActiveSession(Guid? accountId)
    {
        DeleteCookie("jwt", "/");
        DeleteCookie("X-CSRF-Token", "/");
        DeleteCookie("active_acct", AuthPath);
        if (accountId.HasValue)
            DeleteCookie(SlotCookieName(accountId.Value), AuthPath);
        DeleteCookie("refreshToken", "/"); // compat: sessão legada (pré multi-conta)
    }

    // Encerra TODAS: jwt/csrf/active_acct + todos os rt_* presentes.
    private void ClearAllSessions()
    {
        DeleteCookie("jwt", "/");
        DeleteCookie("X-CSRF-Token", "/");
        DeleteCookie("active_acct", AuthPath);
        DeleteCookie("refreshToken", "/"); // compat legado
        foreach (var name in Request.Cookies.Keys.Where(k => k.StartsWith("rt_", StringComparison.Ordinal)))
            DeleteCookie(name, AuthPath);
    }

    // Login "frio" (feito pela tela de login, SEM sessão ativa) começa do ZERO: revoga no banco e
    // apaga do navegador qualquer conta parqueada de quem usou o dispositivo antes. Sem isso, num
    // PC compartilhado o próximo usuário herdava as contas do anterior no switcher e conseguia
    // entrar nelas (cookie rt_ ainda válido). Login ESTANDO autenticado = "adicionar conta": aí NÃO
    // limpa (é o mesmo dono anexando outra conta).
    private async Task RevogarSessoesAnterioresAsync()
    {
        var tokens = Request.Cookies
            .Where(c => c.Key.StartsWith("rt_", StringComparison.Ordinal))
            .Select(c => c.Value)
            .ToList();
        if (Request.Cookies.TryGetValue("refreshToken", out var legacy) && !string.IsNullOrEmpty(legacy))
            tokens.Add(legacy);
        if (tokens.Count > 0)
            await _authService.LogoutAllAsync(tokens);
        ClearAllSessions();
    }

    // Refresh da conta ativa (slot novo) com fallback pro cookie legado "refreshToken".
    private (string? Refresh, Guid? AccountId) ReadActiveRefresh()
    {
        if (Request.Cookies.TryGetValue("active_acct", out var acctStr) && Guid.TryParse(acctStr, out var acct)
            && Request.Cookies.TryGetValue(SlotCookieName(acct), out var rt) && !string.IsNullOrEmpty(rt))
            return (rt, acct);

        if (Request.Cookies.TryGetValue("refreshToken", out var legacy) && !string.IsNullOrEmpty(legacy))
            return (legacy, null); // sessão criada antes do multi-conta

        return (null, null);
    }

    /// <summary>
    /// Cadastro no beta. A conta nasce <c>AguardandoAprovacao</c> e NÃO ganha sessão — nenhum cookie
    /// é setado. O usuário só loga depois que o admin aprova (gate do beta, spec
    /// `docs/features/admin/spec.md` §3). Responde 201 com a mensagem de "aguardando aprovação".
    /// </summary>
    [HttpPost("register")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-register")]
    public async Task<ActionResult<RegisterResponseDto>> Register([FromBody] RegisterDto dto)
    {
        var result = await _authService.RegisterAsync(dto);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>
    /// Login. Se o usuário tem MFA ativo, NÃO retorna sessão — retorna
    /// <c>{ mfaRequerido: true, mfaChallengeToken }</c> e o cliente precisa chamar
    /// <c>POST /mfa/verificar-login</c> com o código do 2º fator pra completar.
    /// </summary>
    /// <summary>
    /// "Confirmar meu e-mail" do e-mail de pedido recebido: prova que quem pediu acesso tem a caixa. Só pedido
    /// confirmado pode ser aprovado. Link vencido, usado ou de pedido já decidido: 400 com a mesma frase.
    /// </summary>
    [HttpPost("cadastro/confirmar-email")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-link-cadastro")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ConfirmarEmailDoCadastro([FromBody] LinkCadastroDto dto, [FromServices] ConfirmacaoCadastroService confirmacao)
    {
        await confirmacao.ConfirmarAsync(dto.Token);
        return NoContent();
    }

    /// <summary>
    /// "Não fui eu" do e-mail de pedido recebido: apaga o pedido e os dados dele (LGPD art. 18). Só pedido que
    /// ainda espera aprovação; conta aprovada nunca é apagada por aqui.
    /// </summary>
    [HttpPost("cadastro/nao-fui-eu")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-link-cadastro")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> NaoFuiEuNoCadastro([FromBody] LinkCadastroDto dto, [FromServices] ConfirmacaoCadastroService confirmacao)
    {
        await confirmacao.NaoFuiEuAsync(dto.Token);
        return NoContent();
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        // Device confiável (opt-in): se o navegador tem o cookie `td` válido PRA ESTA conta, o
        // LoginAsync pula o 2º fator e já devolve sessão (anti-cross-account é checado no service).
        Request.Cookies.TryGetValue(TrustedDeviceCookie, out var trustedDeviceToken);
        var result = await _authService.LoginAsync(dto, trustedDeviceToken, dto.ManterConectado);

        if (result.MfaRequerido)
            return Ok(new { mfaRequerido = true, mfaChallengeToken = result.MfaChallengeToken });

        // Conta na carência de exclusão: senha certa, mas sem sessão — o front oferece reativar.
        if (result.ContaMarcadaExclusao)
            return Ok(new { contaMarcadaExclusao = true, diasRestantes = result.DiasRestantesExclusao });

        var auth = result.Auth!;
        // Login pela tela de login SEMPRE começa do zero: revoga no banco + apaga os cookies de
        // qualquer conta parqueada de quem usou o navegador antes. NUNCA inferir "adicionar conta"
        // do cookie ambiente (uma sessão anterior ainda viva mascararia isso e deixaria a conta
        // acessível — o furo). "Adicionar conta" é OUTRO endpoint: POST /auth/add-account [Authorize].
        await RevogarSessoesAnterioresAsync();
        SetLoggedInCookies(auth);

        // Acesso concluído (sem MFA) → registro de acesso pra retenção Marco Civil.
        await RegistrarAcessoAsync(auth.UsuarioId, auth.Email);
        await EnsureRosterAsync(auth.UsuarioId, dto.ManterConectado);

        // Return user info without tokens (tokens are now in httpOnly cookies)
        return Ok(new AuthResponseDto
        {
            UsuarioId = auth.UsuarioId,
            Email = auth.Email,
            Nome = auth.Nome,
            Token = string.Empty,
            RefreshToken = string.Empty,
            RefreshTokenExpiresAt = auth.RefreshTokenExpiresAt
        });
    }

    /// <summary>Passo 2 do login com MFA — código TOTP ou backup code + o challenge do passo 1.</summary>
    [HttpPost("mfa/verificar-login")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-mfa")]
    public async Task<ActionResult<AuthResponseDto>> VerificarMfaLogin([FromBody] MfaVerificarLoginDto dto)
    {
        var result = await _authService.VerificarMfaLoginAsync(dto.ChallengeToken, dto.Codigo, dto.ManterConectado);
        // Passo 2 do login pela tela = também começa limpo (mesma regra do /login).
        await RevogarSessoesAnterioresAsync();
        SetLoggedInCookies(result);

        // 2º fator confirmado = acesso concluído → registro de acesso pra retenção Marco Civil.
        await RegistrarAcessoAsync(result.UsuarioId, result.Email);

        // Opt-in "confiar neste dispositivo": cria o device e seta o cookie `td` — próximos logins
        // deste navegador (só desta conta) pulam o 2º fator até expirar.
        if (dto.ConfiarDispositivo)
        {
            var trustedDeviceToken = await _authService.CriarTrustedDeviceAsync(result.UsuarioId);
            SetTrustedDeviceCookie(trustedDeviceToken);
        }

        await EnsureRosterAsync(result.UsuarioId, dto.ManterConectado);

        return Ok(new AuthResponseDto
        {
            UsuarioId = result.UsuarioId,
            Email = result.Email,
            Nome = result.Nome,
            Token = string.Empty,
            RefreshToken = string.Empty,
            RefreshTokenExpiresAt = result.RefreshTokenExpiresAt
        });
    }

    /// <summary>
    /// Adiciona OUTRA conta ao navegador (multi-conta) SEM encerrar as já conectadas. Exige sessão
    /// ativa ([Authorize]) — só o dono do "pacote" de contas adiciona. É o gesto separado do /login
    /// (que sempre começa limpo). Parqueia a conta nova e a torna ativa; NÃO mexe nas outras.
    /// </summary>
    [Authorize]
    [HttpPost("add-account")]
    [EnableRateLimiting("auth-login")]
    public async Task<IActionResult> AddAccount([FromBody] LoginDto dto)
    {
        var result = await _authService.LoginAsync(dto);

        if (result.MfaRequerido)
            // Conta com MFA ainda não é suportada no "adicionar conta" (o fluxo de 2 passos precisa
            // preservar o pacote atual). Limitação conhecida — entra por ela na tela de login.
            return Conflict(new { code = "mfa_add_nao_suportado", message = "Conta com verificação em duas etapas: entre por ela na tela de login." });

        if (result.ContaMarcadaExclusao)
            return Ok(new { contaMarcadaExclusao = true, diasRestantes = result.DiasRestantesExclusao });

        var auth = result.Auth!;
        if (!PodeParquearConta(auth.UsuarioId))
            return LimiteContasResult();
        SetLoggedInCookies(auth); // parqueia a nova + torna ativa; NÃO limpa as outras

        await RegistrarAcessoAsync(auth.UsuarioId, auth.Email);

        return Ok(new AuthResponseDto
        {
            UsuarioId = auth.UsuarioId,
            Email = auth.Email,
            Nome = auth.Nome,
            Token = string.Empty,
            RefreshToken = string.Empty,
            RefreshTokenExpiresAt = auth.RefreshTokenExpiresAt
        });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UsuarioDto>> GetMe()
    {
        var usuario = await _authService.GetUsuarioAsync(ExigirUsuarioId());
        if (usuario == null) return NotFound();

        return Ok(usuario);
    }

    [Authorize]
    [HttpPut("profile")]
    public async Task<ActionResult<UsuarioDto>> UpdateProfile([FromBody] UpdateProfileDto dto)
    {
        var result = await _authService.UpdateProfileAsync(ExigirUsuarioId(), dto.Nome, dto.DataNascimento);
        return Ok(result);
    }

    // ── Roster / "escolher conta" (chooser pré-login, opt-in) ───────────────────
    // Autenticado só pelo cookie opaco de device `rd` (SameSite=Strict → imune a CSRF). Nunca loga
    // ninguém: só lista/remove contas do chooser. Selecionar uma conta é 100% no front (pré-preenche
    // o e-mail); a senha é sempre exigida no login.

    /// <summary>Lista as contas lembradas NESTE navegador (nome + e-mail mascarado). Sem cookie
    /// `rd` → lista vazia.</summary>
    [HttpGet("roster")]
    [AllowAnonymous]
    public async Task<ActionResult<List<ContaLembradaDto>>> Roster()
    {
        Request.Cookies.TryGetValue(DeviceIdCookie, out var deviceId);
        return Ok(await _rosterService.ListarAsync(deviceId));
    }

    /// <summary>E-mail real de uma conta do roster (pra pré-preencher ao selecionar). 404 se a conta
    /// não estiver no roster deste navegador.</summary>
    [HttpGet("roster/{usuarioId:guid}/email")]
    [AllowAnonymous]
    public async Task<IActionResult> RosterEmail(Guid usuarioId)
    {
        Request.Cookies.TryGetValue(DeviceIdCookie, out var deviceId);
        var email = await _rosterService.ObterEmailAsync(deviceId, usuarioId);
        return email is null ? NotFound() : Ok(new { email });
    }

    /// <summary>Remove UMA conta do chooser deste navegador ("remover desta lista").</summary>
    [HttpDelete("roster/{usuarioId:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> RemoverDoRoster(Guid usuarioId)
    {
        Request.Cookies.TryGetValue(DeviceIdCookie, out var deviceId);
        await _rosterService.RemoverAsync(deviceId, usuarioId);
        return NoContent();
    }

    /// <summary>Esquece TODAS as contas deste navegador ("esquecer todas").</summary>
    [HttpDelete("roster")]
    [AllowAnonymous]
    public async Task<IActionResult> EsquecerRoster()
    {
        Request.Cookies.TryGetValue(DeviceIdCookie, out var deviceId);
        await _rosterService.RemoverTodasAsync(deviceId);
        return NoContent();
    }

    // ── MFA (opt-in, nunca obrigatório) ──────────────────────────────────────────

    [Authorize]
    [HttpGet("mfa/status")]
    public async Task<ActionResult<MfaStatusDto>> MfaStatus()
        => Ok(await _mfaService.ObterStatusAsync(ExigirUsuarioId()));

    [Authorize]
    [HttpPost("mfa/iniciar-ativacao")]
    [EnableRateLimiting("auth-mfa")]
    public async Task<ActionResult<MfaIniciarAtivacaoResponseDto>> MfaIniciarAtivacao()
        => Ok(await _mfaService.IniciarAtivacaoAsync(ExigirUsuarioId()));

    [Authorize]
    [HttpPost("mfa/confirmar-ativacao")]
    [EnableRateLimiting("auth-mfa")]
    public async Task<ActionResult<MfaAtivacaoConfirmadaResponseDto>> MfaConfirmarAtivacao([FromBody] MfaConfirmarAtivacaoDto dto)
    {
        var backupCodes = await _mfaService.ConfirmarAtivacaoAsync(ExigirUsuarioId(), dto.Codigo);
        return Ok(new MfaAtivacaoConfirmadaResponseDto { BackupCodes = backupCodes });
    }

    /// <summary>Resposta ao convite "Proteja sua conta" depois do login: nuncaMais = não perguntar mais; senão adia 30 dias.</summary>
    [Authorize]
    [HttpPost("mfa/convite")]
    public async Task<IActionResult> MfaConvite([FromBody] MfaConviteDto dto)
    {
        await _mfaService.ResponderConviteAsync(ExigirUsuarioId(), dto.NuncaMais);
        return NoContent();
    }

    [Authorize]
    [HttpPost("mfa/desativar")]
    [EnableRateLimiting("auth-mfa")]
    public async Task<IActionResult> MfaDesativar([FromBody] MfaDesativarDto dto)
    {
        await _mfaService.DesativarAsync(ExigirUsuarioId(), dto.SenhaAtual, dto.Codigo);
        return NoContent();
    }

    // ── Autoatendimento: excluir a própria conta (LGPD Art. 18) ──────────────────
    // Ação destrutiva → step-up: senha atual + 2º fator (TOTP se ativo; senão PIN por e-mail).
    // Soft-delete + carência de 30 dias (reversível pela reativação no login).

    /// <summary>Passo 1 — confirma a senha atual e decide o 2º fator; sem MFA, dispara o PIN por e-mail.</summary>
    [Authorize]
    [HttpPost("conta/excluir/enviar-codigo")]
    public async Task<ActionResult<Metodo2FaResponse>> EnviarCodigoExclusao([FromBody] IniciarExclusaoContaRequest dto)
        => Ok(await _contaService.IniciarExclusaoAsync(ExigirUsuarioId(), dto.SenhaAtual));

    /// <summary>Passo 2 — valida senha + 2º fator, marca a conta pra exclusão (carência 30d) e encerra a sessão.</summary>
    [Authorize]
    [HttpPost("conta/excluir")]
    public async Task<IActionResult> ExcluirMinhaConta([FromBody] ExcluirContaRequest dto)
    {
        var usuarioId = ExigirUsuarioId();
        await _contaService.ExcluirMinhaContaAsync(usuarioId, dto.SenhaAtual, dto.Codigo);
        // Encerra só a sessão desta conta (a pessoa pode ter outras parqueadas no browser).
        ClearActiveSession(usuarioId);
        return NoContent();
    }

    /// <summary>Reativa a própria conta na carência (público: o usuário não está logado). Depois, loga
    /// normalmente. Rate-limited + isento de CSRF (sem sessão), como o login.</summary>
    [HttpPost("conta/reativar")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-login")]
    public async Task<IActionResult> ReativarConta([FromBody] ReativarContaRequest dto)
    {
        await _contaService.ReativarPorCredenciaisAsync(dto.Email, dto.Senha);
        return Ok(new { mensagem = "Conta reativada. Faça login para continuar." });
    }

    /// <summary>Baixa os próprios dados (LGPD acesso/portabilidade). Auditado como ação do titular.</summary>
    [Authorize]
    [HttpGet("conta/exportar")]
    [EnableRateLimiting(LimitesDeUso.PoliticaPesada)]
    public async Task<ActionResult<DTOs.Admin.ExportacaoUsuarioDto>> ExportarMeusDados()
        => Ok(await _contaService.ExportarMeusDadosAsync(ExigirUsuarioId()));

    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var usuarioId))
            throw new UnauthorizedAccessException("Usuário não identificado");

        var (refreshAtual, _) = ReadActiveRefresh();
        await _authService.ChangePasswordAsync(usuarioId, dto.SenhaAtual, dto.NovaSenha, dto.EncerrarOutrasSessoes, refreshAtual);
        return NoContent();
    }

    /// <summary>
    /// Troca um refresh token válido por um novo par (JWT + refresh token).
    /// O refresh token antigo é revogado (rotação). 401 com code <c>REFRESH_EM_CORRIDA</c> = o token
    /// acabou de ser rotacionado por outra request do mesmo dispositivo (outra aba): a sessão segue
    /// viva e o cliente deve só refazer a request original; qualquer outro 401 = sessão encerrada.
    /// </summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh()
    {
        var (refreshToken, _) = ReadActiveRefresh();
        if (string.IsNullOrEmpty(refreshToken))
            throw new UnauthorizedAccessException("Refresh token não encontrado");

        var result = await _authService.RefreshAsync(refreshToken);
        SetLoggedInCookies(result);

        return Ok(new AuthResponseDto
        {
            UsuarioId = result.UsuarioId,
            Email = result.Email,
            Nome = result.Nome,
            Token = string.Empty,
            RefreshToken = string.Empty,
            RefreshTokenExpiresAt = result.RefreshTokenExpiresAt
        });
    }

    /// <summary>
    /// Troca a conta ATIVA para outra já parqueada no browser (multi-sessão). O corpo traz só o
    /// <c>accountId</c> SELETOR; a autoridade é o cookie httpOnly `rt_&lt;slot&gt;` daquela conta,
    /// validado no servidor (fail-closed, anti-IDOR). Reemite jwt+CSRF+refresh da conta destino.
    /// Protegido por CSRF (não é público) — o cookie CSRF vive 7d, então sobrevive à ociosidade.
    /// </summary>
    [HttpPost("switch")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Switch([FromBody] SwitchAccountDto dto)
    {
        Request.Cookies.TryGetValue(SlotCookieName(dto.AccountId), out var refreshToken);
        var result = await _authService.SwitchAsync(refreshToken, dto.AccountId);
        SetLoggedInCookies(result);

        return Ok(new AuthResponseDto
        {
            UsuarioId = result.UsuarioId,
            Email = result.Email,
            Nome = result.Nome,
            Token = string.Empty,
            RefreshToken = string.Empty,
            RefreshTokenExpiresAt = result.RefreshTokenExpiresAt
        });
    }

    /// <summary>
    /// Revoga o refresh token (logout). Silencioso se o token não for encontrado.
    /// </summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout()
    {
        var (refreshToken, accountId) = ReadActiveRefresh();
        if (!string.IsNullOrEmpty(refreshToken))
            await _authService.LogoutAsync(refreshToken);

        // Só a conta ativa sai; as outras parqueadas continuam (o front troca pra uma delas).
        ClearActiveSession(accountId);
        return NoContent();
    }

    /// <summary>
    /// Logout de TODAS as contas parqueadas no browser — revoga cada refresh (cookies `rt_*`) no
    /// banco e limpa todos os cookies de sessão. Protegido por CSRF.
    /// </summary>
    [HttpPost("logout-all")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> LogoutAll()
    {
        var refreshTokens = Request.Cookies
            .Where(c => c.Key.StartsWith("rt_", StringComparison.Ordinal))
            .Select(c => c.Value)
            .ToList();
        if (Request.Cookies.TryGetValue("refreshToken", out var legacy) && !string.IsNullOrEmpty(legacy))
            refreshTokens.Add(legacy); // compat: sessão legada

        await _authService.LogoutAllAsync(refreshTokens);
        ClearAllSessions();
        return NoContent();
    }

    // ── Sessões ativas / dispositivos (Fase 2) ────────────────────────────────────
    // Diferente do logout-all (que é do NAVEGADOR): estas rotas listam/encerram as sessões do
    // USUÁRIO em QUALQUER dispositivo. Todas exigem sessão (Authorize).

    /// <summary>Lista as sessões ativas do usuário (todos os dispositivos), marcando a atual.</summary>
    [Authorize]
    [HttpGet("sessions")]
    public async Task<ActionResult<List<DTOs.Auth.SessaoDto>>> Sessions()
    {
        var (refreshAtual, _) = ReadActiveRefresh();
        return Ok(await _authService.ListarSessoesAsync(ExigirUsuarioId(), refreshAtual));
    }

    /// <summary>Encerra UMA sessão do usuário (aquele dispositivo). Anti-IDOR no service.</summary>
    [Authorize]
    [HttpPost("sessions/{id:guid}/revogar")]
    public async Task<IActionResult> RevogarSessao(Guid id)
    {
        await _authService.RevogarSessaoAsync(ExigirUsuarioId(), id);
        return NoContent();
    }

    /// <summary>"Sair de todos os outros dispositivos" — encerra tudo menos a sessão atual.</summary>
    [Authorize]
    [HttpPost("sessions/revogar-outras")]
    public async Task<IActionResult> RevogarOutrasSessoes()
    {
        var (refreshAtual, _) = ReadActiveRefresh();
        var qtd = await _authService.RevogarOutrasSessoesAsync(ExigirUsuarioId(), refreshAtual);
        return Ok(new { encerradas = qtd });
    }

    // ── Dispositivos confiáveis (MFA "confiar neste dispositivo") ─────────────────
    // O cookie `td` tem Path do auth, então chega aqui: marca/limpa o deste navegador.

    /// <summary>Lista os dispositivos confiáveis vivos do usuário, marcando o deste navegador.</summary>
    [Authorize]
    [HttpGet("trusted-devices")]
    public async Task<ActionResult<List<DTOs.Auth.DispositivoConfiavelDto>>> TrustedDevices()
    {
        Request.Cookies.TryGetValue(TrustedDeviceCookie, out var td);
        return Ok(await _authService.ListarDispositivosConfiaveisAsync(ExigirUsuarioId(), td));
    }

    /// <summary>Esquece UM dispositivo confiável (o próximo login nele pede o código). Anti-IDOR no service.</summary>
    [Authorize]
    [HttpPost("trusted-devices/{id:guid}/revogar")]
    public async Task<IActionResult> RevogarTrustedDevice(Guid id)
    {
        Request.Cookies.TryGetValue(TrustedDeviceCookie, out var td);
        if (await _authService.RevogarDispositivoConfiavelAsync(ExigirUsuarioId(), id, td))
            Response.Cookies.Delete(TrustedDeviceCookie, new CookieOptions { Path = AuthPath });
        return NoContent();
    }

    /// <summary>Esquece TODOS os dispositivos confiáveis do usuário (inclusive este navegador).</summary>
    [Authorize]
    [HttpPost("trusted-devices/revogar-todos")]
    public async Task<IActionResult> RevogarTodosTrustedDevices()
    {
        var qtd = await _authService.RevogarTodosDispositivosConfiaveisAsync(ExigirUsuarioId());
        Response.Cookies.Delete(TrustedDeviceCookie, new CookieOptions { Path = AuthPath });
        return Ok(new { esquecidos = qtd });
    }

    /// <summary>
    /// Solicita reset de senha. Resposta genérica e idêntica para qualquer e-mail; se o e-mail
    /// existir, um link com o token é enviado por e-mail (o token nunca volta na resposta).
    /// </summary>
    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-forgot-password")]
    [ProducesResponseType(typeof(ForgotPasswordResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
    {
        var result = await _authService.SolicitarResetSenhaAsync(dto.Email);
        return Ok(result);
    }

    /// <summary>
    /// Redefine a senha usando o token de reset. Revoga todos os refresh tokens do usuário.
    /// </summary>
    /// <summary>
    /// "Não fui eu" do e-mail de senha nova: cancela o link. Sempre 204 (não diz se o link existia). O CSRF já libera
    /// /auth/reset-password*: quem abre não tem sessão; o segredo é o token do e-mail.
    /// </summary>
    [HttpPost("reset-password/cancelar")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-link-cadastro")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> CancelarResetPassword([FromBody] LinkCadastroDto dto)
    {
        await _authService.CancelarResetSenhaAsync(dto.Token);
        return NoContent();
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
    {
        await _authService.ResetSenhaAsync(dto);
        return NoContent();
    }
}

/// <summary>Token do link do e-mail de pedido recebido.</summary>
public class LinkCadastroDto
{
    [Required]
    [MaxLength(256)]
    public string Token { get; set; } = string.Empty;
}

public class UpdateProfileDto
{
    [Required]
    [MaxLength(200)]
    public string Nome { get; set; } = string.Empty;
    public DateTime? DataNascimento { get; set; }
}

public class ChangePasswordDto
{
    public string SenhaAtual { get; set; } = string.Empty;
    public string NovaSenha { get; set; } = string.Empty;

    /// <summary>Encerrar as sessões dos outros aparelhos (OWASP ASVS: oferecer depois de trocar a senha).
    /// Padrão true — quem troca a senha por suspeita não pode deixar o intruso logado. Este navegador fica.</summary>
    public bool EncerrarOutrasSessoes { get; set; } = true;
}

public class SwitchAccountDto
{
    /// <summary>Conta destino da troca — apenas SELETOR; a autoridade é o cookie httpOnly da conta.</summary>
    public Guid AccountId { get; set; }
}

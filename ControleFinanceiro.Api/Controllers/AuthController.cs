using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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
    private readonly JwtTokenProvider _tokenProvider;
    private readonly CsrfTokenService _csrfTokenService;

    public AuthController(AuthService authService, JwtTokenProvider tokenProvider, CsrfTokenService csrfTokenService)
    {
        _authService = authService;
        _tokenProvider = tokenProvider;
        _csrfTokenService = csrfTokenService;
    }

    private void SetAuthCookies(string jwtToken, string refreshToken)
    {
        // Secure=true only over HTTPS; HTTP is allowed in dev
        var isSecure = Request.IsHttps;

        Response.Cookies.Append("jwt", jwtToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = isSecure,
            SameSite = SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddHours(1)
        });

        Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = isSecure,
            SameSite = SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddDays(7)
        });

        var csrfToken = _csrfTokenService.GenerateToken();
        Response.Cookies.Append("X-CSRF-Token", csrfToken, new CookieOptions
        {
            HttpOnly = false,
            Secure = isSecure,
            SameSite = SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddHours(1)
        });
    }

    private void ClearAuthCookies()
    {
        foreach (var name in new[] { "jwt", "refreshToken", "X-CSRF-Token" })
            Response.Cookies.Delete(name);
    }

    [HttpPost("register")]
    [EnableRateLimiting("auth-register")]
    public async Task<ActionResult<AuthResponseDto>> Register([FromBody] RegisterDto dto)
    {
        var result = await _authService.RegisterAsync(dto);
        SetAuthCookies(result.Token, result.RefreshToken);

        return CreatedAtAction(nameof(GetMe), null, new AuthResponseDto
        {
            UsuarioId = result.UsuarioId,
            Email = result.Email,
            Nome = result.Nome,
            Token = string.Empty,
            RefreshToken = string.Empty,
            RefreshTokenExpiresAt = result.RefreshTokenExpiresAt
        });
    }

    [HttpPost("login")]
    [EnableRateLimiting("auth-login")]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginDto dto)
    {
        var result = await _authService.LoginAsync(dto);
        SetAuthCookies(result.Token, result.RefreshToken);

        // Return user info without tokens (tokens are now in httpOnly cookies)
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

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UsuarioDto>> GetMe()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var usuarioId))
            throw new UnauthorizedAccessException("Usuário não identificado");

        var usuario = await _authService.GetUsuarioAsync(usuarioId);
        if (usuario == null) return NotFound();

        return Ok(usuario);
    }

    [Authorize]
    [HttpPut("profile")]
    public async Task<ActionResult<UsuarioDto>> UpdateProfile([FromBody] UpdateProfileDto dto)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var usuarioId))
            throw new UnauthorizedAccessException("Usuário não identificado");

        var result = await _authService.UpdateProfileAsync(usuarioId, dto.Nome, dto.DataNascimento);
        return Ok(result);
    }

    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var usuarioId))
            throw new UnauthorizedAccessException("Usuário não identificado");

        await _authService.ChangePasswordAsync(usuarioId, dto.SenhaAtual, dto.NovaSenha);
        return NoContent();
    }

    /// <summary>
    /// Troca um refresh token válido por um novo par (JWT + refresh token).
    /// O refresh token antigo é revogado (rotação).
    /// </summary>
    [HttpPost("refresh")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh()
    {
        var refreshToken = Request.Cookies["refreshToken"];
        if (string.IsNullOrEmpty(refreshToken))
            throw new UnauthorizedAccessException("Refresh token não encontrado");

        var result = await _authService.RefreshAsync(refreshToken);
        SetAuthCookies(result.Token, result.RefreshToken);

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
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout()
    {
        var refreshToken = Request.Cookies["refreshToken"];
        if (!string.IsNullOrEmpty(refreshToken))
            await _authService.LogoutAsync(refreshToken);

        ClearAuthCookies();
        return NoContent();
    }

    /// <summary>
    /// Solicita reset de senha. Em produção enviaria e-mail; aqui retorna o token diretamente.
    /// </summary>
    [HttpPost("forgot-password")]
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
    [HttpPost("reset-password")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
    {
        await _authService.ResetSenhaAsync(dto);
        return NoContent();
    }
}

public class UpdateProfileDto
{
    public string Nome { get; set; } = string.Empty;
    public DateTime? DataNascimento { get; set; }
}

public class ChangePasswordDto
{
    public string SenhaAtual { get; set; } = string.Empty;
    public string NovaSenha { get; set; } = string.Empty;
}

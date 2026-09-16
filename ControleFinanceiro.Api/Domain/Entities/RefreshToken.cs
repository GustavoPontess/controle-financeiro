namespace ControleFinanceiro.Api.Domain.Entities;

public class RefreshToken
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }

    /// <summary>Token opaco (SHA-256 hex de 64 bytes aleatórios).</summary>
    public string Token { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }
    public bool Revogado { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    // ── Fase 2 (multi-conta): registro de sessão + reuse-detection ────────────────────────────
    // Família de rotação: todos os tokens descendentes de um mesmo login compartilham o FamiliaId.
    // Serve pra reuse-detection (RFC 9700 §4.14): replay de um refresh JÁ rotacionado → compromete a
    // família inteira, que é revogada de uma vez. Login/MFA nascem com FamiliaId novo; a rotação
    // (refresh/switch) herda o FamiliaId do antecessor.
    public Guid FamiliaId { get; set; }

    /// <summary>Token que substituiu este na rotação (null = ainda ativo ou revogado por logout/reset,
    /// não por rotação). Se um token COM SubstituidoPorId é reapresentado, é replay → compromisso.</summary>
    public Guid? SubstituidoPorId { get; set; }

    /// <summary>Última vez que este refresh foi usado (rotacionado). Pra tela de "sessões ativas".</summary>
    public DateTime? UltimoUsoEm { get; set; }

    /// <summary>User-Agent (truncado) capturado na criação — só pra exibir o dispositivo na UI de
    /// sessões. Minimização: sem fingerprint, sem parsing invasivo.</summary>
    public string? DispositivoInfo { get; set; }

    /// <summary>IP de criação da sessão (exibição na UI). Mesmo dado legal do RegistroAcesso.</summary>
    public string? IpCriacao { get; set; }

    // Nav
    public Usuario Usuario { get; set; } = null!;
}

using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

public class Usuario
{
    public Guid Id { get; set; }

    [Required]
    [EmailAddress]
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Nome { get; set; } = string.Empty;

    public DateTime? DataNascimento { get; set; }

    /// <summary>Situação da conta (ciclo de vida do beta). Fonte ÚNICA da verdade sobre "pode usar
    /// o sistema?" — só <see cref="StatusUsuario.Ativo"/> loga. Substituiu o antigo <c>bool Ativo</c>
    /// (migration <c>AddStatusUsuario</c>). Default <see cref="StatusUsuario.AguardandoAprovacao"/>:
    /// fail-closed — conta nova nasce barrada até o admin aprovar (spec `docs/features/admin/spec.md`
    /// §3). NUNCA setável por endpoint/DTO de registro/perfil (blindagem contra escalação, igual
    /// <see cref="IsAdmin"/>); só o fluxo de admin (aprovar/recusar/bloquear) muda.</summary>
    public StatusUsuario Status { get; set; } = StatusUsuario.AguardandoAprovacao;

    /// <summary>Admin que aprovou/recusou o cadastro (auditoria da fila). Null enquanto pendente.</summary>
    public Guid? AprovadoPor { get; set; }

    /// <summary>Quando o cadastro foi aprovado/recusado. Null enquanto pendente.</summary>
    public DateTime? AprovadoEm { get; set; }

    /// <summary>Quando a pessoa confirmou o e-mail pelo link do "pedido recebido". Null = ninguém provou que o e-mail
    /// é de quem pediu acesso: o Admin não aprova. Contas anteriores a 2026-10-27 vieram marcadas pela migration.</summary>
    public DateTime? EmailConfirmadoEm { get; set; }

    /// <summary>Último login bem-sucedido — base das métricas do admin (usuários ativos/inativos).</summary>
    public DateTime? UltimoAcessoEm { get; set; }

    /// <summary>Quando a conta foi marcada para exclusão (Módulo C — LGPD). Preenchido junto com
    /// <see cref="StatusUsuario.MarcadoParaExclusao"/>; base da janela de carência (30 dias) que o
    /// job de purga usa pra saber quando pode apagar de verdade. Null fora do fluxo de exclusão;
    /// volta a null quando a exclusão é cancelada (reversível na janela). Spec §5.</summary>
    public DateTime? MarcadoExclusaoEm { get; set; }

    /// <summary>Quando a foto de perfil foi trocada pela última vez; null = sem foto. Serve de "versão" da
    /// foto pro front (a URL leva esse valor, o navegador busca de novo só quando muda). Os bytes moram em
    /// <see cref="FotoPerfil"/>.</summary>
    public DateTime? FotoPerfilEm { get; set; }

    /// <summary>Admin GLOBAL do sistema (painel admin/beta). Default false e — por segurança
    /// (spec `docs/features/admin/spec.md` §0) — NUNCA é setada por endpoint/DTO: só via seed
    /// (env var <c>ADMIN_EMAILS</c>, ver <c>AdminSeeder</c>) ou UPDATE direto no banco. Nenhum fluxo
    /// que o usuário alcança pode conceder esta flag (prevenção de escalação de privilégio). É
    /// separada do <c>PapelFamilia</c> (que é por-família, escopo local). Autorização revalida esta
    /// flag no banco a cada request (ver <c>AdminAuthorizationHandler</c>), não confia só no JWT.</summary>
    public bool IsAdmin { get; set; }

    /// <summary>Issue #29 — true depois que o usuário concluiu (ou pulou) o
    /// onboarding guiado. Evita reexibir o fluxo de primeiros passos.</summary>
    public bool OnboardingConcluido { get; set; }

    /// <summary>Proteção contra força bruta (OWASP Authentication Cheat Sheet) — contador
    /// por CONTA, não por IP (rate-limit por IP já existe, mas é contornável trocando IP).
    /// Zerado no login bem-sucedido e no reset de senha.</summary>
    public int FalhasLoginConsecutivas { get; set; }

    /// <summary>Timestamp da última falha de login — base do delay progressivo
    /// (dobra a cada erro, OWASP) calculado em <c>AuthService.LoginAsync</c>.</summary>
    public DateTime? UltimaFalhaLoginEm { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;

    // ── MFA (TOTP, opt-in — NUNCA obrigatório, decisão do Gustavo 2026-08-23) ────────────

    /// <summary>True quando o usuário ativou e confirmou o MFA. Login passa a exigir um
    /// segundo passo (código TOTP ou backup code) antes de emitir o JWT.</summary>
    public bool MfaAtivo { get; set; }

    /// <summary>Secret TOTP (RFC 6238), criptografado em repouso (<c>MfaCrypto</c>) — nunca em
    /// texto claro no banco. Null enquanto MFA não está ativo.</summary>
    public string? MfaSecretoCriptografado { get; set; }

    /// <summary>Secret gerado durante o setup, ainda não confirmado (usuário escaneou o QR mas
    /// não digitou o código de confirmação ainda). Vira <see cref="MfaSecretoCriptografado"/> só
    /// depois de validar 1 código certo — evita ativar MFA com secret que o app do usuário nunca
    /// recebeu direito (QR não escaneado / erro de leitura).</summary>
    public string? MfaSecretoPendenteCriptografado { get; set; }

    public DateTime? MfaAtivadoEm { get; set; }

    /// <summary>Convite pra ativar o MFA depois do login: "agora não" adia até esta data (30 dias). Null = nunca adiado.</summary>
    public DateTime? MfaConviteAdiadoAte { get; set; }

    /// <summary>A pessoa marcou "não perguntar mais": o convite nunca mais aparece (o MFA continua nas Configurações).</summary>
    public bool MfaConviteDispensado { get; set; }

    public Guid? RelacionamentoId { get; set; }
    public Relacionamento? Relacionamento { get; set; }

    // Navigation properties
    public ICollection<Conta> Contas { get; set; } = new List<Conta>();
    public ICollection<CompartilhamentoConta> CompartilhamentosContas { get; set; } = new List<CompartilhamentoConta>();
    public ICollection<MfaBackupCode> MfaBackupCodes { get; set; } = new List<MfaBackupCode>();
}

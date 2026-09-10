using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Admin;

/// <summary>
/// Usuário visto pelo admin (fila de aprovação e gestão). Nunca expõe hash de senha, secret de MFA
/// nem dado financeiro — só o necessário pra decidir aprovar/recusar e acompanhar.
/// </summary>
public class UsuarioAdminDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public StatusUsuario Status { get; set; }
    public DateTime CriadoEm { get; set; }
    public DateTime? AprovadoEm { get; set; }
    public DateTime? UltimoAcessoEm { get; set; }
}

/// <summary>
/// Métricas do beta pro dashboard do admin. Contagens simples por estado + cadastros recentes.
/// </summary>
public class MetricasAdminDto
{
    public int Total { get; set; }
    public int Pendentes { get; set; }
    public int Ativos { get; set; }
    public int Recusados { get; set; }
    public int Bloqueados { get; set; }
    public int MarcadosParaExclusao { get; set; }

    /// <summary>Cadastros nos últimos 7 dias (inclui hoje).</summary>
    public int CadastrosUltimos7Dias { get; set; }

    /// <summary>Usuários ativos que logaram nos últimos 7 dias.</summary>
    public int AtivosUltimos7Dias { get; set; }
}

/// <summary>
/// Linha do visualizador de auditoria (Módulo D). Só leitura. Snapshot legível sozinho.
/// </summary>
public class AdminAuditLogDto
{
    public Guid Id { get; set; }
    public string AdminEmail { get; set; } = string.Empty;
    public AcaoAdmin Acao { get; set; }
    public string? AlvoTipo { get; set; }
    public Guid? AlvoId { get; set; }
    public string? AlvoDescricao { get; set; }
    public string? Detalhe { get; set; }
    public DateTime CriadoEm { get; set; }
}

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

    /// <summary>Módulo C — quando marcada pra exclusão (null fora do fluxo). O front usa pra
    /// mostrar a carência restante e o botão de cancelar/purgar.</summary>
    public DateTime? MarcadoExclusaoEm { get; set; }

    /// <summary>A pessoa confirmou o e-mail pelo link do "pedido recebido". Sem isso o Admin não aprova.</summary>
    public bool EmailConfirmado { get; set; }

    /// <summary>Mapeamento em memória (fonte única, reusado pelos serviços de admin). As listagens
    /// que projetam direto no banco (EF <c>Select</c>) repetem os campos inline por causa da tradução
    /// da query — este factory é pra quando já se tem a entidade carregada.</summary>
    public static UsuarioAdminDto De(Domain.Entities.Usuario u) => new()
    {
        Id = u.Id,
        Email = u.Email,
        Nome = u.Nome,
        Status = u.Status,
        CriadoEm = u.CriadoEm,
        AprovadoEm = u.AprovadoEm,
        UltimoAcessoEm = u.UltimoAcessoEm,
        MarcadoExclusaoEm = u.MarcadoExclusaoEm,
        EmailConfirmado = u.EmailConfirmadoEm != null,
    };
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

namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// Tipo de notificação do painel admin (stream separado do financeiro — NÃO misturar). Valores
/// inteiros são persistidos — NÃO reordenar nem reaproveitar números.
/// </summary>
public enum TipoNotificacaoAdmin
{
    /// <summary>Novo cadastro entrou na fila de aprovação do beta.</summary>
    NovoCadastro = 0,

    /// <summary>Evento de exclusão/purga LGPD (ex.: purga automática de carência vencida).</summary>
    ExclusaoLgpd = 1,

    /// <summary>Alerta de segurança (ex.: conta bloqueada por força bruta).</summary>
    Seguranca = 2,
}

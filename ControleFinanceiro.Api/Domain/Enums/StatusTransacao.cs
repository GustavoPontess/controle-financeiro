namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// Status de uma Transacao. Diferencia transações reais (Executado) de
/// previsões geradas por Recorrentes (Previsao) e canceladas (Cancelado).
/// Spec: ARQUITETURA_PARCELAMENTO.md § "ENUMS NOVOS E MODIFICADOS".
/// </summary>
/// <remarks>
/// Impacto em saldo/limite:
/// - Saldo Conta REAL = SUM(Transacao WHERE Status==Executado AND Ativo)
/// - Saldo Conta PREVISTO = SUM(Transacao WHERE Status==Previsao AND Ativo)
/// - LimiteBloqueado conta apenas Pendente/Executado, NUNCA Previsao.
/// </remarks>
public enum StatusTransacao
{
    /// <summary>Transação de recorrente futura (não executada ainda). Não bloqueia limite.</summary>
    Previsao = 0,

    /// <summary>Já foi cobrada/creditada.</summary>
    Executado = 1,

    /// <summary>Usuário cancelou.</summary>
    Cancelado = 2,
}

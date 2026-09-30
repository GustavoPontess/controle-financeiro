namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>Tipo do marco de reconciliação. Ver docs/features/reconciliacao/spec.md.</summary>
public enum TipoMarcoReconciliacao
{
    /// <summary>1º ponto de verdade da conta (saldo real numa data). Assume o declarado como verdade.</summary>
    Baseline = 1,

    /// <summary>Confere calculado × declarado; se não bate, o usuário resolve (lança o que falta ou ajusta).</summary>
    Verificacao = 2,
}

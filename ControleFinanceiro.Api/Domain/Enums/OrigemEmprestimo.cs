namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// De onde vieram os dados do empréstimo. Prepara o terreno pro Open Finance (Fase 2):
/// dado importado do banco não deve ser editado à mão como um lançado manualmente.
/// Spec/pesquisa: docs/features/emprestimo-bancario/pesquisa-openfinance.md.
/// </summary>
public enum OrigemEmprestimo
{
    /// <summary>Digitado pelo usuário (padrão atual).</summary>
    Manual = 1,

    /// <summary>Importado do banco via Open Finance / agregador (Fase 2 — ainda não implementado).</summary>
    OpenFinance = 2,
}

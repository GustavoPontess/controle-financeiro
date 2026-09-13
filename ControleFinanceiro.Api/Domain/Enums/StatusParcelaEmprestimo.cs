namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// Estado de uma parcela de empréstimo. "Atrasada" é calculado (vencimento no passado e ainda
/// Pendente), não persistido — mesmo padrão de Emprestimo.Vencido.
/// Spec: docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md.
/// </summary>
public enum StatusParcelaEmprestimo
{
    Pendente = 1,
    Paga = 2,
    Cancelada = 3,
}

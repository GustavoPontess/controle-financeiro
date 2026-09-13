using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Parcela de um empréstimo com FormaPagamento = Parcelado. Geradas todas na criação do
/// empréstimo (número fixo, vencimento mensal). Spec:
/// docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md.
/// </summary>
public class EmprestimoParcela
{
    public Guid Id { get; set; }
    public Guid EmprestimoId { get; set; }
    public Emprestimo Emprestimo { get; set; } = null!;

    public int Numero { get; set; }
    public int QuantidadeTotal { get; set; }
    public DateTime DataVencimento { get; set; }
    public decimal Valor { get; set; }

    /// <summary>Valor * (1 + TaxaJuroMensal/100) — calculado na geração, só preenchido se o
    /// empréstimo tem TaxaJuroMensal informado.</summary>
    public decimal? ValorComJuros { get; set; }

    /// <summary>Calculado só quando a parcela vence sem pagamento — snapshot congelado na
    /// primeira detecção do atraso, não recalculado a cada leitura.</summary>
    public decimal? ValorComMulta { get; set; }

    public StatusParcelaEmprestimo Status { get; set; } = StatusParcelaEmprestimo.Pendente;

    /// <summary>Soma de todo valor já aplicado (aprovado) nesta parcela — pode ser menor que o
    /// valor devido enquanto paga aos poucos (adiantamento parcial, tipo abater fatura de cartão
    /// antes de fechar). Status só vira Paga quando ValorPago cobre o valor devido por completo.</summary>
    public decimal ValorPago { get; set; }

    /// <summary>Liga à solicitação de pagamento mais recente aplicada nesta parcela — pode não ser
    /// a única se houve mais de um pagamento parcial.</summary>
    public Guid? SolicitacaoPagamentoId { get; set; }
    public EmprestimoPagamentoSolicitacao? SolicitacaoPagamento { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}

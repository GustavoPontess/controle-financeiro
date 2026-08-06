using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Solicitação de pagamento feita pelo devedor de um empréstimo vinculado, com comprovante
/// (Transacao real) anexado. Só o credor aprova/rejeita — aprovação é o que avança
/// Emprestimo.ValorPago. Spec: docs/features/emprestimo-compartilhado/pagamento-aprovacao.md.
/// </summary>
public class EmprestimoPagamentoSolicitacao
{
    public Guid Id { get; set; }
    public Guid EmprestimoId { get; set; }
    public Emprestimo Emprestimo { get; set; } = null!;

    public decimal Valor { get; set; }

    /// <summary>Comprovante — a Transacao real (Pix/saída) que o devedor lançou. Obrigatório
    /// (diferente do vínculo opcional na criação do Emprestimo): não existe solicitação sem prova.</summary>
    public Guid TransacaoComprovanteId { get; set; }
    public Transacao TransacaoComprovante { get; set; } = null!;

    public Guid SolicitadoPor { get; set; }
    public StatusAprovacaoPagamentoEmprestimo StatusAprovacao { get; set; } = StatusAprovacaoPagamentoEmprestimo.Pendente;

    public Guid? AprovadoPorUsuarioId { get; set; }
    public DateTime? AprovadoEm { get; set; }

    /// <summary>Texto livre opcional que o credor escreve ao rejeitar — entra na notificação
    /// pro devedor e fica visível no histórico (decisão do Gustavo, 2026-08-06).</summary>
    public string? MotivoRejeicao { get; set; }

    /// <summary>Entrada real na conta do credor — só setado quando aprovado. O credor escolhe
    /// pra qual conta foi (dinheiro/Pix/etc) na hora de aprovar.</summary>
    public Guid? TransacaoRecebimentoId { get; set; }
    public Transacao? TransacaoRecebimento { get; set; }

    /// <summary>Se o empréstimo é Parcelado, qual EmprestimoParcela este pagamento quita.
    /// Null pra empréstimo à vista. A parcela só vira Paga na aprovação, não na solicitação —
    /// se rejeitada, a parcela permanece Pendente e pode receber outra solicitação.</summary>
    public Guid? ParcelaId { get; set; }
    public EmprestimoParcela? Parcela { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}

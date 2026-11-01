using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Registro de pagamento de um empréstimo vinculado — devedor ou credor pode registrar, pelo
/// mesmo formulário (unificado em 2026-08-08). Devedor registrando: nasce Pendente, precisa do
/// credor aprovar. Credor registrando: nasce já Aprovada (confirmando o próprio recebimento não
/// precisa de autoaprovação) — mesmo padrão do Splitwise (settle-up sem confirmação obrigatória
/// do outro lado, só notifica). Spec: docs/features/emprestimo-compartilhado/pagamento-aprovacao.md.
/// </summary>
public class EmprestimoPagamentoSolicitacao
{
    public Guid Id { get; set; }
    public Guid EmprestimoId { get; set; }
    public Emprestimo Emprestimo { get; set; } = null!;

    public decimal Valor { get; set; }

    /// <summary>Quanto deste pagamento é juros ou multa (o resto devolve o que foi emprestado). Imputação do Código Civil
    /// (art. 354): o pagamento cobre primeiro os juros, depois o capital. Estimado ao solicitar e refeito ao aprovar.</summary>
    public decimal? ValorJuros { get; set; }

    /// <summary>Comprovante — a Transacao real (Pix/saída) que o devedor lançou. Obrigatório quando
    /// quem registra é o devedor (não existe solicitação dele sem prova); null quando é o credor
    /// que registra o próprio recebimento (nesse caso a prova é a TransacaoRecebimentoId).</summary>
    public Guid? TransacaoComprovanteId { get; set; }
    public Transacao? TransacaoComprovante { get; set; }

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

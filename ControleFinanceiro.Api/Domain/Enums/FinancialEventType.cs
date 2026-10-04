namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// Tipo de evento registrado em FinancialEventLog (audit log financeiro).
/// Não é event sourcing — é audit trail append-only que vive ao lado do estado mutável.
/// Spec: ARQUITETURA_PARCELAMENTO.md § "FinancialEventType (enum)".
/// </summary>
/// <remarks>
/// Valores são espaçados em blocos por entidade afetada (parcelamento, parcela,
/// fatura, limite, recorrente, transação) pra permitir adicionar novos eventos
/// dentro de cada bloco sem renumerar.
/// </remarks>
public enum FinancialEventType
{
    // Parcelamento
    ParcelamentoCriado = 1,
    ParcelamentoCancelado = 2,

    // Parcela
    ParcelaPaga = 10,
    ParcelaCancelada = 11,

    // Fatura
    FaturaFechada = 20,
    FaturaMarcadaAtrasada = 21,
    FaturaPagaTotal = 22,
    FaturaPagaParcial = 23,

    // Limite
    LimiteBloqueado = 30,
    LimiteLiberado = 31,

    // Recorrente
    RecorrenteCriada = 40,
    RecorrenteCancelada = 41,
    RecorrenteExecutada = 42,

    // Transação
    TransacaoCriada = 50,
    TransacaoCancelada = 51,
    TransacaoAtualizada = 52,

    // Família — acerto de contas (settle-up)
    AcertoRegistrado = 60,
    AcertoCancelado = 61,

    // Empréstimo compartilhado (docs/features/emprestimo-compartilhado/spec.md)
    EmprestimoCriado = 70,
    EmprestimoPagamentoRegistrado = 71,
    EmprestimoQuitado = 72,
    EmprestimoVinculado = 73,
    EmprestimoVinculoRecusado = 74,

    // Empréstimo — pagamento com comprovante + aprovação (docs/features/emprestimo-compartilhado/pagamento-aprovacao.md)
    EmprestimoPagamentoSolicitado = 75,
    EmprestimoPagamentoAprovado = 76,
    EmprestimoPagamentoRejeitado = 77,

    // Empréstimo — unificar/consolidar (docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md)
    EmprestimoConsolidacaoProposta = 78,
    EmprestimoConsolidacaoAceita = 79,
    EmprestimoConsolidacaoRecusada = 80,
    EmprestimoConsolidacaoCancelada = 81,

    // Reconciliação (docs/features/reconciliacao/spec.md)
    ReconciliacaoRegistrada = 90,
    ReconciliacaoRemovida = 91,
    /// <summary>Marco já gravado teve a diferença fechada depois (ajuste lançado ou recálculo que passou a bater).</summary>
    ReconciliacaoAtualizada = 92,
}

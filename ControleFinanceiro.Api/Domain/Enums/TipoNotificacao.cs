namespace ControleFinanceiro.Api.Domain.Enums;

public enum TipoNotificacao
{
    ConviteFamilia = 1,
    DespesaCompartilhada = 2,
    AcertoContas = 3,
    FaturaVencendo = 4,
    OrcamentoEstourado = 5,
    DespesaAprovacaoPendente = 6,
    DespesaAprovada = 7,
    DespesaRejeitada = 8,
    EmprestimoVinculo = 9,
    EmprestimoPagamentoSolicitado = 10,
    EmprestimoPagamentoAvaliado = 11,
    EmprestimoConsolidacaoProposta = 12,
    EmprestimoConsolidacaoRespondida = 13,
    /// <summary>Cobrança de conta fixa no cartão que não passou por falta de limite (o app tenta de novo todo dia).</summary>
    CobrancaSemLimite = 14,
    /// <summary>O admin mudou o status de uma solicitação do beta que a pessoa mandou.</summary>
    SolicitacaoAtualizada = 15,
    Outro = 99,
}

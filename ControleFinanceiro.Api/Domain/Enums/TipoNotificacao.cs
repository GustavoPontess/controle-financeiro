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
    Outro = 99,
}
